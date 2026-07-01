const SocioModel = require('./src/models/SocioModel');
(async () => {
  try {
    const payload = {
      dni: '75846806',
      nombre: 'VERONICA MIRELLA',
      apellido: 'JUAREZ NICOLAS',
      email: 'estherllengue14@gmail.com',
      telefono: '973990747',
      planId: 4,
      fechaInicio: '2026-06-12',
      metodoPago: 'transferencia',
    };

    const result = await SocioModel.create(payload);
    console.log('CREATE_OK', result);
  } catch (err) {
    console.error('CREATE_ERROR', err);
  }
})();
