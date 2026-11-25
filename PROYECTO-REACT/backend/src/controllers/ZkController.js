const zkService = require("../services/zkAttendanceService");
const db = require("../config/database");

class ZkController {
    static async ping(req, res) {
        try {
            const token = req.headers["x-zk-token"] || req.query.token;
            const valid = await zkService.validateZkToken(token);
            if (!valid) {
                return res.status(401).json({ ok: false, message: "Token ZKTeco inválido" });
            }

            const [rows] = await db.execute(
                "SELECT valor FROM configuracion WHERE clave = 'empresa_nombre' LIMIT 1",
            );
            return res.json({
                ok: true,
                club: rows[0]?.valor || "Panda Fitness",
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error("Error en ping ZKTeco:", error);
            return res.status(500).json({ ok: false, message: "Error interno del servidor" });
        }
    }

    static async receiveMarcaciones(req, res) {
        try {
            const token = req.headers["x-zk-token"] || req.query.token;
            const valid = await zkService.validateZkToken(token);
            if (!valid) {
                return res.status(401).json({ ok: false, message: "Token ZKTeco inválido" });
            }

            const body = req.body || {};
            const lista = Array.isArray(body.marcaciones)
                ? body.marcaciones
                : Array.isArray(body)
                ? body
                : [body];

            const summary = await zkService.registrarMarcacionesZk(
                lista,
                body.origen || "ZK_LIVE",
                body.dispositivo || "ZKTECO",
            );

            return res.json({ ok: true, ...summary });
        } catch (error) {
            console.error("Error procesando marcaciones ZKTeco:", error);
            return res.status(500).json({ ok: false, message: "Error procesando marcaciones" });
        }
    }

    static async importArchivo(req, res) {
        try {
            const content =
                typeof req.body === "string"
                    ? req.body
                    : req.body?.content || req.body?.texto || "";
            const filename = req.body?.filename || "USB_PENDRIVE";

            if (!content || !String(content).trim()) {
                return res.status(400).json({ message: "El archivo está vacío o no tiene formato válido." });
            }

            const marcaciones = zkService.parseAttlogText(content);
            if (marcaciones.length === 0) {
                return res.status(400).json({
                    message: "No se encontraron marcaciones válidas. Verifica que sea un archivo attlog.dat, .txt o .csv.",
                });
            }

            const summary = await zkService.registrarMarcacionesZk(marcaciones, "ZK_ARCHIVO", filename);
            return res.json({
                ok: true,
                message: `Archivo importado: ${summary.entradas} entradas, ${summary.salidas} salidas, ${summary.duplicadas} duplicadas.`,
                ...summary,
            });
        } catch (error) {
            console.error("Error importando archivo ZKTeco:", error);
            return res.status(500).json({ message: "Error importando archivo de marcaciones" });
        }
    }

    static async getTokenInfo(req, res) {
        try {
            const token = await zkService.getZkToken();
            return res.json({
                token,
                webhookPath: "/api/zk/marcaciones",
                pingPath: "/api/zk/ping",
                usbTemplatesPath: "/api/zk/usb/huellas",
            });
        } catch (error) {
            console.error("Error obteniendo token ZKTeco:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async regenerateToken(req, res) {
        try {
            const token = await zkService.regenerateZkToken();
            return res.json({
                token,
                message: "Token ZKTeco regenerado. Actualiza el config.ini de tus agentes locales.",
            });
        } catch (error) {
            console.error("Error regenerando token ZKTeco:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    static async getRecentMarcaciones(req, res) {
        try {
            const rows = await zkService.getRecentMarcaciones(req.query.limit || 20);
            return res.json({ marcaciones: rows });
        } catch (error) {
            console.error("Error consultando marcaciones ZKTeco:", error);
            return res.status(500).json({ message: "Error consultando marcaciones" });
        }
    }

    static async listUsbTemplates(req, res) {
        try {
            const token = req.headers["x-zk-token"] || req.query.token;
            if (!req.auth) {
                const valid = await zkService.validateZkToken(token);
                if (!valid) {
                    return res.status(401).json({ message: "No autorizado" });
                }
            }
            const huellas = await zkService.listUsbTemplates();
            return res.json({ huellas });
        } catch (error) {
            console.error("Error listando huellas USB:", error);
            return res.status(500).json({ message: "Error listando plantillas USB" });
        }
    }

    static async saveUsbTemplate(req, res) {
        try {
            const token = req.headers["x-zk-token"] || req.query.token;
            if (!req.auth) {
                const valid = await zkService.validateZkToken(token);
                if (!valid) {
                    return res.status(401).json({ message: "No autorizado" });
                }
            }
            const saved = await zkService.saveUsbTemplate(req.body || {});
            return res.json({
                ok: true,
                message: `Huella USB registrada para ${saved.nombre} (DNI ${saved.dni}).`,
                huella: saved,
            });
        } catch (error) {
            return res.status(400).json({ message: error.message || "Error guardando huella USB" });
        }
    }
}

module.exports = ZkController;
