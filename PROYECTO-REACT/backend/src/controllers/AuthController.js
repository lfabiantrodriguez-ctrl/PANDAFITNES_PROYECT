const UserModel = require("../models/UserModel");
const { publicUser, verifyPassword, signToken } = require("../utils/helpers");
const bcrypt = require("bcrypt");

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

    static async updateMe(req, res) {
        try {
            const userId = req.auth.id;
            const { nombre, apellido, email, telefono } = req.body;

            if (!nombre || !apellido || !email) {
                return res.status(400).json({ message: 'Complete los datos obligatorios' });
            }

            const updated = await UserModel.updateProfile(userId, { nombre, apellido, email, telefono: telefono || null });

            if (!updated) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            const userRow = await UserModel.findActiveById(userId);

            return res.json({ message: 'Perfil actualizado', user: publicUser(userRow) });
        } catch (error) {
            console.error('Error actualizando perfil:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    static async changePassword(req, res) {
        try {
            const userId = req.auth.id;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ message: 'Contrasenas requeridas' });
            }

            const userRow = await UserModel.findActiveById(userId);
            if (!userRow) return res.status(404).json({ message: 'Usuario no encontrado' });

            const valid = await verifyPassword(currentPassword, userRow.password_hash);
            if (!valid) return res.status(401).json({ message: 'Contrasena actual incorrecta' });

            const hash = await bcrypt.hash(String(newPassword), 10);
            await UserModel.updatePasswordHash(userId, hash);

            return res.json({ message: 'Contrasena actualizada correctamente' });
        } catch (error) {
            console.error('Error cambiando contrasena:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }
}

module.exports = AuthController;
