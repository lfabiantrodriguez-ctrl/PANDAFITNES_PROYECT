process.env.TZ = "America/Lima";
require("dotenv").config({ quiet: true });

const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const db = require("./config/database");
const { runSchemaMigrations } = require("./services/schemaMigration");
const roleAccess = require("./services/roleAccess");
const deviceAccess = require("./services/deviceAccess");
const AttendanceModel = require("./models/AttendanceModel");
const { formatMysqlDatetime } = require("./utils/reservationHelpers");

function limaTodayStr(offsetDays = 0) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}

function datetimeMinutesAgo(mins) {
    return formatMysqlDatetime(new Date(Date.now() - mins * 60000));
}

function datetimeAtDayAndHour(offsetDays, hour, minute = 0) {
    const base = limaTodayStr(offsetDays);
    const pad = (n) => String(n).padStart(2, "0");
    return `${base} ${pad(hour)}:${pad(minute)}:00`;
}

async function upsertRole(nombre, etiqueta, descripcion, permisos) {
    const [existing] = await db.execute("SELECT id FROM roles WHERE nombre = ? LIMIT 1", [nombre]);
    let roleId;
    if (!existing[0]) {
        const [ins] = await db.execute("INSERT INTO roles (nombre) VALUES (?)", [nombre]);
        roleId = ins.insertId;
    } else {
        roleId = existing[0].id;
    }

    await db.execute(
        `INSERT INTO role_access (rol_id, etiqueta, descripcion, permisos)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           etiqueta = VALUES(etiqueta),
           descripcion = VALUES(descripcion),
           permisos = VALUES(permisos)`,
        [roleId, etiqueta, descripcion, JSON.stringify(permisos)],
    );
    return roleId;
}

