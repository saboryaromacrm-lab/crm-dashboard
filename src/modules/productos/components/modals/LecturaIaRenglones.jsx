/*
 * LA LECTURA DE LA IA EN EL ALTA DE UNA COMPRA (0153; rediseñada el
 * 24/11/2026, pedido del dueño: «no se entiende nada»).
 *
 * Una fila por renglón del papel, como una tabla: a la izquierda lo que dice
 * el papel, a la derecha el producto del ERP con su cantidad, costo y
 * subtotal. El estado es una barra de color al costado y una línea corta
 * debajo del producto; los filtros de arriba cuentan cada estado. Lo que se
 * toca poco (descuento, IVA, cómo vino, Coffit, el código del papel, cambiar o
 * editar el producto) queda en el detalle de la fila (▾).
 *
 * Los casilleros del renglón (cantidad, costo, descuento…) los pone el alta
 * (`campos` y `detalle`): ahí viven sus reglas. Acá, el papel, el producto y
 * el estado.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { TIPOS_COMPROBANTE } from '../../domain/constants.js';
import { money, num } from '../../domain/format.js';
import { dudasDelProducto } from '../../domain/parecidoPapel.js';
import { codigoDeFormato } from '../../domain/renglonPapel.js';
import { Btn, s } from '../ui.jsx';

/** Los estados de un renglón del papel, en el orden en que hay que atenderlos. */
const ESTADOS = {
  rojo: { color: 'var(--crm-color-danger)', filtro: 'Sin producto', ayuda: 'No suman en la factura: elegí el producto, aceptá la sugerencia o marcalo de prueba' },
  amarillo: { color: 'var(--crm-color-warning)', filtro: 'Para revisar', ayuda: 'Los supuso la IA por el nombre, o el producto no se parece al del papel' },
  verde: { color: 'var(--crm-color-success)', filtro: 'Listos', ayuda: 'Con el código del papel, asociados antes, elegidos o confirmados por vos' },
  prueba: { color: 'var(--crm-color-info)', filtro: 'De prueba', ayuda: 'Suman a la factura; no entran al stock ni al catálogo' },
};

/** El estado de un renglón y su explicación corta. */
function estadoDelRenglon({ x, prod, coincide, confirmado, dePrueba, dudas }) {
  if (!prod && dePrueba) return ['prueba', 'De prueba: no entra al stock ni al catálogo'];
  if (!prod) return ['rojo', 'Sin producto: no suma en la factura'];
  if (coincide) return ['verde', 'Código del papel'];
  if (confirmado) return ['verde', 'Confirmado por vos'];
  if (dudas.length) return ['amarillo', `¿Es este? ${dudas.join(' y ')}`];
  const delServidor = String(x.productoId) === String(prod.id);
  if (delServidor && x.fuente === 'aprendido') return ['verde', 'Asociado en otra factura'];
  if (delServidor && x.fuente === 'catalogo') return ['verde', 'Código del catálogo'];
  if (delServidor && x.fuente === 'parecido') return ['amarillo', 'Lo supuso la IA por el nombre'];
  return ['verde', 'Elegido por vos'];
}

const modelo = (m) => (/haiku/.test(m || '') ? 'Haiku' : /sonnet/.test(m || '') ? 'Sonnet' : m || '');
const usd = (n) => `USD ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 4 })}`;

