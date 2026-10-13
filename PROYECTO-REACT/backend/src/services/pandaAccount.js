const AttendanceModel = require('../models/AttendanceModel');
const { progress } = require('./pandaProgress');
async function account(userId) {
    const [asistencias, goals, redemptions] = await Promise.all([
        AttendanceModel.getByUser(userId), AttendanceModel.getUserGoals(userId), AttendanceModel.getUserRedemptions(userId),
    ]);
    return progress(asistencias, goals, redemptions);
}
module.exports = account;
