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

function formatMysqlDatetime(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
        date.getHours(),
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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

module.exports = {
    TOLERANCE_MINUTES,
    formatDurationLabel,
    getEndOfGymDay,
    isValidGymSchedule,
    formatMysqlDatetime,
};
