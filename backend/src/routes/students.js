const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/students
router.get('/', protect, async (req, res) => {
  const { search, course, page = 1, limit = 50 } = req.query;
  const query = {};
  if (course) query.course = course;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { studentCode: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } }
    ];
  }
  const total = await Student.countDocuments(query);
  const students = await Student.find(query)
    .sort({ name: 1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, page: Number(page), students });
});

// GET /api/students/courses
router.get('/courses', protect, async (req, res) => {
  const courses = await Student.distinct('course');
  res.json({ success: true, courses });
});

// POST /api/students/import-json — import from JSON array
router.post('/import-json', protect, async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0)
    return res.status(400).json({ success: false, message: 'No student data provided' });

  const mapped = students.map(s => ({
    studentCode: s['Student Code'] || s.studentCode,
    name: s['Name'] || s.name,
    email: (s['Email'] || s.email || '').toLowerCase().trim(),
    phoneNumber: String(s['Phone Number'] || s.phoneNumber || ''),
    course: s['Course'] || s.course
  }));

  let inserted = 0, updated = 0, errors = [];
  for (const s of mapped) {
    try {
      await Student.findOneAndUpdate(
        { studentCode: s.studentCode },
        s,
        { upsert: true, new: true }
      );
      inserted++;
    } catch (e) {
      errors.push({ studentCode: s.studentCode, error: e.message });
    }
  }
  res.json({ success: true, message: `${inserted} students imported`, errors });
});

// POST /api/students/import-file — import from CSV/Excel file
router.post('/import-file', protect, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const mapped = rows.map(s => ({
    studentCode: String(s['Student Code'] || s.studentCode || '').trim(),
    name: String(s['Name'] || s.name || '').trim(),
    email: String(s['Email'] || s.email || '').toLowerCase().trim(),
    phoneNumber: String(s['Phone Number'] || s.phoneNumber || ''),
    course: String(s['Course'] || s.course || '').trim()
  })).filter(s => s.studentCode && s.email);

  let inserted = 0, errors = [];
  for (const s of mapped) {
    try {
      await Student.findOneAndUpdate({ studentCode: s.studentCode }, s, { upsert: true });
      inserted++;
    } catch (e) {
      errors.push({ studentCode: s.studentCode, error: e.message });
    }
  }
  res.json({ success: true, message: `${inserted} students imported`, errors });
});

// GET /api/students/export
router.get('/export', protect, async (req, res) => {
  const { course } = req.query;
  const query = course ? { course } : {};
  const students = await Student.find(query).sort({ name: 1 });
  const data = students.map(s => ({
    'Student Code': s.studentCode,
    Name: s.name,
    Email: s.email,
    'Phone Number': s.phoneNumber,
    Course: s.course
  }));
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data), 'Students');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// DELETE /api/students/:id
router.delete('/:id', protect, async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Student deleted' });
});

module.exports = router;
