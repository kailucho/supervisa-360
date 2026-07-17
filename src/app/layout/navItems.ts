import type { SvgIconComponent } from '@mui/icons-material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import type { AppRole } from '@/shared/types/domain';
import { homePathForRole } from '@/shared/utils/permissions';

export interface NavItem {
  label: string;
  to: string;
  icon: SvgIconComponent;
}

// "Asesores" se retiró del menú a propósito: la pantalla se conserva en el
// código (AdvisorsListPage) pero /asesores redirige a /inicio.
const SHARED_ITEMS: NavItem[] = [
  { label: 'Agenda', to: '/agenda', icon: CalendarMonthRoundedIcon },
  { label: 'Asociaciones', to: '/asociaciones', icon: GroupsRoundedIcon },
  { label: 'Metas', to: '/metas', icon: InsightsRoundedIcon },
];

/** El menú depende del rol: Inicio apunta al dashboard que corresponde. */
export function getNavItems(role: AppRole): NavItem[] {
  return [{ label: 'Inicio', to: homePathForRole(role), icon: HomeRoundedIcon }, ...SHARED_ITEMS];
}

export const DRAWER_WIDTH = 248;
