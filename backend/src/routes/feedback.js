const express = require('express');
const Feedback = require('../models/Feedback');
const Lecture = require('../models/Lecture');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/feedback/submit — public
router.post('/submit', async (req, res) => {
  try {
    const { lectureId, studentCode, rating, comment } = req.body;

    if (!lectureId || !studentCode || !rating || !comment?.trim()) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const lecture = await Lecture.findOne({ lectureId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    if (!lecture.releaseFeedback) {
      return res.status(400).json({ success: false, message: 'Feedback is not enabled for this lecture' });
    }

    const student = await Student.findOne({ studentCode });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const existing = await Feedback.findOne({ lectureId, studentCode });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Feedback already submitted for this lecture', alreadySubmitted: true });
    }

    const feedback = await Feedback.create({
      lectureId,
      lecture: lecture._id,
      studentCode,
      student: student._id,
      studentName: student.name,
      email: student.email,
      course: student.course,
      rating: Number(rating),
      comment: comment.trim(),
      submittedAt: new Date()
    });

    res.status(201).json({ success: true, message: 'Feedback submitted successfully', feedback });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback/lecture/:lectureId — admin
router.get('/lecture/:lectureId', protect, async (req, res) => {
  try {
    const lecture = await Lecture.findOne({ lectureId: req.params.lectureId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

    const feedbacks = await Feedback.find({ lectureId: req.params.lectureId }).sort({ submittedAt: -1 });
    const count = feedbacks.length;
    const avgRating = count > 0
      ? parseFloat((feedbacks.reduce((s, f) => s + f.rating, 0) / count).toFixed(1))
      : null;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach(f => { distribution[f.rating]++; });

    res.json({ success: true, lecture, feedbacks, stats: { count, avgRating, distribution } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback/daily?date=YYYY-MM-DD — admin
router.get('/daily', protect, async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const lectures = await Lecture.find({
      date: { $gte: dayStart, $lt: dayEnd },
      releaseFeedback: true
    }).sort({ startTime: 1 });

    const sessions = await Promise.all(lectures.map(async (lec) => {
      const feedbacks = await Feedback.find({ lectureId: lec.lectureId });
      const count = feedbacks.length;
      const avgRating = count > 0
        ? parseFloat((feedbacks.reduce((s, f) => s + f.rating, 0) / count).toFixed(1))
        : null;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      feedbacks.forEach(f => { distribution[f.rating]++; });
      return {
        lectureId: lec.lectureId,
        lectureName: lec.lectureName,
        course: lec.course,
        facultyName: lec.facultyName,
        startTime: lec.startTime,
        count,
        avgRating,
        distribution
      };
    }));

    const totalFeedback = sessions.reduce((s, ss) => s + ss.count, 0);
    const sessionsWithFeedback = sessions.filter(ss => ss.count > 0);
    const overallAvg = sessionsWithFeedback.length > 0
      ? parseFloat((sessionsWithFeedback.reduce((s, ss) => s + ss.avgRating, 0) / sessionsWithFeedback.length).toFixed(1))
      : null;

    res.json({
      success: true,
      date: dateStr,
      totalSessions: lectures.length,
      totalFeedback,
      overallAvg,
      sessions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
