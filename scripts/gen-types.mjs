// Regenera src/types/database.types.ts desde el esquema local de Supabase.
//
// No se usa redirección de shell (`>`) porque en PowerShell escribe el archivo
// en UTF-16LE por defecto, lo que corrompe el TypeScript generado. Este script
// captura el stdout del CLI y lo escribe explícitamente en UTF-8, así que
// funciona igual en PowerShell, cmd.exe y shells POSIX.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(projectRoot, 'src', 'types', 'database.types.ts');

const result = spawnSync('npx supabase gen types typescript --local', {
  encoding: 'utf8',
  shell: true,
});

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? '');
  process.exit(result.status ?? 1);
}

writeFileSync(outputPath, result.stdout, { encoding: 'utf8' });
console.log(`Tipos regenerados en ${path.relative(projectRoot, outputPath)}`);
