const db = require("../config/database");
const bcrypt = require("bcrypt");
const { addDays } = require("../utils/helpers");

class SocioModel {
    static async getAll() {
        const [rows] = await db.execute(
            `SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.dni,
                u.email,
                u.telefono,
                u.activo,
                r.nombre AS rol,
                m.id AS membresiaId,
                m.fecha_inicio AS fechaInicio,
                m.fecha_fin AS fechaFin,
                CASE
                    WHEN m.estado = 'activo' AND m.fecha_fin < CURDATE() THEN 'expirado'
                    ELSE m.estado
                END AS estadoMembresia,
                p.id AS planId,
                p.nombre AS planNombre,
                p.duracion_dias AS planDuracionDias,
                p.precio AS planPrecio,
                lp.monto AS ultimoPagoMonto,
                lp.fecha_pago AS ultimoPagoFecha,
                lp.metodo_pago AS ultimoPagoMetodo
            FROM usuarios u
            INNER JOIN roles r ON r.id = u.rol_id
            LEFT JOIN membresias m ON m.id = (
                SELECT mm.id
                FROM membresias mm
                WHERE mm.usuario_id = u.id
                ORDER BY mm.fecha_fin DESC, mm.id DESC
                LIMIT 1
            )
            LEFT JOIN planes_membresia p ON p.id = m.plan_id
            LEFT JOIN pagos lp ON lp.id = (
                SELECT pp.id
                FROM pagos pp
                WHERE pp.usuario_id = u.id
                ORDER BY pp.fecha_pago DESC, pp.id DESC
                LIMIT 1
            )
            WHERE r.nombre = 'cliente'
            ORDER BY u.id DESC`,
        );

        return rows;
    }

    static async checkDuplicate(dni, email) {
        const [rows] = await db.execute(
            "SELECT id FROM usuarios WHERE dni = ? OR email = ? LIMIT 1",
            [dni, email],
        );
        return rows[0] || null;
    }

    static async create({ dni, nombre, apellido, email, telefono, planId, fechaInicio, metodoPago }) {
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [roleRows] = await connection.execute(
                "SELECT id FROM roles WHERE nombre = 'cliente' LIMIT 1",
            );

            if (!roleRows[0]) {
                throw new Error("No existe el rol cliente");
            }

            const [planRows] = await connection.execute(
                "SELECT id, duracion_dias, precio FROM planes_membresia WHERE id = ? LIMIT 1",
                [planId],
            );

            if (!planRows[0]) {
                throw new Error("El plan seleccionado no existe");
            }

            const passwordHash = await bcrypt.hash(dni, 10);
            const plan = planRows[0];
            const endDate = addDays(fechaInicio, plan.duracion_dias);

            const [userResult] = await connection.execute(
                `INSERT INTO usuarios
                    (nombre, apellido, dni, email, password_hash, telefono, rol_id, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                [nombre, apellido, dni, email, passwordHash, telefono, roleRows[0].id],
            );

            const userId = userResult.insertId;

            const [membershipResult] = await connection.execute(
                `INSERT INTO membresias
                    (usuario_id, plan_id, fecha_inicio, fecha_fin, estado)
                VALUES (?, ?, ?, ?, 'activo')`,
                [userId, plan.id, fechaInicio, endDate],
            );

            await connection.execute(
                `INSERT INTO pagos
                    (usuario_id, monto, fecha_pago, metodo_pago, membresia_id)
                VALUES (?, ?, ?, ?, ?)`,
                [userId, plan.precio, fechaInicio, metodoPago || "efectivo", membershipResult.insertId],
            );

            await connection.commit();

            return {
                id: userId,
                nombre,
                apellido,
                dni,
                email,
                telefono,
                fechaInicio,
                fechaFin: endDate,
                estadoMembresia: "activo",
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = SocioModel;
