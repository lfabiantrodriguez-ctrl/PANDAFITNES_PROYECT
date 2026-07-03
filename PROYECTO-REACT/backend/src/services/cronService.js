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

module.exports = { checkAndCancelExpiredReservations };
