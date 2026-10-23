/**
 * LINKS MEDIBLES (0195, 23/10/2026, pedido del dueño: «crear un link,
 * compartirlo y ver qué alcance tiene, que quede todo registrado»).
 * ============================================================================
 * Dentro de Tienda online › Métricas, para el modo elegido: se crea un link
 * (nombre, a qué página lleva, por dónde se va a compartir) y se lista con su
 * alcance desde que existe: visitantes, páginas vistas, carrito, quiénes
 * pidieron, pedidos y plata, conversión y última visita; abierto, el día a día
 * y por dónde llegaron. Lo cuenta el navegador del visitante (la API: web/links.ts).
 */
import { useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { env } from '@core/config/env.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, s } from '@modules/productos/components/ui.jsx';
import { Columnas } from '@modules/gerencia/panels/metricas/graficos.jsx';
import { pctTxt } from '@modules/gerencia/panels/metricas/formato.js';
import { Aviso, Bloque } from '@modules/gerencia/panels/metricas/piezas.jsx';

const DESTINOS = [['/', 'La portada'], ['/tienda', 'Toda la tienda'], ['/tienda?oferta=1', 'Las ofertas'], ['otra', 'Otra página (pegá su dirección)']];
const CANALES = [['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['email', 'Correo'], ['otro', 'Otro'], ['', 'Sin decir']];
const nombreCanal = Object.fromEntries(CANALES);
const entero = (v) => num(v, 0);
const fecha = (v) => (v ? new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const urlDe = (l) => `${env.tiendaUrl}/l/${l.codigo}`;
const VACIO = { nombre: '', destino: '/', otra: '', canal: 'whatsapp' };

export function LinksMedibles({ modo }) {
  const [version, setVersion] = useState(0);
  const [nuevo, setNuevo] = useState(VACIO);
  const [msg, setMsg] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [enVuelo, setEnVuelo] = useState(false);
  const { data: links, error } = useResource(`web-links:${modo}:${version}`, () => httpClient.get(`/web/links?modo=${modo}`));
  const recargar = () => setVersion((v) => v + 1);

  const copiar = async (l) => {
    try { await navigator.clipboard.writeText(urlDe(l)); setMsg({ tono: 'info', texto: `Copiado: ${urlDe(l)}` }); } catch { setMsg({ tono: 'warn', texto: 'No se pudo copiar: seleccioná el link y copialo a mano.' }); }
  };
  const crear = async () => {
    if (enVuelo) return;
    setEnVuelo(true); setMsg(null);
    try {
      const l = await httpClient.post('/web/links', {
        nombre: nuevo.nombre.trim(), modo, canal: nuevo.canal,
        destino: nuevo.destino === 'otra' ? nuevo.otra.trim() : nuevo.destino,
      });
      setNuevo(VACIO); recargar();
      await copiar(l);
    } catch (e) { setMsg({ tono: 'warn', texto: errorMsg(e) }); } finally { setEnVuelo(false); }
  };
  const alternar = async (l) => {
    try { await httpClient.patch(`/web/links/${l.id}`, { activo: !l.activo }); recargar(); } catch (e) { setMsg({ tono: 'warn', texto: errorMsg(e) }); }
  };
  const set = (k) => (e) => setNuevo((x) => ({ ...x, [k]: e.target.value }));
  const listo = nuevo.nombre.trim().length >= 2 && (nuevo.destino !== 'otra' || nuevo.otra.trim());

  return (
    <Bloque
      titulo={`Links medibles · tienda ${modo}`}
      sub="Creá un link, compartilo donde quieras y mirá cuántos entraron por él, qué hicieron y cuánto pidieron. Cuenta cada visitante desde su navegador: las vistas previas de WhatsApp o Instagram no suman."
    >
      <div className={s.toolbar} style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input id="link-nombre" value={nuevo.nombre} maxLength={80} onChange={set('nombre')} placeholder="Nombre (ej.: Historia de Instagram · Día de la Madre)" style={{ flex: '2 1 260px', minWidth: 0 }} />
        <select id="link-destino" className={s['select-inline']} value={nuevo.destino} onChange={set('destino')} aria-label="A dónde lleva">
          {DESTINOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {nuevo.destino === 'otra' && (
          <input id="link-otra" value={nuevo.otra} maxLength={400} onChange={set('otra')} placeholder={`${env.tiendaUrl}/producto/…`} style={{ flex: '2 1 260px', minWidth: 0 }} />
        )}
        <select id="link-canal" className={s['select-inline']} value={nuevo.canal} onChange={set('canal')} aria-label="Por dónde lo vas a compartir" title="Por dónde lo vas a compartir">
          {CANALES.map(([v, l]) => <option key={v} value={v}>{v ? `Lo comparto por ${l}` : 'Canal: sin decir'}</option>)}
        </select>
        <Btn variant="btn-primary" small disabled={!listo || enVuelo} onClick={crear}>{enVuelo ? 'Creando…' : 'Crear y copiar link'}</Btn>
      </div>
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
      {error && <Aviso tono="warn">{error}</Aviso>}

      <div style={{ overflowX: 'auto' }}>
        <Table
          cols={[
            { h: 'Link' }, { h: 'Visitantes', num: true }, { h: 'Carrito', num: true }, { h: 'Pidieron', num: true },
            { h: 'Pedidos ($)', num: true }, { h: 'Última visita' }, { h: '', cls: 'actions-col' },
          ]}
          empty={links ? 'Todavía no creaste links para esta tienda.' : 'Cargando…'}
        >
          {(links ?? []).flatMap((l) => {
            const filas = [(
              <tr key={l.id} className={s.clickable} onClick={() => setAbierto(abierto === l.id ? null : l.id)} style={l.activo ? undefined : { opacity: 0.55 }}>
                <td style={{ minWidth: 200 }}>
                  <strong>{l.nombre}</strong> <span className={s.hint} style={{ margin: 0 }}>{abierto === l.id ? '▾' : '▸'}</span>
                  <div className={s.mono} style={{ fontSize: 12 }}>{urlDe(l).replace(/^https?:\/\//, '')}</div>
                  <div className={s.hint} style={{ margin: 0 }}>
                    {nombreCanal[l.canal] ? `${nombreCanal[l.canal]} · ` : ''}lleva a {l.destino} · creado {fecha(l.creadoEn)}{l.creadoPor ? ` por ${l.creadoPor}` : ''}{l.activo ? '' : ' · DESACTIVADO'}
                  </div>
                </td>
                <td className={s.num}><strong>{entero(l.visitantes)}</strong><div className={s.hint} style={{ margin: 0 }}>{entero(l.vistas)} páginas</div></td>
                <td className={s.num}>{entero(l.carrito)}</td>
                <td className={s.num}>{entero(l.pidieron)}<div className={s.hint} style={{ margin: 0 }}>{pctTxt(l.conversion)}</div></td>
                <td className={s.num}>{l.pedidos ? <>{money(l.total)}<div className={s.hint} style={{ margin: 0 }}>{entero(l.pedidos)} pedido(s)</div></> : '—'}</td>
                <td>{fecha(l.ultima)}</td>
                <td className={s['actions-col']} onClick={(e) => e.stopPropagation()}>
                  <div className={s['row-actions']}>
                    <Btn small onClick={() => copiar(l)} disabled={!l.activo}>Copiar</Btn>
                    <Btn small variant={l.activo ? 'btn-delete' : undefined} onClick={() => alternar(l)}>{l.activo ? 'Desactivar' : 'Activar'}</Btn>
                  </div>
                </td>
              </tr>
            )];
            if (abierto === l.id) filas.push(<tr key={`${l.id}-d`}><td colSpan={7}><DetalleLink id={l.id} /></td></tr>);
            return filas;
          })}
        </Table>
      </div>
      <div className={s.hint} style={{ margin: 0 }}>
        «Visitantes» son las visitas que entraron por el link (cada pestaña del navegador cuenta una). Desactivado, el link sigue abriendo la tienda pero ya no suma.
        «Empezar de 0» de esta tienda también pone en cero lo que midieron sus links.
      </div>
    </Bloque>
  );
}

/** El día a día del link y por dónde llegaron sus visitantes. */
function DetalleLink({ id }) {
  const { data: d, error } = useResource(`web-link:${id}`, () => httpClient.get(`/web/links/${id}`));
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <div className={s.hint}>Cargando…</div>;
  if (!d.porDia.length) return <div className={s.hint} style={{ margin: 0 }}>Todavía nadie entró por este link.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
      <div className={cx(s.card, s.cardPad)}>
        <div className={s['mini-label']}>Visitantes por día</div>
        <Columnas datos={d.porDia.map((x) => ({ etiqueta: x.dia.slice(8, 10) + '/' + x.dia.slice(5, 7), valor: x.visitantes, detalle: `${x.dia.split('-').reverse().join('/')}: ${entero(x.visitantes)} visitante(s)` }))} formato={entero} eje={entero} alto={150} />
      </div>
      <div className={cx(s.card, s.cardPad)}>
        <div className={s['mini-label']}>Por dónde llegaron</div>
        {d.porOrigen.map((o) => (
          <div key={o.origen} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
            <span>{o.nombre}</span><strong>{entero(o.visitantes)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
