const db = require("../config/database");

async function ensureColumnExists(table, column, definition) {
    const [rows] = await db.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
    );

    if (rows.length > 0) {
        return false;
    }

    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Columna ${table}.${column} agregada`);
    return true;
}

async function ensureEstadoEnumValues(requiredValues) {
    const [rows] = await db.execute(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservas' AND COLUMN_NAME = 'estado'`,
    );

    if (!rows || rows.length === 0) {
        return false;
    }

    const columnType = rows[0].COLUMN_TYPE || "";
    const matches = columnType.match(/enum\((.*)\)/i);
    if (!matches || !matches[1]) {
        return false;
    }

    const values = matches[1].split(",").map((item) => item.trim().replace(/^'|'$/g, ""));
    let changed = false;

    for (const value of requiredValues) {
        if (!values.includes(value)) {
            values.push(value);
            changed = true;
        }
    }

    if (!changed) {
        return true;
    }

    const newEnum = values.map((value) => `'${value}'`).join(",");
    await db.execute(`ALTER TABLE reservas MODIFY estado ENUM(${newEnum}) DEFAULT 'pendiente'`);
    console.log(`Enum reservas.estado actualizado: ${values.join(", ")}`);
    return true;
}

async function ensureTipoEnumValues(requiredValues) {
    const [rows] = await db.execute(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservas' AND COLUMN_NAME = 'tipo'`,
    );

    if (!rows || rows.length === 0) {
        return false;
    }

    const columnType = rows[0].COLUMN_TYPE || "";
    const matches = columnType.match(/enum\((.*)\)/i);
    if (!matches || !matches[1]) {
        return false;
    }

    const values = matches[1].split(",").map((item) => item.trim().replace(/^'|'$/g, ""));
    let changed = false;

    for (const value of requiredValues) {
        if (!values.includes(value)) {
            values.push(value);
            changed = true;
        }
    }

    if (!changed) {
        return true;
    }

    const newEnum = values.map((value) => `'${value}'`).join(",");
    await db.execute(`ALTER TABLE reservas MODIFY tipo ENUM(${newEnum}) NOT NULL DEFAULT 'normal'`);
    console.log(`Enum reservas.tipo actualizado: ${values.join(", ")}`);
    return true;
}

async function ensureGuestTableExists() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS usuarios_invitados (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            apellido VARCHAR(100) NULL,
            dni VARCHAR(20) NULL,
            telefono VARCHAR(20) NULL,
            fecha_inicio DATETIME NOT NULL,
            fecha_fin DATETIME NOT NULL,
            metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
            monto DECIMAL(10,2) NOT NULL DEFAULT 7.00,
            estado VARCHAR(30) NOT NULL DEFAULT 'activo',
            creado_por_admin_id INT NULL,
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_usuarios_invitados_estado_fecha (estado, fecha_inicio, fecha_fin)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("Tabla usuarios_invitados verificada");
}

