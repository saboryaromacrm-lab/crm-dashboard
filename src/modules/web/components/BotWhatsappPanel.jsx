/**
 * TIENDA ONLINE › BOT DE WHATSAPP (0237, 19/11/2026, pedido del dueño)
 * ============================================================================
 * El vendedor con IA del WhatsApp de ventas (la API: `crm-api/src/whatsapp`).
 *
 *   · PROBAR: un chat como si uno fuera el cliente (minorista, o mayorista ya
 *     verificado). Es el mismo cerebro que contesta los WhatsApp reales.
 *   · CONVERSACIONES: las charlas reales; tomar una a mano (la IA se calla),
 *     devolvérsela a la IA, o marcar el número como «sin IA».
 *   · CONFIGURACIÓN: si contesta, con qué modelo, las instrucciones del dueño,
 *     los números sin IA (personal, proveedores), la pausa y el tope de gasto.
 *
 * Lo de Meta (token, número) vive en el servidor, nunca acá.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { httpClient } from '@core/services/httpClient.js';
import { cx } from '@shared/utils/classNames.js';
import { fmtFechaHora } from '@modules/productos/domain/format.js';
import { PanelHead, Btn, Pill, Table, s } from '@modules/productos/components/ui.jsx';
import { telLegible } from '@modules/ventas/domain/constants.js';

const api = {
  estado: () => httpClient.get('/whatsapp/estado'),
  config: () => httpClient.get('/whatsapp/config'),
  guardar: (c) => httpClient.put('/whatsapp/config', c),
  prueba: () => httpClient.get('/whatsapp/prueba'),
  /* La IA puede tardar (busca en el catálogo antes de contestar): más plazo que el de siempre. */
  probar: (texto) => httpClient.post('/whatsapp/prueba', { texto }, { timeoutMs: 120_000 }),
  reiniciar: (mayorista) => httpClient.post('/whatsapp/prueba/reiniciar', { mayorista }),
  chats: () => httpClient.get('/whatsapp/chats'),
  chat: (id) => httpClient.get(`/whatsapp/chats/${id}`),
  pausa: (id, horas) => httpClient.post(`/whatsapp/chats/${id}/pausa`, { horas }),
  sinIa: (id) => httpClient.post(`/whatsapp/chats/${id}/sin-ia`, {}),
};
const error = (e, def) => e?.data?.message || def;
const usd = (n) => `US$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MODELOS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — rápido y económico (recomendado para empezar)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — vende mejor, unas 10 veces más caro' },
];
const PESTANAS = [
  { id: 'probar', label: 'Probar' },
  { id: 'charlas', label: 'Conversaciones' },
  { id: 'config', label: 'Configuración' },
];

/* ============================== la charla ============================== */

const QUIEN = { cliente: 'Cliente', bot: 'Bot', humano: 'Persona del local' };

function Burbujas({ mensajes, escribiendo }) {
  const fin = useRef(null);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [mensajes.length, escribiendo]);
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, padding: 12, minHeight: 260, maxHeight: 460, overflowY: 'auto',
        background: 'var(--crm-color-surface-2)', borderRadius: 8, border: '1px solid var(--crm-color-border)',
      }}
    >
      {!mensajes.length && !escribiendo && <div className={s.hint} style={{ margin: 'auto' }}>Escribí como si fueras un cliente.</div>}
      {mensajes.map((m) => {
        const propio = m.rol === 'cliente';
        return (
          <div key={m.id} style={{ alignSelf: propio ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
            <div
              style={{
                whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '8px 12px', borderRadius: 10, fontSize: 14, lineHeight: 1.45,
                background: propio ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface)',
                border: `1px solid ${m.rol === 'humano' ? 'var(--crm-color-warning)' : 'var(--crm-color-border)'}`,
              }}
            >
              {m.texto}
            </div>
            <div className={s.hint} style={{ margin: '2px 4px 0', textAlign: propio ? 'right' : 'left' }}>
              {QUIEN[m.rol]} · {fmtFechaHora(m.creadoEn)}
              {m.error && <span style={{ color: 'var(--crm-color-danger)' }}> · No se mandó: {m.error}</span>}
            </div>
          </div>
        );
      })}
      {escribiendo && <div className={s.hint} style={{ alignSelf: 'flex-start', margin: 0 }}>El bot está escribiendo…</div>}
      <div ref={fin} />
    </div>
  );
}

function Derivada({ chat }) {
  if (!chat?.derivadoEn) return null;
  return (
    <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
      <strong>Pasada a una persona</strong> ({fmtFechaHora(chat.derivadoEn)}): {chat.derivadoMotivo || 'sin motivo'}.
    </div>
  );
}

/* ============================== probar ============================== */

function Probar({ avisar, iaLista }) {
  const [charla, setCharla] = useState(null);
  const [texto, setTexto] = useState('');
  const [enVuelo, setEnVuelo] = useState(false);
  const [pendiente, setPendiente] = useState(null);

  useEffect(() => { api.prueba().then(setCharla).catch((e) => avisar('err', error(e, 'No se pudo abrir el chat de prueba.'))); }, [avisar]);

  const mandar = async (ev) => {
    ev?.preventDefault();
    const t = texto.trim();
    if (!t || enVuelo) return;
    setTexto('');
    setPendiente({ id: 'pendiente', rol: 'cliente', texto: t, creadoEn: new Date().toISOString() });
    setEnVuelo(true);
    try {
      setCharla(await api.probar(t));
    } catch (e) {
      setTexto(t);
      avisar('err', error(e, 'El bot no respondió.'));
    } finally {
      setPendiente(null);
      setEnVuelo(false);
    }
  };

  const reiniciar = async (mayorista) => {
    try {
      setCharla(await api.reiniciar(mayorista));
    } catch (e) {
      avisar('err', error(e, 'No se pudo empezar de nuevo.'));
    }
  };

  const mensajes = [...(charla?.mensajes ?? []), ...(pendiente ? [pendiente] : [])];
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
      {!iaLista && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          Falta la clave de la IA en el servidor (ANTHROPIC_API_KEY): sin ella el bot no puede contestar.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={s.hint} style={{ margin: 0, flex: '1 1 240px' }}>
          Probando como <strong>{charla?.chat?.mayorista ? 'mayorista verificado' : 'cliente minorista'}</strong>
          {charla?.costo > 0 && <> · esta charla costó {usd(charla.costo)}</>}
        </span>
        <Btn small onClick={() => reiniciar(false)} disabled={enVuelo}>Empezar de nuevo (minorista)</Btn>
        <Btn small onClick={() => reiniciar(true)} disabled={enVuelo}>Empezar de nuevo (mayorista verificado)</Btn>
      </div>
      <Burbujas mensajes={mensajes} escribiendo={enVuelo} />
      <Derivada chat={charla?.chat} />
      <form onSubmit={mandar} style={{ display: 'flex', gap: 8 }}>
        <input
          id="bot-prueba-texto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} autoComplete="off"
          placeholder="Ej: hola, ¿tienen almendras? ¿a cuánto el kilo?" style={{ flex: 1 }} aria-label="Mensaje de prueba"
        />
        <Btn variant="btn-primary" type="submit" disabled={enVuelo || !texto.trim()}>{enVuelo ? 'Esperando…' : 'Enviar'}</Btn>
      </form>
      <div className={s.hint} style={{ margin: 0 }}>
        Es el mismo bot que contesta los WhatsApp reales, con los precios, ofertas y stock de la tienda en este momento.
        Lo que cambies en Configuración vale desde el próximo mensaje.
      </div>
    </div>
  );
}

/* ============================== conversaciones ============================== */

function estadoChat(c) {
  if (c.pausada) return { pill: 'est-pendiente', label: c.derivadoEn ? 'Pasada a una persona' : 'La atiende una persona' };
  return { pill: 'st-disponible', label: 'Contesta el bot' };
}

function Charlas({ avisar }) {
  const [chats, setChats] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [enVuelo, setEnVuelo] = useState(false);

  const cargar = useCallback(() => api.chats().then(setChats).catch((e) => avisar('err', error(e, 'No se pudieron cargar las conversaciones.'))), [avisar]);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30_000);
    return () => clearInterval(t);
  }, [cargar]);

  const abrir = async (id) => {
    try { setAbierta(await api.chat(id)); } catch (e) { avisar('err', error(e, 'No se pudo abrir la conversación.')); }
  };
  const accion = async (f, ok) => {
    if (enVuelo) return;
    setEnVuelo(true);
    try {
      const r = await f();
      if (r?.chat) setAbierta(r); else setAbierta(null);
      avisar('ok', ok);
      cargar();
    } catch (e) {
      avisar('err', error(e, 'No se pudo hacer.'));
    } finally {
      setEnVuelo(false);
    }
  };

  if (abierta) {
    const c = abierta.chat;
    return (
      <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn small onClick={() => setAbierta(null)}>← Volver</Btn>
          <strong style={{ flex: '1 1 200px' }}>
            {c.nombre || 'Sin nombre'} · {c.telefono ? telLegible(c.telefono) : `+${c.waId}`}{c.mayorista ? ' · mayorista' : ''}
          </strong>
          <Pill {...estadoChat(c)} />
        </div>
        <Burbujas mensajes={abierta.mensajes} />
        <Derivada chat={c} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {c.pausada
            ? <Btn variant="btn-primary" disabled={enVuelo} onClick={() => accion(() => api.pausa(c.id, 0), 'El bot vuelve a contestar esta charla.')}>Devolverle la charla al bot</Btn>
            : <Btn disabled={enVuelo} onClick={() => accion(() => api.pausa(c.id, 12), 'El bot no contesta esta charla por 12 horas.')}>La tomo yo (el bot se calla 12 h)</Btn>}
          <Btn
            disabled={enVuelo}
            onClick={() => window.confirm('¿Este número es del personal o de un proveedor? El bot no le va a contestar nunca más y se borra esta conversación.')
              && accion(() => api.sinIa(c.id), 'Listo: el bot no le contesta más a ese número.')}
          >
            No usar el bot con este número
          </Btn>
        </div>
        <div className={s.hint} style={{ margin: 0 }}>
          Para contestar, usá WhatsApp Business en el celular: cuando alguien del local escribe, el bot se calla solo en esa charla.
          {abierta.costo > 0 && <> Esta conversación costó {usd(abierta.costo)} de IA.</>}
        </div>
      </div>
    );
  }

  if (!chats) return <div className={s['empty-state']}>Cargando…</div>;
  return (
    <Table cols={[{ h: 'Cliente' }, { h: 'Último mensaje' }, { h: 'Estado' }, { h: 'Cuándo' }]} empty="Todavía no hay conversaciones reales.">
      {chats.map((c) => {
        const est = estadoChat(c);
        return (
          <tr key={c.id} onClick={() => abrir(c.id)} style={{ cursor: 'pointer' }}>
            <td>
              <strong>{c.nombre || 'Sin nombre'}</strong>
              <div className={s.hint} style={{ margin: 0 }}>{c.telefono ? telLegible(c.telefono) : `+${c.waId}`}{c.mayorista ? ' · mayorista' : ''}</div>
            </td>
            <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ultimo}</td>
            <td><Pill {...est} /></td>
            <td>{fmtFechaHora(c.ultimoMensajeEn)}</td>
          </tr>
        );
      })}
    </Table>
  );
}

/* ============================== configuración ============================== */

function Configuracion({ avisar, estado, alGuardar }) {
  const [guardada, setGuardada] = useState(null);
  const [d, setD] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.config().then((c) => { setGuardada(c); setD(c); }).catch((e) => avisar('err', error(e, 'No se pudo cargar la configuración del bot.')));
  }, [avisar]);
  if (!d) return <div className={s['empty-state']}>Cargando…</div>;

  const cambiar = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const numeros = d.numerosSinIa;
  const cambiarNumero = (i, k, v) => cambiar('numerosSinIa', numeros.map((n, j) => (j === i ? { ...n, [k]: v } : n)));
  const sucio = JSON.stringify(d) !== JSON.stringify(guardada);

  const guardar = async () => {
    setGuardando(true);
    try {
      const c = await api.guardar({ ...d, numerosSinIa: numeros.filter((n) => n.numero.trim()) });
      setGuardada(c); setD(c);
      avisar('ok', 'Configuración del bot guardada.');
      alGuardar();
    } catch (e) {
      avisar('err', error(e, 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--crm-space-3)', maxWidth: 820 }}>
      <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, cursor: estado?.meta ? 'pointer' : 'not-allowed' }}>
          <input type="checkbox" id="bot-activo" checked={d.activo} disabled={!estado?.meta && !d.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
          El bot contesta los WhatsApp de los clientes
        </label>
        {!estado?.meta && (
          <div className={s.hint} style={{ margin: 0 }}>
            Todavía no está conectado a WhatsApp (faltan los datos de Meta en el servidor). Mientras tanto se prueba en «Probar».
          </div>
        )}
        <div className={s.field} style={{ margin: 0 }}>
          <label htmlFor="bot-modelo">Modelo de IA</label>
          <select id="bot-modelo" value={d.modelo} onChange={(e) => cambiar('modelo', e.target.value)}>
            {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 8 }}>
        <div className={s['section-title']} style={{ margin: 0 }}>Instrucciones para el bot</div>
        <div className={s.hint} style={{ margin: 0 }}>
          Cómo atender y vender, con tus palabras: el tono, qué recomendar, políticas, medios de pago, lo que siempre hay que aclarar.
          Lo demás ya lo sabe solo y al día: los locales y horarios (Sistema › Horarios), quiénes somos y las preguntas frecuentes
          (Tienda online › Configuración), los mínimos y envíos de cada tienda, y los precios, ofertas y stock en el momento.
          Lo que nunca hace, aunque lo escribas acá: inventar un precio, dar el mayorista a quien no está verificado o tomar un pedido.
        </div>
        <textarea id="bot-instrucciones" rows={14} value={d.instrucciones} maxLength={12000} onChange={(e) => cambiar('instrucciones', e.target.value)} />
      </div>

      <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 8 }}>
        <div className={s['section-title']} style={{ margin: 0 }}>Números sin bot</div>
        <div className={s.hint} style={{ margin: 0 }}>
          El personal, proveedores, conocidos: el bot no les contesta y sus mensajes no se guardan acá. También se agregan desde una conversación.
        </div>
        {numeros.map((n, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input aria-label="Nombre" placeholder="Quién es (ej: Juan, depósito)" value={n.nombre} maxLength={60} onChange={(e) => cambiarNumero(i, 'nombre', e.target.value)} style={{ flex: '1 1 200px' }} />
            <input aria-label="WhatsApp" placeholder="370 4123456" value={n.numero} inputMode="tel" onChange={(e) => cambiarNumero(i, 'numero', e.target.value)} style={{ flex: '1 1 160px' }} />
            <Btn small variant="btn-ghost" onClick={() => cambiar('numerosSinIa', numeros.filter((_, j) => j !== i))}>Quitar</Btn>
          </div>
        ))}
        <div><Btn small onClick={() => cambiar('numerosSinIa', [...numeros, { nombre: '', numero: '' }])}>Agregar número</Btn></div>
      </div>

      <div className={cx(s.card, s.cardPad)} style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div className={s.field} style={{ margin: 0, flex: '1 1 220px' }}>
          <label htmlFor="bot-pausa">Cuando contesta una persona, el bot se calla (horas)</label>
          <input id="bot-pausa" type="number" min="1" max="72" value={d.horasPausaHumano} onChange={(e) => cambiar('horasPausaHumano', Number(e.target.value) || 1)} />
        </div>
        <div className={s.field} style={{ margin: 0, flex: '1 1 220px' }}>
          <label htmlFor="bot-tope">Tope de gasto de IA por mes (US$)</label>
          <input id="bot-tope" type="number" min="1" max="1000" value={d.topeGastoMesUsd} onChange={(e) => cambiar('topeGastoMesUsd', Number(e.target.value) || 1)} />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Llegado al tope, pasa las charlas a una persona. Este mes: {usd(estado?.gastoMes)}.</div>
        </div>
        <div className={s.field} style={{ margin: 0, flex: '1 1 260px' }}>
          <label htmlFor="bot-link">Link de la tienda</label>
          <input id="bot-link" value={d.linkTienda} onChange={(e) => cambiar('linkTienda', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={() => setD(guardada)} disabled={!sucio || guardando}>Descartar</Btn>
        <Btn variant="btn-primary" onClick={guardar} disabled={!sucio || guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Btn>
      </div>
    </div>
  );
}

/* ============================== el panel ============================== */

export function BotWhatsappPanel({ avisar }) {
  const [tab, setTab] = useState('probar');
  const [estado, setEstado] = useState(null);
  const cargarEstado = useCallback(() => api.estado().then(setEstado).catch(() => setEstado(null)), []);
  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  const chips = estado && [
    estado.activo && estado.meta ? { pill: 'st-disponible', label: 'Contestando los WhatsApp' } : { pill: 'est-pendiente', label: estado.meta ? 'Apagado' : 'Sin conectar a WhatsApp' },
    estado.ia ? null : { pill: 'est-cancelada', label: 'Falta la clave de la IA' },
  ].filter(Boolean);

  return (
    <div>
      <PanelHead
        title="Bot de WhatsApp"
        desc="Un vendedor con IA para el WhatsApp de ventas: responde con los precios, ofertas y stock de la tienda en el momento, y pasa a una persona lo que no puede resolver."
        actions={chips && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chips.map((c) => <Pill key={c.label} {...c} />)}</div>}
      />
      <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40, mb: 2 }}>
        {PESTANAS.map((t) => <Tab key={t.id} value={t.id} label={t.label} sx={{ minHeight: 40, textTransform: 'none' }} />)}
      </Tabs>
      {tab === 'probar' && <Probar avisar={avisar} iaLista={estado?.ia !== false} />}
      {tab === 'charlas' && <Charlas avisar={avisar} />}
      {tab === 'config' && <Configuracion avisar={avisar} estado={estado} alGuardar={cargarEstado} />}
    </div>
  );
}
