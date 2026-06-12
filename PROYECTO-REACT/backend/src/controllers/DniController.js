const DniService = require("../services/DniService");
const { isValidDni, normalizeDniResponse } = require("../utils/helpers");

class DniController {
    static async lookupDni(req, res) {
        try {
            const dni = String(req.params.dni || "").trim();

            if (!isValidDni(dni)) {
                return res.status(400).json({ message: "El DNI debe tener 8 digitos" });
            }

            const lookupResult = await DniService.lookup(dni);

            if (!lookupResult.ok) {
                return res.status(lookupResult.status).json({ message: "No se pudo consultar el DNI" });
            }

            const normalized = normalizeDniResponse(lookupResult.text, dni);

            if (!normalized) {
                return res.status(502).json({ message: "La respuesta de ConsultaDatos no tiene nombres y apellidos reconocibles" });
            }

            return res.json(normalized);
        } catch (error) {
            console.error("Error consultando DNI:", error);
            if (error.message.includes("CONSULTADATOS_TOKEN")) {
                return res.status(503).json({ message: error.message });
            }
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = DniController;
