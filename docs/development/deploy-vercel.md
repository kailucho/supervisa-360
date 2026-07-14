# Despliegue en Vercel (HU-26)

Esta guía cubre la parte de configuración que se puede dejar lista de
antemano. **No se ejecuta ningún despliegue real** desde este repositorio ni
desde esta sesión: requiere credenciales de Vercel/GitHub y una decisión
consciente de a qué proyecto de Supabase apuntar.

## 1. Fallback de rutas (SPA)

React Router usa rutas del lado del cliente (`/agenda`, `/asociaciones/:id`,
etc.). Sin configuración adicional, recargar la página en una de esas rutas
devuelve 404 en Vercel, porque no existe un archivo físico en esa ruta.

[`vercel.json`](../../vercel.json) ya incluye el rewrite necesario:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Con esto, cualquier ruta sirve `index.html` y React Router toma el control en
el navegador.

## 2. Configuración del proyecto en Vercel

- **Framework preset:** Vite.
- **Build command:** `npm run build`.
- **Output directory:** `dist`.
- **Install command:** `npm ci` (por defecto).
- **Node.js version:** 24.x (la misma que usa CI, ver
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).

## 3. Variables de entorno en Vercel

En el proyecto de Vercel → **Settings → Environment Variables**, agrega para
**Production** (y **Preview** si se usan despliegues por PR):

- `VITE_SUPABASE_URL` — URL del proyecto de Supabase **de producción** (no la
  local).
- `VITE_SUPABASE_ANON_KEY` — la clave **anon**, nunca `service_role`.

Ambas se toman de **Supabase → Project Settings → API** del proyecto remoto.

## 4. Configuración de Supabase Auth para producción

Antes de apuntar el frontend a producción:

1. **Deshabilitar el registro público** (`Authentication → Providers → Email`
   → `Enable email signups` = desactivado), ya que el MVP no tiene ese flujo
   (HU-06 fuera de alcance).
2. **Site URL** y **Additional Redirect URLs** (`Authentication → URL
Configuration`): configura la URL real de producción en Vercel (por
   ejemplo `https://supervisa360.vercel.app`) — necesario aunque este MVP no
   usa magic links, para que cualquier flujo de Auth que dependa de
   redirecciones (recuperación futura, etc.) no quede apuntando a
   `localhost`.

## 5. Crear las dos cuentas reales de supervisoras

Igual que en local (ver [`local-supabase.md`](local-supabase.md) §10), pero
en el proyecto de Supabase de producción:

1. **Authentication → Users → Add user**, con el correo y contraseña reales
   de cada supervisora. Márcalo como "Auto Confirm User" (o confirma por
   correo si se habilitó `enable_confirmations`).
2. Copia el `UUID` de cada usuario creado.
3. Inserta su fila en `public.profiles` (SQL Editor de producción):

   ```sql
   insert into public.profiles (id, full_name, is_active)
   values ('<uuid-de-auth>', 'Nombre completo', true);
   ```

4. Repite para la segunda supervisora.
5. Crea sus metas del mes en curso:

   ```sql
   select private.create_monthly_goals_for_active_supervisors();
   ```

## 6. Migraciones en producción

**No se incluye en el alcance de esta tarea.** Cuando corresponda aplicar el
esquema al proyecto remoto, es una decisión consciente y manual —
típicamente `supabase link` + `supabase db push` contra el proyecto de
producción — que debe ejecutarse deliberadamente, revisando antes el diff, y
nunca como parte de un flujo automático.

## 7. Checklist antes de desplegar

- [ ] `npm run build` pasa localmente sin errores.
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de producción configuradas en Vercel.
- [ ] Registro público deshabilitado en Supabase Auth (producción).
- [ ] Migraciones aplicadas conscientemente al proyecto remoto (fuera de este repo/sesión).
- [ ] Asesores y asociaciones cargados en producción (ver [`data-import.md`](data-import.md)).
- [ ] Las dos cuentas reales de supervisoras creadas, con su fila en `profiles` y su meta del mes.
- [ ] `service_role` no aparece en ninguna variable `VITE_*` ni en el código del frontend.
