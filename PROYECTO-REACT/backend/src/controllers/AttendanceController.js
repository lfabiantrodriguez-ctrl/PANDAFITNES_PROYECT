const AttendanceModel = require("../models/AttendanceModel");
const UserModel = require("../models/UserModel");

class AttendanceController {
    static async getActiveClients(req, res) {
        try {
            const clients = await AttendanceModel.getActiveClients();
            return res.json({ clients });
        } catch (error) {
            console.error("Error consultando clientes activos:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async searchBySocio(req, res) {
        try {
            const query = String(req.query.search || "").trim();
            if (!query) {
                return res.status(400).json({ message: "Se requiere DNI o nombre del socio" });
            }

            let user = null;
            if (/^\d{8}$/.test(query)) {
                user = await UserModel.findActiveByDni(query);
            } else if (/^\d+$/.test(query)) {
                user = await UserModel.findActiveById(Number(query));
            } else {
                user = await UserModel.findActiveByName(query);
            }

            if (!user) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            const asistencias = await AttendanceModel.getByUser(user.id);
            return res.json({ user, asistencias });
        } catch (error) {
            console.error("Error buscando asistencias del socio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getUserAttendanceSummary(req, res) {
        try {
            const attendanceCount = await AttendanceModel.getAttendanceCountByUser(req.auth.id);
            return res.json({ attendanceCount });
        } catch (error) {
            console.error("Error consultando asistencia del usuario:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getMyAttendanceHistory(req, res) {
        try {
            const userId = req.auth.id;
            const asistencias = await AttendanceModel.getByUser(userId);
            const goals = await AttendanceModel.getUserGoals(userId);

            const totalAsistencias = asistencias.length;
            const xpTotal = totalAsistencias * 25;
            const bambusTotal = totalAsistencias * 10;
            const bambusDisponibles = Math.max(0, bambusTotal - (goals.bambusCanjeados || 0));

            return res.json({
                asistencias,
                totalAsistencias,
                goals,
                xpTotal,
                bambusTotal,
                bambusDisponibles,
            });
        } catch (error) {
            console.error("Error obteniendo historial de asistencias:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async updateMyGoals(req, res) {
        try {
            const userId = req.auth.id;
            const { diasObjetivo, horarioPreferido } = req.body;

            await AttendanceModel.updateUserGoals(userId, {
                diasObjetivo: diasObjetivo || [1, 2, 4, 5],
                horarioPreferido: horarioPreferido || "07:00 - 08:30",
            });

            const updatedGoals = await AttendanceModel.getUserGoals(userId);
            return res.json({
                message: "Objetivos de entrenamiento actualizados correctamente",
                goals: updatedGoals,
            });
        } catch (error) {
            console.error("Error actualizando objetivos de entrenamiento:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getPandaStatus(req, res) {
        try {
            const isAdmin = req.auth?.rol === "admin";
            let targetUserId = req.auth.id;

            if (isAdmin && req.query.userId) {
                targetUserId = Number(req.query.userId);
            }

            const targetUser = await UserModel.findActiveById(targetUserId);
            if (!targetUser) {
                return res.status(404).json({ message: "Usuario no encontrado" });
            }

            const asistencias = await AttendanceModel.getByUser(targetUserId);
            const goals = await AttendanceModel.getUserGoals(targetUserId);
            const redemptions = await AttendanceModel.getUserRedemptions(targetUserId);

            const total = asistencias.length;

            // Puntos XP reales: 100 XP por cada asistencia al club registrada
            const xp = total * 100;

            // Bambús acumulados reales: 10 bambús por asistencia
            const bambusGanados = total * 10;

            // Bambús canjeados reales desde canjes_recompensas y usuario
            const canjeados = redemptions
                .filter((r) => r.estado !== "cancelado")
                .reduce((sum, r) => sum + Number(r.costoBambus || 0), 0) || Number(goals.bambusCanjeados || 0);

            const bambusDisponibles = Math.max(0, bambusGanados - canjeados);

            // Nivel y Etapa según umbrales del sistema basados en XP real
            // 01 · PANDA BEBÉ: 0 a 299 XP (Nivel 1: 0-99 XP, Nivel 2: 100-299 XP)
            // 02 · PANDA INTERMEDIO: 300 a 999 XP (Nivel 3: 300-599 XP, Nivel 4: 600-999 XP)
            // 03 · PANDA MUSCULOSO: 1000+ XP (Nivel 5: 1000-1499 XP, Nivel 6+: 1500+ XP)
            let nivel = 1;
            let etapa = "01 · PANDA BEBÉ";
            let etapaKey = "bebe";
            let nextNivelXp = 100;
            let currentLevelBaseXp = 0;
            let modelUrl = "/models/panda_bebe.glb";

            if (xp >= 1500) {
                nivel = 6;
                etapa = "03 · PANDA MUSCULOSO";
                etapaKey = "musculoso";
                nextNivelXp = 2000;
                currentLevelBaseXp = 1500;
                modelUrl = "/models/panda_musculoso.glb";
            } else if (xp >= 1000) {
                nivel = 5;
                etapa = "03 · PANDA MUSCULOSO";
                etapaKey = "musculoso";
                nextNivelXp = 1500;
                currentLevelBaseXp = 1000;
                modelUrl = "/models/panda_musculoso.glb";
            } else if (xp >= 600) {
                nivel = 4;
                etapa = "02 · PANDA INTERMEDIO";
                etapaKey = "intermedio";
                nextNivelXp = 1000;
                currentLevelBaseXp = 600;
                modelUrl = "/models/panda_intermedio.glb";
            } else if (xp >= 300) {
                nivel = 3;
                etapa = "02 · PANDA INTERMEDIO";
                etapaKey = "intermedio";
                nextNivelXp = 600;
                currentLevelBaseXp = 300;
                modelUrl = "/models/panda_intermedio.glb";
            } else if (xp >= 100) {
                nivel = 2;
                etapa = "01 · PANDA BEBÉ";
                etapaKey = "bebe";
                nextNivelXp = 300;
                currentLevelBaseXp = 100;
                modelUrl = "/models/panda_bebe.glb";
            } else {
                nivel = 1;
                etapa = "01 · PANDA BEBÉ";
                etapaKey = "bebe";
                nextNivelXp = 100;
                currentLevelBaseXp = 0;
                modelUrl = "/models/panda_bebe.glb";
            }

            // Agrupar fechas de asistencias en horario local (UTC-5 Lima/Bogotá)
            const attendanceDates = new Set();
            for (const a of asistencias) {
                if (!a.horaEntrada) continue;
                const d = new Date(a.horaEntrada);
                const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
                const local = new Date(utc - (5 * 3600000));
                const y = local.getFullYear();
                const m = String(local.getMonth() + 1).padStart(2, "0");
                const day = String(local.getDate()).padStart(2, "0");
                attendanceDates.add(`${y}-${m}-${day}`);
            }

            const now = new Date();
            const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
            const localNow = new Date(utcNow - (5 * 3600000));

            const formatLocal = (dt) => {
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, "0");
                const day = String(dt.getDate()).padStart(2, "0");
                return `${y}-${m}-${day}`;
            };

            const todayStr = formatLocal(localNow);
            const yesterdayDt = new Date(localNow);
            yesterdayDt.setDate(yesterdayDt.getDate() - 1);
            const yesterdayStr = formatLocal(yesterdayDt);

            const hasCheckedInToday = attendanceDates.has(todayStr);

            // Racha real: días consecutivos entrenando que finalizan hoy o ayer
            let racha = 0;
            let checkDt = null;

            if (attendanceDates.has(todayStr)) {
                checkDt = new Date(localNow);
            } else if (attendanceDates.has(yesterdayStr)) {
                checkDt = new Date(yesterdayDt);
            }

            if (checkDt) {
                while (true) {
                    const str = formatLocal(checkDt);
                    if (attendanceDates.has(str)) {
                        racha++;
                        checkDt.setDate(checkDt.getDate() - 1);
                    } else {
                        break;
                    }
                }
            }

            // Asistencias registradas en el mes calendario actual
            const currentMonthPrefix = todayStr.substring(0, 7);
            const asistenciasMes = Array.from(attendanceDates).filter((d) => d.startsWith(currentMonthPrefix)).length;

            // Estado físico según racha y actividad
            const estadoFisico = racha >= 3 ? "musculoso" : (racha >= 1 ? "activo" : "gordito");

            // Información del check-in de hoy (si existe)
            const todayCheckIn = asistencias.find((a) => {
                if (!a.horaEntrada) return false;
                const d = new Date(a.horaEntrada);
                const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
                const local = new Date(utc - (5 * 3600000));
                return formatLocal(local) === todayStr;
            });

            // Catálogo real de recompensas activas
            const dbInstance = require("../config/database");
            const [catalogo] = await dbInstance.execute(
                `SELECT id, nombre, descripcion, costo_bambus AS costoBambus, categoria, imagen_url AS imagenUrl, stock
                 FROM recompensas_catalogo
                 WHERE activo = 1
                 ORDER BY destacado DESC, costo_bambus ASC`,
            );

            // Lista de socios reales para el selector del administrador
            let sociosList = [];
            if (isAdmin) {
                const [sociosRows] = await dbInstance.execute(
                    `SELECT u.id, u.nombre, u.apellido, u.dni, COUNT(a.id) as totalAsistencias
                     FROM usuarios u
                     LEFT JOIN asistencias a ON a.usuario_id = u.id
                     WHERE u.activo = 1 AND u.rol_id = 2
                     GROUP BY u.id
                     ORDER BY totalAsistencias DESC, u.nombre ASC`,
                );
                sociosList = sociosRows;
            }

            return res.json({
                user: {
                    id: targetUser.id,
                    nombre: targetUser.nombre,
                    apellido: targetUser.apellido,
                    dni: targetUser.dni,
                },
                xp,
                nivel,
                etapa,
                etapaKey,
                modelUrl,
                estadoFisico,
                racha,
                asistenciasMes,
                totalAsistencias: total,
                currentLevelBaseXp,
                nextNivelXp,
                xpEnNivel: Math.max(0, xp - currentLevelBaseXp),
                xpFaltante: Math.max(0, nextNivelXp - xp),
                visitasParaSiguiente: Math.max(1, Math.ceil((nextNivelXp - xp) / 100)),
                bambusGanados,
                bambusCanjeados: canjeados,
                bambusDisponibles,
                hasCheckedInToday,
                todayCheckIn: todayCheckIn
                    ? {
                        id: todayCheckIn.id,
                        horaEntrada: todayCheckIn.horaEntrada,
                        horaSalida: todayCheckIn.horaSalida,
                        metodoRegistro: todayCheckIn.metodoRegistro,
                    }
                    : null,
                asistenciasFechas: Array.from(attendanceDates),
                historialAsistencias: asistencias.slice(0, 30),
                redemptions,
                catalogoRecompensas: catalogo,
                goals,
                sociosList,
            });
        } catch (error) {
            console.error("Error obteniendo estado de Mi Pandita:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async registerSelfCheckIn(req, res) {
        try {
            const isAdmin = req.auth?.rol === "admin";
            const targetUserId = (isAdmin && req.body.userId) ? Number(req.body.userId) : req.auth.id;

            const user = await UserModel.findActiveById(targetUserId);
            if (!user) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            const asistencias = await AttendanceModel.getByUser(targetUserId);
            const now = new Date();
            const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
            const localNow = new Date(utcNow - (5 * 3600000));
            const y = localNow.getFullYear();
            const m = String(localNow.getMonth() + 1).padStart(2, "0");
            const day = String(localNow.getDate()).padStart(2, "0");
            const todayStr = `${y}-${m}-${day}`;

            const formatLocal = (dt) => {
                const fy = dt.getFullYear();
                const fm = String(dt.getMonth() + 1).padStart(2, "0");
                const fday = String(dt.getDate()).padStart(2, "0");
                return `${fy}-${fm}-${fday}`;
            };

            const alreadyToday = asistencias.find((a) => {
                if (!a.horaEntrada) return false;
                const d = new Date(a.horaEntrada);
                const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
                const local = new Date(utc - (5 * 3600000));
                return formatLocal(local) === todayStr;
            });

            if (alreadyToday) {
                return res.status(400).json({
                    message: "Ya registraste tu asistencia para el día de hoy.",
                    asistencia: alreadyToday,
                });
            }

            const attendance = await AttendanceModel.create({
                reservaId: null,
                usuarioId: targetUserId,
                horaEntrada: now,
                metodoRegistro: "app",
            });

            return res.json({
                message: "¡Asistencia registrada exitosamente! +100 XP y +10 bambús otorgados.",
                attendance,
            });
        } catch (error) {
            console.error("Error registrando asistencia:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async redeemReward(req, res) {
        try {
            const isAdmin = req.auth?.rol === "admin";
            const userId = (isAdmin && req.body.userId) ? Number(req.body.userId) : req.auth.id;
            const { recompensaNombre, costoBambus } = req.body;

            if (!recompensaNombre || !costoBambus || costoBambus <= 0) {
                return res.status(400).json({ message: "Datos de recompensa inválidos" });
            }

            const asistencias = await AttendanceModel.getByUser(userId);
            const goals = await AttendanceModel.getUserGoals(userId);
            const redemptions = await AttendanceModel.getUserRedemptions(userId);

            const total = asistencias.length;
            const bambusGanados = total * 10;
            const canjeados = redemptions
                .filter((r) => r.estado !== "cancelado")
                .reduce((sum, r) => sum + Number(r.costoBambus || 0), 0) || Number(goals.bambusCanjeados || 0);
            const bambusDisponibles = Math.max(0, bambusGanados - canjeados);

            if (bambusDisponibles < costoBambus) {
                return res.status(400).json({
                    message: `No tienes suficientes bambús. Tienes ${bambusDisponibles} y se requieren ${costoBambus}.`,
                });
            }

            await AttendanceModel.redeemReward(userId, {
                recompensaNombre,
                costoBambus,
            });

            return res.json({
                message: `¡Canje exitoso! Has canjeado "${recompensaNombre}". Presenta tu confirmación en recepción.`,
                bambusRestantes: bambusDisponibles - costoBambus,
            });
        } catch (error) {
            console.error("Error canjeando recompensa:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = AttendanceController;
