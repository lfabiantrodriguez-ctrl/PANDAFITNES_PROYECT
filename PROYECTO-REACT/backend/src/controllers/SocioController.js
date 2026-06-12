const SocioModel = require("../models/SocioModel");
const { isValidDni, toDateOnly } = require("../utils/helpers");

class SocioController {
    static async getSocios(req, res) {
        try {
            const socios = await SocioModel.getAll();
            return res.json({ socios });
        } catch (error) {
            console.error("Error listando socios:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async createSocio(req, res) {
        try {
            const {
                dni,
                nombre,
                apellido,
                email,
                telefono,
                planId,
                fechaInicio,
                metodoPago = "efectivo",
            } = req.body;

            const cleanDni = String(dni || "").trim();
            const cleanEmail = String(email || "").trim().toLowerCase();
            const cleanName = String(nombre || "").trim();
            const cleanLastName = String(apellido || "").trim();
            const cleanPhone = telefono ? String(telefono).trim() : null;
            const startDate = fechaInicio || toDateOnly(new Date());

            if (!isValidDni(cleanDni)) {
                return res.status(400).json({ message: "El DNI debe tener 8 digitos" });
            }

            if (!cleanName || !cleanLastName || !cleanEmail || !planId || !startDate) {
                return res.status(400).json({ message: "Complete los datos obligatorios del socio" });
            }

            const isDuplicate = await SocioModel.checkDuplicate(cleanDni, cleanEmail);

            if (isDuplicate) {
                return res.status(409).json({ message: "Ya existe un usuario con ese DNI o email" });
            }

            const socio = await SocioModel.create({
                dni: cleanDni,
                nombre: cleanName,
                apellido: cleanLastName,
                email: cleanEmail,
                telefono: cleanPhone,
                planId,
                fechaInicio: startDate,
                metodoPago,
            });

            return res.status(201).json({
                message: "Socio creado correctamente",
                socio,
            });
        } catch (error) {
            console.error("Error creando socio:", error);
            if (error.message.includes("No existe el rol cliente") || error.message.includes("El plan seleccionado no existe")) {
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = SocioController;
