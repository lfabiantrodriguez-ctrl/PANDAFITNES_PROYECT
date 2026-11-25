const db = require("../config/database");
const TOLERANCE_MINUTES = 15;

function formatDurationLabel(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${mins}min`;
}

function getEndOfGymDay(date) {
    const dayOfWeek = date.getDay();
    const end = new Date(date);

    if (dayOfWeek === 6) {
        end.setHours(12, 0, 0, 0);
    } else if (dayOfWeek === 0) {
        end.setHours(23, 59, 59, 999);
    } else {
        const currentMinutes = date.getHours() * 60 + date.getMinutes();
        if (currentMinutes < 660) {
            end.setHours(11, 0, 0, 0);
        } else {
            end.setHours(22, 0, 0, 0);
        }
    }

    if (end.getTime() <= date.getTime()) {
        end.setHours(22, 0, 0, 0);
        if (end.getTime() <= date.getTime()) {
            end.setHours(23, 59, 59, 999);
        }
    }

    return end;
}

function formatMysqlDatetime(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const p = Object.fromEntries(formatter.formatToParts(d).map((x) => [x.type, x.value]));
    const hour = p.hour === '24' ? '00' : p.hour;
    return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}:${p.second}`;
}

function isValidGymSchedule(dateTime, durationMinutes) {
    const dayOfWeek = dateTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (dayOfWeek === 0) return false; // Closed Sunday

    const entryHour = dateTime.getHours();
    const entryMinutes = entryHour * 60 + dateTime.getMinutes();
    const exitMinutes = entryMinutes + Number(durationMinutes || 0);

    if (dayOfWeek === 6) {
        // Saturday: 7:00 AM to 12:00 PM (420 to 720 minutes)
        return entryMinutes >= 420 && exitMinutes <= 720;
    } else {
        // Monday to Friday: 6:30 AM to 11:00 AM (390 to 660) and 4:00 PM to 10:00 PM (960 to 1320)
        const inMorningShift = entryMinutes >= 390 && exitMinutes <= 660;
        const inEveningShift = entryMinutes >= 960 && exitMinutes <= 1320;
        return inMorningShift || inEveningShift;
    }
}

async function isValidConfiguredSchedule(dateTime, durationMinutes = 0) {
    const d = dateTime instanceof Date ? dateTime : new Date(dateTime);
    const dayOfWeek = d.getDay();
    const entryMinutes = d.getHours() * 60 + d.getMinutes();
    const exitMinutes = entryMinutes + Number(durationMinutes || 0);

    try {
        const [rows] = await db.execute("SELECT clave, valor FROM configuracion WHERE clave LIKE 'horario_%'");
        const config = {};
        for (const row of rows) config[row.clave] = row.valor;

        const toMins = (timeStr, def) => {
            const [h, m] = String(timeStr || def).split(":").map(Number);
            return (h || 0) * 60 + (m || 0);
        };

        if (dayOfWeek === 0) {
            if (config.horario_domingo_abierto !== "1") return false;
            const domStart = toMins(config.horario_domingo_inicio, "08:00");
            const domEnd = toMins(config.horario_domingo_fin, "13:00");
            const inFirst = entryMinutes >= domStart && exitMinutes <= domEnd;
            if (config.horario_domingo_modalidad === "partido") {
                const domPmStart = toMins(config.horario_domingo_tarde_inicio, "16:00");
                const domPmEnd = toMins(config.horario_domingo_tarde_fin, "20:00");
                return inFirst || (entryMinutes >= domPmStart && exitMinutes <= domPmEnd);
            }
            return inFirst;
        }

        if (dayOfWeek === 6) {
            if (config.horario_sabado_estado === "0") return false;
            const sStart = toMins(config.horario_sabado_inicio, "07:00");
            const sEnd = toMins(config.horario_sabado_fin, "12:00");
            const inFirst = entryMinutes >= sStart && exitMinutes <= sEnd;
            if (config.horario_sabado_modalidad === "partido") {
                const sPmStart = toMins(config.horario_sabado_tarde_inicio, "16:00");
                const sPmEnd = toMins(config.horario_sabado_tarde_fin, "20:00");
                return inFirst || (entryMinutes >= sPmStart && exitMinutes <= sPmEnd);
            }
            return inFirst;
        }

        if (config.horario_semana_modalidad === "continuo") {
            const cStart = toMins(config.horario_semana_corrido_inicio || config.horario_semana_manana_inicio, "06:30");
            const cEnd = toMins(config.horario_semana_corrido_fin || config.horario_semana_tarde_fin, "22:00");
            return entryMinutes >= cStart && exitMinutes <= cEnd;
        }

        const mStart = toMins(config.horario_semana_manana_inicio, "06:30");
        const mEnd = toMins(config.horario_semana_manana_fin, "11:00");
        const tStart = toMins(config.horario_semana_tarde_inicio, "16:00");
        const tEnd = toMins(config.horario_semana_tarde_fin, "22:00");
        return (entryMinutes >= mStart && exitMinutes <= mEnd) || (entryMinutes >= tStart && exitMinutes <= tEnd);
    } catch {
        return isValidGymSchedule(d, durationMinutes);
    }
}

module.exports = {
    TOLERANCE_MINUTES,
    formatDurationLabel,
    getEndOfGymDay,
    isValidGymSchedule,
    isValidConfiguredSchedule,
    formatMysqlDatetime,
};
