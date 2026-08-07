/**
 * CHAT DE LA DISTRIBUIDORA — el mostrador pregunta sin dejar el puesto.
 * ============================================================================
 * Botón en el Topbar (solo si la API habilitó el canal — hoy, sesiones paradas
 * en la distribuidora) con badge del TOTAL de no leídos, y un panel lateral que
 * flota sobre cualquier pantalla, incluido el POS.
 *
 * Dos niveles adentro del panel:
 *  - LISTA: el canal del local arriba y abajo el EQUIPO — quiénes están en
 *    línea (punto verde: pollearon hace <15 s) y con quiénes ya hay
 *    conversación aunque estén fuera. Cada fila con su badge propio.
 *  - CONVERSACIÓN: el hilo elegido (grupal o privado), con volver. El privado
 *    existe porque si tres cajeros preguntan a la vez por el canal, las
 *    respuestas del administrador se pisan.
 *
 * El sonido es UNA nota (distinta de la campanita de dos de los pedidos web) y
 * suena solo si lo nuevo NO está a la vista: la conversación abierta se marca
 * leída sola y no suena.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Badge, Box, Divider, Drawer, IconButton, TextField, Tooltip, Typography,
} from '@mui/material';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { chat } from '@core/services/chat.js';

function tono() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 987.77; // Si5 — una sola nota corta
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close(), 600);
  } catch { /* sin audio: el badge alcanza */ }
}

const horaDe = (fecha) => {
  const d = new Date(fecha);
  const hoy = new Date();
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === hoy.toDateString()
    ? hora
    : `${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })} ${hora}`;
};

/** Punto de presencia: verde = en línea, gris = fuera. */
function Punto({ activo }) {
  return (
    <span
      style={{
        width: 9, height: 9, borderRadius: '50%', flex: 'none',
        background: activo ? 'var(--crm-color-success)' : 'var(--crm-color-border)',
      }}
    />
  );
}

function FilaCanal({ icono, titulo, subtitulo, noLeidos, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.1,
        cursor: 'pointer', '&:hover': { bgcolor: 'var(--crm-color-surface-2)' },
      }}
    >
      {icono}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.25 }}>{titulo}</Typography>
        {subtitulo && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {subtitulo}
          </Typography>
        )}
      </Box>
      {noLeidos > 0 && (
        <Box
          sx={{
            px: 0.9, py: 0.1, borderRadius: 999, fontSize: 11, fontWeight: 700,
            bgcolor: 'var(--crm-color-accent-2)', color: '#fff',
          }}
        >
          {noLeidos}
        </Box>
      )}
    </Box>
  );
}

