import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, Divider, TextField, Tabs, Tab, Rating, Tooltip, IconButton
} from '@mui/material';
import { RateReview, CalendarToday, Visibility, OpenInNew } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const starColor = (avg) => {
  if (!avg) return 'text.disabled';
  if (avg >= 4) return 'success.main';
  if (avg >= 3) return 'warning.main';
  return 'error.main';
};

function SessionRow({ s, onView }) {
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>{s.lectureName}</Typography>
        <Typography variant="caption" color="text.secondary" fontFamily="monospace">{s.lectureId}</Typography>
      </TableCell>
      <TableCell><Chip label={s.course} size="small" variant="outlined" /></TableCell>
      <TableCell><Typography variant="body2">{s.facultyName}</Typography></TableCell>
      {s.date && <TableCell><Typography variant="body2">{new Date(s.date).toLocaleDateString('en-IN')}</Typography></TableCell>}
      {s.startTime && !s.date && <TableCell><Typography variant="body2">{s.startTime}</Typography></TableCell>}
      <TableCell><Chip label={s.count} size="small" color={s.count > 0 ? 'info' : 'default'} /></TableCell>
      <TableCell>
        {s.avgRating ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Rating value={s.avgRating} precision={0.1} readOnly size="small" />
            <Typography variant="body2" fontWeight={700} color={starColor(s.avgRating)}>{s.avgRating}</Typography>
          </Box>
        ) : <Typography variant="body2" color="text.disabled">No data</Typography>}
      </TableCell>
      <TableCell>
        <Tooltip title="View all feedback">
          <IconButton size="small" color="info" onClick={() => onView(s.lectureId)} disabled={s.count === 0}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

