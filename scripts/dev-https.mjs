/**
 * Arranca el dev server con HTTPS y escuchando en toda la red local.
 * ============================================================================
 * Para qué: el **escáner con la cámara** (Almacén › Vencimientos › Control)
 * necesita un "contexto seguro". Los navegadores solo consideran seguro HTTPS o
 * localhost — entrando desde el celular por `http://192.168.0.x:3000` la cámara
 * no arranca y el navegador no explica por qué.
 *
 * Se hace en un script y no con una variable en la línea de comandos porque
 * `VITE_DEV_HTTPS=1 npm run dev` no funciona en PowerShell (es sintaxis de
 * bash), y este proyecto se maneja desde Windows.
 *
 * El certificado es autofirmado: la primera vez el celular avisa "conexión no
 * privada" → Avanzado → Continuar. Es la red de casa, no hay nada que temer.
 * En producción (dominio con HTTPS real) nada de esto hace falta.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => n.address);

console.log('\n  Dev server con HTTPS (para usar la cámara desde el celular)\n');
for (const ip of ips) console.log(`    https://${ip}:3000`);
console.log('\n  El celular va a avisar que el certificado no es de confianza:');
console.log('  Avanzado → Continuar. Es tu propia red.\n');

const vite = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', '--host'],
  { stdio: 'inherit', env: { ...process.env, VITE_DEV_HTTPS: '1' } },
);
vite.on('exit', (code) => process.exit(code ?? 0));
