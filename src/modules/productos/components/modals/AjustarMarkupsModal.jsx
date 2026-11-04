/**
 * AJUSTAR MARKUPS (0218, 4/11/2026) — pedido del dueño: «ajustar markups en
 * alguna lista de precios a productos fraccionados y a determinadas marcas y
 * proveedores, algo muy práctico y lógico».
 *
 * Una sola ventana en tres pasos: A QUÉ ARTÍCULOS (listas, marcas, el
 * proveedor que fija el precio, categorías, la forma y el tamaño del paquete),
 * QUÉ HACER (variar un %, sumar puntos o fijar, de 5 en 5) y la VISTA PREVIA
 * con el precio de góndola antes y después, tildes y alertas. Se aplica con
 * doble confirmación y queda guardado para DESHACERLO (`AjustesMarkupModal`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { deSaborYAroma } from '../../domain/exclusivoCoffit.js';
import { money, num, fmtFechaHora } from '../../domain/format.js';
import {
  FORMAS, REGLAS, alertaPrecio, describirAjuste, filasDelAjuste, opcionesAjuste, planAjuste,
} from '../../domain/ajusteMarkups.js';
import { FiltroVarios } from '../FiltroVarios.jsx';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, usePaginado, s } from '../ui.jsx';

/** Lo que el servidor acepta en un ajuste (una lista entera con sus paquetes cabe holgada). */
const MAX_FILAS = 20000;
const pct = (v) => `${num(v, v % 1 ? 1 : 0)}%`;

