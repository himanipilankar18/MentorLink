const AcademicYearConfig = require('../models/AcademicYearConfig');

function defaultAcademicYearEndDate() {
  const now = new Date();
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return new Date(Date.UTC(year, 5, 30, 23, 59, 59, 999));
}

async function getAcademicYearEndDate() {
  const config = await AcademicYearConfig.findOneAndUpdate(
    { key: 'current' },
    { $setOnInsert: { yearEndDate: defaultAcademicYearEndDate() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return config.yearEndDate;
}

module.exports = { defaultAcademicYearEndDate, getAcademicYearEndDate };