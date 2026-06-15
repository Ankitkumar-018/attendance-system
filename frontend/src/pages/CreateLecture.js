import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Select, MenuItem,
  FormControl, InputLabel, Grid, Alert, Divider, Chip, FormControlLabel, Switch, Paper
} from '@mui/material';
import { ArrowBack, QrCode2, Download, RateReview } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const EMPTY_FORM = {
  lectureName: '',
  course: '',
  facultyName: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '10:00',
  endTime: '11:00',
  attendanceWindowMinutes: 15,
  releaseFeedback: false
};

export default function CreateLecture() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/students/courses').then(res => setCourses(res.data.courses));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/lectures', form);
      setCreated(res.data.lecture);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create lecture');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = created.qrCode;
    link.download = `${created.lectureId}_QR.png`;
    link.click();
  };

  if (created) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/lectures')} sx={{ mb: 2 }}>Back to Lectures</Button>
        <Card sx={{ maxWidth: 600, mx: 'auto' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="success" sx={{ mb: 3 }}>Lecture created successfully!</Alert>
            <Typography variant="h6" fontWeight={700} gutterBottom>{created.lectureName}</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>{created.course}</Typography>
            <Typography variant="body2" fontFamily="monospace" color="primary" gutterBottom>{created.lectureId}</Typography>
            {created.releaseFeedback && (
              <Chip icon={<RateReview />} label="Feedback Enabled" color="info" size="small" sx={{ mb: 1 }} />
            )}
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom>QR Code for Attendance</Typography>
            <Box sx={{ display: 'inline-block', p: 2, border: '2px solid #e5e7eb', borderRadius: 3, mb: 2 }}>
              <img src={created.qrCode} alt="QR Code" style={{ width: 250, height: 250, display: 'block' }} />
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Attendance window: {created.attendanceWindowMinutes} minutes from {created.startTime}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="contained" startIcon={<Download />} onClick={downloadQR}>Download QR</Button>
              <Button variant="outlined" onClick={() => { setCreated(null); setForm(EMPTY_FORM); }}>
                Create Another
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/lectures')} sx={{ mb: 2 }}>Back to Lectures</Button>
      <Typography variant="h5" fontWeight={700} gutterBottom>Create New Lecture</Typography>
      <Card sx={{ maxWidth: 700 }}>
        <CardContent sx={{ p: 4 }}>
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2.5}>
              <Grid item xs={12}>
                <TextField fullWidth required label="Lecture Name" value={form.lectureName} onChange={e => setForm(p => ({ ...p, lectureName: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Course</InputLabel>
                  <Select value={form.course} label="Course" onChange={e => setForm(p => ({ ...p, course: e.target.value }))}>
                    <MenuItem value="Common Session">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>🌐</span> <strong>Common Session (All Batches)</strong>
                      </Box>
                    </MenuItem>
                    <Divider />
                    {courses.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Faculty Name" value={form.facultyName} onChange={e => setForm(p => ({ ...p, facultyName: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth required type="date" label="Date" value={form.date} InputLabelProps={{ shrink: true }} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth required type="time" label="Start Time" value={form.startTime} InputLabelProps={{ shrink: true }} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth required type="time" label="End Time" value={form.endTime} InputLabelProps={{ shrink: true }} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required type="number" label="Attendance Window (minutes)" value={form.attendanceWindowMinutes} inputProps={{ min: 1, max: 120 }} onChange={e => setForm(p => ({ ...p, attendanceWindowMinutes: Number(e.target.value) }))} helperText="How long students can mark attendance after lecture starts" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                      <RateReview fontSize="small" color={form.releaseFeedback ? 'info' : 'disabled'} />
                      <Typography variant="body2" fontWeight={600}>Release Feedback</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Students must submit feedback before marking attendance
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.releaseFeedback}
                        onChange={e => setForm(p => ({ ...p, releaseFeedback: e.target.checked }))}
                        color="info"
                      />
                    }
                    label=""
                    sx={{ mr: 0 }}
                  />
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Button fullWidth variant="contained" size="large" type="submit" disabled={loading} startIcon={<QrCode2 />}>
                  {loading ? 'Creating...' : 'Create Lecture & Generate QR'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
