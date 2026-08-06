/**
 * CHAT INTERNO — el poller del canal del local y de los privados 1-a-1.
 * ============================================================================
 * Mismo patrón que órdenes web y cambios de precio: sin WebSockets, la base es
 * la verdad y el cliente pregunta "¿hay algo nuevo?" cada pocos segundos.
 *
 * Un solo cajón de mensajes con destinatario opcional: `paraUsuarioId` null es
 * el CANAL del local; con valor, es PRIVADO y la API solo lo manda a las dos
 * puntas. Cada conversación tiene su propia marca de lectura (canal 0 = grupal,
 * otro = el privado con ese usuario), por usuario y en la base.
 *
 * El mismo poll es el LATIDO de presencia: la API devuelve quiénes pollearon
 * hace menos de 15 segundos — eso es "en línea". Sin registro extra.
 */
import { httpClient } from './httpClient.js';

const INTERVALO_MS = 4000;
const REINTENTO_MS = 15000;
const MAX_MENSAJES = 500;

let _ctx = null;          // { sucursalId, usuarioId } de la sesión de ESTA pestaña
let _habilitado = null;   // null = todavía sin respuesta del bootstrap
let _mensajes = [];
let _lecturas = {};       // { [canalUsuarioId]: ultimoMensajeIdLeido } — 0 = grupal
let _enLinea = [];        // [{ id, nombre }] según el último tick
let _nombres = {};        // { [usuarioId]: nombre } — acumulado para titular privados
let _timer = null;
let _snap = null;
const _listeners = new Set();

function emit() {
  _snap = null;
  _listeners.forEach((l) => l());
}

/** A qué conversación pertenece un mensaje, mirado DESDE este usuario. */
function canalDe(m) {
  if (m.paraUsuarioId == null) return 0;
  return m.usuarioId === _ctx?.usuarioId ? m.paraUsuarioId : m.usuarioId;
}

/** Snapshot memoizado: useSyncExternalStore exige la MISMA referencia sin cambios. */
function snapshot() {
  if (!_snap) {
    const porCanal = {};
    if (_habilitado === true) {
      for (const m of _mensajes) {
        if (m.usuarioId === _ctx?.usuarioId) continue; // lo propio no cuenta
        const canal = canalDe(m);
        if (m.id > (_lecturas[canal] ?? 0)) porCanal[canal] = (porCanal[canal] ?? 0) + 1;
      }
    }
    _snap = {
      habilitado: _habilitado === true,
      mensajes: _mensajes,
      enLinea: _enLinea,
      nombres: _nombres,
      usuarioId: _ctx?.usuarioId ?? null,
      noLeidosPorCanal: porCanal,
      noLeidosTotal: Object.values(porCanal).reduce((a, n) => a + n, 0),
    };
  }
  return _snap;
}

function ultimoId() {
  return _mensajes.length ? _mensajes[_mensajes.length - 1].id : 0;
}

function aprenderNombres(mensajes, enLinea) {
  for (const m of mensajes ?? []) {
    if (m.usuarioId && m.usuarioNombre) _nombres[m.usuarioId] = m.usuarioNombre;
  }
  for (const u of enLinea ?? []) _nombres[u.id] = u.nombre;
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

/** La presencia solo emite si CAMBIÓ: sin esto, cada tick re-renderiza al pedo. */
function actualizarPresencia(enLinea) {
  const nueva = (enLinea ?? []).map((u) => u.id).sort().join(',');
  const vieja = _enLinea.map((u) => u.id).sort().join(',');
  if (nueva === vieja) return false;
  _enLinea = enLinea ?? [];
  return true;
}

async function tick() {
  if (_habilitado !== true || !_ctx) return;
  try {
    const r = await httpClient.get(
      `/chat/mensajes?sucursalId=${_ctx.sucursalId}&usuarioId=${_ctx.usuarioId}&desde=${ultimoId()}`,
    );
    aprenderNombres(r.mensajes, r.enLinea);
    const a = agregar(r.mensajes);
    const b = actualizarPresencia(r.enLinea);
    if (a || b) emit();
  } catch { /* API caída: el próximo tick reintenta */ }
}

async function bootstrap() {
  try {
    const r = await httpClient.get(`/chat/bootstrap?sucursalId=${_ctx.sucursalId}&usuarioId=${_ctx.usuarioId}`);
    _habilitado = !!r.habilitado;
    if (_habilitado) {
      _mensajes = r.mensajes ?? [];
      _lecturas = Object.fromEntries((r.lecturas ?? []).map((l) => [l.canalUsuarioId, l.ultimoMensajeId]));
      aprenderNombres(r.mensajes, r.enLinea);
      _enLinea = r.enLinea ?? [];
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

  /** Envía al canal (sin destinatario) o al privado con `paraUsuarioId`. */
  async enviar(texto, paraUsuarioId = null) {
    const t = (texto ?? '').trim();
    if (!t || !_ctx) return { ok: false };
    try {
      const m = await httpClient.post('/chat/mensajes', {
        sucursalId: _ctx.sucursalId, usuarioId: _ctx.usuarioId, texto: t,
        paraUsuarioId: paraUsuarioId || undefined,
      });
      agregar([m]);
      const canal = paraUsuarioId || 0;
      _lecturas[canal] = Math.max(_lecturas[canal] ?? 0, m.id);
      emit();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || 'No se pudo enviar.' };
    }
  },

  /** Con la conversación a la vista, lo que llega a ELLA queda leído. */
  marcarLeido(canalUsuarioId = 0) {
    if (!_ctx) return;
    const deLaConversacion = _mensajes.filter((m) => canalDe(m) === canalUsuarioId);
    const ultimo = deLaConversacion.length ? deLaConversacion[deLaConversacion.length - 1].id : 0;
    if (ultimo <= (_lecturas[canalUsuarioId] ?? 0)) return;
    _lecturas[canalUsuarioId] = ultimo;
    emit();
    httpClient.post('/chat/leido', {
      sucursalId: _ctx.sucursalId, usuarioId: _ctx.usuarioId,
      canalUsuarioId, ultimoMensajeId: ultimo,
    }).catch(() => { /* se reintenta solo con la próxima lectura */ });
  },
};
