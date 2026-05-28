const express = require('express');
const QRCode = require('qrcode');
const Lecture = require('../models/Lecture');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/lectures
router.get('/', protect, async (req, res) => {
  const { course, date, page = 1, limit = 20 } = req.query;
  const query = {};
  if (course) query.course = course;
  if (date) {
    const d = new Date(date);
    query.date = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
  }
  const total = await Lecture.countDocuments(query);
  const lectures = await Lecture.find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, lectures });
});

// GET /api/lectures/:id
router.get('/:id', protect, async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
  res.json({ success: true, lecture });
});

// GET /api/lectures/public/:lectureId — public route for QR scan
router.get('/public/:lectureId', async (req, res) => {
  const lecture = await Lecture.findOne({ lectureId: req.params.lectureId });
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

  // Check window
  const now = new Date();
  const lectureDate = new Date(lecture.date);
  const [sh, sm] = lecture.startTime.split(':').map(Number);
  const windowStart = new Date(lectureDate);
  windowStart.setHours(sh, sm, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + lecture.attendanceWindowMinutes * 60000);

  let windowStatus;
  if (lecture.forceOpen) {
    windowStatus = 'open';
  } else {
    windowStatus = now < windowStart ? 'not_started' : now > windowEnd ? 'closed' : 'open';
  }

  res.json({
    success: true,
    lecture: {
      lectureId: lecture.lectureId,
      lectureName: lecture.lectureName,
      course: lecture.course,
      facultyName: lecture.facultyName,
      date: lecture.date,
      startTime: lecture.startTime,
      endTime: lecture.endTime,
      attendanceWindowMinutes: lecture.attendanceWindowMinutes,
      forceOpen: lecture.forceOpen,
      windowStatus
    }
  });
});

// POST /api/lectures
router.post('/', protect, async (req, res) => {
  const lecture = await Lecture.create({ ...req.body, createdBy: req.admin._id });

  const attendanceUrl = `${process.env.ATTENDANCE_BASE_URL}/mark-attendance/${lecture.lectureId}`;
  const qrCode = await QRCode.toDataURL(attendanceUrl, { width: 400, margin: 2 });
  lecture.qrCode = qrCode;
  await lecture.save();

  res.status(201).json({ success: true, lecture });
});

// PUT /api/lectures/:id
router.put('/:id', protect, async (req, res) => {
  const lecture = await Lecture.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
  res.json({ success: true, lecture });
});

// DELETE /api/lectures/:id
router.delete('/:id', protect, async (req, res) => {
  await Lecture.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Lecture deleted' });
});

// POST /api/lectures/:id/toggle-force-open
router.post('/:id/toggle-force-open', protect, async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
  lecture.forceOpen = !lecture.forceOpen;
  await lecture.save();
  res.json({ success: true, forceOpen: lecture.forceOpen });
});

// POST /api/lectures/:id/regenerate-qr
router.post('/:id/regenerate-qr', protect, async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
  const attendanceUrl = `${process.env.ATTENDANCE_BASE_URL}/mark-attendance/${lecture.lectureId}`;
  lecture.qrCode = await QRCode.toDataURL(attendanceUrl, { width: 400, margin: 2 });
  await lecture.save();
  res.json({ success: true, qrCode: lecture.qrCode });
});

// POST /api/lectures/regenerate-all-qr — fix all QRs with correct base URL
router.post('/regenerate-all-qr', protect, async (req, res) => {
  const lectures = await Lecture.find({});
  let updated = 0;
  for (const lecture of lectures) {
    const attendanceUrl = `${process.env.ATTENDANCE_BASE_URL}/mark-attendance/${lecture.lectureId}`;
    lecture.qrCode = await QRCode.toDataURL(attendanceUrl, { width: 400, margin: 2 });
    await lecture.save();
    updated++;
  }
  res.json({ success: true, message: `${updated} QR codes regenerated with correct URL` });
});

module.exports = router;
