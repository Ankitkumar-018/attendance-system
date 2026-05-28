const express = require('express');
const Attendance = require('../models/Attendance');
const Lecture = require('../models/Lecture');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/trend — daily attendance for last 30 days
router.get('/trend', protect, async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const lectures = await Lecture.find({ date: { $gte: since } }).sort({ date: 1 });
  const data = await Promise.all(lectures.map(async (l) => {
    const count = await Attendance.countDocuments({ lectureId: l.lectureId });
    const total = await Student.countDocuments({ course: l.course });
    return { date: l.date.toISOString().slice(0, 10), lectureName: l.lectureName, present: count, total, percentage: total ? +((count / total) * 100).toFixed(1) : 0 };
  }));
  res.json({ success: true, data });
});

// GET /api/analytics/course-wise
router.get('/course-wise', protect, async (req, res) => {
  const courses = await Student.distinct('course');
  const data = await Promise.all(courses.map(async (course) => {
    const totalStudents = await Student.countDocuments({ course });
    const lectures = await Lecture.find({ course });
    const attended = await Attendance.countDocuments({ course });
    const possible = totalStudents * lectures.length;
    return { course, totalStudents, totalLectures: lectures.length, attended, absent: possible - attended, percentage: possible ? +((attended / possible) * 100).toFixed(1) : 0 };
  }));
  res.json({ success: true, data });
});

// GET /api/analytics/top-students
router.get('/top-students', protect, async (req, res) => {
  const { course, limit = 10 } = req.query;
  const matchStage = course ? { course } : {};
  const topStudents = await Attendance.aggregate([
    { $match: matchStage },
    { $group: { _id: '$studentCode', name: { $first: '$studentName' }, email: { $first: '$email' }, course: { $first: '$course' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: Number(limit) }
  ]);
  // Calculate percentage
  const totalLectures = await Lecture.countDocuments(course ? { course } : {});
  const result = topStudents.map(s => ({ ...s, percentage: totalLectures ? +((s.count / totalLectures) * 100).toFixed(1) : 0 }));
  res.json({ success: true, data: result });
});

// GET /api/analytics/low-attendance
router.get('/low-attendance', protect, async (req, res) => {
  const { course, threshold = 75 } = req.query;
  const courses = course ? [course] : await Student.distinct('course');

  const lowStudents = [];
  for (const c of courses) {
    const totalLectures = await Lecture.countDocuments({ course: c });
    if (!totalLectures) continue;
    const students = await Student.find({ course: c });
    for (const s of students) {
      const attended = await Attendance.countDocuments({ studentCode: s.studentCode, course: c });
      const percentage = +((attended / totalLectures) * 100).toFixed(1);
      if (percentage < Number(threshold)) {
        lowStudents.push({ studentCode: s.studentCode, name: s.name, email: s.email, course: s.course, attended, totalLectures, percentage });
      }
    }
  }
  lowStudents.sort((a, b) => a.percentage - b.percentage);
  res.json({ success: true, data: lowStudents.slice(0, 50) });
});

module.exports = router;
