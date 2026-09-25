const GuestModel = require('../src/models/GuestModel');
const db = require('../src/config/database');

function formatDateForDb(d) {
  if (typeof d === 'string') return d.replace('T', ' ').slice(0, 19);
  return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
}

async function run() {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour

    const guest = await GuestModel.createGuest({
      nombre: 'Prueba Diario',
      telefono: '999999999',
      fechaInicio: formatDateForDb(start),
      fechaFin: formatDateForDb(end),
      duracionHoras: 1,
      adminId: 1,
    });

    console.log('Creado:', guest);
  } catch (err) {
    console.error('Error al crear cliente diario:', err.message || err);
  } finally {
    try { await db.end(); } catch (e) {}
  }
}

run();
