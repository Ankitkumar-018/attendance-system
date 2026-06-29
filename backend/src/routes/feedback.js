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

// GET /api/feedback/faculty?name=...&from=...&to=... — all feedback for one faculty (admin)
router.get('/faculty', protect, async (req, res) => {
  try {
    const { name, from, to } = req.query;
    if (!name) return res.status(400).json({ success: false, message: 'Faculty name required' });

    const lectureQuery = { facultyName: name, releaseFeedback: true };
    if (from || to) {
      lectureQuery.date = {};
      if (from) { const d = new Date(from); d.setHours(0, 0, 0, 0); lectureQuery.date.$gte = d; }
      if (to)   { const d = new Date(to);   d.setHours(23,59,59,999); lectureQuery.date.$lte = d; }
    }

    const lectures = await Lecture.find(lectureQuery).sort({ date: -1 });
    const lectureIds = lectures.map(l => l.lectureId);
    const lectureMap = Object.fromEntries(lectures.map(l => [l.lectureId, { lectureName: l.lectureName, date: l.date, course: l.course }]));

    const feedbacks = await Feedback.find({ lectureId: { $in: lectureIds } }).sort({ submittedAt: -1 });
    const enriched = feedbacks.map(f => ({
      ...f.toObject(),
      lectureName: lectureMap[f.lectureId]?.lectureName || f.lectureId,
      lectureDate: lectureMap[f.lectureId]?.date,
      lectureCourse: lectureMap[f.lectureId]?.course
    }));

    const count = feedbacks.length;
    const avgRating = count > 0 ? parseFloat((feedbacks.reduce((s, f) => s + f.rating, 0) / count).toFixed(1)) : null;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach(f => { distribution[f.rating]++; });

    res.json({ success: true, facultyName: name, lectureCount: lectures.length, feedbacks: enriched, stats: { count, avgRating, distribution } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback/overview — lecture-wise, batch-wise, faculty-wise aggregations (admin)
router.get('/overview', protect, async (req, res) => {
  try {
    const { from, to } = req.query;
    const lectureQuery = { releaseFeedback: true };
    if (from || to) {
      lectureQuery.date = {};
      if (from) { const d = new Date(from); d.setHours(0, 0, 0, 0); lectureQuery.date.$gte = d; }
      if (to)   { const d = new Date(to);   d.setHours(23,59,59,999); lectureQuery.date.$lte = d; }
    }
    const lectures = await Lecture.find(lectureQuery).sort({ date: -1 });

    const lectureWise = await Promise.all(lectures.map(async (lec) => {
      const feedbacks = await Feedback.find({ lectureId: lec.lectureId });
      const count = feedbacks.length;
      const totalRatingSum = feedbacks.reduce((s, f) => s + f.rating, 0);
      const avgRating = count > 0 ? parseFloat((totalRatingSum / count).toFixed(1)) : null;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      feedbacks.forEach(f => { distribution[f.rating]++; });
      return { lectureId: lec.lectureId, lectureName: lec.lectureName, course: lec.course, facultyName: lec.facultyName, date: lec.date, startTime: lec.startTime, count, avgRating, distribution, _sum: totalRatingSum };
    }));

    // Batch-wise — weighted average
    const batchMap = {};
    lectureWise.forEach(lec => {
      if (!batchMap[lec.course]) batchMap[lec.course] = { course: lec.course, totalRatingSum: 0, count: 0, lectureCount: 0 };
      batchMap[lec.course].lectureCount++;
      batchMap[lec.course].totalRatingSum += lec._sum;
      batchMap[lec.course].count += lec.count;
    });
    const batchWise = Object.values(batchMap)
      .map(b => ({ course: b.course, lectureCount: b.lectureCount, count: b.count, avgRating: b.count > 0 ? parseFloat((b.totalRatingSum / b.count).toFixed(1)) : null }))
      .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));

    // Faculty-wise — weighted average
    const facultyMap = {};
    lectureWise.forEach(lec => {
      if (!facultyMap[lec.facultyName]) facultyMap[lec.facultyName] = { facultyName: lec.facultyName, totalRatingSum: 0, count: 0, lectureCount: 0 };
      facultyMap[lec.facultyName].lectureCount++;
      facultyMap[lec.facultyName].totalRatingSum += lec._sum;
      facultyMap[lec.facultyName].count += lec.count;
    });
    const facultyWise = Object.values(facultyMap)
      .map(f => ({ facultyName: f.facultyName, lectureCount: f.lectureCount, count: f.count, avgRating: f.count > 0 ? parseFloat((f.totalRatingSum / f.count).toFixed(1)) : null }))
      .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));

    const clean = lectureWise.map(({ _sum, ...rest }) => rest);
    res.json({ success: true, lectureWise: clean, batchWise, facultyWise });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback/lecture/:lectureId — full detail (admin)
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

// GET /api/feedback/export/lecture/:lectureId/csv — CSV download (admin)
router.get('/export/lecture/:lectureId/csv', protect, async (req, res) => {
  try {
    const lecture = await Lecture.findOne({ lectureId: req.params.lectureId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

    const feedbacks = await Feedback.find({ lectureId: req.params.lectureId }).sort({ studentCode: 1 });
    const LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };

    const header = ['Student Code', 'Name', 'Email', 'Course', 'Rating', 'Rating Label', 'Comment', 'Submitted At'].join('\t');
    const rows = feedbacks.map(f =>
      [f.studentCode, f.studentName, f.email, f.course, f.rating, LABELS[f.rating] || '', f.comment.replace(/[\t\n]/g, ' '), new Date(f.submittedAt).toLocaleString('en-IN')].join('\t')
    );

    res.setHeader('Content-Disposition', `attachment; filename=${req.params.lectureId}_feedback.tsv`);
    res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
    res.send('﻿' + [header, ...rows].join('\n'));
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
      return { lectureId: lec.lectureId, lectureName: lec.lectureName, course: lec.course, facultyName: lec.facultyName, startTime: lec.startTime, count, avgRating, distribution };
    }));

    const totalFeedback = sessions.reduce((s, ss) => s + ss.count, 0);
    const sessionsWithFeedback = sessions.filter(ss => ss.count > 0);
    const overallAvg = sessionsWithFeedback.length > 0
      ? parseFloat((sessionsWithFeedback.reduce((s, ss) => s + ss.avgRating, 0) / sessionsWithFeedback.length).toFixed(1))
      : null;

    res.json({ success: true, date: dateStr, totalSessions: lectures.length, totalFeedback, overallAvg, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/feedback/analyze/faculty — admin, AI summary for a faculty member
router.post('/analyze/faculty', protect, async (req, res) => {
  try {
    const { name, from, to } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!name) return res.status(400).json({ success: false, message: 'Faculty name required' });
    if (!GEMINI_KEY) return res.status(500).json({ success: false, message: 'GEMINI_API_KEY not configured in environment' });

    const lectureQuery = { facultyName: name, releaseFeedback: true };
    if (from || to) {
      lectureQuery.date = {};
      if (from) { const d = new Date(from); d.setHours(0, 0, 0, 0); lectureQuery.date.$gte = d; }
      if (to)   { const d = new Date(to);   d.setHours(23, 59, 59, 999); lectureQuery.date.$lte = d; }
    }

    const lectures = await Lecture.find(lectureQuery);
    const lectureIds = lectures.map(l => l.lectureId);
    const lectureMap = Object.fromEntries(lectures.map(l => [l.lectureId, l.lectureName]));

    const feedbacks = await Feedback.find({ lectureId: { $in: lectureIds } }).sort({ submittedAt: 1 });
    if (feedbacks.length === 0) return res.status(400).json({ success: false, message: 'No feedback to analyze' });

    const avgRating = (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1);
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach(f => dist[f.rating]++);
    const total = feedbacks.length;
    const satisfiedPct = Math.round(((dist[4] + dist[5]) / total) * 100);
    const criticalPct  = Math.round(((dist[1] + dist[2]) / total) * 100);

    const lowRated  = feedbacks.filter(f => f.rating <= 2);
    const midRated  = feedbacks.filter(f => f.rating === 3);
    const highRated = feedbacks.filter(f => f.rating >= 4);

    const formatResponses = (arr) =>
      arr.map((f, i) => `  ${i + 1}. [${f.rating}★] [${lectureMap[f.lectureId] || f.lectureId}] "${f.comment}"`).join('\n');

    const prompt = `You are a senior education quality analyst reviewing student feedback for a faculty member. Your job is to produce a thorough, critical, and honest analysis that helps the institution and the faculty member understand exactly how they are performing.

=== FACULTY PROFILE ===
Name: ${name}
Total Lectures Reviewed: ${lectures.length}
Total Student Responses: ${total}
Average Rating: ${avgRating} / 5
Satisfied Students (4-5★): ${dist[4] + dist[5]} (${satisfiedPct}%)
Neutral Students (3★): ${dist[3]}
Dissatisfied Students (1-2★): ${dist[1] + dist[2]} (${criticalPct}%)
Rating Breakdown: 5★=${dist[5]}, 4★=${dist[4]}, 3★=${dist[3]}, 2★=${dist[2]}, 1★=${dist[1]}

=== CRITICAL / NEGATIVE RESPONSES (1-2★) — ${lowRated.length} responses ===
${lowRated.length > 0 ? formatResponses(lowRated) : '  None'}

=== NEUTRAL RESPONSES (3★) — ${midRated.length} responses ===
${midRated.length > 0 ? formatResponses(midRated) : '  None'}

=== POSITIVE RESPONSES (4-5★) — ${highRated.length} responses ===
${formatResponses(highRated)}

=== YOUR TASK ===
Write a detailed, multi-paragraph analysis covering ALL of the following:

Paragraph 1 — OVERALL PERFORMANCE: What does the data say about this faculty member overall? Mention the average rating, satisfaction rate, and general student sentiment.

Paragraph 2 — CRITICAL ISSUES: What specific problems are dissatisfied and neutral students raising? Quote or reference actual student comments. Be direct — do not soften critical findings. Identify recurring complaints or patterns.

Paragraph 3 — STRENGTHS: What are students genuinely praising? What is this faculty member doing well consistently? Reference specific comments.

Paragraph 4 — PATTERNS & INSIGHTS: Are there any patterns across different lectures? Do certain lectures get better or worse ratings? Is there improvement or decline over time?

Paragraph 5 — RECOMMENDATIONS: Give 2-3 specific, actionable recommendations for improvement based on what students said. Be concrete — not generic advice.

Write in clear professional English. Each paragraph should be 3-5 sentences. Do not use bullet points or numbered lists — write in prose paragraphs only.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!summary) return res.status(500).json({ success: false, message: 'Gemini returned empty response' });

    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/feedback/analyze/:lectureId — admin, AI summary via Gemini
router.post('/analyze/:lectureId', protect, async (req, res) => {
  try {
    const { lectureId } = req.params;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!GEMINI_KEY) return res.status(500).json({ success: false, message: 'GEMINI_API_KEY not configured in environment' });

    const lecture = await Lecture.findOne({ lectureId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

    const feedbacks = await Feedback.find({ lectureId }).sort({ submittedAt: 1 });
    if (feedbacks.length === 0) return res.status(400).json({ success: false, message: 'No feedback to analyze' });

    const avgRating = (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1);
    const dateStr = new Date(lecture.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach(f => dist[f.rating]++);
    const total = feedbacks.length;
    const satisfiedPct = Math.round(((dist[4] + dist[5]) / total) * 100);
    const criticalPct  = Math.round(((dist[1] + dist[2]) / total) * 100);

    const lowRated  = feedbacks.filter(f => f.rating <= 2);
    const midRated  = feedbacks.filter(f => f.rating === 3);
    const highRated = feedbacks.filter(f => f.rating >= 4);

    const fmt = (arr) => arr.map((f, i) => `  ${i + 1}. [${f.rating}★] "${f.comment}"`).join('\n');

    const prompt = `You are a senior education quality analyst reviewing student feedback for a single class session. Produce a thorough, critical, and honest analysis.

=== SESSION DETAILS ===
Lecture: ${lecture.lectureName}
Faculty: ${lecture.facultyName}
Course: ${lecture.course}
Date: ${dateStr}
Time: ${lecture.startTime} – ${lecture.endTime}

=== FEEDBACK STATISTICS ===
Total Responses: ${total}
Average Rating: ${avgRating} / 5
Satisfied Students (4-5★): ${dist[4] + dist[5]} (${satisfiedPct}%)
Neutral Students (3★): ${dist[3]}
Dissatisfied Students (1-2★): ${dist[1] + dist[2]} (${criticalPct}%)
Rating Breakdown: 5★=${dist[5]}, 4★=${dist[4]}, 3★=${dist[3]}, 2★=${dist[2]}, 1★=${dist[1]}

=== CRITICAL / NEGATIVE RESPONSES (1-2★) — ${lowRated.length} responses ===
${lowRated.length > 0 ? fmt(lowRated) : '  None'}

=== NEUTRAL RESPONSES (3★) — ${midRated.length} responses ===
${midRated.length > 0 ? fmt(midRated) : '  None'}

=== POSITIVE RESPONSES (4-5★) — ${highRated.length} responses ===
${fmt(highRated)}

=== YOUR TASK ===
Write a detailed, multi-paragraph analysis covering ALL of the following:

Paragraph 1 — OVERALL SESSION QUALITY: Summarize the session quality based on the numbers and student sentiment. Mention satisfaction rate and average rating in context.

Paragraph 2 — CRITICAL ISSUES: What are the dissatisfied and neutral students complaining about? Quote or reference specific comments. Be direct and do not downplay negative feedback. Identify if there are recurring themes in criticism.

Paragraph 3 — WHAT WORKED WELL: What did satisfied students specifically praise? What aspects of teaching or content delivery resonated positively?

Paragraph 4 — RECOMMENDATIONS: Give 2-3 specific, actionable steps the faculty should take before the next session based directly on what students said. Be concrete and practical.

Write in clear professional English. Each paragraph should be 3-5 sentences. Prose paragraphs only — no bullet points or numbered lists.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!summary) return res.status(500).json({ success: false, message: 'Gemini returned empty response' });

    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/feedback/export-to-sheets — admin
router.post('/export-to-sheets', protect, async (req, res) => {
  try {
    const { lectureId } = req.body;
    const SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    if (!SCRIPT_URL) return res.status(500).json({ success: false, message: 'APPS_SCRIPT_URL not configured in environment' });

    const lecture = await Lecture.findOne({ lectureId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

    const feedbacks = await Feedback.find({ lectureId }).sort({ studentCode: 1 });
    if (feedbacks.length === 0) return res.status(400).json({ success: false, message: 'No feedback responses to export' });

    const d = new Date(lecture.date);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const sheetName = `${day} ${month} - ${lecture.lectureName} ${lecture.facultyName}`.substring(0, 100);

    const LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };
    const headers = ['Student Code', 'Name', 'Email', 'Course', 'Rating', 'Rating Label', 'Comment', 'Submitted At'];
    const rows = feedbacks.map(f => [
      f.studentCode,
      f.studentName,
      f.email,
      f.course,
      f.rating,
      LABELS[f.rating] || '',
      f.comment,
      new Date(f.submittedAt).toLocaleString('en-IN')
    ]);

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetName, headers, rows }),
      redirect: 'follow'
    });

    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { result = { success: false, message: text }; }

    if (result.success) {
      res.json({ success: true, message: result.message, sheetName });
    } else {
      res.status(500).json({ success: false, message: result.message || 'Sheet update failed' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
