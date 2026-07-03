const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const JWT_SECRET = process.env.JWT_SECRET || "panda_fitness_dev_secret";

function publicUser(row) {
    return {
        id: row.id,
        nombre: row.nombre,
        apellido: row.apellido,
        dni: row.dni,
        email: row.email,
        telefono: row.telefono,
        rol: row.rol,
    };
}

function signToken(user) {
    return jwt.sign(
        {
            id: user.id,
            rol: user.rol,
        },
        JWT_SECRET,
        { expiresIn: "8h" },
    );
}

async function verifyPassword(password, passwordHash) {
    if (!passwordHash) {
        return false;
    }

    if (passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$") || passwordHash.startsWith("$2y$")) {
        return bcrypt.compare(password, passwordHash);
    }

    return password === passwordHash;
}

function isValidDni(dni) {
    return /^\d{8}$/.test(String(dni || ""));
}

function toDateOnly(date) {
    return date.toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
    const date = new Date(`${dateValue}T00:00:00`);
    date.setDate(date.getDate() + Number(days));
    return toDateOnly(date);
}

function addDaysExcludingSundays(dateValue, days) {
    const date = new Date(`${dateValue}T00:00:00`);
    let count = 0;
    while (count < days) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0) {
            count++;
        }
    }
    return toDateOnly(date);
}

function getCurrentWeekRange() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: toDateOnly(monday), end: toDateOnly(sunday) };
}

function normalizeDniResponse(raw, dni) {
    let data = raw;

    if (typeof raw === "string") {
        try {
            data = JSON.parse(raw);
        } catch {
            return null;
        }
    }

    const source = data.data || data.result || data.persona || data;
    
    //compatibilidad con ambas APIs para evitar errores
    const nombres =
        source.first_name ||
        source.NOMBRES ||
        source.nombres ||
        source.nombre ||
        source.NOMBRE ||
        source.name ||
        "";

    const apellidoPaterno =
        source.first_last_name ||
        source.AP_PAT ||
        source.apellido_paterno ||
        source.apellidoPaterno ||
        source.paterno ||
        "";

    const apellidoMaterno =
        source.second_last_name ||
        source.AP_MAT ||
        source.apellido_materno ||
        source.apellidoMaterno ||
        source.materno ||
        "";
    
    const apellidoCompleto =
        source.full_name
            ? `${apellidoPaterno} ${apellidoMaterno}`.trim()
            : (source.APELLIDOS ||
                source.apellidos ||
                source.apellido ||
                `${apellidoPaterno} ${apellidoMaterno}`.trim());

    if (!nombres && !apellidoCompleto) {
        return null;
    }

    return {
        dni: source.document_number || dni,
        nombre: nombres.trim(),
        apellido: apellidoCompleto.trim(),
    };
}

module.exports = {
    JWT_SECRET,
    publicUser,
    signToken,
    verifyPassword,
    isValidDni,
    toDateOnly,
    addDays,
    addDaysExcludingSundays,
    getCurrentWeekRange,
    normalizeDniResponse,
};
