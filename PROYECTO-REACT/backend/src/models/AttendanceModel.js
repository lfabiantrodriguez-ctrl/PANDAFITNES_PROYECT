const db = require("../config/database");

class AttendanceModel {
    static async create({ reservaId, usuarioId, horaEntrada }) {
        const [result] = await db.execute(
            `INSERT INTO asistencias
             (reserva_id, usuario_id, hora_entrada)
             VALUES (?, ?, ?)`,
            [reservaId, usuarioId, horaEntrada],
        );

        return {
            id: result.insertId,
            reservaId,
            usuarioId,
            horaEntrada,
        };
    }

    static async getActiveClients() {
        const [rows] = await db.execute(
            `SELECT
                a.id,
                u.nombre,
                u.apellido,
                u.dni,
                a.hora_entrada AS horaEntrada,
                a.hora_salida AS horaSalida
             FROM asistencias a
             INNER JOIN usuarios u ON u.id = a.usuario_id
             WHERE a.hora_salida IS NULL
             ORDER BY a.hora_entrada ASC`,
        );

        return rows.map((row) => ({
            id: row.id,
            nombre: row.nombre,
            apellido: row.apellido,
            dni: row.dni,
            horaEntrada: row.horaEntrada,
            horaSalida: row.horaSalida,
        }));
    }

    static async getAttendanceCountByUser(usuarioId) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM asistencias
             WHERE usuario_id = ?`,
            [usuarioId],
        );

        return rows[0]?.total || 0;
    }

    static async findByReservationId(reservaId) {
        const [rows] = await db.execute(
            `SELECT id, reserva_id AS reservaId, usuario_id AS usuarioId, hora_entrada AS horaEntrada, hora_salida AS horaSalida
             FROM asistencias
             WHERE reserva_id = ?
             LIMIT 1`,
            [reservaId],
        );

        return rows[0] || null;
    }

    static async setExitByReservation(reservaId, horaSalida) {
        const [result] = await db.execute(
            `UPDATE asistencias SET hora_salida = ? WHERE reserva_id = ? AND hora_salida IS NULL`,
            [horaSalida, reservaId],
        );

        return result.affectedRows > 0;
    }
}

module.exports = AttendanceModel;
