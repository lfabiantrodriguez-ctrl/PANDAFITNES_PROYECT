const crypto = require("node:crypto");
const db = require("../config/database");
const UserModel = require("../models/UserModel");
const MembershipModel = require("../models/MembershipModel");
const AttendanceModel = require("../models/AttendanceModel");
const ReservationModel = require("../models/ReservationModel");
const { formatMysqlDatetime } = require("../utils/reservationHelpers");

const ALLOWED_ORIGENS = new Set([
    "ZK_LIVE",
    "ZK_SYNC",
    "ZK_ARCHIVO",
    "ZK_USB",
    "USB_LECTOR",
    "ADMS",
]);

function normalizeFechaHora(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(str)) {
        const clean = str.replace("T", " ");
        return clean.length === 16 ? `${clean}:00` : clean;
    }
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    return formatMysqlDatetime(d);
}

const MIN_EXIT_MINUTES = 1;

function parseFechaHoraDate(mysqlVal) {
    if (!mysqlVal) return null;
    if (mysqlVal instanceof Date) {
        return Number.isNaN(mysqlVal.getTime()) ? null : mysqlVal;
    }
    const str = String(mysqlVal).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(str)) {
        const d = new Date(str.replace(" ", "T"));
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
}

function todayPrefix() {
    return formatMysqlDatetime(new Date()).slice(0, 10);
}

