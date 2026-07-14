# Backlog inicial — Supervisa 360

Historias ordenadas por dependencia técnica y funcional. Los `RN-XX` remiten a
[business-rules.md](../product/business-rules.md).

---

## 1. Configuración del proyecto

### HU-01 — Inicializar proyecto frontend

- **Objetivo:** contar con una base de proyecto ejecutable para empezar a construir
  funcionalidades.
- **Descripción:** crear el proyecto con React + TypeScript + Vite, configurar MUI,
  React Router, React Hook Form, Zod, Vitest y React Testing Library.
- **Criterios de aceptación:**
  - El proyecto corre localmente sin errores.
  - Hay una ruta de ejemplo y una prueba de ejemplo que pasa.
- **Dependencias:** ninguna.
- **Fuera de alcance:** cualquier pantalla funcional real; solo estructura base.

### HU-02 — Configurar proyecto Supabase

- **Objetivo:** tener un backend administrado listo para autenticación y datos.
- **Descripción:** crear el proyecto en Supabase, configurar variables de entorno
  del frontend (URL y anon key), deshabilitar registro público en Auth.
- **Criterios de aceptación:**
  - El frontend puede conectarse a Supabase usando variables de entorno (no
    valores hardcodeados).
  - El registro público está deshabilitado.
- **Dependencias:** HU-01.
- **Fuera de alcance:** esquema de tablas (se cubre en HU-03/HU-05/HU-09/etc.).

### HU-03 — Definir esquema base de datos (migraciones)

- **Objetivo:** contar con las tablas mínimas para las siguientes historias.
- **Descripción:** crear las tablas `Advisor`, `Association`, `Visit`,
  `MonthlyGoal` y `Profile`, con las restricciones descritas en
  [database-design.md](../architecture/database-design.md), incluyendo la
  restricción crítica de visita activa única por asociación (RN-12).
- **Criterios de aceptación:**
  - Las tablas existen con los campos obligatorios/opcionales documentados.
  - La restricción de unicidad parcial de visita activa está creada y probada
    manualmente (intentar insertar dos visitas activas para la misma asociación
    falla).
- **Dependencias:** HU-02.
- **Fuera de alcance:** políticas RLS detalladas (HU-04).

### HU-04 — Configurar seguridad a nivel de fila (RLS)

- **Objetivo:** asegurar que solo usuarias autenticadas accedan a los datos.
- **Descripción:** habilitar RLS en todas las tablas de negocio y crear políticas
  que permitan lectura/escritura a cualquier usuario `authenticated`, denegando
  acceso a `anon`.
- **Criterios de aceptación:**
  - Una petición sin sesión no puede leer ni escribir ninguna tabla de negocio.
  - Una supervisora autenticada puede leer y escribir todas las tablas necesarias.
- **Dependencias:** HU-03.
- **Fuera de alcance:** diferenciación de permisos entre supervisoras (no aplica
  en el MVP).

---

## 2. Autenticación

### HU-05 — Crear cuentas de las 2 supervisoras

- **Objetivo:** que ambas supervisoras puedan acceder a la aplicación.
- **Descripción:** crear manualmente (fuera de la interfaz) las 2 cuentas en
  Supabase Auth y su fila correspondiente en `Profile`.
- **Criterios de aceptación:** ambas cuentas existen y pueden autenticarse.
- **Dependencias:** HU-02, HU-03.
- **Fuera de alcance:** pantalla de alta de usuarios.

### HU-06 — Pantalla de inicio de sesión

- **Objetivo:** permitir el acceso autenticado a la aplicación.
- **Descripción:** formulario de correo/contraseña, manejo de error genérico ante
  credenciales inválidas, redirección al panel inicial tras éxito.
- **Criterios de aceptación:**
  - Con credenciales válidas se accede al panel inicial.
  - Con credenciales inválidas se muestra un error sin revelar si el correo existe.
  - Sin sesión, cualquier ruta privada redirige al login.
- **Dependencias:** HU-01, HU-05.
- **Fuera de alcance:** recuperación de contraseña desde la app, registro público.

---

## 3. Asesores

### HU-07 — Importar asesores desde CSV

- **Objetivo:** contar con el catálogo inicial de asesores.
- **Descripción:** cargar manualmente (fuera de la interfaz) el CSV limpio de
  asesores a la tabla `Advisor`.
