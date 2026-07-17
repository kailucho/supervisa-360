import { Outlet, useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { DRAWER_WIDTH, getNavItems } from './navItems';
import { useAuth } from '@/features/auth/useAuth';

const BOTTOM_NAV_HEIGHT = 64;

export function AppLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const navItems = getNavItems(profile?.role ?? 'SUPERVISOR');
  const currentPage =
    navItems.find((item) => item.to === location.pathname) ??
    navItems.find((item) => item.to !== '/' && location.pathname.startsWith(`${item.to}/`));
  const initials = profile?.full_name
    ?.split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const drawerContent = (
    <Box
      role="presentation"
      sx={{ width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <Diversity3RoundedIcon color="primary" />
        <Typography variant="h6" noWrap color="primary.dark">
          Supervisa 360
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, px: 1.5, py: 2 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <ListItem key={item.to} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={item.to}
                selected={item.to === currentPage?.to}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <List sx={{ px: 1.5, py: 1.5 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={handleSignOut}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LogoutRoundedIcon />
            </ListItemIcon>
            <ListItemText
              primary="Cerrar sesión"
              slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }}
            />
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
          {!isDesktop && <Diversity3RoundedIcon color="primary" />}
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {currentPage?.label ?? 'Supervisa 360'}
          </Typography>
          {profile ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {profile.full_name}
            </Typography>
          ) : null}
          {isDesktop ? (
            <Button color="inherit" startIcon={<LogoutRoundedIcon />} onClick={handleSignOut}>
              Cerrar sesión
            </Button>
          ) : (
            <Tooltip title="Cerrar sesión">
              <IconButton aria-label="Cerrar sesión" onClick={handleSignOut}>
                {initials ? (
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>{initials}</Avatar>
                ) : (
                  <LogoutRoundedIcon />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
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
          pb: { xs: `${BOTTOM_NAV_HEIGHT + 24}px`, md: 3 },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      {!isDesktop && (
        <BottomNavigation
          component="nav"
          aria-label="Navegación principal"
          value={currentPage?.to ?? false}
          onChange={(_, to: string) => navigate(to)}
          showLabels
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: BOTTOM_NAV_HEIGHT,
            borderTop: '1px solid',
            borderColor: 'divider',
            zIndex: (t) => t.zIndex.appBar,
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <BottomNavigationAction
                key={item.to}
                label={item.label}
                value={item.to}
                icon={<Icon />}
                sx={{ minWidth: 0 }}
              />
            );
          })}
        </BottomNavigation>
      )}
    </Box>
  );
}
