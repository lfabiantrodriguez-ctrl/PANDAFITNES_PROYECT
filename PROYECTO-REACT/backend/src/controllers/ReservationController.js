const ReservationModel = require("../models/ReservationModel");

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

class ReservationController {
    static async getMyReservations(req, res) {
        try {
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
            const { fecha, horaEntrada, duracionMinutos } = req.body;
            const reservationDate = buildDatetime(fecha, horaEntrada);
            const duration = Number(duracionMinutos);

            if (!reservationDate || !Number.isFinite(duration) || duration <= 0) {
                return res.status(400).json({ message: "Fecha, hora y duracion de reserva validas son requeridas" });
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

            return res.status(201).json({
                message: "Reserva registrada correctamente",
                reserva,
            });
        } catch (error) {
            console.error("Error creando reserva:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = ReservationController;
