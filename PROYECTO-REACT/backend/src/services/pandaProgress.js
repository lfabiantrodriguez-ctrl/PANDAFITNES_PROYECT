// Daily rewards are derived from recorded entries, never browser interactions.
const DAY = 86400000;
function peruDate(value) {
    const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
        ? value.replace(' ', 'T') + '-05:00' : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function previous(date) { return new Date(Date.parse(date + 'T12:00:00Z') - DAY).toISOString().slice(0,10); }
function progress(asistencias, goals = {}, redemptions = [], now = new Date()) {
    const today = peruDate(now);
    const days = [...new Set(asistencias.map(a=>peruDate(a.horaEntrada)).filter(d=>d && d<=today))].sort();
    const attended = new Set(days);
    const target = new Set((goals.diasObjetivo || [1,2,4,5]).map(Number));
    const earliest = days[0];
    let cursor = today, racha = 0;
    while (earliest && cursor >= earliest) {
        if (attended.has(cursor)) racha++;
        else if (cursor !== today && target.has(new Date(cursor+'T12:00:00Z').getUTCDay() || 7)) break;
        cursor = previous(cursor);
    }
    const xp = days.length * 25;
    let nivel = xp < 100 ? 1 : xp < 300 ? 2 : xp < 600 ? 3 : xp < 1000 ? 4 : 5 + Math.floor((xp-1000)/500);
    const currentLevelBaseXp = [0,0,100,300,600][nivel] ?? 1000 + (nivel-5)*500;
    const nextNivelXp = [0,100,300,600,1000][nivel] ?? currentLevelBaseXp+500;
    const etapaKey = xp < 300 ? 'bebe' : xp < 1000 ? 'intermedio' : 'musculoso';
    const bambusGanados = days.length * 10;
    const bambusCanjeados = redemptions.filter(r=>r.estado !== 'cancelado').reduce((sum,r)=>sum+Number(r.costoBambus || 0),0);
    return { xp, nivel, etapaKey, etapa: {bebe:'Panda Bebé',intermedio:'Panda Intermedio',musculoso:'Panda Musculoso'}[etapaKey],
        modelUrl:`/models/panda_${etapaKey}.glb`, racha, currentLevelBaseXp, nextNivelXp,
        xpEnNivel:xp-currentLevelBaseXp, xpFaltante:nextNivelXp-xp, visitasParaSiguiente:Math.ceil((nextNivelXp-xp)/25),
        bambusGanados, bambusCanjeados, bambusDisponibles:Math.max(0,bambusGanados-bambusCanjeados),
        asistenciasMes:days.filter(d=>d.startsWith(today.slice(0,7))).length, totalAsistencias:days.length,
        hasCheckedInToday:attended.has(today), diasAsistidos:days, today, baseXp:25, baseBambus:10, goals, redemptions, asistencias };
}
module.exports = { progress, peruDate };
