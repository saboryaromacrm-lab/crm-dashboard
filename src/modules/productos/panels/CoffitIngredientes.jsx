/**
 * ALMACÉN › COFFIT › INGREDIENTES (0140, 6/10/2026, pedido del dueño)
 * ============================================================================
 * Los productos que Coffit usa como ingrediente con su costo POR UNIDAD DE
 * MEDIDA (por kg, 100 g, litro…), para costear recetas. Se configura UNA vez
 * lo que trae el envase; el costo lo calcula el servidor del último
 * comprobante con precio real (factura con IVA, remito sin IVA, saltando los
 * precios «a confirmar» como las hormas a $0,10), así se actualiza solo.
 *
 * COFFITCOST (0141, 7/10/2026): los costos viajan a la app de recetas con el
 * nombre que tiene ahí cada ingrediente; solos cuando cambia alguno, o con
 * «Enviar ahora». El recuadro de arriba dice cómo salió el último envío.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { useResource } from '@modules/gastos/hooks/useResource.js';
import { money, fmtFecha } from '../domain/format.js';
import { BuscadorCatalogo } from '../components/modals/CafeteriaModals.jsx';
import { Table, Btn, s } from '../components/ui.jsx';

const ETIQUETA_COSTO = { kg: 'kg', g: 'g', '100g': '100 g', l: 'litro', ml: 'ml', '100ml': '100 ml', u: 'unidad', doc: 'docena' };
const OPC_MASA = [['kg', 'por kg'], ['100g', 'por 100 g'], ['g', 'por gramo']];
const OPC_VOLUMEN = [['l', 'por litro'], ['100ml', 'por 100 ml'], ['ml', 'por ml']];
const TIPO_DOC = { factura: 'Factura', liquidacion: 'Liquidación', remito: 'Remito' };
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nroDoc = (c) => `${TIPO_DOC[c.tipo] ?? c.tipo}${c.tipo === 'remito' ? '' : ` ${c.letra}`} ${c.numero}`;
const fmtContenido = (n, u) => `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${u === 'l' ? 'L' : u}`;

/** Las opciones de «costo por» que tienen sentido para ese producto y ese contenido. */
function opcionesCosto(tipo, contenidoUnidad) {
  if (tipo === 'granel') return OPC_MASA;
  const liquido = contenidoUnidad === 'ml' || contenidoUnidad === 'l';
  return [...(liquido ? OPC_VOLUMEN : OPC_MASA), ['u', 'por unidad (sin convertir)'], ['doc', 'por docena']];
}