export function AjustarMarkupsModal() {
  const { store, closeModal, openModal, toast } = useProductos();
  const [listas, setListas] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [forma, setForma] = useState('');
  const [tamanos, setTamanos] = useState([]);
  const [modo, setModo] = useState('monto');
  const [valor, setValor] = useState('');
  const [redondear, setRedondear] = useState(true);
  const [excluidos, setExcluidos] = useState(() => new Set());
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);

  /* Lo que está en juego: lo de Sabor y Aroma que no está archivado. */
  const productos = useMemo(
    () => store.state.productos.filter((p) => deSaborYAroma(p) && (p.estado || 'activo') !== 'archivado'),
    [store.state.productos],
  );
  const proveedorDe = (p) => store.formatoActivo(p)?.proveedorId ?? null;

  /* Las opciones se eligen por NOMBRE (el filtro de varias trabaja con textos) y viajan por id. */
  const listasActivas = useMemo(
    () => (store.state.listasCatalogo?.listas ?? []).filter((l) => l.activa).sort((a, b) => a.orden - b.orden),
    [store.state.listasCatalogo],
  );
  const opciones = useMemo(() => opcionesAjuste(productos, proveedorDe), [productos]); // eslint-disable-line react-hooks/exhaustive-deps
  const provPorNombre = useMemo(() => {
    const m = new Map();
    for (const id of opciones.proveedorIds) {
      const nombre = store.state.proveedores.find((p) => p.id === id)?.nombre;
      if (nombre) m.set(nombre, id);
    }
    return m;
  }, [opciones, store.state.proveedores]);
  /* La lista se nombra por su etiqueta («Minorista 1 · Minorista»): «Lista 1» sola puede repetirse entre modalidades. */
  const etiquetaLista = (l) => l.etiqueta || l.nombre;
  const nombreLista = (id) => { const l = listasActivas.find((x) => x.id === id); return l ? etiquetaLista(l) : `Lista ${id}`; };
  const nombreProv = (id) => store.state.proveedores.find((p) => p.id === id)?.nombre ?? `#${id}`;

  const criterios = useMemo(() => ({
    listaIds: listas.map((n) => listasActivas.find((l) => etiquetaLista(l) === n)?.id).filter(Boolean),
    marcas, categorias, forma,
    proveedorIds: proveedores.map((n) => provPorNombre.get(n)).filter((x) => x != null),
    tamanos: forma === 'fraccionado' ? tamanos : [],
  }), [listas, listasActivas, marcas, categorias, forma, proveedores, provPorNombre, tamanos]);
  const regla = useMemo(() => ({ modo, valor, redondear }), [modo, valor, redondear]);

  const { filas, aMano } = useMemo(() => filasDelAjuste(productos, criterios, proveedorDe), [productos, criterios]); // eslint-disable-line react-hooks/exhaustive-deps

  /* El precio de góndola antes y después, con el MISMO motor que la ficha y la caja. */
  const cambios = useMemo(() => planAjuste(filas, regla).map((f) => {
    const { producto: p, presentacion: pres, lista: l } = f;
    const base = pres ? store.costoPrecioPaquete(p, pres) : undefined;
    const conIva = 1 + (Number(p.iva) || 0) / 100;
    const antes = l.precioFinalUnitario ?? Math.round((l.precio ?? 0) * conIva * 100) / 100;
    const despues = store.ventaFormato(p, { ...l, markup: f.nuevo }, base).finalUnitario;
    return { ...f, antes, despues, alerta: alertaPrecio(antes, despues) };
  }), [filas, regla, store]);

  /* Cambiar un criterio arma otra lista: los destildados y la confirmación se olvidan. */
  useEffect(() => { setExcluidos(new Set()); setConfirmando(false); }, [criterios, regla]);

  const elegidos = cambios.filter((c) => !excluidos.has(c.id));
  const alertas = { baja: cambios.filter((c) => c.alerta === 'baja').length, fuerte: cambios.filter((c) => c.alerta === 'fuerte').length };
  const productosQueCambian = new Set(elegidos.map((c) => c.producto.id)).size;
  const sumaAntes = elegidos.reduce((a, c) => a + c.antes, 0);
  const variacion = sumaAntes > 0 ? ((elegidos.reduce((a, c) => a + c.despues, 0) - sumaAntes) / sumaAntes) * 100 : 0;
  const visibles = soloAlertas ? cambios.filter((c) => c.alerta) : cambios;
  const pag = usePaginado(visibles, 'ajustar-markups', `${JSON.stringify(criterios)}|${modo}|${valor}|${redondear}|${soloAlertas}`);

  const alternar = (id) => setExcluidos((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const todos = cambios.length > 0 && elegidos.length === cambios.length;

  const aplicar = async () => {
    if (!elegidos.length || enVuelo.current) return;
    if (elegidos.length > MAX_FILAS) { toast(`Son ${num(elegidos.length, 0)} filas: el máximo de un ajuste es ${num(MAX_FILAS, 0)}. Acotá los criterios.`, 'err'); return; }
    if (!confirmando) { setConfirmando(true); return; }
    enVuelo.current = true;
    setGuardando(true);
    const res = await store.ajustarMarkups({
      cambios: elegidos.map((c) => ({ id: c.id, valor: c.nuevo })),
      descripcion: describirAjuste(criterios, regla, { lista: nombreLista, proveedor: nombreProv }),
    });
    setGuardando(false);
    enVuelo.current = false;
    if (!res.ok) { setConfirmando(false); toast(res.error || 'No se pudo guardar el ajuste.', 'err'); return; }
    toast(`Ajuste #${res.id}: ${num(res.actualizados, 0)} markup(s) cambiados. Se puede deshacer desde «Ajustes hechos».`, 'ok');
    closeModal();
  };

  const footer = [
    { texto: 'Ajustes hechos', clase: 'btn-ghost', onClick: () => openModal('ajustesMarkup') },
    { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
    {
      texto: guardando ? 'Guardando…' : confirmando ? `Sí, ajustar ${num(elegidos.length, 0)}` : `Ajustar ${num(elegidos.length, 0)} markup(s)…`,
      clase: elegidos.length ? 'btn-primary' : 'btn-ghost',
      onClick: guardando ? () => {} : aplicar,
    },
  ];

  return (
    <ModalShell title="Ajustar markups" subtitle="Elegí a qué artículos, qué hacer y revisá antes de guardar" size="lg" onClose={closeModal} footer={footer}>
      <div className={s['section-title']}>1 · A qué artículos</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiltroVarios opciones={listasActivas.map(etiquetaLista)} elegidas={listas} onChange={setListas} todas="Todas las listas" plural="listas" />
        <FiltroVarios opciones={opciones.marcas} elegidas={marcas} onChange={setMarcas} todas="Todas las marcas" plural="marcas" />
        <FiltroVarios opciones={[...provPorNombre.keys()].sort((a, b) => a.localeCompare(b, 'es'))} elegidas={proveedores} onChange={setProveedores} todas="Todos los proveedores" plural="proveedores" />
        <FiltroVarios opciones={opciones.categorias} elegidas={categorias} onChange={setCategorias} todas="Todas las categorías" plural="categorías" />
        <select className={s['select-inline']} value={forma} onChange={(e) => setForma(e.target.value)} aria-label="Forma que se vende">
          <option value="">Todas las formas</option>
          {FORMAS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        {forma === 'fraccionado' && (
          <FiltroVarios opciones={opciones.tamanos} elegidas={tamanos} onChange={setTamanos} todas="Todos los tamaños" plural="tamaños" />
        )}
      </div>
      <div className={s.hint} style={{ margin: '6px 0 0' }}>
        Entran <strong>{num(filas.length, 0)}</strong> fila(s) de <strong>{num(new Set(filas.map((f) => f.producto.id)).size, 0)}</strong> producto(s).
        {' '}El proveedor es el que <strong>fija el precio</strong> de cada producto.
        {aMano > 0 && ` ${num(aMano, 0)} fila(s) con precio definido a mano quedan afuera: ese precio no se pisa con un markup.`}
      </div>

      <div className={s['section-title']}>2 · Qué hacer</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className={s.field}>
          <label htmlFor="ajuste-modo">Cómo</label>
          <select id="ajuste-modo" value={modo} onChange={(e) => setModo(e.target.value)}>
            {REGLAS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor="ajuste-valor">{modo === 'fijar' ? 'Markup (%)' : modo === 'monto' ? 'Puntos (negativo resta)' : '% (negativo baja)'}</label>
          <input id="ajuste-valor" type="number" step="0.5" placeholder={modo === 'fijar' ? 'Ej: 45' : 'Ej: 5'} value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 8 }}>
          <input id="ajuste-redondear" type="checkbox" checked={redondear} onChange={(e) => setRedondear(e.target.checked)} />
          Redondear de 5 en 5
        </label>
      </div>

      <div className={s['section-title']}>3 · Vista previa</div>
      {valor !== '' && (
        <div className={s.stats} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className={s.stat}><div className={s['stat-label']}>Cambian</div><div className={s['stat-value']}>{num(elegidos.length, 0)} de {num(filas.length, 0)}</div></div>
          <div className={s.stat}><div className={s['stat-label']}>Productos</div><div className={s['stat-value']}>{num(productosQueCambian, 0)}</div></div>
          <div className={s.stat}><div className={s['stat-label']}>Precios, en promedio</div><div className={s['stat-value']}>{`${variacion >= 0 ? '+' : ''}${num(variacion, 1)} %`}</div></div>
        </div>
      )}
      {(alertas.baja > 0 || alertas.fuerte > 0) && (
        <div className={cx(s.callout, s.warn)} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 220 }}>
            {[alertas.baja && `${num(alertas.baja, 0)} bajan de precio`, alertas.fuerte && `${num(alertas.fuerte, 0)} suben más de 30 %`].filter(Boolean).join(' · ')}
            . Revisalos antes de guardar: van marcados en rojo.
          </span>
          <Btn small onClick={() => setSoloAlertas((v) => !v)}>{soloAlertas ? 'Ver todos' : 'Ver solo esos'}</Btn>
        </div>
      )}
      <Table
        cols={[
          { h: <input type="checkbox" checked={todos} onChange={() => setExcluidos(todos ? new Set(cambios.map((c) => c.id)) : new Set())} aria-label="Tildar o destildar todos" /> },
          { h: 'Producto' }, { h: 'Forma' }, { h: 'Lista' }, { h: 'Markup', num: true }, { h: 'Precio de góndola', num: true },
        ]}
        empty={valor === '' ? 'Escribí el valor del paso 2 para ver qué cambia.' : 'Con esos criterios no cambia ningún markup.'}
        pag={pag}
      >
        {pag.visibles.map((c) => {
          const tildado = !excluidos.has(c.id);
          return (
            <tr key={c.id} style={tildado ? undefined : { opacity: 0.5 }}>
              <td style={{ width: 34, textAlign: 'center' }}>
                <input type="checkbox" checked={tildado} onChange={() => alternar(c.id)} aria-label={`Incluir ${c.producto.nombre} ${c.forma} en ${c.lista.etiqueta}`} />
              </td>
              <td>
                <strong>{c.producto.nombre}</strong>
                {c.producto.marca && <div className={s.hint} style={{ margin: 0 }}>{c.producto.marca}</div>}
              </td>
              <td>{c.forma}</td>
              <td>{c.lista.etiqueta}</td>
              <td className={s.num}><span className={s.muted}>{pct(c.actual)}</span> → <strong>{pct(c.nuevo)}</strong></td>
              <td className={s.num}>
                <span className={s.muted}>{money(c.antes)}</span> → <strong style={c.alerta ? { color: 'var(--crm-color-danger)' } : undefined}>{money(c.despues)}</strong>
              </td>
            </tr>
          );
        })}
      </Table>

      {confirmando && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 12 }}>
          <strong>Segunda confirmación.</strong> Se cambian <strong>{num(elegidos.length, 0)}</strong> markup(s) de{' '}
          <strong>{num(productosQueCambian, 0)}</strong> producto(s) y sus precios de góndola se mueven en el acto.
          Queda guardado en «Ajustes hechos» para deshacerlo. Tocá «Sí, ajustar» para seguir.
        </div>
      )}
    </ModalShell>
  );
}

