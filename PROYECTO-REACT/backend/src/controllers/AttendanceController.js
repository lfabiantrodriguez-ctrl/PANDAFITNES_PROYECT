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
            const userId = req.auth.id;
            const asistencias = await AttendanceModel.getByUser(userId);
            const goals = await AttendanceModel.getUserGoals(userId);
            const redemptions = await AttendanceModel.getUserRedemptions(userId);

            const total = asistencias.length;
            // Base demo XP for exciting experience if new user
            const baseBonusXp = total === 0 ? 850 : 0;
            const xp = (total * 25) + baseBonusXp;
            const bambusGanados = (total * 10) + (total === 0 ? 340 : 0);
            const canjeados = (goals.bambusCanjeados || 0) + (total === 0 ? 100 : 0);
            const bambusDisponibles = Math.max(0, bambusGanados - canjeados);

            // Level & Stage calculation (Configuración de umbrales del sistema)
            // 01 · PANDA BEBÉ: 0 a 299 XP (Niveles 1-2)
            // 02 · PANDA INTERMEDIO: 300 a 999 XP (Niveles 3-4)
            // 03 · PANDA MUSCULOSO: 1000+ XP (Nivel 5+)
            let nivel = 1;
            let etapa = "01 · PANDA BEBÉ";
            let etapaKey = "bebe";
            let nextNivelXp = 100;
            let currentLevelBaseXp = 0;
            let modelUrl = "/models/panda_bebe.glb";

            if (xp >= 1000) {
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
            }

            // Streak & muscle shape (active training streak = muscular; long pause = gordito)
            const racha = total > 0 ? Math.min(7, total) : 3;
            const estadoFisico = racha >= 3 ? "musculoso" : (racha >= 1 ? "activo" : "gordito");

            return res.json({
                xp,
                nivel,
                etapa,
                etapaKey,
                modelUrl,
                estadoFisico,
                racha,
                currentLevelBaseXp,
                nextNivelXp,
                xpEnNivel: Math.max(0, xp - currentLevelBaseXp),
                xpFaltante: Math.max(0, nextNivelXp - xp),
                visitasParaSiguiente: Math.max(1, Math.ceil((nextNivelXp - xp) / 25)),
                bambusGanados,
                bambusCanjeados: canjeados,
                bambusDisponibles,
                redemptions,
                goals,
            });
        } catch (error) {
            console.error("Error obteniendo estado de Mi Pandita:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async redeemReward(req, res) {
        try {
            const userId = req.auth.id;
            const { recompensaNombre, costoBambus } = req.body;

            if (!recompensaNombre || !costoBambus || costoBambus <= 0) {
                return res.status(400).json({ message: "Datos de recompensa inválidos" });
            }

            const asistencias = await AttendanceModel.getByUser(userId);
            const goals = await AttendanceModel.getUserGoals(userId);

            const total = asistencias.length;
            const bambusGanados = (total * 10) + (total === 0 ? 340 : 0);
            const canjeados = (goals.bambusCanjeados || 0) + (total === 0 ? 100 : 0);
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
                message: `¡Canje exitoso! Has obtenido "${recompensaNombre}". Muestra tu confirmación en recepción.`,
                bambusRestantes: bambusDisponibles - costoBambus,
            });
        } catch (error) {
            console.error("Error canjeando recompensa:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = AttendanceController;
