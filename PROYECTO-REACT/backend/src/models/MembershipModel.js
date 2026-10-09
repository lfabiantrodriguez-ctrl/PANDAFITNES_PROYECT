const db = require("../config/database");
const { addDaysExcludingSundays } = require("../utils/helpers");

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
                    ELSE COALESCE(m.estado, 'sin_plan')
                END AS estadoMembresia,
                CASE
                    WHEN m.estado = 'activo' AND m.fecha_fin < CURDATE() THEN 'expirado'
                    ELSE COALESCE(m.estado, 'sin_plan')
                END AS estado,
                u.fecha_registro AS fechaRegistro,
                DATEDIFF(CURDATE(), u.fecha_registro) AS antiguedadDias,
                p.id AS planId,
                p.nombre AS planNombre,
                p.duracion_dias AS duracionDias,
                p.precio AS planPrecio,
                DATEDIFF(m.fecha_fin, CURDATE()) AS diasRestantes,
                (SELECT COUNT(*) FROM membresias mm WHERE mm.usuario_id = u.id) AS totalMatriculas,
                (SELECT COUNT(*) FROM asistencias aa WHERE aa.usuario_id = u.id) AS totalAsistencias,
                (SELECT COUNT(*) FROM ofertas_socios oo WHERE (oo.usuario_id = u.id OR oo.usuario_id IS NULL) AND oo.estado = 'activo') AS ofertasDisponibles
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

        return rows.map((s) => {
            const diasRest = s.diasRestantes !== null ? Number(s.diasRestantes) : -999;
            const matriculas = Number(s.totalMatriculas || 0);
            const antiguedad = Number(s.antiguedadDias || 0);
            const esActivo = s.estadoMembresia === 'activo' && diasRest >= 0;

            let segmentoKey = 'inactivo';
            let segmentoLabel = 'Inactivo';
            let segmentoBadge = 'Inactivo';

            if (matriculas >= 2 || (antiguedad > 60 && Number(s.totalAsistencias) >= 8)) {
                segmentoKey = 'vip';
                segmentoLabel = 'Socio VIP Frecuente';
                segmentoBadge = 'VIP';
            } else if (antiguedad <= 30 && matriculas <= 1) {
                segmentoKey = 'nuevo';
                segmentoLabel = 'Socio Nuevo';
                segmentoBadge = 'Nuevo';
            } else if (esActivo && diasRest <= 7) {
                segmentoKey = 'por_vencer';
                segmentoLabel = 'Por Vencer';
                segmentoBadge = 'Por Vencer';
            } else if (esActivo) {
                segmentoKey = 'activo';
                segmentoLabel = 'Activo';
                segmentoBadge = 'Activo';
            } else {
                segmentoKey = 'inactivo';
                segmentoLabel = 'Sin Plan / Vencido';
                segmentoBadge = 'Vencido';
            }

            return {
                ...s,
                estado: s.estadoMembresia,
                segmentoKey,
                segmentoLabel,
                segmentoBadge,
                isVip: segmentoKey === 'vip',
                isNuevo: segmentoKey === 'nuevo',
                isPorVencer: diasRest <= 7 && diasRest >= 0 && esActivo,
                isInactivo: !esActivo,
            };
        });
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
            const endDate = addDaysExcludingSundays(fechaInicio, plan.duracion_dias);

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
