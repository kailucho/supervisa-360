# Supabase local — guía de desarrollo

Esta guía cubre el flujo de trabajo con Supabase **local** en Windows/PowerShell. El
proyecto está vinculado (`supabase link`) a un proyecto remoto de Supabase, pero ese
vínculo solo se usa para comandos explícitos contra la nube; el día a día de
desarrollo ocurre enteramente contra los contenedores locales.

## 1. Requisitos

- Node.js (ver `package.json` para la versión de las dependencias).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) corriendo. Supabase
  CLI levanta Postgres, PostgREST, Auth (GoTrue), Studio, etc. como contenedores.
- No es necesaria una instalación global de la Supabase CLI: todos los scripts usan
  `npx supabase`.

## 2. Iniciar Supabase local

```sh
npm run supabase:start
```

La primera vez descarga las imágenes de los contenedores; puede tardar varios
minutos. Al terminar, imprime las URLs y claves locales (ver sección 7).

Para detenerlo:

```sh
npm run supabase:stop
```

## 3. Ver el estado

```sh
npx supabase status
```

Muestra si los servicios están arriba y reimprime las URLs/claves locales. Si algún
servicio opcional (analytics, pooler, etc.) aparece como "stopped", revisa
`supabase/config.toml`: en este proyecto están deshabilitados a propósito.

## 4. Reconstruir la base de datos (`db reset`)

```sh
npm run db:reset
```

Recrea la base desde cero: aplica todas las migraciones de
`supabase/migrations/` en orden y luego `supabase/seed.sql`. Es la forma
correcta de probar que las migraciones funcionan desde un estado limpio. Úsalo
cada vez que cambies una migración o el seed.

## 5. Lint del esquema

```sh
npm run db:lint
```

Ejecuta `supabase db lint --local`, que revisa el esquema local en busca de
problemas (funciones sin `search_path` fijo, etc.). Debe correr sin errores antes
de dar por buena una migración.

También es útil, tras cambiar una migración:

```sh
npx supabase db diff --local
```

Compara el esquema reconstruido desde las migraciones contra una shadow database.
Si reporta diferencias inesperadas, casi siempre significa que la migración no
refleja fielmente lo que se pretende, o que hubo un cambio manual fuera de una
migración.

## 6. Regenerar los tipos TypeScript

```sh
npm run db:types
```

Ejecuta `scripts/gen-types.mjs`, que llama a
`supabase gen types typescript --local` y escribe el resultado en
`src/types/database.types.ts` **forzando codificación UTF-8**.

> **Por qué no usar `supabase gen types ... > archivo` directamente:** en
> PowerShell, el operador `>` (alias de `Out-File`) escribe por defecto en
> UTF-16LE. Un archivo `.ts` en UTF-16LE no es un error visible al momento de
> generarlo, pero rompe el build/type-check de TypeScript. El script de Node
> evita el problema por completo escribiendo el archivo explícitamente en UTF-8,
> y funciona igual en PowerShell, cmd.exe o una shell POSIX.

No edites `src/types/database.types.ts` a mano: se sobreescribe por completo en
cada regeneración.

## 7. Obtener las credenciales locales

Las credenciales locales (URL, `anon key`, etc.) las imprime:

```sh
npx supabase status
```

o quedan visibles al final de `npm run supabase:start`. **No son secretos de
producción** — son valores fijos y públicos de cualquier instalación local de
Supabase CLI — pero de todos modos no deben copiarse en documentación ni en
código fuente versionado: cópialas directamente desde la terminal a tu
`.env.local`.

## 8. Configurar `.env.local`

1. Copia `.env.example` a `.env.local` (este archivo está en `.gitignore` y nunca
   se versiona).
2. Completa:
   ```
   VITE_SUPABASE_URL=<API_URL de "supabase status">
   VITE_SUPABASE_ANON_KEY=<ANON_KEY de "supabase status">
   ```
3. Reinicia `npm run dev` si ya estaba corriendo, para que Vite recargue las
   variables de entorno.

`src/lib/env.ts` valida estas variables con Zod al arrancar la app y lanza un
error descriptivo si faltan o son inválidas.

## 9. Abrir Supabase Studio

Con Supabase local corriendo, abre la URL `STUDIO_URL` que imprime
`supabase status` (por defecto `http://127.0.0.1:54323`). Desde ahí puedes
inspeccionar tablas, ejecutar SQL, y gestionar usuarios de Auth manualmente.

## 10. Crear manualmente las dos supervisoras de prueba

El seed (`supabase/seed.sql`) ya crea automáticamente los dos usuarios de Auth y
sus perfiles (`supervisora1@supervisa360.local` / `supervisora2@supervisa360.local`,
contraseña `Supervisa360!`) cada vez que corres `npm run db:reset`. Este paso
manual solo es necesario si por alguna razón necesitas crear un usuario adicional
sin pasar por el seed:

1. Abre Supabase Studio → **Authentication** → **Users** → **Add user**.
2. Crea el usuario con email/contraseña y márcalo como "Auto Confirm User".
3. Copia el `UUID` generado.
4. En **Table Editor** → `public.profiles`, inserta una fila con ese mismo `id`
   y el `full_name` correspondiente (o hazlo desde el SQL Editor).

## 11. Comandos que nunca deben ejecutarse accidentalmente contra producción

Este proyecto está vinculado a un proyecto remoto de Supabase
(`supabase link`), lo cual hace *más* fácil ejecutar algo contra la nube por
error. **Nunca ejecutes, salvo instrucción explícita y consciente:**

- `supabase db push` — aplicaría las migraciones locales a la base remota.
- `supabase db reset --linked` — **borra y reconstruye la base remota**.
- Cualquier variante de `supabase db reset`/`db push` con `--linked` o
  `--db-url` apuntando a un host que no sea `127.0.0.1`.

Todos los scripts de `package.json` (`db:reset`, `db:lint`, `db:types`) operan
exclusivamente contra `--local` / los contenedores locales.

## 12. `service_role` nunca en el frontend

La clave `service_role` (que omite RLS) **nunca** debe usarse desde el código de
React ni guardarse en `.env.local`/`.env.example` como variable `VITE_*` — todo lo
que empieza con `VITE_` termina embebido en el bundle del navegador. El frontend
solo usa la `anon key`, y el control de acceso real ocurre vía RLS (ver
[`docs/architecture/architecture.md`](../architecture/architecture.md)).