async function upsertUser({ nombre, apellido, dni, email, telefono, passwordHash, rolId, activo = 1, diasObjetivo = "1,2,4,5", horarioPreferido = "07:00 - 08:30", bambusCanjeados = 0 }) {
    const [existing] = await db.execute(
        "SELECT id, password_hash FROM usuarios WHERE dni = ? OR email = ? LIMIT 1",
        [dni, email],
    );

    if (existing[0]) {
        const keepHash = existing[0].password_hash || passwordHash;
        await db.execute(
            `UPDATE usuarios
             SET nombre = ?, apellido = ?, dni = ?, email = ?, telefono = ?, password_hash = ?,
                 rol_id = ?, activo = ?, dias_objetivo = ?, horario_preferido = ?
             WHERE id = ?`,
            [nombre, apellido, dni, email, telefono, keepHash, rolId, activo, diasObjetivo, horarioPreferido, existing[0].id],
        );
        return existing[0].id;
    }

    const [ins] = await db.execute(
        `INSERT INTO usuarios
         (nombre, apellido, dni, email, password_hash, telefono, rol_id, activo, dias_objetivo, horario_preferido, bambus_canjeados)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nombre, apellido, dni, email, passwordHash, telefono, rolId, activo, diasObjetivo, horarioPreferido, bambusCanjeados],
    );
    return ins.insertId;
}

async function main() {
    const resetMode = process.argv.includes("--reset");
    console.log(resetMode ? "Reiniciando y sembrando base de datos Panda Fitness..." : "Sembrando datos demo en Panda Fitness...");

    await runSchemaMigrations();
    await roleAccess.init();
    await deviceAccess.init();

    if (resetMode) {
        await db.execute("SET FOREIGN_KEY_CHECKS = 0");
        for (const tbl of [
            "asistencia_marcaciones_zk",
            "asistencias",
            "reservas",
            "pagos",
            "membresias",
            "canjes_recompensas",
            "ofertas_socios",
            "usuarios_invitados",
            "socio_huellas_usb",
            "socio_dispositivos",
            "staff_member_links",
        ]) {
            await db.execute(`TRUNCATE TABLE ${tbl}`);
        }
        await db.execute("DELETE u FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.email <> 'admin@gmail.com'");
        await db.execute("SET FOREIGN_KEY_CHECKS = 1");
    }

    // 1. Planes base si faltaran
    const defaultPlans = [
        ["Mensual", 30, null, null, 80.0, "Plan mensual acceso libre"],
        ["Bimestral", 60, null, null, 150.0, "Promoción de 2 meses"],
        ["Trimestral", 90, null, null, 200.0, "Promoción de 3 meses"],
        ["Interdiario", 15, 3, 15, 50.0, "Plan especial con 3 sesiones por semana"],
        ["Anual", 365, null, null, 800.0, "Super promoción de un año"],
    ];
    for (const [nombre, dias, limSem, totRes, precio, desc] of defaultPlans) {
        const [found] = await db.execute("SELECT id FROM planes_membresia WHERE nombre = ? LIMIT 1", [nombre]);
        if (!found[0]) {
            await db.execute(
                "INSERT INTO planes_membresia (nombre, duracion_dias, limite_semanal, total_reservas, precio, descripcion) VALUES (?, ?, ?, ?, ?, ?)",
                [nombre, dias, limSem, totRes, precio, desc],
            );
        }
    }
    const [planRows] = await db.execute("SELECT id, nombre, duracion_dias, precio FROM planes_membresia");
    const planByName = Object.fromEntries(planRows.map((p) => [p.nombre.toLowerCase(), p]));

    // 2. Roles y permisos del sistema
    const [adminRoleRows] = await db.execute("SELECT id FROM roles WHERE nombre = 'admin' LIMIT 1");
    const [clientRoleRows] = await db.execute("SELECT id FROM roles WHERE nombre = 'cliente' LIMIT 1");
    const adminRoleId = adminRoleRows[0]?.id;
    const clientRoleId = clientRoleRows[0]?.id;

    const recepRoleId = await upsertRole(
        "recepcion",
        "Recepción / Counter",
        "Control de accesos, check-in, registro de socios, clientes diarios y canje de premios.",
        ["inicio", "socios", "invitados", "recompensas"],
    );
    const coachRoleId = await upsertRole(
        "entrenador",
        "Entrenador / Trainer",
        "Supervisión de sala, aforo en tiempo real, asistencias y acompañamiento.",
        ["inicio", "recompensas"],
    );
    const supervisorRoleId = await upsertRole(
        "supervisor",
        "Supervisor de Sede",
        "Gestión operativa completa de socios, invitados, recompensas y configuración del club.",
        ["inicio", "socios", "invitados", "recompensas", "configuracion"],
    );

    // 3. Configuración completa (horarios continuos amigables para cualquier hora de exposición)
    const configEntries = [
        ["empresa_nombre", "Panda Fitness"],
        ["empresa_descripcion", "Centro de Entrenamiento & Fitness Integral"],
        ["empresa_logo", "/logo-panda.png"],
        ["max_capacidad", "50"],
        ["horario_semana_modalidad", "continuo"],
        ["horario_semana_corrido_inicio", "06:00"],
        ["horario_semana_corrido_fin", "22:30"],
        ["horario_semana_manana_inicio", "06:30"],
        ["horario_semana_manana_fin", "12:00"],
        ["horario_semana_tarde_inicio", "15:00"],
        ["horario_semana_tarde_fin", "22:00"],
        ["horario_sabado_estado", "1"],
        ["horario_sabado_modalidad", "continuo"],
        ["horario_sabado_inicio", "07:00"],
        ["horario_sabado_fin", "19:00"],
        ["horario_domingo_abierto", "1"],
        ["horario_domingo_modalidad", "continuo"],
        ["horario_domingo_inicio", "08:00"],
        ["horario_domingo_fin", "14:00"],
        ["estado_operativo", "normal"],
        ["aviso_activo", "1"],
        ["aviso_titulo", "Horario Extendido & Reto Panda"],
        ["aviso_mensaje", "Acumula puntos Bambú con cada asistencia y canjéalos en recepción por suplementos y pases gratis."],
        ["landing_gym_direccion", "Av. Principal Los Olivos 450, Centro Deportivo Panda"],
        ["landing_gym_telefono", "+51 987 654 321"],
        ["landing_redes_instagram", "pandafitness_oficial"],
        ["landing_redes_tiktok", "@pandafitness_gym"],
        ["landing_redes_whatsapp", "+51 987 654 321"],
        ["panda_base_xp", "25"],
        ["panda_base_bambus", "10"],
    ];
    for (const [clave, valor] of configEntries) {
        await db.execute(
            `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
            [clave, valor],
        );
    }

    // 4. Usuarios Staff y Socios Demo
    const adminHash = await bcrypt.hash("admin@123", 12);
    const staffHash = await bcrypt.hash("Panda2026!", 12);
    const memberHash = await bcrypt.hash("Cliente2026!", 12);

    const adminId = await upsertUser({
        nombre: "Administrador",
        apellido: "General",
        dni: "00000000",
        email: "admin@gmail.com",
        telefono: "999999999",
        passwordHash: adminHash,
        rolId: adminRoleId,
        activo: 1,
    });

    await upsertUser({
        nombre: "Valeria",
        apellido: "Mendoza",
        dni: "40100101",
        email: "recepcion@pandafitness.pe",
        telefono: "981100101",
        passwordHash: staffHash,
        rolId: recepRoleId,
        activo: 1,
    });

    const coachId = await upsertUser({
        nombre: "Diego",
        apellido: "Paredes",
        dni: "40100102",
        email: "coach@pandafitness.pe",
        telefono: "981100102",
        passwordHash: staffHash,
        rolId: coachRoleId,
        activo: 1,
    });

    await upsertUser({
        nombre: "Lucía",
        apellido: "Torres",
        dni: "40100103",
        email: "supervisor@pandafitness.pe",
        telefono: "981100103",
        passwordHash: staffHash,
        rolId: supervisorRoleId,
        activo: 1,
    });

    // Vincular al entrenador su propio perfil de socio para demostrar experiencia mixta
    await db.execute(
        `INSERT INTO staff_member_links (staff_user_id, member_user_id, linked_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE linked_by = VALUES(linked_by)`,
        [coachId, coachId, adminId],
    );

    const socioSpecs = [
        { dni: "12345678", nombre: "Brayan", apellido: "García", email: "brayan.cliente@gmail.com", tel: "987654321", plan: "Trimestral", startOffset: -30, endOffset: 60, estado: "activo", payOffset: -12, payMethod: "yape" },
        { dni: "73781820", nombre: "Carlos", apellido: "Santamaría", email: "santamariabrayan966@gmail.com", tel: "966112233", plan: "Mensual", startOffset: -5, endOffset: 25, estado: "activo", payOffset: -5, payMethod: "plin" },
        { dni: "87654321", nombre: "María Fernanda", apellido: "López", email: "cliente@gmail.com", tel: "955443322", plan: "Anual", startOffset: -45, endOffset: 320, estado: "activo", payOffset: -14, payMethod: "tarjeta" },
        { dni: "71234501", nombre: "Sebastián", apellido: "Quispe", email: "sebastian.quispe@demo.pe", tel: "944110001", plan: "Mensual", startOffset: -27, endOffset: 3, estado: "activo", payOffset: -27, payMethod: "efectivo" },
        { dni: "71234502", nombre: "Camila", apellido: "Rojas", email: "camila.rojas@demo.pe", tel: "944110002", plan: "Bimestral", startOffset: -20, endOffset: 40, estado: "activo", payOffset: -6, payMethod: "yape" },
        { dni: "71234503", nombre: "Mateo", apellido: "Flores", email: "mateo.flores@demo.pe", tel: "944110003", plan: "Interdiario", startOffset: -4, endOffset: 11, estado: "activo", payOffset: -4, payMethod: "efectivo" },
        { dni: "71234504", nombre: "Sofía", apellido: "Castillo", email: "sofia.castillo@demo.pe", tel: "944110004", plan: "Mensual", startOffset: -10, endOffset: 20, estado: "activo", payOffset: -10, payMethod: "plin" },
        { dni: "71234505", nombre: "Andrés", apellido: "Vargas", email: "andres.vargas@demo.pe", tel: "944110005", plan: "Bimestral", startOffset: -18, endOffset: 42, estado: "activo", payOffset: -8, payMethod: "tarjeta" },
        { dni: "71234506", nombre: "Renata", apellido: "Salazar", email: "renata.salazar@demo.pe", tel: "944110006", plan: "Mensual", startOffset: -12, endOffset: 18, estado: "activo", payOffset: -2, payMethod: "yape" },
        { dni: "71234507", nombre: "Joaquín", apellido: "Herrera", email: "joaquin.herrera@demo.pe", tel: "944110007", plan: "Mensual", startOffset: -35, endOffset: -5, estado: "expirado", payOffset: -35, payMethod: "efectivo" },
        { dni: "71234508", nombre: "Fiorella", apellido: "Núñez", email: "fiorella.nunez@demo.pe", tel: "944110008", plan: "Trimestral", startOffset: -15, endOffset: 75, estado: "activo", payOffset: -1, payMethod: "yape" },
        { dni: "71234509", nombre: "Gabriel", apellido: "Chávez", email: "gabriel.chavez@demo.pe", tel: "944110009", plan: null, startOffset: null, endOffset: null, estado: null, activo: 0 },
    ];

    const socioIds = {};
    for (const s of socioSpecs) {
        const uid = await upsertUser({
            nombre: s.nombre,
            apellido: s.apellido,
            dni: s.dni,
            email: s.email,
            telefono: s.tel,
            passwordHash: memberHash,
            rolId: clientRoleId,
            activo: s.activo !== undefined ? s.activo : 1,
        });
        socioIds[s.dni] = uid;

        if (s.plan) {
            const plan = planByName[s.plan.toLowerCase()];
            const startStr = limaTodayStr(s.startOffset);
            const endStr = limaTodayStr(s.endOffset);
            const [existingMem] = await db.execute(
                "SELECT id, fecha_fin FROM membresias WHERE usuario_id = ? ORDER BY id DESC LIMIT 1",
                [uid],
            );

            let memId = existingMem[0]?.id;
            const currentEnd = existingMem[0]?.fecha_fin
                ? new Date(existingMem[0].fecha_fin).toISOString().slice(0, 10)
                : "";

            if (!memId) {
                const [insMem] = await db.execute(
                    `INSERT INTO membresias (usuario_id, plan_id, fecha_inicio, fecha_fin, estado)
                     VALUES (?, ?, ?, ?, ?)`,
                    [uid, plan.id, startStr, endStr, s.estado],
                );
                memId = insMem.insertId;
            } else if (s.estado === "activo" && currentEnd < limaTodayStr(0)) {
                await db.execute(
                    `UPDATE membresias SET plan_id = ?, fecha_inicio = ?, fecha_fin = ?, estado = 'activo' WHERE id = ?`,
                    [plan.id, startStr, endStr, memId],
                );
            } else if (s.estado === "expirado") {
                await db.execute(
                    `UPDATE membresias SET fecha_fin = ?, estado = 'expirado' WHERE id = ?`,
                    [endStr, memId],
                );
            }

            const [existingPay] = await db.execute(
                "SELECT id FROM pagos WHERE usuario_id = ? AND membresia_id = ? LIMIT 1",
                [uid, memId],
            );
            if (!existingPay[0]) {
                await db.execute(
                    "INSERT INTO pagos (usuario_id, monto, fecha_pago, metodo_pago, membresia_id) VALUES (?, ?, ?, ?, ?)",
                    [uid, plan.precio, limaTodayStr(s.payOffset), s.payMethod, memId],
                );
            }
        }
    }

    // Membresía para entrenador vinculado
    const [coachMem] = await db.execute("SELECT id FROM membresias WHERE usuario_id = ? LIMIT 1", [coachId]);
    if (!coachMem[0] && planByName.mensual) {
        const [ins] = await db.execute(
            "INSERT INTO membresias (usuario_id, plan_id, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, 'activo')",
            [coachId, planByName.mensual.id, limaTodayStr(-5), limaTodayStr(25)],
        );
        await db.execute(
            "INSERT INTO pagos (usuario_id, monto, fecha_pago, metodo_pago, membresia_id) VALUES (?, ?, ?, 'efectivo', ?)",
            [coachId, planByName.mensual.precio, limaTodayStr(-5), ins.insertId],
        );
    }

    // 5. Recompensas y Convenios Comerciales
    const [rewCount] = await db.execute("SELECT COUNT(*) AS c FROM recompensas_catalogo");
    if (rewCount[0].c === 0) {
        await db.execute(`
            INSERT INTO recompensas_catalogo (nombre, descripcion, costo_bambus, categoria, stock, destacado, activo) VALUES
            ('Bebida Isotónica Energizante', 'Hidratación inmediata post-entreno.', 80, 'bebidas', 100, 0, 1),
            ('Kit de Bienvenida Panda', 'Toma todo + bandas de resistencia.', 100, 'accesorios', 60, 0, 1),
            ('Toalla Deportiva Microfibra', 'Toalla ligera absorbente Panda Fitness.', 150, 'accesorios', 40, 0, 1),
            ('Shake de Proteína Premium 25g', 'Batido proteico preparado en barra.', 200, 'suplementos', 80, 1, 1),
            ('Pase Libre de 1 Día para Amigo', 'Invita a un amigo gratis un día.', 300, 'servicios', 50, 1, 1),
            ('15% Descuento en Renovación', 'Cupón para tu próxima renovación.', 500, 'servicios', 30, 1, 1)
        `);
    }

    const [convCount] = await db.execute("SELECT COUNT(*) AS c FROM convenios_comerciales");
    if (convCount[0].c === 0) {
        await db.execute(`
            INSERT INTO convenios_comerciales (aliado_nombre, categoria, descuento_texto, descripcion, codigo_promocional, destacado, activo) VALUES
            ('Optimum Nutrition Store', 'Nutrición y Suplementos', '20% de Descuento', 'Proteínas, creatinas y pre-entrenos.', 'PANDAON20', 1, 1),
            ('Clínica Fisiocare', 'Salud & Fisioterapia', '30% en Descarga Muscular', 'Evaluación y masaje deportivo.', 'FISIOPANDA', 1, 1),
            ('SportStyle Indumentaria', 'Ropa Deportiva', '15% en Toda la Tienda', 'Polos dry-fit y accesorios.', 'SPORTSTYLE15', 0, 1),
            ('GreenBowl Alimentación Saludable', 'Gastronomía Saludable', '25% en Platos y Ensaladas', 'Bowls proteicos balanceados.', 'GREENPANDA', 0, 1)
        `);
    }

    // 6. Canjes y Ofertas demo (si no existen aún)
    const [canjesCount] = await db.execute("SELECT COUNT(*) AS c FROM canjes_recompensas");
    if (canjesCount[0].c === 0) {
        await db.execute(
            `INSERT INTO canjes_recompensas (usuario_id, recompensa_nombre, costo_bambus, codigo_canje, estado) VALUES
             (?, 'Bebida Isotónica Energizante', 80, 'PANDA-SEED-001', 'pendiente'),
             (?, 'Kit de Bienvenida Panda', 100, 'PANDA-SEED-002', 'entregado'),
             (?, 'Toalla Deportiva Microfibra', 150, 'PANDA-SEED-003', 'pendiente')`,
            [socioIds["12345678"], socioIds["73781820"], socioIds["87654321"]],
        );
    }

    const [offersCount] = await db.execute("SELECT COUNT(*) AS c FROM ofertas_socios");
    if (offersCount[0].c < 2) {
        await db.execute(
            `INSERT INTO ofertas_socios (usuario_id, titulo, descripcion, tipo, valor, codigo_cupon, fecha_fin, estado) VALUES
             (NULL, '2x1 Plan Mensual Primavera', 'Trae un compañero nuevo y ambos entrenan con descuento.', 'descuento_porcentaje', 20.00, 'PANDA20', DATE_ADD(NOW(), INTERVAL 25 DAY), 'activo'),
             (NULL, 'Pase Amigo Fin de Semana', 'Invita a un amigo este sábado presentando tu DNI en recepción.', 'pase_amigo', 1.00, 'AMIGOPANDA', DATE_ADD(NOW(), INTERVAL 15 DAY), 'activo'),
             (?, 'Bono Socio Constante', 'S/ 25 de descuento en tu siguiente renovación trimestral.', 'descuento_fijo', 25.00, 'BR25VIP', DATE_ADD(NOW(), INTERVAL 30 DAY), 'activo'),
             (?, 'Reactivación sin Matrícula', 'Vuelve hoy con 15% de descuento en cualquier plan.', 'descuento_porcentaje', 15.00, 'VUELVE15', DATE_ADD(NOW(), INTERVAL 10 DAY), 'activo')`,
            [socioIds["12345678"], socioIds["71234507"]],
        );
    }

    // 7. Asistencias de los últimos 7 días + HOY (si aún no hay asistencias hoy)
    const [recentAttCount] = await db.execute(
        "SELECT COUNT(*) AS c FROM asistencias WHERE DATE(hora_entrada) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)",
    );
    if (recentAttCount[0].c === 0) {
        const historicalSpecs = [
            // [dni, dayOffset, inHour, outHour, method]
            ["12345678", -6, 7, 8, "huella"],
            ["73781820", -6, 17, 19, "huella"],
            ["87654321", -6, 18, 20, "manual"],
            ["12345678", -5, 7, 9, "huella"],
            ["71234501", -5, 8, 9, "huella"],
            ["71234502", -5, 18, 19, "huella"],
            ["71234504", -4, 9, 10, "manual"],
            ["73781820", -4, 17, 18, "huella"],
            ["12345678", -3, 7, 8, "huella"],
            ["87654321", -3, 19, 20, "huella"],
            ["71234503", -3, 19, 21, "huella"],
            ["12345678", -2, 7, 8, "huella"],
            ["71234505", -2, 16, 17, "huella"],
            ["71234506", -2, 18, 19, "manual"],
            ["73781820", -2, 18, 20, "huella"],
            ["12345678", -1, 7, 8, "huella"],
            ["71234501", -1, 10, 11, "huella"],
            ["71234502", -1, 17, 18, "huella"],
            ["87654321", -1, 19, 20, "huella"],
            ["71234508", -1, 20, 21, "huella"],
        ];
        for (const [dni, dOff, inH, outH, metodo] of historicalSpecs) {
            await db.execute(
                "INSERT INTO asistencias (usuario_id, hora_entrada, hora_salida, metodo_registro) VALUES (?, ?, ?, ?)",
                [socioIds[dni], datetimeAtDayAndHour(dOff, inH, 10), datetimeAtDayAndHour(dOff, outH, 35), metodo],
            );
        }
    }

    const [todayAttCount] = await db.execute(
        "SELECT COUNT(*) AS c FROM asistencias WHERE DATE(hora_entrada) = CURDATE()",
    );
    if (todayAttCount[0].c === 0) {
        // 3 socios actualmente en sala
        await db.execute(
            "INSERT INTO asistencias (usuario_id, hora_entrada, hora_salida, metodo_registro) VALUES (?, ?, NULL, 'huella')",
            [socioIds["12345678"], datetimeMinutesAgo(40)],
        );
        await db.execute(
            "INSERT INTO asistencias (usuario_id, hora_entrada, hora_salida, metodo_registro) VALUES (?, ?, NULL, 'huella')",
            [socioIds["71234502"], datetimeMinutesAgo(55)],
        );
        await db.execute(
            "INSERT INTO asistencias (usuario_id, hora_entrada, hora_salida, metodo_registro) VALUES (?, ?, NULL, 'manual')",
            [socioIds["71234503"], datetimeMinutesAgo(25)],
        );

        // 2 socios que completaron salida hoy
        await db.execute(
            "INSERT INTO asistencias (usuario_id, hora_entrada, hora_salida, metodo_registro) VALUES (?, ?, ?, 'huella')",
            [socioIds["71234504"], datetimeMinutesAgo(195), datetimeMinutesAgo(110)],
        );
        await db.execute(
            "INSERT INTO asistencias (usuario_id, hora_entrada, hora_salida, metodo_registro) VALUES (?, ?, ?, 'huella')",
            [socioIds["71234508"], datetimeMinutesAgo(160), datetimeMinutesAgo(75)],
        );

        // 2 socios que ingresaron hace más de 4 horas y NO marcaron salida
        await db.execute(
            "INSERT INTO asistencias (usuario_id, hora_entrada, hora_salida, metodo_registro) VALUES (?, ?, NULL, 'huella')",
            [socioIds["71234505"], datetimeMinutesAgo(315)],
        );
        await db.execute(
            "INSERT INTO asistencias (usuario_id, hora_entrada, hora_salida, metodo_registro) VALUES (?, ?, NULL, 'manual')",
            [socioIds["71234506"], datetimeMinutesAgo(275)],
        );

        // Ejecutar regla real del backend para cerrar sesiones >= 4 horas y liberar aforo
        await AttendanceModel.closeOverdueAttendances(4);
    }

    // 8. Clientes diarios (2 activos ahora en sala + 2 finalizados)
    const [todayGuests] = await db.execute(
        "SELECT COUNT(*) AS c FROM usuarios_invitados WHERE DATE(fecha_inicio) = CURDATE()",
    );
    if (todayGuests[0].c === 0) {
        await db.execute(
            `INSERT INTO usuarios_invitados (nombre, telefono, fecha_inicio, fecha_fin, metodo_pago, monto, recargo_aplicado, estado, creado_por_admin_id) VALUES
             ('Luis Alberto Paredes', '988001122', ?, ?, 'efectivo', 8.00, 0, 'activo', ?),
             ('Andrea Sofía Morales', '988003344', ?, ?, 'yape', 11.00, 0, 'activo', ?),
             ('Jorge Iván Ramírez', '988005566', ?, ?, 'plin', 8.00, 0, 'finalizado', ?),
             ('Paula Cristina Vega', '988007788', ?, ?, 'efectivo', 5.00, 0, 'finalizado', ?)`,
            [
                datetimeMinutesAgo(30),
                formatMysqlDatetime(new Date(Date.now() + 90 * 60000)),
                adminId,
                datetimeMinutesAgo(15),
                formatMysqlDatetime(new Date(Date.now() + 165 * 60000)),
                adminId,
                datetimeAtDayAndHour(-1, 10, 0),
                datetimeAtDayAndHour(-1, 12, 0),
                adminId,
                datetimeAtDayAndHour(-2, 16, 0),
                datetimeAtDayAndHour(-2, 17, 0),
                adminId,
            ],
        );
    }

    // 9. Huellas USB demo y Marcaciones de Hardware ZKTeco / USB
    for (const dni of ["12345678", "73781820", "87654321", "71234503"]) {
        const fakeTpl = Buffer.from(`ZK_SEED_TEMPLATE_${dni}`).toString("base64");
        await db.execute(
            `INSERT INTO socio_huellas_usb (usuario_id, dni, template, formato, dispositivo)
             VALUES (?, ?, ?, 'ZKFINGER', 'ZKTECO_SEED')
             ON DUPLICATE KEY UPDATE template = VALUES(template)`,
            [socioIds[dni], dni, fakeTpl],
        );
    }

    const zkMarks = [
        [socioIds["12345678"], "12345678", datetimeMinutesAgo(40), "ZK_LIVE", "ZKTECO_RECEPCION", "ENTRADA", "Entrada autorizada (ZK_LIVE)"],
        [socioIds["71234502"], "71234502", datetimeMinutesAgo(55), "USB_LECTOR", "LECTOR_USB_01", "ENTRADA", "Entrada autorizada (USB_LECTOR)"],
        [socioIds["71234504"], "71234504", datetimeMinutesAgo(195), "ZK_LIVE", "ZKTECO_RECEPCION", "ENTRADA", "Entrada autorizada (ZK_LIVE)"],
        [socioIds["71234504"], "71234504", datetimeMinutesAgo(110), "ZK_LIVE", "ZKTECO_RECEPCION", "SALIDA", "Salida registrada (85 min en sala)"],
        [socioIds["71234508"], "71234508", datetimeMinutesAgo(160), "ZK_ARCHIVO", "USB_PENDRIVE", "ENTRADA", "Entrada autorizada (ZK_ARCHIVO)"],
        [socioIds["71234508"], "71234508", datetimeMinutesAgo(75), "ZK_ARCHIVO", "USB_PENDRIVE", "SALIDA", "Salida registrada (85 min en sala)"],
        [socioIds["71234507"], "71234507", datetimeMinutesAgo(20), "ZK_LIVE", "ZKTECO_RECEPCION", "MEMBRESIA_INACTIVA", "Membresía vencida o inactiva"],
    ];
    for (const [uid, dni, fh, orig, disp, res, det] of zkMarks) {
        await db.execute(
            `INSERT IGNORE INTO asistencia_marcaciones_zk (usuario_id, dni, fecha_hora, origen, dispositivo, resultado, detalle)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uid, dni, fh, orig, disp, res, det],
        );
    }

    // Asegurar token ZK generado
    const [zkTok] = await db.execute("SELECT valor FROM configuracion WHERE clave = 'zk_sync_token' LIMIT 1");
    if (!zkTok[0]?.valor) {
        await db.execute(
            "INSERT INTO configuracion (clave, valor) VALUES ('zk_sync_token', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
            [crypto.randomUUID()],
        );
    }

    console.log("Seed Panda Fitness completado.");
    console.log("Cuentas listas:");
    console.log("  Admin:        DNI 00000000 (admin@gmail.com)");
    console.log("  Recepción:    DNI 40100101 / Panda2026!");
    console.log("  Entrenador:   DNI 40100102 / Panda2026!");
    console.log("  Supervisor:   DNI 40100103 / Panda2026!");
    console.log("  Socios demo:  DNI 71234501..71234508 / Cliente2026!");
}

main()
    .catch((err) => {
        console.error("Error ejecutando seed:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end();
    });
