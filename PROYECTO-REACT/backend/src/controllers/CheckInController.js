const UserModel = require("../models/UserModel");
const ReservationModel = require("../models/ReservationModel");
const AttendanceModel = require("../models/AttendanceModel");
const { sendEmail } = require("../utils/email");
const {
    getEndOfGymDay,
    formatMysqlDatetime,
    isValidGymSchedule,
    TOLERANCE_MINUTES,
} = require("../utils/reservationHelpers");

function parseSearchCode(code) {
    const normalized = String(code || "").trim();

    if (!normalized) {
        return null;
    }

    const numeric = normalized.replace(/\D/g, "");
    if (numeric.length === 8) {
        return { type: "dni", value: numeric };
    }

    if (/^PF-?\d+$/i.test(normalized)) {
        return { type: "id", value: numeric };
    }

    if (/^\d+$/.test(normalized)) {
        return { type: "id", value: numeric };
    }

    return { type: "name", value: normalized };
}

function getStatus(now, entryTime, exitTime, reservation = null) {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    const toleranceEnd = new Date(entry.getTime() + TOLERANCE_MINUTES * 60 * 1000);

    if (now < entry) {
        return {
            valid: false,
            label: "Pendiente",
            detail: `Falta ${Math.max(0, Math.round((entry.getTime() - now.getTime()) / 60000))} min para el ingreso`,
        };
    }

    if (now >= entry && now <= toleranceEnd) {
        return {
            valid: true,
            label: "Valido",
            detail: `+${Math.round((now.getTime() - entry.getTime()) / 60000)} min`,
        };
    }

    if (now > toleranceEnd && now <= exit) {
        return {
            valid: false,
            label: "Tolerancia expirada",
            detail: `Pasaron +${Math.round((now.getTime() - toleranceEnd.getTime()) / 60000)} min`,
        };
    }

    return {
        valid: false,
        label: "Reserva expirada",
        detail: "El horario ya no esta disponible",
    };
}

