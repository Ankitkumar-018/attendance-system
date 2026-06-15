const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  lectureId: { type: String, required: true, index: true },
  lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' },
  studentCode: { type: String, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  studentName: { type: String, required: true },
  email: { type: String, required: true },
  course: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// One feedback per student per lecture
feedbackSchema.index({ lectureId: 1, studentCode: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