- **Criterios de aceptación:** los asesores existen en base de datos con código
  único y nombre.
- **Dependencias:** HU-03.
- **Fuera de alcance:** pantalla de importación (explícitamente fuera del MVP).

### HU-08 — Listado de asesores (solo lectura)

- **Objetivo:** consultar qué asesores existen.
- **Descripción:** pantalla de listado simple de asesores con su código y nombre.
- **Criterios de aceptación:** la lista muestra todos los asesores cargados.
- **Dependencias:** HU-06, HU-07.
- **Fuera de alcance:** crear, editar o eliminar asesores desde la interfaz.

---

## 4. Asociaciones

### HU-09 — Importar asociaciones desde CSV

- **Objetivo:** contar con el catálogo inicial de asociaciones.
- **Descripción:** cargar manualmente el CSV limpio de asociaciones (código de
  banca, nombre, región, estado, asesor actual) a la tabla `Association`.
- **Criterios de aceptación:** las asociaciones existen con sus datos obligatorios
  y referencian al asesor correcto.
- **Dependencias:** HU-03, HU-07.
- **Fuera de alcance:** pantalla de importación.

### HU-10 — Listado y búsqueda de asociaciones

- **Objetivo:** encontrar una asociación específica.
- **Descripción:** listado con búsqueda por código/nombre y filtros por región y
  estado.
- **Criterios de aceptación:**
  - Buscar por código de banca o nombre devuelve la asociación correcta.
  - Los filtros de región y estado acotan correctamente el listado.
- **Dependencias:** HU-06, HU-09.
- **Fuera de alcance:** ordenamientos avanzados o paginación compleja.

### HU-11 — Detalle de asociación

- **Objetivo:** ver toda la información relevante de una asociación.
- **Descripción:** pantalla de detalle con código, nombre, región, estado, asesor
  actual, y acceso al historial de visitas (HU-19).
- **Criterios de aceptación:** el detalle muestra todos los campos obligatorios.
- **Dependencias:** HU-10.
- **Fuera de alcance:** historial (se cubre en HU-19).

### HU-12 — Editar estado de asociación y reasignar asesor

- **Objetivo:** mantener actualizado el estado y el asesor asignado sin depender
  de una reimportación de CSV.
- **Descripción:** desde el detalle de la asociación, permitir cambiar su estado
  (entre los 7 valores) y reasignar su asesor actual (RN-03, RN-04).
- **Criterios de aceptación:**
  - Se puede cambiar el estado de la asociación a cualquiera de los 7 valores.
  - Se puede reasignar el asesor actual a otro asesor existente en el catálogo.
  - El cambio de asesor actual **no** modifica visitas ya existentes (el asesor
    congelado en visitas pasadas no cambia — RN-17).
- **Dependencias:** HU-08, HU-11.
- **Fuera de alcance:** edición de código de banca, nombre o región (solo por
  CSV); validación de una matriz específica de transiciones de estado (RN-04,
  pendiente de validar).

---

## 5. Agenda compartida

### HU-13 — Listado de agenda compartida

- **Objetivo:** que ambas supervisoras vean toda la planificación en un solo
  lugar.
- **Descripción:** lista ordenada por fecha con fecha, hora, asociación, asesor,
  supervisora, modalidad, tipo y estado de cada visita.
- **Criterios de aceptación:** la lista muestra todas las visitas de ambas
  supervisoras, ordenadas por fecha.
- **Dependencias:** HU-10 (requiere asociaciones existentes; las visitas se
  crearán en HU-15, esta historia puede probarse con datos de prueba mientras
  tanto).
- **Fuera de alcance:** vista de calendario gráfico.

### HU-14 — Filtros de agenda

- **Objetivo:** encontrar rápidamente un subconjunto relevante de visitas.
- **Descripción:** filtros por mes, supervisora, estado y región.
- **Criterios de aceptación:** cada filtro, individual o combinado, acota
  correctamente la lista.
- **Dependencias:** HU-13.
- **Fuera de alcance:** guardar filtros favoritos.

---

## 6. Programación de visitas

### HU-15 — Programar visita

