const AttendanceModel = require('../models/AttendanceModel');
const { progress } = require('./pandaProgress');
async function account(userId) {
    const [asistencias, goals, redemptions, rules] = await Promise.all([
        AttendanceModel.getByUser(userId),
        AttendanceModel.getUserGoals(userId),
        AttendanceModel.getUserRedemptions(userId),
        AttendanceModel.getAttendanceRules(),
    ]);
    return progress(asistencias, goals, redemptions, new Date(), rules);
}
module.exports = account;
