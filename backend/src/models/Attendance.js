const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  lectureId: { type: String, required: true },
  lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', required: true },
  studentCode: { type: String, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String },
  course: { type: String, required: true },
  attendanceStatus: { type: String, enum: ['present', 'absent'], default: 'present' },
  attendanceTime: { type: Date, default: Date.now },
  ipAddress: { type: String },
  browserInfo: { type: String },
  deviceInfo: { type: String },
  deviceId: { type: String },
  location: {
    lat: Number,
    lng: Number
  }
}, { timestamps: true });

attendanceSchema.index({ lectureId: 1, studentCode: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
