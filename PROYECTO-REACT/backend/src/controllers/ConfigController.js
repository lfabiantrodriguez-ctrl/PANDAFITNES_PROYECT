const db = require("../config/database");

class ConfigController {
    static async getConfig(req, res) {
        try {
            const [rows] = await db.execute("SELECT clave, valor FROM configuracion");
            const config = {
                empresa_nombre: "Panda Fitness",
                empresa_descripcion: "Centro de Entrenamiento & Fitness Integral",
                empresa_logo: "/logo-panda.png",
                max_capacidad: "50",
                horario_semana_modalidad: "partido", // 'continuo' | 'partido'
                horario_semana_corrido_inicio: "06:30",
                horario_semana_corrido_fin: "22:00",
                horario_semana_manana_inicio: "06:30",
                horario_semana_manana_fin: "11:00",
                horario_semana_tarde_inicio: "16:00",
                horario_semana_tarde_fin: "22:00",
                horario_sabado_estado: "1",
                horario_sabado_inicio: "07:00",
                horario_sabado_fin: "12:00",
                horario_domingo_abierto: "0",
                horario_domingo_inicio: "08:00",
                horario_domingo_fin: "13:00",
                estado_operativo: "normal",
                aviso_activo: "0",
                aviso_titulo: "Comunicado del Club",
                aviso_mensaje: "",
                landing_hero_titulo: "Entrena, Evoluciona y Conquista tus Metas en Panda Fitness",
                landing_hero_subtitulo: "Tu centro de entrenamiento inteligente con monitoreo de aforo en vivo, mascota virtual que evoluciona con tu esfuerzo y recompensas reales por cada visita.",
                landing_gym_direccion: "Av. Principal Los Olivos 450, Centro Deportivo Panda",
                landing_gym_telefono: "+51 987 654 321",
                landing_gym_mapa_url: "https://maps.google.com",
                landing_redes_instagram: "pandafitness_oficial",
                landing_redes_tiktok: "@pandafitness_gym",
                landing_redes_facebook: "pandafitnessclub",
                landing_redes_whatsapp: "+51 987 654 321",
                landing_imagenes_gym: JSON.stringify([
                    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=1000&q=80",
                ]),
                recompensas_categorias: JSON.stringify([
                    "Bebidas e Hidratación",
                    "Suplementos & Nutrición",
                    "Indumentaria & Accesorios",
                    "Servicios & Pases"
                ]),
            };

            for (const row of rows) {
                config[row.clave] = row.valor;
            }

            return res.json(config);
        } catch (error) {
            console.error("Error al obtener configuracion:", error);
            return res.status(500).json({ message: "Error al obtener configuracion" });
        }
    }

    static async updateConfig(req, res) {
        try {
            const fields = [
                "empresa_nombre",
                "empresa_descripcion",
                "empresa_logo",
                "max_capacidad",
                "horario_semana_modalidad",
                "horario_semana_corrido_inicio",
                "horario_semana_corrido_fin",
                "horario_semana_manana_inicio",
                "horario_semana_manana_fin",
                "horario_semana_tarde_inicio",
                "horario_semana_tarde_fin",
                "horario_sabado_estado",
                "horario_sabado_inicio",
                "horario_sabado_fin",
                "horario_domingo_abierto",
                "horario_domingo_inicio",
                "horario_domingo_fin",
                "estado_operativo",
                "aviso_activo",
                "aviso_titulo",
                "aviso_mensaje",
                "landing_hero_titulo",
                "landing_hero_subtitulo",
                "landing_gym_direccion",
                "landing_gym_telefono",
                "landing_gym_mapa_url",
                "landing_redes_instagram",
                "landing_redes_tiktok",
                "landing_redes_facebook",
                "landing_redes_whatsapp",
                "landing_imagenes_gym",
                "recompensas_categorias",
            ];

            for (const key of fields) {
                if (req.body[key] !== undefined) {
                    await db.execute(
                        `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
                         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
                        [key, String(req.body[key]).trim()]
                    );
                }
            }

            // Return updated config
            const [rows] = await db.execute("SELECT clave, valor FROM configuracion");
            const config = {};
            for (const row of rows) {
                config[row.clave] = row.valor;
            }

            return res.json({
                message: "Configuración actualizada con éxito",
                config,
            });
        } catch (error) {
            console.error("Error al actualizar configuracion:", error);
            return res.status(500).json({ message: "Error al actualizar configuracion" });
        }
    }
}

module.exports = ConfigController;
