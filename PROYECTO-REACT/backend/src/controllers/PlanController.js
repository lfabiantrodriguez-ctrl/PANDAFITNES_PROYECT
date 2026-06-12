const PlanModel = require("../models/PlanModel");

class PlanController {
    static async getPlanes(req, res) {
        try {
            const planes = await PlanModel.getAll();
            return res.json({ planes });
        } catch (error) {
            console.error("Error listando planes:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = PlanController;
