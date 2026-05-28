const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema({
  lectureId: { type: String, unique: true },
  lectureName: { type: String, required: true, trim: true },
  course: { type: String, required: true, trim: true },
  facultyName: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  attendanceWindowMinutes: { type: Number, default: 15 },
  qrCode: { type: String },
  isActive: { type: Boolean, default: true },
  forceOpen: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

lectureSchema.pre('save', async function (next) {
  if (!this.lectureId) {
    const dateStr = new Date(this.date).toISOString().slice(0, 10).replace(/-/g, '');
    // Use timestamp + random to guarantee uniqueness
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    const rand = Math.random().toString(36).slice(-2).toUpperCase();
    this.lectureId = `LEC_${dateStr}_${suffix}${rand}`;
  }
  next();
});

module.exports = mongoose.model('Lecture', lectureSchema);
