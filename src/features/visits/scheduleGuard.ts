import { isSupervisable } from '@/shared/types/domain';
import type { AssociationStatus, VisitRow, VisitType } from '@/shared/types/domain';

export type ScheduleGuardResult =
  | { status: 'BLOCKED_NOT_SUPERVISABLE' }
  | { status: 'BLOCKED_ACTIVE_VISIT_EXISTS'; activeVisit: VisitRow }
  | { status: 'BLOCKED_ORDINARIA_ALREADY_DONE_THIS_YEAR' }
  | { status: 'WARN_ALREADY_VISITED_THIS_YEAR' }
  | { status: 'OK' };

/**
 * Decide si se puede programar una visita nueva, sin tocar la red: recibe los
 * datos ya consultados y devuelve una decisión. RN-01/RN-02 (supervisable),
 * RN-12/RN-13 (visita activa única), RN-10/RN-11/RN-14 (repetición anual).
 */
export function evaluateScheduleGuard(input: {
  associationStatus: AssociationStatus;
  activeVisit: VisitRow | null;
  realizedVisitsThisYear: Pick<VisitRow, 'visit_type'>[];
  visitType: VisitType;
}): ScheduleGuardResult {
  if (!isSupervisable(input.associationStatus)) {
    return { status: 'BLOCKED_NOT_SUPERVISABLE' };
  }

  if (input.activeVisit) {
    return { status: 'BLOCKED_ACTIVE_VISIT_EXISTS', activeVisit: input.activeVisit };
  }

  const alreadyVisitedThisYear = input.realizedVisitsThisYear.length > 0;

  if (alreadyVisitedThisYear) {
    if (input.visitType === 'ORDINARIA') {
      const ordinariaAlreadyDone = input.realizedVisitsThisYear.some(
        (v) => v.visit_type === 'ORDINARIA',
      );
      if (ordinariaAlreadyDone) {
        return { status: 'BLOCKED_ORDINARIA_ALREADY_DONE_THIS_YEAR' };
      }
    }
    return { status: 'WARN_ALREADY_VISITED_THIS_YEAR' };
  }

  return { status: 'OK' };
}
