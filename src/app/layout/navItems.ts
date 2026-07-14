export interface NavItem {
  label: string;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', to: '/' },
  { label: 'Agenda', to: '/agenda' },
  { label: 'Asociaciones', to: '/asociaciones' },
  { label: 'Asesores', to: '/asesores' },
  { label: 'Metas', to: '/metas' },
];

export const DRAWER_WIDTH = 240;
