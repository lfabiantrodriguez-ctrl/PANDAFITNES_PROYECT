const db = require("../config/database");

class UserModel {
    static async findActiveByDni(dni) {
        const [rows] = await db.execute(
            `SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.dni,
                u.email,
                u.password_hash,
                u.telefono,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r ON r.id = u.rol_id
            WHERE u.dni = ? AND u.activo = 1
            LIMIT 1`,
            [dni],
        );

        return rows[0] || null;
    }

    static async findActiveById(id) {
        const [rows] = await db.execute(
            `SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.dni,
                u.email,
                u.telefono,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r ON r.id = u.rol_id
            WHERE u.id = ? AND u.activo = 1
            LIMIT 1`,
            [id],
        );

        return rows[0] || null;
    }
}

module.exports = UserModel;
