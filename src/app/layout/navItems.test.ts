import { describe, expect, it } from 'vitest';
import { getNavItems } from './navItems';

describe('getNavItems (menú según rol)', () => {
  it('para la supervisora, Inicio apunta a /inicio', () => {
    const items = getNavItems('SUPERVISOR');
    expect(items[0]).toMatchObject({ label: 'Inicio', to: '/inicio' });
  });

  it('para el jefe, Inicio apunta a /jefatura', () => {
    const items = getNavItems('SUPERVISION_MANAGER');
    expect(items[0]).toMatchObject({ label: 'Inicio', to: '/jefatura' });
  });

  it('ambos roles comparten Agenda, Asociaciones y Metas (Asesores retirado del menú)', () => {
    for (const role of ['SUPERVISOR', 'SUPERVISION_MANAGER'] as const) {
      const labels = getNavItems(role).map((item) => item.label);
      expect(labels).toEqual(['Inicio', 'Agenda', 'Asociaciones', 'Metas']);
      expect(labels).not.toContain('Asesores');
    }
  });
});
