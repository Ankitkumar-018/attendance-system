import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, IconButton, Avatar,
  Divider, Tooltip, useTheme, useMediaQuery
} from '@mui/material';
import {
  Dashboard, People, MenuBook, BarChart, Assessment,
  QrCode2, Menu, Logout, School
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { label: 'Students', icon: <People />, path: '/students' },
  { label: 'Lectures', icon: <MenuBook />, path: '/lectures' },
  { label: 'Attendance', icon: <Assessment />, path: '/attendance' },
  { label: 'Analytics', icon: <BarChart />, path: '/analytics' },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f172a' }}>
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <QrCode2 sx={{ color: '#60a5fa', fontSize: 32 }} />
        <Box>
          <Typography variant="subtitle1" sx={{ color: '#f1f5f9', fontWeight: 700, lineHeight: 1.2 }}>
            QR Attendance
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>Management System</Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: '#1e293b' }} />
      <List sx={{ flex: 1, px: 1, pt: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                sx={{
                  borderRadius: 2,
                  color: active ? '#f1f5f9' : '#94a3b8',
                  bgcolor: active ? '#1e40af' : 'transparent',
                  '&:hover': { bgcolor: active ? '#1e40af' : '#1e293b', color: '#f1f5f9' }
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ borderColor: '#1e293b' }} />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: '#1e40af', width: 36, height: 36, fontSize: 14 }}>
          {admin?.name?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <Typography variant="body2" sx={{ color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {admin?.name}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>Admin</Typography>
        </Box>
        <Tooltip title="Logout">
          <IconButton size="small" onClick={logout} sx={{ color: '#64748b', '&:hover': { color: '#ef4444' } }}>
            <Logout fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isMobile && (
        <AppBar position="fixed" sx={{ bgcolor: '#0f172a', zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2 }}>
              <Menu />
            </IconButton>
            <School sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight={700}>QR Attendance</Typography>
          </Toolbar>
        </AppBar>
      )}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' } }}
      >
        {drawer}
      </Drawer>
      <Box component="main" sx={{ flex: 1, p: 3, bgcolor: '#f8fafc', minHeight: '100vh', mt: isMobile ? 7 : 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
