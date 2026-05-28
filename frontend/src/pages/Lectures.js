import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip, TextField,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress, TablePagination, Switch
} from '@mui/material';
import { Add, QrCode2, Download, Delete, Visibility, LockOpen, Lock } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Lectures() {
  const navigate = useNavigate();
  const [lectures, setLectures] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(0);
  const [qrDialog, setQrDialog] = useState(null);

  const fetchLectures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/lectures', { params: { course, date, page: page + 1 } });
      setLectures(res.data.lectures);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }, [course, date, page]);

  useEffect(() => {
    api.get('/students/courses').then(r => setCourses(r.data.courses));
  }, []);

  useEffect(() => { fetchLectures(); }, [fetchLectures]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this lecture?')) return;
    await api.delete(`/lectures/${id}`);
    fetchLectures();
  };

  const handleToggleForceOpen = async (lecture) => {
    await api.post(`/lectures/${lecture._id}/toggle-force-open`);
    setLectures(prev => prev.map(l => l._id === lecture._id ? { ...l, forceOpen: !l.forceOpen } : l));
    if (qrDialog?._id === lecture._id) setQrDialog(prev => ({ ...prev, forceOpen: !prev.forceOpen }));
  };

  const downloadQR = (lecture) => {
    const link = document.createElement('a');
    link.href = lecture.qrCode;
    link.download = `${lecture.lectureId}_QR.png`;
    link.click();
  };

  const getWindowStatus = (lecture) => {
    if (lecture.forceOpen) return { label: 'Force Open', color: 'warning' };
    const now = new Date();
    const d = new Date(lecture.date);
    const [sh, sm] = lecture.startTime.split(':').map(Number);
    const start = new Date(d); start.setHours(sh, sm, 0, 0);
    const end = new Date(start.getTime() + lecture.attendanceWindowMinutes * 60000);
    if (now < start) return { label: 'Upcoming', color: 'info' };
    if (now <= end) return { label: 'Live', color: 'success' };
    return { label: 'Closed', color: 'default' };
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Lectures</Typography>
          <Typography variant="body2" color="text.secondary">{total} lectures total</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/lectures/create')}>
          Create Lecture
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Course</InputLabel>
              <Select value={course} label="Filter by Course" onChange={e => { setCourse(e.target.value); setPage(0); }}>
                <MenuItem value="">All Courses</MenuItem>
                {courses.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" type="date" label="Filter by Date" value={date} InputLabelProps={{ shrink: true }} onChange={e => { setDate(e.target.value); setPage(0); }} />
            <Button variant="text" onClick={() => { setCourse(''); setDate(''); }}>Clear</Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Lecture ID</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Course</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Faculty</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Date & Time</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Force Open</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lectures.map(l => {
                const status = getWindowStatus(l);
                return (
                  <TableRow key={l._id} hover>
                    <TableCell><Typography variant="caption" fontFamily="monospace" color="primary">{l.lectureId}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={500}>{l.lectureName}</Typography></TableCell>
                    <TableCell><Chip label={l.course} size="small" variant="outlined" sx={{ maxWidth: 180 }} /></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{l.facultyName}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2">{new Date(l.date).toLocaleDateString()}</Typography>
                      <Typography variant="caption" color="text.secondary">{l.startTime} – {l.endTime}</Typography>
                    </TableCell>
                    <TableCell><Chip label={status.label} size="small" color={status.color} /></TableCell>
                    <TableCell>
                      <Tooltip title={l.forceOpen ? 'Click to close attendance' : 'Click to force-open attendance'}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Switch
                            size="small"
                            checked={!!l.forceOpen}
                            onChange={() => handleToggleForceOpen(l)}
                            color="warning"
                          />
                          {l.forceOpen
                            ? <LockOpen fontSize="small" sx={{ color: 'warning.main' }} />
                            : <Lock fontSize="small" sx={{ color: 'text.disabled' }} />}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View QR Code">
                          <IconButton size="small" color="primary" onClick={() => setQrDialog(l)}><QrCode2 fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="View Attendance">
                          <IconButton size="small" onClick={() => navigate(`/attendance?lectureId=${l.lectureId}`)}><Visibility fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(l._id)}><Delete fontSize="small" /></IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && lectures.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>No lectures found. Create your first lecture!</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} rowsPerPage={20} rowsPerPageOptions={[20]} onPageChange={(_, p) => setPage(p)} />
      </Card>

      <Dialog open={!!qrDialog} onClose={() => setQrDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>QR Code — {qrDialog?.lectureId}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>{qrDialog?.lectureName}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Window: {qrDialog?.attendanceWindowMinutes} mins from {qrDialog?.startTime}
          </Typography>
          {qrDialog?.forceOpen && (
            <Chip label="Force Open — students can mark now" color="warning" size="small" sx={{ mb: 2 }} />
          )}
          {qrDialog?.qrCode && <img src={qrDialog.qrCode} alt="QR" style={{ width: 250, height: 250 }} />}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            variant={qrDialog?.forceOpen ? 'contained' : 'outlined'}
            color="warning"
            startIcon={qrDialog?.forceOpen ? <LockOpen /> : <Lock />}
            onClick={() => handleToggleForceOpen(qrDialog)}
            size="small"
          >
            {qrDialog?.forceOpen ? 'Close Attendance' : 'Force Open'}
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setQrDialog(null)}>Close</Button>
            <Button variant="contained" startIcon={<Download />} onClick={() => downloadQR(qrDialog)}>Download</Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
