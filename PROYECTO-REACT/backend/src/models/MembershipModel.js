const db = require("../config/database");
const { addDaysExcludingSundays, toDateOnly } = require("../utils/helpers");
const OfferService = require("../services/offerService");

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
                m.dias_extra AS diasExtra,
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

    static async getMemberRegistrationInfo(userId) {
        const [rows] = await db.execute(
            `SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.dni,
                u.email,
                u.telefono,
                u.fecha_registro AS fechaRegistro,
                DATEDIFF(CURDATE(), u.fecha_registro) AS antiguedadDias
             FROM usuarios u
             WHERE u.id = ?
             LIMIT 1`,
            [userId],
        );
        return rows[0] || null;
    }

    static async getClientMembershipHistory(userId) {
        const [rows] = await db.execute(
            `SELECT
                m.id,
                m.plan_id AS planId,
                p.nombre AS planNombre,
                p.duracion_dias AS duracionDias,
                p.precio AS planPrecio,
                m.fecha_inicio AS fechaInicio,
                m.fecha_fin AS fechaFin,
                m.dias_extra AS diasExtra,
                m.estado,
                m.creado_en AS creadoEn,
                DATEDIFF(m.fecha_fin, CURDATE()) AS diasRestantes,
                pa.monto AS montoPagado,
                pa.metodo_pago AS metodoPago,
                pa.fecha_pago AS fechaPago,
                pa.descuento_aplicado AS descuentoAplicado,
                pa.codigo_cupon AS codigoCupon
             FROM membresias m
             INNER JOIN planes_membresia p ON p.id = m.plan_id
             LEFT JOIN pagos pa ON pa.membresia_id = m.id
             WHERE m.usuario_id = ?
             ORDER BY m.fecha_inicio ASC, m.id ASC`,
            [userId],
        );

        const total = rows.length;
        return rows.map((row, index) => {
            const diasRest = row.diasRestantes !== null ? Number(row.diasRestantes) : -999;
            let estadoVisual = row.estado;
            if (row.estado === "activo" && diasRest < 0) {
                estadoVisual = "expirado";
            } else if (row.estado === "cancelado") {
                estadoVisual = index < total - 1 ? "renovado" : "finalizado";
            }
            return {
                ...row,
                numeroPlan: index + 1,
                estadoVisual,
            };
        });
    }

    static async getPaymentHistory(userId) {
        const [rows] = await db.execute(
            `SELECT
                p.id,
                p.monto,
                p.fecha_pago AS fechaPago,
                p.metodo_pago AS metodoPago,
                p.descuento_aplicado AS descuentoAplicado,
                p.codigo_cupon AS codigoCupon,
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
            LEFT JOIN membresias m ON m.id = (
                SELECT mm.id
                FROM membresias mm
                WHERE mm.usuario_id = u.id
                ORDER BY mm.fecha_fin DESC, mm.id DESC
                LIMIT 1
            )
            LEFT JOIN planes_membresia p ON p.id = m.plan_id
            WHERE (r.nombre = 'cliente' OR EXISTS (SELECT 1 FROM staff_member_links l WHERE l.member_user_id=u.id AND l.staff_user_id=u.id))
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

    static async renewMembership({ userId, planId, fechaInicio, metodoPago, codigoCupon = null, ofertaId = null, existingConnection = null }) {
        const connection = existingConnection || await db.getConnection();
        const manageTx = !existingConnection;

        try {
            if (manageTx) await connection.beginTransaction();

            const [planRows] = await connection.execute(
                "SELECT id, duracion_dias, precio, nombre FROM planes_membresia WHERE id = ? LIMIT 1",
                [planId],
            );

            if (!planRows[0]) {
                throw new Error("El plan seleccionado no existe");
            }

            const plan = planRows[0];
            let montoBase = Number(plan.precio);
            let montoFinal = montoBase;
            let descuentoAplicado = 0;
            let diasExtra = 0;
            let appliedOfferId = ofertaId || null;
            let appliedCode = codigoCupon ? String(codigoCupon).trim().toUpperCase() : null;

            if (appliedCode && !appliedOfferId) {
                const validated = await OfferService.validateOfferCode(
                    {
                        code: appliedCode,
                        userId,
                        planPrecio: montoBase,
                        context: "renovacion",
                        checkPendingRequest: false,
                    },
                    connection,
                );
                appliedOfferId = validated.oferta.id;
                appliedCode = validated.oferta.codigoCupon;
                descuentoAplicado = validated.descuentoAplicado;
                diasExtra = validated.diasExtra;
                montoFinal = validated.montoFinal;
            } else if (appliedOfferId) {
                const [offerRows] = await connection.execute(
                    `SELECT id, tipo, valor, codigo_cupon AS codigoCupon FROM ofertas_socios WHERE id = ? LIMIT 1`,
                    [appliedOfferId],
                );
                if (offerRows[0]) {
                    const calc = OfferService.computeBenefit(offerRows[0], montoBase);
                    descuentoAplicado = calc.descuentoAplicado;
                    diasExtra = calc.diasExtra;
                    montoFinal = calc.montoFinal;
                    appliedCode = offerRows[0].codigoCupon;
                }
            }

            const endDate = addDaysExcludingSundays(fechaInicio, Number(plan.duracion_dias) + diasExtra);

            // Get current active membership to mark it as superseded
            const [currentMemberships] = await connection.execute(
                `SELECT id FROM membresias WHERE usuario_id = ? AND estado = 'activo'`,
                [userId],
            );

            for (const curr of currentMemberships) {
                await connection.execute(
                    `UPDATE membresias SET estado = 'cancelado' WHERE id = ?`,
                    [curr.id],
                );
            }

            // Create new membership
            const [membershipResult] = await connection.execute(
                `INSERT INTO membresias
                    (usuario_id, plan_id, fecha_inicio, fecha_fin, estado, oferta_id, dias_extra)
                VALUES (?, ?, ?, ?, 'activo', ?, ?)`,
                [userId, plan.id, fechaInicio, endDate, appliedOfferId, diasExtra],
            );

            // Register payment
            await connection.execute(
                `INSERT INTO pagos
                    (usuario_id, monto, fecha_pago, metodo_pago, descuento_aplicado, codigo_cupon, membresia_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, montoFinal, toDateOnly(new Date()), metodoPago, descuentoAplicado, appliedCode, membershipResult.insertId],
            );

            if (appliedOfferId) {
                await OfferService.consumeOffer(connection, {
                    ofertaId: appliedOfferId,
                    userId,
                    membresiaId: membershipResult.insertId,
                    descuentoAplicado,
                });
            }

            if (manageTx) await connection.commit();

            return {
                membresiaId: membershipResult.insertId,
                planNombre: plan.nombre,
                fechaInicio,
                fechaFin: endDate,
                estado: "activo",
                montoBase,
                descuentoAplicado,
                diasExtra,
                codigoCupon: appliedCode,
                monto: montoFinal,
                metodoPago,
            };
        } catch (error) {
            if (manageTx) await connection.rollback();
            throw error;
        } finally {
            if (manageTx) connection.release();
        }
    }

    static async createRenewalRequest({
        userId,
        planId,
        metodoPago,
        telefonoContacto,
        codigoCupon = null,
        numeroOperacion = null,
        comprobanteUrl = null,
        comentarioSocio = null,
    }) {
        const [pending] = await db.execute(
            `SELECT id FROM solicitudes_renovacion WHERE usuario_id = ? AND estado = 'pendiente' LIMIT 1`,
            [userId],
        );
        if (pending[0]) {
            throw new Error("Ya tienes una solicitud de renovación pendiente de validación. Espera la respuesta o cancélala para enviar otra.");
        }

        const [planRows] = await db.execute(
            `SELECT id, nombre, duracion_dias AS duracionDias, precio FROM planes_membresia WHERE id = ? LIMIT 1`,
            [planId],
        );
        const plan = planRows[0];
        if (!plan) {
            throw new Error("El plan seleccionado no existe");
        }

        let ofertaId = null;
        let cleanCode = null;
        let descuentoAplicado = 0;
        let diasExtra = 0;
        const montoBase = Number(plan.precio);
        let montoFinal = montoBase;

        if (codigoCupon && String(codigoCupon).trim()) {
            const validated = await OfferService.validateOfferCode({
                code: codigoCupon,
                userId,
                planPrecio: montoBase,
                context: "renovacion",
            });
            ofertaId = validated.oferta.id;
            cleanCode = validated.oferta.codigoCupon;
            descuentoAplicado = validated.descuentoAplicado;
            diasExtra = validated.diasExtra;
            montoFinal = validated.montoFinal;
        }

        const current = await this.getClientMembership(userId);
        const today = toDateOnly(new Date());
        let fechaInicioSugerida = today;
        if (current && current.estado === "activo" && current.fechaFin) {
            const currentFin = toDateOnly(current.fechaFin);
            if (currentFin >= today) {
                fechaInicioSugerida = currentFin;
            }
        }

        const [result] = await db.execute(
            `INSERT INTO solicitudes_renovacion
             (usuario_id, plan_id, oferta_id, codigo_cupon, monto_base, descuento_aplicado, dias_extra, monto_final,
              metodo_pago, numero_operacion, comprobante_url, telefono_contacto, comentario_socio, estado, fecha_inicio_sugerida)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
            [
                userId,
                plan.id,
                ofertaId,
                cleanCode,
                montoBase,
                descuentoAplicado,
                diasExtra,
                montoFinal,
                metodoPago,
                numeroOperacion ? String(numeroOperacion).trim() : null,
                comprobanteUrl || null,
                telefonoContacto ? String(telefonoContacto).trim() : null,
                comentarioSocio ? String(comentarioSocio).trim() : null,
                fechaInicioSugerida,
            ],
        );

        return {
            id: result.insertId,
            planNombre: plan.nombre,
            montoBase,
            descuentoAplicado,
            diasExtra,
            montoFinal,
            codigoCupon: cleanCode,
            metodoPago,
            fechaInicioSugerida,
            estado: "pendiente",
        };
    }

    static async getMemberRenewalRequests(userId) {
        const [rows] = await db.execute(
            `SELECT
                sr.id,
                sr.plan_id AS planId,
                p.nombre AS planNombre,
                p.duracion_dias AS duracionDias,
                sr.oferta_id AS ofertaId,
                sr.codigo_cupon AS codigoCupon,
                sr.monto_base AS montoBase,
                sr.descuento_aplicado AS descuentoAplicado,
                sr.dias_extra AS diasExtra,
                sr.monto_final AS montoFinal,
                sr.metodo_pago AS metodoPago,
                sr.numero_operacion AS numeroOperacion,
                sr.comprobante_url AS comprobanteUrl,
                sr.telefono_contacto AS telefonoContacto,
                sr.comentario_socio AS comentarioSocio,
                sr.estado,
                sr.motivo_rechazo AS motivoRechazo,
                sr.fecha_inicio_sugerida AS fechaInicioSugerida,
                sr.creado_en AS creadoEn,
                sr.revisado_en AS revisadoEn
             FROM solicitudes_renovacion sr
             INNER JOIN planes_membresia p ON p.id = sr.plan_id
             WHERE sr.usuario_id = ?
             ORDER BY sr.id DESC`,
            [userId],
        );
        return rows;
    }

    static async cancelMemberRenewalRequest(userId, requestId) {
        const [result] = await db.execute(
            `UPDATE solicitudes_renovacion
             SET estado = 'cancelada'
             WHERE id = ? AND usuario_id = ? AND estado = 'pendiente'`,
            [requestId, userId],
        );
        return result.affectedRows > 0;
    }

    static async getAdminRenewalRequests(statusFilter = null) {
        let query = `
            SELECT
                sr.id,
                sr.usuario_id AS usuarioId,
                u.nombre,
                u.apellido,
                u.dni,
                u.email,
                u.telefono AS telefonoPerfil,
                sr.plan_id AS planId,
                p.nombre AS planNombre,
                p.duracion_dias AS duracionDias,
                p.precio AS planPrecioActual,
                sr.oferta_id AS ofertaId,
                sr.codigo_cupon AS codigoCupon,
                sr.monto_base AS montoBase,
                sr.descuento_aplicado AS descuentoAplicado,
                sr.dias_extra AS diasExtra,
                sr.monto_final AS montoFinal,
                sr.metodo_pago AS metodoPago,
                sr.numero_operacion AS numeroOperacion,
                sr.comprobante_url AS comprobanteUrl,
                sr.telefono_contacto AS telefonoContacto,
                sr.comentario_socio AS comentarioSocio,
                sr.estado,
                sr.motivo_rechazo AS motivoRechazo,
                sr.fecha_inicio_sugerida AS fechaInicioSugerida,
                sr.membresia_id AS membresiaId,
                sr.revisado_en AS revisadoEn,
                sr.creado_en AS creadoEn,
                rev.nombre AS revisadoPorNombre,
                rev.apellido AS revisadoPorApellido
             FROM solicitudes_renovacion sr
             INNER JOIN usuarios u ON u.id = sr.usuario_id
             INNER JOIN planes_membresia p ON p.id = sr.plan_id
             LEFT JOIN usuarios rev ON rev.id = sr.revisado_por
        `;

        const params = [];
        if (statusFilter && statusFilter !== "todas") {
            query += ` WHERE sr.estado = ?`;
            params.push(statusFilter);
        }

        query += ` ORDER BY (sr.estado = 'pendiente') DESC, sr.id DESC`;

        const [rows] = await db.execute(query, params);
        return rows;
    }

    static async approveRenewalRequest({ requestId, adminId }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [reqRows] = await connection.execute(
                `SELECT * FROM solicitudes_renovacion WHERE id = ? FOR UPDATE`,
                [requestId],
            );
            const request = reqRows[0];
            if (!request) {
                throw new Error("Solicitud de renovación no encontrada");
            }
            if (request.estado !== "pendiente") {
                throw new Error(`Esta solicitud ya fue ${request.estado}`);
            }

            // El administrador valida o rechaza exactamente lo solicitado por el socio;
            // la fecha de inicio mantiene continuidad con su plan vigente o arranca hoy.
            const finalPlanId = request.plan_id;
            const finalMethod = request.metodo_pago || "yape";
            const today = toDateOnly(new Date());

            const [activeRows] = await connection.execute(
                `SELECT fecha_fin AS fechaFin
                 FROM membresias
                 WHERE usuario_id = ? AND estado = 'activo'
                 ORDER BY id DESC
                 LIMIT 1`,
                [request.usuario_id],
            );

            let finalStart = request.fecha_inicio_sugerida ? toDateOnly(request.fecha_inicio_sugerida) : today;
            if (activeRows[0]?.fechaFin) {
                const activeEnd = toDateOnly(activeRows[0].fechaFin);
                finalStart = activeEnd >= today ? activeEnd : (finalStart >= today ? finalStart : today);
            } else if (finalStart < today) {
                finalStart = today;
            }

            const renewalResult = await this.renewMembership({
                userId: request.usuario_id,
                planId: finalPlanId,
                fechaInicio: finalStart,
                metodoPago: finalMethod,
                codigoCupon: request.codigo_cupon,
                ofertaId: request.oferta_id,
                existingConnection: connection,
            });

            await connection.execute(
                `UPDATE solicitudes_renovacion
                 SET estado = 'aprobada',
                     membresia_id = ?,
                     revisado_por = ?,
                     revisado_en = NOW()
                 WHERE id = ?`,
                [renewalResult.membresiaId, adminId, requestId],
            );

            await connection.commit();
            return {
                request,
                membership: renewalResult,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async rejectRenewalRequest({ requestId, adminId, motivo }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [reqRows] = await connection.execute(
                `SELECT sr.*, p.nombre AS planNombre
                 FROM solicitudes_renovacion sr
                 INNER JOIN planes_membresia p ON p.id = sr.plan_id
                 WHERE sr.id = ? FOR UPDATE`,
                [requestId],
            );
            const request = reqRows[0];
            if (!request) throw new Error("Solicitud no encontrada");
            if (request.estado !== "pendiente") {
                throw new Error(`Esta solicitud ya fue ${request.estado}`);
            }

            await connection.execute(
                `UPDATE solicitudes_renovacion
                 SET estado = 'rechazada',
                     motivo_rechazo = ?,
                     revisado_por = ?,
                     revisado_en = NOW()
                 WHERE id = ?`,
                [String(motivo || "No se pudo verificar el pago").trim(), adminId, requestId],
            );

            await connection.commit();
            return request;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = MembershipModel;
