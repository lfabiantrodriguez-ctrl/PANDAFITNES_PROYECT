const UserModel = require("../models/UserModel");
const ReservationModel = require("../models/ReservationModel");
const AttendanceModel = require("../models/AttendanceModel");
const { sendEmail } = require("../utils/email");
const {
    calculateDurationMinutes,
    getRefundDurationMinutes,
    formatDurationLabel,
    getCancelWindowStatus,
    getEndOfGymDay,
    formatMysqlDatetime,
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
    if (reservation?.tipo === "reintegro_emergencia" && reservation.estado === "pendiente") {
        return {
            valid: true,
            label: "Reintegro pendiente",
            detail: `Reincorporacion disponible (${formatDurationLabel(reservation.duracionMinutos || 60)} restantes)`,
            isReintegro: true,
        };
    }

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
            const history = await ReservationModel.getByUser(user.id);

            if (!reservation && history.length === 0) {
                return res.status(404).json({ message: "No hay reservas activas ni historial para este socio" });
            }

            const now = new Date();
            const status = reservation ? getStatus(now, reservation.horaEntrada, reservation.horaSalida, reservation) : null;
            const cancelWindow = reservation && reservation.tipo !== "reintegro_emergencia"
                ? getCancelWindowStatus(now, reservation.horaEntrada)
                : { canCancel: false, minutesRemaining: 0, detail: "No aplica" };

            return res.json({
                user,
                reservation,
                history,
                checkInStatus: status,
                cancelWindow,
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

            if (reservation.estado === "cancelada" || reservation.estado === "cancelada_emergencia" || reservation.estado === "no_show") {
                return res.status(400).json({ message: "No se puede confirmar esta reserva" });
            }

            const now = new Date();

            if (reservation.tipo === "reintegro_emergencia") {
                if (reservation.estado !== "pendiente") {
                    return res.status(400).json({ message: "Esta reserva de reintegro ya fue utilizada" });
                }

                const refundMinutes = reservation.duracionMinutos;
                if (!refundMinutes || refundMinutes <= 0) {
                    return res.status(400).json({ message: "La reserva de reintegro no tiene duracion valida" });
                }

                const horaEntradaDb = formatMysqlDatetime(now);
                const horaSalidaDb = formatMysqlDatetime(new Date(now.getTime() + refundMinutes * 60_000));

                await ReservationModel.updateSchedule(reservation.id, horaEntradaDb, horaSalidaDb);
                await AttendanceModel.create({
                    reservaId: reservation.id,
                    usuarioId: reservation.usuarioId,
                    horaEntrada: horaEntradaDb,
                });
                await ReservationModel.updateStatus(reservation.id, "confirmada");

                const user = await UserModel.findActiveById(reservation.usuarioId);
                if (user && user.email) {
                    await sendEmail({
                        to: user.email,
                        subject: "Reincorporacion Confirmada - Panda Fitness",
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                                <h2 style="color: #16a34a;">¡Hola ${user.nombre}!</h2>
                                <p>Tu reincorporacion por emergencia ha sido registrada. Tienes <strong>${formatDurationLabel(refundMinutes)}</strong> de entrenamiento disponibles.</p>
                                <p>¡Disfruta tu entrenamiento!</p>
                                <br/>
                                <p>Saludos,<br/>El equipo de <strong>Panda Fitness</strong></p>
                            </div>
                        `,
                    }).catch((err) => console.error("Error sending reintegro email:", err));
                }

                return res.json({
                    message: "Reincorporacion registrada correctamente",
                    reservationId: reservation.id,
                    tipo: "reintegro_emergencia",
                });
            }

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

    static async cancelEmergency(req, res) {
        try {
            const { reservationId } = req.body;
            if (!reservationId) {
                return res.status(400).json({ message: "Falta reservationId" });
            }

            const reservation = await ReservationModel.findById(reservationId);
            if (!reservation) {
                return res.status(404).json({ message: "Reserva no encontrada" });
            }

            if (reservation.tipo === "reintegro_emergencia") {
                return res.status(400).json({ message: "Las reservas de reintegro por cancelacion no pueden ser canceladas" });
            }

            if (!["pendiente", "confirmada"].includes(reservation.estado)) {
                return res.status(400).json({ message: "Solo se pueden cancelar reservas pendientes o confirmadas" });
            }

            const now = new Date();
            const cancelWindow = getCancelWindowStatus(now, reservation.horaEntrada);
            if (!cancelWindow.canCancel) {
                return res.status(400).json({ message: cancelWindow.detail });
            }

            const originalDuration = calculateDurationMinutes(reservation.horaEntrada, reservation.horaSalida);
            const refundMinutes = getRefundDurationMinutes(originalDuration);
            if (!refundMinutes) {
                return res.status(400).json({ message: "No se pudo calcular el reintegro para esta duracion de reserva" });
            }

            if (reservation.estado === "confirmada") {
                const attendance = await AttendanceModel.findByReservationId(reservationId);
                if (attendance && !attendance.horaSalida) {
                    await AttendanceModel.setExitByReservation(reservationId, formatMysqlDatetime(now));
                }
            }

            await ReservationModel.markEmergencyCancellation(reservationId);

            const endOfDay = getEndOfGymDay(now);
            const reintegro = await ReservationModel.create({
                usuarioId: reservation.usuarioId,
                horaEntrada: formatMysqlDatetime(now),
                horaSalida: formatMysqlDatetime(endOfDay),
                tipo: "reintegro_emergencia",
                reservaOrigenId: reservation.id,
                duracionMinutos: refundMinutes,
            });

            const user = await UserModel.findActiveById(reservation.usuarioId);
            if (user && user.email) {
                await sendEmail({
                    to: user.email,
                    subject: "Reserva Cancelada por Emergencia - Reintegro Disponible",
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #c2410c;">¡Hola ${user.nombre}!</h2>
                            <p>Tu reserva ha sido cancelada por emergencia en recepcion.</p>
                            <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 12px; margin: 15px 0;">
                                <p style="margin: 4px 0;"><strong>Reintegro disponible:</strong> ${formatDurationLabel(refundMinutes)}</p>
                                <p style="margin: 4px 0;"><strong>Validez:</strong> Hoy mismo (al regresar, presentate en recepcion)</p>
                            </div>
                            <p>No necesitas crear una nueva reserva. Al volver al gimnasio, el administrador registrara tu reincorporacion.</p>
                            <br/>
                            <p>Atentamente,<br/>El equipo de <strong>Panda Fitness</strong></p>
                        </div>
                    `,
                }).catch((err) => console.error("Error sending emergency cancel email:", err));
            }

            return res.json({
                message: "Reserva cancelada por emergencia. Reintegro generado para el socio.",
                reservationId,
                reintegroReserva: reintegro,
                refundMinutes,
                refundLabel: formatDurationLabel(refundMinutes),
            });
        } catch (error) {
            console.error("Error cancelando reserva por emergencia:", error);
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
}

module.exports = CheckInController;
