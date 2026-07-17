import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('./client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { addAdvisorToMonthlyPlan, saveMonthlyPlan } from './monthlyPlans';

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: 'plan-1', error: null });
});

describe('saveMonthlyPlan (RPC transaccional)', () => {
  it('guarda una planificación vacía (cero asesores es válido)', async () => {
    const planId = await saveMonthlyPlan('region-1', 2026, 7, []);
    expect(planId).toBe('plan-1');
    expect(rpcMock).toHaveBeenCalledWith('save_monthly_plan', {
      p_region_id: 'region-1',
      p_year: 2026,
      p_month: 7,
      p_advisor_ids: [],
    });
  });

  it('envía la selección completa para cualquier periodo (pasado o futuro)', async () => {
    await saveMonthlyPlan('region-1', 2025, 12, ['a1', 'a2']);
    expect(rpcMock).toHaveBeenCalledWith('save_monthly_plan', {
      p_region_id: 'region-1',
      p_year: 2025,
      p_month: 12,
      p_advisor_ids: ['a1', 'a2'],
    });
    await saveMonthlyPlan('region-1', 2027, 1, ['a1']);
    expect(rpcMock).toHaveBeenLastCalledWith(
      'save_monthly_plan',
      expect.objectContaining({ p_year: 2027, p_month: 1 }),
    );
  });

  it('propaga el error de exclusividad de la base de datos', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'ADVISOR_TAKEN: El asesor ya está asignado…' },
    });
    await expect(saveMonthlyPlan('region-1', 2026, 7, ['a1'])).rejects.toMatchObject({
      code: 'P0001',
    });
  });
});

describe('addAdvisorToMonthlyPlan (incorporación al programar fuera del plan)', () => {
  it('invoca la RPC con el asesor puntual', async () => {
    await addAdvisorToMonthlyPlan('region-1', 2026, 7, 'a9');
    expect(rpcMock).toHaveBeenCalledWith('add_advisor_to_monthly_plan', {
      p_region_id: 'region-1',
      p_year: 2026,
      p_month: 7,
      p_advisor_id: 'a9',
    });
  });
});