async function runSchemaMigrations() {
    try {
        await ensureEstadoEnumValues(["finalizada"]);
        await ensureTipoEnumValues(["checkin_directo"]);

        // Ensure guest table exists before altering it
        await ensureGuestTableExists();

        // Add weekly limit column to planes_membresia
        const colAdded = await ensureColumnExists(
            "planes_membresia",
            "limite_semanal",
            "INT DEFAULT NULL AFTER duracion_dias",
        );

        if (colAdded) {
            // Set Interdiario (id=4) to 3 reservations per week
            await db.execute(
                "UPDATE planes_membresia SET limite_semanal = 3 WHERE id = 4",
            );
            console.log("limite_semanal=3 asignado al plan Interdiario (id=4)");
        }

        // Add total reservations column to planes_membresia
        const colAdded2 = await ensureColumnExists(
            "planes_membresia",
            "total_reservas",
            "INT DEFAULT NULL AFTER limite_semanal",
        );

        if (colAdded2) {
            // Set Interdiario (id=4) to 15 total reservations
            await db.execute(
                "UPDATE planes_membresia SET total_reservas = 15 WHERE id = 4",
            );
            console.log("total_reservas=15 asignado al plan Interdiario (id=4)");
        }
        // Ensure guest surcharge flag exists
        await ensureColumnExists(
            "usuarios_invitados",
            "recargo_aplicado",
            "TINYINT(1) DEFAULT 0 AFTER monto",
        );

        // Columnas para Mi Pandita y Asistencias del socio
        await ensureColumnExists(
            "usuarios",
            "dias_objetivo",
            "VARCHAR(50) DEFAULT '1,2,4,5'",
        );
        await ensureColumnExists(
            "usuarios",
            "horario_preferido",
            "VARCHAR(50) DEFAULT '07:00 - 08:30'",
        );
        await ensureColumnExists(
            "usuarios",
            "bambus_canjeados",
            "INT DEFAULT 0",
        );

        // Columnas para perfil extendido del usuario
        await ensureColumnExists(
            "usuarios",
            "fecha_nacimiento",
            "VARCHAR(30) NULL",
        );
        await ensureColumnExists(
            "usuarios",
            "direccion",
            "VARCHAR(255) NULL",
        );
        await ensureColumnExists(
            "usuarios",
            "contacto_emergencia",
            "VARCHAR(120) NULL",
        );
        await ensureColumnExists(
            "usuarios",
            "telefono_emergencia",
            "VARCHAR(20) NULL",
        );
        await ensureColumnExists(
            "usuarios",
            "avatar_url",
            "LONGTEXT NULL",
        );
        await ensureColumnExists(
            "usuarios",
            "preferencias",
            "TEXT NULL",
        );

        // Columnas para control de acceso con huella digital y manual
        await ensureColumnExists(
            "asistencias",
            "metodo_registro",
            "VARCHAR(30) DEFAULT 'manual'",
        );
        await ensureColumnExists(
            "usuarios",
            "huella_registrada",
            "TINYINT(1) DEFAULT 1",
        );

        // Tabla de canjes de recompensas
        await db.execute(`
            CREATE TABLE IF NOT EXISTS canjes_recompensas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                recompensa_nombre VARCHAR(120) NOT NULL,
                costo_bambus INT NOT NULL,
                codigo_canje VARCHAR(30) DEFAULT 'PANDA-CANJE',
                fecha_canje TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                estado VARCHAR(30) DEFAULT 'canjeado',
                INDEX idx_canjes_usuario (usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await ensureColumnExists(
            "canjes_recompensas",
            "codigo_canje",
            "VARCHAR(30) DEFAULT 'PANDA-CANJE' AFTER costo_bambus",
        );

        // Tabla de Catálogo de Recompensas administrable
        await db.execute(`
            CREATE TABLE IF NOT EXISTS recompensas_catalogo (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(120) NOT NULL,
                descripcion TEXT,
                costo_bambus INT NOT NULL DEFAULT 100,
                categoria VARCHAR(60) NOT NULL DEFAULT 'suplementos',
                stock INT DEFAULT 50,
                activo TINYINT(1) DEFAULT 1,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // El catálogo se administra desde el sistema; no insertar ejemplos.
        const [recs] = await db.execute("SELECT COUNT(*) AS total FROM recompensas_catalogo");
        

        // Columnas de imagen y destacado para recompensas
        await ensureColumnExists(
            "recompensas_catalogo",
            "imagen_url",
            "LONGTEXT NULL AFTER categoria",
        );
        await ensureColumnExists(
            "recompensas_catalogo",
            "destacado",
            "TINYINT(1) DEFAULT 0 AFTER stock",
        );

        // Tabla de Convenios Comerciales y Alianzas administrable
        await db.execute(`
            CREATE TABLE IF NOT EXISTS convenios_comerciales (
                id INT AUTO_INCREMENT PRIMARY KEY,
                aliado_nombre VARCHAR(120) NOT NULL,
                categoria VARCHAR(60) NOT NULL DEFAULT 'Nutrición',
                descuento_texto VARCHAR(80) NOT NULL,
                descripcion TEXT,
                codigo_promocional VARCHAR(50) DEFAULT 'PANDAFIT20',
                activo TINYINT(1) DEFAULT 1,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Columnas de imagen y destacado para convenios
        await ensureColumnExists(
            "convenios_comerciales",
            "imagen_url",
            "LONGTEXT NULL AFTER categoria",
        );
        await ensureColumnExists(
            "convenios_comerciales",
            "destacado",
            "TINYINT(1) DEFAULT 0 AFTER codigo_promocional",
        );

        // Los convenios se registran desde el sistema; no insertar ejemplos.
        const [partsCount] = await db.execute("SELECT COUNT(*) AS total FROM convenios_comerciales");
        

        // Actualizar imágenes iniciales para recompensas que no tengan imagen
        await db.execute(`
            UPDATE recompensas_catalogo 
            SET imagen_url = 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80', destacado = 1
            WHERE (imagen_url IS NULL OR imagen_url = '') AND nombre LIKE '%Isotónica%'
        `);
        await db.execute(`
            UPDATE recompensas_catalogo 
            SET imagen_url = 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=600&q=80', destacado = 1
            WHERE (imagen_url IS NULL OR imagen_url = '') AND nombre LIKE '%Kit de Bienvenida%'
        `);
        await db.execute(`
            UPDATE recompensas_catalogo 
            SET imagen_url = 'https://images.unsplash.com/photo-1607962837359-5e7e89f86776?auto=format&fit=crop&w=600&q=80', destacado = 0
            WHERE (imagen_url IS NULL OR imagen_url = '') AND nombre LIKE '%Toalla%'
        `);
        await db.execute(`
            UPDATE recompensas_catalogo 
            SET imagen_url = 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?auto=format&fit=crop&w=600&q=80', destacado = 1
            WHERE (imagen_url IS NULL OR imagen_url = '') AND nombre LIKE '%Proteína%'
        `);
        await db.execute(`
            UPDATE recompensas_catalogo 
            SET imagen_url = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80', destacado = 1
            WHERE (imagen_url IS NULL OR imagen_url = '') AND nombre LIKE '%Pase Libre%'
        `);
        await db.execute(`
            UPDATE recompensas_catalogo 
            SET imagen_url = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80', destacado = 1
            WHERE (imagen_url IS NULL OR imagen_url = '') AND nombre LIKE '%Descuento en Renovación%'
        `);

        // Asegurar que asistencias.reserva_id sea nullable y tenga columna de observación de salida
        try {
            await db.execute("ALTER TABLE asistencias MODIFY reserva_id INT NULL DEFAULT NULL");
        } catch (_) {}
        await ensureColumnExists("asistencias", "observacion_salida", "VARCHAR(80) NULL DEFAULT NULL");

        // Tabla de Ofertas y Promociones (individuales y generales para socios)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ofertas_socios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NULL,
                titulo VARCHAR(150) NOT NULL,
                descripcion TEXT NULL,
                tipo ENUM('descuento_porcentaje', 'descuento_fijo', 'dias_gratis', 'pase_amigo', 'personalizada') DEFAULT 'descuento_porcentaje',
                valor DECIMAL(10,2) DEFAULT 0.00,
                codigo_cupon VARCHAR(50) NULL,
                fecha_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                fecha_fin DATETIME NULL,
                estado ENUM('activo', 'canjeado', 'expirado') DEFAULT 'activo',
                cupos_maximos INT NULL DEFAULT NULL,
                cupos_usados INT NOT NULL DEFAULT 0,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await ensureColumnExists("ofertas_socios", "cupos_maximos", "INT NULL DEFAULT NULL AFTER estado");
        await ensureColumnExists("ofertas_socios", "cupos_usados", "INT NOT NULL DEFAULT 0 AFTER cupos_maximos");

        // Historial de uso de ofertas / cupones por socio
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ofertas_usos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                oferta_id INT NOT NULL,
                usuario_id INT NOT NULL,
                membresia_id INT NULL,
                invitado_id INT NULL,
                descuento_aplicado DECIMAL(10,2) DEFAULT 0.00,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_oferta_usuario (oferta_id, usuario_id),
                INDEX idx_oferta_uso_oferta (oferta_id),
                INDEX idx_oferta_uso_usuario (usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Solicitudes de renovación enviadas por socios con comprobante/validación
        await db.execute(`
            CREATE TABLE IF NOT EXISTS solicitudes_renovacion (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                plan_id INT NOT NULL,
                oferta_id INT NULL,
                codigo_cupon VARCHAR(50) NULL,
                monto_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                descuento_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                dias_extra INT NOT NULL DEFAULT 0,
                monto_final DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                metodo_pago VARCHAR(40) NOT NULL DEFAULT 'yape',
                numero_operacion VARCHAR(60) NULL,
                comprobante_url LONGTEXT NULL,
                telefono_contacto VARCHAR(20) NULL,
                comentario_socio VARCHAR(300) NULL,
                estado ENUM('pendiente', 'aprobada', 'rechazada', 'cancelada') NOT NULL DEFAULT 'pendiente',
                motivo_rechazo VARCHAR(300) NULL,
                fecha_inicio_sugerida DATE NULL,
                membresia_id INT NULL,
                revisado_por INT NULL,
                revisado_en DATETIME NULL,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_solicitud_usuario (usuario_id, estado),
                INDEX idx_solicitud_estado (estado, creado_en)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Sistema centralizado de notificaciones y lecturas por usuario
        await db.execute(`
            CREATE TABLE IF NOT EXISTS notificaciones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NULL,
                rol_destino VARCHAR(20) NOT NULL DEFAULT 'cliente',
                tipo VARCHAR(40) NOT NULL DEFAULT 'sistema',
                titulo VARCHAR(160) NOT NULL,
                mensaje TEXT NOT NULL,
                enlace VARCHAR(160) NULL,
                referencia_id INT NULL,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_notif_destino (rol_destino, usuario_id, creado_en)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS notificaciones_leidas (
                notificacion_id INT NOT NULL,
                usuario_id INT NOT NULL,
                leido_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (notificacion_id, usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Campos de trazabilidad para Pase Amigo, días gratis y cupones
        await ensureColumnExists("usuarios_invitados", "oferta_id", "INT NULL DEFAULT NULL AFTER creado_por_admin_id");
        await ensureColumnExists("usuarios_invitados", "invitado_por_usuario_id", "INT NULL DEFAULT NULL AFTER oferta_id");
        await ensureColumnExists("usuarios_invitados", "codigo_pase", "VARCHAR(50) NULL DEFAULT NULL AFTER invitado_por_usuario_id");
        await ensureColumnExists("ofertas_usos", "cantidad_invitados", "INT NOT NULL DEFAULT 1 AFTER descuento_aplicado");
        await ensureColumnExists("asistencias", "invitados_count", "INT NOT NULL DEFAULT 0 AFTER metodo_registro");
        await ensureColumnExists("asistencias", "invitado_nombres", "VARCHAR(255) NULL DEFAULT NULL AFTER invitados_count");
        await ensureColumnExists("asistencias", "pase_oferta_id", "INT NULL DEFAULT NULL AFTER invitado_nombres");
        await ensureColumnExists("membresias", "oferta_id", "INT NULL DEFAULT NULL AFTER estado");
        await ensureColumnExists("membresias", "dias_extra", "INT NOT NULL DEFAULT 0 AFTER oferta_id");
        await ensureColumnExists("pagos", "descuento_aplicado", "DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER metodo_pago");
        await ensureColumnExists("pagos", "codigo_cupon", "VARCHAR(50) NULL DEFAULT NULL AFTER descuento_aplicado");

        // Tablas para huellero ZKTeco (LAN / USB pendrive / Cable USB) y lector USB de escritorio
        await db.execute(`
            CREATE TABLE IF NOT EXISTS asistencia_marcaciones_zk (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NULL,
                dni VARCHAR(15) NOT NULL,
                fecha_hora DATETIME NOT NULL,
                origen VARCHAR(24) NOT NULL DEFAULT 'ZK_LIVE',
                dispositivo VARCHAR(80) NOT NULL DEFAULT 'ZKTECO',
                resultado VARCHAR(40) NOT NULL DEFAULT 'PROCESADO',
                detalle VARCHAR(200) NULL,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_zk_dni_fh (dni, fecha_hora)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS socio_huellas_usb (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL UNIQUE,
                dni VARCHAR(15) NOT NULL UNIQUE,
                template LONGTEXT NOT NULL,
                formato VARCHAR(40) NOT NULL DEFAULT 'ZKFINGER',
                dispositivo VARCHAR(80) NULL,
                actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        const [zkTokRows] = await db.execute(
            "SELECT valor FROM configuracion WHERE clave = 'zk_sync_token' LIMIT 1",
        );
        if (!zkTokRows.length || !zkTokRows[0].valor) {
            const crypto = require("node:crypto");
            await db.execute(
                `INSERT INTO configuracion (clave, valor) VALUES ('zk_sync_token', ?)
                 ON DUPLICATE KEY UPDATE valor = IF(valor IS NULL OR valor = '', VALUES(valor), valor)`,
                [crypto.randomUUID()],
            );
        }

        // Normalizar descripciones de planes con caracteres dañados (?) en importaciones previas
        await db.execute(`
            UPDATE planes_membresia
            SET descripcion = REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(descripcion, 'Promoci?n', 'Promoción'),
                        'promoci?n', 'promoción'
                    ),
                    'd?as', 'días'
                ),
                'a?o', 'año'
            )
            WHERE descripcion LIKE '%?%'
        `);
        
    } catch (error) {
        console.error("Error ejecutando migraciones de esquema:", error);
    }
}

module.exports = { runSchemaMigrations };
