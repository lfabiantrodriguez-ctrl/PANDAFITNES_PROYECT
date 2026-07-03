const REFUND_DURATION_MAP = {
    60: 60,
    90: 60,
    120: 90,
    150: 120,
    180: 150,
};

const CANCEL_WINDOW_MINUTES = 30;
const TOLERANCE_MINUTES = 15;

function calculateDurationMinutes(horaEntrada, horaSalida) {
    const start = new Date(horaEntrada);
    const end = new Date(horaSalida);
    return Math.round((end.getTime() - start.getTime()) / 60_000);
}

function getRefundDurationMinutes(originalDurationMinutes) {
    return REFUND_DURATION_MAP[originalDurationMinutes] ?? null;
}

function formatDurationLabel(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${mins}min`;
}

function getCancelWindowStatus(now, entryTime) {
    const entry = new Date(entryTime);
    const cancelWindowEnd = new Date(entry.getTime() + CANCEL_WINDOW_MINUTES * 60_000);

    if (now < entry) {
        return {
            canCancel: false,
            minutesRemaining: 0,
            detail: "La ventana de cancelacion por emergencia inicia a la hora programada",
        };
    }

    if (now <= cancelWindowEnd) {
        const minutesRemaining = Math.max(0, Math.ceil((cancelWindowEnd.getTime() - now.getTime()) / 60_000));
        return {
            canCancel: true,
            minutesRemaining,
            detail: `${minutesRemaining} min restantes para cancelar por emergencia`,
        };
    }

    return {
        canCancel: false,
        minutesRemaining: 0,
        detail: "Ventana de cancelacion por emergencia expirada (30 min desde el inicio)",
    };
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
    REFUND_DURATION_MAP,
    CANCEL_WINDOW_MINUTES,
    TOLERANCE_MINUTES,
    calculateDurationMinutes,
    getRefundDurationMinutes,
    formatDurationLabel,
    getCancelWindowStatus,
    getEndOfGymDay,
    formatMysqlDatetime,
};
