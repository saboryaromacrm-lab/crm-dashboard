/**
 * FRACCIONAMIENTO — dos cosas que pasan juntas pero NO son la misma
 * ============================================================================
 *   Fraccionar → mueve stock: descuenta granel y crea paquetes.
 *   Etiquetas  → NO mueve NADA: es una impresora, y por eso vive aparte.
 *
 * Están separadas a pedido del dueño y por el error humano que evita: si sacar
 * etiquetas descontara stock, cada etiqueta arruinada, cada prueba de impresión
 * y cada rollo mal cargado dejaría el inventario mintiendo. Acá se imprime lo
 * que se quiera, todas las veces que se quiera, y el stock lo sigue moviendo
 * únicamente quien fracciona.
 */
import { useEffect, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { analizarCodigo } from '@core/services/barcode.js';
import {
  MAX_ETIQUETAS, configImpresion, cuerpoEtiquetas, formatoPorDefecto,
  htmlDocumento, imprimirDocumento, medidaEtiqueta,
} from '@core/services/imprimir.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { money, num, fmtFechaHora, fmtFechaVenc } from '../domain/format.js';
import { Table, PanelHead, Btn, usePaginado, s } from '../components/ui.jsx';

/** Texto comparable: sin mayúsculas ni acentos. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const PESTANAS = [
  { id: 'fraccionar', label: 'Fraccionar' },
  { id: 'etiquetas', label: 'Etiquetas' },
];

/** Módulo (barra fina) mínimo para que una térmica de 203 dpi lea seguro. */
const MODULO_MIN_MM = 0.25;

export function FraccionamientoPanel() {
  const { can } = useProductos();
  useSeccion('movimientos');
  const puede = can('fraccionar');
  const [pestana, setPestana] = useState('fraccionar');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Fraccionamiento"
        desc="Convertí granel en paquetes en la misma sucursal, y sacá las etiquetas de los paquetes. Fraccionar mueve stock; imprimir etiquetas no toca nada."
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PESTANAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={cx(s.badge)}
            style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 13, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)',
              ...(pestana === v.id
                ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                : {}),
            }}
            onClick={() => setPestana(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {pestana === 'fraccionar' ? <TabFraccionar puede={puede} /> : <TabEtiquetas puede={puede} />}
    </div>
  );
}

