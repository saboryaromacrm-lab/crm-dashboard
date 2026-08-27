/**
 * IMPORTAR CATÁLOGO — el alta masiva de un proveedor, en tres pasos.
 * ============================================================================
 * Archivos → Opciones → VISTA PREVIA → se escribe.
 *
 * La vista previa no es un lujo: la primera importación real (Bavosi) destapó
 * 24 precios que se movían más del 15% porque en el sistema viejo el costo de
 * la madre y el del fraccionado no coincidían. Sin ver eso antes, esos precios
 * entraban a la góndola sin que nadie los mirara. Por eso NO hay forma de
 * importar sin pasar por la vista previa, y los cambios grandes se muestran
 * separados de los chicos.
 *
 * Todo el trabajo pesado (parseo y traducción) está en
 * `domain/importarCatalogo.js`; acá vive la pantalla.
 */
import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num as fmtNum } from '../../domain/format.js';
import {
  armarPlan, leerTexto, parseCsv, proveedorDelArchivo, tipoDeArchivo,
} from '../../domain/importarCatalogo.js';
import { mismoNombreProveedor, proveedoresParecidos } from '@modules/proveedores/domain/importarProveedores.js';
import { ModalShell } from '../Modal.jsx';
import { Table, s } from '../ui.jsx';

const PASOS = ['Archivos', 'Cómo se importa', 'Vista previa'];

const ARCHIVOS = {
  maestro: {
    label: 'Listado de productos',
    ayuda: 'El maestro: códigos, marca, IVA, costo y si va a la web. Es el único obligatorio.',
    obligatorio: true,
  },
  compras: {
    label: 'Formatos de compra',
    ayuda: 'De acá sale el costo real: lista, descuentos en cascada y flete. Sin este archivo no hay costo.',
    obligatorio: false,
  },
  ventas: {
    label: 'Formatos de venta',
    ayuda: 'Los markups por lista. Sin este archivo los productos entran sin precio de venta.',
    obligatorio: false,
  },
};

function Paso({ n, actual, label }) {
  const hecho = n < actual;
  const activo = n === actual;
  return (
    <div
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
        border: `1px solid ${activo ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`,
        borderRadius: 8, background: activo ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface)',
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none',
          background: activo || hecho ? 'var(--crm-color-primary)' : 'var(--crm-color-border)',
          color: activo || hecho ? 'var(--crm-color-primary-contrast)' : 'var(--crm-color-text-secondary)',
        }}
      >
        {hecho ? '✓' : n}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: activo ? 700 : 500, minWidth: 0 }}>{label}</span>
    </div>
  );
}