export function ChatDock() {
  const { user } = useAuth();
  const [abierto, setAbierto] = useState(false);
  /** null = lista; 0 = canal del local; otro = privado con ese usuario. */
  const [vista, setVista] = useState(null);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const previo = useRef(null);

  useEffect(() => {
    if (user?.id && user?.sucursalId) chat.iniciar({ sucursalId: user.sucursalId, usuarioId: user.id });
  }, [user?.id, user?.sucursalId]);

  const snap = useSyncExternalStore(chat.subscribe, chat.snapshot, chat.snapshot);

  const vistaActiva = abierto ? vista : null;

  // Suena cuando sube lo no leído FUERA de la conversación a la vista (la
  // abierta se marca leída sola). El primer valor no suena: lo que esperaba
  // al abrir el CRM ya se ve en el badge.
  const fueraDeVista = snap.noLeidosTotal
    - (vistaActiva !== null ? (snap.noLeidosPorCanal[vistaActiva] ?? 0) : 0);
  useEffect(() => {
    if (previo.current === null) { previo.current = fueraDeVista; return; }
    if (fueraDeVista > previo.current) tono();
    previo.current = fueraDeVista;
  }, [fueraDeVista]);

  const mensajesDeVista = useMemo(() => {
    if (vistaActiva === null) return [];
    return snap.mensajes.filter((m) => {
      if (m.paraUsuarioId == null) return vistaActiva === 0;
      const canal = m.usuarioId === snap.usuarioId ? m.paraUsuarioId : m.usuarioId;
      return canal === vistaActiva;
    });
  }, [snap.mensajes, snap.usuarioId, vistaActiva]);

  // La conversación a la vista queda leída y la lista se va al final.
  useEffect(() => {
    if (vistaActiva === null) return;
    chat.marcarLeido(vistaActiva);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [vistaActiva, mensajesDeVista.length]);

  /**
   * El equipo: en línea primero (punto verde) y después con quienes ya hay
   * conversación aunque estén fuera — un privado sin responder no desaparece
   * porque el otro cerró el sistema.
   */
  const equipo = useMemo(() => {
    const porId = new Map();
    for (const u of snap.enLinea) {
      if (u.id !== snap.usuarioId) porId.set(u.id, { id: u.id, nombre: u.nombre, enLinea: true });
    }
    for (const m of snap.mensajes) {
      if (m.paraUsuarioId == null) continue;
      const otro = m.usuarioId === snap.usuarioId ? m.paraUsuarioId : m.usuarioId;
      if (otro && otro !== snap.usuarioId && !porId.has(otro)) {
        porId.set(otro, { id: otro, nombre: snap.nombres[otro] || `Usuario #${otro}`, enLinea: false });
      }
    }
    return [...porId.values()].sort((a, b) => (b.enLinea - a.enLinea) || a.nombre.localeCompare(b.nombre));
  }, [snap.enLinea, snap.mensajes, snap.nombres, snap.usuarioId]);

  if (!snap.habilitado) return null;

  const enviar = async () => {
    const t = texto.trim();
    if (!t || vistaActiva === null) return;
    setTexto('');
    const res = await chat.enviar(t, vistaActiva === 0 ? null : vistaActiva);
    if (!res.ok) { setError(res.error || 'No se pudo enviar.'); setTexto(t); }
    else setError('');
  };

  const tituloVista = vistaActiva === 0
    ? 'Canal · Distribuidora'
    : (snap.nombres[vistaActiva] || 'Privado');
  const otroEnLinea = vistaActiva > 0 && snap.enLinea.some((u) => u.id === vistaActiva);

  return (
    <>
      <Tooltip title="Chat de la Distribuidora">
        <IconButton onClick={() => { setAbierto(true); setVista(null); }} aria-label="Chat interno">
          <Badge badgeContent={snap.noLeidosTotal} color="error" max={99}>
            <ForumOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Drawer
        anchor="right"
        open={abierto}
        onClose={() => setAbierto(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 380 }, display: 'flex', flexDirection: 'column' } }}
      >
        <Box sx={{ px: 1.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {vista !== null ? (
            <IconButton size="small" onClick={() => setVista(null)} aria-label="Volver a la lista">
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          ) : (
            <ForumOutlinedIcon fontSize="small" color="primary" sx={{ mx: 0.5 }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {vista === null ? 'Chat · Distribuidora' : tituloVista}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {vista === null
                ? 'El canal del local y los privados del equipo'
                : vista === 0
                  ? 'Lo ven todos los usuarios del local'
                  : (otroEnLinea ? 'En línea' : 'Fuera de línea — lo verá al volver')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAbierto(false)} aria-label="Cerrar chat">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        {vista === null ? (
          /* ------------------------------ LISTA ------------------------------ */
          <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
            <FilaCanal
              icono={<GroupsOutlinedIcon fontSize="small" color="primary" />}
              titulo="Canal del local"
              subtitulo="Lo ven todos"
              noLeidos={snap.noLeidosPorCanal[0] ?? 0}
              onClick={() => setVista(0)}
            />
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
              Equipo
            </Typography>
            {equipo.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
                Nadie más conectado en la Distribuidora ahora.
              </Typography>
            )}
            {equipo.map((u) => (
              <FilaCanal
                key={u.id}
                icono={<Punto activo={u.enLinea} />}
                titulo={u.nombre}
                subtitulo={u.enLinea ? 'En línea' : 'Fuera de línea'}
                noLeidos={snap.noLeidosPorCanal[u.id] ?? 0}
                onClick={() => setVista(u.id)}
              />
            ))}

            {/* La regla se avisa donde se usa: nadie tiene que descubrir a los
                dos días que lo que anotó en el chat ya no está. */}
            <Divider sx={{ mt: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1.25 }}>
              Los mensajes se borran solos a las {snap.retencionHoras} horas. Lo que hay que
              decidir queda en su documento (el pedido, la factura), no acá.
            </Typography>
          </Box>
        ) : (
          /* --------------------------- CONVERSACIÓN --------------------------- */
          <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
            {mensajesDeVista.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                {vista === 0
                  ? 'Todavía no hay mensajes en el canal del local.'
                  : `Sin mensajes todavía. Lo que escribas acá lo ven solo ${tituloVista} y vos.`}
              </Typography>
            )}
            {mensajesDeVista.map((m) => {
              const propio = m.usuarioId === snap.usuarioId;
              return (
                <Box key={m.id} sx={{ display: 'flex', justifyContent: propio ? 'flex-end' : 'flex-start', mb: 1 }}>
                  <Box
                    sx={{
                      maxWidth: '85%',
                      px: 1.5, py: 0.75,
                      borderRadius: 2,
                      bgcolor: propio ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface-2)',
                      border: '1px solid var(--crm-color-border)',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--crm-color-text-secondary)' }}>
                      {propio ? 'Vos' : (m.usuarioNombre || '—')}
                      <span style={{ fontWeight: 400, marginLeft: 8 }}>{horaDe(m.fecha)}</span>
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {m.texto}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {vista !== null && (
          <>
            <Divider />
            <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                autoFocus
                placeholder="Escribí y Enter para enviar…"
                value={texto}
                error={!!error}
                helperText={error || undefined}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  // Enter envía; Shift+Enter hace el salto de línea.
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
                }}
              />
              <IconButton color="primary" onClick={enviar} aria-label="Enviar mensaje" disabled={!texto.trim()}>
                <SendIcon />
              </IconButton>
            </Box>
          </>
        )}
      </Drawer>
    </>
  );
}
