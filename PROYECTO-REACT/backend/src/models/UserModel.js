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
                u.google_id,
                u.reset_code,
                u.reset_expires,
                u.fecha_nacimiento,
                u.direccion,
                u.contacto_emergencia,
                u.telefono_emergencia,
                u.avatar_url,
                u.preferencias,
                u.dias_objetivo,
                u.fecha_registro,
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
                u.google_id,
                u.fecha_nacimiento,
                u.direccion,
                u.contacto_emergencia,
                u.telefono_emergencia,
                u.avatar_url,
                u.preferencias,
                u.dias_objetivo,
                u.fecha_registro,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r ON r.id = u.rol_id
            WHERE u.id = ? AND u.activo = 1
            LIMIT 1`,
            [id],
        );

        return rows[0] || null;
    }

    static async findActiveByEmail(email) {
        const [rows] = await db.execute(
            `SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.dni,
                u.email,
                u.password_hash,
                u.telefono,
                u.google_id,
                u.reset_code,
                u.reset_expires,
                u.fecha_nacimiento,
                u.direccion,
                u.contacto_emergencia,
                u.telefono_emergencia,
                u.avatar_url,
                u.preferencias,
                u.dias_objetivo,
                u.fecha_registro,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r ON r.id = u.rol_id
            WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(?)) AND u.activo = 1
            LIMIT 1`,
            [email],
        );

        return rows[0] || null;
    }

    static async findActiveByDniOrEmail(identifier) {
        const clean = String(identifier || "").trim().toLowerCase();
        const [rows] = await db.execute(
            `SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.dni,
                u.email,
                u.password_hash,
                u.telefono,
                u.google_id,
                u.reset_code,
                u.reset_expires,
                u.fecha_nacimiento,
                u.direccion,
                u.contacto_emergencia,
                u.telefono_emergencia,
                u.avatar_url,
                u.preferencias,
                u.dias_objetivo,
                u.fecha_registro,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r ON r.id = u.rol_id
            WHERE (LOWER(TRIM(u.dni)) = ? OR LOWER(TRIM(u.email)) = ?) AND u.activo = 1
            LIMIT 1`,
            [clean, clean],
        );

        return rows[0] || null;
    }

    static async createFromGoogle({ nombre, apellido, email, google_id }) {
        // Obtenemos rol_id para cliente (id 2)
        const rol_id = 2;
        // Generar un DNI provisional único si es necesario
        const tempDni = "G" + Date.now().toString().slice(-7);

        const [result] = await db.execute(
            `INSERT INTO usuarios (nombre, apellido, dni, email, google_id, rol_id, activo)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [nombre || "Usuario", apellido || "Google", tempDni, email, google_id || null, rol_id],
        );

        return this.findActiveById(result.insertId);
    }

    static async saveResetCode(id, code, expiresDate) {
        const [result] = await db.execute(
            `UPDATE usuarios SET reset_code = ?, reset_expires = ? WHERE id = ?`,
            [code, expiresDate, id],
        );
        return result.affectedRows > 0;
    }

    static async clearResetCode(id) {
        const [result] = await db.execute(
            `UPDATE usuarios SET reset_code = NULL, reset_expires = NULL WHERE id = ?`,
            [id],
        );
        return result.affectedRows > 0;
    }

    static async updateProfile(id, {
        nombre,
        apellido,
        dni,
        email,
        telefono,
        fecha_nacimiento,
        direccion,
        contacto_emergencia,
        telefono_emergencia,
        avatar_url,
        preferencias,
    }) {
        const [result] = await db.execute(
            `UPDATE usuarios 
             SET nombre = ?,
                 apellido = ?,
                 dni = COALESCE(?, dni),
                 email = ?,
                 telefono = ?,
                 fecha_nacimiento = ?,
                 direccion = ?,
                 contacto_emergencia = ?,
                 telefono_emergencia = ?,
                 avatar_url = COALESCE(?, avatar_url),
                 preferencias = COALESCE(?, preferencias)
             WHERE id = ?`,
            [
                nombre,
                apellido,
                dni || null,
                email,
                telefono || null,
                fecha_nacimiento || null,
                direccion || null,
                contacto_emergencia || null,
                telefono_emergencia || null,
                avatar_url || null,
                preferencias ? (typeof preferencias === "object" ? JSON.stringify(preferencias) : preferencias) : null,
                id,
            ],
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
