const express = require('express');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const Attendance = require('../models/Attendance');
const Lecture = require('../models/Lecture');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/attendance/find-student — public, step 2 of QR flow
router.post('/find-student', async (req, res) => {
  const { identifier, lectureId } = req.body;
  if (!identifier || !lectureId)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  const lecture = await Lecture.findOne({ lectureId });
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

  // Check attendance window
  const now = new Date();
  const lectureDate = new Date(lecture.date);
  const [sh, sm] = lecture.startTime.split(':').map(Number);
  const windowStart = new Date(lectureDate);
  windowStart.setHours(sh, sm, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + lecture.attendanceWindowMinutes * 60000);

  if (!lecture.forceOpen) {
    if (now < windowStart)
      return res.status(400).json({ success: false, message: 'Attendance window has not started yet' });
    if (now > windowEnd)
      return res.status(400).json({ success: false, message: 'Attendance window is closed' });
  }

  const { deviceId } = req.body;

  // ✅ Device check FIRST — before showing any student info
  if (deviceId) {
    const deviceUsed = await Attendance.findOne({ lectureId, deviceId });
    if (deviceUsed)
      return res.status(409).json({
        success: false,
        alreadyMarked: true,
        message: `Attendance already marked for this lecture`,
        markedFor: {
          name: deviceUsed.studentName,
          studentCode: deviceUsed.studentCode,
          course: deviceUsed.course,
          attendanceTime: deviceUsed.attendanceTime
        }
      });
  }

  const clean = identifier.trim().toLowerCase();
  const digits = clean.replace(/\D/g, '');

  // Auto-handle 10-digit Indian numbers
  const phoneVariants = [clean, digits];
  if (digits.length === 10) {
    phoneVariants.push(`91${digits}`);
    phoneVariants.push(`+91${digits}`);
  }

  const student = await Student.findOne({
    $or: [
      { email: clean },
      { phoneNumber: { $in: phoneVariants } }
    ]
  });

  if (!student) return res.status(404).json({ success: false, message: 'Student not found. Please contact admin.' });

  // Check if this student already marked
  const existing = await Attendance.findOne({ lectureId, studentCode: student.studentCode });
  if (existing)
    return res.status(409).json({
      success: false,
      alreadyMarked: true,
      message: 'Attendance already marked',
      markedFor: {
        name: existing.studentName,
        studentCode: existing.studentCode,
        course: existing.course,
        attendanceTime: existing.attendanceTime
      }
    });

  res.json({ success: true, student: { id: student._id, studentCode: student.studentCode, name: student.name, email: student.email, course: student.course } });
});

// POST /api/attendance/mark — public, step 4 of QR flow
router.post('/mark', async (req, res) => {
  const { lectureId, studentCode, location, deviceId } = req.body;
  if (!lectureId || !studentCode)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  const lecture = await Lecture.findOne({ lectureId });
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

  // Window check again for safety
  const now = new Date();
  const lectureDate = new Date(lecture.date);
  const [sh, sm] = lecture.startTime.split(':').map(Number);
  const windowStart = new Date(lectureDate);
  windowStart.setHours(sh, sm, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + lecture.attendanceWindowMinutes * 60000);

  if (!lecture.forceOpen && (now < windowStart || now > windowEnd))
    return res.status(400).json({ success: false, message: 'Attendance window is closed' });

  const student = await Student.findOne({ studentCode });
  if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

  const existing = await Attendance.findOne({ lectureId, studentCode });
  if (existing)
    return res.status(409).json({ success: false, message: 'Attendance already marked', alreadyMarked: true });

  // Device check — one device per lecture
  if (deviceId) {
    const deviceUsed = await Attendance.findOne({ lectureId, deviceId });
    if (deviceUsed)
      return res.status(409).json({ success: false, message: 'Attendance already marked for this lecture', deviceBlocked: true });
  }

  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const browserInfo = req.headers['user-agent'];

  const attendance = await Attendance.create({
    lectureId,
    lecture: lecture._id,
    studentCode,
    student: student._id,
    studentName: student.name,
    email: student.email,
    phoneNumber: student.phoneNumber,
    course: student.course,
    attendanceStatus: 'present',
    attendanceTime: now,
    ipAddress,
    browserInfo,
    deviceId: deviceId || null,
    location
  });

  res.status(201).json({ success: true, message: 'Attendance marked successfully', attendance });
});

