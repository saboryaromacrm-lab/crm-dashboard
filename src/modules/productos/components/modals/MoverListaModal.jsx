/**
 * PASAR ARTÍCULOS DE UNA LISTA A OTRA (28/9/2026, pedido del dueño)
 * ============================================================================
 * Se abre desde la tarjeta de una lista en Márgenes. Se tildan los artículos
 * (todos por defecto, o por valor de markup, o de a uno), se elige el destino
 * y se ve TODO antes de tocar nada: cuáles se mueven, cuáles ya estaban en el
 * destino (manda el destino, reglas del dueño), a cuáles les cambia el precio
 * de góndola y quién más usa la lista de origen. Después, segunda
 * confirmación. "Son datos muy importantes, no puede haber errores".
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num } from '../../domain/format.js';
import { filasDeMargenes, planMoverLista } from '../../domain/margenes.js';
import { ModalShell } from '../Modal.jsx';
import { Btn, Table, usePaginado, s } from '../ui.jsx';

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const valorDe = (f) => (f.modoPrecio === 'precio' ? 'Precio definido' : `${num(f.markup, f.markup % 1 ? 1 : 0)}%`);

export function MoverListaModal({ origenId, origen = '', filas = [] }) {
  const { store, closeModal, toast } = useProductos();
  const catalogo = store.state.listasCatalogo ?? { listas: [] };
  const activas = (catalogo.listas ?? []).filter((l) => l.activa).sort((a, b) => a.orden - b.orden);
  const baseId = Number(store.state.configVentas?.listaBaseId) || activas[0]?.id;

  /* Lo que se ofrece mover: las filas de ESTA lista con los filtros puestos en Márgenes. */
  const candidatas = useMemo(() => filas.filter((f) => f.listaId === origenId), [filas, origenId]);
  /* Para decidir hay que mirar el catálogo ENTERO: si el artículo ya está en
     el destino se sabe por sus otras filas, que el filtro pudo haber escondido. */
  const todas = useMemo(() => filasDeMargenes(store.state.productos), [store.state.productos]);

  const [seleccion, setSeleccion] = useState(() => new Set(candidatas.map((f) => f.filaId)));
  const [destinoId, setDestinoId] = useState('');
  const [q, setQ] = useState('');
  const [uso, setUso] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);

  useEffect(() => {
    let vivo = true;
    store.usoLista(origenId).then((u) => { if (vivo) setUso(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [store, origenId]);

  const destino = activas.find((l) => l.id === Number(destinoId)) || null;
  const plan = useMemo(
    () => (destino ? planMoverLista(todas, { origenId, destino, seleccion, baseId }) : null),
    [todas, origenId, destino, seleccion, baseId],
  );

  /* Tildar por valor: "todos los que están al 55%". */
  const porValor = useMemo(() => {
    const m = new Map();
    for (const f of candidatas) {
      const k = valorDe(f);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f.filaId);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [candidatas]);

  const visibles = useMemo(() => {
    const ql = norm(q.trim());
    return ql ? candidatas.filter((f) => norm(f.producto).includes(ql)) : candidatas;
  }, [candidatas, q]);
  const pag = usePaginado(visibles, 'mover-lista', q);

  const cambiar = (fn) => { setConfirmando(false); setSeleccion((prev) => fn(new Set(prev))); };
  const tildar = (ids, on) => cambiar((s2) => { ids.forEach((id) => (on ? s2.add(id) : s2.delete(id))); return s2; });

  const esBaseOrigen = origenId === baseId;
  const total = seleccion.size;

  const mover = async () => {
    if (!confirmando) { setConfirmando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    const res = await store.moverLista({ origenId, destinoId: destino.id, filaIds: [...seleccion] });
    setGuardando(false);
    enVuelo.current = false;
    if (!res.ok) { setConfirmando(false); toast(res.error || 'No se pudo mover.', 'err'); return; }
    toast(`${num(res.movidos, 0)} movido(s) a ${destino.etiqueta}${res.yaEstaban ? ` · ${num(res.yaEstaban, 0)} ya estaban ahí (se respetó su markup)` : ''}.`, 'ok');
    closeModal();
  };

  const listo = destino && total > 0 && !esBaseOrigen;
  const footer = [
    { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
    {
      texto: guardando ? 'Moviendo…' : confirmando ? 'Sí, mover' : `Mover ${num(total, 0)} artículo(s)…`,
      clase: 'btn-primary',
      onClick: guardando || !listo ? () => {} : mover,
    },
  ];

  if (esBaseOrigen) {
    return (
      <ModalShell title="Mover artículos a otra lista" subtitle={origen} size="md" onClose={closeModal} footer={[{ texto: 'Entendido', clase: 'btn-primary', onClick: closeModal }]}>
        <div className={cx(s.callout, s.warn)}>
          <strong>{origen}</strong> es la lista base: es el precio de góndola, y sacarle artículos cambiaría la
          vidriera de golpe. No se vacía desde acá. Si querés que la base sea otra, se cambia en Ventas ›
          Configuración › Precios y descuentos.
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Mover artículos a otra lista" subtitle={`Desde ${origen}`} size="lg" onClose={closeModal} footer={footer}>
      <div className={cx(s.callout, s.info)}>
        Los artículos tildados <strong>salen de {origen}</strong> y pasan a la lista que elijas, con su mismo
        markup o precio. Si alguno <strong>ya estaba en el destino</strong>, se respeta lo que tiene ahí y solo
        se lo saca de {origen}.
      </div>

      <div className={s.field} style={{ margin: '12px 0' }}>
        <label htmlFor="mover-destino">Llevar a</label>
        <select id="mover-destino" value={destinoId} onChange={(e) => { setDestinoId(e.target.value); setConfirmando(false); }}>
          <option value="">— Elegí la lista de destino —</option>
          {activas.filter((l) => l.id !== origenId).map((l) => (
            <option key={l.id} value={l.id}>{l.etiqueta}{l.id === baseId ? ' (base · precio de góndola)' : ''}</option>
          ))}
        </select>
      </div>

      <div className={s['section-title']} style={{ marginTop: 0 }}>
        Qué se mueve · {num(total, 0)} de {num(candidatas.length, 0)} tildado(s)
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <Btn small onClick={() => tildar(candidatas.map((f) => f.filaId), true)}>Todos</Btn>
        <Btn small onClick={() => tildar(candidatas.map((f) => f.filaId), false)}>Ninguno</Btn>
        {porValor.length > 1 && porValor.slice(0, 12).map(([valor, ids]) => {
          const todos = ids.every((id) => seleccion.has(id));
          return (
            <Btn key={valor} small variant={todos ? 'btn-primary' : 'btn-ghost'} onClick={() => tildar(ids, !todos)}>
              {valor} ({ids.length})
            </Btn>
          );
        })}
      </div>
      <input
        id="mover-buscar" type="search" placeholder="Buscar producto…" value={q}
        onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 8 }}
      />
      <Table cols={[{ h: '' }, { h: 'Producto' }, { h: 'Forma' }, { h: 'Markup', num: true }, { h: 'Precio', num: true }]} pag={pag}>
        {pag.visibles.map((f) => (
          <tr key={f.filaId} className={s.clickable} onClick={() => tildar([f.filaId], !seleccion.has(f.filaId))}>
            <td>
              <input
                type="checkbox" aria-label={`Mover ${f.producto}`} checked={seleccion.has(f.filaId)}
                onChange={(e) => tildar([f.filaId], e.target.checked)} onClick={(e) => e.stopPropagation()}
              />
            </td>
            <td>{f.producto}</td>
            <td>{f.forma}</td>
            <td className={s.num}>{valorDe(f)}</td>
            <td className={s.num}>{money(f.precioFinal)}</td>
          </tr>
        ))}
      </Table>

      {uso && (uso.clientes > 0 || uso.descuentos > 0 || uso.ofertas > 0) && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 12 }}>
          <strong>{origen} también la usan:</strong>{' '}
          {[
            uso.clientes && `${uso.clientes} cliente(s) que la tienen asignada`,
            uso.descuentos && `${uso.descuentos} descuento(s)`,
            uso.ofertas && `${uso.ofertas} oferta(s) vigente(s)`,
          ].filter(Boolean).join(', ')}. Para los artículos que se muevan, eso deja de aplicarles en esta lista.
        </div>
      )}

      {plan && total > 0 && (
        <>
          <div className={s['section-title']}>Vista previa</div>
          <div className={s.stats} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className={s.stat}><div className={s['stat-label']}>Se mueven</div><div className={s['stat-value']}>{num(plan.mueven.length, 0)}</div></div>
            <div className={s.stat}><div className={s['stat-label']}>Ya estaban en el destino</div><div className={s['stat-value']}>{num(plan.yaEstaban.length, 0)}</div></div>
            <div className={cx(s.stat, plan.gondola.length ? s['accent-amber'] : undefined)}>
              <div className={s['stat-label']}>Cambia el precio de góndola</div><div className={s['stat-value']}>{num(plan.gondola.length, 0)}</div>
            </div>
          </div>
          {plan.destinoEsBase && (
            <div className={cx(s.callout, s.warn)}>
              <strong>{destino.etiqueta}</strong> es la lista base: los artículos que se mueven pasan a tener ese
              precio en la góndola.
            </div>
          )}
          {plan.yaEstaban.length > 0 && (
            <>
              <div className={s['section-title']}>Ya estaban en {destino.etiqueta} — se respeta lo de ahí</div>
              <Table cols={[{ h: 'Producto' }, { h: 'Forma' }, { h: `En ${origen}`, num: true }, { h: 'Queda', num: true }]}>
                {plan.yaEstaban.map((f) => (
                  <tr key={f.filaId}>
                    <td>{f.producto}</td><td>{f.forma}</td>
                    <td className={cx(s.num, s.muted)}>{valorDe(f)}</td>
                    <td className={s.num}><strong>{valorDe(f.destinoFila)}</strong></td>
                  </tr>
                ))}
              </Table>
            </>
          )}
          {plan.gondola.length > 0 && (
            <>
              <div className={s['section-title']}>Les cambia el precio de góndola</div>
              <Table cols={[{ h: 'Producto' }, { h: 'Forma' }, { h: 'Hoy', num: true }, { h: 'Queda', num: true }]}>
                {plan.gondola.map((g, i) => (
                  <tr key={i}>
                    <td>{g.producto}</td><td>{g.forma}</td>
                    <td className={cx(s.num, s.muted)}>{g.precioAntes != null ? money(g.precioAntes) : '—'}<div className={s.hint} style={{ margin: 0 }}>{g.listaAntes}</div></td>
                    <td className={s.num}><strong>{g.precioDespues != null ? money(g.precioDespues) : 'sin precio'}</strong><div className={s.hint} style={{ margin: 0 }}>{g.listaDespues}</div></td>
                  </tr>
                ))}
              </Table>
            </>
          )}
        </>
      )}

      {confirmando && plan && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 12 }}>
          <strong>Segunda confirmación.</strong> Se mueven <strong>{num(plan.mueven.length, 0)}</strong> artículo(s)
          de {origen} a <strong>{destino.etiqueta}</strong>
          {plan.yaEstaban.length > 0 && <> y se sacan de {origen} <strong>{num(plan.yaEstaban.length, 0)}</strong> que ya estaban ahí</>}
          {plan.gondola.length > 0 && <>; a <strong>{num(plan.gondola.length, 0)}</strong> les cambia el precio de góndola</>}.
          Tocá «Sí, mover» para seguir.
        </div>
      )}
    </ModalShell>
  );
}
