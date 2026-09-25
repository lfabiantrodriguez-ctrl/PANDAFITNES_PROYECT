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
    } catch (error) {
        console.error("Error ejecutando migraciones de esquema:", error);
    }
}

module.exports = { runSchemaMigrations };
