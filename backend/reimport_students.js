/**
 * Wipe all students from DB and re-import from CSV
 * Run: node reimport_students.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Student = require('./src/models/Student');

const CSV_PATH = path.join(__dirname, '../../All students - Sheet1.csv');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 5 });
  console.log('Connected to MongoDB Atlas');

  // Step 1: Delete all students
  const deleted = await Student.deleteMany({});
  console.log(`Deleted ${deleted.deletedCount} existing students`);

  // Step 2: Parse CSV
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l);

  // Find the header line (contains NAME,Contact,Email)
  let headerIdx = lines.findIndex(l => l.startsWith('NAME,'));
  if (headerIdx === -1) {
    console.error('Could not find header row in CSV!');
    process.exit(1);
  }

  const dataLines = lines.slice(headerIdx + 1);
  console.log(`Found ${dataLines.length} student rows to import`);

  const students = [];
  const skipped = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line) continue;

    // Handle quoted fields (simple CSV parse)
    const parts = line.split(',');
    if (parts.length < 5) {
      skipped.push({ row: i + 1, reason: 'too few columns', line });
      continue;
    }

    const name = parts[0].trim();
    const contact = parts[1].trim().replace(/\D/g, ''); // digits only
    const email = parts[2].trim().toLowerCase();
    const course = parts[3].trim();
    const studentCode = parts[4].trim().toUpperCase();

    if (!name || !email || !studentCode || !course) {
      skipped.push({ row: i + 1, reason: 'missing required field', line });
      continue;
    }

    // Phone: add 91 prefix if 10 digits
    let phoneNumber = contact;
    if (contact.length === 10) phoneNumber = `91${contact}`;
    else if (contact.length === 0) phoneNumber = '0';

    students.push({ studentCode, name, email, phoneNumber, course });
  }

  // Step 3: Bulk insert
  let inserted = 0;
  const errors = [];

  for (const s of students) {
    try {
      await Student.create(s);
      inserted++;
      if (inserted % 50 === 0) console.log(`  ...inserted ${inserted}`);
    } catch (err) {
      errors.push({ studentCode: s.studentCode, name: s.name, error: err.message });
    }
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`⚠️  Skipped (parse): ${skipped.length}`);
  console.log(`❌ Errors (DB):     ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nDB Errors:');
    errors.forEach(e => console.log(`  ${e.studentCode} (${e.name}): ${e.error}`));
  }
  if (skipped.length > 0) {
    console.log('\nSkipped rows:');
    skipped.forEach(s => console.log(`  Row ${s.row}: ${s.reason} — ${s.line}`));
  }

  const total = await Student.countDocuments();
  console.log(`\nTotal students in DB: ${total}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
