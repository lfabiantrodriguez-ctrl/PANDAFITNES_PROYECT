const UserModel = require('./src/models/UserModel');
const ReservationModel = require('./src/models/ReservationModel');
(async () => {
  try {
    const dni = '71028027';
    const user = await UserModel.findActiveByDni(dni);
    console.log('USER', user);
    if (user) {
      const reservation = await ReservationModel.findActiveForCheckIn(user.id);
      console.log('ACTIVE_RESERVATION', reservation);
      const history = await ReservationModel.findRecentByUser(user.id, 5);
      console.log('HISTORY', history);
    }
  } catch (err) {
    console.error('ERROR', err);
  }
})();
