/**
 * One-time script: import students from JSON into MongoDB.
 * Run: node import-students.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./src/models/Student');
const path = require('path');
const fs = require('fs');

const JSON_FILE = path.join(__dirname, '../../students.json');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const raw = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const students = Array.isArray(raw) ? raw : raw.students || [];

  let inserted = 0, skipped = 0;
  for (const s of students) {
    try {
      await Student.findOneAndUpdate(
        { studentCode: s['Student Code'] || s.studentCode },
        {
          studentCode: s['Student Code'] || s.studentCode,
          name: s['Name'] || s.name,
          email: (s['Email'] || s.email || '').toLowerCase().trim(),
          phoneNumber: String(s['Phone Number'] || s.phoneNumber || ''),
          course: s['Course'] || s.course
        },
        { upsert: true, new: true }
      );
      inserted++;
    } catch (e) {
      console.warn('Skip:', s['Student Code'], e.message);
      skipped++;
    }
  }

  console.log(`Done: ${inserted} imported, ${skipped} skipped`);
  await mongoose.disconnect();
})();
