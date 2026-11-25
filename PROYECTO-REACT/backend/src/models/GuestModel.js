const db = require("../config/database");

class GuestModel {
    static async finalizeExpiredGuests() {
        const [result] = await db.execute(
            `UPDATE usuarios_invitados
             SET estado = 'finalizado'
             WHERE estado = 'activo'
               AND fecha_fin <= NOW()`,
        );
        return result.affectedRows || 0;
    }

    static async checkoutGuestNow(id) {
        const [result] = await db.execute(
            `UPDATE usuarios_invitados
             SET estado = 'finalizado',
                 fecha_fin = LEAST(fecha_fin, NOW())
             WHERE id = ? AND estado = 'activo'`,
            [id],
        );
        return result.affectedRows > 0;
    }

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
        await this.finalizeExpiredGuests();
        const [rows] = await db.execute(
            `SELECT
                gi.id,
                gi.nombre,
                gi.telefono,
                gi.monto,
                TIMESTAMPDIFF(MINUTE, gi.fecha_inicio, gi.fecha_fin) AS duracionMinutos,
                DATE_FORMAT(gi.fecha_inicio, '%Y-%m-%d %H:%i:%s') AS fechaInicio,
                DATE_FORMAT(gi.fecha_fin, '%Y-%m-%d %H:%i:%s') AS fechaFin,
                gi.estado,
                gi.creado_en AS creadoEn
             FROM usuarios_invitados gi
             ORDER BY (gi.estado = 'activo') DESC, gi.fecha_inicio DESC`,
        );

        return rows.map((row) => ({
            ...row,
            monto: Number(row.monto || 5),
            duracionHoras: Math.max(1, Math.round((Number(row.duracionMinutos) || 60) / 60)),
        }));
    }

    static async getActiveGuestCount() {
        await this.finalizeExpiredGuests();
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
