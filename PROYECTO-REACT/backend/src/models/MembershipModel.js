const db = require("../config/database");
const { addDays } = require("../utils/helpers");

class MembershipModel {
    static async getClientMembership(userId) {
        const [rows] = await db.execute(
            `SELECT
                m.id,
                m.usuario_id AS userId,
                m.plan_id AS planId,
                m.fecha_inicio AS fechaInicio,
                m.fecha_fin AS fechaFin,
                m.estado,
                p.nombre AS planNombre,
                p.duracion_dias AS duracionDias,
                p.precio AS planPrecio,
                p.descripcion AS planDescripcion,
                DATEDIFF(m.fecha_fin, CURDATE()) AS diasRestantes
            FROM membresias m
            INNER JOIN planes_membresia p ON p.id = m.plan_id
            WHERE m.usuario_id = ?
            ORDER BY m.id DESC
            LIMIT 1`,
            [userId],
        );

        return rows[0] || null;
    }

    static async getPaymentHistory(userId) {
        const [rows] = await db.execute(
            `SELECT
                p.id,
                p.monto,
                p.fecha_pago AS fechaPago,
                p.metodo_pago AS metodoPago,
                m.id AS membresiaId,
                pl.nombre AS planNombre,
                m.fecha_inicio AS fechaInicio,
                m.fecha_fin AS fechaFin
            FROM pagos p
            INNER JOIN membresias m ON m.id = p.membresia_id
            INNER JOIN planes_membresia pl ON pl.id = m.plan_id
            WHERE p.usuario_id = ?
            ORDER BY p.fecha_pago DESC, p.id DESC`,
            [userId],
        );

        return rows;
    }

    static async getSociosWithMembership(search) {
        let query = `
            SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.dni,
                u.email,
                u.telefono,
                u.activo,
                m.id AS membresiaId,
                m.fecha_inicio AS fechaInicio,
                m.fecha_fin AS fechaFin,
                CASE
                    WHEN m.estado = 'activo' AND m.fecha_fin < CURDATE() THEN 'expirado'
                    ELSE m.estado
                END AS estadoMembresia,
                p.id AS planId,
                p.nombre AS planNombre,
                p.duracion_dias AS duracionDias,
                p.precio AS planPrecio,
                DATEDIFF(m.fecha_fin, CURDATE()) AS diasRestantes
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
            WHERE r.nombre = 'cliente'
        `;

        const params = [];

        if (search) {
            query += ` AND (u.dni LIKE ? OR CONCAT(u.nombre, ' ', u.apellido) LIKE ?)`;
            const like = `%${search}%`;
            params.push(like, like);
        }

        query += ` ORDER BY u.id DESC`;

        const [rows] = await db.execute(query, params);
        return rows;
    }

    static async renewMembership({ userId, planId, fechaInicio, metodoPago }) {
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [planRows] = await connection.execute(
                "SELECT id, duracion_dias, precio, nombre FROM planes_membresia WHERE id = ? LIMIT 1",
                [planId],
            );

            if (!planRows[0]) {
                throw new Error("El plan seleccionado no existe");
            }

            const plan = planRows[0];
            const endDate = addDays(fechaInicio, plan.duracion_dias);

            // Get current active membership to mark it as expired
            const [currentMemberships] = await connection.execute(
                `SELECT id FROM membresias WHERE usuario_id = ? AND estado = 'activo' LIMIT 1`,
                [userId],
            );

            if (currentMemberships[0]) {
                await connection.execute(
                    `UPDATE membresias SET estado = 'cancelado' WHERE id = ?`,
                    [currentMemberships[0].id],
                );
            }

            // Create new membership
            const [membershipResult] = await connection.execute(
                `INSERT INTO membresias
                    (usuario_id, plan_id, fecha_inicio, fecha_fin, estado)
                VALUES (?, ?, ?, ?, 'activo')`,
                [userId, plan.id, fechaInicio, endDate],
            );

            // Register payment
            await connection.execute(
                `INSERT INTO pagos
                    (usuario_id, monto, fecha_pago, metodo_pago, membresia_id)
                VALUES (?, ?, ?, ?, ?)`,
                [userId, plan.precio, fechaInicio, metodoPago, membershipResult.insertId],
            );

            await connection.commit();

            return {
                membresiaId: membershipResult.insertId,
                planNombre: plan.nombre,
                fechaInicio,
                fechaFin: endDate,
                estado: "activo",
                monto: plan.precio,
                metodoPago,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = MembershipModel;
