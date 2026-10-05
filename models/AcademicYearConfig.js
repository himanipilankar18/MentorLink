const mongoose = require('mongoose');

const academicYearConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true,
    default: 'current'
  },
  yearEndDate: {
    type: Date,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('AcademicYearConfig', academicYearConfigSchema);