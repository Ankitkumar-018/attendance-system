import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Alert,
  CircularProgress, Avatar, Divider, Chip, Stepper, Step, StepLabel,
  Rating, FormHelperText
} from '@mui/material';
import {
  QrCode2, CheckCircle, Person, Cancel, HourglassEmpty, LockClock,
  RateReview, Star
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

const getDeviceId = () => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('deviceId', id);
  }
  return id;
};

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };

export default function MarkAttendance() {
  const { lectureId } = useParams();
  const deviceId = getDeviceId();

  // phase: 'loading' | 'not_found' | 'not_started' | 'closed' | 'find' | 'feedback' | 'confirm' | 'done'
  const [phase, setPhase] = useState('loading');
  const [lecture, setLecture] = useState(null);
  const [student, setStudent] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Feedback form
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingError, setRatingError] = useState('');
  const [commentError, setCommentError] = useState('');

  // Done state
  const [success, setSuccess] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [markedFor, setMarkedFor] = useState(null);

  useEffect(() => {
    axios.get(`${BASE_URL}/lectures/public/${lectureId}`)
      .then(res => {
        setLecture(res.data.lecture);
        const status = res.data.lecture.windowStatus;
        setPhase(status === 'open' ? 'find' : status);
      })
      .catch(() => setPhase('not_found'));

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
      if (res.data.feedbackRequired && !res.data.feedbackSubmitted) {
        setPhase('feedback');
      } else {
        setPhase('confirm');
      }
    } catch (err) {
      const data = err.response?.data || {};
      if (data.alreadyMarked || data.deviceBlocked) {
        setAlreadyMarked(true);
        if (data.markedFor) setMarkedFor(data.markedFor);
        setPhase('done');
      } else {
        setError(data.message || 'Student not found');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    let valid = true;
    if (!rating) { setRatingError('Please rate the class (1–5)'); valid = false; }
    else setRatingError('');
    if (!comment.trim()) { setCommentError('Please share your session feedback'); valid = false; }
    else setCommentError('');
    if (!valid) return;

    setLoading(true);
    setError('');
    try {
      await axios.post(`${BASE_URL}/feedback/submit`, {
        lectureId,
        studentCode: student.studentCode,
        rating,
        comment: comment.trim()
      });
      setPhase('confirm');
    } catch (err) {
      const data = err.response?.data || {};
      if (data.alreadySubmitted) {
        setPhase('confirm');
      } else {
        setError(data.message || 'Failed to submit feedback. Please try again.');
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
      setPhase('done');
      setTimeout(() => { window.location.href = 'https://www.masaischool.com'; }, 3000);
    } catch (err) {
      const data = err.response?.data || {};
      if (data.alreadyMarked || data.deviceBlocked) {
        setAlreadyMarked(true);
        if (data.markedFor) setMarkedFor(data.markedFor);
        setPhase('done');
      } else if (data.feedbackRequired) {
        setError('Please submit your feedback first.');
        setPhase('feedback');
      } else {
        setError(data.message || 'Failed to mark attendance');
      }
    } finally {
      setLoading(false);
    }
  };

  const feedbackRequired = !!lecture?.releaseFeedback;
  const stepperLabels = feedbackRequired
    ? ['Find Record', 'Feedback', 'Confirm', 'Done']
    : ['Find Record', 'Confirm', 'Done'];
  const activeStep = feedbackRequired
    ? ({ find: 0, feedback: 1, confirm: 2, done: 3 }[phase] ?? 0)
    : ({ find: 0, confirm: 1, done: 2 }[phase] ?? 0);

  const isOpenPhase = ['find', 'feedback', 'confirm', 'done'].includes(phase);

  const renderStatus = () => {
    if (phase === 'loading') return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
    if (phase === 'not_found') return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Cancel sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={600}>Invalid QR Code</Typography>
        <Typography variant="body2" color="text.secondary">This lecture does not exist.</Typography>
      </Box>
    );
    if (phase === 'not_started') return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <HourglassEmpty sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} color="warning.dark">Lecture Not Started Yet</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Attendance opens at {lecture?.startTime} on {new Date(lecture?.date).toLocaleDateString()}
        </Typography>
      </Box>
    );
    if (phase === 'closed') return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <LockClock sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} color="error.main">Attendance for this lecture is closed</Typography>
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
          <Box sx={{ bgcolor: '#0f172a', p: 3, borderRadius: '12px 12px 0 0', textAlign: 'center' }}>
            <QrCode2 sx={{ fontSize: 40, color: '#60a5fa', mb: 1 }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>Mark Your Attendance</Typography>
            {lecture && (
              <>
                <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>{lecture.lectureName}</Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1, flexWrap: 'wrap' }}>
                  <Chip label={lecture.course} size="small" sx={{ bgcolor: '#1e3a5f', color: '#93c5fd', fontSize: 11 }} />
                  {lecture.releaseFeedback && (
                    <Chip
                      icon={<RateReview sx={{ fontSize: '14px !important', color: '#86efac !important' }} />}
                      label="Feedback Required"
                      size="small"
                      sx={{ bgcolor: '#14532d', color: '#86efac', fontSize: 11 }}
                    />
                  )}
                </Box>
              </>
            )}
          </Box>

          <Box sx={{ p: 3 }}>
            {isOpenPhase && phase !== 'done' && (
              <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
                {stepperLabels.map(label => (
                  <Step key={label}>
                    <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: 11 } }}>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            )}

            {!isOpenPhase && renderStatus()}

            {/* Find student */}
            {phase === 'find' && (
              <Box component="form" onSubmit={handleFindStudent}>
                <Typography variant="body1" fontWeight={600} gutterBottom>Enter your registered details</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter your email address or mobile number to find your record.
                </Typography>
                {feedbackRequired && (
                  <Alert severity="info" icon={<RateReview fontSize="small" />} sx={{ mb: 2, fontSize: 13 }}>
                    You will be asked to submit a short feedback form before marking attendance.
                  </Alert>
                )}
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

            {/* Feedback form */}
            {phase === 'feedback' && student && (
              <Box component="form" onSubmit={handleSubmitFeedback}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <RateReview color="info" />
                  <Typography variant="body1" fontWeight={700}>Session Feedback</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Hi <strong>{student.name}</strong>, please rate today's class before marking your attendance.
                </Typography>

                {/* Q1: Rating */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    1. Rate your today's class understanding and instructor delivery (1–5)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5, flexWrap: 'wrap' }}>
                    <Rating
                      value={rating}
                      onChange={(_, val) => { setRating(val); setRatingError(''); }}
                      size="large"
                      icon={<Star fontSize="inherit" />}
                    />
                    {rating > 0 && (
                      <Chip
                        label={RATING_LABELS[rating]}
                        size="small"
                        color={rating >= 4 ? 'success' : rating === 3 ? 'warning' : 'error'}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    1 = Poor · 2 = Fair · 3 = Average · 4 = Good · 5 = Excellent
                  </Typography>
                  {ratingError && <FormHelperText error sx={{ mt: 0.5 }}>{ratingError}</FormHelperText>}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Q2: Comment */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    2. How was today's session? *
                  </Typography>
                  <TextField
                    fullWidth multiline rows={3}
                    placeholder="Share your comments or suggestions about today's class..."
                    value={comment}
                    onChange={e => { setComment(e.target.value); setCommentError(''); }}
                    error={!!commentError}
                    helperText={commentError}
                  />
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Button fullWidth variant="contained" size="large" type="submit" disabled={loading} color="info">
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Submit Feedback & Continue'}
                </Button>
              </Box>
            )}

            {/* Confirm identity */}
            {phase === 'confirm' && student && (
              <Box>
                {feedbackRequired ? (
                  <Alert severity="success" icon={<CheckCircle fontSize="small" />} sx={{ mb: 2, fontSize: 13 }}>
                    Feedback submitted! Now confirm your identity to mark attendance.
                  </Alert>
                ) : (
                  <Typography variant="body1" fontWeight={600} gutterBottom>Is this you?</Typography>
                )}
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
                  <Button fullWidth variant="outlined" size="large" startIcon={<Cancel />}
                    onClick={() => { setPhase('find'); setStudent(null); setIdentifier(''); setRating(0); setComment(''); }}>
                    Not Me
                  </Button>
                  <Button fullWidth variant="contained" size="large" startIcon={<Person />}
                    onClick={handleMarkAttendance} disabled={loading} color="success">
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Yes, It's Me!"}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Done */}
            {phase === 'done' && (
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
                    <Typography variant="caption" color="text.secondary">Redirecting to Masai School...</Typography>
                  </>
                ) : null}
              </Box>
            )}
          </Box>

          {lecture && ['find', 'feedback', 'confirm'].includes(phase) && (
            <Box sx={{ px: 3, pb: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(lecture.date).toLocaleDateString()} · {lecture.startTime}–{lecture.endTime}
                </Typography>
                <Typography variant="caption" color="text.secondary">Faculty: {lecture.facultyName}</Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