export function ImportarCatalogoModal() {
  const { store, closeModal, toast } = useProductos();
  const [paso, setPaso] = useState(1);
  /** { maestro: {nombre, filas}, compras: {...}, ventas: {...} } */
  const [archivos, setArchivos] = useState({});
  const [leyendo, setLeyendo] = useState(false);
  const [proveedorId, setProveedorId] = useState('');
  const [publicarConMayorista, setPublicarConMayorista] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const listas = store.state.listasCatalogo?.listas ?? [];
  /*
   * La sugerencia va por NÚMERO de lista, no por `orden`: el orden es la
   * prioridad con la que la caja las evalúa (la Oferta va antes que el
   * Mostrador justamente para ganarle), así que ordenar por él proponía
   * importar los precios minoristas a la lista de Ofertas.
   */
  const sugerida = (modalidad) => listas
    .filter((l) => (modalidad === 'may' ? l.modalidad === 'Mayorista' : l.modalidad !== 'Mayorista'))
    .sort((a, b) => a.numero - b.numero)[0]?.id ?? '';
  const [listaMinorista, setListaMinorista] = useState(() => sugerida('min'));
  const [listaMayorista, setListaMayorista] = useState(() => sugerida('may'));

  const proveedores = store.state.proveedores.filter((p) => p.proveeMercaderia !== false);

  /*
   * EL PROVEEDOR QUE DICE EL ARCHIVO (27/8, pedido del dueño). El CSV de
   * compras trae la columna `Proveedor`, y el sistema viejo escribe el mismo
   * nombre con variantes ("BAVOSI SA" vs "BAVOSI S.A."). Se resuelve contra el
   * padrón: si matchea, se preselecciona; si NO está tal cual, se pregunta si
   * es uno existente (con los parecidos como candidatos) o si es nuevo — crear
   * un duplicado en silencio era exactamente el error que esto evita.
   */
  const deteccion = useMemo(() => {
    const d = proveedorDelArchivo(archivos.compras?.filas);
    if (!d) return null;
    const exacto = proveedores.find((p) => mismoNombreProveedor(p.nombre, d.nombre)) || null;
    const candidatos = exacto ? [] : proveedoresParecidos(d.nombre, proveedores);
    return { ...d, exacto, candidatos };
  }, [archivos.compras, proveedores]);
  /** 'existente' = usa el desplegable · 'nuevo' = se crea con el nombre del archivo. */
  const [modoProveedor, setModoProveedor] = useState('existente');

  // Preselección: el exacto directo; sin exacto, el candidato más parecido —
  // solo si el desplegable está vacío, para no pisar una elección hecha a mano.
  useEffect(() => {
    if (!deteccion || proveedorId) return;
    const sugerido = deteccion.exacto ?? deteccion.candidatos[0];
    if (sugerido) setProveedorId(String(sugerido.id));
  }, [deteccion]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Cada archivo se reconoce por sus columnas, así que el orden en que se
   * cargan no importa: si alguien pone el de ventas donde va el de compras, se
   * acomoda solo en vez de importar cualquier cosa.
   */
  const cargar = async (files) => {
    setLeyendo(true);
    const nuevos = { ...archivos };
    const rechazados = [];
    for (const file of files) {
      try {
        const texto = await leerTexto(file);
        const { cols, filas } = parseCsv(texto);
        const tipo = tipoDeArchivo(cols);
        if (!tipo) { rechazados.push(file.name); continue; }
        nuevos[tipo] = { nombre: file.name, filas };
      } catch {
        rechazados.push(file.name);
      }
    }
    setArchivos(nuevos);
    setLeyendo(false);
    if (rechazados.length) {
      toast(`No reconocí ${rechazados.join(', ')}: no tiene las columnas de ninguno de los tres listados.`, 'err');
    }
  };

  const plan = useMemo(() => {
    if (!archivos.maestro) return null;
    return armarPlan(
      {
        maestro: archivos.maestro.filas,
        compras: archivos.compras?.filas ?? [],
        ventas: archivos.ventas?.filas ?? [],
      },
      {
        listaMinorista: listaMinorista ? Number(listaMinorista) : null,
        listaMayorista: listaMayorista ? Number(listaMayorista) : null,
        publicarConMayorista,
        redondeo: store.state.configVentas?.redondeoPrecio ?? 1,
      },
    );
  }, [archivos, listaMinorista, listaMayorista, publicarConMayorista, store.state.configVentas]);

  const continuar = () => {
    if (paso === 1) {
      if (!archivos.maestro) { toast('Falta el listado de productos.', 'err'); return; }
      if (!archivos.compras) toast('Sin el archivo de formatos de compra, los productos entran sin costo.', 'err');
      setPaso(2);
    } else if (paso === 2) {
      const creaNuevo = deteccion && !deteccion.exacto && modoProveedor === 'nuevo';
      if (!creaNuevo && !proveedorId) { toast('Elegí de qué proveedor es este catálogo.', 'err'); return; }
      if (!plan?.items.length) { toast('No hay ningún producto para importar.', 'err'); return; }
      setPaso(3);
    }
  };

  const importar = async () => {
    setGuardando(true);
    let provId = Number(proveedorId);
    // El proveedor NUEVO se crea recién acá, con el importe confirmado: si la
    // vista previa se cancela, no queda un proveedor colgado en el padrón.
    if (deteccion && !deteccion.exacto && modoProveedor === 'nuevo') {
      const r = await store.crearProveedor({ nombre: deteccion.nombre, proveeMercaderia: true });
      if (!r || r.ok === false) {
        setGuardando(false);
        toast(r?.error || 'No se pudo crear el proveedor.', 'err');
        return;
      }
      provId = r.id;
      setProveedorId(String(provId));
    }
    const res = await store.importarCatalogo(provId, plan.items);
    setGuardando(false);
    if (!res.ok) { toast(res.error || 'No se pudo importar.', 'err'); return; }
    const r = res.data ?? res;
    setResultado(r);
    toast(`${r.creados} producto(s) importados${r.vinculados?.length ? ` y ${r.vinculados.length} vinculados` : ''}.`, 'ok');
  };

  /* ------------------------------- resultado ------------------------------- */
  if (resultado) {
    const prov = store.getProveedor(Number(proveedorId));
    return (
      <ModalShell
        title="Catálogo importado"
        wide
        onClose={closeModal}
        footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}
      >
        <div className={cx(s.callout, s.ok)}>
          Se crearon <strong>{resultado.creados}</strong> productos de <strong>{prov?.nombre ?? deteccion?.nombre ?? '—'}</strong>.
          {resultado.marcasCreadas?.length > 0 && <> Marcas nuevas: {resultado.marcasCreadas.join(', ')}.</>}
          {resultado.rubrosCreados?.length > 0 && <> Rubros nuevos: {resultado.rubrosCreados.join(', ')}.</>}
        </div>
        {/* Los que YA EXISTÍAN (los trajo otro proveedor primero): no se crean
            de nuevo — se les agrega el formato de compra de ESTE proveedor. */}
        {resultado.vinculados?.length > 0 && (
          <>
            <div className={s['section-title']}>
              Ya existían — se les agregó este proveedor ({resultado.vinculados.length})
            </div>
            <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Precio' }]}>
              {resultado.vinculados.map((x, i) => (
                <tr key={i}>
                  <td className={s.mono}>{x.codigo}</td>
                  <td>{x.nombre}</td>
                  <td>{x.fijaPrecio
                    ? 'Pasa a fijar el precio (no tenía ningún formato)'
                    : 'Lo sigue fijando el proveedor anterior'}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
        {resultado.saltados?.length > 0 && (
          <>
            <div className={s['section-title']}>No entraron ({resultado.saltados.length})</div>
            <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Por qué' }]}>
              {resultado.saltados.map((x, i) => (
                <tr key={i}>
                  <td className={s.mono}>{x.codigo || '—'}</td>
                  <td>{x.nombre || '—'}</td>
                  <td>{x.motivo}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
        {plan?.cambiosGrandes?.length > 0 && (
          <div className={cx(s.callout, s.warn)}>
            Acordate de revisar los <strong>{plan.cambiosGrandes.length} precios</strong> que se
            movieron más del 15% contra la factura del proveedor: quedaron con el costo real, pero
            el dato de origen estaba en duda.
          </div>
        )}
        <div className={s.hint}>
          El stock arranca en cero: entra con la primera factura de compra de este proveedor.
        </div>
      </ModalShell>
    );
  }

  const footer = paso === 3
    ? [
      { texto: 'Volver', clase: 'btn-ghost', onClick: () => setPaso(2) },
      {
        texto: guardando ? 'Importando…' : `Importar ${plan?.items.length ?? 0} productos`,
        clase: 'btn-primary',
        onClick: guardando ? () => {} : importar,
      },
    ]
    : [
      paso === 1
        ? { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal }
        : { texto: 'Volver', clase: 'btn-ghost', onClick: () => setPaso(paso - 1) },
      { texto: 'Continuar', clase: 'btn-primary', onClick: continuar },
    ];

  return (
    <ModalShell
      title="Importar catálogo de un proveedor"
      subtitle={`Paso ${paso} de 3 · ${PASOS[paso - 1]}`}
      size="lg"
      onClose={closeModal}
      footer={footer}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {PASOS.map((label, i) => <Paso key={label} n={i + 1} actual={paso} label={label} />)}
      </div>

      {/* ===================== PASO 1 · ARCHIVOS ===================== */}
      {paso === 1 && (
        <>
          <div className={cx(s.callout, s.info)}>
            Los tres listados que exporta el sistema de gestión anterior, tal como salen (no hace
            falta abrirlos ni convertirlos). Se reconocen por sus columnas, así que podés cargarlos
            todos juntos y en cualquier orden.
          </div>

          <label
            style={{
              display: 'block', border: '2px dashed var(--crm-color-border)', borderRadius: 10,
              padding: 22, textAlign: 'center', cursor: 'pointer', marginBottom: 14,
            }}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { cargar([...e.target.files]); e.target.value = ''; }}
            />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {leyendo ? 'Leyendo…' : 'Elegí los archivos .csv'}
            </div>
            <div className={s.hint} style={{ margin: 0 }}>
              Se pueden cargar de a uno o los tres juntos.
            </div>
          </label>

          <Table cols={[{ h: 'Listado' }, { h: 'Archivo' }, { h: 'Filas', num: true }]}>
            {Object.entries(ARCHIVOS).map(([clave, meta]) => {
              const a = archivos[clave];
              return (
                <tr key={clave}>
                  <td>
                    <strong>{meta.label}</strong>
                    {meta.obligatorio && <span className={s.req}> *</span>}
                    <div className={s.hint} style={{ margin: 0 }}>{meta.ayuda}</div>
                  </td>
                  <td>
                    {a
                      ? <span className={cx(s.badge, s['badge-entero'])}>{a.nombre}</span>
                      : <span className={s.muted}>—</span>}
                  </td>
                  <td className={s.num}>{a ? fmtNum(a.filas.length, 0) : '—'}</td>
                </tr>
              );
            })}
          </Table>
        </>
      )}

      {/* ===================== PASO 2 · OPCIONES ===================== */}
      {paso === 2 && (
        <>
          {/* El archivo dice de quién es el catálogo: si el nombre no está en el
              padrón TAL CUAL, se pregunta — asignarlo a un parecido o crearlo.
              Crear el duplicado en silencio era el error que esto evita. */}
          {deteccion && !deteccion.exacto && (
            <div className={cx(s.callout, s.warn)}>
              El archivo dice que este catálogo es de <strong>«{deteccion.nombre}»</strong>, y en el
              padrón no hay ningún proveedor con ese nombre exacto.
              {deteccion.candidatos.length > 0 && (
                <> Hay {deteccion.candidatos.length === 1 ? 'uno parecido' : 'parecidos'}:{' '}
                  <strong>{deteccion.candidatos.map((c) => c.nombre).join(' · ')}</strong>.</>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={modoProveedor === 'existente'}
                    onChange={() => setModoProveedor('existente')}
                  />
                  <span>Es uno que <strong>ya está cargado</strong> con otro nombre — lo elijo abajo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={modoProveedor === 'nuevo'}
                    onChange={() => setModoProveedor('nuevo')}
                  />
                  <span>Es un proveedor <strong>nuevo</strong>: crearlo como «{deteccion.nombre}» al importar</span>
                </label>
              </div>
            </div>
          )}

          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Proveedor del catálogo <span className={s.req}>*</span></label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                disabled={deteccion && !deteccion.exacto && modoProveedor === 'nuevo'}
              >
                <option value="">Elegí el proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                {deteccion?.exacto
                  ? <>Detectado del archivo: <strong>«{deteccion.nombre}»</strong>. </>
                  : deteccion && modoProveedor === 'nuevo'
                    ? <>Se crea <strong>«{deteccion.nombre}»</strong> al importar; la ficha se completa después en Proveedores. </>
                    : null}
                Todos los formatos de compra se cargan a su nombre, con el código con el que él
                identifica cada producto.
              </div>
              {deteccion?.otros?.length > 0 && (
                <div className={s.hint} style={{ margin: '6px 0 0' }}>
                  Ojo: el archivo trae además filas de{' '}
                  {deteccion.otros.map(([n, c]) => `${n} (${c})`).join(' · ')} — todo se importa a
                  nombre del proveedor elegido.
                </div>
              )}
            </div>
          </div>

          <div className={s['section-title']}>A qué listas van sus precios</div>
          <div className={s.hint} style={{ marginTop: 0 }}>
            El sistema viejo numera sus listas; acá se elige a cuál de las tuyas corresponde cada
            una. Las demás listas del archivo (espejos y precios que quedaron sin actualizar) no
            se importan.
          </div>
          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Su lista 1 · Minorista</label>
              <select value={listaMinorista} onChange={(e) => setListaMinorista(e.target.value)}>
                <option value="">No importar</option>
                {listas.map((l) => <option key={l.id} value={l.id}>{l.etiqueta}</option>)}
              </select>
            </div>
            <div className={s.field}>
              <label>Su lista 2 · Mayorista</label>
              <select value={listaMayorista} onChange={(e) => setListaMayorista(e.target.value)}>
                <option value="">No importar</option>
                {listas.map((l) => <option key={l.id} value={l.id}>{l.etiqueta}</option>)}
              </select>
            </div>
          </div>

          <label className={s['granel-toggle']} style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={publicarConMayorista}
              onChange={(e) => setPublicarConMayorista(e.target.checked)}
            />
            <span>
              <span className={s['t-title']}>Publicar en la tienda solo lo que tenga precio mayorista</span><br />
              <span className={s['t-sub']}>
                Destildado, se respeta lo que decía el archivo. Siempre se puede cambiar producto
                por producto después.
              </span>
            </span>
          </label>

          <div className={cx(s.callout, s.info)} style={{ marginTop: 12 }}>
            <strong>Lo que el importador decide solo:</strong> los paquetes fraccionados
            (x100g, x250g, x1kg) entran como <strong>presentaciones</strong> de su producto, no
            como productos aparte; el <strong>rubro</strong> se deduce del nombre; y
            &ldquo;GRANEL&rdquo; o &ldquo;VARIOS&rdquo; no se toman como marca.
          </div>
        </>
      )}

      {/* ===================== PASO 3 · VISTA PREVIA ===================== */}
      {paso === 3 && plan && (
        <>
          <div className={cx(s.callout, s.ok)}>
            <strong>{plan.resumen.productos} productos</strong> ({plan.resumen.granel} a granel ·{' '}
            {plan.resumen.enteros} envasados) · <strong>{plan.resumen.presentaciones} presentaciones</strong> ·{' '}
            <strong>{plan.resumen.formatosVenta} precios</strong> · {plan.resumen.publicados} a la tienda
            {plan.resumen.conIvaReducido > 0 && <> · {plan.resumen.conIvaReducido} con IVA reducido</>}
          </div>

          <div className={s.hint} style={{ marginTop: 0 }}>
            <strong>Rubros:</strong> {plan.resumen.rubros.map(([k, v]) => `${k} (${v})`).join(' · ')}
            <br />
            <strong>Marcas:</strong> {plan.resumen.marcas.join(', ') || 'ninguna'} · sin marca: {plan.resumen.sinMarca}
          </div>

          {plan.cambiosGrandes.length > 0 && (
            <>
              <div className={s['section-title']}>
                ⚠ Revisar antes de vender: {plan.cambiosGrandes.length} precios se mueven más del 15%
              </div>
              <div className={cx(s.callout, s.warn)}>
                En estos, el costo del producto y el de su paquete <strong>no coinciden</strong> en
                el archivo: uno de los dos está mal. El precio que queda sale del costo real de la
                factura, pero conviene mirarlos con el papel del proveedor a mano.
              </div>
              <Table
                cols={[{ h: 'Producto' }, { h: 'Hoy', num: true }, { h: 'Quedaría', num: true }, { h: 'Dif.', num: true }]}
              >
                {plan.cambiosGrandes.map((c, i) => {
                  const d = (c.nuevo / c.viejo - 1) * 100;
                  return (
                    <tr key={i}>
                      <td>{c.nombre}</td>
                      <td className={s.num}>{money(c.viejo)}</td>
                      <td className={cx(s.num, s.mono)}><strong>{money(c.nuevo)}</strong></td>
                      <td className={s.num}>
                        <strong style={{ color: d > 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                          {d > 0 ? '+' : ''}{fmtNum(d, 1)}%
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </>
          )}

          {plan.cambiosChicos.length > 0 && (
            <>
              <div className={s['section-title']}>
                Ajustes normales: {plan.cambiosChicos.length} precios venían atrasados
              </div>
              <Table cols={[{ h: 'Producto' }, { h: 'Hoy', num: true }, { h: 'Quedaría', num: true }, { h: 'Dif.', num: true }]}>
                {plan.cambiosChicos.map((c, i) => {
                  const d = (c.nuevo / c.viejo - 1) * 100;
                  return (
                    <tr key={i}>
                      <td>{c.nombre}</td>
                      <td className={s.num}>{money(c.viejo)}</td>
                      <td className={cx(s.num, s.mono)}>{money(c.nuevo)}</td>
                      <td className={s.num}>{d > 0 ? '+' : ''}{fmtNum(d, 1)}%</td>
                    </tr>
                  );
                })}
              </Table>
            </>
          )}

          <div className={s.hint}>
            Los otros <strong>{Math.max(0, plan.resumen.preciosIguales)}</strong> precios quedan
            iguales a los del sistema viejo.
          </div>

          {plan.avisos.length > 0 && (
            <>
              <div className={s['section-title']}>Avisos ({plan.avisos.length})</div>
              <ul className={s.lista} style={{ margin: 0, paddingLeft: 18 }}>
                {plan.avisos.map((a, i) => (
                  <li key={i} className={s.hint} style={{ margin: '0 0 4px' }}>{a.texto}</li>
                ))}
              </ul>
            </>
          )}

          <div className={s['section-title']}>Los primeros 8, como van a quedar</div>
          <Table
            cols={[
              { h: 'Producto' }, { h: 'Tipo' }, { h: 'Rubro' }, { h: 'IVA', num: true },
              { h: 'Costo neto', num: true }, { h: 'Present.', num: true }, { h: 'Precios' },
            ]}
          >
            {plan.items.slice(0, 8).map((it, i) => (
              <tr key={i}>
                <td>
                  {it.producto.nombre}
                  <div className={cx(s.hint, s.mono)} style={{ margin: 0 }}>{it.producto.codigoPropio}</div>
                </td>
                <td>{it.producto.esGranel ? 'A granel' : `Entero ×${it.producto.unidadesPorBulto}`}</td>
                <td>{it.producto.subcategoriaNombre}</td>
                <td className={s.num}>{fmtNum(it.producto.iva, 1)}%</td>
                <td className={s.num}>
                  {money(it.netoUnit)}
                  <span className={s.muted}>/{it.producto.esGranel ? 'kg' : 'u'}</span>
                  {it.costoEstimado && <div className={s.hint} style={{ margin: 0 }}>estimado</div>}
                </td>
                <td className={s.num}>{it.presentaciones.length || '—'}</td>
                <td>
                  {it.listas.length
                    ? it.listas.map((l) => `${fmtNum(l.markup, 0)}%`).join(' · ')
                    : <span className={s.muted}>solo stock</span>}
                </td>
              </tr>
            ))}
          </Table>

          <div className={cx(s.callout, s.info)}>
            Se escribe todo junto: si algo falla, no queda nada a medias. Lo que ya exista con el
            mismo código interno <strong>no se toca</strong> — se informa al final. El stock
            arranca en cero.
          </div>
        </>
      )}
    </ModalShell>
  );
}