- **Objetivo:** registrar la planificación de una visita a una asociación.
- **Descripción:** formulario con fecha, hora opcional, tipo, modalidad,
  característica; solo disponible si la asociación es supervisable (RN-01,
  RN-02); congela el asesor actual de la asociación en el momento de programar
  (RN-17).
- **Criterios de aceptación:**
  - No se puede programar una visita a una asociación no supervisable.
  - La visita creada queda en estado `PROGRAMADA` y aparece en la agenda.
  - La visita guarda el asesor actual de la asociación en ese momento.
- **Dependencias:** HU-11, HU-13.
- **Fuera de alcance:** validación de duplicidad (HU-16) y de repetición anual
  (HU-17), cubiertas como historias separadas pero requeridas antes de dar por
  completa la funcionalidad de programar.

---

## 7. Validación de duplicidad

### HU-16 — Bloquear doble programación de visita activa

- **Objetivo:** cumplir la regla crítica de no duplicidad (RN-12).
- **Descripción:** al programar, verificar si la asociación ya tiene una visita
  `PROGRAMADA` o `REPROGRAMADA`; si existe, bloquear y mostrar qué supervisora la
  programó, la fecha y la hora (RN-13). Reforzar con restricción de base de datos
  (HU-03) como respaldo ante condiciones de carrera.
- **Criterios de aceptación:**
  - Intentar programar una segunda visita activa para la misma asociación es
    bloqueado, con el mensaje especificado.
  - Si dos solicitudes llegan casi simultáneas, la restricción de base de datos
    impide que ambas se guarden como activas.
- **Dependencias:** HU-15, HU-03.
- **Fuera de alcance:** notificar automáticamente a la otra supervisora.

### HU-17 — Advertencia de visita ya realizada en el año

- **Objetivo:** dar contexto a la supervisora sin bloquear visitas de seguimiento
  legítimas (RN-10, RN-11, RN-14).
- **Descripción:** al programar, si la asociación ya tuvo una visita `REALIZADA`
  en el año, mostrar advertencia; bloquear solo si el nuevo tipo es `ORDINARIA`.
- **Criterios de aceptación:**
  - Programar `SEGUIMIENTO`/`MORA`/`DESERCION`/`CIERRE` tras una visita ya
    realizada en el año muestra advertencia pero permite continuar.
  - Programar `ORDINARIA` tras una visita `ORDINARIA` ya realizada en el año es
    bloqueado.
- **Dependencias:** HU-15.
- **Fuera de alcance:** ninguno adicional.

---

## 8. Reprogramación y cancelación

### HU-18 — Reprogramar y cancelar visita

- **Objetivo:** permitir ajustar la planificación ante cambios de agenda.
- **Descripción:** desde una visita activa, permitir cambiar fecha/hora
  (actualiza el mismo registro, estado pasa a `REPROGRAMADA` — RN-07) o cancelarla
  (estado pasa a `CANCELADA`, estado final).
- **Criterios de aceptación:**
  - Reprogramar actualiza fecha/hora y estado sin crear un nuevo registro.
  - Cancelar dejar la visita en estado final y libera a la asociación para una
    nueva visita activa.
- **Dependencias:** HU-15.
- **Fuera de alcance:** historial de cuántas veces se reprogramó una visita.

---

## 9. Registro de visita realizada

### HU-19 — Registrar resultado de visita (realizada / no realizada)

- **Objetivo:** cerrar el ciclo de una visita activa con su resultado real.
- **Descripción:** desde una visita `PROGRAMADA`/`REPROGRAMADA`, permitir marcarla
  como `NO_REALIZADA` (sin datos adicionales) o como `REALIZADA` (ver HU-20 para
  los datos de puntuación/comentario).
- **Criterios de aceptación:**
  - Marcar como `NO_REALIZADA` no exige puntuación ni comentario.
  - Marcar como `REALIZADA` exige completar HU-20 antes de guardar.
- **Dependencias:** HU-15.
- **Fuera de alcance:** transición automática por fecha vencida (es manual).

---

## 10. Puntuación y comentario

### HU-20 — Capturar puntuación y comentario general

- **Objetivo:** dejar constancia de cómo se encontró la asociación.
- **Descripción:** al marcar una visita como `REALIZADA`, capturar fecha real,
  horas opcionales, puntuación entera de 0 a 5 y comentario general de texto
  libre (RN-19, RN-20, RN-21).
