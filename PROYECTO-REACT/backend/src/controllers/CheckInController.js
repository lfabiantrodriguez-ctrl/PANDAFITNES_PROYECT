const db = require("../config/database");
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
                return res.status(400).json({ message: "Código de socio o DNI inválido" });
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

            const history = await AttendanceModel.getByUser(user.id);
            const membership = await MembershipModel.getClientMembership(user.id);
            const activeAttendance = await AttendanceModel.findActiveByUser(user.id);

            const isValidMembership = membership &&
                membership.estado === 'activo' &&
                new Date(membership.fechaFin) >= new Date();

            const now = new Date();

            return res.json({
                user,
                membership: isValidMembership ? membership : null,
                membershipStatus: isValidMembership ? 'activa' : (membership ? 'vencida' : 'sin_membresia'),
                history: history ? history.slice(0, 5) : [],
                activeAttendance,
                canDirectCheckIn: isValidMembership && !activeAttendance,
                isInside: !!activeAttendance,
                currentTime: now.toISOString(),
            });
        } catch (error) {
            console.error("Error buscando socio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async confirmEntry(req, res) {
        try {
            const { userId, reservationId } = req.body;
            const targetId = userId || reservationId;

            if (!targetId) {
                return res.status(400).json({ message: "Se requiere el ID del socio" });
            }

            const user = await UserModel.findActiveById(targetId);
            if (!user) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            const active = await AttendanceModel.findActiveByUser(user.id);
            if (active) {
                return res.status(400).json({ message: "El socio ya tiene un ingreso activo en sala" });
            }

            const now = new Date();
            const attendance = await AttendanceModel.create({
                usuarioId: user.id,
                horaEntrada: formatMysqlDatetime(now),
                metodoRegistro: "manual",
            });

            return res.json({ message: "¡Ingreso de socio confirmado!", attendanceId: attendance.id, user });
        } catch (error) {
            console.error("Error confirmando entrada:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async finalizeReservation(req, res) {
        try {
            const { userId, reservationId, attendanceId } = req.body;
            const now = new Date();
            const horaSalidaDb = formatMysqlDatetime(now);

            if (attendanceId) {
                await AttendanceModel.setExitById(attendanceId, horaSalidaDb);
                return res.json({ message: "Salida registrada con éxito" });
            }

            const targetId = userId || reservationId;
            if (targetId) {
                const active = await AttendanceModel.findActiveByUser(targetId);
                if (active) {
                    await AttendanceModel.setExitById(active.id, horaSalidaDb);
                    return res.json({ message: "Salida registrada con éxito" });
                }
            }

            return res.json({ message: "Salida registrada con éxito" });
        } catch (error) {
            console.error("Error registrando salida:", error);
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
                metodoRegistro: req.body.metodoRegistro || 'manual',
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
                    metodoRegistro: attendance.metodoRegistro,
                },
            });
        } catch (error) {
            console.error("Error en check-in directo:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async biometricCheckIn(req, res) {
        try {
            const { userId, dni, durationMinutes } = req.body;
            const MembershipModel = require("../models/MembershipModel");

            let targetUser = null;
            if (userId) {
                targetUser = await UserModel.findActiveById(userId);
            } else if (dni) {
                targetUser = await UserModel.findActiveByDni(dni);
            }

            if (!targetUser) {
                return res.status(404).json({ message: "Socio no encontrado para la huella indicada" });
            }

            // Validar membresía
            const membership = await MembershipModel.getClientMembership(targetUser.id);
            const isValidMembership = membership &&
                membership.estado === 'activo' &&
                new Date(membership.fechaFin) >= new Date();

            if (!isValidMembership) {
                return res.status(400).json({
                    message: `Membresía no activa o vencida para ${targetUser.nombre} ${targetUser.apellido}. Regularizar en recepción.`,
                    user: targetUser,
                    membership,
                });
            }

            // Comprobar si ya tiene una asistencia activa sin salida
            const activeAssistances = await AttendanceModel.getActiveClients();
            const currentActive = activeAssistances.find((a) => a.dni === targetUser.dni);

            const now = new Date();

            if (currentActive) {
                // Calcular tiempo transcurrido desde el ingreso
                let entradaDate = new Date(currentActive.horaEntrada);
                if (isNaN(entradaDate.getTime()) && typeof currentActive.horaEntrada === 'string') {
                    entradaDate = new Date(currentActive.horaEntrada.replace(' ', 'T'));
                }
                const diffMs = now.getTime() - entradaDate.getTime();
                const minutosTranscurridos = Math.max(0, Math.floor(diffMs / (60 * 1000)));

                // Tiempo mínimo configurable (por defecto 20 min)
                const minDuration = req.body.minDurationMinutes !== undefined 
                    ? Math.max(1, Number(req.body.minDurationMinutes)) 
                    : 20;
                const isForced = Boolean(req.body.forceExit);

                // Si ha pasado menos del tiempo mínimo de entrenamiento y no se está forzando salida manual
                if (minutosTranscurridos < minDuration && !isForced) {
                    const restante = Math.max(1, minDuration - minutosTranscurridos);
                    return res.status(200).json({
                        tipo: "en_curso_reciente",
                        success: false,
                        message: `¡Hola ${targetUser.nombre}! Registraste tu ingreso hace ${minutosTranscurridos} min. Para registrar salida con huella y validar tus puntos de Mi Pandita, debes entrenar al menos ${minDuration} minutos (faltan ${restante} min).`,
                        user: targetUser,
                        minutosTranscurridos,
                        minutosRestantes: restante,
                        minutosMinimos: minDuration,
                        horaEntrada: currentActive.horaEntrada,
                        asistenciaId: currentActive.id,
                        canForceExit: true,
                    });
                }

                // Registrar Salida Biométrica
                const horaSalidaDb = formatMysqlDatetime(now);
                await db.execute(
                    `UPDATE asistencias SET hora_salida = ? WHERE id = ?`,
                    [horaSalidaDb, currentActive.id],
                );
                if (currentActive.reservaId) {
                    await ReservationModel.updateStatus(currentActive.reservaId, "finalizada");
                }

                const horas = Math.floor(minutosTranscurridos / 60);
                const mins = minutosTranscurridos % 60;
                const tiempoTexto = horas > 0 ? `${horas}h ${mins}m` : `${minutosTranscurridos} min`;

                return res.json({
                    tipo: "salida",
                    success: true,
                    message: `¡Salida registrada con éxito! Buen entrenamiento de ${tiempoTexto}, ${targetUser.nombre}.`,
                    user: targetUser,
                    horaEntrada: currentActive.horaEntrada,
                    horaSalida: now.toISOString(),
                    minutosEntrenados: minutosTranscurridos,
                    tiempoTexto,
                    puntosValidados: true,
                });
            }

            // Registrar Entrada Biométrica
            const dur = Number(durationMinutes) || 60;
            const horaEntrada = formatMysqlDatetime(now);
            const salidaDate = new Date(now.getTime() + dur * 60 * 1000);
            const horaSalida = formatMysqlDatetime(salidaDate);

            // Crear reserva directa confirmada
            const reservation = await ReservationModel.create({
                usuarioId: targetUser.id,
                horaEntrada,
                horaSalida,
                tipo: 'checkin_directo',
                reservaOrigenId: null,
                duracionMinutos: dur,
            });
            await ReservationModel.updateStatus(reservation.id, 'confirmada');

            // Crear asistencia con método 'huella'
            const attendance = await AttendanceModel.create({
                reservaId: reservation.id,
                usuarioId: targetUser.id,
                horaEntrada,
                metodoRegistro: 'huella',
            });

            return res.json({
                tipo: "entrada",
                success: true,
                message: `¡Huella reconocida! Acceso autorizado para ${targetUser.nombre} ${targetUser.apellido}.`,
                user: targetUser,
                membership,
                attendance,
                horaEntrada: now.toISOString(),
                xpSumados: 25,
                bambusSumados: 10,
            });
        } catch (error) {
            console.error("Error en check-in biométrico:", error);
            return res.status(500).json({ message: "Error interno en validación biométrica" });
        }
    }
}

module.exports = CheckInController;
