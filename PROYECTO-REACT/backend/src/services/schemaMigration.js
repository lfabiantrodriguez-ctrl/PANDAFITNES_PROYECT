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

async function runSchemaMigrations() {
    try {
        await ensureEstadoEnumValues(["finalizada", "cancelada_emergencia"]);

        await ensureColumnExists(
            "reservas",
            "tipo",
            "ENUM('normal', 'reintegro_emergencia') NOT NULL DEFAULT 'normal' AFTER estado",
        );
        await ensureColumnExists(
            "reservas",
            "reserva_origen_id",
            "INT NULL AFTER tipo",
        );
        await ensureColumnExists(
            "reservas",
            "duracion_minutos",
            "INT NULL AFTER reserva_origen_id",
        );
        await ensureColumnExists(
            "reservas",
            "cancelada_emergencia",
            "TINYINT(1) NOT NULL DEFAULT 0 AFTER duracion_minutos",
        );
    } catch (error) {
        console.error("Error ejecutando migraciones de esquema:", error);
    }
}

module.exports = { runSchemaMigrations };