/**
 * LOS AJUSTES HECHOS, con «Deshacer». Deshacer vuelve el markup de antes a las
 * filas que siguen como las dejó el ajuste; las que alguien cambió después no
 * se pisan (el servidor las saltea y las cuenta).
 */
export function AjustesMarkupModal() {
  const { store, closeModal, toast } = useProductos();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(null);
  const [deshaciendo, setDeshaciendo] = useState(false);

  const cargar = () => store.ajustesMarkup()
    .then((r) => { setLista(r ?? []); setError(''); })
    .catch((e) => setError(e?.data?.message || 'No se pudieron traer los ajustes.'));
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deshacer = async (id) => {
    setDeshaciendo(true);
    const res = await store.deshacerAjusteMarkup(id);
    setDeshaciendo(false);
    setConfirmar(null);
    if (!res.ok) { toast(res.error || 'No se pudo deshacer.', 'err'); return; }
    toast(`Volvieron ${num(res.revertidos, 0)} markup(s)${res.salteados ? `; ${num(res.salteados, 0)} no, porque se cambiaron después` : ''}.`, 'ok');
    cargar();
  };

  return (
    <ModalShell title="Ajustes de markup hechos" subtitle="Los últimos 30, el más nuevo arriba" size="lg" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      <Table
        cols={[{ h: 'Cuándo' }, { h: 'Qué se ajustó' }, { h: 'Filas', num: true }, { h: 'Quién' }, { h: '', cls: 'actions-col' }]}
        empty={lista == null ? 'Cargando…' : 'Todavía no se hizo ningún ajuste.'}
      >
        {(lista ?? []).map((a) => (
          <tr key={a.id}>
            <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(a.creadoEn)}<div className={s.hint} style={{ margin: 0 }}>#{a.id}</div></td>
            <td>{a.descripcion}</td>
            <td className={s.num}>{num(a.filas, 0)}</td>
            <td>{a.usuario || '—'}</td>
            <td className={s['actions-col']}>
              {a.deshechoEn ? (
                <span className={s.muted}>{`Deshecho ${fmtFechaHora(a.deshechoEn)}${a.deshechoPor ? ` por ${a.deshechoPor}` : ''}`}</span>
              ) : confirmar === a.id ? (
                <div className={s['row-actions']}>
                  <Btn variant="btn-delete" small disabled={deshaciendo} onClick={() => deshacer(a.id)}>{deshaciendo ? 'Deshaciendo…' : 'Sí, deshacer'}</Btn>
                  <Btn small disabled={deshaciendo} onClick={() => setConfirmar(null)}>No</Btn>
                </div>
              ) : (
                <Btn small onClick={() => setConfirmar(a.id)}>Deshacer…</Btn>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </ModalShell>
  );
}
