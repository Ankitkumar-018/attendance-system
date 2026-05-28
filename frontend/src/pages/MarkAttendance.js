import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Alert,
  CircularProgress, Avatar, Divider, Chip, Stepper, Step, StepLabel
} from '@mui/material';
import { QrCode2, CheckCircle, Person, Cancel, HourglassEmpty, LockClock } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

const steps = ['Scan QR', 'Find Your Record', 'Confirm Identity', 'Done'];

// Generate or retrieve a persistent device ID
const getDeviceId = () => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('deviceId', id);
  }
  return id;
};

export default function MarkAttendance() {
  const { lectureId } = useParams();
  const [step, setStep] = useState(0);
  const [lecture, setLecture] = useState(null);
  const [lectureStatus, setLectureStatus] = useState('loading');
  const [identifier, setIdentifier] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [markedFor, setMarkedFor] = useState(null);
  const [location, setLocation] = useState(null);
  const deviceId = getDeviceId();

  useEffect(() => {
    axios.get(`${BASE_URL}/lectures/public/${lectureId}`)
      .then(res => {
        setLecture(res.data.lecture);
        setLectureStatus(res.data.lecture.windowStatus);
        if (res.data.lecture.windowStatus === 'open') setStep(1);
      })
      .catch(() => setLectureStatus('not_found'));

    // Optionally get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, [lectureId]);

  const handleFindStudent = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/attendance/find-student`, { identifier, lectureId, deviceId });
      setStudent(res.data.student);
      setStep(2);
    } catch (err) {
      const data = err.response?.data || {};
      if (data.alreadyMarked || data.deviceBlocked) {
        setAlreadyMarked(true);
        setDeviceBlocked(!!data.deviceBlocked);
        if (data.markedFor) setMarkedFor(data.markedFor);
        setStep(3);
      } else {
        setError(data.message || 'Student not found');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${BASE_URL}/attendance/mark`, { lectureId, studentCode: student.studentCode, location, deviceId });
      setSuccess(true);
      setMarkedFor({ name: student.name, studentCode: student.studentCode, course: student.course, attendanceTime: new Date() });
      setStep(3);
      // Redirect to Masai School after 3 seconds
      setTimeout(() => { window.location.href = 'https://www.masaischool.com'; }, 3000);
    } catch (err) {
      const data = err.response?.data || {};
      if (data.alreadyMarked || data.deviceBlocked) {
        setAlreadyMarked(true);
        setDeviceBlocked(!!data.deviceBlocked);
        if (data.markedFor) setMarkedFor(data.markedFor);
        setStep(3);
      } else {
        setError(data.message || 'Failed to mark attendance');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = () => {
    if (lectureStatus === 'loading') return (
      <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
    );
    if (lectureStatus === 'not_found') return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Cancel sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={600}>Invalid QR Code</Typography>
        <Typography variant="body2" color="text.secondary">This lecture does not exist.</Typography>
      </Box>
    );
    if (lectureStatus === 'not_started') return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <HourglassEmpty sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} color="warning.dark">
          Lecture Not Started Yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Attendance opens at {lecture?.startTime} on {new Date(lecture?.date).toLocaleDateString()}
        </Typography>
      </Box>
    );
    if (lectureStatus === 'closed') return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <LockClock sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} color="error.main">
          Attendance for this lecture is closed
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Please contact your faculty for assistance.
        </Typography>
      </Box>
    );
    return null;
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: '#f8fafc',
      backgroundImage: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
      p: 2
    }}>
      <Card sx={{ width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: 0 }}>
          {/* Header */}
          <Box sx={{ bgcolor: '#0f172a', p: 3, borderRadius: '12px 12px 0 0', textAlign: 'center' }}>
            <QrCode2 sx={{ fontSize: 40, color: '#60a5fa', mb: 1 }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>Mark Your Attendance</Typography>
            {lecture && (
              <>
                <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>{lecture.lectureName}</Typography>
                <Chip label={lecture.course} size="small" sx={{ mt: 1, bgcolor: '#1e3a5f', color: '#93c5fd', fontSize: 11 }} />
              </>
            )}
          </Box>

          <Box sx={{ p: 3 }}>
            {/* Stepper */}
            {lectureStatus === 'open' && step < 3 && (
              <Stepper activeStep={step - 1} alternativeLabel sx={{ mb: 3 }}>
                {['Find Record', 'Confirm', 'Done'].map(label => (
                  <Step key={label}><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: 12 } }}>{label}</StepLabel></Step>
                ))}
              </Stepper>
            )}

            {/* Non-open statuses */}
            {lectureStatus !== 'open' && renderStatus()}

            {/* Step 1: Find Student */}
            {lectureStatus === 'open' && step === 1 && (
              <Box component="form" onSubmit={handleFindStudent}>
                <Typography variant="body1" fontWeight={600} gutterBottom>Enter your registered details</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter your email address or mobile number to find your record.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <TextField
                  fullWidth required autoFocus
                  label="Email or Mobile Number"
                  placeholder="e.g. student@gmail.com or 9876543210"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setError(''); }}
                  sx={{ mb: 2 }}
                />
                <Button fullWidth variant="contained" size="large" type="submit" disabled={loading || !identifier.trim()}>
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Find My Record'}
                </Button>
              </Box>
            )}

            {/* Step 2: Confirm Identity */}
            {lectureStatus === 'open' && step === 2 && student && (
              <Box>
                <Typography variant="body1" fontWeight={600} gutterBottom>Is this you?</Typography>
                <Card variant="outlined" sx={{ mb: 3, bgcolor: '#f8fafc' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: '#1e40af', width: 48, height: 48, fontSize: 20 }}>
                        {student.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>{student.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{student.studentCode}</Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>Email:</Typography>
                        <Typography variant="body2" fontWeight={500}>{student.email}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>Course:</Typography>
                        <Typography variant="body2" fontWeight={500}>{student.course}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button fullWidth variant="outlined" size="large" startIcon={<Cancel />} onClick={() => { setStep(1); setStudent(null); setIdentifier(''); }}>
                    Not Me
                  </Button>
                  <Button fullWidth variant="contained" size="large" startIcon={<Person />} onClick={handleMarkAttendance} disabled={loading} color="success">
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Yes, It's Me!"}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Step 3: Result */}
            {step === 3 && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                {alreadyMarked ? (
                  <>
                    <CheckCircle sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
                    <Typography variant="h6" fontWeight={700} gutterBottom color="warning.dark">
                      Attendance Already Marked!
                    </Typography>
                    {markedFor && (
                      <Card variant="outlined" sx={{ mt: 2, mb: 2, bgcolor: '#fffbeb', borderColor: '#fbbf24', textAlign: 'left' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                            <Avatar sx={{ bgcolor: '#d97706', width: 40, height: 40 }}>
                              {markedFor.name?.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" fontWeight={700}>{markedFor.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{markedFor.studentCode}</Typography>
                            </Box>
                          </Box>
                          <Divider sx={{ mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">Course: <strong>{markedFor.course}</strong></Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Marked at: <strong>{new Date(markedFor.attendanceTime).toLocaleTimeString()}</strong>
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Your attendance for this lecture is already recorded.
                    </Typography>
                  </>
                ) : success ? (
                  <>
                    <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                    <Typography variant="h6" fontWeight={700} gutterBottom color="success.main">
                      Attendance Marked Successfully!
                    </Typography>
                    {markedFor && (
                      <Card variant="outlined" sx={{ mt: 2, mb: 2, bgcolor: '#f0fdf4', borderColor: '#86efac', textAlign: 'left' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                            <Avatar sx={{ bgcolor: '#16a34a', width: 40, height: 40 }}>
                              {markedFor.name?.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" fontWeight={700}>{markedFor.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{markedFor.studentCode}</Typography>
                            </Box>
                          </Box>
                          <Divider sx={{ mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">Lecture: <strong>{lecture?.lectureName}</strong></Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Time: <strong>{new Date(markedFor.attendanceTime).toLocaleTimeString()}</strong>
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : null}
              </Box>
            )}
          </Box>

          {/* Lecture info footer */}
          {lecture && lectureStatus === 'open' && (
            <Box sx={{ px: 3, pb: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(lecture.date).toLocaleDateString()} · {lecture.startTime}–{lecture.endTime}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Faculty: {lecture.facultyName}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
