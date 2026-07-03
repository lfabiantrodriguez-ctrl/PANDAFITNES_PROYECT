const db = require("../config/database");
const { sendEmail } = require("../utils/email");

async function checkAndCancelExpiredReservations() {
    try {
        // Find all pending reservations where entry time + 15 min < NOW
        // Fetch user email, name, etc. to notify them
        const [expired] = await db.execute(
            `SELECT r.id, r.usuario_id, u.email, u.nombre, u.apellido, r.hora_entrada
             FROM reservas r
             INNER JOIN usuarios u ON u.id = r.usuario_id
             WHERE r.estado = 'pendiente'
               AND r.tipo = 'normal'
               AND DATE_ADD(r.hora_entrada, INTERVAL 15 MINUTE) < NOW()`
        );

        if (expired.length === 0) return;

        for (const res of expired) {
            // Update status to 'cancelada'
            await db.execute(
                `UPDATE reservas SET estado = 'cancelada' WHERE id = ?`,
                [res.id]
            );

            console.log(`Reserva #${res.id} auto-cancelada por tolerancia expirada para el usuario ${res.email}`);

            // Send email notification
            if (res.email) {
                const entryDate = new Date(res.hora_entrada);
                const localTimeStr = entryDate.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit"
                });
                const localDateStr = entryDate.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });

                await sendEmail({
                    to: res.email,
                    subject: "Reserva Cancelada por Tolerancia Expirada - Panda Fitness",
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #c2410c;">¡Hola ${res.nombre}!</h2>
                            <p>Lamentamos informarte que tu reserva del día <strong>${localDateStr}</strong> a las <strong>${localTimeStr}</strong> ha sido cancelada debido a que transcurrieron los 15 minutos de tolerancia para tu ingreso.</p>
                            <p>Queremos recordarte que, si aún deseas asistir el día de hoy, <strong>puedes realizar una nueva reserva</strong> en un horario diferente.</p>
                            <br/>
                            <p>Atentamente,<br/>El equipo de <strong>Panda Fitness</strong></p>
                        </div>
                    `
                });
            }
        }
    } catch (error) {
        console.error("Error en checkAndCancelExpiredReservations:", error);
    }
}

async function finalizeEndedAttendances() {
    try {
        // Find asistencias with null hora_salida whose reservation hora_salida <= NOW()
        const [rows] = await db.execute(
            `SELECT a.id AS asistenciaId, a.reserva_id AS reservaId, r.hora_salida
             FROM asistencias a
             INNER JOIN reservas r ON r.id = a.reserva_id
             WHERE a.hora_salida IS NULL
               AND r.hora_salida <= NOW()`
        );

        if (!rows || rows.length === 0) return;

        for (const r of rows) {
            const exitTime = r.hora_salida || new Date();
            await db.execute(
                `UPDATE asistencias SET hora_salida = ? WHERE id = ? AND hora_salida IS NULL`,
                [exitTime, r.asistenciaId]
            );
            // Note: do NOT change reserva.estado to an unsupported enum value; keep estado as-is.
            console.log(`Asistencia #${r.asistenciaId} finalizada automaticamente al terminar la reserva #${r.reservaId}`);
        }
    } catch (error) {
        console.error('Error en finalizeEndedAttendances:', error);
    }
}

async function ensureEstadoEnumSupportsFinalizada() {
    try {
        const [rows] = await db.execute(
            `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservas' AND COLUMN_NAME = 'estado'`
        );
        if (!rows || rows.length === 0) return false;

        const columnType = rows[0].COLUMN_TYPE || '';
        const required = ['finalizada', 'cancelada_emergencia'];
        if (required.every((value) => columnType.includes(`'${value}'`))) {
            return true;
        }

        const matches = columnType.match(/enum\((.*)\)/i);
        const existing = matches && matches[1] ? matches[1] : null;
        if (!existing) return false;

        const values = existing.split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
        for (const value of required) {
            if (!values.includes(value)) values.push(value);
        }
        const newEnum = values.map((v) => `'${v}'`).join(',');

        await db.execute(`ALTER TABLE reservas MODIFY estado ENUM(${newEnum}) DEFAULT 'pendiente'`);
        console.log('Columna reservas.estado actualizada para incluir estados extendidos');
        return true;
    } catch (error) {
        console.error('Error asegurando enum de estado:', error);
        return false;
    }
}

async function finalizeEndedReservations() {
    try {
        // Ensure enum supports 'finalizada'
        await ensureEstadoEnumSupportsFinalizada();

        // Update reservations that were confirmed and whose end time has passed
        const [result] = await db.execute(
            `UPDATE reservas SET estado = 'finalizada' WHERE estado = 'confirmada' AND hora_salida <= NOW()`
        );

        // Expire unused reintegro reservations at end of day
        const [expiredReintegros] = await db.execute(
            `UPDATE reservas
             SET estado = 'cancelada'
             WHERE tipo = 'reintegro_emergencia'
               AND estado = 'pendiente'
               AND DATE(hora_entrada) < CURDATE()`
        );

        if (expiredReintegros && expiredReintegros.affectedRows > 0) {
            console.log(`Reintegros expirados por no uso: ${expiredReintegros.affectedRows}`);
        }

        if (result && result.affectedRows > 0) {
            console.log(`Reservas finalizadas automáticamente: ${result.affectedRows}`);
        }
    } catch (error) {
        console.error('Error en finalizeEndedReservations:', error);
    }
}

module.exports = { checkAndCancelExpiredReservations, finalizeEndedAttendances, finalizeEndedReservations };