function FormIngrediente({ store, inicial, onListo, onCancelar, toast }) {
  const [prod, setProd] = useState(() => (inicial ? { id: inicial.productoId, nombre: inicial.nombre, tipo: inicial.tipo } : null));
  const [contenido, setContenido] = useState(inicial?.contenido != null ? String(inicial.contenido) : '');
  const [contUnidad, setContUnidad] = useState(inicial?.contenidoUnidad ?? 'g');
  const [unidadCosto, setUnidadCosto] = useState(inicial?.unidadCosto ?? 'kg');
  const [nota, setNota] = useState(inicial?.nota ?? '');
  /* El nombre EN CoffitCost: tiene que coincidir con el de allá (sin importar mayúsculas ni tildes). */
  const [nombreCoffit, setNombreCoffit] = useState(inicial?.nombreCoffit ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const granel = prod?.tipo === 'granel';
  const opciones = opcionesCosto(prod?.tipo, contUnidad);
  /* Si cambia la unidad del contenido (g ↔ ml), la del costo tiene que acompañar. */
  const unidadValida = opciones.some(([k]) => k === unidadCosto) ? unidadCosto : opciones[0][0];

  const guardar = async () => {
    setError('');
    if (!prod) { setError('Elegí el producto.'); return; }
    if (!granel && unidadValida !== 'u' && unidadValida !== 'doc' && !(Number(contenido) > 0)) { setError('Poné cuánto trae el envase (por ejemplo 200 g o 1 L).'); return; }
    if (guardando) return;
    setGuardando(true);
    try {
      const cuerpo = {
        contenido: granel ? undefined : (contenido === '' ? null : Number(contenido)),
        contenidoUnidad: contUnidad, unidadCosto: unidadValida, nota: nota.trim(), nombreCoffit: nombreCoffit.trim(),
      };
      if (inicial) await httpClient.patch(`/cafeteria/ingredientes/${inicial.id}`, cuerpo);
      else await httpClient.post('/cafeteria/ingredientes', { productoId: prod.id, ...cuerpo });
      toast(inicial ? 'Ingrediente actualizado.' : `«${prod.nombre}» agregado a los ingredientes.`, 'ok');
      onListo();
    } catch (e) {
      setError(e?.data?.message ? [].concat(e.data.message).join(' ') : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={cx(s.card)} style={{ padding: 14, display: 'grid', gap: 12 }}>
      <strong>{inicial ? `Editar «${inicial.nombre}»` : 'Agregar un ingrediente'}</strong>
      {!inicial && (
        prod
          ? <div>Producto: <strong>{prod.nombre}</strong>{granel && <span className={s.muted}> · a granel</span>} <Btn small onClick={() => setProd(null)}>Cambiar</Btn></div>
          : <BuscadorCatalogo store={store} onElegir={(p) => setProd(p)} autoFocus />
      )}
      {prod && (
        <div className={s['form-grid']}>
          {granel ? (
            <div className={s.field}>
              <label>Contenido</label>
              <div className={s.hint} style={{ margin: 0 }}>A granel: el costo ya viene por kg, no hace falta el envase.</div>
            </div>
          ) : (
            <div className={s.field}>
              <label>Qué trae el envase</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" min="0" step="any" value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="200" style={{ width: 110 }} aria-label="Contenido del envase" />
                <select value={contUnidad} onChange={(e) => setContUnidad(e.target.value)} aria-label="Unidad del contenido">
                  <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option>
                </select>
              </div>
            </div>
          )}
          <div className={s.field}>
            <label>Costo</label>
            <select value={unidadValida} onChange={(e) => setUnidadCosto(e.target.value)} aria-label="Unidad del costo">
              {opciones.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label>Nombre en CoffitCost</label>
            <input value={nombreCoffit} maxLength={120} onChange={(e) => setNombreCoffit(e.target.value)} placeholder={prod.nombre} aria-label="Nombre en CoffitCost" />
            <div className={s.hint} style={{ margin: '4px 0 0' }}>Igual que en CoffitCost (por ejemplo «Manteca»). Vacío = el nombre del producto.</div>
          </div>
          <div className={s.field}>
            <label>Nota</label>
            <input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Opcional (por ejemplo: para la masa de las medialunas)" />
          </div>
        </div>
      )}
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn small onClick={onCancelar} disabled={guardando}>Cancelar</Btn>
        <Btn small variant="btn-primary" onClick={guardar} disabled={guardando || !prod}>{guardando ? 'Guardando…' : 'Guardar'}</Btn>
      </div>
    </div>
  );
}

/** Cómo va el envío a CoffitCost: si está configurado, el último envío y el botón «Enviar ahora». */
function EstadoCoffitcost({ version, onEnviado, toast }) {
  const { data: e, reload } = useResource(`coffitcost:${version}`, () => httpClient.get('/cafeteria/ingredientes/coffitcost'));
  const [enviando, setEnviando] = useState(false);
  if (!e) return null;
  const ultimo = e.envios?.[0];
  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await httpClient.post('/cafeteria/ingredientes/coffitcost/enviar');
      toast(r.ok ? `${r.referencia}: ${r.cantidad} costos enviados a CoffitCost.` : `${r.referencia}: CoffitCost contestó con error (${r.estadoHttp ?? 'sin respuesta'}).`, r.ok ? 'ok' : 'err');
      reload(); onEnviado?.();
    } catch (er) {
      toast(er?.data?.message ? [].concat(er.data.message).join(' ') : 'No se pudo enviar.', 'err');
    } finally { setEnviando(false); }
  };
  const resumen = (txt) => { try { const d = JSON.parse(txt); return typeof d === 'object' ? JSON.stringify(d) : String(txt); } catch { return String(txt || ''); } };
  return (
    <div className={cx(s.callout, !e.configurado || (ultimo && !ultimo.ok) ? s.warn : s.info)} style={{ margin: 0, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 320px' }}>
        <strong>CoffitCost</strong>{' '}
        {!e.configurado ? (
          <>— falta la <strong>clave</strong> en el servidor (variable <code>COFFITCOST_API_KEY</code> en Dokploy). Hasta que esté, no se manda nada.</>
        ) : ultimo ? (
          <>
            — último envío <strong>{ultimo.referencia || '—'}</strong> el {fmtFecha(ultimo.fecha)} {new Date(ultimo.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{ultimo.cantidad} costos · {ultimo.origen === 'automatico' ? 'automático' : 'a mano'} · {ultimo.ok ? <strong>salió bien</strong> : <strong>falló</strong>}
            {!ultimo.ok && <div className={s.hint} style={{ margin: '2px 0 0' }}>{ultimo.estadoHttp ? `CoffitCost contestó ${ultimo.estadoHttp}: ` : ''}{resumen(ultimo.respuesta).slice(0, 220)}</div>}
            {ultimo.ok && ultimo.respuesta && <div className={s.hint} style={{ margin: '2px 0 0' }}>Respuesta: {resumen(ultimo.respuesta).slice(0, 220)}</div>}
          </>
        ) : <>— todavía no se mandó nada.</>}
        <div className={s.hint} style={{ margin: '2px 0 0' }}>
          {e.paraMandar} ingrediente{e.paraMandar === 1 ? '' : 's'} con costo para mandar{e.sinCosto ? ` · ${e.sinCosto} sin costo (no se mandan)` : ''}.
          {e.configurado && (e.cambiosSinMandar ? ' Hay costos nuevos sin mandar: salen solos en los próximos 15 minutos.' : ' CoffitCost tiene los costos al día.')}
        </div>
      </div>
      {e.configurado && <Btn small variant="btn-primary" onClick={enviar} disabled={enviando || !e.paraMandar}>{enviando ? 'Enviando…' : 'Enviar ahora'}</Btn>}
    </div>
  );
}

export function CoffitIngredientes() {
  const { store, toast } = useProductos();
  const { data, loading, error, reload } = useResource('coffit-ingredientes', () => httpClient.get('/cafeteria/ingredientes'));
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null); // null | 'nuevo' | fila
  const [quitando, setQuitando] = useState(null);
  /* Cada cambio de la lista vuelve a pedir el estado de CoffitCost (los «cambios sin mandar»). */
  const [version, setVersion] = useState(0);
  const recargar = () => { reload(); setVersion((v) => v + 1); };
  const filas = useMemo(() => {
    const t = sinTildes(q.trim());
    return (data ?? []).filter((f) => !t || sinTildes(`${f.nombre} ${f.marca} ${f.codigo}`).includes(t));
  }, [data, q]);
  const conAviso = (data ?? []).filter((f) => f.aConfirmar?.length || f.costoBase == null).length;

  const quitar = async (f) => {
    if (quitando !== f.id) { setQuitando(f.id); return; }
    try {
      await httpClient.delete(`/cafeteria/ingredientes/${f.id}`);
      toast(`«${f.nombre}» ya no es ingrediente (el producto no se toca).`, 'ok');
      setQuitando(null);
      recargar();
    } catch { toast('No se pudo quitar.', 'err'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
        El costo de cada ingrediente <strong>tal cual se lo cobran a Sabor y Aroma</strong>: el último comprobante con precio
        real — factura <strong>con IVA</strong>, remito <strong>sin IVA</strong>, con sus descuentos — convertido a la unidad que
        elijas. Se actualiza solo con cada factura. Un precio «a confirmar» (como las hormas a $0,10) no cuenta: sigue el anterior.
      </div>
      <EstadoCoffitcost version={version} toast={toast} />
      <div className={s.toolbar} style={{ margin: 0 }}>
        <input type="search" placeholder="Buscar ingrediente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ingrediente" />
        {conAviso > 0 && <span className={s.hint} style={{ margin: 0, color: 'var(--crm-color-warning)', fontWeight: 600 }}>{conAviso} con aviso</span>}
        <div style={{ marginLeft: 'auto' }}>
          {!form && <Btn variant="btn-primary" small onClick={() => setForm('nuevo')}>+ Agregar ingrediente</Btn>}
        </div>
      </div>
      {form && (
        <FormIngrediente
          key={form === 'nuevo' ? 'nuevo' : form.id}
          store={store} toast={toast}
          inicial={form === 'nuevo' ? null : form}
          onListo={() => { setForm(null); recargar(); }}
          onCancelar={() => setForm(null)}
        />
      )}
      {error && <div className={cx(s.callout, s.warn)}>No se pudieron cargar los ingredientes: {error}</div>}
      <Table
        cols={[{ h: 'Ingrediente' }, { h: 'Costo del envase', num: true }, { h: 'Costo convertido', num: true }, { h: 'De dónde sale' }, { h: '', cls: 'actions-col' }]}
        empty={loading ? 'Cargando…' : 'Todavía no hay ingredientes: «+ Agregar ingrediente» para el primero.'}
      >
        {filas.map((f) => (
          <tr key={f.id}>
            <td>
              <strong>{f.nombre}</strong>
              <div className={s.hint} style={{ margin: 0 }}>
                {[f.marca, f.tipo === 'granel' ? 'a granel' : (f.contenido ? `envase de ${fmtContenido(f.contenido, f.contenidoUnidad)}` : null), f.nota].filter(Boolean).join(' · ')}
              </div>
              <div className={s.hint} style={{ margin: 0 }}>en CoffitCost: <strong>{f.nombreCoffit || f.nombre}</strong></div>
            </td>
            <td className={s.num}>
              {f.costoBase == null ? <span className={s.muted}>—</span> : (
                <>
                  {money(f.costoBase)}<span className={s.muted}>{f.tipo === 'granel' ? ' /kg' : ' /u.'}</span>
                  <div className={s.hint} style={{ margin: 0 }}>{f.conIva ? 'con IVA' : 'sin IVA'}</div>
                </>
              )}
            </td>
            <td className={s.num}>
              {f.costoConvertido == null
                ? <span className={s.muted}>{f.costoBase == null ? 'sin costo' : '—'}</span>
                : <><strong style={{ fontSize: 16 }}>{money(f.costoConvertido)}</strong><span className={s.muted}> /{ETIQUETA_COSTO[f.unidadCosto]}</span></>}
            </td>
            <td>
              {f.comprobante
                ? (
                  <>
                    {nroDoc(f.comprobante)}
                    <div className={s.hint} style={{ margin: 0 }}>{[f.comprobante.proveedor, fmtFecha(f.comprobante.fecha)].filter(Boolean).join(' · ')}</div>
                  </>
                )
                : <span className={s.hint} style={{ margin: 0 }}>Todavía no hay una compra con precio de este producto.</span>}
              {f.aConfirmar?.length > 0 && (
                <div className={s.hint} style={{ margin: '2px 0 0', color: 'var(--crm-color-warning)', fontWeight: 600 }}>
                  Precio a confirmar en {nroDoc(f.aConfirmar.at(-1))} ({money(f.aConfirmar.at(-1).precio)}): se sigue usando este.
                </div>
              )}
            </td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                <Btn small onClick={() => { setQuitando(null); setForm(f); }}>Editar</Btn>
                <Btn small variant="btn-delete" onClick={() => quitar(f)}>{quitando === f.id ? 'Sí, quitar' : 'Quitar'}</Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
