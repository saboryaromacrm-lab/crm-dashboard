/**
 * CHAT DE LA DISTRIBUIDORA — el mostrador pregunta sin dejar el puesto.
 * ============================================================================
 * Botón en el Topbar (solo aparece si la API habilitó el canal — hoy, sesiones
 * paradas en la distribuidora) con badge de no leídos, y un panel lateral que
 * flota sobre CUALQUIER pantalla, incluido el POS: ese es el punto — la cajera
 * pregunta "¿hay cuenta para transferencia?" sin cerrar su venta.
 *
 * Un solo canal grupal: en un equipo chico funciona como la voz del local — si
 * ya preguntaron y ya respondieron, el resto lo ve y no repite. El sonido es
 * UNA nota (distinta de la campanita de dos notas de los pedidos web) y suena
 * solo con el panel cerrado: abierto, el mensaje ya está a la vista.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Badge, Box, Divider, Drawer, IconButton, TextField, Tooltip, Typography,
} from '@mui/material';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
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

export function ChatDock() {
  const { user } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const previo = useRef(null);

  useEffect(() => {
    if (user?.id && user?.sucursalId) chat.iniciar({ sucursalId: user.sucursalId, usuarioId: user.id });
  }, [user?.id, user?.sucursalId]);

  const snap = useSyncExternalStore(chat.subscribe, chat.snapshot, chat.snapshot);

  // Suena cuando el "no leídos" SUBE y el panel está cerrado. El primer valor
  // no suena: lo que ya esperaba al abrir el CRM se ve en el badge.
  useEffect(() => {
    if (previo.current === null) { previo.current = snap.noLeidos; return; }
    if (snap.noLeidos > previo.current && !abierto) tono();
    previo.current = snap.noLeidos;
  }, [snap.noLeidos, abierto]);

  // Con el panel abierto, lo que llega queda leído y la lista se va al final.
  useEffect(() => {
    if (!abierto) return;
    chat.marcarLeido();
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [abierto, snap.mensajes.length]);

  if (!snap.habilitado) return null;

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    const res = await chat.enviar(t);
    if (!res.ok) { setError(res.error || 'No se pudo enviar.'); setTexto(t); }
    else setError('');
  };

  return (
    <>
      <Tooltip title="Chat de la Distribuidora">
        <IconButton onClick={() => setAbierto(true)} aria-label="Chat interno">
          <Badge badgeContent={snap.noLeidos} color="error" max={99}>
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
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ForumOutlinedIcon fontSize="small" color="primary" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Chat · Distribuidora
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Lo ven todos los usuarios del local
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAbierto(false)} aria-label="Cerrar chat">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
          {snap.mensajes.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
              Todavía no hay mensajes. Lo que escribas lo ve todo el equipo de la Distribuidora.
            </Typography>
          )}
          {snap.mensajes.map((m) => {
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

        <Divider />
        <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
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
      </Drawer>
    </>
  );
}
