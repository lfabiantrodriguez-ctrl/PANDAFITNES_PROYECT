const db = require('../config/database');

function formatTimePeru(dateVal) {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
    } catch {
        return '';
    }
}

function formatDatePeru(dateVal) {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' });
    } catch {
        return '';
    }
}

class DashboardController {
    static async getMetrics(req, res) {
        try {
            // 1. Total Socios Activos registrados
            const [sociosRows] = await db.execute(`
                SELECT COUNT(*) AS total
                FROM usuarios u
                JOIN roles r ON r.id = u.rol_id
                WHERE (r.nombre = 'cliente' OR EXISTS (
                    SELECT 1 FROM staff_member_links l WHERE l.member_user_id=u.id AND l.staff_user_id=u.id
                )) AND u.activo = 1
            `);
            const totalSocios = Number(sociosRows[0]?.total || 0);

            // 2. Facturación Real Acumulada del Mes Actual (pagos membresías + clientes diarios)
            const [pagosMesRows] = await db.execute(`
                SELECT COALESCE(SUM(monto), 0) AS totalPagos
                FROM pagos
                WHERE MONTH(fecha_pago) = MONTH(CURRENT_DATE())
                  AND YEAR(fecha_pago) = YEAR(CURRENT_DATE())
            `);
            const [invitadosMesRows] = await db.execute(`
                SELECT COALESCE(SUM(monto), 0) AS totalInvitados
                FROM usuarios_invitados
                WHERE MONTH(fecha_inicio) = MONTH(CURRENT_DATE())
                  AND YEAR(fecha_inicio) = YEAR(CURRENT_DATE())
            `);
            const ingresosMes = Number(pagosMesRows[0]?.totalPagos || 0) + Number(invitadosMesRows[0]?.totalInvitados || 0);

            // Nombre del mes actual en español
            const nombreMes = new Date().toLocaleDateString('es-ES', { month: 'long' });
            const mesActualCapitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

            // 3. Tendencia de Asistencia Real de los Últimos 7 Días
            const [asistenciasSemanaRows] = await db.execute(`
                SELECT 
                    DATE(hora_entrada) AS fecha,
                    COUNT(*) AS total
                FROM asistencias
                WHERE hora_entrada >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
                GROUP BY DATE(hora_entrada)
            `);

            const [invitadosSemanaRows] = await db.execute(`
                SELECT 
                    DATE(fecha_inicio) AS fecha,
                    COUNT(*) AS total
                FROM usuarios_invitados
                WHERE fecha_inicio >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
                GROUP BY DATE(fecha_inicio)
            `);

            // Construir los 7 días con nombres reales (es-ES)
            const daysMap = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const dayStr = String(d.getDate()).padStart(2, '0');
                const isoDate = `${year}-${month}-${dayStr}`;

                const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
                const dayNumber = d.getDate();
                const label = i === 0 ? 'Hoy' : `${dayName.charAt(0).toUpperCase() + dayName.slice(1, 3)} ${dayNumber}`;
                daysMap[isoDate] = { day: label, isoDate, count: 0, isToday: i === 0 };
            }

            for (const row of asistenciasSemanaRows) {
                const dateKey = typeof row.fecha === 'string'
                    ? row.fecha.slice(0, 10)
                    : new Date(row.fecha).toISOString().slice(0, 10);
                if (daysMap[dateKey]) {
                    daysMap[dateKey].count += Number(row.total);
                }
            }
            for (const row of invitadosSemanaRows) {
                const dateKey = typeof row.fecha === 'string'
                    ? row.fecha.slice(0, 10)
                    : new Date(row.fecha).toISOString().slice(0, 10);
                if (daysMap[dateKey]) {
                    daysMap[dateKey].count += Number(row.total);
                }
            }

            const weeklyData = Object.values(daysMap);
            const maxWeeklyCount = Math.max(1, ...weeklyData.map((d) => d.count));
            const totalWeeklyCount = weeklyData.reduce((acc, d) => acc + d.count, 0);
            const averageDaily = (totalWeeklyCount / 7).toFixed(1);

            weeklyData.forEach((d) => {
                d.height = d.count === 0 ? 12 : Math.round(15 + (d.count / maxWeeklyCount) * 85);
            });

            // 4. Actividad Reciente en Recepción Real
            const [recentAttendances] = await db.execute(`
                SELECT 
                    a.id,
                    a.hora_entrada,
                    a.hora_salida,
                    a.metodo_registro,
                    u.nombre,
                    u.apellido,
                    u.dni
                FROM asistencias a
                JOIN usuarios u ON u.id = a.usuario_id
                ORDER BY a.hora_entrada DESC
                LIMIT 8
            `);

            const [recentPayments] = await db.execute(`
                SELECT 
                    p.id,
                    p.monto,
                    p.fecha_pago,
                    p.metodo_pago,
                    u.nombre,
                    u.apellido,
                    pm.nombre AS plan_nombre
                FROM pagos p
                JOIN usuarios u ON u.id = p.usuario_id
                LEFT JOIN membresias m ON m.id = p.membresia_id
                LEFT JOIN planes_membresia pm ON pm.id = m.plan_id
                ORDER BY p.id DESC
                LIMIT 5
            `);

            const [recentGuests] = await db.execute(`
                SELECT 
                    id,
                    nombre,
                    apellido,
                    monto,
                    fecha_inicio
                FROM usuarios_invitados
                ORDER BY id DESC
                LIMIT 4
            `);

            const rawActivities = [];

            for (const att of recentAttendances) {
                const isExit = Boolean(att.hora_salida);
                const timestamp = att.hora_salida || att.hora_entrada;
                rawActivities.push({
                    name: `${att.nombre} ${att.apellido || ''}`.trim(),
                    timestamp: new Date(timestamp).getTime(),
                    time: formatTimePeru(timestamp),
                    detail: isExit
                        ? `Salida registrada · Sesión finalizada (${att.metodo_registro === 'huella' ? 'Huella' : 'Manual'})`
                        : `Check-in ingreso · +25 XP Bambús (${att.metodo_registro === 'huella' ? 'Huella' : 'Manual'})`,
                    badge: isExit ? 'Salida' : 'Autorizado',
                    bg: isExit ? '#e0f2fe' : '#ecfccb',
                    col: isExit ? '#0369a1' : '#1b4d24',
                });
            }

            for (const pay of recentPayments) {
                const timestamp = pay.fecha_pago;
                rawActivities.push({
                    name: `${pay.nombre} ${pay.apellido || ''}`.trim(),
                    timestamp: new Date(timestamp).getTime(),
                    time: formatTimePeru(timestamp),
                    detail: `Renovación ${pay.plan_nombre || 'Plan'} · S/ ${Number(pay.monto).toFixed(2)} (${pay.metodo_pago})`,
                    badge: 'Membresía activa',
                    bg: '#dcfce7',
                    col: '#166534',
                });
            }

            for (const gst of recentGuests) {
                const timestamp = gst.fecha_inicio;
                rawActivities.push({
                    name: `${gst.nombre} ${gst.apellido || ''}`.trim() || 'Cliente diario',
                    timestamp: new Date(timestamp).getTime(),
                    time: formatTimePeru(timestamp),
                    detail: `Pase de un día · S/ ${Number(gst.monto).toFixed(2)}`,
                    badge: 'Acceso pagado',
                    bg: '#fef3c7',
                    col: '#92400e',
                });
            }

            rawActivities.sort((a, b) => b.timestamp - a.timestamp);
            const recentActivity = rawActivities.slice(0, 6);

            // 5. Membresías por Renovar Reales (ordenadas por fecha de fin más próxima)
            const [membershipsToRenew] = await db.execute(`
                SELECT 
                    m.id,
                    m.usuario_id AS socioId,
                    u.nombre,
                    u.apellido,
                    u.dni,
                    pm.nombre AS plan,
                    m.fecha_fin AS vencimiento,
                    DATEDIFF(m.fecha_fin, CURRENT_DATE()) AS diasRestantes
                FROM membresias m
                JOIN usuarios u ON u.id = m.usuario_id
                JOIN planes_membresia pm ON pm.id = m.plan_id
                WHERE u.activo = 1
                ORDER BY m.fecha_fin ASC
                LIMIT 8
            `);

            const renewals = membershipsToRenew.map((m) => {
                let estadoLabel = 'Vigente';
                let estadoBg = '#ecfccb';
                let estadoCol = '#15803d';

                if (m.diasRestantes < 0) {
                    estadoLabel = 'Vencida';
                    estadoBg = '#fee2e2';
                    estadoCol = '#991b1b';
                } else if (m.diasRestantes === 0) {
                    estadoLabel = 'Vence hoy';
                    estadoBg = '#fef3c7';
                    estadoCol = '#b45309';
                } else if (m.diasRestantes <= 7) {
                    estadoLabel = `Vence en ${m.diasRestantes}d`;
                    estadoBg = '#fef3c7';
                    estadoCol = '#b45309';
                } else if (m.diasRestantes <= 30) {
                    estadoLabel = 'Por vencer';
                    estadoBg = '#fef9c3';
                    estadoCol = '#854d0e';
                }

                return {
                    socioId: m.socioId,
                    socio: `${m.nombre} ${m.apellido || ''}`.trim(),
                    dni: m.dni,
                    plan: m.plan,
                    vencimiento: formatDatePeru(m.vencimiento),
                    vencimientoIso: m.vencimiento,
                    diasRestantes: m.diasRestantes,
                    estado: estadoLabel,
                    estadoBg,
                    estadoCol,
                };
            });

            return res.json({
                totalSocios,
                ingresosMes,
                mesActual: mesActualCapitalizado,
                weeklyData,
                averageDaily,
                recentActivity,
                renewals,
            });
        } catch (error) {
            console.error('Error generando métricas del dashboard:', error);
            return res.status(500).json({ message: 'Error interno al consultar métricas del dashboard' });
        }
    }
}

module.exports = DashboardController;
