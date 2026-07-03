const UserModel = require("../models/UserModel");
const { publicUser, verifyPassword, signToken } = require("../utils/helpers");
const { sendEmail } = require("../utils/email");
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

            const userRow = await UserModel.findActiveById(userId);
            if (!userRow) return res.status(404).json({ message: 'Usuario no encontrado' });

            const oldEmail = userRow.email;
            const emailChanged = oldEmail !== email;

            const updated = await UserModel.updateProfile(userId, { nombre, apellido, email, telefono: telefono || null });

            if (!updated) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            const updatedUser = await UserModel.findActiveById(userId);

            // Send email notification about profile update
            const profileHtml = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                    <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                        <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                    </div>
                    <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                        <h2 style="color:#111827;margin:0 0 16px;">Perfil Actualizado</h2>
                        <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${nombre} ${apellido}</strong>, tus datos de perfil han sido actualizados exitosamente.</p>
                        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                            <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Nombres:</td><td style="padding:8px 0;color:#111827;">${nombre}</td></tr>
                            <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Apellidos:</td><td style="padding:8px 0;color:#111827;">${apellido}</td></tr>
                            <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Correo:</td><td style="padding:8px 0;color:#111827;">${email}</td></tr>
                            <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Teléfono:</td><td style="padding:8px 0;color:#111827;">${telefono || 'No registrado'}</td></tr>
                        </table>
                        <p style="color:#4b5563;font-size:14px;">Si no realizaste esta acción, contacta con el administrador.</p>
                    </div>
                    <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
                        <p>Panda Fitness Gym © ${new Date().getFullYear()}</p>
                    </div>
                </div>
            `;

            if (emailChanged) {
                // Send to old email - notification about change
                await sendEmail({
                    to: oldEmail,
                    subject: "Tu correo electronico ha sido cambiado - Panda Fitness",
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                            <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                                <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                            </div>
                            <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                                <h2 style="color:#111827;margin:0 0 16px;">Correo Electronico Actualizado</h2>
                                <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${nombre} ${apellido}</strong>, te informamos que tu correo electronico ha sido cambiado exitosamente.</p>
                                <p style="color:#4b5563;font-size:15px;line-height:1.6;">Tu nuevo correo electronico es: <strong style="color:#0f766e;">${email}</strong></p>
                                <p style="color:#4b5563;font-size:14px;">A partir de ahora, utiliza tu nuevo correo para cualquier comunicacion relacionada con tu cuenta.</p>
                                <p style="color:#4b5563;font-size:14px;">Si no realizaste este cambio, contacta inmediatamente con el administrador.</p>
                            </div>
                            <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
                                <p>Panda Fitness Gym © ${new Date().getFullYear()}</p>
                            </div>
                        </div>
                    `,
                });

                // Send to new email - notification about change
                await sendEmail({
                    to: email,
                    subject: "Correo electronico actualizado correctamente - Panda Fitness",
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                            <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                                <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                            </div>
                            <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                                <h2 style="color:#111827;margin:0 0 16px;">Correo Electronico Actualizado</h2>
                                <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${nombre} ${apellido}</strong>, este correo es para confirmar que tu direccion de correo electronico ha sido actualizada exitosamente.</p>
                                <p style="color:#4b5563;font-size:15px;line-height:1.6;">A partir de ahora, todas las notificaciones de <strong>Panda Fitness</strong> seran enviadas a esta direccion.</p>
                                <p style="color:#4b5563;font-size:14px;">Gracias por mantener tus datos actualizados.</p>
                            </div>
                            <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
                                <p>Panda Fitness Gym © ${new Date().getFullYear()}</p>
                            </div>
                        </div>
                    `,
                });
            } else {
                await sendEmail({
                    to: email,
                    subject: "Perfil actualizado - Panda Fitness",
                    html: profileHtml,
                });
            }

            return res.json({ message: 'Perfil actualizado', user: publicUser(updatedUser) });
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

            // Send password change notification email
            await sendEmail({
                to: userRow.email,
                subject: "Contrasena actualizada - Panda Fitness",
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                        <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                            <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                        </div>
                        <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                            <h2 style="color:#111827;margin:0 0 16px;">Contrasena Actualizada</h2>
                            <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${userRow.nombre} ${userRow.apellido}</strong>, tu contrasena ha sido cambiada exitosamente.</p>
                            <p style="color:#4b5563;font-size:15px;line-height:1.6;">Si no realizaste esta accion, contacta inmediatamente con el administrador para recuperar tu cuenta.</p>
                        </div>
                        <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
                            <p>Panda Fitness Gym © ${new Date().getFullYear()}</p>
                        </div>
                    </div>
                `,
            });

            return res.json({ message: 'Contrasena actualizada correctamente' });
        } catch (error) {
            console.error('Error cambiando contrasena:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }
}

module.exports = AuthController;
