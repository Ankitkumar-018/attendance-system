import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, Divider, Grid, Rating, Avatar, LinearProgress
} from '@mui/material';
import { ArrowBack, Download, Star, GridOn, AutoAwesome } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };
const RATING_COLORS = { 1: 'error', 2: 'warning', 3: 'warning', 4: 'success', 5: 'success' };

const starColor = (avg) => {
  if (!avg) return 'text.disabled';
  if (avg >= 4) return 'success.main';
  if (avg >= 3) return 'warning.main';
  return 'error.main';
};

function RatingBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.8 }}>
      <Typography variant="caption" sx={{ minWidth: 70, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ flex: 1 }}><LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} /></Box>
      <Typography variant="caption" sx={{ minWidth: 28, textAlign: 'right', color: 'text.secondary' }}>{count}</Typography>
    </Box>
  );
}

export default function FeedbackDetail() {
  const { lectureId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    api.get(`/feedback/lecture/${lectureId}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load feedback'))
      .finally(() => setLoading(false));
  }, [lectureId]);

  const handleDownloadCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const res = await fetch(`${BASE_URL}/feedback/export/lecture/${lectureId}/csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${lectureId}_feedback.tsv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  const handleAiAnalysis = async () => {
    setAiLoading(true);
    setAiError('');
    setAiAnalysis(null);
    try {
      const res = await api.post(`/feedback/analyze/${lectureId}`);
      setAiAnalysis(res.data.summary);
    } catch (e) {
      setAiError(e.response?.data?.message || 'AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportToSheets = async () => {
    setExportLoading(true);
    setExportMsg(null);
    try {
      const res = await api.post('/feedback/export-to-sheets', { lectureId });
      setExportMsg({ type: 'success', text: `Exported to sheet: "${res.data.sheetName}"` });
    } catch (e) {
      setExportMsg({ type: 'error', text: e.response?.data?.message || 'Export failed' });
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const { lecture, feedbacks, stats } = data;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/feedback')} variant="outlined" size="small">
          Back to Dashboard
        </Button>
        <Button startIcon={<Download />} onClick={handleDownloadCSV} variant="contained" size="small" disabled={feedbacks.length === 0}>
          Download CSV
        </Button>
        <Button
          startIcon={exportLoading ? <CircularProgress size={16} color="inherit" /> : <GridOn />}
          onClick={handleExportToSheets}
          variant="contained"
          size="small"
          disabled={feedbacks.length === 0 || exportLoading}
          sx={{ bgcolor: '#0f9d58', '&:hover': { bgcolor: '#0b8043' } }}
        >
          {exportLoading ? 'Exporting...' : 'Export to Google Sheet'}
        </Button>
        <Button
          startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
          onClick={handleAiAnalysis}
          variant="contained"
          size="small"
          disabled={feedbacks.length === 0 || aiLoading}
          sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
        >
          {aiLoading ? 'Analyzing...' : 'AI Analysis'}
        </Button>
      </Box>
      {exportMsg && (
        <Alert severity={exportMsg.type} onClose={() => setExportMsg(null)} sx={{ mb: 2 }}>
          {exportMsg.text}
        </Alert>
      )}

      {/* Lecture header */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>{lecture.lectureName}</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={lecture.course} size="small" color="primary" variant="outlined" />
            <Chip label={`Faculty: ${lecture.facultyName}`} size="small" variant="outlined" />
            <Chip label={new Date(lecture.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} size="small" variant="outlined" />
            <Chip label={`${lecture.startTime} – ${lecture.endTime}`} size="small" variant="outlined" />
            <Chip label={lecture.lectureId} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
          </Box>
        </CardContent>
      </Card>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Typography variant="h2" fontWeight={700} color={starColor(stats.avgRating)}>
                {stats.avgRating ?? '—'}
              </Typography>
              <Rating value={stats.avgRating} precision={0.1} readOnly sx={{ mt: 0.5 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Average Rating · {stats.count} response{stats.count !== 1 ? 's' : ''}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 2 }}>Rating Distribution</Typography>
              {[5, 4, 3, 2, 1].map(r => (
                <RatingBar
                  key={r}
                  label={`${r} ★ ${RATING_LABELS[r]}`}
                  count={stats.distribution[r] || 0}
                  total={stats.count}
                />
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Summary */}
      {aiError && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setAiError('')}>{aiError}</Alert>}
      {aiAnalysis && (
        <Card sx={{ mb: 3, border: '1px solid #7c3aed33', bgcolor: '#faf5ff' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AutoAwesome sx={{ color: '#7c3aed' }} />
              <Typography variant="h6" fontWeight={700} color="#7c3aed">AI Summary</Typography>
              <Chip label="Gemini" size="small" sx={{ bgcolor: '#7c3aed', color: '#fff', ml: 1 }} />
            </Box>
            {aiAnalysis.split('\n').filter(p => p.trim()).map((para, i) => (
              <Typography key={i} variant="body1" sx={{ color: 'text.primary', lineHeight: 1.9, fontSize: 15, mb: 1.5 }}>
                {para}
              </Typography>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Individual responses */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 3, py: 2 }}>
            <Typography variant="h6" fontWeight={600}>Student Responses ({stats.count})</Typography>
          </Box>
          <Divider />
          {feedbacks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography color="text.secondary">No feedback responses yet.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {['#', 'Student', 'Course', 'Rating', 'Comment', 'Time'].map(h =>
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {feedbacks.map((fb, i) => (
                    <TableRow key={fb._id} hover sx={{ verticalAlign: 'top' }}>
                      <TableCell sx={{ pt: 2 }}>{i + 1}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: '#1e40af', width: 34, height: 34, fontSize: 13 }}>
                            {fb.studentName?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{fb.studentName}</Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">{fb.studentCode}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">{fb.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell><Chip label={fb.course} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Rating value={fb.rating} readOnly size="small" icon={<Star fontSize="inherit" />} />
                          <Chip label={RATING_LABELS[fb.rating]} size="small" color={RATING_COLORS[fb.rating]} />
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', lineHeight: 1.6 }}>
                          "{fb.comment}"
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {new Date(fb.submittedAt).toLocaleTimeString('en-IN')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
