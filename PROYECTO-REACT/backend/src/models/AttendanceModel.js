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
}

module.exports = AttendanceModel;
