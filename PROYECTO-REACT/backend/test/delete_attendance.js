const db = require('../src/config/database');

async function run() {
  try {
    const target = '2026-07-07 20:20:00';
    console.log('Buscando asistencias con hora_entrada aprox:', target);

    // First try exact match
    let [rows] = await db.execute(
      `SELECT * FROM asistencias WHERE hora_entrada = ?`,
      [target]
    );

    // If not found, try small window
    if (!rows || rows.length === 0) {
      const startWindow = '2026-07-07 20:19:00';
      const endWindow = '2026-07-07 20:21:00';
      console.log('No se encontró coincidencia exacta, buscando en ventana:', startWindow, endWindow);
      [rows] = await db.execute(
        `SELECT * FROM asistencias WHERE hora_entrada BETWEEN ? AND ?`,
        [startWindow, endWindow]
      );
    }

    if (!rows || rows.length === 0) {
      console.log('No se encontraron asistencias para la hora indicada. Nada que borrar.');
      return;
    }

    console.log('Asistencias encontradas:');
    console.table(rows);

    const ids = rows.map(r => r.id);
    console.log('Eliminando asistencias con ids:', ids);

    const [res] = await db.execute(
      `DELETE FROM asistencias WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );

    console.log('Filas eliminadas:', res.affectedRows);
  } catch (err) {
    console.error('Error durante eliminación:', err.message || err);
  } finally {
    try { await db.end(); } catch(e){}
  }
}

run();
