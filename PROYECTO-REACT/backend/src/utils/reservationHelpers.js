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

module.exports = {
    TOLERANCE_MINUTES,
    formatDurationLabel,
    getEndOfGymDay,
    formatMysqlDatetime,
};
