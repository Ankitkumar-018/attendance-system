# QR Attendance Management System

A full-stack attendance system for educational institutes using React, Node.js, MongoDB, and Material UI.

---

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB running locally (`mongod`)

---

### 1. Start MongoDB
```bash
mongod
```

---

### 2. Backend Setup
```bash
cd backend
npm install
```

Edit `.env` if needed (defaults work for local dev):
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/attendance_system
JWT_SECRET=your_super_secret_jwt_key_change_in_production_2024
ADMIN_EMAIL=admin@masaischool.com
ADMIN_PASSWORD=Admin@123
ATTENDANCE_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

Start backend:
```bash
npm run dev
```

---

### 3. Import Student Data
```bash
cd backend
node import-students.js
```
This imports all 613 students from `students.json` into MongoDB.

---

### 4. Frontend Setup
```bash
cd frontend
npm install
npm start
```

Open: http://localhost:3000

---

## Login Credentials

| Field    | Value                      |
|----------|----------------------------|
| Email    | admin@masaischool.com      |
| Password | Admin@123                  |

---

## How It Works

### Admin Flow
1. Login at `/login`
2. Import students (Students page → Import JSON/CSV/Excel)
3. Create lecture → QR code auto-generated
4. Download/display QR code on projector
5. View real-time attendance (Attendance page)
6. Export reports as Excel or PDF

### Student Flow (No Login Required)
1. Student scans QR code with phone
2. Opens `/mark-attendance/<lectureId>`
3. Enters email or phone number
4. Confirms their identity card
5. Attendance marked ✓

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/students` | List students |
| POST | `/api/students/import-json` | Import from JSON |
| POST | `/api/students/import-file` | Import CSV/Excel |
| GET | `/api/lectures` | List lectures |
| POST | `/api/lectures` | Create lecture + QR |
| GET | `/api/lectures/public/:id` | Public lecture info |
| POST | `/api/attendance/find-student` | Find student by email/phone |
| POST | `/api/attendance/mark` | Mark attendance |
| GET | `/api/attendance/lecture/:id` | Lecture attendance report |
| GET | `/api/attendance/export/lecture/:id` | Download Excel report |
| GET | `/api/attendance/export/lecture/:id/pdf` | Download PDF report |
| GET | `/api/attendance/summary` | Dashboard summary |
| GET | `/api/analytics/trend` | 30-day attendance trend |
| GET | `/api/analytics/course-wise` | Course-wise stats |
| GET | `/api/analytics/top-students` | Leaderboard |
| GET | `/api/analytics/low-attendance` | Low attendance warning list |

---

## Security Features
- JWT authentication for admin
- Rate limiting on attendance endpoints (30 req/min)
- Duplicate prevention (unique index on lectureId + studentCode)
- IP address + browser info logged per attendance record
- Time-window enforcement (attendance only during configured window)
- Optional GPS location capture

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Material UI 5, Recharts |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| Auth | JWT |
| QR Code | qrcode package |
| Excel | xlsx package |
| PDF | pdfkit |
