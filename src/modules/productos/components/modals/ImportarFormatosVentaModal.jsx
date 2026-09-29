/**
 * ACTUALIZAR FORMATOS DE VENTA (28/9/2026, pedido del dueño)
 * ============================================================================
 * El «Listado de Formatos» de Ventas del sistema viejo. Toca SOLO el formato
 * de venta: markup o precio fijo, y de a cuántas unidades se vende. Dos modos,
 * igual que «Actualizar costos»:
 *  · UN PROVEEDOR: el archivo filtrado por proveedor en el sistema viejo.
 *  · TODOS (archivo completo, 29/9/2026): el archivo no trae proveedor, así
 *    que cada producto se agrupa por el que tiene en el ERP; se ve el resumen
 *    por proveedor y se puede excluir los que no se quieran tocar.
 * Las reglas viven en `domain/importarFormatosVenta.js`; acá se eligen el
 * modo, el archivo y adónde va cada lista, y se muestra todo antes de tocar
 * nada. Con miles de renglones, las tablas van paginadas.
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num as fmtNum } from '../../domain/format.js';
import { leerTexto, parseCsv, tipoDeArchivo } from '../../domain/importarCatalogo.js';
import {
  ESTADOS_FV, armarPlanFormatosVenta, cuerpoImportacion, listasDelArchivo, resumenPorProveedor,
} from '../../domain/importarFormatosVenta.js';
import { ModalShell } from '../Modal.jsx';
import { Btn, Table, usePaginado, s } from '../ui.jsx';

const normNombre = (x) => String(x ?? '').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Z0-9]/g, '');

/** "MarkUp 40%" o "Precio $1.100" — cómo se lee una fila de formato. */
function textoFila(f) {
  if (!f) return <span className={s.muted}>no la tiene</span>;
  const base = f.modoPrecio === 'precio' ? `Precio ${money(f.precioFijo)}` : `Markup ${fmtNum(f.markup, 1)}%`;
  return (Number(f.unidades) || 1) > 1 ? `${base} · x${fmtNum(f.unidades, 0)}` : base;
}

const COLOR_ESTADO = {
  cambia: 'var(--crm-color-warning)',
  agrega: 'var(--crm-color-success)',
  igual: 'var(--crm-color-text-muted)',
};

/** Un archivo con más renglones que esto es, casi seguro, el completo. */
const RENGLONES_ARCHIVO_COMPLETO = 2000;

