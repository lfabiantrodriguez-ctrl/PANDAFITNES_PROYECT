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
                u.password_hash,
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

    static async updateProfile(id, { nombre, apellido, email, telefono }) {
        const [result] = await db.execute(
            `UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, telefono = ? WHERE id = ?`,
            [nombre, apellido, email, telefono, id],
        );

        return result.affectedRows > 0;
    }

    static async updatePasswordHash(id, passwordHash) {
        const [result] = await db.execute(
            `UPDATE usuarios SET password_hash = ? WHERE id = ?`,
            [passwordHash, id],
        );

        return result.affectedRows > 0;
    }
}

module.exports = UserModel;
