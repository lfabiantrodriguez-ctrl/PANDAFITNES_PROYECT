const db = require("../config/database");

class PlanModel {
    static async getAll() {
        const [rows] = await db.execute(
            `SELECT id, nombre, duracion_dias AS duracionDias, limite_semanal AS limiteSemanal,
                    total_reservas AS totalReservas, precio, descripcion
             FROM planes_membresia
             ORDER BY duracion_dias ASC, id ASC`,
        );

        return rows;
    }

    static async findById(id) {
        const [rows] = await db.execute(
            `SELECT id, nombre, duracion_dias AS duracionDias, limite_semanal AS limiteSemanal,
                    total_reservas AS totalReservas, precio, descripcion
             FROM planes_membresia
             WHERE id = ?
             LIMIT 1`,
            [id],
        );

        return rows[0] || null;
    }

    static async update(id, { nombre, duracionDias, precio, descripcion, limiteSemanal, totalReservas }) {
        const [result] = await db.execute(
            `UPDATE planes_membresia
             SET nombre = COALESCE(?, nombre),
                 duracion_dias = COALESCE(?, duracion_dias),
                 precio = COALESCE(?, precio),
                 descripcion = COALESCE(?, descripcion),
                 limite_semanal = ?,
                 total_reservas = ?
             WHERE id = ?`,
            [
                nombre !== undefined ? String(nombre).trim() : null,
                duracionDias !== undefined ? Number(duracionDias) : null,
                precio !== undefined ? Number(precio) : null,
                descripcion !== undefined ? String(descripcion).trim() : null,
                limiteSemanal !== undefined && limiteSemanal !== null && limiteSemanal !== "" ? Number(limiteSemanal) : null,
                totalReservas !== undefined && totalReservas !== null && totalReservas !== "" ? Number(totalReservas) : null,
                id,
            ],
        );
        return result.affectedRows > 0;
    }
}

module.exports = PlanModel;
