const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phoneNumber: { type: String, required: true, trim: true },
  course: { type: String, required: true, trim: true }
}, { timestamps: true });

studentSchema.index({ name: 'text', email: 'text', studentCode: 'text' });

module.exports = mongoose.model('Student', studentSchema);