/* ============================== FRACCIONAR ============================== */
function TabFraccionar({ puede }) {
  const { store, openModal } = useProductos();
  const [q, setQ] = useState('');

  const ql = norm(q);
  const granel = store.state.stock
    .filter((st) => !st.presentacionId && st.estado === 'disponible' && st.cantidad > 1e-9 && store.getProducto(st.productoId).tipo === 'granel')
    .filter((st) => {
      if (!ql) return true;
      const p = store.getProducto(st.productoId);
      return norm(p.nombre).includes(ql) || norm(p.marca).includes(ql);
    });

  const pag = usePaginado(granel, 'fraccionamiento', q);

  const filas = pag.visibles.map((st) => {
      const p = store.getProducto(st.productoId), su = store.getSucursal(st.sucursalId);
      return (
        <tr key={st.id}>
          <td>{p.nombre}</td>
          <td>{su.nombre}</td>
          <td className={s.num}>{num(st.cantidad, 3)} kg</td>
          <td className={s['actions-col']}>
            {puede
              ? <Btn variant="btn-fracc" small onClick={() => openModal('fraccionar', { prodId: p.id, sucId: st.sucursalId })}>Fraccionar</Btn>
              : <span className={s.muted}>sin permiso</span>}
          </td>
        </tr>
      );
    });

  const hist = store.state.movimientos
    .filter((m) => m.tipo === 'fraccionamiento')
    .sort((a, b) => b.id - a.id)
    .slice(0, 8)
    .map((m) => (
      <tr key={m.id}>
        <td>{fmtFechaHora(m.fecha)}</td>
        <td>{m.productoNombre}</td>
        <td>{m.sucursalNombre}</td>
        <td>{m.descripcion}</td>
      </tr>
    ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar producto a granel por nombre o marca..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <h3 className={s['card-title']}>Granel disponible para fraccionar</h3>
      <Table
        cols={[{ h: 'Producto' }, { h: 'Sucursal' }, { h: 'Granel', num: true }, { h: '', cls: 'actions-col' }]}
        empty="No hay stock a granel disponible."
        pag={pag}
      >
        {filas}
      </Table>
      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Fraccionamientos recientes</h3>
      <Table cols={[{ h: 'Fecha' }, { h: 'Producto' }, { h: 'Sucursal' }, { h: 'Detalle' }]} empty="Sin fraccionamientos aún.">
        {hist}
      </Table>
    </div>
  );
}

/* ============================== ETIQUETAS ============================== */
/**
 * La etiqueta del paquete: nombre, peso, precio, código de barras y
 * vencimiento. Se elige el FRACCIONADO (no el producto: el peso, el precio y el
 * código son de la presentación), cuántas etiquetas y con qué fecha.
 *
 * El precio NO se tipea: sale del catálogo (lista base, IVA incluido), igual que
 * en la caja. Una etiqueta con un precio escrito a mano es un precio que en dos
 * semanas no coincide con el POS y discute con el cliente.
 */
function TabEtiquetas({ puede }) {
  const { store, toast } = useProductos();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);      // { prodId, presId }
  const [cant, setCant] = useState('1');
  const [venc, setVenc] = useState('');
  const [cfg, setCfg] = useState(null);      // config de impresión (el tamaño de la etiqueta)

  useEffect(() => { configImpresion().then(setCfg).catch(() => { /* el shell ya avisa la falta de conexión */ }); }, []);

  /* Los FRACCIONADOS del catálogo: cada presentación de un granel activo. Un
   * producto sin presentaciones no aparece — no hay etiqueta que sacarle. */
  const fraccionados = [];
  for (const p of store.state.productos) {
    if (p.tipo !== 'granel' || (p.estado || 'activo') !== 'activo') continue;
    for (const pr of p.presentaciones || []) fraccionados.push({ p, pr });
  }

  const ql = norm(q);
  const encontrados = ql
    ? fraccionados.filter(({ p, pr }) => norm(p.nombre).includes(ql) || norm(p.marca).includes(ql)
      || (pr.codigoBarras || '').includes(q.trim()))
    : fraccionados;
  const pag = usePaginado(encontrados, 'etiquetas', q);

  const elegido = sel ? fraccionados.find(({ p, pr }) => p.id === sel.prodId && pr.id === sel.presId) : null;

  const filas = pag.visibles.map(({ p, pr }) => {
    const activa = sel && sel.prodId === p.id && sel.presId === pr.id;
    return (
      <tr key={`${p.id}-${pr.id}`} style={activa ? { background: 'var(--crm-color-primary-soft, rgba(22,101,52,.08))' } : undefined}>
        <td>{p.nombre}{p.marca ? <span className={s.muted}> · {p.marca}</span> : null}</td>
        <td>{store.presLabel(p, pr.id)}</td>
        <td className={cx(s.num, s.mono)}>{money(store.precioFinal(store.precioPresentacion(p, pr), p.iva))}</td>
        <td className={s.mono}>{pr.codigoBarras || <span className={s.muted}>sin código</span>}</td>
        <td className={s['actions-col']}>
          <Btn small variant={activa ? 'btn-primary' : undefined} onClick={() => setSel({ prodId: p.id, presId: pr.id })}>
            {activa ? 'Elegido' : 'Elegir'}
          </Btn>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
        <strong>Imprimir etiquetas no mueve stock.</strong> Sacá las que necesites, y las que salgan
        mal tiralas sin miedo: el inventario lo cambia solamente la pestaña <strong>Fraccionar</strong>.
      </div>

      <div className={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar el fraccionado por nombre, marca o código de barras..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Table
        cols={[{ h: 'Producto' }, { h: 'Tamaño' }, { h: 'Precio', num: true }, { h: 'Código de barras' }, { h: '', cls: 'actions-col' }]}
        empty="No hay fraccionados en el catálogo: primero cargale presentaciones al producto a granel."
        pag={pag}
      >
        {filas}
      </Table>

      {elegido && (
        <FormEtiqueta
          p={elegido.p}
          pr={elegido.pr}
          store={store}
          toast={toast}
          puede={puede}
          cfg={cfg}
          cant={cant}
          setCant={setCant}
          venc={venc}
          setVenc={setVenc}
        />
      )}
    </div>
  );
}

/** Lo que se imprime, y el aviso de por qué podría no leerse. */
function FormEtiqueta({ p, pr, store, toast, puede, cfg, cant, setCant, venc, setVenc }) {
  const formato = cfg?.impresion?.etiquetaFraccionado || formatoPorDefecto('etiquetaFraccionado');
  const medida = medidaEtiqueta(formato);
  const info = analizarCodigo(pr.codigoBarras);
  const precio = money(store.precioFinal(store.precioPresentacion(p, pr), p.iva));
  const peso = store.presLabel(p, pr.id);
  const n = Math.round(Number(cant) || 0);
  const cantOk = n >= 1 && n <= MAX_ETIQUETAS;

  /* Cuánto mide cada barra fina en ESTA etiqueta. Un código largo en una
   * etiqueta angosta se imprime igual de lindo y el lector no lo lee nunca. */
  const moduloMm = medida && info.modulos ? medida.anchoUtilMm / info.modulos : null;
  const finito = moduloMm != null && moduloMm < MODULO_MIN_MM;

  const datos = {
    nombre: p.nombre, peso, precio, codigo: info.codigo,
    vencimiento: venc ? fmtFechaVenc(venc) : '',
  };

  /* La MISMA función para la vista previa y para la impresora. */
  const previa = cfg
    ? htmlDocumento({ empresa: cfg.empresa, formato, titulo: 'Etiqueta', cuerpo: cuerpoEtiquetas({ ...datos, cantidad: 1 }) })
    : '';

  const imprimir = async () => {
    if (!cantOk) { toast(`Poné una cantidad de etiquetas entre 1 y ${MAX_ETIQUETAS}.`, 'err'); return; }
    const ok = await imprimirDocumento('etiquetaFraccionado', {
      titulo: `Etiquetas ${p.nombre} ${peso}`,
      cuerpo: cuerpoEtiquetas({ ...datos, cantidad: n }),
    });
    if (!ok) { toast('El navegador bloqueó la ventana de impresión: permitile abrir ventanas emergentes.', 'err'); return; }
    toast(`${n} ${n === 1 ? 'etiqueta' : 'etiquetas'} a la impresora. El stock no se tocó.`, 'ok');
  };

  return (
    <div className={s.card}>
      <h3 className={s['card-title']} style={{ marginTop: 0 }}>
        Etiquetas de {p.nombre} · {peso}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Cantidad de etiquetas</label>
          <input
            type="number" min="1" max={MAX_ETIQUETAS} step="1" value={cant}
            onChange={(e) => setCant(e.target.value)}
          />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Una por paquete armado. Hasta {MAX_ETIQUETAS} por impresión.</div>
        </div>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Fecha de vencimiento</label>
          <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>
            {venc ? `Sale impresa: Vto ${fmtFechaVenc(venc)}` : 'Vacía: la etiqueta sale SIN fecha.'}
          </div>
        </div>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Precio que se imprime</label>
          <strong className={s.mono} style={{ fontSize: 16 }}>{precio}</strong>
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Del catálogo, IVA incluido{nombreListaBase(store) ? ` (lista ${nombreListaBase(store)})` : ''}. Se cambia en el producto madre.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {puede
            ? (
              <Btn variant="btn-primary" onClick={imprimir} disabled={!cfg || !cantOk}>
                {cantOk ? `Imprimir ${n} ${n === 1 ? 'etiqueta' : 'etiquetas'}` : 'Imprimir etiquetas'}
              </Btn>
            )
            : <span className={s.muted}>sin permiso para imprimir</span>}
        </div>
      </div>

      {info.aviso && (
        <div className={cx(s.callout, info.tipo === 'ean13' ? s.ok : s.warn)} style={{ marginTop: 12 }}>
          {info.aviso}
        </div>
      )}
      {finito && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 8 }}>
          <strong>El código puede no leerse en esta etiqueta.</strong> Ocupa {info.modulos} barras en los{' '}
          {num(medida.anchoUtilMm, 1)} mm útiles de la etiqueta de {medida.anchoMm} × {medida.altoMm} mm: cada barra
          queda en {num(moduloMm, 2)} mm y una térmica necesita {num(MODULO_MIN_MM, 2)} mm.
          Elegí una etiqueta más ancha en <strong>Sistema › Impresión</strong> o pasá el código a EAN-13.
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div className={s['mini-label']}>
            Vista previa {medida ? `· etiqueta de ${medida.anchoMm} × ${medida.altoMm} mm` : ''}
          </div>
          {/* El MISMO HTML que va a la impresora, en TAMAÑO REAL: lo que se ve
              es lo que sale. `scrolling=no` y los 2 px de más son para que el
              marco del iframe no le ponga barras de scroll encima. */}
          <iframe
            title="Vista previa de la etiqueta"
            srcDoc={previa}
            scrolling="no"
            style={{
              width: medida ? `${Math.ceil(medida.anchoMm * 3.7795) + 2}px` : 200,
              height: medida ? `${Math.ceil(medida.altoMm * 3.7795) + 2}px` : 120,
              border: '1px dashed var(--crm-color-border)', background: '#fff',
            }}
          />
        </div>
        <div className={s.hint} style={{ maxWidth: 380, margin: 0 }}>
          El tamaño de la etiqueta se configura una vez en <strong>Sistema › Impresión</strong> (hoy:{' '}
          {medida ? `${medida.anchoMm} × ${medida.altoMm} mm` : 'sin definir'}), y la impresora física la
          elige cada puesto en el diálogo de impresión. Antes de tirar una tanda larga, pasale el lector
          a UNA etiqueta.
        </div>
      </div>
    </div>
  );
}

/** Nombre de la lista base (la del precio de mostrador), si se puede saber. */
function nombreListaBase(store) {
  const baseId = store.state.configVentas?.listaBaseId;
  const lista = (store.state.listasCatalogo?.listas ?? []).find((l) => l.id === baseId);
  return lista?.nombre || '';
}
