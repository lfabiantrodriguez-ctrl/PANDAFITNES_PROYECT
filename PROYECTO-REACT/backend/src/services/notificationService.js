const db = require("../config/database");

class NotificationService {
    static async create({
        usuarioId = null,
        rolDestino = "cliente",
        tipo = "sistema",
        titulo,
        mensaje,
        enlace = null,
        referenciaId = null,
    }, executor = db) {
        if (!titulo || !mensaje) return null;
        try {
            const [result] = await executor.execute(
                `INSERT INTO notificaciones (usuario_id, rol_destino, tipo, titulo, mensaje, enlace, referencia_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [usuarioId || null, rolDestino, tipo, titulo, mensaje, enlace, referenciaId || null],
            );
            return result.insertId || null;
        } catch (err) {
            console.error("Error creando notificación:", err.message);
            return null;
        }
    }

    static async createUnique({
        usuarioId = null,
        rolDestino = "cliente",
        tipo,
        titulo,
        mensaje,
        enlace = null,
        referenciaId = null,
    }) {
        try {
            const [existing] = await db.execute(
                `SELECT id FROM notificaciones
                 WHERE COALESCE(usuario_id, 0) = COALESCE(?, 0)
                   AND rol_destino = ?
                   AND tipo = ?
                   AND COALESCE(referencia_id, 0) = COALESCE(?, 0)
                 LIMIT 1`,
                [usuarioId || null, rolDestino, tipo, referenciaId || null],
            );
            if (existing[0]) return existing[0].id;
            return await this.create({
                usuarioId,
                rolDestino,
                tipo,
                titulo,
                mensaje,
                enlace,
                referenciaId,
            });
        } catch (err) {
            console.error("Error creando notificación única:", err.message);
            return null;
        }
    }

    static async ensureMemberExpirationAlert(memberId) {
        if (!memberId) return;
        try {
            const [rows] = await db.execute(
                `SELECT m.id, m.fecha_fin AS fechaFin, DATEDIFF(m.fecha_fin, CURDATE()) AS diasRestantes,
                        p.nombre AS planNombre
                 FROM membresias m
                 INNER JOIN planes_membresia p ON p.id = m.plan_id
                 WHERE m.usuario_id = ? AND m.estado = 'activo'
                 ORDER BY m.id DESC
                 LIMIT 1`,
                [memberId],
            );
            const m = rows[0];
            if (!m) return;

            const dias = Number(m.diasRestantes);
            if (dias <= 5 && dias >= 0) {
                const msg =
                    dias === 0
                        ? `Tu plan ${m.planNombre} vence hoy. Renueva a tiempo para mantener tu acceso y racha.`
                        : `Tu plan ${m.planNombre} vence en ${dias} ${dias === 1 ? "día" : "días"}. Puedes enviar tu solicitud de renovación desde Mi membresía.`;
                await this.createUnique({
                    usuarioId: memberId,
                    rolDestino: "cliente",
                    tipo: "vencimiento",
                    titulo: "Tu membresía está por vencer",
                    mensaje: msg,
                    enlace: "/app/mi-membresia",
                    referenciaId: m.id,
                });
            }
        } catch (err) {
            console.error("Error verificando alerta de vencimiento:", err.message);
        }
    }

    static buildAccessConditions(auth) {
        const canSeeAdminSocios = auth.rol === "admin" || Boolean(auth.permissions?.includes("socios"));
        const canSeeAdminRewards = auth.rol === "admin" || Boolean(auth.permissions?.includes("recompensas"));
        const memberId =
            auth.rol === "cliente"
                ? Number(auth.id)
                : auth.memberLink?.activo
                    ? Number(auth.memberLink.id)
                    : null;

        const clauses = [];
        const params = [];

        if (canSeeAdminSocios && canSeeAdminRewards) {
            clauses.push("(n.rol_destino = 'admin')");
        } else if (canSeeAdminSocios) {
            clauses.push("(n.rol_destino = 'admin' AND n.tipo <> 'recompensa')");
        } else if (canSeeAdminRewards) {
            clauses.push("(n.rol_destino = 'admin' AND n.tipo = 'recompensa')");
        }

        if (memberId) {
            clauses.push("(n.rol_destino = 'cliente' AND (n.usuario_id IS NULL OR n.usuario_id = ?))");
            params.push(memberId);
        }

        return { clauses, params, memberId };
    }

    static async getForAuth(auth, limit = 30) {
        const { clauses, params, memberId } = this.buildAccessConditions(auth);
        if (memberId) {
            await this.ensureMemberExpirationAlert(memberId);
        }

        if (clauses.length === 0) {
            return { notifications: [], unreadCount: 0 };
        }

        const safeLimit = Math.max(1, Math.min(50, Number(limit) || 30));
        const whereSql = clauses.join(" OR ");

        const [rows] = await db.execute(
            `SELECT
                n.id,
                n.usuario_id AS usuarioId,
                n.rol_destino AS rolDestino,
                n.tipo,
                n.titulo,
                n.mensaje,
                n.enlace,
                n.referencia_id AS referenciaId,
                n.creado_en AS creadoEn,
                IF(nl.notificacion_id IS NOT NULL, 1, 0) AS leida
             FROM notificaciones n
             LEFT JOIN notificaciones_leidas nl
               ON nl.notificacion_id = n.id AND nl.usuario_id = ?
             WHERE (${whereSql})
             ORDER BY n.creado_en DESC, n.id DESC
             LIMIT ${safeLimit}`,
            [auth.id, ...params],
        );

        const notifications = rows.map((row) => ({
            ...row,
            leida: Boolean(row.leida),
        }));

        const unreadCount = notifications.filter((n) => !n.leida).length;
        return { notifications, unreadCount };
    }

    static async markAsRead(authUserId, notificationId) {
        await db.execute(
            `INSERT IGNORE INTO notificaciones_leidas (notificacion_id, usuario_id) VALUES (?, ?)`,
            [notificationId, authUserId],
        );
        return true;
    }

    static async markAllAsRead(auth) {
        const { clauses, params } = this.buildAccessConditions(auth);
        if (clauses.length === 0) return true;
        const whereSql = clauses.join(" OR ");
        await db.execute(
            `INSERT IGNORE INTO notificaciones_leidas (notificacion_id, usuario_id)
             SELECT n.id, ?
             FROM notificaciones n
             WHERE (${whereSql})`,
            [auth.id, ...params],
        );
        return true;
    }
}

module.exports = NotificationService;
