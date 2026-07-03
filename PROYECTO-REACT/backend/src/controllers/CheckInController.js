const UserModel = require("../models/UserModel");
const ReservationModel = require("../models/ReservationModel");
const AttendanceModel = require("../models/AttendanceModel");

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

function getStatus(now, entryTime, exitTime) {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    const toleranceEnd = new Date(entry.getTime() + 15 * 60 * 1000);

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
            const status = reservation ? getStatus(now, reservation.horaEntrada, reservation.horaSalida) : null;

            return res.json({
                user,
                reservation,
                history,
                checkInStatus: status,
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
            const toleranceEnd = new Date(entry.getTime() + 15 * 60 * 1000);

            if (now < entry || now > toleranceEnd) {
                return res.status(400).json({ message: "La reserva no esta dentro del rango de ingreso permitido" });
            }

            await AttendanceModel.create({
                reservaId: reservation.id,
                usuarioId: reservation.usuarioId,
                horaEntrada: now,
            });

            await ReservationModel.updateStatus(reservation.id, "confirmada");

            return res.json({ message: "Entrada confirmada", reservationId: reservation.id });
        } catch (error) {
            console.error("Error confirmando entrada:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = CheckInController;
