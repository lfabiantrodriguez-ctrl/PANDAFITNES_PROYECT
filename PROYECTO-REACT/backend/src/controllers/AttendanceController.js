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

    static async getTodayAttendances(req, res) {
        try {
            const records = await AttendanceModel.getTodayRecords();
            const summary = {
                enSala: records.filter((r) => r.estado === "en_sala").length,
                salieron: records.filter((r) => r.estado === "finalizada").length,
                noMarcaronSalida: records.filter((r) => r.estado === "no_marco_salida").length,
                totalHoy: records.length,
            };
            return res.json({ records, summary });
        } catch (error) {
            console.error("Error consultando asistencias de hoy:", error);
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
            const attendanceCount = await AttendanceModel.getAttendanceCountByUser(req.memberId);
            return res.json({ attendanceCount });
        } catch (error) {
            console.error("Error consultando asistencia del usuario:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getMyAttendanceHistory(req, res) {
        try {
            const data = await require('../services/pandaAccount')(req.memberId);
            return res.json({...data, xpTotal:data.xp, bambusTotal:data.bambusGanados});
        } catch (error) {
            console.error("Error obteniendo historial de asistencias:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async updateMyGoals(req, res) {
        try {
            const userId = req.memberId;
            const { diasObjetivo, horarioPreferido } = req.body;
            if (!Array.isArray(diasObjetivo) || !diasObjetivo.length || diasObjetivo.some(n=>!Number.isInteger(n) || n<1 || n>7))
                return res.status(400).json({message:'Selecciona al menos un día válido de entrenamiento.'});

            await AttendanceModel.updateUserGoals(userId, {
                diasObjetivo: [...new Set(diasObjetivo)],
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
            return res.json(await require('../services/pandaAccount')(req.memberId));
        } catch (error) {
            console.error("Error obteniendo estado de Mi Pandita:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async redeemReward(req, res) {
        try {
            const result = await AttendanceModel.redeemReward(req.memberId, {recompensaId:req.body.recompensaId});
            return res.json({...result, message:'Canje registrado. Presenta tu código en recepción.'});
        } catch (error) {
            console.error("Error canjeando recompensa:", error);
            return res.status(400).json({ message: error.message || "No se pudo canjear" });
        }
    }

    static async updateAttendanceRules(req, res) {
        try {
            const { baseXp, baseBambus, xpBonuses } = req.body || {};
            if (baseXp !== undefined && (!Number.isFinite(Number(baseXp)) || Number(baseXp) < 1)) {
                return res.status(400).json({ message: "La experiencia base (XP) debe ser al menos 1." });
            }
            if (baseBambus !== undefined && (!Number.isFinite(Number(baseBambus)) || Number(baseBambus) < 0)) {
                return res.status(400).json({ message: "Los bambús base deben ser 0 o más." });
            }
            const saved = await AttendanceModel.saveAttendanceRules({ baseXp, baseBambus, xpBonuses });
            return res.json({
                message: "Reglas de puntos actualizadas correctamente.",
                ...saved,
            });
        } catch (error) {
            console.error("Error actualizando reglas de puntos:", error);
            return res.status(500).json({ message: "No se pudieron guardar las reglas de puntos." });
        }
    }
}

module.exports = AttendanceController;
