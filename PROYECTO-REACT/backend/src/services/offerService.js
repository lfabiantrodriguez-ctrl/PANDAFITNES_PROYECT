const db = require("../config/database");
const { sendEmail } = require("../utils/email");
const NotificationService = require("./notificationService");

function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function formatOfferEffectText(tipo, valor) {
    const val = Number(valor || 0);
    if (tipo === "descuento_porcentaje") return `${val}% de descuento`;
    if (tipo === "descuento_fijo") return `S/. ${val.toFixed(2)} de descuento`;
    if (tipo === "dias_gratis") return `+${Math.round(val)} días de entrenamiento gratis`;
    if (tipo === "pase_amigo") {
        const cant = Math.max(1, Math.round(val || 1));
        return cant === 1 ? "Pase libre para 1 invitado" : `Pase libre para ${cant} invitados`;
    }
    return "Beneficio especial";
}

class OfferService {
    static async createOffer({
        usuarioId = null,
        titulo,
        descripcion = "",
        tipo = "descuento_porcentaje",
        valor = 0,
        codigoCupon = null,
        diasVigencia = 30,
        cuposMaximos = null,
    }) {
        const isFriendPass = tipo === "pase_amigo";
        const normalizedCode = isFriendPass
            ? null
            : codigoCupon
                ? String(codigoCupon).trim().toUpperCase()
                : usuarioId
                    ? `PROMO${usuarioId}-${Math.floor(100 + Math.random() * 900)}`
                    : `PANDA${Math.floor(1000 + Math.random() * 9000)}`;

        const maxCupos =
            usuarioId
                ? 1
                : cuposMaximos !== null && cuposMaximos !== undefined && String(cuposMaximos).trim() !== ""
                    ? Math.max(1, parseInt(cuposMaximos, 10))
                    : null;

        const cleanDias = Math.max(1, parseInt(diasVigencia, 10) || 30);
        const cleanValor =
            tipo === "pase_amigo"
                ? Math.max(1, Math.round(Number(valor || 1)))
                : Math.max(0, Number(valor || 0));

        const [result] = await db.execute(
            `INSERT INTO ofertas_socios
             (usuario_id, titulo, descripcion, tipo, valor, codigo_cupon, fecha_fin, estado, cupos_maximos, cupos_usados)
             VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), 'activo', ?, 0)`,
            [
                usuarioId || null,
                String(titulo).trim(),
                String(descripcion || "").trim() || formatOfferEffectText(tipo, cleanValor),
                tipo,
                cleanValor,
                normalizedCode,
                cleanDias,
                maxCupos,
            ],
        );

        const ofertaId = result.insertId;
        const effectLabel = formatOfferEffectText(tipo, cleanValor);
        const cuposLabel = maxCupos ? ` · Limitado a ${maxCupos} ${maxCupos === 1 ? "cupo" : "cupos"}` : "";

        const isFriendPassMsg = tipo === "pase_amigo";
        await NotificationService.create({
            usuarioId: usuarioId || null,
            rolDestino: "cliente",
            tipo: "promocion",
            titulo: isFriendPassMsg
                ? usuarioId
                    ? "¡Pase Libre para Amigo disponible!"
                    : "Nuevo Pase Libre para Amigo en el club"
                : usuarioId
                    ? "¡Oferta exclusiva para ti!"
                    : "Nueva promoción general del club",
            mensaje: isFriendPassMsg
                ? `${titulo.trim()} (${effectLabel}). Preséntate acompañado en recepción${cuposLabel}.`
                : `${titulo.trim()} (${effectLabel}). Código: ${normalizedCode}${cuposLabel}.`,
            enlace: "/app/mi-membresia",
            referenciaId: ofertaId,
        });

        if (usuarioId) {
            const [u] = await db.execute("SELECT nombre, apellido, email FROM usuarios WHERE id = ?", [usuarioId]);
            if (u[0] && u[0].email) {
                await sendEmail({
                    to: u[0].email,
                    subject: isFriendPassMsg
                        ? `¡Pase Amigo Disponible en Panda Fitness: ${titulo}!`
                        : `¡Beneficio Exclusivo en Panda Fitness: ${titulo}!`,
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                            <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                                <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                            </div>
                            <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                                <h2 style="color:#111827;margin:0 0 12px;">${isFriendPassMsg ? "¡Tienes un Pase Libre para Amigo!" : "¡Tienes una Oferta Exclusiva!"}</h2>
                                <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${u[0].nombre} ${u[0].apellido}</strong>, hemos preparado un beneficio especial pensado para ti:</p>
                                <div style="background:#ecfccb;border:1.5px solid #84cc16;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
                                    <h3 style="color:#15803d;margin:0 0 8px;font-size:18px;">${titulo}</h3>
                                    <p style="color:#166534;margin:0 0 12px;font-size:14px;">${descripcion || effectLabel}</p>
                                    <div style="display:inline-block;background:#111d15;color:#c4f039;font-weight:800;font-size:16px;padding:8px 18px;border-radius:8px;letter-spacing:1px;">
                                        ${isFriendPassMsg ? effectLabel.toUpperCase() : `CÓDIGO: ${normalizedCode}`}
                                    </div>
                                </div>
                                <p style="color:#4b5563;font-size:14px;">${
                                    isFriendPassMsg
                                        ? "Preséntate en recepción acompañado con tu invitado y tu DNI o huella; tu pase se valida automáticamente en Control de acceso."
                                        : "Puedes aplicarlo directamente en <strong>Mi membresía</strong> al enviar tu solicitud de renovación o presentarlo en recepción."
                                }</p>
                            </div>
                        </div>
                    `,
                }).catch(() => {});
            }
        }

        return {
            id: ofertaId,
            usuarioId: usuarioId || null,
            titulo: String(titulo).trim(),
            tipo,
            valor: cleanValor,
            codigoCupon: normalizedCode,
            cuposMaximos: maxCupos,
            cuposUsados: 0,
        };
    }

    static async getAllOffersWithStats() {
        const [rows] = await db.execute(
            `SELECT
                o.id,
                o.usuario_id AS usuarioId,
                o.titulo,
                o.descripcion,
                o.tipo,
                o.valor,
                o.codigo_cupon AS codigoCupon,
                o.fecha_inicio AS fechaInicio,
                o.fecha_fin AS fechaFin,
                CASE
                    WHEN o.estado = 'activo' AND o.fecha_fin IS NOT NULL AND o.fecha_fin < NOW() THEN 'expirado'
                    ELSE o.estado
                END AS estado,
                o.cupos_maximos AS cuposMaximos,
                o.cupos_usados AS cuposUsados,
                o.creado_en AS creadoEn,
                u.nombre AS usuarioNombre,
                u.apellido AS usuarioApellido,
                u.dni AS usuarioDni
             FROM ofertas_socios o
             LEFT JOIN usuarios u ON u.id = o.usuario_id
             ORDER BY o.id DESC`,
        );

        return rows.map((row) => {
            const max = row.cuposMaximos !== null && row.cuposMaximos !== undefined ? Number(row.cuposMaximos) : null;
            const used = Number(row.cuposUsados || 0);
            return {
                ...row,
                valor: Number(row.valor || 0),
                cuposMaximos: max,
                cuposUsados: used,
                cuposRestantes: max !== null ? Math.max(0, max - used) : null,
            };
        });
    }

    static async getMemberOffers(userId) {
        const [rows] = await db.execute(
            `SELECT
                o.id,
                o.usuario_id AS usuarioId,
                o.titulo,
                o.descripcion,
                o.tipo,
                o.valor,
                o.codigo_cupon AS codigoCupon,
                o.fecha_inicio AS fechaInicio,
                o.fecha_fin AS fechaFin,
                o.estado,
                o.cupos_maximos AS cuposMaximos,
                o.cupos_usados AS cuposUsados,
                o.creado_en AS creadoEn,
                IF(ou.id IS NOT NULL, 1, 0) AS yaUsadaPorMi,
                COALESCE(ou.cantidad_invitados, 0) AS cantidadUsadaPorMi,
                IF(sr.id IS NOT NULL, 1, 0) AS enSolicitudPendiente
             FROM ofertas_socios o
             LEFT JOIN ofertas_usos ou ON ou.oferta_id = o.id AND ou.usuario_id = ?
             LEFT JOIN solicitudes_renovacion sr ON sr.oferta_id = o.id AND sr.usuario_id = ? AND sr.estado = 'pendiente'
             WHERE (o.usuario_id = ? OR o.usuario_id IS NULL)
             ORDER BY (o.usuario_id IS NOT NULL) DESC, o.id DESC`,
            [userId, userId, userId],
        );

        const now = new Date();
        return rows.map((row) => {
            const max = row.cuposMaximos !== null && row.cuposMaximos !== undefined ? Number(row.cuposMaximos) : null;
            const used = Number(row.cuposUsados || 0);
            const cuposRestantes = max !== null ? Math.max(0, max - used) : null;
            const expiredByDate = row.fechaFin ? new Date(row.fechaFin) < now : false;
            const yaUsoRegistro = Boolean(row.yaUsadaPorMi);

            const isFriendPass = row.tipo === "pase_amigo";
            const maxInvitesForPass = isFriendPass ? Math.max(1, Math.round(Number(row.valor || 1))) : 1;
            const usedInvitesByMe = Number(row.cantidadUsadaPorMi || 0);
            const pasesRestantesPorMi = isFriendPass
                ? Math.max(0, maxInvitesForPass - usedInvitesByMe)
                : yaUsoRegistro
                    ? 0
                    : 1;

            const yaUsadaPorMi = isFriendPass ? usedInvitesByMe >= maxInvitesForPass : yaUsoRegistro;
            const agotada = max !== null && used >= max && !(isFriendPass && yaUsoRegistro && pasesRestantesPorMi > 0);
            const enPendiente = Boolean(row.enSolicitudPendiente);
            const disponible =
                row.estado === "activo" &&
                !expiredByDate &&
                !agotada &&
                pasesRestantesPorMi > 0;

            return {
                id: row.id,
                usuarioId: row.usuarioId,
                alcance: row.usuarioId ? "personal" : "general",
                categoriaUso: isFriendPass ? "pase_amigo" : "descuento",
                titulo: row.titulo,
                descripcion: row.descripcion,
                tipo: row.tipo,
                valor: Number(row.valor || 0),
                codigoCupon: row.codigoCupon,
                fechaInicio: row.fechaInicio,
                fechaFin: row.fechaFin,
                estado: expiredByDate && row.estado === "activo" ? "expirado" : row.estado,
                cuposMaximos: max,
                cuposUsados: used,
                cuposRestantes,
                maxInvitesForPass,
                usedInvitesByMe,
                pasesRestantesPorMi,
                yaUsadaPorMi,
                enSolicitudPendiente: enPendiente,
                agotada,
                disponible,
            };
        });
    }

    static async getAvailableFriendPassesForUser(userId) {
        const offers = await this.getMemberOffers(userId);
        const passes = offers.filter((o) => o.categoriaUso === "pase_amigo" && o.disponible && o.pasesRestantesPorMi > 0);
        const totalDisponibles = passes.reduce((sum, p) => sum + Number(p.pasesRestantesPorMi || 0), 0);

        const [histRows] = await db.execute(
            `SELECT COALESCE(SUM(invitados_count), 0) AS asistenciasInvitados
             FROM asistencias
             WHERE usuario_id = ?`,
            [userId],
        );
        const [guestRows] = await db.execute(
            `SELECT COUNT(*) AS pasesDiarios
             FROM usuarios_invitados
             WHERE invitado_por_usuario_id = ?`,
            [userId],
        );

        return {
            totalDisponibles,
            invitadosHistorico: Number(histRows[0]?.asistenciasInvitados || 0) + Number(guestRows[0]?.pasesDiarios || 0),
            ofertas: passes,
        };
    }

    static computeBenefit(offer, planPrecio = 0) {
        const base = Math.max(0, Number(planPrecio) || 0);
        const val = Math.max(0, Number(offer.valor) || 0);
        let descuentoAplicado = 0;
        let diasExtra = 0;

        if (offer.tipo === "descuento_porcentaje") {
            const pct = Math.min(100, val);
            descuentoAplicado = round2((base * pct) / 100);
            descuentoAplicado = Math.min(base, descuentoAplicado);
        } else if (offer.tipo === "descuento_fijo") {
            descuentoAplicado = round2(Math.min(base, val));
        } else if (offer.tipo === "dias_gratis") {
            diasExtra = Math.max(0, Math.round(val));
        }

        const montoFinal = Math.max(0, round2(base - descuentoAplicado));
        return {
            montoBase: round2(base),
            descuentoAplicado,
            diasExtra,
            montoFinal,
        };
    }

    static async validateOfferCode({
        code,
        userId = null,
        planPrecio = 0,
        context = "renovacion",
        checkPendingRequest = true,
    }, executor = db) {
        const cleanCode = String(code || "").trim().toUpperCase();
        if (!cleanCode) {
            throw new Error("Ingresa un código promocional válido");
        }

        const [rows] = await executor.execute(
            `SELECT id, usuario_id AS usuarioId, titulo, descripcion, tipo, valor,
                    codigo_cupon AS codigoCupon, fecha_inicio AS fechaInicio, fecha_fin AS fechaFin,
                    estado, cupos_maximos AS cuposMaximos, cupos_usados AS cuposUsados
             FROM ofertas_socios
             WHERE UPPER(TRIM(codigo_cupon)) = ?
             ORDER BY id DESC
             LIMIT 1`,
            [cleanCode],
        );

        const offer = rows[0];
        if (!offer) {
            throw new Error("El código promocional no existe");
        }

        if (offer.estado !== "activo") {
            throw new Error(offer.estado === "canjeado" ? "Este código ya fue utilizado o agotó sus cupos" : "Este código promocional ya expiró");
        }

        if (offer.fechaFin && new Date(offer.fechaFin) < new Date()) {
            throw new Error("La vigencia de este código promocional ha expirado");
        }

        if (offer.usuarioId && userId && Number(offer.usuarioId) !== Number(userId)) {
            throw new Error("Este código es exclusivo de otro socio");
        }

        if (offer.usuarioId && !userId && context === "alta_socio") {
            throw new Error("Este código pertenece a un socio existente y no aplica para matrícula nueva");
        }

        const max = offer.cuposMaximos !== null && offer.cuposMaximos !== undefined ? Number(offer.cuposMaximos) : null;
        const used = Number(offer.cuposUsados || 0);
        if (max !== null && used >= max) {
            throw new Error("Esta promoción alcanzó el límite máximo de cupos disponibles");
        }

        if (context === "pase_amigo" && offer.tipo !== "pase_amigo") {
            throw new Error("Este código corresponde a un descuento/días gratis, no a un Pase Amigo");
        }

        if (context !== "pase_amigo" && offer.tipo === "pase_amigo") {
            throw new Error("Este código es un Pase Libre para Amigo y solo se valida acompañado del socio en recepción (Inicio)");
        }

        if (userId) {
            const [usedRows] = await executor.execute(
                `SELECT id, cantidad_invitados AS cantidadInvitados FROM ofertas_usos WHERE oferta_id = ? AND usuario_id = ? LIMIT 1`,
                [offer.id, userId],
            );
            if (usedRows[0]) {
                if (offer.tipo === "pase_amigo") {
                    const maxAllowed = Math.max(1, Math.round(Number(offer.valor || 1)));
                    if (Number(usedRows[0].cantidadInvitados || 1) >= maxAllowed) {
                        throw new Error("Ya utilizaste todas las invitaciones de este Pase Amigo");
                    }
                } else {
                    throw new Error("Ya utilizaste este código promocional anteriormente");
                }
            }

            if (checkPendingRequest) {
                const [pendingRows] = await executor.execute(
                    `SELECT id FROM solicitudes_renovacion WHERE oferta_id = ? AND usuario_id = ? AND estado = 'pendiente' LIMIT 1`,
                    [offer.id, userId],
                );
                if (pendingRows[0]) {
                    throw new Error("Ya tienes una solicitud pendiente usando este código promocional");
                }
            }
        }

        const calculation = this.computeBenefit(offer, planPrecio);
        return {
            oferta: {
                ...offer,
                valor: Number(offer.valor || 0),
                cuposMaximos: max,
                cuposUsados: used,
                cuposRestantes: max !== null ? Math.max(0, max - used) : null,
            },
            ...calculation,
        };
    }

    static async consumeOffer(connection, {
        ofertaId,
        userId,
        membresiaId = null,
        invitadoId = null,
        descuentoAplicado = 0,
        cantidadInvitados = 1,
    }) {
        const [rows] = await connection.execute(
            `SELECT id, usuario_id AS usuarioId, tipo, valor, estado, fecha_fin AS fechaFin,
                    cupos_maximos AS cuposMaximos, cupos_usados AS cuposUsados
             FROM ofertas_socios
             WHERE id = ?
             FOR UPDATE`,
            [ofertaId],
        );

        const offer = rows[0];
        if (!offer) throw new Error("El cupón seleccionado ya no existe");
        if (offer.estado !== "activo") throw new Error("El cupón seleccionado ya no está activo");
        if (offer.fechaFin && new Date(offer.fechaFin) < new Date()) throw new Error("El cupón seleccionado ha expirado");
        if (offer.usuarioId && Number(offer.usuarioId) !== Number(userId)) {
            throw new Error("Este cupón pertenece a otro socio");
        }

        const [alreadyRows] = await connection.execute(
            `SELECT id, cantidad_invitados AS cantidadInvitados FROM ofertas_usos WHERE oferta_id = ? AND usuario_id = ? LIMIT 1`,
            [ofertaId, userId],
        );
        const existingUse = alreadyRows[0];
        const max = offer.cuposMaximos !== null && offer.cuposMaximos !== undefined ? Number(offer.cuposMaximos) : null;
        const used = Number(offer.cuposUsados || 0);
        const incQty = Math.max(1, Number(cantidadInvitados) || 1);

        if (existingUse) {
            if (offer.tipo !== "pase_amigo") {
                throw new Error("Este socio ya canjeó esta promoción anteriormente");
            }
            const maxAllowed = Math.max(1, Math.round(Number(offer.valor || 1)));
            const currentQty = Number(existingUse.cantidadInvitados || 1);
            if (currentQty + incQty > maxAllowed) {
                throw new Error(`Solo te queda ${Math.max(0, maxAllowed - currentQty)} invitación(es) disponible(s) en este pase.`);
            }
            await connection.execute(
                `UPDATE ofertas_usos SET cantidad_invitados = cantidad_invitados + ? WHERE id = ?`,
                [incQty, existingUse.id],
            );

            const exhaustedPersonal = Boolean(offer.usuarioId) && (currentQty + incQty >= maxAllowed);
            if (exhaustedPersonal) {
                await connection.execute(`UPDATE ofertas_socios SET estado = 'canjeado' WHERE id = ?`, [ofertaId]);
            }
            return { nextUsed: used, exhausted: exhaustedPersonal };
        }

        if (max !== null && used >= max) {
            throw new Error("La promoción ya agotó todos sus cupos disponibles");
        }

        const maxAllowed = offer.tipo === "pase_amigo" ? Math.max(1, Math.round(Number(offer.valor || 1))) : 1;
        if (incQty > maxAllowed) {
            throw new Error(`Este pase permite un máximo de ${maxAllowed} invitado(s).`);
        }

        await connection.execute(
            `INSERT INTO ofertas_usos (oferta_id, usuario_id, membresia_id, invitado_id, descuento_aplicado, cantidad_invitados)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ofertaId, userId, membresiaId || null, invitadoId || null, round2(descuentoAplicado), incQty],
        );

        const nextUsed = used + 1;
        const exhausted =
            (Boolean(offer.usuarioId) && (offer.tipo !== "pase_amigo" || incQty >= maxAllowed)) ||
            (!offer.usuarioId && max !== null && nextUsed >= max);

        await connection.execute(
            `UPDATE ofertas_socios
             SET cupos_usados = ?,
                 estado = ?
             WHERE id = ?`,
            [nextUsed, exhausted ? "canjeado" : "activo", ofertaId],
        );

        return { nextUsed, exhausted };
    }

    static async consumeFriendPassAttendance(connection, {
        userId,
        ofertaId = null,
        cantidad = 1,
        asistenciaId,
        invitadoNombres = null,
    }) {
        const qty = Math.max(1, parseInt(cantidad, 10) || 1);
        let targetOfferId = ofertaId ? Number(ofertaId) : null;

        if (!targetOfferId) {
            const avail = await this.getAvailableFriendPassesForUser(userId);
            const eligible = avail.ofertas.find((o) => o.pasesRestantesPorMi >= qty);
            if (!eligible) {
                throw new Error(
                    avail.totalDisponibles > 0
                        ? `El socio solo tiene ${avail.totalDisponibles} invitación(es) disponible(s) en un mismo pase.`
                        : "El socio no tiene pases de amigo activos disponibles.",
                );
            }
            targetOfferId = eligible.id;
        }

        await this.consumeOffer(connection, {
            ofertaId: targetOfferId,
            userId,
            cantidadInvitados: qty,
        });

        const cleanNames = invitadoNombres ? String(invitadoNombres).trim().slice(0, 250) : null;
        await connection.execute(
            `UPDATE asistencias
             SET invitados_count = COALESCE(invitados_count, 0) + ?,
                 invitado_nombres = CASE
                     WHEN ? IS NULL OR ? = '' THEN invitado_nombres
                     WHEN invitado_nombres IS NULL OR invitado_nombres = '' THEN ?
                     ELSE CONCAT(invitado_nombres, ', ', ?)
                 END,
                 pase_oferta_id = COALESCE(pase_oferta_id, ?)
             WHERE id = ?`,
            [qty, cleanNames, cleanNames, cleanNames, cleanNames, targetOfferId, asistenciaId],
        );

        return { ofertaId: targetOfferId, cantidadAgregada: qty };
    }
}

module.exports = OfferService;