- **Criterios de aceptación:**
  - La puntuación solo acepta enteros entre 0 y 5.
  - El comentario general es un único campo de texto (no hay campos por
    aspecto).
  - Ambos son obligatorios para guardar una visita como `REALIZADA`.
- **Dependencias:** HU-19.
- **Fuera de alcance:** ficha de evaluación por aspectos, múltiples
  observaciones.

### HU-21 — Editar resultado de una visita realizada

- **Objetivo:** corregir errores de puntuación o comentario después de guardados.
- **Descripción:** permitir a cualquiera de las dos supervisoras editar la
  puntuación y el comentario de una visita ya `REALIZADA` (RN-22).
- **Criterios de aceptación:** el cambio se refleja en el historial de la
  asociación sin alterar el estado de la visita.
- **Dependencias:** HU-20.
- **Fuera de alcance:** log de auditoría de cambios.

---

## 11. Historial

### HU-22 — Historial de visitas por asociación

- **Objetivo:** revisar la evolución de una asociación a lo largo del tiempo.
- **Descripción:** en el detalle de la asociación, listar todas sus visitas
  (cualquier estado) con fecha, tipo, modalidad, supervisora, asesor responsable
  en ese momento, puntuación, comentario y estado.
- **Criterios de aceptación:** el historial incluye visitas de todos los estados
  y muestra el asesor congelado de cada una, no el asesor actual de la
  asociación.
- **Dependencias:** HU-11, HU-20.
- **Fuera de alcance:** cálculo automático de mejora/estancamiento, gráficos.

---

## 12. Metas

### HU-23 — Definir meta mensual por supervisora

- **Objetivo:** establecer cuántas visitas debe realizar cada supervisora en el
  mes.
- **Descripción:** permitir crear/editar la meta mensual de cada supervisora
  (referencia inicial: 15).
- **Criterios de aceptación:** cada supervisora tiene, como máximo, una meta por
  mes (restricción de unicidad); el valor es editable mes a mes.
- **Dependencias:** HU-06.
- **Fuera de alcance:** metas por región o por tipo de visita.

### HU-24 — Panel de metas individual y conjunta

- **Objetivo:** ver el avance del mes de un vistazo.
- **Descripción:** panel inicial con meta individual, visitas realizadas,
  programadas y faltantes para la supervisora autenticada; y meta conjunta,
  total conjunto realizado, programado y faltante para el área. Incluye también
  próximas visitas, visitas pendientes de cerrar y visitas reprogramadas.
- **Criterios de aceptación:**
  - Los conteos individuales y conjuntos coinciden con las visitas `REALIZADA`
    y `PROGRAMADA`/`REPROGRAMADA` del mes correspondiente (RN-25, RN-26).
  - La meta conjunta se calcula como suma de metas individuales vigentes, no
    como un valor almacenado aparte (RN-24).
- **Dependencias:** HU-20, HU-23.
- **Fuera de alcance:** indicador de asociaciones únicas visitadas, porcentaje de
  cobertura anual, gráficos.

---

## 13. Pruebas y despliegue

### HU-25 — Pruebas automatizadas de reglas críticas

- **Objetivo:** proteger las reglas de negocio más sensibles ante regresiones.
- **Descripción:** pruebas (Vitest + React Testing Library) sobre, como mínimo:
  bloqueo de duplicidad (RN-12), rango de puntuación (RN-19), obligatoriedad de
  puntuación/comentario en `REALIZADA` (RN-21), y cálculo de metas (RN-24–RN-26).
- **Criterios de aceptación:** las pruebas cubren esos escenarios y pasan en CI.
- **Dependencias:** HU-16, HU-20, HU-24.
- **Fuera de alcance:** cobertura exhaustiva de UI/estilos.

### HU-26 — Despliegue en Vercel

- **Objetivo:** que las supervisoras puedan usar la aplicación en producción.
- **Descripción:** configurar despliegue continuo desde GitHub a Vercel, con
  variables de entorno de Supabase configuradas en el entorno de producción.
- **Criterios de aceptación:** la aplicación es accesible en una URL de
  producción y refleja los últimos cambios de la rama principal.
- **Dependencias:** HU-02, HU-25.
- **Fuera de alcance:** dominio propio, entornos de staging adicionales.
