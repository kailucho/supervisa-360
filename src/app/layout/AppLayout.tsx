import { useState } from 'react';
import { Outlet, useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { DRAWER_WIDTH, NAV_ITEMS } from './navItems';
import { useAuth } from '@/features/auth/useAuth';

export function AppLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const currentPage = NAV_ITEMS.find((item) => item.to === location.pathname);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const drawerContent = (
    <Box
      role="presentation"
      sx={{ width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap>
          Supervisa 360
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={item.to}
              selected={location.pathname === item.to}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleSignOut}>
            <ListItemText primary="Cerrar sesión" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {!isDesktop && (
            <IconButton
              color="inherit"
              aria-label="Abrir menú de navegación"
              edge="start"
              onClick={() => setMobileOpen(true)}
            >
              <Typography component="span" aria-hidden sx={{ fontSize: '1.5rem', lineHeight: 1 }}>
                ☰
              </Typography>
            </IconButton>
          )}
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {currentPage?.label ?? 'Supervisa 360'}
          </Typography>
          {profile ? (
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {profile.full_name}
            </Typography>
          ) : null}
          {isDesktop ? (
            <Button color="inherit" onClick={handleSignOut}>
              Cerrar sesión
            </Button>
          ) : null}
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          px: { xs: 2, sm: 3 },
          py: 3,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
