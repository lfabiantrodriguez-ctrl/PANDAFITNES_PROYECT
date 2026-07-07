const GuestModel = require("../models/GuestModel");

function normalizeDateTime(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toISOString().slice(0, 19).replace("T", " ");
}

function isWithinOpeningHours(date) {
    const day = date.getDay();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const time = hours * 100 + minutes;

    const inRange = (startH, startM, endH, endM) => {
        const start = startH * 100 + startM;
        const end = endH * 100 + endM;
        return time >= start && time <= end;
    };

    if (day >= 1 && day <= 5) {
        return inRange(6, 30, 11, 0) || inRange(16, 0, 22, 0);
    }

    if (day === 6) {
        return inRange(7, 0, 12, 0);
    }

    return false;
}

function validateGuestSchedule(startDate, endDate) {
    if (startDate.getTime() >= endDate.getTime()) {
        return "La fecha de fin debe ser posterior a la fecha de inicio";
    }

    const now = new Date();
    if (startDate.getTime() < now.getTime()) {
        return "La fecha de inicio debe ser actual o futura";
    }

    if (startDate.toDateString() !== endDate.toDateString()) {
        return "El ingreso y la salida deben ser el mismo día";
    }

    if (!isWithinOpeningHours(startDate)) {
        return "La hora de inicio debe estar dentro del horario de atención del gimnasio";
    }

    if (!isWithinOpeningHours(endDate)) {
        return "La hora de salida debe estar dentro del horario de atención del gimnasio";
    }

    return null;
}

class GuestController {
    static async createGuest(req, res) {
        try {
            const { nombre, telefono, fechaInicio, fechaFin, monto } = req.body;
            const adminId = req.auth?.id || req.user?.id;

            if (!nombre || !telefono || !fechaInicio || !fechaFin) {
                return res.status(400).json({ message: "Nombre, teléfono, fecha de inicio y fecha de fin son requeridos" });
            }

            const startDate = new Date(fechaInicio);
            const endDate = new Date(fechaFin);
            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                return res.status(400).json({ message: "Fechas inválidas" });
            }

            const validationMessage = validateGuestSchedule(startDate, endDate);
            if (validationMessage) {
                return res.status(400).json({ message: validationMessage });
            }

            const guest = await GuestModel.createGuest({
                nombre,
                telefono,
                fechaInicio: normalizeDateTime(startDate),
                fechaFin: normalizeDateTime(endDate),
                monto,
                adminId,
            });

            return res.status(201).json({ guest });
        } catch (error) {
            console.error("Error creando invitado:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async listGuests(req, res) {
        try {
            const guests = await GuestModel.listGuests();
            return res.json({ guests });
        } catch (error) {
            console.error("Error obteniendo invitados:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = GuestController;
