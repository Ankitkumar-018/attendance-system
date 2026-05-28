const express = require('express');
const QRCode = require('qrcode');
const Lecture = require('../models/Lecture');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/lectures
router.get('/', protect, async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/lectures/public/:lectureId — MUST be before /:id
router.get('/public/:lectureId', async (req, res) => {
  try {
    const lecture = await Lecture.findOne({ lectureId: req.params.lectureId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/lectures/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    res.json({ success: true, lecture });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/lectures
router.post('/', protect, async (req, res) => {
  try {
    const lecture = await Lecture.create({ ...req.body, createdBy: req.admin._id });
    const attendanceUrl = `${process.env.ATTENDANCE_BASE_URL}/mark-attendance/${lecture.lectureId}`;
    const qrCode = await QRCode.toDataURL(attendanceUrl, { width: 400, margin: 2 });
    lecture.qrCode = qrCode;
    await lecture.save();
    res.status(201).json({ success: true, lecture });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/lectures/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const lecture = await Lecture.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    res.json({ success: true, lecture });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/lectures/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Lecture.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Lecture deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/lectures/:id/toggle-force-open
router.post('/:id/toggle-force-open', protect, async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    lecture.forceOpen = !lecture.forceOpen;
    await lecture.save();
    res.json({ success: true, forceOpen: lecture.forceOpen });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/lectures/:id/regenerate-qr
router.post('/:id/regenerate-qr', protect, async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    const attendanceUrl = `${process.env.ATTENDANCE_BASE_URL}/mark-attendance/${lecture.lectureId}`;
    lecture.qrCode = await QRCode.toDataURL(attendanceUrl, { width: 400, margin: 2 });
    await lecture.save();
    res.json({ success: true, qrCode: lecture.qrCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/lectures/regenerate-all-qr
router.post('/regenerate-all-qr', protect, async (req, res) => {
  try {
    const lectures = await Lecture.find({});
    for (const lecture of lectures) {
      const attendanceUrl = `${process.env.ATTENDANCE_BASE_URL}/mark-attendance/${lecture.lectureId}`;
      lecture.qrCode = await QRCode.toDataURL(attendanceUrl, { width: 400, margin: 2 });
      await lecture.save();
    }
    res.json({ success: true, message: `${lectures.length} QR codes regenerated` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
