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

    static async updatePlan(req, res) {
        try {
            const id = Number(req.params.id);
            const { nombre, duracionDias, precio, descripcion, limiteSemanal, totalReservas } = req.body || {};

            if (!id || id < 1) {
                return res.status(400).json({ message: "Plan inválido" });
            }
            if (!nombre || !String(nombre).trim()) {
                return res.status(400).json({ message: "El nombre del plan es obligatorio" });
            }
            const parsedDays = Number(duracionDias);
            const parsedPrice = Number(precio);
            if (!Number.isFinite(parsedDays) || parsedDays < 1) {
                return res.status(400).json({ message: "La duración en días debe ser mayor a 0" });
            }
            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ message: "El precio del plan no es válido" });
            }

            const existing = await PlanModel.findById(id);
            if (!existing) {
                return res.status(404).json({ message: "Plan no encontrado" });
            }

            await PlanModel.update(id, {
                nombre,
                duracionDias: parsedDays,
                precio: parsedPrice,
                descripcion: descripcion ?? existing.descripcion,
                limiteSemanal: limiteSemanal !== undefined ? limiteSemanal : existing.limiteSemanal,
                totalReservas: totalReservas !== undefined ? totalReservas : existing.totalReservas,
            });

            const planes = await PlanModel.getAll();
            return res.json({ message: "Plan actualizado correctamente", planes });
        } catch (error) {
            console.error("Error actualizando plan:", error);
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ message: "Ya existe otro plan con ese nombre" });
            }
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = PlanController;
