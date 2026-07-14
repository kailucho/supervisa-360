# Flujos de usuario — Supervisa 360

Actor único en todos los flujos: **Supervisora** (Arequipa o Tacna, permisos
idénticos). Las referencias `RN-XX` remiten a [business-rules.md](business-rules.md).

## 1. Iniciar sesión

**Precondición:** la cuenta de la supervisora ya existe en Supabase Auth (creada
manualmente; no hay registro público).

1. La supervisora abre la aplicación y ve el formulario de inicio de sesión
   (correo + contraseña).
2. Ingresa sus credenciales y envía el formulario.
3. Si son válidas, se redirige al panel inicial.
4. Si no son válidas, se muestra un mensaje de error genérico (sin indicar si el
   correo existe o no, por seguridad).

**Fuera de alcance:** recuperación de contraseña por la propia app (se asume que se
gestiona desde Supabase Auth o soporte manual), registro público, roles adicionales.

## 2. Buscar asociación

1. La supervisora entra a la sección de asociaciones.
2. Puede buscar por código de banca o nombre, y filtrar por región y estado.
3. Ve el listado con: código, nombre, región, estado, asesor actual.
4. Al abrir una asociación, ve su detalle y su historial de visitas (flujo 8).

## 3. Programar visita

**Precondición:** la asociación está en un estado supervisable (`NUEVA`, `NORMAL`,
`MORA`, `DESERCION` — RN-01).

1. Desde el detalle de la asociación o desde la agenda, la supervisora inicia
   "Programar visita".
2. Si la asociación no es supervisable (RN-02), la acción no está disponible y se
   explica el motivo (estado actual de la asociación).
3. La supervisora completa: fecha, hora (opcional), tipo de visita, modalidad,
   característica.
4. El sistema valida duplicidad de visita activa (flujo 4) antes de guardar.
5. Si la asociación ya tuvo una visita `REALIZADA` en el año y el tipo elegido no es
   `SEGUIMIENTO`/`MORA`/`DESERCION`/`CIERRE` (es decir, es `ORDINARIA`), se bloquea
   la programación (RN-11, RN-14).
6. Si todo es válido, se crea la visita en estado `PROGRAMADA`, con el asesor
   responsable de la asociación en ese momento (RN-17), y aparece en la agenda
   compartida.

## 4. Detectar duplicidad (regla crítica)

1. Al intentar programar una visita para una asociación que ya tiene una visita
   activa (`PROGRAMADA` o `REPROGRAMADA` — RN-05, RN-12), el sistema bloquea el
   guardado.
2. Se muestra al usuario: qué supervisora programó la visita existente, la fecha
   programada y la hora (si existe) — RN-13.
3. La supervisora puede cancelar su intento, o navegar a la visita existente para
   coordinarse con la otra supervisora (fuera de la app, p. ej. de forma verbal o
   por otro canal, ya que no hay notificaciones en el MVP).

## 5. Reprogramar visita

**Precondición:** la visita está en estado `PROGRAMADA` o `REPROGRAMADA`.

1. La supervisora abre la visita activa y selecciona "Reprogramar".
2. Ingresa nueva fecha (y hora opcional).
3. El sistema actualiza el mismo registro de visita: nueva fecha/hora, estado pasa a
   `REPROGRAMADA` (RN-07). No se valida contra sí misma como duplicado.
4. La visita permanece visible en la agenda compartida con la nueva fecha.

## 6. Cancelar visita

**Precondición:** la visita está en estado `PROGRAMADA` o `REPROGRAMADA`.

1. La supervisora abre la visita activa y selecciona "Cancelar".
2. Confirma la cancelación.
3. El estado pasa a `CANCELADA` (estado final, RN-06). La asociación queda libre
   para programar una nueva visita activa.

## 7. Registrar visita realizada

**Precondición:** la visita está en estado `PROGRAMADA` o `REPROGRAMADA`, y su fecha
ya se cumplió o está en curso.

1. La supervisora abre la visita y selecciona "Registrar resultado".
2. Elige si la visita se realizó o no:
   - Si **no se realizó**: el estado pasa a `NO_REALIZADA` (RN-08); no se piden
     puntuación ni comentario.
   - Si **se realizó**: ingresa fecha real de realización, hora de inicio/fin
     (opcionales), puntuación entera de 0 a 5, y comentario general (RN-19–RN-21).
     El estado pasa a `REALIZADA`.
3. La visita queda como registro histórico de la asociación y, si fue `REALIZADA`,
   cuenta para la meta individual y conjunta del mes correspondiente (RN-25).

## 8. Consultar historial

1. Desde el detalle de una asociación, la supervisora ve la lista de todas sus
   visitas (cualquier estado), ordenadas por fecha.
2. Por cada visita se muestra: fecha, tipo, modalidad, supervisora, asesor
   responsable en ese momento, puntuación, comentario y estado.
3. La supervisora interpreta manualmente la evolución (no hay cálculo automático de
   mejora/estancamiento ni gráficos en el MVP).

## 9. Revisar metas

1. Desde el panel inicial, la supervisora ve su meta individual del mes, visitas
   realizadas, visitas programadas y visitas faltantes para completarla.
2. También ve la meta conjunta del área, el total conjunto de visitas realizadas y
   programadas, y las visitas faltantes para la meta conjunta.
3. Puede ver también: próximas visitas, visitas pendientes de cerrar (activas cuya
   fecha ya pasó y aún no tienen resultado registrado) y visitas reprogramadas.
