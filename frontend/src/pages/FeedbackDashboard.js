import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, Divider, TextField, Tabs, Tab, Rating, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar, LinearProgress
} from '@mui/material';
import {
  RateReview, CalendarToday, Visibility, Close, Star, FilterList,
  EmojiEvents, Group, ThumbUp, TrendingUp, AutoAwesome
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };
const RATING_COLORS = { 1: 'error', 2: 'warning', 3: 'warning', 4: 'success', 5: 'success' };
const starColor = avg => !avg ? 'text.disabled' : avg >= 4 ? 'success.main' : avg >= 3 ? 'warning.main' : 'error.main';
const perfLabel = avg => !avg ? ['No data', 'default'] : avg >= 4.5 ? ['Excellent', 'success'] : avg >= 4 ? ['Good', 'success'] : avg >= 3 ? ['Average', 'warning'] : ['Needs Improvement', 'error'];

function RatingBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.8 }}>
      <Typography variant="caption" sx={{ minWidth: 78, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ flex: 1 }}><LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} /></Box>
      <Typography variant="caption" sx={{ minWidth: 28, textAlign: 'right', color: 'text.secondary' }}>{count}</Typography>
    </Box>
  );
}

export default function FeedbackDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();

  const [tab, setTab] = useState(0);

  // Daily tab
  const [date, setDate] = useState(today);
  const [daily, setDaily] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Overview tabs (1-3) with date range
  const [overviewFrom, setOverviewFrom] = useState('');
  const [overviewTo, setOverviewTo] = useState('');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');

  // Faculty dialog
  const [facultyDialog, setFacultyDialog] = useState(null);
  const [facultyDetail, setFacultyDetail] = useState(null);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState(0);
  const [facultyAiSummary, setFacultyAiSummary] = useState('');
  const [facultyAiLoading, setFacultyAiLoading] = useState(false);
  const [facultyAiError, setFacultyAiError] = useState('');

  // Use refs to read current date values in callbacks without stale closure
  const fromRef = useRef(overviewFrom);
  const toRef = useRef(overviewTo);
  fromRef.current = overviewFrom;
  toRef.current = overviewTo;

  const fetchDaily = async (d) => {
    setDailyLoading(true);
    try { const r = await api.get(`/feedback/daily?date=${d}`); setDaily(r.data); }
    catch (e) { setDaily(null); }
    finally { setDailyLoading(false); }
  };

  const fetchOverview = async (from, to) => {
    setOverviewLoading(true); setOverviewError(''); setOverview(null);
    try {
      const p = new URLSearchParams();
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const r = await api.get(`/feedback/overview?${p.toString()}`);
      setOverview(r.data);
    } catch (e) { setOverviewError(e.response?.data?.message || 'Failed to load'); }
    finally { setOverviewLoading(false); }
  };

  const handleApply = () => fetchOverview(fromRef.current, toRef.current);
  const handleClear = () => { setOverviewFrom(''); setOverviewTo(''); fetchOverview('', ''); };

  useEffect(() => { fetchDaily(date); }, [date]);
  // Fetch overview when switching to any overview tab (tabs 1-3) for the first time
  useEffect(() => { if (tab > 0 && !overview) fetchOverview('', ''); }, [tab]); // eslint-disable-line

  const handleViewLecture = (lectureId) => navigate(`/feedback/lecture/${lectureId}`);

  const handleFacultyAiSummary = async () => {
    setFacultyAiLoading(true);
    setFacultyAiError('');
    setFacultyAiSummary('');
    try {
      const r = await api.post('/feedback/analyze/faculty', {
        name: facultyDialog,
        from: fromRef.current || undefined,
        to: toRef.current || undefined
      });
      setFacultyAiSummary(r.data.summary);
    } catch (e) {
      setFacultyAiError(e.response?.data?.message || 'AI analysis failed');
    } finally {
      setFacultyAiLoading(false);
    }
  };

  const openFacultyDialog = async (name) => {
    setFacultyDialog(name);
    setFacultyDetail(null);
    setFacultyLoading(true);
    setRatingFilter(0);
    setFacultyAiSummary('');
    setFacultyAiError('');
    try {
      const p = new URLSearchParams({ name });
      if (fromRef.current) p.set('from', fromRef.current);
      if (toRef.current) p.set('to', toRef.current);
      const r = await api.get(`/feedback/faculty?${p.toString()}`);
      setFacultyDetail(r.data);
    } catch { setFacultyDetail({ error: true }); }
    finally { setFacultyLoading(false); }
  };

  const filteredFeedback = facultyDetail?.feedbacks?.filter(f => ratingFilter === 0 || f.rating === ratingFilter) || [];

  // ─── Shared date range filter UI ───────────────────────────────────────────
  const DateRangeBar = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
      <FilterList color="action" fontSize="small" />
      <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ minWidth: 80 }}>Date Range:</Typography>
      <TextField type="date" size="small" label="From" value={overviewFrom} InputLabelProps={{ shrink: true }}
        onChange={e => setOverviewFrom(e.target.value)} sx={{ minWidth: 160 }} />
      <TextField type="date" size="small" label="To" value={overviewTo} InputLabelProps={{ shrink: true }}
        onChange={e => setOverviewTo(e.target.value)} sx={{ minWidth: 160 }} />
      <Button size="small" variant="contained" onClick={handleApply}>Apply</Button>
      {(overviewFrom || overviewTo) && (
        <>
          <Button size="small" onClick={handleClear} color="inherit">Clear</Button>
          <Chip size="small" color="info" label={`${overviewFrom || 'All'} → ${overviewTo || 'Now'}`} />
        </>
      )}
    </Box>
  );

  const TABLE_HEAD_LECTURE = ['Session', 'Course', 'Faculty', 'Date', 'Responses', 'Avg Rating', ''];
  const TABLE_HEAD_DAILY   = ['Session', 'Course', 'Faculty', 'Time', 'Responses', 'Avg Rating', ''];

  const SessionRow = ({ s, showDate }) => (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>{s.lectureName}</Typography>
        <Typography variant="caption" color="text.secondary" fontFamily="monospace">{s.lectureId}</Typography>
      </TableCell>
      <TableCell><Chip label={s.course} size="small" variant="outlined" /></TableCell>
      <TableCell>{s.facultyName}</TableCell>
      <TableCell>{showDate ? new Date(s.date).toLocaleDateString('en-IN') : s.startTime}</TableCell>
      <TableCell><Chip label={s.count} size="small" color={s.count > 0 ? 'info' : 'default'} /></TableCell>
      <TableCell>
        {s.avgRating
          ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Rating value={s.avgRating} precision={0.1} readOnly size="small" />
              <Typography variant="body2" fontWeight={700} color={starColor(s.avgRating)}>{s.avgRating}</Typography>
            </Box>
          : <Typography variant="body2" color="text.disabled">No data</Typography>}
      </TableCell>
      <TableCell>
        <Tooltip title="View individual responses">
          <IconButton size="small" color="info" disabled={s.count === 0} onClick={() => handleViewLecture(s.lectureId)}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <RateReview sx={{ color: 'info.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Feedback Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">Lecture · Batch · Faculty analytics</Typography>
        </Box>
      </Box>

      <Card>
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
              <TextField type="date" size="small" label="Select Date" value={date}
                InputLabelProps={{ shrink: true }} onChange={e => setDate(e.target.value)} sx={{ minWidth: 180 }} />
              <Button variant="outlined" size="small" onClick={() => setDate(today)}>Today</Button>
            </Box>
            {dailyLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
            {daily && !dailyLoading && (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { label: 'Sessions', value: daily.totalSessions, color: 'primary.main' },
                    { label: 'Responses', value: daily.totalFeedback, color: 'info.main' },
                    { label: 'Avg Rating', value: daily.overallAvg ? `${daily.overallAvg} / 5` : '—', color: starColor(daily.overallAvg) }
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
                      <TableHead><TableRow>{TABLE_HEAD_DAILY.map(h => <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>)}</TableRow></TableHead>
                      <TableBody>{daily.sessions.map(s => <SessionRow key={s.lectureId} s={s} showDate={false} />)}</TableBody>
                    </Table></TableContainer>}
              </>
            )}
          </CardContent>
        )}

        {/* ── Lecture-wise ── */}
        {tab === 1 && (
          <Box>
            <DateRangeBar />
            <Box sx={{ px: 3, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>All Lectures with Feedback Enabled</Typography>
            </Box>
            <Divider />
            {overviewLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
            {overviewError && <Alert severity="error" sx={{ m: 2 }}>{overviewError}</Alert>}
            {overview && !overviewLoading && (
              overview.lectureWise.length === 0
                ? <Alert severity="info" sx={{ m: 2 }}>No lectures found for the selected period.</Alert>
                : <TableContainer><Table size="small">
                    <TableHead><TableRow>{TABLE_HEAD_LECTURE.map(h => <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>)}</TableRow></TableHead>
                    <TableBody>{overview.lectureWise.map(s => <SessionRow key={s.lectureId} s={s} showDate={true} />)}</TableBody>
                  </Table></TableContainer>
            )}
          </Box>
        )}

        {/* ── Batch-wise ── */}
        {tab === 2 && (
          <Box>
            <DateRangeBar />
            <Box sx={{ px: 3, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Overall Feedback by Batch</Typography>
              <Typography variant="body2" color="text.secondary">Weighted average across all lectures per batch</Typography>
            </Box>
            <Divider />
            {overviewLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
            {overviewError && <Alert severity="error" sx={{ m: 2 }}>{overviewError}</Alert>}
            {overview && !overviewLoading && (
              <TableContainer><Table>
                <TableHead><TableRow>
                  {['Batch / Course', 'Lectures', 'Responses', 'Avg Rating', 'Performance'].map(h =>
                    <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>)}
                </TableRow></TableHead>
                <TableBody>
                  {overview.batchWise.map(b => {
                    const [pl, pc] = perfLabel(b.avgRating);
                    return (
                      <TableRow key={b.course} hover>
                        <TableCell><Typography fontWeight={600}>{b.course}</Typography></TableCell>
                        <TableCell><Chip label={b.lectureCount} size="small" /></TableCell>
                        <TableCell><Chip label={b.count} size="small" color={b.count > 0 ? 'info' : 'default'} /></TableCell>
                        <TableCell>
                          {b.avgRating
                            ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Rating value={b.avgRating} precision={0.1} readOnly size="small" />
                                <Typography fontWeight={700} color={starColor(b.avgRating)}>{b.avgRating}</Typography>
                              </Box>
                            : <Typography variant="body2" color="text.disabled">No data</Typography>}
                        </TableCell>
                        <TableCell><Chip label={pl} size="small" color={pc} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table></TableContainer>
            )}
          </Box>
        )}

        {/* ── Faculty-wise ── */}
        {tab === 3 && (
          <Box>
            <DateRangeBar />

            {overviewLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
            {overviewError && <Alert severity="error" sx={{ m: 2 }}>{overviewError}</Alert>}

            {/* Faculty Dashboard Cards */}
            {overview && !overviewLoading && (() => {
              const all = overview.facultyWise;
              const withData = all.filter(f => f.count > 0);
              const totalResponses = withData.reduce((s, f) => s + f.count, 0);
              const overallAvg = withData.length > 0
                ? (withData.reduce((s, f) => s + f.avgRating * f.count, 0) / totalResponses).toFixed(1)
                : null;
              const sorted = [...withData].sort((a, b) => b.avgRating - a.avgRating);
              const topRated = sorted[0] || null;
              const mostActive = [...withData].sort((a, b) => b.count - a.count)[0] || null;
              const excellent = withData.filter(f => f.avgRating >= 4.5).length;

              return (
                <Box sx={{ px: 3, pt: 3, pb: 1 }}>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ p: 2.5, bgcolor: '#eff6ff', borderRadius: 2, textAlign: 'center', border: '1px solid #bfdbfe' }}>
                        <Group sx={{ color: '#2563eb', mb: 0.5 }} />
                        <Typography variant="h4" fontWeight={700} color="#2563eb">{all.length}</Typography>
                        <Typography variant="caption" color="text.secondary">Total Faculty</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ p: 2.5, bgcolor: '#f0fdf4', borderRadius: 2, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                        <TrendingUp sx={{ color: '#16a34a', mb: 0.5 }} />
                        <Typography variant="h4" fontWeight={700} color="#16a34a">{overallAvg ?? '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">Overall Avg Rating</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ p: 2.5, bgcolor: '#fff7ed', borderRadius: 2, textAlign: 'center', border: '1px solid #fed7aa' }}>
                        <ThumbUp sx={{ color: '#ea580c', mb: 0.5 }} />
                        <Typography variant="h4" fontWeight={700} color="#ea580c">{totalResponses}</Typography>
                        <Typography variant="caption" color="text.secondary">Total Responses</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ p: 2.5, bgcolor: '#fefce8', borderRadius: 2, textAlign: 'center', border: '1px solid #fde68a' }}>
                        <EmojiEvents sx={{ color: '#d97706', mb: 0.5 }} />
                        <Typography variant="h4" fontWeight={700} color="#d97706">{excellent}</Typography>
                        <Typography variant="caption" color="text.secondary">Excellent (≥ 4.5★)</Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Top performers highlight */}
                  {withData.length > 0 && (
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      {topRated && (
                        <Grid item xs={12} sm={6}>
                          <Box
                            sx={{ p: 2, bgcolor: '#fefce8', borderRadius: 2, border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { bgcolor: '#fef9c3' } }}
                            onClick={() => openFacultyDialog(topRated.facultyName)}
                          >
                            <EmojiEvents sx={{ color: '#d97706', fontSize: 36 }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>Top Rated Faculty</Typography>
                              <Typography variant="subtitle1" fontWeight={700}>{topRated.facultyName}</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Rating value={topRated.avgRating} precision={0.1} readOnly size="small" />
                                <Typography variant="body2" fontWeight={700} color={starColor(topRated.avgRating)}>{topRated.avgRating}</Typography>
                                <Typography variant="caption" color="text.secondary">({topRated.count} responses)</Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Grid>
                      )}
                      {mostActive && mostActive.facultyName !== topRated?.facultyName && (
                        <Grid item xs={12} sm={6}>
                          <Box
                            sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { bgcolor: '#dbeafe' } }}
                            onClick={() => openFacultyDialog(mostActive.facultyName)}
                          >
                            <Group sx={{ color: '#2563eb', fontSize: 36 }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>Most Responses</Typography>
                              <Typography variant="subtitle1" fontWeight={700}>{mostActive.facultyName}</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Rating value={mostActive.avgRating} precision={0.1} readOnly size="small" />
                                <Typography variant="body2" fontWeight={700} color={starColor(mostActive.avgRating)}>{mostActive.avgRating}</Typography>
                                <Typography variant="caption" color="text.secondary">({mostActive.count} responses)</Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  )}
                </Box>
              );
            })()}

            <Divider />
            <Box sx={{ px: 3, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>All Faculty</Typography>
              <Typography variant="body2" color="text.secondary">Click any row to view individual student feedback</Typography>
            </Box>
            <Divider />
            {overview && !overviewLoading && (
              <TableContainer><Table>
                <TableHead><TableRow>
                  {['Faculty', 'Lectures', 'Responses', 'Avg Rating', 'Performance', ''].map(h =>
                    <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>)}
                </TableRow></TableHead>
                <TableBody>
                  {overview.facultyWise.map(f => {
                    const [pl, pc] = perfLabel(f.avgRating);
                    return (
                      <TableRow
                        key={f.facultyName} hover
                        sx={{ cursor: f.count > 0 ? 'pointer' : 'default' }}
                        onClick={() => f.count > 0 && openFacultyDialog(f.facultyName)}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                              {f.facultyName?.charAt(0).toUpperCase()}
                            </Box>
                            <Typography fontWeight={600}>{f.facultyName}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell><Chip label={f.lectureCount} size="small" /></TableCell>
                        <TableCell><Chip label={f.count} size="small" color={f.count > 0 ? 'info' : 'default'} /></TableCell>
                        <TableCell>
                          {f.avgRating
                            ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Rating value={f.avgRating} precision={0.1} readOnly size="small" />
                                <Typography fontWeight={700} color={starColor(f.avgRating)}>{f.avgRating}</Typography>
                              </Box>
                            : <Typography variant="body2" color="text.disabled">No data</Typography>}
                        </TableCell>
                        <TableCell><Chip label={pl} size="small" color={pc} /></TableCell>
                        <TableCell>
                          {f.count > 0 && (
                            <Tooltip title="View all feedback">
                              <IconButton size="small" color="info" onClick={e => { e.stopPropagation(); openFacultyDialog(f.facultyName); }}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table></TableContainer>
            )}
          </Box>
        )}
      </Card>

      {/* ── Faculty Detail Dialog ── */}
      <Dialog open={!!facultyDialog} onClose={() => setFacultyDialog(null)} maxWidth="lg" fullWidth>
        {facultyDialog && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: '#1e40af', width: 42, height: 42, fontWeight: 700 }}>
                  {facultyDialog.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{facultyDialog}</Typography>
                  {(overviewFrom || overviewTo) && (
                    <Typography variant="caption" color="text.secondary">
                      Period: {overviewFrom || 'All'} → {overviewTo || 'Now'}
                    </Typography>
                  )}
                </Box>
              </Box>
              <IconButton onClick={() => setFacultyDialog(null)} size="small"><Close /></IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 3 }}>
              {facultyLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
              {facultyDetail?.error && <Alert severity="error">Failed to load feedback.</Alert>}
              {facultyDetail && !facultyDetail.error && !facultyLoading && (
                <>
                  {/* Stats + Distribution */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: 'center', p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="h2" fontWeight={700} color={starColor(facultyDetail.stats.avgRating)}>
                          {facultyDetail.stats.avgRating ?? '—'}
                        </Typography>
                        <Rating value={facultyDetail.stats.avgRating} precision={0.1} readOnly sx={{ mt: 0.5, justifyContent: 'center' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                          {facultyDetail.stats.count} response{facultyDetail.stats.count !== 1 ? 's' : ''} · {facultyDetail.lectureCount} lecture{facultyDetail.lectureCount !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Rating Distribution</Typography>
                        {[5, 4, 3, 2, 1].map(r => (
                          <RatingBar key={r} label={`${r} ★ ${RATING_LABELS[r]}`} count={facultyDetail.stats.distribution[r] || 0} total={facultyDetail.stats.count} />
                        ))}
                      </Box>
                    </Grid>
                  </Grid>

                  {/* AI Summary */}
                  <Box sx={{ mb: 2.5 }}>
                    <Button
                      startIcon={facultyAiLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                      onClick={handleFacultyAiSummary}
                      variant="contained"
                      size="small"
                      disabled={facultyAiLoading || (facultyDetail?.stats?.count === 0)}
                      sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
                    >
                      {facultyAiLoading ? 'Analyzing...' : 'AI Summary'}
                    </Button>
                    {facultyAiError && (
                      <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setFacultyAiError('')}>{facultyAiError}</Alert>
                    )}
                    {facultyAiSummary && (
                      <Box sx={{ mt: 1.5, p: 2, bgcolor: '#faf5ff', borderRadius: 2, border: '1px solid #7c3aed33' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <AutoAwesome sx={{ color: '#7c3aed', fontSize: 18 }} />
                          <Typography variant="subtitle2" fontWeight={700} color="#7c3aed">AI Summary</Typography>
                          <Chip label="Gemini" size="small" sx={{ bgcolor: '#7c3aed', color: '#fff' }} />
                        </Box>
                        {facultyAiSummary.split('\n').filter(p => p.trim()).map((para, i) => (
                          <Typography key={i} variant="body2" sx={{ lineHeight: 1.9, color: 'text.primary', mb: 1 }}>
                            {para}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Rating filter chips */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Filter by Rating:</Typography>
                    {[0, 5, 4, 3, 2, 1].map(r => (
                      <Chip
                        key={r}
                        icon={r > 0 ? <Star sx={{ fontSize: '14px !important' }} /> : undefined}
                        label={r === 0 ? `All (${facultyDetail.stats.count})` : `${r} ★  (${facultyDetail.stats.distribution[r] || 0})`}
                        onClick={() => setRatingFilter(r)}
                        color={ratingFilter === r ? (r === 0 ? 'primary' : RATING_COLORS[r]) : 'default'}
                        variant={ratingFilter === r ? 'filled' : 'outlined'}
                        size="small"
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      Showing {filteredFeedback.length} response{filteredFeedback.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {/* Feedback table */}
                  {filteredFeedback.length === 0 ? (
                    <Alert severity="info">No feedback with this rating.</Alert>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {['#', 'Student', 'Lecture', 'Rating', 'Comment', 'Date'].map(h =>
                              <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>)}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredFeedback.map((fb, i) => (
                            <TableRow key={fb._id} hover sx={{ verticalAlign: 'top' }}>
                              <TableCell sx={{ pt: 1.5 }}>{i + 1}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ bgcolor: '#1e40af', width: 28, height: 28, fontSize: 12 }}>
                                    {fb.studentName?.charAt(0).toUpperCase()}
                                  </Avatar>
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>{fb.studentName}</Typography>
                                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">{fb.studentCode}</Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">{fb.course}</Typography>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={500}>{fb.lectureName}</Typography>
                                {fb.lectureDate && (
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(fb.lectureDate).toLocaleDateString('en-IN')}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                                  <Rating value={fb.rating} readOnly size="small" />
                                  <Chip label={RATING_LABELS[fb.rating]} size="small" color={RATING_COLORS[fb.rating]} />
                                </Box>
                              </TableCell>
                              <TableCell sx={{ maxWidth: 260 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', lineHeight: 1.5 }}>
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
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setFacultyDialog(null)} variant="outlined">Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
