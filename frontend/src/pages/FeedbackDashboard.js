import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, Divider, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Avatar, Rating, LinearProgress, Tooltip, IconButton
} from '@mui/material';
import {
  RateReview, TrendingUp, Close, Visibility, Star, CalendarToday
} from '@mui/icons-material';
import api from '../services/api';

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };
const RATING_COLORS = { 1: 'error', 2: 'warning', 3: 'warning', 4: 'success', 5: 'success' };

function RatingBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.8 }}>
      <Typography variant="caption" sx={{ minWidth: 56, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ flex: 1 }}>
        <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
      </Box>
      <Typography variant="caption" sx={{ minWidth: 28, textAlign: 'right', color: 'text.secondary' }}>{count}</Typography>
    </Box>
  );
}

export default function FeedbackDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchDailySummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/feedback/daily?date=${date}`);
      setSummary(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load feedback data');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchDailySummary(); }, [fetchDailySummary]);

  const handleViewSession = async (session) => {
    setSelectedSession(session);
    setDetailLoading(true);
    setSessionDetail(null);
    try {
      const res = await api.get(`/feedback/lecture/${session.lectureId}`);
      setSessionDetail(res.data);
    } catch {
      setSessionDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedSession(null);
    setSessionDetail(null);
  };

  const starColor = (avg) => {
    if (!avg) return 'text.disabled';
    if (avg >= 4) return 'success.main';
    if (avg >= 3) return 'warning.main';
    return 'error.main';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <RateReview sx={{ color: 'info.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Feedback Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">Daily session feedback analytics</Typography>
        </Box>
      </Box>

      {/* Date picker */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <CalendarToday color="action" fontSize="small" />
            <TextField
              type="date"
              size="small"
              label="Select Date"
              value={date}
              InputLabelProps={{ shrink: true }}
              onChange={e => setDate(e.target.value)}
              sx={{ minWidth: 180 }}
            />
            <Button variant="outlined" size="small" onClick={() => setDate(today)}>Today</Button>
            {summary && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {summary && !loading && (
        <>
          {/* Summary cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Sessions with Feedback', value: summary.totalSessions, icon: '📚', color: 'primary.main' },
              { label: 'Total Responses', value: summary.totalFeedback, icon: '💬', color: 'info.main' },
              {
                label: 'Overall Avg Rating',
                value: summary.overallAvg ? `${summary.overallAvg} / 5` : '—',
                icon: '⭐',
                color: summary.overallAvg >= 4 ? 'success.main' : summary.overallAvg >= 3 ? 'warning.main' : 'error.main'
              }
            ].map(s => (
              <Grid item xs={12} sm={4} key={s.label}>
                <Card>
                  <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
                    <Typography fontSize={32} sx={{ mb: 0.5 }}>{s.icon}</Typography>
                    <Typography variant="h4" fontWeight={700} color={s.color}>{s.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Session table */}
          {summary.sessions.length === 0 ? (
            <Alert severity="info">
              No sessions with feedback enabled found for {new Date(date).toLocaleDateString()}.
            </Alert>
          ) : (
            <Card>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
                  <Typography variant="h6" fontWeight={600}>Session-wise Breakdown</Typography>
                  <Typography variant="body2" color="text.secondary">Click "View" to drill down into individual student responses</Typography>
                </Box>
                <Divider />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Session</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Course</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Faculty</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Time</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Responses</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Avg Rating</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {summary.sessions.map((s) => (
                        <TableRow key={s.lectureId} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{s.lectureName}</Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">{s.lectureId}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={s.course} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{s.facultyName}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{s.startTime}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={s.count}
                              size="small"
                              color={s.count > 0 ? 'info' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            {s.avgRating ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Rating value={s.avgRating} precision={0.1} readOnly size="small" />
                                <Typography variant="body2" fontWeight={700} color={starColor(s.avgRating)}>
                                  {s.avgRating}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.disabled">No data</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="View student responses">
                              <IconButton size="small" color="info" onClick={() => handleViewSession(s)} disabled={s.count === 0}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Session detail dialog */}
      <Dialog open={!!selectedSession} onClose={handleCloseDetail} maxWidth="md" fullWidth>
        {selectedSession && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={700}>{selectedSession.lectureName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedSession.course} · {selectedSession.facultyName} · {selectedSession.startTime}
                </Typography>
              </Box>
              <IconButton onClick={handleCloseDetail} size="small"><Close /></IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent>
              {detailLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
              {sessionDetail && !detailLoading && (
                <>
                  {/* Stats summary */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                        <Typography variant="h3" fontWeight={700} color={starColor(sessionDetail.stats.avgRating)}>
                          {sessionDetail.stats.avgRating ?? '—'}
                        </Typography>
                        <Rating value={sessionDetail.stats.avgRating} precision={0.1} readOnly size="small" sx={{ mt: 0.5 }} />
                        <Typography variant="caption" color="text.secondary" display="block">Average Rating</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5 }}>Rating Distribution</Typography>
                        {[5, 4, 3, 2, 1].map(r => (
                          <RatingBar
                            key={r}
                            label={`${r} ★ ${RATING_LABELS[r]}`}
                            count={sessionDetail.stats.distribution[r] || 0}
                            total={sessionDetail.stats.count}
                          />
                        ))}
                      </Box>
                    </Grid>
                  </Grid>

                  <Divider sx={{ mb: 2 }} />

                  {/* Individual responses */}
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                    Student Responses ({sessionDetail.stats.count})
                  </Typography>
                  {sessionDetail.feedbacks.length === 0 ? (
                    <Alert severity="info">No feedback responses yet.</Alert>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {sessionDetail.feedbacks.map((fb, i) => (
                        <Card key={fb._id} variant="outlined">
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                              <Avatar sx={{ bgcolor: '#1e40af', width: 36, height: 36, fontSize: 14 }}>
                                {fb.studentName?.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                  <Box>
                                    <Typography variant="body2" fontWeight={700}>{fb.studentName}</Typography>
                                    <Typography variant="caption" color="text.secondary">{fb.studentCode} · {fb.course}</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Rating value={fb.rating} readOnly size="small" />
                                    <Chip
                                      label={RATING_LABELS[fb.rating]}
                                      size="small"
                                      color={RATING_COLORS[fb.rating]}
                                    />
                                  </Box>
                                </Box>
                                <Typography variant="caption" color="text.secondary">{fb.email}</Typography>
                              </Box>
                            </Box>
                            <Divider sx={{ mb: 1.5 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              "{fb.comment}"
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                              Submitted at {new Date(fb.submittedAt).toLocaleTimeString()}
                            </Typography>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={handleCloseDetail} variant="outlined">Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
