const db = require("../config/database");
const bcrypt = require("bcrypt");
const { addDaysExcludingSundays } = require("../utils/helpers");
const { sendEmail } = require("../utils/email");

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
                u.fecha_registro AS fechaRegistro,
                DATEDIFF(CURDATE(), u.fecha_registro) AS antiguedadDias,
                r.nombre AS rol,
                m.id AS membresiaId,
                m.fecha_inicio AS fechaInicio,
                m.fecha_fin AS fechaFin,
                DATEDIFF(m.fecha_fin, CURDATE()) AS diasRestantes,
                CASE
                    WHEN m.estado = 'activo' AND m.fecha_fin < CURDATE() THEN 'expirado'
                    ELSE COALESCE(m.estado, 'sin_plan')
                END AS estadoMembresia,
                p.id AS planId,
                p.nombre AS planNombre,
                p.duracion_dias AS planDuracionDias,
                p.precio AS planPrecio,
                lp.monto AS ultimoPagoMonto,
                lp.fecha_pago AS ultimoPagoFecha,
                lp.metodo_pago AS ultimoPagoMetodo,
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

        // Enriquecer cada fila con cálculo de segmento (VIP, Nuevo, Por Vencer, Inactivo, Activo)
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

    static async getFicha(socioId) {
        // 1. Datos personales del socio
        const [userRows] = await db.execute(
            `SELECT u.id, u.nombre, u.apellido, u.dni, u.email, u.telefono, u.activo,
                    u.fecha_registro AS fechaRegistro,
                    DATEDIFF(CURDATE(), u.fecha_registro) AS antiguedadDias
             FROM usuarios u
             WHERE u.id = ?`,
            [socioId],
        );

        if (!userRows[0]) return null;
        const socio = userRows[0];

        // 2. Historial COMPLETO de todas las membresías / matrículas del socio
        const [membresias] = await db.execute(
            `SELECT m.id, m.plan_id AS planId, p.nombre AS planNombre, p.duracion_dias AS duracionDias,
                    p.precio AS planPrecio, m.fecha_inicio AS fechaInicio, m.fecha_fin AS fechaFin,
                    CASE
                        WHEN m.estado = 'activo' AND m.fecha_fin < CURDATE() THEN 'expirado'
                        ELSE m.estado
                    END AS estado,
                    m.creado_en AS creadoEn,
                    DATEDIFF(m.fecha_fin, CURDATE()) AS diasRestantes,
                    pa.monto AS montoPagado, pa.metodo_pago AS metodoPago, pa.fecha_pago AS fechaPago
             FROM membresias m
             INNER JOIN planes_membresia p ON p.id = m.plan_id
             LEFT JOIN pagos pa ON pa.membresia_id = m.id
             WHERE m.usuario_id = ?
             ORDER BY m.fecha_inicio DESC, m.id DESC`,
            [socioId],
        );

        // 3. Historial de asistencias reales en sala
        const [asistencias] = await db.execute(
            `SELECT id, hora_entrada AS horaEntrada, hora_salida AS horaSalida,
                    COALESCE(metodo_registro, 'manual') AS metodoRegistro,
                    CASE WHEN hora_salida IS NULL THEN 'activo' ELSE 'finalizada' END AS estado
             FROM asistencias
             WHERE usuario_id = ?
             ORDER BY hora_entrada DESC
             LIMIT 50`,
            [socioId],
        );

        // 4. Ofertas asignadas y generales activas
        const [ofertas] = await db.execute(
            `SELECT id, usuario_id AS usuarioId, titulo, descripcion, tipo, valor, codigo_cupon AS codigoCupon,
                    fecha_inicio AS fechaInicio, fecha_fin AS fechaFin, estado, creado_en AS creadoEn
             FROM ofertas_socios
             WHERE (usuario_id = ? OR usuario_id IS NULL)
             ORDER BY id DESC`,
            [socioId],
        );

        // 5. Pagos totales
        const [pagosTotal] = await db.execute(
            `SELECT COALESCE(SUM(monto), 0) AS totalInvertido, COUNT(*) AS countPagos
             FROM pagos
             WHERE usuario_id = ?`,
            [socioId],
        );

        const totalMatriculas = membresias.length;
        const totalAsistencias = asistencias.length;
        const membresiaActual = membresias[0] || null;
        const diasRestantes = membresiaActual ? membresiaActual.diasRestantes : -999;
        const esActivo = membresiaActual && membresiaActual.estado === 'activo' && diasRestantes >= 0;

        let segmentoKey = 'inactivo';
        let segmentoLabel = 'Inactivo';
        let segmentoBadge = 'Vencido';

        if (totalMatriculas >= 2 || (Number(socio.antiguedadDias) > 60 && totalAsistencias >= 8)) {
            segmentoKey = 'vip';
            segmentoLabel = 'Socio VIP Frecuente';
            segmentoBadge = 'VIP';
        } else if (Number(socio.antiguedadDias) <= 30 && totalMatriculas <= 1) {
            segmentoKey = 'nuevo';
            segmentoLabel = 'Socio Nuevo';
            segmentoBadge = 'Nuevo';
        } else if (esActivo && diasRestantes <= 7) {
            segmentoKey = 'por_vencer';
            segmentoLabel = 'Por Vencer';
            segmentoBadge = 'Por Vencer';
        } else if (esActivo) {
            segmentoKey = 'activo';
            segmentoLabel = 'Activo Vigente';
            segmentoBadge = 'Activo';
        }

        return {
            socio: {
                ...socio,
                codigo: `#PF-${String(socio.id).padStart(4, '0')}`,
            },
            segmento: {
                key: segmentoKey,
                label: segmentoLabel,
                badge: segmentoBadge,
                isVip: segmentoKey === 'vip',
                isNuevo: segmentoKey === 'nuevo',
                isPorVencer: diasRestantes <= 7 && diasRestantes >= 0 && esActivo,
                isInactivo: !esActivo,
            },
            estadisticas: {
                totalMatriculas,
                totalAsistencias,
                totalInvertido: Number(pagosTotal[0]?.totalInvertido || 0),
                antiguedadDias: socio.antiguedadDias || 0,
                diasRestantes: diasRestantes >= 0 ? diasRestantes : 0,
                planActual: membresiaActual ? membresiaActual.planNombre : 'Sin plan',
                estadoMembresia: esActivo ? 'activo' : 'expirado',
                fechaFin: membresiaActual ? membresiaActual.fechaFin : null,
                xpTotal: totalAsistencias * 25,
                bambusGanados: totalAsistencias * 10 + 240,
            },
            membresiaActual,
            membresias,
            asistencias,
            ofertas,
        };
    }

    static async createOffer({ usuarioId, titulo, descripcion, tipo, valor, codigoCupon, diasVigencia = 30 }) {
        const [result] = await db.execute(
            `INSERT INTO ofertas_socios
             (usuario_id, titulo, descripcion, tipo, valor, codigo_cupon, fecha_fin, estado)
             VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), 'activo')`,
            [usuarioId || null, titulo, descripcion, tipo || 'descuento_porcentaje', valor || 0, codigoCupon || null, diasVigencia],
        );

        // Enviar notificación por email al socio si la oferta es personalizada
        if (usuarioId) {
            const [u] = await db.execute("SELECT nombre, apellido, email FROM usuarios WHERE id = ?", [usuarioId]);
            if (u[0] && u[0].email) {
                await sendEmail({
                    to: u[0].email,
                    subject: `¡Beneficio Exclusivo en Panda Fitness: ${titulo}!`,
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                            <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                                <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                            </div>
                            <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                                <h2 style="color:#111827;margin:0 0 12px;">¡Tienes una Oferta Exclusiva!</h2>
                                <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${u[0].nombre} ${u[0].apellido}</strong>, hemos preparado un beneficio especial pensado para ti:</p>
                                <div style="background:#ecfccb;border:1.5px solid #84cc16;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
                                    <h3 style="color:#15803d;margin:0 0 8px;font-size:18px;">${titulo}</h3>
                                    <p style="color:#166534;margin:0 0 12px;font-size:14px;">${descripcion}</p>
                                    ${codigoCupon ? `<div style="display:inline-block;background:#111d15;color:#c4f039;font-weight:800;font-size:16px;padding:8px 18px;border-radius:8px;letter-spacing:1px;">CÓDIGO: ${codigoCupon}</div>` : ''}
                                </div>
                                <p style="color:#4b5563;font-size:14px;">Presenta este cupón en recepción al renovar o acércate para activar tu beneficio.</p>
                            </div>
                        </div>
                    `,
                }).catch(() => {});
            }
        }

        return { id: result.insertId, usuarioId, titulo, valor, codigoCupon };
    }

    static async checkDuplicate(dni, email) {
        const [rows] = await db.execute(
            "SELECT id FROM usuarios WHERE dni = ? OR email = ? LIMIT 1",
            [dni, email],
        );
        return rows[0] || null;
    }

    static async create({ dni, nombre, apellido, email, telefono, planId, fechaInicio, metodoPago, device }) {
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
            const endDate = addDaysExcludingSundays(fechaInicio, plan.duracion_dias);

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

            if (device) await connection.execute('INSERT INTO socio_dispositivos (usuario_id, credential_id, public_key, counter) VALUES (?, ?, ?, ?)',
                [userId, device.credentialId, device.publicKey, device.counter]);
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
