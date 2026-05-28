require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');

const app = express();

// Connect DB
connectDB().then(async () => {
  // Seed default admin if none exists
  const count = await Admin.countDocuments();
  if (count === 0) {
    await Admin.create({
      name: 'Super Admin',
      email: process.env.ADMIN_EMAIL || 'admin@masaischool.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123'
    });
    console.log(`Default admin created: ${process.env.ADMIN_EMAIL}`);
  }
});

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting — per IP, 1000 req/min to handle 700 concurrent students
const attendanceLimiter = rateLimit({
  windowMs: 60000,
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again' },
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress
});
app.use('/api/attendance/mark', attendanceLimiter);
app.use('/api/attendance/find-student', attendanceLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/lectures', require('./routes/lectures'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/analytics', require('./routes/analytics'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Keep-alive: prevent Render free tier from sleeping
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    const https = require('https');
    https.get(`${process.env.RENDER_EXTERNAL_URL}/api/health`, () => {}).on('error', () => {});
  }, 14 * 60 * 1000); // ping every 14 minutes
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
