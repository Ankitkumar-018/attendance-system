import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Button, Grid, CircularProgress, Alert, Divider, Tabs, Tab, Tooltip, IconButton,
  Rating, LinearProgress, Avatar
} from '@mui/material';
import { Download, PictureAsPdf, HowToReg, RateReview, OpenInNew, Star } from '@mui/icons-material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };
const RATING_COLORS = { 1: 'error', 2: 'warning', 3: 'warning', 4: 'success', 5: 'success' };
const starColor = avg => !avg ? 'text.disabled' : avg >= 4 ? 'success.main' : avg >= 3 ? 'warning.main' : 'error.main';

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

export default function AttendanceReports() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(searchParams.get('lectureId') || '');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [markingId, setMarkingId] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    api.get('/students/courses').then(r => setCourses(r.data.courses));
    api.get('/lectures', { params: { limit: 200 } }).then(r => setLectures(r.data.lectures));
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedLecture) return;
    setLoading(true);
    setFeedbackData(null);
    setTab(0);
    try {
      const res = await api.get(`/attendance/lecture/${selectedLecture}`);
      setReportData(res.data);
    } finally {
      setLoading(false);
    }
  }, [selectedLecture]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Fetch feedback when feedback tab is selected
  useEffect(() => {
    if (tab !== 2 || !selectedLecture || feedbackData) return;
    setFeedbackLoading(true);
    api.get(`/feedback/lecture/${selectedLecture}`)
      .then(r => setFeedbackData(r.data))
      .catch(() => setFeedbackData({ error: true }))
      .finally(() => setFeedbackLoading(false));
  }, [tab, selectedLecture, feedbackData]);

  const filteredLectures = courseFilter ? lectures.filter(l => l.course === courseFilter) : lectures;
  const BASE_URL = process.env.REACT_APP_API_URL || '/api';

  const handleDownload = async (url, filename) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  const handleCSVExport = () => handleDownload(`${BASE_URL}/attendance/export/lecture/${selectedLecture}/csv`, `${selectedLecture}_attendance.tsv`);
  const handlePDFExport = () => handleDownload(`${BASE_URL}/attendance/export/lecture/${selectedLecture}/pdf`, `${selectedLecture}_attendance.pdf`);

  const handleMarkPresent = async (student) => {
    if (!window.confirm(`Mark ${student.name} as Present?`)) return;
    setMarkingId(student._id);
    try {
      await api.post('/attendance/mark-manual', { lectureId: selectedLecture, studentCode: student.studentCode });
      setReportData(prev => ({
        ...prev,
        present: [...prev.present, { _id: student._id, studentCode: student.studentCode, studentName: student.name, email: student.email, course: student.course, attendanceTime: new Date(), browserInfo: 'Manual — marked by admin' }],
        absentStudents: prev.absentStudents.filter(s => s._id !== student._id),
        stats: { ...prev.stats, present: prev.stats.present + 1, absent: prev.stats.absent - 1, percentage: (((prev.stats.present + 1) / prev.stats.total) * 100).toFixed(1) }
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark present');
    } finally {
      setMarkingId(null);
    }
  };

  const feedbackEnabled = !!reportData?.lecture?.releaseFeedback;
  const feedbackCount = feedbackData?.stats?.count ?? (feedbackEnabled ? '…' : 0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Attendance Reports</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Course</InputLabel>
              <Select value={courseFilter} label="Filter by Course" onChange={e => setCourseFilter(e.target.value)}>
                <MenuItem value="">All Courses</MenuItem>
                {courses.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 320 }}>
              <InputLabel>Select Lecture</InputLabel>
              <Select value={selectedLecture} label="Select Lecture" onChange={e => setSelectedLecture(e.target.value)}>
                <MenuItem value="">-- Select a lecture --</MenuItem>
                {filteredLectures.map(l => (
                  <MenuItem key={l.lectureId} value={l.lectureId}>
                    {l.lectureId} — {l.lectureName} ({new Date(l.date).toLocaleDateString()})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {!selectedLecture && <Alert severity="info">Select a lecture to view attendance report.</Alert>}
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>}

      {reportData && !loading && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total Students', value: reportData.stats.total },
              { label: 'Present', value: reportData.stats.present, color: 'success.main' },
              { label: 'Absent', value: reportData.stats.absent, color: 'error.main' },
              { label: 'Attendance %', value: `${reportData.stats.percentage}%`, color: reportData.stats.percentage >= 75 ? 'success.main' : 'error.main' }
            ].map(s => (
              <Grid item xs={6} sm={3} key={s.label}>
                <Card>
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} color={s.color || 'text.primary'}>{s.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, pt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>{reportData.lecture?.lectureName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {reportData.lecture?.course} · {reportData.lecture?.facultyName} · {new Date(reportData.lecture?.date).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" startIcon={<Download />} onClick={handleCSVExport}>CSV</Button>
                  <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={handlePDFExport}>PDF</Button>
                </Box>
              </Box>
              <Divider sx={{ mt: 2 }} />
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
                <Tab label={`Present (${reportData.stats.present})`} />
                <Tab label={`Absent (${reportData.stats.absent})`} />
                <Tab
                  label={feedbackEnabled ? `Feedback (${feedbackCount})` : 'Feedback'}
                  icon={feedbackEnabled ? undefined : undefined}
                  iconPosition="end"
                  disabled={!feedbackEnabled}
                  sx={{ '&.Mui-disabled': { opacity: feedbackEnabled ? 1 : 0.4 } }}
                />
              </Tabs>
              <Divider />

              {/* Present tab */}
              {tab === 0 && (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        {['#', 'Student Code', 'Name', 'Email', 'Status', 'Time'].map(h =>
                          <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportData.present.map((a, i) => (
                        <TableRow key={a._id} hover>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell><Typography variant="caption" fontFamily="monospace">{a.studentCode}</Typography></TableCell>
                          <TableCell>{a.studentName}</TableCell>
                          <TableCell><Typography variant="body2" color="text.secondary">{a.email}</Typography></TableCell>
                          <TableCell><Chip label="Present" size="small" color="success" /></TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {new Date(a.attendanceTime).toLocaleTimeString()}
                              {a.browserInfo === 'Manual — marked by admin' &&
                                <Chip label="Manual" size="small" sx={{ ml: 1, fontSize: 10 }} color="warning" variant="outlined" />}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      {reportData.present.length === 0 && (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No records</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Absent tab */}
              {tab === 1 && (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        {['#', 'Student Code', 'Name', 'Email', 'Status', 'Action'].map(h =>
                          <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportData.absentStudents.map((s, i) => (
                        <TableRow key={s._id} hover>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell><Typography variant="caption" fontFamily="monospace">{s.studentCode}</Typography></TableCell>
                          <TableCell>{s.name}</TableCell>
                          <TableCell><Typography variant="body2" color="text.secondary">{s.email}</Typography></TableCell>
                          <TableCell><Chip label="Absent" size="small" color="error" /></TableCell>
                          <TableCell>
                            <Tooltip title="Mark as Present">
                              <IconButton size="small" color="success" disabled={markingId === s._id} onClick={() => handleMarkPresent(s)}>
                                <HowToReg fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                      {reportData.absentStudents.length === 0 && (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No records</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Feedback tab */}
              {tab === 2 && (
                <Box sx={{ p: 3 }}>
                  {feedbackLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
                  {feedbackData?.error && <Alert severity="error">Failed to load feedback data.</Alert>}
                  {feedbackData && !feedbackData.error && !feedbackLoading && (
                    <>
                      {/* Stats row */}
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                            <Typography variant="h3" fontWeight={700} color={starColor(feedbackData.stats.avgRating)}>
                              {feedbackData.stats.avgRating ?? '—'}
                            </Typography>
                            <Rating value={feedbackData.stats.avgRating} precision={0.1} readOnly size="small" sx={{ mt: 0.5 }} />
                            <Typography variant="caption" color="text.secondary" display="block">
                              Avg Rating · {feedbackData.stats.count} response{feedbackData.stats.count !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Distribution</Typography>
                            {[5, 4, 3, 2, 1].map(r => (
                              <RatingBar key={r} label={`${r} ★ ${RATING_LABELS[r]}`} count={feedbackData.stats.distribution[r] || 0} total={feedbackData.stats.count} />
                            ))}
                          </Box>
                        </Grid>
                      </Grid>

                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button
                          size="small" variant="outlined" startIcon={<OpenInNew />}
                          onClick={() => navigate(`/feedback/lecture/${selectedLecture}`)}
                        >
                          Full Feedback Report
                        </Button>
                      </Box>

                      {feedbackData.feedbacks.length === 0 ? (
                        <Alert severity="info">No feedback responses yet.</Alert>
                      ) : (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                {['#', 'Student', 'Course', 'Rating', 'Comment', 'Time'].map(h =>
                                  <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{h}</TableCell>
                                )}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {feedbackData.feedbacks.map((fb, i) => (
                                <TableRow key={fb._id} hover sx={{ verticalAlign: 'top' }}>
                                  <TableCell sx={{ pt: 2 }}>{i + 1}</TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Avatar sx={{ bgcolor: '#1e40af', width: 28, height: 28, fontSize: 12 }}>
                                        {fb.studentName?.charAt(0).toUpperCase()}
                                      </Avatar>
                                      <Box>
                                        <Typography variant="body2" fontWeight={600}>{fb.studentName}</Typography>
                                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">{fb.studentCode}</Typography>
                                      </Box>
                                    </Box>
                                  </TableCell>
                                  <TableCell><Chip label={fb.course} size="small" variant="outlined" /></TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Rating value={fb.rating} readOnly size="small" icon={<Star fontSize="inherit" />} />
                                      <Chip label={RATING_LABELS[fb.rating]} size="small" color={RATING_COLORS[fb.rating]} />
                                    </Box>
                                  </TableCell>
                                  <TableCell sx={{ maxWidth: 260 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>"{fb.comment}"</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" color="text.secondary">{new Date(fb.submittedAt).toLocaleTimeString()}</Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
