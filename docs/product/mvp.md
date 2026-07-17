# MVP — Supervisa 360

## Problema

Dos supervisoras de ADRA en Arequipa y Tacna coordinan hoy, cada una por su cuenta,
las visitas de supervisión a ~330 asociaciones (250 en Arequipa, 80 en Tacna). Al no
existir una agenda compartida, ambas pueden programar la misma asociación sin saberlo,
lo que provoca visitas duplicadas innecesarias o reprogramaciones de último momento.
Tampoco existe hoy un lugar único donde consultar el historial de puntuaciones y
comentarios de cada asociación a lo largo del tiempo, ni un control simple del avance
de metas mensuales individuales y conjuntas.

## Objetivo

Dar a las dos supervisoras una herramienta compartida para:

- coordinar la planificación de visitas y evitar duplicidades;
- registrar si una visita fue realizada y cómo se encontró la asociación;
- conservar el historial de puntuaciones y comentarios por asociación;
- controlar el avance de la meta mensual individual y de la meta conjunta.

Esta aplicación **no reemplaza** la herramienta oficial de ADRA donde se registran
las puntuaciones detalladas por aspecto; aquí solo se registra una puntuación y un
comentario general por visita.

## Usuarios

- 2 supervisoras (rol `SUPERVISOR`), con permisos idénticos entre sí.
- 1 Jefe de Supervisión (rol `SUPERVISION_MANAGER`), incorporado después del MVP
  inicial: acceso global de **solo consulta** más la definición de la meta conjunta
  mensual por sede (RN-28..RN-31).
- Sin registro público. Las cuentas se crean manualmente en Supabase Auth.
- Fuera de este MVP: acceso de asesores.

## Alcance

Incluye:

- catálogo de asociaciones y asesores, importado desde CSV, con edición parcial
  desde la app limitada a **estado de la asociación** y **asesor asignado**
  (ver [business-rules.md](business-rules.md));
- agenda compartida de visitas (lista ordenada por fecha, con filtros);
- programación, reprogramación y cancelación de visitas;
- validación de duplicidad de visitas activas por asociación;
- registro de resultado de visita (fecha real, horas opcionales, puntuación 0-5,
  comentario general);
- historial de visitas por asociación;
- metas mensuales individuales **por sede** y meta conjunta por sede, con panel de
  avance;
- rol de jefatura: panel por sede, detalle de sede y definición de la meta conjunta
  (todo lo demás, solo consulta);
- auditoría de cambios a nivel de base de datos (sin pantalla en la app).

No incluye (detalle en [out-of-scope.md](out-of-scope.md)): acceso de asesores,
evaluación por aspectos, fotos/archivos, notificaciones, exportaciones, gráficos de
evolución, integración con la herramienta oficial de ADRA, creación o eliminación de
asociaciones/asesores desde la app, pantalla de auditoría, entre otros.

## Funcionalidades

1. Autenticación (2 cuentas fijas, Supabase Auth).
2. Consulta de asociaciones y asesores.
3. Edición de estado de asociación y reasignación de asesor actual.
4. Agenda compartida con filtros (mes, supervisora, estado, región).
5. Programar / reprogramar / cancelar visitas.
6. Bloqueo de doble programación (visita activa duplicada).
7. Registro de resultado de visita (REALIZADA / NO_REALIZADA).
8. Historial de visitas por asociación.
9. Panel de metas individuales y conjunta.

## Criterios generales de éxito

- Ninguna asociación puede tener dos visitas activas simultáneas: la app lo impide
  siempre, mostrando quién la programó y para cuándo.
- Ambas supervisoras pueden ver, en todo momento, la agenda completa (propia y de la
  otra) sin necesidad de comunicarse fuera de la app para coordinar.
- Toda visita marcada como REALIZADA cuenta correctamente en la meta individual de
  quien la hizo y en la meta conjunta del mes.
- El historial de una asociación permite a la supervisora revisar puntuaciones y
  comentarios de visitas anteriores para formarse un criterio sobre su evolución
  (sin cálculo automático de tendencia).
- La información base de asociaciones/asesores puede cargarse por CSV sin necesidad
  de una pantalla de importación.

## Elementos fuera del MVP

Ver [out-of-scope.md](out-of-scope.md) para el detalle completo y su justificación.
