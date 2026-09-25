const db = require("../config/database");

class GuestModel {
    static async createGuest({ nombre, telefono, fechaInicio, fechaFin, duracionHoras, monto, adminId }) {
        // Determine default monto based on duration selection if monto not provided
        let finalMonto = monto != null ? Number(monto) : null
        if (finalMonto === null) {
            const dur = Number(duracionHoras) || 1
            if (dur === 1) finalMonto = 5.00
            else if (dur === 2) finalMonto = 8.00
            else if (dur === 3) finalMonto = 11.00
            else finalMonto = 7.00
        }

        const [result] = await db.execute(
            `INSERT INTO usuarios_invitados
             (nombre, telefono, fecha_inicio, fecha_fin, monto, creado_por_admin_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nombre, telefono, fechaInicio, fechaFin, finalMonto, adminId || null],
        );

        return {
            id: result.insertId,
            nombre,
            telefono: telefono || null,
            fechaInicio,
            fechaFin,
            monto: Number(finalMonto),
            estado: "activo",
        };
    }

    static async listGuests() {
        const [rows] = await db.execute(
            `SELECT
                gi.id,
                gi.nombre,
                gi.telefono,
                DATE_FORMAT(gi.fecha_inicio, '%Y-%m-%d %H:%i:%s') AS fechaInicio,
                DATE_FORMAT(gi.fecha_fin, '%Y-%m-%d %H:%i:%s') AS fechaFin,
                gi.estado,
                gi.creado_en AS creadoEn
             FROM usuarios_invitados gi
             ORDER BY gi.fecha_inicio DESC`,
        );

        return rows;
    }

    static async getActiveGuestCount() {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM usuarios_invitados
             WHERE estado = 'activo'
               AND fecha_inicio <= NOW()
               AND fecha_fin > NOW()`,
        );

        return Number(rows[0]?.total || 0);
    }
}

module.exports = GuestModel;
