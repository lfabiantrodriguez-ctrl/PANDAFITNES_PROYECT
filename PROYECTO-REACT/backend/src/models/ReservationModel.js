const db = require("../config/database");

class ReservationModel {
    static async getMaxCapacity() {
        const [rows] = await db.execute(
            "SELECT valor FROM configuracion WHERE clave = 'max_capacidad' LIMIT 1",
        );

        return rows[0] ? Number(rows[0].valor) : 0;
    }

    static async countOverlapping(entrada, salida) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM reservas
             WHERE estado IN ('pendiente', 'confirmada')
               AND hora_entrada < ?
               AND hora_salida > ?`,
            [salida, entrada],
        );

        return rows[0]?.total || 0;
    }

    static async hasUserOverlap(usuarioId, entrada, salida) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM reservas
             WHERE usuario_id = ?
               AND estado IN ('pendiente', 'confirmada')
               AND hora_entrada < ?
               AND hora_salida > ?`,
            [usuarioId, salida, entrada],
        );

        return rows[0]?.total > 0;
    }

    static async create({ usuarioId, horaEntrada, horaSalida }) {
        const [result] = await db.execute(
            `INSERT INTO reservas
             (usuario_id, hora_entrada, hora_salida)
             VALUES (?, ?, ?)`,
            [usuarioId, horaEntrada, horaSalida],
        );

        return {
            id: result.insertId,
            usuarioId,
            horaEntrada,
            horaSalida,
            estado: "pendiente",
        };
    }

    static async findActiveForCheckIn(usuarioId) {
        const [rows] = await db.execute(
            `SELECT
                r.id,
                r.usuario_id AS usuarioId,
                r.hora_entrada AS horaEntrada,
                r.hora_salida AS horaSalida,
                r.estado
             FROM reservas r
             WHERE r.usuario_id = ?
               AND r.estado IN ('pendiente', 'confirmada')
               AND r.hora_salida >= NOW()
             ORDER BY r.hora_entrada ASC
             LIMIT 1`,
            [usuarioId],
        );

        return rows[0] || null;
    }

    static async findById(reservationId) {
        const [rows] = await db.execute(
            `SELECT
                id,
                usuario_id AS usuarioId,
                hora_entrada AS horaEntrada,
                hora_salida AS horaSalida,
                estado
             FROM reservas
             WHERE id = ?
             LIMIT 1`,
            [reservationId],
        );

        return rows[0] || null;
    }

    static async findRecentByUser(usuarioId, limit = 5) {
        const sanitizedLimit = Number(limit) || 5;
        const [rows] = await db.execute(
            `SELECT
                id,
                hora_entrada AS horaEntrada,
                hora_salida AS horaSalida,
                estado,
                creado_en AS creadoEn
             FROM reservas
             WHERE usuario_id = ?
             ORDER BY hora_entrada DESC
             LIMIT ${sanitizedLimit}`,
            [usuarioId],
        );

        return rows;
    }

    static async updateStatus(reservationId, estado) {
        await db.execute(
            `UPDATE reservas
             SET estado = ?
             WHERE id = ?`,
            [estado, reservationId],
        );
    }

    static async getByUser(usuarioId) {
        const [rows] = await db.execute(
            `SELECT
                id,
                hora_entrada AS horaEntrada,
                hora_salida AS horaSalida,
                estado,
                creado_en AS creadoEn
             FROM reservas
             WHERE usuario_id = ?
             ORDER BY hora_entrada DESC`,
            [usuarioId],
        );

        return rows;
    }

    static async getDashboard({ userId = null, startDate = null, endDate = null } = {}) {
        const conditions = ["WHERE estado IN ('pendiente', 'confirmada')"];
        const params = [];

        if (userId) {
            conditions.push("AND usuario_id = ?");
            params.push(userId);
        }

        if (startDate) {
            conditions.push("AND DATE(hora_entrada) >= ?");
            params.push(startDate);
        }

        if (endDate) {
            conditions.push("AND DATE(hora_entrada) <= ?");
            params.push(endDate);
        }

        const [rows] = await db.execute(
            `SELECT
                HOUR(hora_entrada) AS hour,
                COUNT(*) AS total
             FROM reservas
             ${conditions.join(" ")}
             GROUP BY HOUR(hora_entrada)
             ORDER BY total DESC, hour ASC`,
            params,
        );

        const hourlyStats = rows.map((row) => ({
            hour: Number(row.hour),
            count: Number(row.total),
        }));

        const maxCount = hourlyStats[0]?.count || 0;
        const peakHours = hourlyStats.filter((item) => item.count === maxCount).map((item) => item.hour);

        return {
            startDate: startDate || null,
            endDate: endDate || null,
            totalReservations: hourlyStats.reduce((sum, item) => sum + item.count, 0),
            peakHour: peakHours[0] ?? null,
            peakHours,
            peakCount: maxCount,
            hourlyStats,
        };
    }
}

module.exports = ReservationModel;
