const MembershipModel = require("../models/MembershipModel");
const UserModel = require("../models/UserModel");
const { sendEmail } = require("../utils/email");

class MembershipController {
    static async getMyMembership(req, res) {
        try {
            const userId = req.auth.id;
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

    static async getMyPayments(req, res) {
        try {
            const userId = req.auth.id;
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

    static async renewMembership(req, res) {
        try {
            const { userId, planId, fechaInicio, metodoPago } = req.body;

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
            });

            return res.json({
                message: "Membresia renovada correctamente",
                membership: result,
            });
        } catch (error) {
            console.error("Error renovando membresia:", error);
            if (error.message === "El plan seleccionado no existe") {
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = MembershipController;
