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
}

module.exports = AttendanceController;
