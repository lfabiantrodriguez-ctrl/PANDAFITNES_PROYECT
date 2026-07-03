const ReservationModel = require("../models/ReservationModel");
const UserModel = require("../models/UserModel");
const { sendEmail } = require("../utils/email");
const { getCurrentWeekRange } = require("../utils/helpers");
const { checkAndCancelExpiredReservations } = require("../services/cronService");

function buildDatetime(dateValue, timeValue) {
    const normalizedDate = String(dateValue || "").trim();
    const normalizedTime = String(timeValue || "").trim();

    if (!normalizedDate || !normalizedTime) {
        return null;
    }

    const isoString = `${normalizedDate}T${normalizedTime}:00`;
    const date = new Date(isoString);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

function formatMysqlDatetime(date) {
    const pad = (value) => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
        date.getHours(),
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isValidGymSchedule(dateTime, durationMinutes) {
    const dayOfWeek = dateTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (dayOfWeek === 0) return false; // Closed Sunday

    const entryHour = dateTime.getHours();
    const entryMinutes = entryHour * 60 + dateTime.getMinutes();
    const exitMinutes = entryMinutes + durationMinutes;

    if (dayOfWeek === 6) {
        // Saturday: 7:00 AM to 12:00 PM (420 to 720 minutes)
        return entryMinutes >= 420 && exitMinutes <= 720;
    } else {
        // Monday to Friday: 6:30 AM to 11:00 AM (390 to 660) and 4:00 PM to 10:00 PM (960 to 1320)
        const inMorningShift = entryMinutes >= 390 && exitMinutes <= 660;
        const inEveningShift = entryMinutes >= 960 && exitMinutes <= 1320;
        return inMorningShift || inEveningShift;
    }
}

class ReservationController {
    static async getMyReservations(req, res) {
        try {
            // Auto-cancel expired pending reservations first to clean up the state
            await checkAndCancelExpiredReservations();

            const reservas = await ReservationModel.getByUser(req.auth.id);
            return res.json({ reservas });
        } catch (error) {
            console.error("Error listando reservas:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getReservationDashboard(req, res) {
        try {
            const startDate = String(req.query.startDate || "").trim();
            const endDate = String(req.query.endDate || "").trim();

            if (startDate && endDate && startDate > endDate) {
                return res.status(400).json({ message: "La fecha inicial no puede ser mayor que la final" });
            }

            const userId = req.auth?.rol === "admin" ? null : req.auth.id;
            const dashboard = await ReservationModel.getDashboard({ userId, startDate, endDate });

            return res.json(dashboard);
        } catch (error) {
            console.error("Error generando dashboard de reservas:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async createReservation(req, res) {
        try {
            // Clean up any expired reservations on the fly first
            await checkAndCancelExpiredReservations();

            const { fecha, horaEntrada, duracionMinutos } = req.body;
            const reservationDate = buildDatetime(fecha, horaEntrada);
            const duration = Number(duracionMinutos);

            if (!reservationDate || !Number.isFinite(duration) || duration <= 0) {
                return res.status(400).json({ message: "Fecha, hora y duracion de reserva validas son requeridas" });
            }

            // 1. Check daily reservation limit
            const hasDailyActive = await ReservationModel.hasActiveReservationForDay(req.auth.id, fecha);
            if (hasDailyActive) {
                return res.status(400).json({ message: "Ya tienes una reserva registrada para este día y solo se permite una reserva activa por día" });
            }

            // 1b. Check weekly and total reservation limits based on membership plan
            const planInfo = await ReservationModel.getUserPlanInfo(req.auth.id);
            if (planInfo) {
                const { start: weekStart, end: weekEnd } = getCurrentWeekRange();

                // If plan has total_reservas (e.g. Interdiario = 15)
                if (planInfo.totalReservas) {
                    const usedTotal = await ReservationModel.countTotalReservations(req.auth.id, planInfo.fechaInicio);
                    const remainingTotal = planInfo.totalReservas - usedTotal;

                    if (remainingTotal <= 0) {
                        return res.status(400).json({
                            message: `Has agotado tus ${planInfo.totalReservas} reservas del plan. Acercate al gimnasio para renovar tu membresia.`
                        });
                    }

                    // If plan also has weekly limit
                    if (planInfo.limiteSemanal) {
                        const weeklyCount = await ReservationModel.countWeeklyReservations(req.auth.id, weekStart, weekEnd);
                        const weeklyRemaining = planInfo.limiteSemanal - weeklyCount;
                        const allowedThisWeek = Math.min(weeklyRemaining, remainingTotal);

                        if (weeklyRemaining <= 0) {
                            return res.status(400).json({
                                message: `Has alcanzado el limite de ${planInfo.limiteSemanal} reservas de esta semana. Vuelve a intentarlo el lunes de la proxima semana.`
                            });
                        }

                        if (allowedThisWeek < weeklyRemaining) {
                            // The remaining total is less than the weekly allowance this week
                            // This handles the edge case where only a few days remain in the plan
                        }
                    }
                } else if (planInfo.limiteSemanal) {
                    // Plan only has weekly limit (no total limit)
                    const weeklyCount = await ReservationModel.countWeeklyReservations(req.auth.id, weekStart, weekEnd);
                    if (weeklyCount >= planInfo.limiteSemanal) {
                        return res.status(400).json({
                            message: `Has alcanzado el limite de ${planInfo.limiteSemanal} reservas semanales de tu plan. Vuelve a intentarlo el lunes de la proxima semana.`
                        });
                    }
                }
            }

            // 2. Validate gym opening hours
            if (!isValidGymSchedule(reservationDate, duration)) {
                return res.status(400).json({
                    message: "La reserva está fuera del horario de atención del gimnasio o excede el límite del turno actual.\nHorario:\n- Lunes a Viernes: 6:30 AM a 11:00 AM y 4:00 PM a 10:00 PM\n- Sábados: 7:00 AM a 12:00 PM\n- Domingos: Cerrado"
                });
            }

            const now = new Date();
            if (reservationDate.getTime() < now.getTime() - 60_000) {
                return res.status(400).json({ message: "La fecha y hora de reserva debe ser futura" });
            }

            const salida = new Date(reservationDate.getTime() + duration * 60_000);
            if (salida.getTime() <= reservationDate.getTime()) {
                return res.status(400).json({ message: "La duracion debe ser mayor a cero" });
            }

            const horaEntradaDb = formatMysqlDatetime(reservationDate);
            const horaSalidaDb = formatMysqlDatetime(salida);

            const hasOverlap = await ReservationModel.hasUserOverlap(req.auth.id, horaEntradaDb, horaSalidaDb);
            if (hasOverlap) {
                return res.status(409).json({ message: "Ya tienes una reserva en el mismo horario" });
            }

            const maxCapacity = await ReservationModel.getMaxCapacity();
            if (maxCapacity <= 0) {
                return res.status(500).json({ message: "La configuracion de aforo no esta disponible" });
            }

            const occupied = await ReservationModel.countOverlapping(horaEntradaDb, horaSalidaDb);
            if (occupied >= maxCapacity) {
                return res.status(409).json({ message: "No hay cupos disponibles para ese horario" });
            }

            const reserva = await ReservationModel.create({
                usuarioId: req.auth.id,
                horaEntrada: horaEntradaDb,
                horaSalida: horaSalidaDb,
            });

            // 3. Send confirmation email to user
            const user = await UserModel.findActiveById(req.auth.id);
            if (user && user.email) {
                const localTimeStr = reservationDate.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit"
                });
                const localDateStr = reservationDate.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });

                await sendEmail({
                    to: user.email,
                    subject: "Reserva Registrada Exitosamente - Panda Fitness",
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #16a34a;">¡Hola ${user.nombre}!</h2>
                            <p>Tu reserva en <strong>Panda Fitness</strong> ha sido registrada correctamente.</p>
                            <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; margin: 15px 0;">
                                <p style="margin: 4px 0;"><strong>Fecha:</strong> ${localDateStr}</p>
                                <p style="margin: 4px 0;"><strong>Hora de ingreso:</strong> ${localTimeStr}</p>
                                <p style="margin: 4px 0;"><strong>Duración:</strong> ${duration} minutos</p>
                            </div>
                            <p style="color: #6b7280; font-size: 0.9em;">
                                * Recuerda que cuentas con <strong>15 minutos de tolerancia</strong> a partir de la hora de ingreso para confirmar tu asistencia en la recepción. Si no te presentas a tiempo, la reserva se cancelará automáticamente.
                            </p>
                            <br/>
                            <p>¡Te esperamos!</p>
                            <p>El equipo de <strong>Panda Fitness</strong></p>
                        </div>
                    `
                }).catch(err => console.error("Error sending reservation email:", err));
            }

            return res.status(201).json({
                message: "Reserva registrada correctamente",
                reserva,
            });
        } catch (error) {
            console.error("Error creando reserva:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getSocioReservations(req, res) {
        try {
            const query = String(req.query.search || "").trim();
            if (!query) {
                return res.status(400).json({ message: "Se requiere DNI o Nombre del socio" });
            }

            // Find user first
            let user = null;
            if (/^\d{8}$/.test(query)) {
                user = await UserModel.findActiveByDni(query);
            } else if (/^\d+$/.test(query)) {
                user = await UserModel.findActiveById(Number(query));
            } else {
                user = await UserModel.findActiveByName(query);
            }

            if (!user) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            const reservas = await ReservationModel.getByUser(user.id);
            return res.json({ user, reservas });
        } catch (error) {
            console.error("Error buscando reservas de socio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = ReservationController;
