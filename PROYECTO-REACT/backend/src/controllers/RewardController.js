const db = require("../config/database");
const AttendanceModel = require("../models/AttendanceModel");

class RewardController {
    // Listar recompensas activas
    static async getRewards(req, res) {
        try {
            const [rows] = await db.execute(
                `SELECT id, nombre, descripcion, costo_bambus AS costoBambus, categoria, 
                        imagen_url AS imagenUrl, stock, destacado, activo, creado_en AS creadoEn
                 FROM recompensas_catalogo
                 WHERE activo = 1
                 ORDER BY destacado DESC, costo_bambus ASC`,
            );
            return res.json({ rewards: rows });
        } catch (error) {
            console.error("Error obteniendo recompensas:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Crear recompensa (Admin)
    static async createReward(req, res) {
        try {
            const { nombre, descripcion, costoBambus, categoria, imagenUrl, stock, destacado } = req.body;
            if (!nombre || !costoBambus) {
                return res.status(400).json({ message: "Nombre y costo en bambús son obligatorios" });
            }

            const [result] = await db.execute(
                `INSERT INTO recompensas_catalogo (nombre, descripcion, costo_bambus, categoria, imagen_url, stock, destacado)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    nombre, 
                    descripcion || "", 
                    Number(costoBambus), 
                    categoria || "general", 
                    imagenUrl || null,
                    Number(stock) || 50,
                    destacado ? 1 : 0
                ],
            );

            return res.status(201).json({
                message: "Recompensa creada con éxito",
                id: result.insertId,
            });
        } catch (error) {
            console.error("Error creando recompensa:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Editar recompensa (Admin)
    static async updateReward(req, res) {
        try {
            const { id } = req.params;
            const { nombre, descripcion, costoBambus, categoria, imagenUrl, stock, destacado, activo } = req.body;

            const destVal = destacado !== undefined ? (destacado ? 1 : 0) : null;
            const imgVal = imagenUrl !== undefined ? imagenUrl : null;
            const stockVal = stock !== undefined ? Number(stock) : null;
            const costoVal = costoBambus !== undefined ? Number(costoBambus) : null;

            await db.execute(
                `UPDATE recompensas_catalogo
                 SET nombre = COALESCE(?, nombre),
                     descripcion = COALESCE(?, descripcion),
                     costo_bambus = COALESCE(?, costo_bambus),
                     categoria = COALESCE(?, categoria),
                     imagen_url = COALESCE(?, imagen_url),
                     stock = COALESCE(?, stock),
                     destacado = COALESCE(?, destacado),
                     activo = COALESCE(?, activo)
                 WHERE id = ?`,
                [nombre || null, descripcion !== undefined ? descripcion : null, costoVal, categoria || null, imgVal, stockVal, destVal, activo !== undefined ? (activo ? 1 : 0) : null, id],
            );

            return res.json({ message: "Recompensa actualizada correctamente" });
        } catch (error) {
            console.error("Error actualizando recompensa:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Eliminar recompensa (Admin)
    static async deleteReward(req, res) {
        try {
            const { id } = req.params;
            await db.execute(`UPDATE recompensas_catalogo SET activo = 0 WHERE id = ?`, [id]);
            return res.json({ message: "Recompensa desactivada con éxito" });
        } catch (error) {
            console.error("Error eliminando recompensa:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Listar convenios comerciales
    static async getPartnerships(req, res) {
        try {
            const [rows] = await db.execute(
                `SELECT id, aliado_nombre AS aliadoNombre, categoria, descuento_texto AS descuentoTexto,
                        descripcion, codigo_promocional AS codigoPromocional, imagen_url AS imagenUrl,
                        destacado, activo, creado_en AS creadoEn
                 FROM convenios_comerciales
                 WHERE activo = 1
                 ORDER BY destacado DESC, id ASC`,
            );
            return res.json({ partnerships: rows });
        } catch (error) {
            console.error("Error obteniendo convenios:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Crear convenio comercial (Admin)
    static async createPartnership(req, res) {
        try {
            const { aliadoNombre, categoria, descuentoTexto, descripcion, codigoPromocional, imagenUrl, destacado } = req.body;
            if (!aliadoNombre || !descuentoTexto) {
                return res.status(400).json({ message: "Nombre del aliado y detalle de descuento son obligatorios" });
            }

            const [result] = await db.execute(
                `INSERT INTO convenios_comerciales (aliado_nombre, categoria, imagen_url, descuento_texto, descripcion, codigo_promocional, destacado)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    aliadoNombre, 
                    categoria || "Comercial", 
                    imagenUrl || null,
                    descuentoTexto, 
                    descripcion || "", 
                    codigoPromocional || "PANDA",
                    destacado ? 1 : 0
                ],
            );

            return res.status(201).json({
                message: "Convenio comercial creado con éxito",
                id: result.insertId,
            });
        } catch (error) {
            console.error("Error creando convenio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Eliminar convenio comercial (Admin)
    static async deletePartnership(req, res) {
        try {
            const { id } = req.params;
            await db.execute(`UPDATE convenios_comerciales SET activo = 0 WHERE id = ?`, [id]);
            return res.json({ message: "Convenio desactivado con éxito" });
        } catch (error) {
            console.error("Error eliminando convenio:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Ver historial de canjes del usuario
    static async getMyRedemptions(req, res) {
        try {
            const userId = req.auth.id;
            const [rows] = await db.execute(
                `SELECT id, recompensa_nombre AS recompensaNombre, costo_bambus AS costoBambus,
                        codigo_canje AS codigoCanje, fecha_canje AS fechaCanje, estado
                 FROM canjes_recompensas
                 WHERE usuario_id = ?
                 ORDER BY fecha_canje DESC`,
                [userId],
            );
            return res.json({ redemptions: rows });
        } catch (error) {
            console.error("Error obteniendo mis canjes:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Ver todos los canjes para recepción (Admin)
    static async getAllRedemptions(req, res) {
        try {
            const [rows] = await db.execute(
                `SELECT c.id, c.usuario_id AS usuarioId, u.nombre, u.apellido, u.dni,
                        c.recompensa_nombre AS recompensaNombre, c.costo_bambus AS costoBambus,
                        c.codigo_canje AS codigoCanje, c.fecha_canje AS fechaCanje, c.estado
                 FROM canjes_recompensas c
                 INNER JOIN usuarios u ON u.id = c.usuario_id
                 ORDER BY c.fecha_canje DESC`,
            );
            return res.json({ redemptions: rows });
        } catch (error) {
            console.error("Error obteniendo lista de canjes general:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    // Marcar canje como entregado (Admin)
    static async deliverRedemption(req, res) {
        try {
            const { id } = req.params;
            await db.execute(`UPDATE canjes_recompensas SET estado = 'entregado' WHERE id = ?`, [id]);
            return res.json({ message: "Canje validado y marcado como entregado" });
        } catch (error) {
            console.error("Error entregando canje:", error);
            return res.status(500).json({ message: "Error interno del servidor" });
        }
    }
}

module.exports = RewardController;