export function LecturaIaRenglones({
  propuesta: d, cargando, leyendo, eligiendo, porRenglon, usados, productos, proveedor, pruebas,
  onAplicar, onReleer, onElegir, onAsociar, onAceptarSugerencias, onGuardarCodigo, onUsarEncabezado,
  onCrearProducto, onEditarProducto, onPrueba, campos, detalle, netoPapel, netoDe,
}) {
  const [filtro, setFiltro] = useState(null);
  const [abiertos, setAbiertos] = useState(() => new Set());
  /** Los «supuestos por la IA» que quien carga dio por buenos (solo en esta carga: al guardar, se aprenden). */
  const [confirmados, setConfirmados] = useState(() => new Set());
  const [verTodos, setVerTodos] = useState(false);
  const alternar = (set, i) => set((prev) => {
    const n = new Set(prev);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });

  const estado = d?.estado ?? '';
  const renglones = d?.renglones ?? [];
  const activos = useMemo(
    () => productos.filter((p) => (p.estado || 'activo') === 'activo').slice().sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [productos],
  );
  /* Solo los productos del proveedor (12/10/2026): los de otros, a un tilde. Sin productos del proveedor, todos. */
  const delProveedor = useMemo(
    () => (proveedor ? activos.filter((p) => (p.formatosCompra || []).some((e) => e.proveedorId === proveedor.id)) : []),
    [activos, proveedor],
  );
  const todos = verTodos || !delProveedor.length;
  const opciones = todos ? activos : delProveedor;
  const idsProveedor = useMemo(() => new Set(delProveedor.map((p) => p.id)), [delProveedor]);
  const codigoDe = useMemo(() => new Map(activos.map((p) => [p.id, codigoDeFormato(p, proveedor?.id)])), [activos, proveedor]);
  const duenoDe = useMemo(() => {
    const m = new Map();
    for (const p of delProveedor) { const c = codigoDe.get(p.id); if (c && !m.has(c)) m.set(c, p); }
    return m;
  }, [delProveedor, codigoDe]);
  const etiqueta = (p) => (codigoDe.get(p.id) ? `${p.nombre} · cód ${codigoDe.get(p.id)}` : p.nombre);
  const parecidos = (x) => (todos ? x.candidatos ?? [] : (x.candidatos ?? []).filter((c) => idsProveedor.has(c.id)));
  /** Lo que ya está elegido en otro renglón no se vuelve a ofrecer (sí el propio). */
  const libre = (it) => (p) => !usados.has(String(p.id)) || String(p.id) === String(it?.productoId);

  const filas = renglones.map((x) => {
    const it = porRenglon.get(x.i);
    const prod = it ? productos.find((p) => String(p.id) === String(it.productoId)) : null;
    const codigoPapel = String(x.codigo ?? '').trim();
    const codProd = prod ? codigoDe.get(prod.id) ?? codigoDeFormato(prod, proveedor?.id) : '';
    const coincide = !!(codigoPapel && codProd && codProd === codigoPapel);
    const dudas = prod && !coincide ? dudasDelProducto(x.descripcion, prod.nombre, [proveedor?.nombre, prod.marca]) : [];
    const [color, porque] = estadoDelRenglon({ x, prod, coincide, confirmado: confirmados.has(x.i), dePrueba: pruebas.has(x.i), dudas });
    return { x, it, prod, codigoPapel, codProd, coincide, color, porque, dudas };
  });
  const cuenta = (c) => filas.filter((f) => f.color === c).length;
  const visibles = filtro ? filas.filter((f) => f.color === filtro) : filas;
  const sugeridos = filas.filter((f) => f.color === 'rojo' && f.x.sugerido).map((f) => f.x);
  const pendientesIa = filas.some((f) => f.color === 'rojo' && f.x.candidatos?.length && !f.x.sugerido);
  /* «Confirmar»: los que supuso la IA y SE PARECEN al papel; los que tienen dudas se miran uno por uno. */
  const supuestos = filas.filter((f) => f.color === 'amarillo' && !f.dudas.length).map((f) => f.x.i);
  /* El aviso del servidor de «renglones sin producto» se calla cuando ya no queda ninguno. */
  const avisos = (d?.avisos ?? []).filter((a) => cuenta('rojo') > 0 || !/sin producto reconocido/.test(a));

  /** El selector de producto: los parecidos primero y después los del proveedor (o todos). */
  const selector = (x, it, prod) => (
    <select
      key={it?.productoId ?? 'nuevo'} defaultValue="" aria-label={`Producto para «${x.descripcion}»`}
      onChange={(e) => { if (e.target.value) onAsociar(x, e.target.value); }}
    >
      <option value="">{prod ? 'Cambiar por otro producto…' : 'Elegí el producto…'}</option>
      {parecidos(x).filter(libre(it)).length > 0 && (
        <optgroup label="Parecidos">
          {parecidos(x).filter(libre(it)).map((c) => {
            const pc = productos.find((p) => p.id === c.id);
            return <option key={c.id} value={c.id}>{pc ? etiqueta(pc) : c.nombre}</option>;
          })}
        </optgroup>
      )}
      <optgroup label={todos ? 'Todos los productos' : `Productos de ${proveedor?.nombre ?? 'este proveedor'}`}>
        {opciones.filter(libre(it)).map((p) => <option key={p.id} value={p.id}>{etiqueta(p)}</option>)}
      </optgroup>
    </select>
  );

  const fila = ({ x, it, prod, codigoPapel, codProd, coincide, color, porque }) => {
    const papel = netoPapel(x);
    const cargado = prod ? netoDe(it) : 0;
    const abierto = abiertos.has(x.i);
    const otro = codigoPapel ? duenoDe.get(codigoPapel) : null;
    const guardaCodigo = !!(prod && codigoPapel && !coincide && it.guardarCodigo);
    return (
      <div key={x.i} className={s.iaFila} style={{ '--ia-estado': ESTADOS[color].color }}>
        <div className={s.iaPapel}>
          <div className={s.iaNombre}>{x.descripcion}</div>
          <div className={s.iaSub}>
            {codigoPapel && <span className={s.mono}>{codigoPapel} · </span>}
            {num(x.cantidad)} × {money(x.costoBulto || x.precioUnitario)} = {money(papel)}
          </div>
        </div>

        <div className={s.iaProducto}>
          {prod ? (
            <>
              <div className={s.iaNombre}>{prod.nombre}</div>
              <div className={s.iaSub}>
                cód prov <span className={s.mono}>{codProd || '—'}</span>
                {guardaCodigo && <> → <span className={s.mono}>{codigoPapel}</span> al guardar</>}
              </div>
              <div className={s.iaEstado}>
                {porque}
                {color === 'amarillo' && (
                  <button type="button" className={s.iaBoton} onClick={() => alternar(setConfirmados, x.i)}>Es este</button>
                )}
                {color === 'amarillo' && (
                  <button type="button" className={s.iaBoton} onClick={() => alternar(setAbiertos, x.i)}>Cambiar</button>
                )}
              </div>
            </>
          ) : color === 'prueba' ? (
            <div className={s.iaEstado}>
              {porque}
              <button type="button" className={s.iaBoton} onClick={() => onPrueba(x.i, false)}>Deshacer</button>
            </div>
          ) : (
            <>
              {selector(x, it, null)}
              <div className={s.iaEstado}>
                {x.sugerido ? (
                  <>
                    Sugerido: {x.sugerido.nombre}
                    <button type="button" className={s.iaBoton} onClick={() => onAsociar(x, x.sugerido.id)}>Aceptar</button>
                  </>
                ) : porque}
                {onCrearProducto && <button type="button" className={s.iaBoton} onClick={() => onCrearProducto(x)}>Crear producto</button>}
                {onPrueba && <button type="button" className={s.iaBoton} onClick={() => onPrueba(x.i, true)}>Es de prueba</button>}
              </div>
            </>
          )}
        </div>

        {prod ? campos(it) : <><div /><div /></>}

        <div className={s.iaTotal}>
          {prod ? (
            <>
              <span className={Math.abs(cargado - papel) > 1 ? s.iaMal : undefined}>{money(cargado)}</span>
              {Math.abs(cargado - papel) > 1 && <div className={s.iaSub}>papel {money(papel)}</div>}
            </>
          ) : color === 'prueba' ? money(papel) : <span className={s.muted}>—</span>}
        </div>

        <div className={s.iaMas}>
          {prod && (
            <button
              type="button" aria-expanded={abierto} title={abierto ? 'Cerrar el detalle' : 'Descuento, IVA, Coffit, código y producto'}
              onClick={() => alternar(setAbiertos, x.i)}
            >{abierto ? '▴' : '▾'}</button>
          )}
        </div>

        {prod && abierto && (
          <div className={s.iaDetalle}>
            {detalle(it)}
            <div className={s.iaCampo}>
              <span>Producto</span>
              <div className={s.iaAcciones}>
                {selector(x, it, prod)}
                {onEditarProducto && <button type="button" className={s.iaBoton} onClick={() => onEditarProducto(x, prod.id)}>Editar ficha</button>}
                {onCrearProducto && <button type="button" className={s.iaBoton} onClick={() => onCrearProducto(x)}>Crear uno nuevo</button>}
                <button type="button" className={s.iaBoton} onClick={() => onAsociar(x, null)}>Sacarlo</button>
              </div>
            </div>
            {codigoPapel && !coincide && (
              <label className={s.iaTilde}>
                <input type="checkbox" checked={!!it.guardarCodigo} onChange={(e) => onGuardarCodigo(x.i, e.target.checked)} />
                Al guardar, poner «{codigoPapel}» como código de proveedor de {prod.nombre}
                {codProd ? ` (hoy tiene ${codProd})` : ' (hoy no tiene)'}
                {otro && otro.id !== prod.id ? ` · hoy lo tiene ${otro.nombre}: se le saca` : ''}
              </label>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className={s.ia}>
      <header className={s.iaHead}>
        <div className={s.iaTitulo}>
          <strong>Lectura de la IA</strong>
          <span className={s.iaSub}>
            {!d && cargando && 'Trayendo lo que leyó la IA…'}
            {leyendo && 'Leyendo esta factura… se precarga sola en unos segundos.'}
            {estado === '' && d && 'Esta factura todavía no se leyó.'}
            {(estado === 'error' || estado === 'tope') && <span className={s.iaMal}>No pudo leerla: {d.error || 'error desconocido'}</span>}
            {estado === 'lista' && (
              <>
                {renglones.length} renglones ·{' '}
                {d.cierra ? 'lo leído suma igual que el papel' : <span className={s.iaMal}>lo leído NO suma igual que el papel</span>}
                {' · '}{modelo(d.modelo)} · {usd(d.costoUsd)}
              </>
            )}
          </span>
          {estado === 'lista' && d.encabezado?.numero && (
            <span className={s.iaSub}>
              Leyó {TIPOS_COMPROBANTE[d.encabezado.tipo]?.label || d.encabezado.tipo} {d.encabezado.letra} {d.encabezado.puntoVenta}-{d.encabezado.numero}
              {d.encabezado.fecha && <> del {d.encabezado.fecha.split('-').reverse().map(Number).join('/')}</>}
              <button type="button" className={s.iaBoton} onClick={onUsarEncabezado}>Usar este encabezado</button>
            </span>
          )}
        </div>
        <div className={s.iaAcciones}>
          {pendientesIa && <Btn small onClick={onElegir} disabled={eligiendo}>{eligiendo ? 'Pensando…' : 'Que la IA elija'}</Btn>}
          {estado === 'lista' && <Btn small onClick={onAplicar} disabled={cargando}>Volver a precargar</Btn>}
          {!leyendo && d && <Btn small onClick={onReleer}>{estado === 'lista' ? 'Leer de nuevo' : 'Leer con IA'}</Btn>}
        </div>
      </header>

      {estado === 'lista' && renglones.length > 0 && (
        <>
          <div className={s.iaBarra}>
            <div className={s.iaFiltros} role="group" aria-label="Filtrar renglones">
              <button type="button" className={s.iaFiltro} aria-pressed={!filtro} onClick={() => setFiltro(null)}>Todos {filas.length}</button>
              {Object.entries(ESTADOS).filter(([c]) => cuenta(c) > 0).map(([c, e]) => (
                <button
                  key={c} type="button" className={s.iaFiltro} aria-pressed={filtro === c} title={e.ayuda}
                  onClick={() => setFiltro(filtro === c ? null : c)}
                >
                  <span className={s.iaPunto} style={{ background: e.color }} />{e.filtro} {cuenta(c)}
                </button>
              ))}
            </div>
            <div className={s.iaAcciones}>
              {sugeridos.length > 0 && (
                <Btn small variant="btn-primary" onClick={() => onAceptarSugerencias(sugeridos)}>Aceptar {sugeridos.length} sugerencias</Btn>
              )}
              {supuestos.length > 0 && (
                <Btn small onClick={() => setConfirmados((prev) => new Set([...prev, ...supuestos]))}>
                  Confirmar {supuestos.length} supuestos por la IA
                </Btn>
              )}
            </div>
          </div>
          {avisos.length > 0 && <div className={s.iaAviso}>{avisos.join(' · ')}</div>}

          <div className={s.iaTabla}>
            <div className={s.iaCab}>
              <span>Según el papel</span><span>Producto en el ERP</span>
              <span className={s.num}>Cantidad</span><span className={s.num}>Costo</span><span className={s.num}>Subtotal</span><span />
            </div>
            {visibles.map(fila)}
            {!visibles.length && <div className={s.iaVacio}>Ningún renglón con ese filtro.</div>}
          </div>

          <footer className={s.iaPie}>
            {delProveedor.length > 0 && (
              <label className={s.iaTilde}>
                <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
                Ofrecer también productos de otros proveedores
              </label>
            )}
            <details>
              <summary>Ver todo lo que leyó la IA</summary>
              <div className={s.tblScroll}>
                <table className={cx(s.table)} style={{ fontSize: 12, marginTop: 6 }}>
                  <thead>
                    <tr><th>#</th><th>Código</th><th>Descripción</th><th className={s.num}>Cant.</th><th className={s.num}>Precio</th><th className={s.num}>Dto. %</th><th className={s.num}>Importe</th></tr>
                  </thead>
                  <tbody>
                    {renglones.map((x) => (
                      <tr key={x.i}>
                        <td>{x.i + 1}{!x.cierra && ' ⚠'}</td>
                        <td className={s.mono}>{x.codigo || '—'}</td>
                        <td>{x.descripcion}</td>
                        <td className={s.num}>{num(x.cantidad)} {x.unidad}</td>
                        <td className={s.num}>{money(x.precioUnitario)}</td>
                        <td className={s.num}>{x.dto ? num(x.dto, 2) : '—'}</td>
                        <td className={s.num}>{money(x.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={s.iaSub}>
                Pie leído: subtotal {money(d.pie?.subtotal)}
                {d.pie?.bonifImporte > 0 && <> · bonificación {money(d.pie.bonifImporte)}</>}
                {(d.pie?.ivas || []).map((x, i) => <span key={i}> · IVA {num(x.alicuota)} % {money(x.importe)}</span>)}
                {(d.pie?.percepciones || []).map((x, i) => <span key={`p${i}`}> · {x.nombre} {money(x.importe)}</span>)}
                {' · '}total <strong>{money(d.pie?.total)}</strong>
              </div>
            </details>
          </footer>
        </>
      )}
      {estado !== 'lista' && avisos.length > 0 && <div className={s.iaAviso}>{avisos.join(' · ')}</div>}
    </section>
  );
}
