const db = require("../config/database");

class GuestModel {
    static async createGuest({ nombre, telefono, fechaInicio, fechaFin, monto, adminId }) {
        const [result] = await db.execute(
            `INSERT INTO usuarios_invitados
             (nombre, telefono, fecha_inicio, fecha_fin, monto, creado_por_admin_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nombre, telefono, fechaInicio, fechaFin, monto || 7, adminId || null],
        );

        return {
            id: result.insertId,
            nombre,
            telefono: telefono || null,
            fechaInicio,
            fechaFin,
            monto: Number(monto || 7),
            estado: "activo",
        };
    }

    static async listGuests() {
        const [rows] = await db.execute(
            `SELECT
                gi.id,
                gi.nombre,
                gi.telefono,
                gi.fecha_inicio AS fechaInicio,
                gi.fecha_fin AS fechaFin,
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
