const NotificationService = require("../services/notificationService");

class NotificationController {
    static async getMyNotifications(req, res) {
        try {
            const data = await NotificationService.getForAuth(req.auth, req.query.limit);
            return res.json(data);
        } catch (error) {
            console.error("Error obteniendo notificaciones:", error);
            return res.status(500).json({ message: "Error al consultar notificaciones" });
        }
    }

    static async markAsRead(req, res) {
        try {
            const id = Number(req.params.id);
            if (!id) {
                return res.status(400).json({ message: "ID de notificación inválido" });
            }
            await NotificationService.markAsRead(req.auth.id, id);
            return res.json({ ok: true });
        } catch (error) {
            console.error("Error marcando notificación como leída:", error);
            return res.status(500).json({ message: "Error al actualizar notificación" });
        }
    }

    static async markAllAsRead(req, res) {
        try {
            await NotificationService.markAllAsRead(req.auth);
            return res.json({ ok: true });
        } catch (error) {
            console.error("Error marcando todas las notificaciones:", error);
            return res.status(500).json({ message: "Error al actualizar notificaciones" });
        }
    }
}

module.exports = NotificationController;
