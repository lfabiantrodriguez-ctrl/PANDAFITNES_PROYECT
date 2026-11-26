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

    static async createGuest({
        nombre,
        telefono,
        fechaInicio,
        fechaFin,
        duracionHoras,
        monto,
        adminId,
        codigoPase = null,
    }) {
        if (codigoPase && String(codigoPase).trim()) {
            throw new Error("Los Pases Libres para Amigo solo se validan acompañados del socio en Inicio (Control de acceso).");
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            let finalMonto = monto !== null && monto !== undefined ? Number(monto) : null;
            const metodoPago = "efectivo";

            if (finalMonto === null) {
                const dur = Number(duracionHoras) || 1;
                if (dur === 1) finalMonto = 5.0;
                else if (dur === 2) finalMonto = 8.0;
                else if (dur === 3) finalMonto = 11.0;
                else finalMonto = 7.0;
            }

            const [result] = await connection.execute(
                `INSERT INTO usuarios_invitados
                 (nombre, telefono, fecha_inicio, fecha_fin, metodo_pago, monto, creado_por_admin_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    nombre,
                    telefono,
                    fechaInicio,
                    fechaFin,
                    metodoPago,
                    finalMonto,
                    adminId || null,
                ],
            );

            await connection.commit();

            return {
                id: result.insertId,
                nombre,
                telefono: telefono || null,
                fechaInicio,
                fechaFin,
                metodoPago,
                monto: Number(finalMonto),
                estado: "activo",
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async listGuests() {
        await this.finalizeExpiredGuests();
        const [rows] = await db.execute(
            `SELECT
                gi.id,
                gi.nombre,
                gi.telefono,
                gi.monto,
                gi.metodo_pago AS metodoPago,
                gi.codigo_pase AS codigoPase,
                gi.invitado_por_usuario_id AS invitadoPorUsuarioId,
                CONCAT(u.nombre, ' ', u.apellido) AS invitadoPorNombre,
                TIMESTAMPDIFF(MINUTE, gi.fecha_inicio, gi.fecha_fin) AS duracionMinutos,
                DATE_FORMAT(gi.fecha_inicio, '%Y-%m-%d %H:%i:%s') AS fechaInicio,
                DATE_FORMAT(gi.fecha_fin, '%Y-%m-%d %H:%i:%s') AS fechaFin,
                gi.estado,
                gi.creado_en AS creadoEn
             FROM usuarios_invitados gi
             LEFT JOIN usuarios u ON u.id = gi.invitado_por_usuario_id
             ORDER BY (gi.estado = 'activo') DESC, gi.fecha_inicio DESC`,
        );

        return rows.map((row) => ({
            ...row,
            monto: row.monto !== null && row.monto !== undefined ? Number(row.monto) : 5,
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
