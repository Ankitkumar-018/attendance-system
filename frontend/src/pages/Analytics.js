import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, CircularProgress, Chip, Avatar } from '@mui/material';
import { EmojiEvents, Warning } from '@mui/icons-material';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../services/api';

const COLORS = ['#1e40af', '#7c3aed', '#059669', '#dc2626', '#d97706', '#0891b2'];

export default function Analytics() {
  const [trend, setTrend] = useState([]);
  const [courseWise, setCourseWise] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [lowStudents, setLowStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/trend'),
      api.get('/analytics/course-wise'),
      api.get('/analytics/top-students?limit=10'),
      api.get('/analytics/low-attendance?threshold=75')
    ]).then(([t, c, top, low]) => {
      setTrend(t.data.data);
      setCourseWise(c.data.data);
      setTopStudents(top.data.data);
      setLowStudents(low.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;

  const pieData = courseWise.map(c => ({ name: c.course.split(' ').slice(0, 2).join(' '), value: c.attended }));

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Analytics</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Attendance insights and trends</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Attendance Trend (Last 30 Days)</Typography>
              {trend.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data yet. Create lectures to see trends.</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v, n) => [n === 'percentage' ? `${v}%` : v, n]} />
                    <Line type="monotone" dataKey="present" stroke="#1e40af" strokeWidth={2} dot={{ r: 4 }} name="Present" />
                    <Line type="monotone" dataKey="percentage" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} name="Percentage" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Course-wise Attendance</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={courseWise} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="course" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="attended" name="Attended" fill="#1e40af" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#fca5a5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Course Distribution</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <EmojiEvents sx={{ color: '#d97706' }} />
                <Typography variant="h6" fontWeight={600}>Top Students (Leaderboard)</Typography>
              </Box>
              {topStudents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>No attendance data yet</Typography>
              ) : (
                topStudents.map((s, i) => (
                  <Box key={s._id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: i < topStudents.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <Avatar sx={{ bgcolor: i < 3 ? '#d97706' : '#e5e7eb', color: i < 3 ? 'white' : '#374151', width: 32, height: 32, fontSize: 14, fontWeight: 700 }}>
                      {i + 1}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>{s.course}</Typography>
                    </Box>
                    <Chip label={`${s.percentage}%`} size="small" color={s.percentage >= 75 ? 'success' : 'warning'} />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Warning sx={{ color: '#dc2626' }} />
                <Typography variant="h6" fontWeight={600}>Low Attendance (&lt;75%)</Typography>
              </Box>
              {lowStudents.length === 0 ? (
                <Typography variant="body2" color="success.main" textAlign="center" sx={{ py: 3 }}>All students have good attendance!</Typography>
              ) : (
                lowStudents.slice(0, 10).map((s, i) => (
                  <Box key={s.studentCode} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: i < Math.min(lowStudents.length, 10) - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <Avatar sx={{ bgcolor: '#fee2e2', color: '#dc2626', width: 32, height: 32, fontSize: 11 }}>
                      <Warning fontSize="small" />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>{s.attended}/{s.totalLectures} lectures · {s.course}</Typography>
                    </Box>
                    <Chip label={`${s.percentage}%`} size="small" color="error" />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