// GET /api/attendance/lecture/:lectureId — admin
router.get('/lecture/:lectureId', protect, async (req, res) => {
  const lecture = await Lecture.findOne({ lectureId: req.params.lectureId });
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

  const present = await Attendance.find({ lectureId: req.params.lectureId }).sort({ attendanceTime: 1 });
  const totalStudents = await Student.countDocuments({ course: lecture.course });
  const presentCount = present.length;
  const absentCount = totalStudents - presentCount;

  // Build absent list
  const presentCodes = present.map(a => a.studentCode);
  const absentStudents = await Student.find({ course: lecture.course, studentCode: { $nin: presentCodes } });

  res.json({ success: true, lecture, present, absentStudents, stats: { total: totalStudents, present: presentCount, absent: absentCount, percentage: totalStudents ? ((presentCount / totalStudents) * 100).toFixed(1) : 0 } });
});

// GET /api/attendance/student/:studentCode — admin
router.get('/student/:studentCode', protect, async (req, res) => {
  const records = await Attendance.find({ studentCode: req.params.studentCode })
    .populate('lecture', 'lectureName course date startTime')
    .sort({ attendanceTime: -1 });
  res.json({ success: true, records });
});

// GET /api/attendance/export/lecture/:lectureId
router.get('/export/lecture/:lectureId', protect, async (req, res) => {
  const lecture = await Lecture.findOne({ lectureId: req.params.lectureId });
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

  const present = await Attendance.find({ lectureId: req.params.lectureId });
  const totalStudents = await Student.countDocuments({ course: lecture.course });
  const presentCodes = present.map(a => a.studentCode);
  const absent = await Student.find({ course: lecture.course, studentCode: { $nin: presentCodes } });

  const rows = [
    ...present.map(a => ({ 'Student Code': a.studentCode, Name: a.studentName, Email: a.email, Course: a.course, Status: 'Present', Time: new Date(a.attendanceTime).toLocaleString() })),
    ...absent.map(s => ({ 'Student Code': s.studentCode, Name: s.name, Email: s.email, Course: s.course, Status: 'Absent', Time: '-' }))
  ];

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), 'Attendance');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.lectureId}_attendance.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// GET /api/attendance/export/lecture/:lectureId/pdf
router.get('/export/lecture/:lectureId/pdf', protect, async (req, res) => {
  const lecture = await Lecture.findOne({ lectureId: req.params.lectureId });
  if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

  const present = await Attendance.find({ lectureId: req.params.lectureId }).sort({ studentCode: 1 });
  const totalStudents = await Student.countDocuments({ course: lecture.course });

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.lectureId}_attendance.pdf`);
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  doc.fontSize(20).text('Attendance Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Lecture: ${lecture.lectureName}`);
  doc.text(`Course: ${lecture.course}`);
  doc.text(`Faculty: ${lecture.facultyName}`);
  doc.text(`Date: ${new Date(lecture.date).toLocaleDateString()}`);
  doc.text(`Time: ${lecture.startTime} - ${lecture.endTime}`);
  doc.text(`Present: ${present.length} / ${totalStudents} (${totalStudents ? ((present.length / totalStudents) * 100).toFixed(1) : 0}%)`);
  doc.moveDown();

  doc.fontSize(10).text('No.   Student Code              Name                         Status      Time');
  doc.text('─'.repeat(85));
  present.forEach((a, i) => {
    doc.text(`${String(i + 1).padEnd(5)} ${a.studentCode.padEnd(25)} ${a.studentName.substring(0, 28).padEnd(28)} Present     ${new Date(a.attendanceTime).toLocaleTimeString()}`);
  });

  doc.end();
});

// GET /api/attendance/summary — admin dashboard summary
router.get('/summary', protect, async (req, res) => {
  const totalStudents = await Student.countDocuments();
  const totalLectures = await Lecture.countDocuments();
  const totalAttendance = await Attendance.countDocuments({ attendanceStatus: 'present' });
  const courses = await Student.distinct('course');

  const courseSummary = await Promise.all(courses.map(async (course) => {
    const lectures = await Lecture.find({ course });
    const lectureIds = lectures.map(l => l.lectureId);
    const students = await Student.countDocuments({ course });
    const attended = await Attendance.countDocuments({ course, lectureId: { $in: lectureIds } });
    const possible = students * lectures.length;
    return { course, students, lectures: lectures.length, attended, percentage: possible ? ((attended / possible) * 100).toFixed(1) : 0 };
  }));

  // Today's attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLectures = await Lecture.find({ date: { $gte: today, $lt: new Date(today.getTime() + 86400000) } });
  const todayIds = todayLectures.map(l => l.lectureId);
  const todayAttendance = await Attendance.countDocuments({ lectureId: { $in: todayIds } });

  res.json({ success: true, summary: { totalStudents, totalLectures, totalAttendance, todayAttendance, todayLectures: todayLectures.length, overallPercentage: totalStudents && totalLectures ? ((totalAttendance / (totalStudents * totalLectures)) * 100).toFixed(1) : 0, courseSummary } });
});

module.exports = router;