async function getZkToken() {
    const [rows] = await db.execute(
        "SELECT valor FROM configuracion WHERE clave = 'zk_sync_token' LIMIT 1",
    );
    if (rows[0]?.valor) {
        return rows[0].valor;
    }
    const token = crypto.randomUUID();
    await db.execute(
        `INSERT INTO configuracion (clave, valor) VALUES ('zk_sync_token', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [token],
    );
    return token;
}

async function regenerateZkToken() {
    const token = crypto.randomUUID();
    await db.execute(
        `INSERT INTO configuracion (clave, valor) VALUES ('zk_sync_token', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [token],
    );
    return token;
}

async function validateZkToken(provided) {
    if (!provided || typeof provided !== "string") return false;
    const expected = await getZkToken();
    const a = Buffer.from(provided.trim());
    const b = Buffer.from(expected.trim());
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function parseAttlogText(content) {
    const lines = String(content || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const marcaciones = [];
    for (const line of lines) {
        if (line.startsWith("#") || /^(dni|user|userid|pin)/i.test(line)) {
            continue;
        }
        const parts = line.split(/[\t,;]+/).map((p) => p.trim());
        if (parts.length < 2) continue;
        const dni = parts[0].replace(/\D/g, "");
        const fechaHora = normalizeFechaHora(parts[1]);
        if (!dni || !fechaHora) continue;
        marcaciones.push({
            dni,
            fechaHora,
            origen: "ZK_ARCHIVO",
            dispositivo: "USB_PENDRIVE",
        });
    }
    return marcaciones;
}

async function processSingleMarcacion(item, defaultOrigen = "ZK_LIVE", defaultDispositivo = "ZKTECO") {
    const dni = String(item?.dni || "").trim();
    const fechaHora = normalizeFechaHora(item?.fechaHora);
    const rawOrigen = String(item?.origen || defaultOrigen).toUpperCase().trim();
    const origen = ALLOWED_ORIGENS.has(rawOrigen) ? rawOrigen : defaultOrigen;
    const dispositivo = String(item?.dispositivo || defaultDispositivo).slice(0, 80);

    if (!dni || !fechaHora) {
        return { status: "error", detalle: "DNI o fechaHora inválidos" };
    }

    // Inserción idempotente para evitar duplicados ante reintentos del agente o reimportaciones
    const [insertRes] = await db.execute(
        `INSERT IGNORE INTO asistencia_marcaciones_zk (dni, fecha_hora, origen, dispositivo, resultado)
         VALUES (?, ?, ?, ?, 'PENDIENTE')`,
        [dni, fechaHora, origen, dispositivo],
    );

    if (insertRes.affectedRows === 0) {
        return { status: "duplicada", dni, fechaHora, detalle: "Marcación ya registrada" };
    }

    const markId = insertRes.insertId;
    const markDate = parseFechaHoraDate(fechaHora);
    const markDay = fechaHora.slice(0, 10);
    const isToday = markDay === todayPrefix();

    const updateMark = async (usuarioId, resultado, detalle) => {
        await db.execute(
            `UPDATE asistencia_marcaciones_zk SET usuario_id = ?, resultado = ?, detalle = ? WHERE id = ?`,
            [usuarioId || null, resultado, String(detalle || "").slice(0, 200), markId],
        );
    };

    const user = await UserModel.findActiveByDni(dni);
    if (!user) {
        await updateMark(null, "NO_ENCONTRADO", "DNI no registrado como socio activo");
        return { status: "no_encontrado", dni, fechaHora };
    }

    const membership = await MembershipModel.getClientMembership(user.id);
    const isValidMembership =
        membership &&
        membership.estado === "activo" &&
        new Date(membership.fechaFin) >= new Date(markDay);

    if (!isValidMembership) {
        await updateMark(user.id, "MEMBRESIA_INACTIVA", "Membresía vencida o inactiva");
        return { status: "membresia_inactiva", dni, fechaHora, nombre: `${user.nombre} ${user.apellido}` };
    }

    // Buscar si ya tiene asistencia abierta ese día o actualmente en sala
    const active = await AttendanceModel.findActiveByUser(user.id);

    if (active && isToday) {
        const entradaDate = parseFechaHoraDate(active.horaEntrada);
        const diffMin = entradaDate && markDate
            ? Math.floor((markDate.getTime() - entradaDate.getTime()) / 60000)
            : 0;

        if (diffMin < 0) {
            await updateMark(user.id, "IGNORADO_REBOTE", `Marca anterior al ingreso activo (${diffMin} min)`);
            return { status: "rebote", dni, fechaHora };
        }

        // Filtro anti-rebote (1 minuto) para evitar que un doble toque inmediato cierre la sesión
        if (diffMin < MIN_EXIT_MINUTES) {
            await updateMark(user.id, "IGNORADO_REBOTE", `Rebote ignorado (${diffMin} min desde ingreso)`);
            return { status: "rebote", dni, fechaHora };
        }

        await AttendanceModel.setExitById(active.id, fechaHora);
        if (active.reservaId) {
            await ReservationModel.updateStatus(active.reservaId, "finalizada").catch(() => {});
        }
        await updateMark(user.id, "SALIDA", `Salida registrada (${diffMin} min en sala)`);
        return { status: "salida", dni, fechaHora, nombre: `${user.nombre} ${user.apellido}` };
    }

    // Para fechas pasadas (sincronización histórica / archivo USB), buscar si ya existe entrada sin salida ese día
    if (!isToday) {
        const [sameDayRows] = await db.execute(
            `SELECT id, hora_entrada AS horaEntrada, hora_salida AS horaSalida
             FROM asistencias
             WHERE usuario_id = ? AND DATE(hora_entrada) = ?
             ORDER BY hora_entrada DESC LIMIT 1`,
            [user.id, markDay],
        );
        const sameDay = sameDayRows[0];
        if (sameDay && !sameDay.horaSalida) {
            const entDate = parseFechaHoraDate(sameDay.horaEntrada);
            const diffMin = entDate && markDate ? Math.floor((markDate.getTime() - entDate.getTime()) / 60000) : 0;
            if (diffMin >= MIN_EXIT_MINUTES) {
                await AttendanceModel.setExitById(sameDay.id, fechaHora);
                await updateMark(user.id, "SALIDA", `Salida histórica registrada (${diffMin} min)`);
                return { status: "salida", dni, fechaHora, nombre: `${user.nombre} ${user.apellido}` };
            }
            await updateMark(user.id, "IGNORADO_REBOTE", "Marca histórica dentro de ventana anti-rebote");
            return { status: "rebote", dni, fechaHora };
        }
        if (sameDay && sameDay.horaSalida) {
            await updateMark(user.id, "IGNORADO_REBOTE", "Turno histórico del día ya completado");
            return { status: "rebote", dni, fechaHora };
        }
    }

    // Registrar nueva entrada
    const endDate = new Date((markDate || new Date()).getTime() + 60 * 60000);
    const reservation = await ReservationModel.create({
        usuarioId: user.id,
        horaEntrada: fechaHora,
        horaSalida: formatMysqlDatetime(endDate),
        tipo: "checkin_directo",
        reservaOrigenId: null,
        duracionMinutos: 60,
    });
    await ReservationModel.updateStatus(reservation.id, isToday ? "confirmada" : "finalizada");

    await AttendanceModel.create({
        reservaId: reservation.id,
        usuarioId: user.id,
        horaEntrada: fechaHora,
        metodoRegistro: "huella",
    });

    await updateMark(user.id, "ENTRADA", `Entrada autorizada (${origen})`);
    return { status: "entrada", dni, fechaHora, nombre: `${user.nombre} ${user.apellido}` };
}

async function registrarMarcacionesZk(lista, defaultOrigen = "ZK_LIVE", defaultDispositivo = "ZKTECO") {
    const items = Array.isArray(lista) ? [...lista] : [lista];
    items.sort((a, b) => String(a?.fechaHora || "").localeCompare(String(b?.fechaHora || "")));

    const summary = {
        totalRecibidas: items.length,
        entradas: 0,
        salidas: 0,
        duplicadas: 0,
        rebotes: 0,
        noEncontrados: 0,
        membresiaInactiva: 0,
        errores: 0,
        detalles: [],
    };

    for (const item of items) {
        const res = await processSingleMarcacion(item, defaultOrigen, defaultDispositivo);
        if (res.status === "entrada") summary.entradas += 1;
        else if (res.status === "salida") summary.salidas += 1;
        else if (res.status === "duplicada") summary.duplicadas += 1;
        else if (res.status === "rebote") summary.rebotes += 1;
        else if (res.status === "no_encontrado") summary.noEncontrados += 1;
        else if (res.status === "membresia_inactiva") summary.membresiaInactiva += 1;
        else summary.errores += 1;

        if (summary.detalles.length < 30 && res.status !== "duplicada") {
            summary.detalles.push(res);
        }
    }

    return summary;
}

async function getRecentMarcaciones(limit = 20) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [rows] = await db.execute(
        `SELECT z.id, z.dni, z.fecha_hora AS fechaHora, z.origen, z.dispositivo, z.resultado, z.detalle,
                u.nombre, u.apellido
         FROM asistencia_marcaciones_zk z
         LEFT JOIN usuarios u ON u.id = z.usuario_id
         ORDER BY z.id DESC
         LIMIT ${safeLimit}`,
    );
    return rows;
}

async function listUsbTemplates() {
    const [rows] = await db.execute(
        `SELECT h.usuario_id AS usuarioId, h.dni, h.template, h.formato, h.dispositivo,
                u.nombre, u.apellido
         FROM socio_huellas_usb h
         INNER JOIN usuarios u ON u.id = h.usuario_id
         WHERE u.activo = 1`,
    );
    return rows;
}

async function saveUsbTemplate({ dni, template, formato = "ZKFINGER", dispositivo = "USB_LECTOR" }) {
    const cleanDni = String(dni || "").trim();
    if (!/^\d{8}$/.test(cleanDni)) {
        throw new Error("El DNI debe tener exactamente 8 dígitos.");
    }
    const cleanTemplate = String(template || "").trim();
    if (!cleanTemplate) {
        throw new Error("La plantilla biométrica de la huella es requerida.");
    }

    const user = await UserModel.findActiveByDni(cleanDni);
    if (!user) {
        throw new Error("No existe un socio activo con ese DNI.");
    }

    await db.execute(
        `INSERT INTO socio_huellas_usb (usuario_id, dni, template, formato, dispositivo)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           dni = VALUES(dni),
           template = VALUES(template),
           formato = VALUES(formato),
           dispositivo = VALUES(dispositivo)`,
        [user.id, cleanDni, cleanTemplate, String(formato).slice(0, 40), String(dispositivo).slice(0, 80)],
    );

    return {
        usuarioId: user.id,
        dni: cleanDni,
        nombre: `${user.nombre} ${user.apellido}`,
        formato,
    };
}

module.exports = {
    getZkToken,
    regenerateZkToken,
    validateZkToken,
    parseAttlogText,
    registrarMarcacionesZk,
    getRecentMarcaciones,
    listUsbTemplates,
    saveUsbTemplate,
};
