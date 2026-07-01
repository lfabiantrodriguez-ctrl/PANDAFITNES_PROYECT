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
            const [reservationRows] = await db.execute(
                `SELECT COUNT(*) AS total
                 FROM reservas
                 WHERE estado IN ('pendiente', 'confirmada')
                   AND hora_entrada <= NOW()
                   AND hora_salida > NOW()`,
            );

            const actual = Math.max(Number(activeRows[0]?.total || 0), Number(reservationRows[0]?.total || 0));

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
}

module.exports = CapacityController;
