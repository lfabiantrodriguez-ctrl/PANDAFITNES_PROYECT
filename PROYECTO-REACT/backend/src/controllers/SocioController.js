const SocioModel = require("../models/SocioModel");
const { isValidDni, toDateOnly } = require("../utils/helpers");
const { sendEmail } = require("../utils/email");

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

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || (cleanPhone && !/^\d{9}$/.test(cleanPhone))) {
                return res.status(400).json({ message: 'Revisa el correo y el teléfono del socio.' });
            }

            const isDuplicate = await SocioModel.checkDuplicate(cleanDni, cleanEmail);

            if (isDuplicate) {
                return res.status(409).json({ message: "Ya existe un usuario con ese DNI o email" });
            }

            const deviceAccess = require('../services/deviceAccess');
            const device = deviceAccess.claim(req.body.deviceTicket, String(req.auth.id), cleanDni);
            if (device) await deviceAccess.init();
            const socio = await SocioModel.create({
                device,
                dni: cleanDni,
                nombre: cleanName,
                apellido: cleanLastName,
                email: cleanEmail,
                telefono: cleanPhone,
                planId,
                fechaInicio: startDate,
                metodoPago,
            });

            // El correo de bienvenida no incluye contraseñas.
            const planRow = await (async () => {
                const db = require("../config/database");
                const [rows] = await db.execute("SELECT nombre FROM planes_membresia WHERE id = ?", [planId]);
                return rows[0] || { nombre: "Membresia" };
            })();

            await sendEmail({
                to: cleanEmail,
                subject: "Bienvenido a Panda Fitness - Acceso a la App",
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                        <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                            <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                        </div>
                        <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                            <h2 style="color:#111827;margin:0 0 16px;">¡Bienvenido a Panda Fitness!</h2>
                            <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${cleanName} ${cleanLastName}</strong>, nos complace darte la bienvenida a nuestro gimnasio.</p>
                            <p style="color:#4b5563;font-size:15px;line-height:1.6;">Tu membresia <strong>${planRow.nombre}</strong> ha sido activada exitosamente.</p>
                            <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:16px 0;">
                                <h3 style="color:#111827;margin:0 0 12px;font-size:16px;">Datos de Acceso a la App</h3>
                                <p style="color:#4b5563;font-size:15px;margin:6px 0;"><strong>DNI:</strong> ${cleanDni}</p>
                            </div>
                            <p style="color:#4b5563;font-size:14px;line-height:1.6;">Ingresa con tu DNI y la contraseña inicial asignada en recepción. Puedes cambiarla desde <strong>Mi perfil</strong>.</p>
                            <p style="color:#4b5563;font-size:14px;line-height:1.6;">Puedes acceder a la app desde cualquier dispositivo para:</p>
                            <ul style="color:#4b5563;font-size:14px;line-height:1.8;">
                                <li>Reservar tu turno en el gimnasio</li>
                                <li>Consultar el aforo en tiempo real</li>
                                <li>Revisar tu plan de membresia y pagos</li>
                                <li>Actualizar tus datos personales</li>
                            </ul>
                            <p style="color:#4b5563;font-size:14px;">¡Te esperamos para entrenar juntos!</p>
                        </div>
                        <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
                            <p>Panda Fitness Gym © ${new Date().getFullYear()}</p>
                        </div>
                    </div>
                `,
            }).catch(error => console.error('No se pudo enviar la bienvenida al socio:', error.message));

            return res.status(201).json({
                message: "Socio creado correctamente",
                socio,
            });
        } catch (error) {
            console.error("Error creando socio:", error);
            if (error.message.includes("No existe el rol cliente") || error.message.includes("El plan seleccionado no existe")) {
                return res.status(400).json({ message: error.message });
            }

            // Handle MySQL duplicate entry errors to return a clear 409 response
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                return res.status(409).json({ message: 'Ya existe un usuario con ese DNI o email' });
            }

            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async setActive(req, res) {
        try {
            const id = Number(req.params.id);
            const { activo } = req.body;
            if (!Number.isSafeInteger(id) || id <= 0 || typeof activo !== 'boolean') {
                return res.status(400).json({ message: 'Indica un socio válido y el estado de su cuenta.' });
            }
            if (!await SocioModel.setActive(id, activo)) {
                return res.status(404).json({ message: 'Socio no encontrado.' });
            }
            return res.json({ activo, message: activo ? 'Cuenta del socio activada.' : 'Cuenta del socio desactivada. Ya no puede ingresar.' });
        } catch (error) {
            console.error('Error cambiando estado del socio:', error.message);
            return res.status(500).json({ message: 'No se pudo cambiar el estado de la cuenta.' });
        }
    }

    static async getSocioFicha(req, res) {
        try {
            const socioId = Number(req.params.id);
            if (!socioId) {
                return res.status(400).json({ message: "ID de socio inválido" });
            }

            const ficha = await SocioModel.getFicha(socioId);
            if (!ficha) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            return res.json({ ficha });
        } catch (error) {
            console.error("Error obteniendo ficha del socio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async updateSocio(req, res) {
        const db = require('../config/database');
        const access = require('../services/deviceAccess');
        let connection;
        try {
            const id = Number(req.params.id);
            const dni = String(req.body.dni || '').trim();
            const nombre = String(req.body.nombre || '').trim();
            const apellido = String(req.body.apellido || '').trim();
            const email = String(req.body.email || '').trim().toLowerCase();
            const telefono = String(req.body.telefono || '').trim();
            if (!id || !isValidDni(dni) || !nombre || !apellido || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (telefono && !/^\d{9}$/.test(telefono)))
                return res.status(400).json({ message: 'Revisa DNI, nombres, correo y teléfono.' });
            const device = access.claim(req.body.deviceTicket, String(req.auth.id), dni);
            if (device) await access.init();
            connection = await db.getConnection();
            await connection.beginTransaction();
            const [rows] = await connection.execute(`SELECT u.id,r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id
                WHERE u.id=? AND (r.nombre='cliente' OR EXISTS (SELECT 1 FROM staff_member_links l WHERE l.member_user_id=u.id AND l.staff_user_id=u.id)) FOR UPDATE`, [id]);
            if (!rows[0]) throw new Error('Socio no encontrado.');
            if (rows[0].rol && rows[0].rol!=='cliente' && req.auth.rol!=='admin') {
                const error=new Error('Solo un administrador puede editar los datos de un trabajador desde Socios.');error.status=403;throw error;
            }
            await connection.execute('UPDATE usuarios SET dni=?, nombre=?, apellido=?, email=?, telefono=? WHERE id=?', [dni, nombre, apellido, email, telefono || null, id]);
            if (device) await connection.execute(`INSERT INTO socio_dispositivos (usuario_id, credential_id, public_key, counter) VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE credential_id=VALUES(credential_id), public_key=VALUES(public_key), counter=VALUES(counter)`, [id, device.credentialId, device.publicKey, device.counter]);
            await connection.commit();
            res.json({ message: 'Datos del socio actualizados.' });
        } catch (error) {
            if (connection) await connection.rollback();
            res.status(error.status||400).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Ya existe otro usuario con ese DNI o correo.' : error.message });
        } finally { connection?.release(); }
    }

    static async createOffer(req, res) {
        try {
            const { usuarioId, titulo, descripcion, tipo, valor, codigoCupon, diasVigencia } = req.body;

            if (!titulo) {
                return res.status(400).json({ message: "El título de la oferta es obligatorio" });
            }

            const offer = await SocioModel.createOffer({
                usuarioId: usuarioId ? Number(usuarioId) : null,
                titulo,
                descripcion,
                tipo,
                valor: Number(valor || 0),
                codigoCupon: codigoCupon ? String(codigoCupon).trim().toUpperCase() : null,
                diasVigencia: diasVigencia ? Number(diasVigencia) : 30,
            });

            return res.status(201).json({
                message: usuarioId ? "Oferta personalizada asignada y notificada al socio" : "Oferta general creada exitosamente",
                offer,
            });
        } catch (error) {
            console.error("Error creando oferta para socio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getOffers(req, res) {
        try {
            const db = require("../config/database");
            const [rows] = await db.execute(
                `SELECT o.*, u.nombre AS usuarioNombre, u.apellido AS usuarioApellido, u.dni AS usuarioDni
                 FROM ofertas_socios o
                 LEFT JOIN usuarios u ON u.id = o.usuario_id
                 ORDER BY o.id DESC`,
            );
            return res.json({ ofertas: rows });
        } catch (error) {
            console.error("Error consultando ofertas:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = SocioController;
