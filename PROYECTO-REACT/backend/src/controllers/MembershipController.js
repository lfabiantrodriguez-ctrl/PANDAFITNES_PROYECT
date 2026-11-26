const MembershipModel = require("../models/MembershipModel");
const PlanModel = require("../models/PlanModel");
const UserModel = require("../models/UserModel");
const OfferService = require("../services/offerService");
const NotificationService = require("../services/notificationService");
const { sendEmail } = require("../utils/email");

class MembershipController {
    static async getMyMembership(req, res) {
        try {
            const userId = req.memberId;
            const membership = await MembershipModel.getClientMembership(userId);

            if (!membership) {
                return res.json({ membership: null, message: "No tienes una membresia activa" });
            }

            return res.json({ membership });
        } catch (error) {
            console.error("Error obteniendo membresia:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getMySummary(req, res) {
        try {
            const userId = req.memberId;
            const [memberInfo, membership, history, offers, requests, planes] = await Promise.all([
                MembershipModel.getMemberRegistrationInfo(userId),
                MembershipModel.getClientMembership(userId),
                MembershipModel.getClientMembershipHistory(userId),
                OfferService.getMemberOffers(userId),
                MembershipModel.getMemberRenewalRequests(userId),
                PlanModel.getAll(),
            ]);

            return res.json({
                memberInfo,
                membership,
                history,
                offers,
                requests,
                planes,
            });
        } catch (error) {
            console.error("Error obteniendo resumen de membresia:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getMemberPlanes(req, res) {
        try {
            const planes = await PlanModel.getAll();
            return res.json({ planes });
        } catch (error) {
            console.error("Error obteniendo planes para socio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getMyOffers(req, res) {
        try {
            const offers = await OfferService.getMemberOffers(req.memberId);
            return res.json({ offers });
        } catch (error) {
            console.error("Error obteniendo ofertas del socio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getMyRenewalRequests(req, res) {
        try {
            const requests = await MembershipModel.getMemberRenewalRequests(req.memberId);
            return res.json({ requests });
        } catch (error) {
            console.error("Error obteniendo solicitudes del socio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async validateCoupon(req, res) {
        try {
            const { codigoCupon, planId } = req.body || {};
            let planPrecio = 0;
            if (planId) {
                const plan = await PlanModel.findById(Number(planId));
                if (!plan) {
                    return res.status(404).json({ message: "El plan seleccionado no existe" });
                }
                planPrecio = Number(plan.precio);
            }
            const result = await OfferService.validateOfferCode({
                code: codigoCupon,
                userId: req.memberId,
                planPrecio,
                context: "renovacion",
            });
            return res.json(result);
        } catch (error) {
            return res.status(400).json({ message: error.message || "Código promocional no válido" });
        }
    }

    static async requestRenewal(req, res) {
        try {
            const userId = req.memberId;
            const {
                planId,
                metodoPago,
                telefonoContacto,
                codigoCupon,
                numeroOperacion,
                comprobanteUrl,
                comentarioSocio,
            } = req.body || {};

            if (!planId) {
                return res.status(400).json({ message: "Selecciona un plan para renovar" });
            }

            const allowedMethods = ["yape", "plin", "transferencia", "efectivo", "tarjeta"];
            if (!metodoPago || !allowedMethods.includes(String(metodoPago))) {
                return res.status(400).json({ message: "Selecciona un método de pago válido" });
            }
            const cleanMethod = String(metodoPago);

            const memberInfo = await MembershipModel.getMemberRegistrationInfo(userId);
            if (!memberInfo) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            const cleanPhone = String(telefonoContacto || memberInfo.telefono || "").replace(/\D/g, "");
            if (cleanPhone && !/^9\d{8}$/.test(cleanPhone)) {
                return res.status(400).json({ message: "El teléfono de contacto debe tener 9 dígitos y empezar con 9" });
            }

            if (["yape", "plin", "transferencia"].includes(cleanMethod) && !comprobanteUrl && !String(numeroOperacion || "").trim()) {
                return res.status(400).json({
                    message: "Adjunta el pantallazo de tu pago o ingresa el número de operación para validarlo.",
                });
            }

            if (comprobanteUrl && String(comprobanteUrl).length > 8 * 1024 * 1024) {
                return res.status(400).json({ message: "La imagen del comprobante es demasiado pesada (máx. 5 MB)." });
            }

            const created = await MembershipModel.createRenewalRequest({
                userId,
                planId: Number(planId),
                metodoPago: cleanMethod,
                telefonoContacto: cleanPhone || memberInfo.telefono || null,
                codigoCupon,
                numeroOperacion,
                comprobanteUrl,
                comentarioSocio,
            });

            const fullName = `${memberInfo.nombre} ${memberInfo.apellido}`.trim();
            await NotificationService.create({
                usuarioId: null,
                rolDestino: "admin",
                tipo: "renovacion_solicitud",
                titulo: "Nueva solicitud de renovación",
                mensaje: `${fullName} (DNI ${memberInfo.dni}) solicitó renovar a ${created.planNombre} · S/. ${Number(created.montoFinal).toFixed(2)} (${cleanMethod.toUpperCase()}).`,
                enlace: "/app/socios?tab=solicitudes",
                referenciaId: created.id,
            });

            return res.status(201).json({
                message: "Solicitud de renovación enviada. Administración validará tu pago y te notificaremos pronto.",
                solicitud: created,
            });
        } catch (error) {
            console.error("Error creando solicitud de renovación:", error);
            return res.status(400).json({ message: error.message || "No se pudo registrar tu solicitud" });
        }
    }

    static async cancelRenewalRequest(req, res) {
        try {
            const requestId = Number(req.body?.solicitudId || req.params?.id);
            if (!requestId) {
                return res.status(400).json({ message: "Solicitud inválida" });
            }
            const ok = await MembershipModel.cancelMemberRenewalRequest(req.memberId, requestId);
            if (!ok) {
                return res.status(404).json({ message: "No se encontró una solicitud pendiente para cancelar" });
            }
            return res.json({ message: "Solicitud cancelada correctamente" });
        } catch (error) {
            console.error("Error cancelando solicitud:", error);
            return res.status(500).json({ message: "Error al cancelar solicitud" });
        }
    }

    static async getMyPayments(req, res) {
        try {
            const userId = req.memberId;
            const payments = await MembershipModel.getPaymentHistory(userId);

            return res.json({ payments });
        } catch (error) {
            console.error("Error obteniendo historial de pagos:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getMembershipsList(req, res) {
        try {
            const { search } = req.query;
            const socios = await MembershipModel.getSociosWithMembership(search || null);

            return res.json({ socios });
        } catch (error) {
            console.error("Error listando membresias:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getAdminRenewalRequests(req, res) {
        try {
            const { estado } = req.query;
            const solicitudes = await MembershipModel.getAdminRenewalRequests(estado || null);
            return res.json({ solicitudes });
        } catch (error) {
            console.error("Error listando solicitudes de renovación:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async approveRenewalRequest(req, res) {
        try {
            const requestId = Number(req.params.id);
            if (!requestId) {
                return res.status(400).json({ message: "Solicitud inválida" });
            }

            const { request, membership } = await MembershipModel.approveRenewalRequest({
                requestId,
                adminId: req.auth.id,
            });

            const user = await UserModel.findActiveById(request.usuario_id);

            await NotificationService.create({
                usuarioId: request.usuario_id,
                rolDestino: "cliente",
                tipo: "renovacion_aprobada",
                titulo: "¡Pago aceptado y membresía renovada!",
                mensaje: `Tu plan ${membership.planNombre} fue validado y está activo hasta el ${membership.fechaFin}${membership.diasExtra ? ` (incluye +${membership.diasExtra} días extra)` : ""}.`,
                enlace: "/app/mi-membresia",
                referenciaId: requestId,
            });

            if (user?.email) {
                await sendEmail({
                    to: user.email,
                    subject: "Pago Aceptado · Membresía Renovada - Panda Fitness",
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                            <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                                <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                            </div>
                            <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                                <h2 style="color:#15803d;margin:0 0 16px;">¡Pago Aceptado y Membresía Renovada!</h2>
                                <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${user.nombre} ${user.apellido}</strong>, validamos tu pago y tu renovación ya está activa.</p>
                                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                                    <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Plan:</td><td style="padding:8px 0;color:#111827;">${membership.planNombre}</td></tr>
                                    <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Fecha de inicio:</td><td style="padding:8px 0;color:#111827;">${membership.fechaInicio}</td></tr>
                                    <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Fecha de vencimiento:</td><td style="padding:8px 0;color:#111827;">${membership.fechaFin}</td></tr>
                                    <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Monto pagado:</td><td style="padding:8px 0;color:#111827;">S/. ${Number(membership.monto).toFixed(2)}</td></tr>
                                    <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Método de pago:</td><td style="padding:8px 0;color:#111827;">${membership.metodoPago}</td></tr>
                                </table>
                                <p style="color:#4b5563;font-size:14px;">¡Gracias por seguir entrenando con nosotros!</p>
                            </div>
                        </div>
                    `,
                }).catch(() => {});
            }

            return res.json({
                message: "Solicitud aprobada y membresía renovada correctamente",
                membership,
            });
        } catch (error) {
            console.error("Error aprobando solicitud:", error);
            return res.status(400).json({ message: error.message || "No se pudo aprobar la solicitud" });
        }
    }

    static async rejectRenewalRequest(req, res) {
        try {
            const requestId = Number(req.params.id);
            const motivo = String(req.body?.motivo || "").trim();
            if (!requestId) {
                return res.status(400).json({ message: "Solicitud inválida" });
            }
            if (!motivo) {
                return res.status(400).json({ message: "Indica el motivo por el cual se observa o rechaza la solicitud" });
            }

            const request = await MembershipModel.rejectRenewalRequest({
                requestId,
                adminId: req.auth.id,
                motivo,
            });

            await NotificationService.create({
                usuarioId: request.usuario_id,
                rolDestino: "cliente",
                tipo: "renovacion_rechazada",
                titulo: "Solicitud de renovación rechazada",
                mensaje: `Tu solicitud para el plan ${request.planNombre} fue rechazada: ${motivo}. Puedes enviar una nueva solicitud desde Mi membresía.`,
                enlace: "/app/mi-membresia",
                referenciaId: requestId,
            });

            return res.json({ message: "Solicitud rechazada y notificada al socio" });
        } catch (error) {
            console.error("Error rechazando solicitud:", error);
            return res.status(400).json({ message: error.message || "No se pudo rechazar la solicitud" });
        }
    }

    static async renewMembership(req, res) {
        try {
            const { userId, planId, fechaInicio, metodoPago, codigoCupon } = req.body;

            if (!userId || !planId || !fechaInicio || !metodoPago) {
                return res.status(400).json({ message: "Complete todos los datos requeridos" });
            }

            const user = await UserModel.findActiveById(userId);
            if (!user) {
                return res.status(404).json({ message: "Usuario no encontrado" });
            }

            const result = await MembershipModel.renewMembership({
                userId,
                planId,
                fechaInicio,
                metodoPago,
                codigoCupon: codigoCupon || null,
            });

            await NotificationService.create({
                usuarioId: userId,
                rolDestino: "cliente",
                tipo: "renovacion_aprobada",
                titulo: "¡Tu membresía fue renovada!",
                mensaje: `Administración activó tu plan ${result.planNombre} vigente hasta el ${result.fechaFin}.`,
                enlace: "/app/mi-membresia",
                referenciaId: result.membresiaId,
            });

            // Send renewal confirmation email
            await sendEmail({
                to: user.email,
                subject: "Membresia Renovada - Panda Fitness",
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
                        <div style="background:#111827;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                            <h1 style="color:#ffffff;margin:0;font-size:24px;">PANDA FITNESS</h1>
                        </div>
                        <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
                            <h2 style="color:#111827;margin:0 0 16px;">Membresia Renovada Exitosamente</h2>
                            <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hola <strong>${user.nombre} ${user.apellido}</strong>, tu membresia ha sido renovada exitosamente.</p>
                            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                                <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Plan:</td><td style="padding:8px 0;color:#111827;">${result.planNombre}</td></tr>
                                <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Fecha de inicio:</td><td style="padding:8px 0;color:#111827;">${result.fechaInicio}</td></tr>
                                <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Fecha de fin:</td><td style="padding:8px 0;color:#111827;">${result.fechaFin}</td></tr>
                                <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Monto pagado:</td><td style="padding:8px 0;color:#111827;">S/. ${Number(result.monto).toFixed(2)}</td></tr>
                                <tr><td style="padding:8px 0;color:#4b5563;font-weight:700;">Metodo de pago:</td><td style="padding:8px 0;color:#111827;">${result.metodoPago}</td></tr>
                            </table>
                            <p style="color:#4b5563;font-size:14px;">Gracias por confiar en Panda Fitness. ¡Sigue entrenando!</p>
                        </div>
                        <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
                            <p>Panda Fitness Gym © ${new Date().getFullYear()}</p>
                        </div>
                    </div>
                `,
            }).catch(() => {});

            return res.json({
                message: "Membresia renovada correctamente",
                membership: result,
            });
        } catch (error) {
            console.error("Error renovando membresia:", error);
            if (error.message === "El plan seleccionado no existe" || error.message?.includes("cupón") || error.message?.includes("código") || error.message?.includes("promoción")) {
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = MembershipController;
