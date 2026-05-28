import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, CircularProgress, Chip } from '@mui/material';
import { People, MenuBook, CheckCircle, TrendingUp, Today, School } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../services/api';

const StatCard = ({ icon, label, value, color, sub }) => (
  <Card>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
          <Typography variant="h4" fontWeight={700}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </Box>
        <Box sx={{ bgcolor: `${color}15`, borderRadius: 3, p: 1.5, color }}>{icon}</Box>
      </Box>
    </CardContent>
  </Card>
);

const COLORS = ['#1e40af', '#7c3aed', '#059669', '#dc2626', '#d97706', '#0891b2'];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/attendance/summary').then(res => setSummary(res.data.summary)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
  if (!summary) return null;

  const pieData = [
    { name: 'Present', value: Number(summary.totalAttendance) },
    { name: 'Absent', value: Math.max(0, summary.totalStudents * summary.totalLectures - summary.totalAttendance) }
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Welcome back! Here's today's overview.</Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={<People />} label="Total Students" value={summary.totalStudents} color="#1e40af" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={<School />} label="Total Courses" value={summary.courseSummary?.length || 0} color="#7c3aed" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={<MenuBook />} label="Total Lectures" value={summary.totalLectures} color="#059669" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={<TrendingUp />} label="Overall Attendance" value={`${summary.overallPercentage}%`} color="#d97706" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={<Today />} label="Today's Lectures" value={summary.todayLectures} color="#0891b2" sub={`${summary.todayAttendance} students attended`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={<CheckCircle />} label="Today's Attendance" value={summary.todayAttendance} color="#059669" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Course-wise Attendance</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary.courseSummary} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="course" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(val, name) => [name === 'percentage' ? `${val}%` : val, name]} />
                  <Bar dataKey="attended" name="Present" fill="#1e40af" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="students" name="Total" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Present vs Absent</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#059669' : '#ef4444'} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Course Summary</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Course', 'Students', 'Lectures', 'Attended', 'Attendance %'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.courseSummary?.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px' }}>{row.course}</td>
                        <td style={{ padding: '12px 16px' }}>{row.students}</td>
                        <td style={{ padding: '12px 16px' }}>{row.lectures}</td>
                        <td style={{ padding: '12px 16px' }}>{row.attended}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <Chip label={`${row.percentage}%`} size="small"
                            color={row.percentage >= 75 ? 'success' : row.percentage >= 50 ? 'warning' : 'error'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
