import type { SvgIconComponent } from '@mui/icons-material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

export interface NavItem {
  label: string;
  to: string;
  icon: SvgIconComponent;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', to: '/', icon: HomeRoundedIcon },
  { label: 'Agenda', to: '/agenda', icon: CalendarMonthRoundedIcon },
  { label: 'Asociaciones', to: '/asociaciones', icon: GroupsRoundedIcon },
  { label: 'Asesores', to: '/asesores', icon: PersonRoundedIcon },
  { label: 'Metas', to: '/metas', icon: InsightsRoundedIcon },
];

export const DRAWER_WIDTH = 248;
