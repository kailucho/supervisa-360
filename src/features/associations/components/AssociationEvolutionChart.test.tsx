import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssociationEvolutionChart } from './AssociationEvolutionChart';
import type { VisitWithRelations } from '@/services/supabase/visits';

function realizedVisit(id: string, performedDate: string, score: number): VisitWithRelations {
  return {
    id,
    association_id: 'assoc-1',
    supervisor_id: 'sup-1',
    scheduled_advisor_id: 'adv-1',
    visit_type: 'ORDINARIA',
    modality: 'PRESENCIAL',
    characteristic: 'ANUNCIADA',
    scheduled_date: performedDate,
    scheduled_time: null,
    status: 'REALIZADA',
    performed_date: performedDate,
    start_time: null,
    end_time: null,
    score,
    general_comment: 'Comentario',
    performed_by: 'sup-1',
    result_updated_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    association: null,
    supervisor: null,
    scheduled_advisor: null,
  } as unknown as VisitWithRelations;
}

describe('AssociationEvolutionChart (estados vacíos y resumen)', () => {
  it('con cero visitas muestra "Esta asociación todavía no ha sido visitada."', () => {
    render(<AssociationEvolutionChart history={[]} />);
    expect(screen.getByText('Esta asociación todavía no ha sido visitada.')).toBeInTheDocument();
  });

  it('ignora visitas no realizadas para el gráfico', () => {
    const scheduled = {
      ...realizedVisit('v-1', '2026-07-01', 4),
      status: 'PROGRAMADA',
      performed_date: null,
      score: null,
    } as unknown as VisitWithRelations;
    render(<AssociationEvolutionChart history={[scheduled]} />);
    expect(screen.getByText('Esta asociación todavía no ha sido visitada.')).toBeInTheDocument();
  });

  it('con una sola visita muestra el punto y "Sin tendencia todavía"', () => {
    render(<AssociationEvolutionChart history={[realizedVisit('v-1', '2026-07-01', 4)]} />);
    expect(screen.getByText('Sin tendencia todavía')).toBeInTheDocument();
  });

  it('el resumen compara solo las dos últimas visitas', () => {
    render(
      <AssociationEvolutionChart
        history={[
          realizedVisit('v-1', '2026-02-01', 5),
          realizedVisit('v-2', '2026-05-01', 2),
          realizedVisit('v-3', '2026-07-01', 4),
        ]}
      />,
    );
    // Última 4 vs. anterior 2 → mejoró 2 (el 5 antiguo no cuenta).
    expect(screen.getByText('Mejoró 2 puntos respecto a la visita anterior')).toBeInTheDocument();
  });

  it('informa cuando la puntuación se mantuvo', () => {
    render(
      <AssociationEvolutionChart
        history={[realizedVisit('v-1', '2026-05-01', 3), realizedVisit('v-2', '2026-07-01', 3)]}
      />,
    );
    expect(screen.getByText('Se mantuvo respecto a la visita anterior')).toBeInTheDocument();
  });
});