class CheckInController {
    static async lookupReservation(req, res) {
        try {
            const MembershipModel = require("../models/MembershipModel");
            const lookup = parseSearchCode(req.params.code);
            if (!lookup) {
                return res.status(400).json({ message: "Codigo de socio o DNI invalido" });
            }

            let user = null;
            if (lookup.type === "dni") {
                user = await UserModel.findActiveByDni(lookup.value);
            } else if (lookup.type === "id") {
                user = await UserModel.findActiveById(Number(lookup.value));
            } else {
                user = await UserModel.findActiveByName(lookup.value);
            }

            if (!user) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            const reservation = await ReservationModel.findActiveForCheckIn(user.id);
            const history = await ReservationModel.getAccessHistory(user.id);
            const membership = await MembershipModel.getClientMembership(user.id);

            const isValidMembership = membership &&
                membership.estado === 'activo' &&
                new Date(membership.fechaFin) >= new Date();

            if (!reservation && !isValidMembership) {
                return res.status(404).json({ message: "No hay reservas activas ni membresia activa para este socio" });
            }

            const now = new Date();
            const status = reservation ? getStatus(now, reservation.horaEntrada, reservation.horaSalida, reservation) : null;

            return res.json({
                user,
                reservation,
                membership: isValidMembership ? membership : null,
                history,
                checkInStatus: status,
                canDirectCheckIn: !reservation && isValidMembership,
                currentTime: now.toISOString(),
            });
        } catch (error) {
            console.error("Error buscando reserva:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async confirmEntry(req, res) {
        try {
            const { reservationId } = req.body;
            const reservation = await ReservationModel.findById(reservationId);

            if (!reservation) {
                return res.status(404).json({ message: "Reserva no encontrada" });
            }

            if (reservation.estado === "cancelada" || reservation.estado === "no_show") {
                return res.status(400).json({ message: "No se puede confirmar esta reserva" });
            }

            const now = new Date();
            const entry = new Date(reservation.horaEntrada);
            const toleranceEnd = new Date(entry.getTime() + TOLERANCE_MINUTES * 60 * 1000);

            if (now < entry || now > toleranceEnd) {
                return res.status(400).json({ message: "La reserva no esta dentro del rango de ingreso permitido" });
            }

            await AttendanceModel.create({
                reservaId: reservation.id,
                usuarioId: reservation.usuarioId,
                horaEntrada: formatMysqlDatetime(now),
            });

            await ReservationModel.updateStatus(reservation.id, "confirmada");

            const user = await UserModel.findActiveById(reservation.usuarioId);
            if (user && user.email) {
                const entryDate = new Date(reservation.horaEntrada);
                const localTimeStr = entryDate.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                });
                const localDateStr = entryDate.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                });

                await sendEmail({
                    to: user.email,
                    subject: "Ingreso Confirmado - Panda Fitness",
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #16a34a;">¡Hola ${user.nombre}!</h2>
                            <p>Hemos confirmado tu ingreso al gimnasio el día <strong>${localDateStr}</strong> para tu reserva de las <strong>${localTimeStr}</strong>.</p>
                            <p>¡Disfruta tu entrenamiento de hoy!</p>
                            <br/>
                            <p>Saludos,<br/>El equipo de <strong>Panda Fitness</strong></p>
                        </div>
                    `,
                }).catch((err) => console.error("Error sending checkin email:", err));
            }

            return res.json({ message: "Entrada confirmada", reservationId: reservation.id });
        } catch (error) {
            console.error("Error confirmando entrada:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async finalizeReservation(req, res) {
        try {
            const { reservationId } = req.body;
            if (!reservationId) {
                return res.status(400).json({ message: "Falta reservationId" });
            }

            const reservation = await ReservationModel.findById(reservationId);
            if (!reservation) {
                return res.status(404).json({ message: "Reserva no encontrada" });
            }

            if (reservation.estado !== "confirmada") {
                return res.status(400).json({ message: "Solo se puede finalizar una reserva confirmada" });
            }

            const attendance = await AttendanceModel.findByReservationId(reservationId);
            if (!attendance) {
                return res.status(400).json({ message: "No hay registro de asistencia para esta reserva" });
            }

            if (attendance.horaSalida) {
                return res.status(400).json({ message: "La asistencia ya esta finalizada" });
            }

            const now = new Date();
            const horaSalidaDb = formatMysqlDatetime(now);
            await AttendanceModel.setExitByReservation(reservationId, horaSalidaDb);
            await ReservationModel.updateStatus(reservationId, "finalizada");

            return res.json({
                message: "Reserva finalizada por administrador",
                reservationId,
                horaSalida: now.toISOString(),
            });
        } catch (error) {
            console.error("Error finalizando reserva manualmente:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async confirmDirectEntry(req, res) {
        try {
            const { userId, durationMinutes } = req.body;
            const MembershipModel = require("../models/MembershipModel");

            if (!userId) {
                return res.status(400).json({ message: "Falta userId" });
            }

            const user = await UserModel.findActiveById(userId);
            if (!user) {
                return res.status(404).json({ message: "Usuario no encontrado" });
            }

            const membership = await MembershipModel.getClientMembership(userId);
            const isValidMembership = membership &&
                membership.estado === 'activo' &&
                new Date(membership.fechaFin) >= new Date();

            if (!isValidMembership) {
                return res.status(400).json({ message: "El usuario no tiene una membresía activa" });
            }

            const now = new Date();
            const duration = Number(durationMinutes) || 60;
            const allowed = [60, 90, 120, 150, 180];
            const dur = allowed.includes(duration) ? duration : 60;

            const horaEntrada = formatMysqlDatetime(now);
            const salidaDate = new Date(now.getTime() + dur * 60 * 1000);
            const horaSalida = formatMysqlDatetime(salidaDate);

            // Validar que el ingreso y la salida estén dentro del horario de atención del gimnasio
            if (!isValidGymSchedule(now, dur)) {
                return res.status(400).json({
                    message: "No se puede realizar el registro porque el gimnasio está fuera del horario de atención",
                });
            }

            // Crear una reserva temporal para el check-in directo y marcarla confirmada
            const reservation = await ReservationModel.create({
                usuarioId: userId,
                horaEntrada,
                horaSalida,
                tipo: 'checkin_directo',
                reservaOrigenId: null,
                duracionMinutos: dur,
            });

            // Marcar la reserva como confirmada
            await ReservationModel.updateStatus(reservation.id, 'confirmada');

            // Crear asistencia vinculada a la reserva (hora_salida se dejará NULL y el cron la finalizará)
            const attendance = await AttendanceModel.create({
                reservaId: reservation.id,
                usuarioId: userId,
                horaEntrada,
            });

            if (user.email) {
                const localTimeStr = now.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                });
                const localDateStr = now.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                });

                await sendEmail({
                    to: user.email,
                    subject: "Check-in Directo Registrado - Panda Fitness",
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #16a34a;">¡Hola ${user.nombre}!</h2>
                            <p>Tu ingreso directo al gimnasio ha sido registrado el <strong>${localDateStr}</strong> a las <strong>${localTimeStr}</strong>.</p>
                            <p>Plan activo: <strong>${membership.planNombre}</strong></p>
                            <p>¡Disfruta tu entrenamiento!</p>
                            <br/>
                            <p>Saludos,<br/>El equipo de <strong>Panda Fitness</strong></p>
                        </div>
                    `,
                }).catch((err) => console.error("Error sending direct checkin email:", err));
            }

            return res.json({
                message: "Check-in directo confirmado",
                reservation: {
                    id: reservation.id,
                    horaEntrada: reservation.horaEntrada,
                    horaSalida: reservation.horaSalida,
                    duracionMinutos: reservation.duracionMinutos,
                },
                attendance: {
                    id: attendance.id,
                    usuarioId: attendance.usuarioId,
                    horaEntrada: attendance.horaEntrada,
                },
            });
        } catch (error) {
            console.error("Error en check-in directo:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = CheckInController;
