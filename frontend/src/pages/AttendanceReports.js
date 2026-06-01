import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Button, Grid, CircularProgress, Alert, Divider, Tabs, Tab, Tooltip, IconButton
} from '@mui/material';
import { Download, PictureAsPdf, HowToReg } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function AttendanceReports() {
  const [searchParams] = useSearchParams();
  const [lectures, setLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(searchParams.get('lectureId') || '');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [markingId, setMarkingId] = useState(null);

  useEffect(() => {
    api.get('/students/courses').then(r => setCourses(r.data.courses));
    api.get('/lectures', { params: { limit: 200 } }).then(r => setLectures(r.data.lectures));
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedLecture) return;
    setLoading(true);
    try {
      const res = await api.get(`/attendance/lecture/${selectedLecture}`);
      setReportData(res.data);
    } finally {
      setLoading(false);
    }
  }, [selectedLecture]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

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
    } catch (err) {
      alert('Download failed. Please try again.');
    }
  };

  const handleCSVExport = () => handleDownload(
    `${BASE_URL}/attendance/export/lecture/${selectedLecture}/csv`,
    `${selectedLecture}_attendance.tsv`
  );
  const handlePDFExport = () => handleDownload(
    `${BASE_URL}/attendance/export/lecture/${selectedLecture}/pdf`,
    `${selectedLecture}_attendance.pdf`
  );

  const handleMarkPresent = async (student) => {
    if (!window.confirm(`Mark ${student.name} as Present?`)) return;
    setMarkingId(student._id);
    try {
      await api.post('/attendance/mark-manual', {
        lectureId: selectedLecture,
        studentCode: student.studentCode
      });
      // Move student from absent to present list locally
      setReportData(prev => ({
        ...prev,
        present: [...prev.present, {
          _id: student._id,
          studentCode: student.studentCode,
          studentName: student.name,
          email: student.email,
          course: student.course,
          attendanceTime: new Date(),
          browserInfo: 'Manual — marked by admin'
        }],
        absentStudents: prev.absentStudents.filter(s => s._id !== student._id),
        stats: {
          ...prev.stats,
          present: prev.stats.present + 1,
          absent: prev.stats.absent - 1,
          percentage: (((prev.stats.present + 1) / prev.stats.total) * 100).toFixed(1)
        }
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark present');
    } finally {
      setMarkingId(null);
    }
  };

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

      {!selectedLecture && (
        <Alert severity="info">Select a lecture to view attendance report.</Alert>
      )}

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
                  <Typography variant="caption" color="text.secondary">{reportData.lecture?.course} · {reportData.lecture?.facultyName} · {new Date(reportData.lecture?.date).toLocaleDateString()}</Typography>
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
              </Tabs>
              <Divider />
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Student Code</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Status</TableCell>
                      {tab === 0 && <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Time</TableCell>}
                      {tab === 1 && <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Action</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tab === 0 && reportData.present.map((a, i) => (
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
                    {tab === 1 && reportData.absentStudents.map((s, i) => (
                      <TableRow key={s._id} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell><Typography variant="caption" fontFamily="monospace">{s.studentCode}</Typography></TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{s.email}</Typography></TableCell>
                        <TableCell><Chip label="Absent" size="small" color="error" /></TableCell>
                        <TableCell>
                          <Tooltip title="Mark as Present">
                            <IconButton
                              size="small"
                              color="success"
                              disabled={markingId === s._id}
                              onClick={() => handleMarkPresent(s)}
                            >
                              <HowToReg fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {((tab === 0 && reportData.present.length === 0) || (tab === 1 && reportData.absentStudents.length === 0)) && (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No records</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
