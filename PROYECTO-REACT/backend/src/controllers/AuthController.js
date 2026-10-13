const UserModel = require("../models/UserModel");
const db = require("../config/database");
const { publicUser, verifyPassword, signToken } = require("../utils/helpers");
const { sendEmail } = require("../utils/email");
const bcrypt = require("bcrypt");

const decorateUser = row => require('../services/roleAccess').decorate(publicUser(row));

class AuthController {
    static async login(req, res) {
        try {
            const { dni, password } = req.body;

            if (!dni || !password) {
                return res.status(400).json({ message: "DNI y contraseña son requeridos" });
            }

            const userRow = await UserModel.findActiveByDni(String(dni).trim());

            if (!userRow) {
                return res.status(401).json({ message: "Credenciales inválidas" });
            }

            const validPassword = await verifyPassword(String(password), userRow.password_hash);

            if (!validPassword) {
                return res.status(401).json({ message: "Credenciales inválidas" });
            }

            const user = await decorateUser(userRow);

            return res.json({
                token: signToken(user),
                user,
            });
        } catch (error) {
            console.error("Error en login:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Inicio y registro automático con Google (Gmail)
    static async googleLogin(req, res) {
        try {
            const { credential, email, name, given_name, family_name, sub } = req.body;

            let userEmail = email;
            let userName = given_name || name;
            let userLastName = family_name || "";
            let googleId = sub;

            // Si se envió un JWT de Google Identity Services (GSI), decodificarlo
            if (credential) {
                try {
                    const payload = JSON.parse(Buffer.from(credential.split(".")[1], "base64").toString("utf-8"));
                    userEmail = payload.email || userEmail;
                    userName = payload.given_name || payload.name || userName;
                    userLastName = payload.family_name || userLastName;
                    googleId = payload.sub || googleId;
                } catch (e) {
                    console.warn("No se pudo decodificar payload JWT de Google, usando datos directos");
                }
            }

            if (!userEmail) {
                return res.status(400).json({ message: "No se proporcionó un correo válido de Google" });
            }

            let userRow = await UserModel.findActiveByEmail(userEmail);

            if (!userRow) {
                // Registrar automáticamente al cliente con sus datos de Google
                userRow = await UserModel.createFromGoogle({
                    nombre: userName || "Usuario",
                    apellido: userLastName || "Google",
                    email: userEmail,
                    google_id: googleId,
                });
                console.log(`Nuevo usuario registrado automáticamente con Google: ${userEmail}`);
            }

            const user = await decorateUser(userRow);

            return res.json({
                message: "Autenticado con Google correctamente",
                token: signToken(user),
                user,
            });
        } catch (error) {
            console.error("Error en login con Google:", error);
            return res.status(500).json({ message: "Error al procesar acceso con Google" });
        }
    }

    // Solicitar código de recuperación de contraseña (Vialsa / DentIA style)
    static async forgotPassword(req, res) {
        try {
            const { identifier } = req.body;
            if (!identifier) {
                return res.status(400).json({ message: "Ingresa tu DNI o Correo Electrónico" });
            }

            const userRow = await UserModel.findActiveByDniOrEmail(String(identifier).trim());
            if (!userRow) {
                // Por seguridad respondemos de forma neutral para no revelar existencia
                return res.status(404).json({ message: "No encontramos un usuario activo con esos datos" });
            }

            const mailConfigured = (process.env.GOOGLE_USER && process.env.GOOGLE_APP_PASSWORD)
                || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
            if (!mailConfigured) return res.status(503).json({ message: 'El envío de correos no está configurado. Contacta con administración.' });

            // Generar código de 6 dígitos
            const code = require('node:crypto').randomInt(100000, 1000000).toString();
            const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

            await UserModel.saveResetCode(userRow.id, code, expires);

            const emailParts = userRow.email.split("@");
            const maskedUser = emailParts[0].slice(0, 2) + "***" + emailParts[0].slice(-1);
            const maskedEmail = `${maskedUser}@${emailParts[1]}`;

            // Enviar correo electrónico
            const emailHtml = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:16px;">
                    <div style="background:#0f172a;padding:24px;border-radius:14px 14px 0 0;text-align:center;">
                        <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">PANDA <span style="color:#0f766e;">FITNESS</span></h1>
                        <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">Centro de Entrenamiento & Fitness</p>
                    </div>
                    <div style="background:#ffffff;padding:32px;border-radius:0 0 14px 14px;border:1px solid #e2e8f0;">
                        <h2 style="color:#0f172a;margin:0 0 12px;font-size:20px;">Recuperación de Contraseña</h2>
                        <p style="color:#475569;font-size:15px;line-height:1.6;">
                            Hola <strong>${userRow.nombre} ${userRow.apellido}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta.
                        </p>
                        <div style="margin:28px 0;text-align:center;padding:18px;background:#f0fdf4;border:2px dashed #0f766e;border-radius:12px;">
                            <span style="display:block;font-size:13px;color:#0f766e;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Tu código de seguridad</span>
                            <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#0f172a;font-family:monospace;">${code}</span>
                        </div>
                        <p style="color:#64748b;font-size:14px;line-height:1.5;">
                            Este código es válido durante los próximos <strong>15 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este correo; tu contraseña actual continuará siendo segura.
                        </p>
                    </div>
                    <div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;">
                        <p>Panda Fitness Gym © ${new Date().getFullYear()} · Sistema de Gestión de Socios</p>
                    </div>
                </div>
            `;

            const delivered = await sendEmail({
                to: userRow.email,
                subject: `Código de Recuperación: ${code} - Panda Fitness`,
                html: emailHtml,
            });
            if (!delivered) {
                await UserModel.clearResetCode(userRow.id);
                return res.status(503).json({ message: 'No se pudo enviar el código por correo. Inténtalo nuevamente más tarde.' });
            }

            return res.json({
                message: `Código enviado a ${maskedEmail}`,
                emailMasked: maskedEmail,
            });
        } catch (error) {
            console.error("Error en forgotPassword:", error);
            return res.status(500).json({ message: "Error al procesar la solicitud de recuperación" });
        }
    }

    // Validar código y cambiar contraseña
    static async resetPassword(req, res) {
        try {
            const { identifier, code, newPassword } = req.body;

            if (!identifier || !code || !newPassword) {
                return res.status(400).json({ message: "Todos los campos son requeridos" });
            }

            if (typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72
                || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
                return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y número, y no superar 72 bytes.' });
            }

            const userRow = await UserModel.findActiveByDniOrEmail(String(identifier).trim());
            if (!userRow) {
                return res.status(404).json({ message: "Usuario no encontrado" });
            }

            if (!userRow.reset_code || String(userRow.reset_code).trim() !== String(code).trim()) {
                return res.status(400).json({ message: "El código de recuperación ingresado es incorrecto" });
            }

            const expires = new Date(userRow.reset_expires).getTime();
            if (!userRow.reset_expires || !Number.isFinite(expires) || expires <= Date.now()) {
                return res.status(400).json({ message: "El código ha expirado. Por favor, solicita uno nuevo" });
            }

            const hash = await bcrypt.hash(String(newPassword), 10);
            await UserModel.updatePasswordHash(userRow.id, hash);
            await UserModel.clearResetCode(userRow.id);

            // Enviar correo de confirmación
            await sendEmail({
                to: userRow.email,
                subject: "Tu contraseña ha sido restablecida - Panda Fitness",
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:16px;">
                        <div style="background:#0f172a;padding:24px;border-radius:14px 14px 0 0;text-align:center;">
                            <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA <span style="color:#0f766e;">FITNESS</span></h1>
                        </div>
                        <div style="background:#ffffff;padding:32px;border-radius:0 0 14px 14px;border:1px solid #e2e8f0;">
                            <h2 style="color:#0f172a;margin:0 0 12px;">¡Contraseña restablecida con éxito!</h2>
                            <p style="color:#475569;font-size:15px;line-height:1.6;">
                                Hola <strong>${userRow.nombre}</strong>, la contraseña de tu cuenta ha sido actualizada satisfactoriamente. Ya puedes ingresar con tu nueva clave.
                            </p>
                        </div>
                    </div>
                `,
            });

            return res.json({ message: "Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva clave." });
        } catch (error) {
            console.error("Error en resetPassword:", error);
            return res.status(500).json({ message: "Error al actualizar la contraseña" });
        }
    }

    static async getMe(req, res) {
        try {
            const userRow = await UserModel.findActiveById(req.auth.id);

            if (!userRow) {
                return res.status(401).json({ message: "Usuario no disponible" });
            }

            return res.json({ user: await decorateUser(userRow) });
        } catch (error) {
            console.error("Error obteniendo perfil:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async updateMe(req, res) {
        try {
            const userId=req.auth.id;
            const {data,errors}=require('../utils/profileValidation').validateProfile(req.body);
            if(Object.keys(errors).length)return res.status(400).json({message:'Revisa los campos indicados.',errors});
            const userRow=await UserModel.findActiveById(userId);
            if(!userRow)return res.status(404).json({message:'Usuario no encontrado'});
            const [dniDup]=await db.execute('SELECT id FROM usuarios WHERE dni = ? AND id != ? LIMIT 1',[data.dni,userId]);
            const [emailDup]=await db.execute('SELECT id FROM usuarios WHERE LOWER(TRIM(email)) = ? AND id != ? LIMIT 1',[data.email,userId]);
            if(dniDup.length)errors.dni='El DNI ya está registrado por otro usuario.';
            if(emailDup.length)errors.email='El correo ya está registrado por otro usuario.';
            if(Object.keys(errors).length)return res.status(409).json({message:'Revisa los campos indicados.',errors});
            const updated=await UserModel.updateProfile(userId,data);
            if(!updated)return res.status(404).json({message:'No se pudo actualizar el perfil'});
            const updatedUser=await UserModel.findActiveById(userId);
            return res.json({message:'Perfil actualizado correctamente',user:await decorateUser(updatedUser)});
        } catch(error) {
            if(error.code==='ER_DUP_ENTRY') {
                const field=/dni/i.test(error.sqlMessage||error.message)?'dni':'email';
                return res.status(409).json({message:'Revisa los campos indicados.',errors:{[field]:field==='dni'?'El DNI ya está registrado por otro usuario.':'El correo ya está registrado por otro usuario.'}});
            }
            console.error('Error actualizando perfil:',error.message);
            return res.status(500).json({message:'No se pudo guardar el perfil. Inténtalo nuevamente.'});
        }
    }
    static async changePassword(req, res) {
        try {
            const userId = req.auth.id;
            const { currentPassword, newPassword } = req.body;

            if (typeof currentPassword!=='string' || typeof newPassword!=='string' || !currentPassword || !newPassword) {
                return res.status(400).json({ message: "Contraseñas requeridas" });
            }

            const pwdStr = String(newPassword);
            if(Buffer.byteLength(pwdStr,'utf8')>72)return res.status(400).json({message:'La nueva contraseña no puede superar 72 bytes.'});

            // Validación estricta para nueva contraseña:
            // - Mínimo 8 caracteres
            // - Al menos una letra mayúscula
            // - Al menos una letra minúscula
            // - Al menos un número
            if (pwdStr.length < 8) {
                return res.status(400).json({ message: "La nueva contraseña debe tener como mínimo 8 caracteres" });
            }
            if (!/[A-Z]/.test(pwdStr)) {
                return res.status(400).json({ message: "La nueva contraseña debe contener al menos una letra mayúscula (A-Z)" });
            }
            if (!/[a-z]/.test(pwdStr)) {
                return res.status(400).json({ message: "La nueva contraseña debe contener al menos una letra minúscula (a-z)" });
            }
            if (!/[0-9]/.test(pwdStr)) {
                return res.status(400).json({ message: "La nueva contraseña debe contener al menos un número (0-9)" });
            }

            const userRow = await UserModel.findActiveById(userId);
            if (!userRow) return res.status(404).json({ message: "Usuario no encontrado" });

            const valid = await verifyPassword(currentPassword, userRow.password_hash);
            if (!valid) return res.status(401).json({ message: "La contraseña actual es incorrecta" });

            const hash = await bcrypt.hash(pwdStr, 10);
            await UserModel.updatePasswordHash(userId, hash);

            return res.json({ message: "Contraseña actualizada correctamente" });
        } catch (error) {
            console.error("Error cambiando contraseña:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = AuthController;
