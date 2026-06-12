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

function normalizeDniResponse(raw, dni) {
    let data = raw;

    if (typeof raw === "string") {
        try {
            data = JSON.parse(raw);
        } catch {
            data = { texto: raw };
        }
    }

    const source = data.data || data.result || data.persona || data;
    
    const nombres = source.NOMBRES || source.nombres || source.nombre || source.NOMBRE || source.name || "";
    const apellidoPaterno = source.AP_PAT || source.apellido_paterno || source.apellidoPaterno || source.paterno || source.PATERNO || "";
    const apellidoMaterno = source.AP_MAT || source.apellido_crumbs || source.apellido_materno || source.apellidoMaterno || source.materno || source.MATERNO || "";
    const apellidoCompleto = source.APELLIDOS || source.apellidos || source.apellido || [apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ");

    if (!nombres && !apellidoCompleto) {
        return null;
    }

    return {
        dni,
        nombre: String(nombres).trim(),
        apellido: String(apellidoCompleto).trim(),
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
    normalizeDniResponse,
};
