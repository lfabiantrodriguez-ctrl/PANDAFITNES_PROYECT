const nodemailer = require("nodemailer");

let transporter = null;

async function getTransporter() {
    if (transporter) return transporter;

    const googleUser = process.env.GOOGLE_USER;
    const googleAppPassword = process.env.GOOGLE_APP_PASSWORD;

    if (googleUser && googleAppPassword) {
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: googleUser,
                pass: googleAppPassword,
            },
        });
        console.log("--------------------------------------------------");
        console.log("Transporter de Gmail configurado para envío real.");
        console.log(`Usuario: ${googleUser}`);
        console.log("--------------------------------------------------");
    } else {
        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT || 587;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (host && user && pass) {
            transporter = nodemailer.createTransport({
                host,
                port: Number(port),
                secure: Number(port) === 465,
                auth: { user, pass },
            });
            console.log("--------------------------------------------------");
            console.log("Transporter SMTP genérico configurado.");
            console.log(`Host: ${host}`);
            console.log("--------------------------------------------------");
        } else {
            // Fallback: Ethereal Mail for testing
            try {
                const testAccount = await nodemailer.createTestAccount();
                transporter = nodemailer.createTransport({
                    host: "smtp.ethereal.email",
                    port: 587,
                    secure: false,
                    auth: {
                        user: testAccount.user,
                        pass: testAccount.pass,
                    },
                });
                console.log("--------------------------------------------------");
                console.log("SMTP Credentials not found in .env.");
                console.log("Using Ethereal Mail fallback transporter.");
                console.log(`Test user: ${testAccount.user}`);
                console.log(`Test pass: ${testAccount.pass}`);
                console.log("--------------------------------------------------");
            } catch (err) {
                console.error("Failed to create Ethereal test account:", err);
                // In-memory dummy transporter
                transporter = {
                    sendMail: async (options) => {
                        console.log("=== MOCK EMAIL SENT ===");
                        console.log(`To: ${options.to}`);
                        console.log(`Subject: ${options.subject}`);
                        console.log(`Body: ${options.html}`);
                        console.log("=======================");
                        return { messageId: "mock-id" };
                    },
                };
            }
        }
    }
    return transporter;
}

async function sendEmail({ to, subject, html }) {
    try {
        const tx = await getTransporter();
        const googleUser = process.env.GOOGLE_USER;
        const fromAddress = googleUser || "no-reply@pandafitness.com";

        const info = await tx.sendMail({
            from: `"Panda Fitness" <${fromAddress}>`,
            to,
            subject,
            html,
        });

        console.log(`Email enviado a ${to}: ID ${info.messageId}`);
        // If Ethereal mail is used, print preview URL
        if (nodemailer.getTestMessageUrl && info.messageId !== "mock-id" && !googleUser && !process.env.SMTP_HOST) {
            const url = nodemailer.getTestMessageUrl(info);
            if (url) {
                console.log(`Vista previa del correo: ${url}`);
            }
        }
        return true;
    } catch (error) {
        console.error("Error enviando email:", error);
        return false;
    }
}

module.exports = { sendEmail };
