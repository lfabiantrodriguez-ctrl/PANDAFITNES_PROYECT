const AttendanceModel = require("../models/AttendanceModel");

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
