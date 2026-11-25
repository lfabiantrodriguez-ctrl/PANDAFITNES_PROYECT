const GuestModel = require("../models/GuestModel");
const { isValidConfiguredSchedule } = require("../utils/reservationHelpers");

function parseLocalDateTime(value) {
    if (!value) {
        return null;
    }

    const normalized = value.replace(' ', 'T');
    const parts = normalized.split(/[-T:\.]/).map((part) => Number(part));
    if (parts.length >= 6 && parts.every((n) => !Number.isNaN(n))) {
        const [year, month, day, hour, minute, second] = parts;
        return new Date(year, month - 1, day, hour, minute, second || 0);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateTime(value) {
    if (!value) {
        return null;
    }

    const date = typeof value === 'string' ? parseLocalDateTime(value) : new Date(value);
    if (!date || Number.isNaN(date.getTime())) {
        return value;
    }

    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function validateGuestSchedule(startDate, endDate, bypassSchedule = false) {
    if (startDate.getTime() >= endDate.getTime()) {
        return "La fecha de fin debe ser posterior a la fecha de inicio";
    }

    const now = new Date();
    // Permitir margen de 5 minutos desde que se abrió el modal hasta pulsar Registrar
    if (startDate.getTime() < now.getTime() - 5 * 60 * 1000) {
        return "La fecha de inicio debe ser actual o futura";
    }

    if (startDate.toDateString() !== endDate.toDateString()) {
        return "El ingreso y la salida deben ser el mismo día";
    }

    if (!bypassSchedule) {
        const diffMins = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
        if (!(await isValidConfiguredSchedule(startDate, diffMins))) {
            return "El horario de inicio y salida debe estar dentro del horario de atención del gimnasio";
        }
    }

    return null;
}

class GuestController {
    static async createGuest(req, res) {
        try {
            const { nombre, telefono, fechaInicio, fechaFin, monto, duracionHoras } = req.body;
            const adminId = req.auth?.id || req.user?.id;

            if (!nombre || !telefono || !fechaInicio || !fechaFin) {
                return res.status(400).json({ message: "Nombre, teléfono, fecha de inicio y fecha de fin son requeridos" });
            }

            const startDate = parseLocalDateTime(fechaInicio);
            const endDate = parseLocalDateTime(fechaFin);
            if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                return res.status(400).json({ message: "Fechas inválidas" });
            }
            const bypass = !!req.body.bypassSchedule;
            const validationMessage = await validateGuestSchedule(startDate, endDate, bypass);
            if (validationMessage) {
                return res.status(400).json({ message: validationMessage });
            }

            const guest = await GuestModel.createGuest({
                nombre,
                telefono,
                fechaInicio: normalizeDateTime(startDate),
                fechaFin: normalizeDateTime(endDate),
                duracionHoras: duracionHoras != null ? Number(duracionHoras) : null,
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

    static async checkoutNow(req, res) {
        try {
            const id = Number(req.params.id);
            if (!id) {
                return res.status(400).json({ message: "ID de pase diario inválido" });
            }
            const ok = await GuestModel.checkoutGuestNow(id);
            if (!ok) {
                return res.status(404).json({ message: "El pase diario ya estaba finalizado o no existe" });
            }
            return res.json({ message: "Salida registrada y cupo liberado del aforo" });
        } catch (error) {
            console.error("Error finalizando cliente diario:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = GuestController;
