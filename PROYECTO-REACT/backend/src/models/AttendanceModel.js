const db = require("../config/database");

class AttendanceModel {
    static async create({ reservaId, usuarioId, horaEntrada, metodoRegistro }) {
        const metodo = metodoRegistro || "manual";
        const [result] = await db.execute(
            `INSERT INTO asistencias
             (reserva_id, usuario_id, hora_entrada, metodo_registro)
             VALUES (?, ?, ?, ?)`,
            [reservaId || null, usuarioId, horaEntrada, metodo],
        );

        return {
            id: result.insertId,
            reservaId: reservaId || null,
            usuarioId,
            horaEntrada,
            metodoRegistro: metodo,
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
                a.hora_salida AS horaSalida,
                COALESCE(a.metodo_registro, 'manual') AS metodoRegistro
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
            metodoRegistro: row.metodoRegistro,
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

    static async getByUser(usuarioId) {
        const [rows] = await db.execute(
            `SELECT
                a.id,
                a.reserva_id AS reservaId,
                u.nombre,
                u.apellido,
                u.dni,
                a.hora_entrada AS horaEntrada,
                a.hora_salida AS horaSalida,
                COALESCE(a.metodo_registro, 'manual') AS metodoRegistro,
                CASE
                    WHEN a.hora_salida IS NULL THEN 'activo'
                    ELSE 'finalizada'
                END AS estado
             FROM asistencias a
             INNER JOIN usuarios u ON u.id = a.usuario_id
             WHERE a.usuario_id = ?
             ORDER BY a.hora_entrada DESC`,
            [usuarioId],
        );

        return rows.map((row) => ({
            id: row.id,
            reservaId: row.reservaId,
            nombre: row.nombre,
            apellido: row.apellido,
            dni: row.dni,
            horaEntrada: row.horaEntrada,
            horaSalida: row.horaSalida,
            metodoRegistro: row.metodoRegistro,
            estado: row.estado,
        }));
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

    static async findActiveByUser(usuarioId) {
        const [rows] = await db.execute(
            `SELECT id, usuario_id AS usuarioId, hora_entrada AS horaEntrada
             FROM asistencias
             WHERE usuario_id = ? AND hora_salida IS NULL
             ORDER BY hora_entrada DESC
             LIMIT 1`,
            [usuarioId],
        );
        return rows[0] || null;
    }

    static async setExitById(asistenciaId, horaSalida) {
        const [result] = await db.execute(
            `UPDATE asistencias SET hora_salida = ? WHERE id = ? AND hora_salida IS NULL`,
            [horaSalida, asistenciaId],
        );
        return result.affectedRows > 0;
    }

    static async getUserGoals(usuarioId) {
        const [rows] = await db.execute(
            `SELECT dias_objetivo, horario_preferido, bambus_canjeados FROM usuarios WHERE id = ?`,
            [usuarioId],
        );
        if (!rows || rows.length === 0) {
            return {
                diasObjetivo: [1, 2, 4, 5],
                horarioPreferido: "07:00 - 08:30",
                bambusCanjeados: 0,
            };
        }
        const row = rows[0];
        const diasStr = row.dias_objetivo || "1,2,4,5";
        const diasObjetivo = diasStr.split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
        return {
            diasObjetivo: diasObjetivo.length > 0 ? diasObjetivo : [1, 2, 4, 5],
            horarioPreferido: row.horario_preferido || "07:00 - 08:30",
            bambusCanjeados: row.bambus_canjeados || 0,
        };
    }

    static async updateUserGoals(usuarioId, { diasObjetivo, horarioPreferido }) {
        const diasStr = Array.isArray(diasObjetivo) ? diasObjetivo.join(",") : String(diasObjetivo || "1,2,4,5");
        await db.execute(
            `UPDATE usuarios SET dias_objetivo = ?, horario_preferido = ? WHERE id = ?`,
            [diasStr, horarioPreferido || "07:00 - 08:30", usuarioId],
        );
        return true;
    }

    static async redeemReward(usuarioId, { recompensaId }) {
        if (!Number.isInteger(Number(recompensaId)) || Number(recompensaId) < 1) throw new Error('Selecciona una recompensa del catálogo.');
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            // Serialize spending for the account and lock stock before calculating the balance.
            const [users] = await connection.execute('SELECT id FROM usuarios WHERE id=? FOR UPDATE', [usuarioId]);
            if (!users[0]) throw new Error('Socio no encontrado.');
            const [rewards] = await connection.execute('SELECT id, nombre, costo_bambus, stock FROM recompensas_catalogo WHERE id=? AND activo=1 FOR UPDATE', [recompensaId]);
            const reward = rewards[0];
            if (!reward || Number(reward.stock) < 1 || !Number.isFinite(Number(reward.costo_bambus)) || Number(reward.costo_bambus) < 1) throw new Error('Esta recompensa no está disponible.');
            const [entries] = await connection.execute('SELECT hora_entrada AS horaEntrada FROM asistencias WHERE usuario_id=?', [usuarioId]);
            const [spent] = await connection.execute('SELECT costo_bambus AS costoBambus, estado FROM canjes_recompensas WHERE usuario_id=?', [usuarioId]);
            const balance = require('../services/pandaProgress').progress(entries, {}, spent).bambusDisponibles;
            const cost = Number(reward.costo_bambus);
            if (balance < cost) throw new Error(`Bambús insuficientes. Disponibles: ${balance}. Necesarios: ${cost}.`);
            const codigoCanje = 'PANDA-' + require('node:crypto').randomUUID();
            // Keep within the existing 30-character column.
            const code = codigoCanje.slice(0, 30);
            const [insert] = await connection.execute('INSERT INTO canjes_recompensas (usuario_id, recompensa_nombre, costo_bambus, codigo_canje, estado) VALUES (?, ?, ?, ?, ?)', [usuarioId, reward.nombre, cost, code, 'pendiente']);
            await connection.execute('UPDATE recompensas_catalogo SET stock=stock-1 WHERE id=?', [reward.id]);
            await connection.execute('UPDATE usuarios SET bambus_canjeados=COALESCE(bambus_canjeados,0)+? WHERE id=?', [cost, usuarioId]);
            await connection.commit();
            return {bambusRestantes:balance-cost, redemption:{id:insert.insertId,recompensaNombre:reward.nombre,costoBambus:cost,codigoCanje:code,estado:'pendiente'}};
        } catch (error) { await connection.rollback(); throw error; }
        finally { connection.release(); }
    }

    static async getUserRedemptions(usuarioId) {
        const [rows] = await db.execute(
            `SELECT id, recompensa_nombre AS recompensaNombre, costo_bambus AS costoBambus, codigo_canje AS codigoCanje, fecha_canje AS fechaCanje, estado
             FROM canjes_recompensas
             WHERE usuario_id = ?
             ORDER BY fecha_canje DESC`,
            [usuarioId],
        );
        return rows;
    }
}

module.exports = AttendanceModel;
