const db = require("../config/database");

class PlanModel {
    static async getAll() {
        const [rows] = await db.execute(
            `SELECT id, nombre, duracion_dias AS duracionDias, precio, descripcion
            FROM planes_membresia
            ORDER BY id`,
        );

        return rows;
    }
}

module.exports = PlanModel;