export default function FeedbackDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [date, setDate] = useState(today);
  const [daily, setDaily] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDaily = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await api.get(`/feedback/daily?date=${date}`); setDaily(r.data); }
    catch (e) { setError(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [date]);

  const fetchOverview = useCallback(async () => {
    if (overview) return;
    setLoading(true); setError('');
    try { const r = await api.get('/feedback/overview'); setOverview(r.data); }
    catch (e) { setError(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [overview]);

  useEffect(() => { if (tab === 0) fetchDaily(); }, [tab, fetchDaily]);
  useEffect(() => { if (tab > 0) fetchOverview(); }, [tab, fetchOverview]);

  const handleView = (lectureId) => navigate(`/feedback/lecture/${lectureId}`);

  const LECTURE_HEAD = ['Session', 'Course', 'Faculty', 'Date', 'Responses', 'Avg Rating', ''];
  const DAILY_HEAD  = ['Session', 'Course', 'Faculty', 'Time', 'Responses', 'Avg Rating', ''];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <RateReview sx={{ color: 'info.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Feedback Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">Lecture · Batch · Faculty analytics</Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="Daily View" />
          <Tab label="Lecture-wise" />
          <Tab label="Batch-wise" />
          <Tab label="Faculty-wise" />
        </Tabs>

        {/* ── Daily ── */}
        {tab === 0 && (
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <CalendarToday color="action" fontSize="small" />
              <TextField type="date" size="small" label="Select Date" value={date} InputLabelProps={{ shrink: true }}
                onChange={e => setDate(e.target.value)} sx={{ minWidth: 180 }} />
              <Button variant="outlined" size="small" onClick={() => setDate(today)}>Today</Button>
            </Box>
            {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error">{error}</Alert>}
            {daily && !loading && (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { label: 'Sessions', value: daily.totalSessions, color: 'primary.main' },
                    { label: 'Responses', value: daily.totalFeedback, color: 'info.main' },
                    { label: 'Avg Rating', value: daily.overallAvg ? `${daily.overallAvg} / 5` : '—', color: daily.overallAvg >= 4 ? 'success.main' : daily.overallAvg >= 3 ? 'warning.main' : 'error.main' }
                  ].map(s => (
                    <Grid item xs={4} key={s.label}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                        <Typography variant="h4" fontWeight={700} color={s.color}>{s.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                {daily.sessions.length === 0
                  ? <Alert severity="info">No sessions with feedback enabled on this date.</Alert>
                  : <TableContainer><Table size="small">
                      <TableHead><TableRow>{DAILY_HEAD.map(h => <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>)}</TableRow></TableHead>
                      <TableBody>{daily.sessions.map(s => <SessionRow key={s.lectureId} s={s} onView={handleView} />)}</TableBody>
                    </Table></TableContainer>
                }
              </>
            )}
          </CardContent>
        )}

        {/* ── Lecture-wise ── */}
        {tab === 1 && (
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>All Lectures with Feedback Enabled</Typography>
              <Typography variant="body2" color="text.secondary">Click the eye icon to view individual responses</Typography>
            </Box>
            <Divider />
            {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
            {overview && !loading && (
              overview.lectureWise.length === 0
                ? <Alert severity="info" sx={{ m: 2 }}>No lectures with feedback enabled yet.</Alert>
                : <TableContainer><Table size="small">
                    <TableHead><TableRow>{LECTURE_HEAD.map(h => <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>)}</TableRow></TableHead>
                    <TableBody>{overview.lectureWise.map(s => <SessionRow key={s.lectureId} s={s} onView={handleView} />)}</TableBody>
                  </Table></TableContainer>
            )}
          </CardContent>
        )}

        {/* ── Batch-wise ── */}
        {tab === 2 && (
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Overall Feedback by Batch</Typography>
              <Typography variant="body2" color="text.secondary">Weighted average across all lectures per batch</Typography>
            </Box>
            <Divider />
            {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
            {overview && !loading && (
              <TableContainer><Table>
                <TableHead>
                  <TableRow>
                    {['Batch / Course', 'Lectures', 'Total Responses', 'Avg Rating', 'Performance'].map(h =>
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.batchWise.map(b => (
                    <TableRow key={b.course} hover>
                      <TableCell><Typography fontWeight={600}>{b.course}</Typography></TableCell>
                      <TableCell><Chip label={b.lectureCount} size="small" /></TableCell>
                      <TableCell><Chip label={b.count} size="small" color="info" /></TableCell>
                      <TableCell>
                        {b.avgRating
                          ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Rating value={b.avgRating} precision={0.1} readOnly size="small" />
                              <Typography fontWeight={700} color={starColor(b.avgRating)}>{b.avgRating}</Typography>
                            </Box>
                          : <Typography variant="body2" color="text.disabled">No data</Typography>
                        }
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={!b.avgRating ? 'No data' : b.avgRating >= 4.5 ? 'Excellent' : b.avgRating >= 4 ? 'Good' : b.avgRating >= 3 ? 'Average' : 'Needs Improvement'}
                          size="small"
                          color={!b.avgRating ? 'default' : b.avgRating >= 4 ? 'success' : b.avgRating >= 3 ? 'warning' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></TableContainer>
            )}
          </CardContent>
        )}

        {/* ── Faculty-wise ── */}
        {tab === 3 && (
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Overall Feedback by Faculty</Typography>
              <Typography variant="body2" color="text.secondary">Weighted average across all lectures per faculty member</Typography>
            </Box>
            <Divider />
            {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
            {overview && !loading && (
              <TableContainer><Table>
                <TableHead>
                  <TableRow>
                    {['Faculty', 'Lectures', 'Total Responses', 'Avg Rating', 'Performance'].map(h =>
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.facultyWise.map(f => (
                    <TableRow key={f.facultyName} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                            {f.facultyName?.charAt(0).toUpperCase()}
                          </Box>
                          <Typography fontWeight={600}>{f.facultyName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Chip label={f.lectureCount} size="small" /></TableCell>
                      <TableCell><Chip label={f.count} size="small" color="info" /></TableCell>
                      <TableCell>
                        {f.avgRating
                          ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Rating value={f.avgRating} precision={0.1} readOnly size="small" />
                              <Typography fontWeight={700} color={starColor(f.avgRating)}>{f.avgRating}</Typography>
                            </Box>
                          : <Typography variant="body2" color="text.disabled">No data</Typography>
                        }
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={!f.avgRating ? 'No data' : f.avgRating >= 4.5 ? 'Excellent' : f.avgRating >= 4 ? 'Good' : f.avgRating >= 3 ? 'Average' : 'Needs Improvement'}
                          size="small"
                          color={!f.avgRating ? 'default' : f.avgRating >= 4 ? 'success' : f.avgRating >= 3 ? 'warning' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></TableContainer>
            )}
          </CardContent>
        )}
      </Card>
    </Box>
  );
}
