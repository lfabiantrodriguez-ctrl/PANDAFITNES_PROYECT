const db = require("../config/database");

class CapacityController {
    static async getCapacity(req, res) {
        try {
            const [configRows] = await db.execute(
                "SELECT valor FROM configuracion WHERE clave = 'max_capacidad' LIMIT 1",
            );
            const maximo = configRows[0] ? Number(configRows[0].valor) : 0;

            const [activeRows] = await db.execute(
                "SELECT COUNT(*) AS total FROM asistencias WHERE hora_salida IS NULL",
            );
            const [guestRows] = await db.execute(
                `SELECT COUNT(*) AS total
                 FROM usuarios_invitados
                 WHERE estado = 'activo'
                   AND fecha_inicio <= NOW()
                   AND fecha_fin > NOW()`,
            );

            const actual = Number(activeRows[0]?.total || 0) + Number(guestRows[0]?.total || 0);

            return res.json({
                actual,
                maximo,
                actualizadoEn: new Date().toISOString(),
            });
        } catch (error) {
            console.error("Error consultando aforo:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getHistoricalCapacity(req, res) {
        try {
            const { fecha, hora } = req.query;
            if (!fecha || !hora) {
                return res.status(400).json({ message: "Fecha y hora son requeridas" });
            }

            const targetDatetime = `${fecha} ${hora}:00`;

            const [configRows] = await db.execute(
                "SELECT valor FROM configuracion WHERE clave = 'max_capacidad' LIMIT 1",
            );
            const maximo = configRows[0] ? Number(configRows[0].valor) : 0;

            const [activeRows] = await db.execute(
                `SELECT COUNT(*) AS total
                 FROM asistencias
                 WHERE hora_entrada <= ?
                   AND (hora_salida IS NULL OR hora_salida > ?)`,
                [targetDatetime, targetDatetime]
            );

            const [guestRows] = await db.execute(
                `SELECT COUNT(*) AS total
                 FROM usuarios_invitados
                 WHERE estado = 'activo'
                   AND fecha_inicio <= ?
                   AND fecha_fin > ?`,
                [targetDatetime, targetDatetime],
            );

            const actual = Number(activeRows[0]?.total || 0) + Number(guestRows[0]?.total || 0);

            return res.json({
                actual,
                maximo,
                fecha,
                hora,
            });
        } catch (error) {
            console.error("Error consultando aforo histórico:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = CapacityController;
