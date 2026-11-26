const db = require("../config/database");
const bcrypt = require("bcrypt");
const { addDaysExcludingSundays } = require("../utils/helpers");
const OfferService = require("../services/offerService");

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
                l.staff_user_id AS linkedStaffId,
                staff.nombre AS linkedStaffNombre,
                staff.apellido AS linkedStaffApellido,
                staffRole.nombre AS linkedStaffRole,
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
                (SELECT COUNT(*) FROM ofertas_socios oo
                 WHERE (oo.usuario_id = u.id OR oo.usuario_id IS NULL)
                   AND oo.estado = 'activo'
                   AND (oo.fecha_fin IS NULL OR oo.fecha_fin >= NOW())
                   AND (oo.cupos_maximos IS NULL OR oo.cupos_usados < oo.cupos_maximos)
                   AND NOT EXISTS (SELECT 1 FROM ofertas_usos ou WHERE ou.oferta_id = oo.id AND ou.usuario_id = u.id)
                ) AS ofertasDisponibles,
                (SELECT COUNT(*) FROM solicitudes_renovacion sr WHERE sr.usuario_id = u.id AND sr.estado = 'pendiente') AS solicitudesPendientes
            FROM usuarios u
            INNER JOIN roles r ON r.id = u.rol_id
            LEFT JOIN staff_member_links l ON l.member_user_id=u.id
            LEFT JOIN usuarios staff ON staff.id=l.staff_user_id
            LEFT JOIN roles staffRole ON staffRole.id=staff.rol_id
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
            WHERE r.nombre = 'cliente' OR l.member_user_id=u.id
            ORDER BY u.id DESC`,
        );

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

        const [membresias] = await db.execute(
            `SELECT m.id, m.plan_id AS planId, p.nombre AS planNombre, p.duracion_dias AS duracionDias,
                    p.precio AS planPrecio, m.fecha_inicio AS fechaInicio, m.fecha_fin AS fechaFin,
                    m.dias_extra AS diasExtra,
                    CASE
                        WHEN m.estado = 'activo' AND m.fecha_fin < CURDATE() THEN 'expirado'
                        ELSE m.estado
                    END AS estado,
                    m.creado_en AS creadoEn,
                    DATEDIFF(m.fecha_fin, CURDATE()) AS diasRestantes,
                    pa.monto AS montoPagado, pa.metodo_pago AS metodoPago, pa.fecha_pago AS fechaPago,
                    pa.descuento_aplicado AS descuentoAplicado, pa.codigo_cupon AS codigoCupon
             FROM membresias m
             INNER JOIN planes_membresia p ON p.id = m.plan_id
             LEFT JOIN pagos pa ON pa.membresia_id = m.id
             WHERE m.usuario_id = ?
             ORDER BY m.fecha_inicio DESC, m.id DESC`,
            [socioId],
        );

        const [asistencias] = await db.execute(
            `SELECT id, hora_entrada AS horaEntrada, hora_salida AS horaSalida,
                    COALESCE(metodo_registro, 'manual') AS metodoRegistro,
                    observacion_salida AS observacionSalida,
                    CASE
                        WHEN hora_salida IS NULL THEN 'activo'
                        WHEN observacion_salida = 'no_marco_salida' THEN 'no_marco_salida'
                        ELSE 'finalizada'
                    END AS estado
             FROM asistencias
             WHERE usuario_id = ?
             ORDER BY hora_entrada DESC
             LIMIT 50`,
            [socioId],
        );

        const ofertas = await OfferService.getMemberOffers(socioId);

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

        const panda = await require('../services/pandaAccount')(socioId);
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
                xpTotal: panda.xp,
                bambusGanados: panda.bambusGanados,
            },
            membresiaActual,
            membresias,
            asistencias,
            ofertas,
        };
    }

    static async createOffer(payload) {
        return OfferService.createOffer(payload);
    }

    static async checkDuplicate(dni, email) {
        const [rows] = await db.execute(
            "SELECT id FROM usuarios WHERE dni = ? OR email = ? LIMIT 1",
            [dni, email],
        );
        return rows[0] || null;
    }

    static async setActive(id, activo) {
        const [result] = await db.execute(
            `UPDATE usuarios u JOIN roles r ON r.id=u.rol_id
             SET u.activo=? WHERE u.id=? AND r.nombre='cliente'`,
            [activo ? 1 : 0, id],
        );
        return result.affectedRows > 0;
    }

    static async create({ dni, nombre, apellido, email, telefono, planId, fechaInicio, metodoPago, device, codigoCupon = null }) {
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

            const plan = planRows[0];
            let montoFinal = Number(plan.precio);
            let descuentoAplicado = 0;
            let diasExtra = 0;
            let appliedOfferId = null;
            let appliedCode = null;

            if (codigoCupon && String(codigoCupon).trim()) {
                const validated = await OfferService.validateOfferCode(
                    {
                        code: codigoCupon,
                        userId: null,
                        planPrecio: montoFinal,
                        context: "alta_socio",
                        checkPendingRequest: false,
                    },
                    connection,
                );
                appliedOfferId = validated.oferta.id;
                appliedCode = validated.oferta.codigoCupon;
                descuentoAplicado = validated.descuentoAplicado;
                diasExtra = validated.diasExtra;
                montoFinal = validated.montoFinal;
            }

            const passwordHash = await bcrypt.hash(dni, 12);
            const endDate = addDaysExcludingSundays(fechaInicio, Number(plan.duracion_dias) + diasExtra);

            const [userResult] = await connection.execute(
                `INSERT INTO usuarios
                    (nombre, apellido, dni, email, password_hash, telefono, rol_id, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                [nombre, apellido, dni, email, passwordHash, telefono, roleRows[0].id],
            );

            const userId = userResult.insertId;

            const [membershipResult] = await connection.execute(
                `INSERT INTO membresias
                    (usuario_id, plan_id, fecha_inicio, fecha_fin, estado, oferta_id, dias_extra)
                VALUES (?, ?, ?, ?, 'activo', ?, ?)`,
                [userId, plan.id, fechaInicio, endDate, appliedOfferId, diasExtra],
            );

            await connection.execute(
                `INSERT INTO pagos
                    (usuario_id, monto, fecha_pago, metodo_pago, descuento_aplicado, codigo_cupon, membresia_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, montoFinal, fechaInicio, metodoPago || "efectivo", descuentoAplicado, appliedCode, membershipResult.insertId],
            );

            if (appliedOfferId) {
                await OfferService.consumeOffer(connection, {
                    ofertaId: appliedOfferId,
                    userId,
                    membresiaId: membershipResult.insertId,
                    descuentoAplicado,
                });
            }

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
                montoPagado: montoFinal,
                descuentoAplicado,
                diasExtra,
                codigoCupon: appliedCode,
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
