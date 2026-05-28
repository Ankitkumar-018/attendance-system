import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Select, MenuItem,
  FormControl, InputLabel, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, LinearProgress
} from '@mui/material';
import { Search, FileUpload, Download, Delete, Add, Refresh } from '@mui/icons-material';
import api from '../services/api';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(50);
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/students', { params: { search, course, page: page + 1, limit: rowsPerPage } });
      setStudents(res.data.students);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }, [search, course, page, rowsPerPage]);

  useEffect(() => {
    api.get('/students/courses').then(res => setCourses(res.data.courses));
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchStudents, 300);
    return () => clearTimeout(t);
  }, [fetchStudents]);

  const handleImportFile = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportMsg('');
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post('/students/import-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportMsg(res.data.message);
      fetchStudents();
      api.get('/students/courses').then(r => setCourses(r.data.courses));
    } catch (e) {
      setImportMsg(e.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleImportJSON = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportMsg('');
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      const students = Array.isArray(data) ? data : data.students || [];
      const res = await api.post('/students/import-json', { students });
      setImportMsg(res.data.message);
      fetchStudents();
      api.get('/students/courses').then(r => setCourses(r.data.courses));
    } catch (e) {
      setImportMsg(e.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student?')) return;
    await api.delete(`/students/${id}`);
    fetchStudents();
  };

  const handleExport = () => {
    window.open(`/api/students/export${course ? `?course=${encodeURIComponent(course)}` : ''}`, '_blank');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Students</Typography>
          <Typography variant="body2" color="text.secondary">{total} students registered</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<FileUpload />} onClick={() => setImportDialog(true)}>Import</Button>
          <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>Export</Button>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search by name, email, code..." size="small"
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.disabled' }} fontSize="small" /> }}
              sx={{ flex: 1, minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Course</InputLabel>
              <Select value={course} label="Filter by Course" onChange={e => { setCourse(e.target.value); setPage(0); }}>
                <MenuItem value="">All Courses</MenuItem>
                {courses.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <IconButton onClick={fetchStudents} title="Refresh"><Refresh /></IconButton>
          </Box>
        </CardContent>
      </Card>

      <Card>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Student Code</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Course</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map(s => (
                <TableRow key={s._id} hover>
                  <TableCell><Typography variant="body2" fontFamily="monospace" fontSize={12}>{s.studentCode}</Typography></TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{s.email}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{s.phoneNumber}</Typography></TableCell>
                  <TableCell><Chip label={s.course} size="small" variant="outlined" sx={{ maxWidth: 200, overflow: 'hidden' }} /></TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(s._id)}><Delete fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && students.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>No students found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[50]} onPageChange={(_, p) => setPage(p)}
        />
      </Card>

      <Dialog open={importDialog} onClose={() => { setImportDialog(false); setImportMsg(''); setImportFile(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Import Students</DialogTitle>
        <DialogContent>
          {importMsg && <Alert severity="success" sx={{ mb: 2 }}>{importMsg}</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a JSON, CSV, or Excel file. For JSON, use the format: array of student objects.
          </Typography>
          <Button variant="outlined" component="label" fullWidth startIcon={<FileUpload />}>
            Choose File
            <input type="file" hidden accept=".json,.csv,.xlsx,.xls" onChange={e => setImportFile(e.target.files[0])} />
          </Button>
          {importFile && <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>{importFile.name}</Typography>}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setImportDialog(false)}>Cancel</Button>
          <Button variant="outlined" onClick={handleImportJSON} disabled={!importFile || importing || !importFile?.name.endsWith('.json')}>
            Import JSON
          </Button>
          <Button variant="contained" onClick={handleImportFile} disabled={!importFile || importing || importFile?.name.endsWith('.json')}>
            {importing ? 'Importing...' : 'Import CSV/Excel'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