export function ImportarFormatosVentaModal({ proveedorId: proveedorInicial = null }) {
  const { store, closeModal, toast } = useProductos();
  const [paso, setPaso] = useState(1);
  const [archivo, setArchivo] = useState(null); // { nombre, filas }
  const [leyendo, setLeyendo] = useState(false);
  /* Desde la guía por proveedor llega elegido: el archivo no lo pisa. */
  const [proveedorId, setProveedorId] = useState(proveedorInicial ? String(proveedorInicial) : '');
  /** Archivo completo (todos los proveedores) o de uno solo. */
  const [varios, setVarios] = useState(false);
  /** Proveedores sacados de la importación completa. */
  const [excluidos, setExcluidos] = useState(() => new Set());
  const [filtroProv, setFiltroProv] = useState('');
  /** clave de lista del archivo → valor del selector ('L49', 'nueva', 'afuera'). */
  const [eleccion, setEleccion] = useState({});
  const [filtro, setFiltro] = useState('cambios');
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const [resultado, setResultado] = useState(null);

  const proveedores = store.state.proveedores.filter((p) => p.proveeMercaderia !== false);
  const nombreDeProv = useMemo(() => new Map(store.state.proveedores.map((p) => [p.id, p.nombre])), [store.state.proveedores]);
  /* Memorizado: un objeto nuevo en cada render hacía recalcular la vista
     previa entera (miles de productos) con cada tecla o clic. */
  const catalogo = useMemo(
    () => store.state.listasCatalogo ?? { modalidades: [], listas: [] },
    [store.state.listasCatalogo],
  );
  const listasActivas = (catalogo.listas ?? []).filter((l) => l.activa);

  const cargar = async (files) => {
    const file = files[0];
    if (!file) return;
    setLeyendo(true);
    try {
      const { cols, filas } = parseCsv(await leerTexto(file));
      if (tipoDeArchivo(cols) !== 'ventas') {
        toast(`${file.name} no tiene las columnas del listado de formatos de venta.`, 'err');
      } else {
        setArchivo({ nombre: file.name, filas });
        setEleccion({});
        setExcluidos(new Set());
        /* El completo se reconoce por el nombre o por el tamaño: se pasa solo
           a "todos". El de un proveedor trae su nombre en el archivo
           ("… Formatos BIOSALUD.csv"): si coincide con uno del padrón, se
           preselecciona. Gana el nombre más largo ("Sol Azteca" antes que "Sol"). */
        const esCompleto = /complet/i.test(file.name) || filas.length > RENGLONES_ARCHIVO_COMPLETO;
        if (esCompleto && !proveedorInicial) setVarios(true);
        if (!proveedorId && !esCompleto) {
          const n = normNombre(file.name);
          const cand = proveedores
            .filter((p) => normNombre(p.nombre).length >= 3 && n.includes(normNombre(p.nombre)))
            .sort((a, b) => normNombre(b.nombre).length - normNombre(a.nombre).length)[0];
          if (cand) setProveedorId(String(cand.id));
        }
      }
    } catch {
      toast(`No pude leer ${file.name}.`, 'err');
    }
    setLeyendo(false);
  };

  /* Las listas del archivo con su destino: el propuesto, o el que se eligió. */
  const listas = useMemo(() => {
    if (!archivo) return [];
    return listasDelArchivo(archivo.filas, catalogo).map((l) => {
      const e = eleccion[l.clave];
      if (!e) return l;
      if (e === 'afuera') return { ...l, choque: false, destino: { tipo: 'afuera', motivo: 'elegiste no importar esta lista' } };
      if (e === 'nueva') {
        return { ...l, choque: false, destino: { tipo: 'nueva', modalidadId: l.modalidad.id, numero: l.numero, nombre: `lista ${l.numero} del sistema viejo` } };
      }
      return { ...l, choque: false, destino: { tipo: 'existente', listaId: Number(e.slice(1)) } };
    });
  }, [archivo, catalogo, eleccion]);

  const plan = useMemo(() => {
    if (!archivo || (!varios && !proveedorId)) return null;
    const provId = Number(proveedorId);
    const destinos = Object.fromEntries(listas.map((l) => [l.clave, l.destino]));
    return armarPlanFormatosVenta(archivo.filas, {
      productos: store.state.productos,
      destinos,
      esDelProveedor: varios ? null : (p) => (p.formatosCompra || p.proveedores || []).some((f) => f.proveedorId === provId),
      /* Con quién se agrupa: el proveedor que fija el precio (o el primero). */
      proveedorDe: (p) => {
        const fs = p.formatosCompra || p.proveedores || [];
        const f = fs.find((x) => x.usarParaPrecio) || fs[0];
        return f ? { id: f.proveedorId, nombre: nombreDeProv.get(f.proveedorId) ?? `Proveedor ${f.proveedorId}` } : null;
      },
      cotizar: (prod, pres, fila) => {
        const costo = pres ? store.costoPrecio(prod) * store.escalaPaquete(pres.tamKg, prod.merma) : undefined;
        const v = store.ventaFormato(prod, fila, costo);
        return v.finalFormato > 0 ? v.finalFormato : null;
      },
    });
  }, [archivo, varios, proveedorId, listas, store, nombreDeProv]);

  const porProveedor = useMemo(() => (plan && varios ? resumenPorProveedor(plan) : []), [plan, varios]);
  /* Lo que de verdad va: sin los proveedores excluidos. */
  const efectivos = useMemo(() => (plan ? plan.items.filter((i) => !excluidos.has(i.proveedorId)) : []), [plan, excluidos]);
  const cuenta = useMemo(() => {
    const c = { cambia: 0, agrega: 0, igual: 0 };
    for (const i of efectivos) c[i.estado] += 1;
    return c;
  }, [efectivos]);
  const aImportar = cuenta.cambia + cuenta.agrega;

  const visibles = useMemo(() => efectivos.filter((i) => (!filtroProv || String(i.proveedorId) === filtroProv)
    && (filtro === 'todos' ? true : filtro === 'cambios' ? i.estado !== 'igual' : i.estado === filtro)), [efectivos, filtro, filtroProv]);
  const pag = usePaginado(visibles, 'fv-importar', `${filtro}|${filtroProv}`);
  const pagAfuera = usePaginado(plan?.afuera ?? [], 'fv-afuera', String(plan?.afuera.length ?? 0));
  const pagSaltados = usePaginado(resultado?.saltados ?? [], 'fv-saltados', '');

  const nuevasUsadas = plan
    ? listas.filter((l) => l.destino.tipo === 'nueva' && efectivos.some((i) => i.clave === l.clave && i.estado !== 'igual'))
    : [];
  const nombreProv = varios ? 'todos los proveedores' : (proveedores.find((p) => String(p.id) === String(proveedorId))?.nombre ?? '');
  const etiquetaDestino = (l) => {
    if (l.destino.tipo === 'existente') return listasActivas.find((x) => x.id === l.destino.listaId)?.etiqueta ?? 'lista';
    if (l.destino.tipo === 'nueva') return `${l.modalidad?.nombre ?? ''} ${l.destino.numero} (nueva)`;
    return 'no se importa';
  };
  const destinoDe = Object.fromEntries(listas.map((l) => [l.clave, l]));

  const continuar = () => {
    if (!archivo) { toast('Elegí el archivo de formatos de venta.', 'err'); return; }
    if (!varios && !proveedorId) { toast('Elegí de qué proveedor es el archivo, o marcá "Todos los proveedores".', 'err'); return; }
    setPaso(2);
  };

  const alternarProv = (id) => {
    setConfirmando(false);
    setExcluidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  /* Segunda confirmación y candado: cambia precios de góndola de muchos
     productos a la vez, y puede crear listas. */
  const importar = async () => {
    // Sin nada que cambiar no hay precios en juego: se anota directo.
    if (aImportar > 0 && !confirmando) { setConfirmando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    const res = await store.importarFormatosVenta(cuerpoImportacion(plan, listas, varios ? null : Number(proveedorId), { excluidos }));
    setGuardando(false);
    enVuelo.current = false;
    if (!res.ok) { setConfirmando(false); toast(res.error || 'No se pudo importar.', 'err'); return; }
    setResultado(res);
    toast(aImportar ? `${fmtNum((res.actualizados ?? 0) + (res.agregados ?? 0), 0)} formato(s) de venta importado(s).` : 'Marcado como revisado: ya estaba al día.', 'ok');
  };

  /* ------------------------------- resultado ------------------------------- */
  if (resultado) {
    return (
      <ModalShell title="Formatos de venta actualizados" wide onClose={closeModal} footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}>
        <div className={cx(s.callout, s.ok)}>
          <strong>{fmtNum(resultado.actualizados ?? 0, 0)}</strong> formato(s) actualizado(s) y{' '}
          <strong>{fmtNum(resultado.agregados ?? 0, 0)}</strong> agregado(s), de <strong>{resultado.proveedor}</strong>.
          Los precios que cambiaron quedaron en la evolución de precios.
          {resultado.proveedoresAnotados > 1 && <> Quedó anotado en la guía de <strong>{resultado.proveedoresAnotados}</strong> proveedores.</>}
        </div>
        {resultado.listasCreadas?.length > 0 && (
          <div className={cx(s.callout, s.info)}>
            Se crearon <strong>{resultado.listasCreadas.length}</strong> lista(s) nueva(s), al final del orden de
            preferencia: {resultado.listasCreadas.map((l) => l.nombre).join(', ')}. Las ves y las ordenás en
            Ventas › Configuración › Formato de venta.
          </div>
        )}
        {resultado.saltados?.length > 0 && (
          <>
            <div className={s['section-title']}>No se importaron ({fmtNum(resultado.saltados.length, 0)})</div>
            <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Por qué' }]} pag={pagSaltados}>
              {pagSaltados.visibles.map((x, i) => (
                <tr key={i}><td className={s.mono}>{x.codigo || '—'}</td><td>{x.nombre || '—'}</td><td>{x.motivo}</td></tr>
              ))}
            </Table>
          </>
        )}
      </ModalShell>
    );
  }

  const footer = paso === 2
    ? [
      { texto: 'Volver', clase: 'btn-ghost', onClick: () => { setConfirmando(false); setPaso(1); } },
      aImportar || !efectivos.length
        ? {
          texto: guardando ? 'Importando…' : confirmando ? 'Sí, importar' : `Importar ${fmtNum(aImportar, 0)} formato(s)…`,
          clase: 'btn-primary',
          onClick: guardando || !aImportar ? () => {} : importar,
        }
        /* Todo coincidía: no hay nada que escribir, pero queda anotado en la
           guía por proveedor como revisado. */
        : { texto: guardando ? 'Guardando…' : 'Marcar como revisado (ya está al día)', clase: 'btn-primary', onClick: guardando ? () => {} : importar },
    ]
    : [
      { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
      { texto: 'Continuar', clase: 'btn-primary', onClick: continuar },
    ];

  return (
    <ModalShell
      title={varios ? 'Actualizar formatos de venta de todos los proveedores' : 'Actualizar formatos de venta de un proveedor'}
      subtitle={paso === 1 ? 'Paso 1 de 2 · Archivo' : 'Paso 2 de 2 · Listas y vista previa'}
      size="lg"
      onClose={closeModal}
      footer={footer}
    >
      {paso === 1 && (
        <>
          {/* Igual que costos: los dos modos a la vista desde que se abre. */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Btn variant={!varios ? 'btn-primary' : 'btn-ghost'} onClick={() => setVarios(false)}>Un proveedor</Btn>
            <Btn variant={varios ? 'btn-primary' : 'btn-ghost'} onClick={() => setVarios(true)}>Todos los proveedores (archivo completo)</Btn>
          </div>

          <div className={cx(s.callout, s.info)}>
            {varios ? (
              <>
                Un solo archivo: el <strong>Listado de Formatos</strong> de Ventas <strong>completo</strong>. Como no
                trae el proveedor, cada producto se agrupa por el que tiene en el ERP: en la vista previa ves qué
                cambia de cada proveedor y podés <strong>excluir</strong> los que no quieras tocar.
              </>
            ) : (
              <>
                Un solo archivo: el <strong>Listado de Formatos</strong> de Ventas de un proveedor. Se actualiza solo
                el formato de venta de los productos que en el ERP tienen a ese proveedor.
              </>
            )}
            {' '}No toca costos ni stock, y las listas que el producto tiene y el archivo no trae quedan como están.
          </div>

          {!varios && (
            <div className={s.field} style={{ marginBottom: 14 }}>
              <label htmlFor="fv-proveedor">Proveedor</label>
              <select id="fv-proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">— Elegí el proveedor —</option>
                {proveedores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <label
            style={{
              display: 'block', border: '2px dashed var(--crm-color-border)', borderRadius: 10,
              padding: 22, textAlign: 'center', cursor: 'pointer', marginBottom: 14,
            }}
          >
            <input
              type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={(e) => { cargar([...e.target.files]); e.target.value = ''; }}
            />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{leyendo ? 'Leyendo…' : 'Elegí el archivo .csv'}</div>
            <div className={s.hint} style={{ margin: 0 }}>Ventas › Listado de Formatos, tal como lo exporta el sistema viejo.</div>
          </label>

          {archivo && (
            <div className={cx(s.callout, s.ok)}>
              <strong>{archivo.nombre}</strong> · {fmtNum(archivo.filas.length, 0)} renglones
              {nombreProv && <> · <strong>{nombreProv}</strong></>}
            </div>
          )}
        </>
      )}

      {paso === 2 && plan && (
        <>
          <div className={s['section-title']} style={{ marginTop: 0 }}>A qué lista va cada una</div>
          <div className={s.hint} style={{ marginTop: 0 }}>
            Cada lista del sistema viejo va a la del ERP con la misma modalidad y número; la que no
            existe se <strong>crea</strong> al final del orden de preferencia (no le gana el precio a las que ya
            tenés). Si dos listas del archivo caen en la misma del ERP, queda la de más renglones y la otra se
            marca para que le elijas destino.
          </div>
          <Table cols={[{ h: 'Lista del sistema viejo' }, { h: 'Renglones', num: true }, { h: 'Va a' }]}>
            {listas.map((l) => {
              const valor = eleccion[l.clave]
                ?? (l.destino.tipo === 'existente' ? `L${l.destino.listaId}` : l.destino.tipo);
              return (
                <tr key={l.clave}>
                  <td>
                    {l.canal} {l.numero}
                    {l.choque && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-warning)' }}>{l.destino.motivo}</div>}
                  </td>
                  <td className={s.num}>{fmtNum(l.filas, 0)}</td>
                  <td>
                    <select
                      id={`fv-lista-${l.clave}`}
                      aria-label={`Destino de ${l.canal} ${l.numero}`}
                      value={valor}
                      onChange={(e) => { setConfirmando(false); setEleccion((x) => ({ ...x, [l.clave]: e.target.value })); }}
                    >
                      {listasActivas.map((x) => <option key={x.id} value={`L${x.id}`}>{x.etiqueta}</option>)}
                      {l.modalidad && <option value="nueva">Crear «{l.modalidad.nombre} {l.numero}» (nueva)</option>}
                      <option value="afuera">No importar</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </Table>

          {varios && porProveedor.length > 0 && (
            <>
              <div className={s['section-title']}>Por proveedor</div>
              <div className={s.hint} style={{ marginTop: 0 }}>
                Destildá los proveedores que no quieras tocar ahora. Cada producto va con el proveedor que tiene en
                el ERP (el que fija el precio).
              </div>
              <div style={{ maxHeight: 240, overflow: 'auto' }}>
                <Table cols={[{ h: '' }, { h: 'Proveedor' }, { h: 'Cambian', num: true }, { h: 'Se agregan', num: true }, { h: 'Sin cambios', num: true }]}>
                  {porProveedor.map((p) => (
                    <tr key={p.id} className={s.clickable} onClick={() => alternarProv(p.id)}>
                      <td>
                        <input
                          type="checkbox" aria-label={`Incluir ${p.nombre}`} checked={!excluidos.has(p.id)}
                          onChange={() => alternarProv(p.id)} onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>{p.nombre}</td>
                      <td className={s.num}>{fmtNum(p.cambia, 0)}</td>
                      <td className={s.num}>{fmtNum(p.agrega, 0)}</td>
                      <td className={cx(s.num, s.muted)}>{fmtNum(p.igual, 0)}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 8px', alignItems: 'center' }}>
            {[
              ['cambios', `Cambian o se agregan (${fmtNum(aImportar, 0)})`],
              ['cambia', `${ESTADOS_FV.cambia} (${fmtNum(cuenta.cambia, 0)})`],
              ['agrega', `${ESTADOS_FV.agrega} (${fmtNum(cuenta.agrega, 0)})`],
              ['igual', `${ESTADOS_FV.igual} (${fmtNum(cuenta.igual, 0)})`],
              ['todos', `Todos (${fmtNum(efectivos.length, 0)})`],
            ].map(([id, texto]) => (
              <Btn key={id} small variant={filtro === id ? 'btn-primary' : 'btn-ghost'} onClick={() => setFiltro(id)}>{texto}</Btn>
            ))}
            {varios && (
              <select id="fv-filtro-prov" aria-label="Filtrar por proveedor" value={filtroProv} onChange={(e) => setFiltroProv(e.target.value)}>
                <option value="">Todos los proveedores</option>
                {porProveedor.filter((p) => !excluidos.has(p.id)).map((p) => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
              </select>
            )}
          </div>
          <div className={s.hint} style={{ marginTop: 0 }}>
            El precio nuevo lo calcula el ERP con <strong>su</strong> costo; «Sistema viejo» es el que figuraba
            allá. Si no coinciden, el costo es distinto: conviene actualizar primero los costos.
          </div>
          <Table
            cols={[
              { h: 'Código' }, { h: 'Producto' }, { h: 'Lista' }, { h: 'Hoy' }, { h: 'Queda' },
              { h: 'Precio hoy', num: true }, { h: 'Precio nuevo', num: true }, { h: 'Sistema viejo', num: true },
            ]}
            empty="No hay renglones con este filtro."
            pag={pag}
          >
            {pag.visibles.map((i) => (
              <tr key={`${i.productoId}-${i.presentacionId ?? 0}-${i.clave}`}>
                <td className={s.mono}>{i.codigo}</td>
                <td>
                  {i.nombre}
                  <div className={s.hint} style={{ margin: 0, color: COLOR_ESTADO[i.estado] }}>
                    {ESTADOS_FV[i.estado]}{varios ? ` · ${i.proveedor}` : ''}
                  </div>
                </td>
                <td>{i.listaArchivo} → {etiquetaDestino(destinoDe[i.clave])}</td>
                <td>{textoFila(i.antes)}</td>
                <td><strong>{textoFila(i.despues)}</strong></td>
                <td className={s.num}>{i.precioAntes != null ? money(i.precioAntes) : '—'}</td>
                <td className={s.num}><strong>{i.precioDespues != null ? money(i.precioDespues) : 'sin costo'}</strong></td>
                <td className={cx(s.num, s.muted)}>{i.precioSistemaViejo ? money(i.precioSistemaViejo) : '—'}</td>
              </tr>
            ))}
          </Table>

          {plan.afuera.length > 0 && (
            <>
              <div className={s['section-title']}>No se importan ({fmtNum(plan.afuera.length, 0)})</div>
              <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Lista' }, { h: 'Por qué' }]} pag={pagAfuera}>
                {pagAfuera.visibles.map((a, k) => (
                  <tr key={k}>
                    <td className={s.mono}>{a.codigo || '—'}</td><td>{a.nombre}</td><td>{a.lista}</td><td>{a.motivo}</td>
                  </tr>
                ))}
              </Table>
            </>
          )}

          {confirmando && (
            <div className={cx(s.callout, s.warn)} style={{ marginTop: 14 }}>
              <strong>Segunda confirmación.</strong> Se cambian <strong>{fmtNum(cuenta.cambia, 0)}</strong> y se
              agregan <strong>{fmtNum(cuenta.agrega, 0)}</strong> formato(s) de venta de{' '}
              <strong>{nombreProv}</strong>
              {varios && excluidos.size > 0 && <> (sin {excluidos.size} proveedor(es) excluido(s))</>}
              {nuevasUsadas.length > 0 && <>, y se crean {nuevasUsadas.length} lista(s): {nuevasUsadas.map((l) => `${l.modalidad?.nombre} ${l.numero}`).join(', ')}</>}.
              Los precios de góndola que dependen de estos formatos cambian en el acto. Tocá «Sí, importar» para seguir.
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}
