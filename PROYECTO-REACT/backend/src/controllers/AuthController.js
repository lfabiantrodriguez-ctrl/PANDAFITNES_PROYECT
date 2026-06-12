const UserModel = require("../models/UserModel");
const { publicUser, verifyPassword, signToken } = require("../utils/helpers");

class AuthController {
    static async login(req, res) {
        try {
            const { dni, password } = req.body;

            if (!dni || !password) {
                return res.status(400).json({ message: "DNI y contrasena son requeridos" });
            }

            const userRow = await UserModel.findActiveByDni(String(dni).trim());

            if (!userRow) {
                return res.status(401).json({ message: "Credenciales invalidas" });
            }

            const validPassword = await verifyPassword(String(password), userRow.password_hash);

            if (!validPassword) {
                return res.status(401).json({ message: "Credenciales invalidas" });
            }

            const user = publicUser(userRow);

            return res.json({
                token: signToken(user),
                user,
            });
        } catch (error) {
            console.error("Error en login:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getMe(req, res) {
        try {
            const userRow = await UserModel.findActiveById(req.auth.id);

            if (!userRow) {
                return res.status(401).json({ message: "Usuario no disponible" });
            }

            return res.json({ user: publicUser(userRow) });
        } catch (error) {
            console.error("Error obteniendo perfil:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = AuthController;
