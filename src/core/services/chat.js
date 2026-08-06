/**
 * CHAT INTERNO — el poller del canal de la sucursal.
 * ============================================================================
 * Mismo patrón que órdenes web y cambios de precio: sin WebSockets, la base es
 * la verdad y el cliente pregunta "¿hay algo nuevo?" cada pocos segundos — para
 * "¿hay cuenta para transferencia?" eso es indistinguible de instantáneo.
 *
 * El GATE lo decide la API (hoy: solo la distribuidora). Si el bootstrap dice
 * `habilitado: false`, acá no se pollea nada y el botón ni se muestra — las
 * otras sucursales no gastan un request por minuto en algo que no tienen.
 *
 * La marca de lectura vive en la BASE, por usuario: el "no leídos" sobrevive
 * al F5 y a cambiar de máquina. Lo propio nace leído — el badge es para lo que
 * escriben los demás.
 */
import { httpClient } from './httpClient.js';

const INTERVALO_MS = 4000;
const REINTENTO_MS = 15000;
const MAX_MENSAJES = 300;

let _ctx = null;          // { sucursalId, usuarioId } de la sesión de ESTA pestaña
let _habilitado = null;   // null = todavía sin respuesta del bootstrap
let _mensajes = [];
let _ultimoLeidoId = 0;
let _timer = null;
let _snap = null;
const _listeners = new Set();

function emit() {
  _snap = null;
  _listeners.forEach((l) => l());
}

/** Snapshot memoizado: useSyncExternalStore exige la MISMA referencia sin cambios. */
function snapshot() {
  if (!_snap) {
    const noLeidos = _habilitado === true
      ? _mensajes.filter((m) => m.id > _ultimoLeidoId && m.usuarioId !== _ctx?.usuarioId).length
      : 0;
    _snap = {
      habilitado: _habilitado === true,
      mensajes: _mensajes,
      noLeidos,
      usuarioId: _ctx?.usuarioId ?? null,
    };
  }
  return _snap;
}

function ultimoId() {
  return _mensajes.length ? _mensajes[_mensajes.length - 1].id : 0;
}

/** Mezcla sin duplicar: un tick puede traer el mensaje que este cliente ya envió. */
function agregar(nuevos) {
  if (!nuevos?.length) return false;
  const ids = new Set(_mensajes.map((m) => m.id));
  const frescos = nuevos.filter((m) => !ids.has(m.id));
  if (!frescos.length) return false;
  _mensajes = [..._mensajes, ...frescos].sort((a, b) => a.id - b.id).slice(-MAX_MENSAJES);
  return true;
}

async function tick() {
  if (_habilitado !== true || !_ctx) return;
  try {
    const r = await httpClient.get(`/chat/mensajes?sucursalId=${_ctx.sucursalId}&desde=${ultimoId()}`);
    if (agregar(r)) emit();
  } catch { /* API caída: el próximo tick reintenta */ }
}

async function bootstrap() {
  try {
    const r = await httpClient.get(`/chat/bootstrap?sucursalId=${_ctx.sucursalId}&usuarioId=${_ctx.usuarioId}`);
    _habilitado = !!r.habilitado;
    if (_habilitado) {
      _mensajes = r.mensajes ?? [];
      _ultimoLeidoId = r.ultimoLeidoId ?? 0;
      _timer = setInterval(tick, INTERVALO_MS);
    }
    emit();
  } catch {
    // API caída al arrancar: un solo reintento diferido — sin canal no hay apuro.
    _timer = setTimeout(() => { _timer = null; bootstrap(); }, REINTENTO_MS);
  }
}

export const chat = {
  /** Arranca (una vez) con el contexto de la sesión. Idempotente. */
  iniciar(ctx) {
    if (_ctx || !ctx?.sucursalId || !ctx?.usuarioId) return;
    _ctx = ctx;
    bootstrap();
  },

  subscribe(listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
  snapshot,

  /** Envía y deja lo propio como leído (la API hace lo mismo en la base). */
  async enviar(texto) {
    const t = (texto ?? '').trim();
    if (!t || !_ctx) return { ok: false };
    try {
      const m = await httpClient.post('/chat/mensajes', {
        sucursalId: _ctx.sucursalId, usuarioId: _ctx.usuarioId, texto: t,
      });
      agregar([m]);
      _ultimoLeidoId = Math.max(_ultimoLeidoId, m.id);
      emit();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || 'No se pudo enviar.' };
    }
  },

  /** Con el panel abierto, lo que está a la vista queda leído. */
  marcarLeido() {
    const ultimo = ultimoId();
    if (!_ctx || ultimo <= _ultimoLeidoId) return;
    _ultimoLeidoId = ultimo;
    emit();
    httpClient.post('/chat/leido', {
      sucursalId: _ctx.sucursalId, usuarioId: _ctx.usuarioId, ultimoMensajeId: ultimo,
    }).catch(() => { /* se reintenta solo con la próxima lectura */ });
  },
};
