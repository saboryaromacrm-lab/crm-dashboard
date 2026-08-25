/**
 * CARTELES DE GÓNDOLA (0083) — el precio que el cliente lee en el estante
 * ============================================================================
 * Para que el cliente vea el precio sin tener que preguntarle al cajero. Misma
 * etiqueta autoadhesiva que los fraccionados, con el nombre más grande y sin
 * código de barras: nadie escanea un cartel.
 *
 * POR QUÉ ES UNA LISTA Y NO DE A UNO. El de fraccionados imprime un producto
 * por vez, que para un paquete alcanza. Pero rehacer una góndola son quince o
 * veinte carteles, y de a uno no lo hace nadie: se buscan, se van sumando y
 * salen todos juntos.
 *
 * POR QUÉ EL TEXTO SE GUARDA. El nombre del catálogo sirve para buscar y
 * facturar —"Aceite de oliva intenso lata x500ml"—, no para leerse a un metro.
 * El texto corto se escribe una vez y queda: cuando cambia un precio, rehacer
 * el cartel es apretar Imprimir. Si viviera solo en la impresión habría que
 * reescribirlo en cada actualización, y el que tiene que reescribir veinte
 * carteles termina imprimiendo el nombre largo.
 *
 * EL PRECIO NO SE TIPEA — misma regla que la etiqueta del fraccionado, y acá
 * pesa más: el cliente lee el cartel y la caja le cobra lo que dice el sistema.
 * Un precio escrito a mano es un precio exhibido que no coincide con el
 * cobrado. Se puede SACAR (cartel sin precio), que es otra cosa que inventarlo.
 */
import { useEffect, useMemo, useState } from 'react';
import { useVentas } from '../context/VentasContext.jsx';
import { ventasApi } from '../services/ventas.api.js';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import {
  MAX_ETIQUETAS, configImpresion, cuerpoCartelGondola, formatoPorDefecto,
  htmlDocumento, imprimirDocumento, invalidarConfigImpresion, plantillaCartelGuardada,
} from '@core/services/imprimir.js';
import { Btn, s } from '../components/ui.jsx';
import { AyudaEncabezadoNavegador } from '@modules/productos/components/AyudaEncabezado.jsx';
import { DisenadorCartel } from '../components/DisenadorCartel.jsx';

const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const money = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Qué dice cada línea: lo guardado si se personalizó, y si no el dato del
 * producto. `null` es "no se personalizó"; `''` es "no imprimir esta línea", y
 * por eso la comparación es contra `null` y no un `||`, que trataría al vacío
 * como si no existiera y volvería a poner el nombre largo.
 */
const textoMarca = (p) => (p.etiquetaMarca == null ? (p.marca || '') : p.etiquetaMarca);
const textoNombre = (p) => (p.etiquetaNombre == null ? (p.nombre || '') : p.etiquetaNombre);

export function CartelesPanel() {
  const { ctx, toast } = useVentas();
  const [catalogo, setCatalogo] = useState(null);
  const [errorCat, setErrorCat] = useState('');
  const [cfg, setCfg] = useState(null);
  const [q, setQ] = useState('');
  /** Los renglones a imprimir: `{ prodId, marca, nombre, cant }`. */
  const [filas, setFilas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  /*
   * EL CATÁLOGO VA CON SUCURSAL: el endpoint la exige (sin ella responde 400).
   * Los PRECIOS son los mismos en los cinco locales —no hay precio por
   * sucursal—, así que el cartel sirve igual en todos; la sucursal es del
   * endpoint, no del cartel.
   *
   * Y el error se MUESTRA en vez de tragarse: la primera versión caía a un
   * catálogo vacío y la pantalla decía "nada coincide", que manda a buscar el
   * problema en el producto cuando estaba en la llamada.
   */
  useEffect(() => {
    if (!ctx.sucursalId) return;
    setErrorCat('');
    ventasApi.catalogo(ctx.sucursalId)
      .then(setCatalogo)
      .catch((e) => {
        setCatalogo({ items: [], listas: [] });
        setErrorCat(e?.data?.message || 'No se pudo leer el catálogo de precios.');
      });
    configImpresion().then(setCfg).catch(() => { /* el shell ya avisa la falta de conexión */ });
  }, [ctx.sucursalId]);

  /* En un `useMemo` y no suelto: `?? []` crea un array nuevo en cada render, y
   * eso invalidaba el memo del buscador en cada tecla. */
  const items = useMemo(() => catalogo?.items ?? [], [catalogo]);

  /*
   * QUÉ LISTA ES "MINORISTA" Y CUÁL "MAYORISTA". Se resuelve por MODALIDAD y no
   * por id fijo: los ids dependen de cómo se sembró cada base, y clavarlos acá
   * haría que el cartel imprima el precio equivocado en cuanto alguien agregue
   * una lista. De cada modalidad se toma la primera (la de menor número), que
   * es la lista base de esa modalidad.
   */
  const { listaMin, listaMay } = useMemo(() => {
    const ls = [...(catalogo?.listas ?? [])].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
    /* `listaId`, NO `id`: así se llama la clave en el catálogo de ventas, y
     * usar `id` devolvía `undefined` — todos los carteles salían sin precio.
     * De cada modalidad se toma la BASE si está marcada, y si no la de menor
     * número: es la misma que la caja usa por defecto. */
    const de = (mod) => {
      const dela = ls.filter((l) => norm(l.modalidad).includes(mod));
      return (dela.find((l) => l.esBase) ?? dela[0])?.listaId ?? null;
    };
    return { listaMin: de('minorista'), listaMay: de('mayorista') };
  }, [catalogo]);

  const precioDe = (p, listaId) => {
    if (listaId == null) return null;
    const e = (p.precios ?? []).find((x) => x.listaId === listaId);
    return e && e.precioFinal > 0 ? e.precioFinal : null;
  };

  /* Solo ENTEROS: el cartel es del producto de góndola. Los fraccionados tienen
   * su propia etiqueta, que va pegada al paquete y lleva peso y código. */
  const candidatos = useMemo(() => {
    const ql = norm(q);
    return items
      .filter((p) => p.tipo !== 'granel')
      .filter((p) => !ql || norm(p.nombre).includes(ql) || norm(p.marca).includes(ql))
      .slice(0, 30);
  }, [items, q]);

  const agregar = (p) => {
    setFilas((rows) => (rows.some((r) => r.prodId === p.productoId)
      ? rows
      : [...rows, { prodId: p.productoId, marca: textoMarca(p), nombre: textoNombre(p), cant: '1' }]));
    setQ('');
  };

  /** Un cartel sin producto: "ACEITES", "OFERTAS". No se guarda en ningún lado. */
  const agregarLibre = () => setFilas((rows) => [...rows, { prodId: null, marca: '', nombre: '', cant: '1' }]);

  const setFila = (i, patch) => setFilas((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const quitar = (i) => setFilas((rows) => rows.filter((_, j) => j !== i));

  const datosDe = (f) => {
    const p = f.prodId ? items.find((x) => x.productoId === f.prodId) : null;
    const min = p ? precioDe(p, listaMin) : null;
    const may = p ? precioDe(p, listaMay) : null;
    return {
      marca: f.marca,
      nombre: f.nombre,
      precio: min == null ? '' : money(min),
      /* La segunda línea sale SOLO si el producto tiene precio mayorista
       * cargado. Algunos lo tienen y otros no, y no hace falta configurar nada
       * por producto: si no hay dato, no hay línea. */
      precioMayorista: may == null ? '' : money(may),
      cantidad: Math.max(1, Math.round(Number(f.cant) || 1)),
    };
  };

  const total = filas.reduce((a, f) => a + Math.max(1, Math.round(Number(f.cant) || 1)), 0);
  const formato = cfg?.impresion?.etiquetaGondola || formatoPorDefecto('etiquetaGondola');

  /* LA PLANTILLA DISEÑADA A MANO (25/8): posiciones en mm por formato, armadas
   * arrastrando en el editor. Null = diseño estándar proporcional. */
  const plantilla = plantillaCartelGuardada(cfg?.impresion, formato);
  const [disenando, setDisenando] = useState(false);
  const [guardandoDiseno, setGuardandoDiseno] = useState(false);

  /** Guarda (o borra, con null) la plantilla de ESTE formato, sin tocar las otras. */
  const guardarPlantilla = async (nueva) => {
    setGuardandoDiseno(true);
    try {
      let todas = {};
      try { todas = JSON.parse(cfg?.impresion?.plantillaCartel || '') || {}; } catch { todas = {}; }
      if (nueva) todas[formato] = nueva; else delete todas[formato];
      const impresion = await httpClient.put('/configuracion/impresion', {
        plantillaCartel: Object.keys(todas).length ? JSON.stringify(todas) : '',
      });
      invalidarConfigImpresion();
      setCfg((c) => ({ ...c, impresion }));
      setDisenando(false);
      toast(nueva
        ? 'Diseño guardado: todos los carteles de este tamaño salen así.'
        : 'Se volvió al diseño estándar.', 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar el diseño (hace falta el permiso de Impresión de Sistema).', 'err');
    } finally { setGuardandoDiseno(false); }
  };

  /* La MISMA función que la impresora, con la primera fila de muestra. */
  const previa = cfg && filas.length
    ? htmlDocumento({
      empresa: cfg.empresa,
      formato,
      titulo: 'Cartel',
      cuerpo: cuerpoCartelGondola({ ...datosDe(filas[0]), cantidad: 1, plantilla }),
    })
    : '';

  /** Guarda el texto de los renglones que se editaron, para no retipearlos. */
  const guardarTextos = async () => {
    const conProducto = filas.filter((f) => f.prodId);
    if (!conProducto.length) { toast('No hay ningún producto en la lista para guardar.', 'err'); return; }
    setGuardando(true);
    let n = 0;
    try {
      for (const f of conProducto) {
        const p = items.find((x) => x.productoId === f.prodId);
        if (!p) continue;
        if (f.marca === textoMarca(p) && f.nombre === textoNombre(p)) continue;
        /* Si el texto quedó IGUAL al del producto se manda `null`: eso lo deja
         * "sin personalizar" y el cartel sigue al catálogo si mañana cambia el
         * nombre. Guardar una copia idéntica congelaría el nombre sin querer. */
        await httpClient.patch(`/productos/${f.prodId}/cartel`, {
          etiquetaMarca: f.marca === (p.marca || '') ? null : f.marca,
          etiquetaNombre: f.nombre === (p.nombre || '') ? null : f.nombre,
        });
        n += 1;
      }
      if (n) {
        const fresco = await ventasApi.catalogo(ctx.sucursalId);
        setCatalogo(fresco);
      }
      toast(n ? `${n} cartel(es) guardado(s): la próxima vez salen así.` : 'No había nada nuevo para guardar.', 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar el texto del cartel.', 'err');
    } finally { setGuardando(false); }
  };

  const imprimir = async () => {
    if (!filas.length) { toast('Agregá al menos un producto.', 'err'); return; }
    if (total > MAX_ETIQUETAS) { toast(`Son ${total} carteles y el tope es ${MAX_ETIQUETAS}.`, 'err'); return; }
    const cuerpo = filas.map((f) => cuerpoCartelGondola({ ...datosDe(f), plantilla })).join('');
    const ok = await imprimirDocumento('etiquetaGondola', { titulo: 'Carteles de góndola', cuerpo });
    if (!ok) { toast('El navegador bloqueó la ventana de impresión: permitile abrir ventanas emergentes.', 'err'); return; }
    toast(`${total} cartel(es) a la impresora.`, 'ok');
  };

  if (catalogo === null) return <div className={s.hint}>Cargando el catálogo…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div>
        <h2 className={s['card-title']} style={{ margin: 0 }}>Carteles de góndola</h2>
        <div className={s.hint} style={{ marginTop: 4 }}>
          El precio que el cliente lee en el estante, para que no tenga que preguntarle al cajero.
          El texto se guarda por producto: cuando cambie el precio, es volver acá y apretar Imprimir.
        </div>
      </div>

      {errorCat && <div className={cx(s.callout, s.warn)}>{errorCat}</div>}

      {/* ---- Buscar y agregar ---- */}
      <div className={s.card}>
        <div className={s.toolbar}>
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un producto por nombre o marca…"
          />
          <Btn onClick={agregarLibre}>+ Cartel libre</Btn>
          <Btn onClick={() => setDisenando(true)} title="Acomodar dónde va cada elemento en la etiqueta">
            Diseñar el cartel
          </Btn>
        </div>
        {q && (
          <div style={{ marginTop: 6 }}>
            {candidatos.length === 0 && <div className={s.hint}>Nada coincide entre los productos enteros.</div>}
            {candidatos.map((p) => (
              <div
                key={p.productoId}
                className={s.clickable}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--crm-color-border)', cursor: 'pointer' }}
                onClick={() => agregar(p)}
                title="Agregarlo a la lista con su marca y nombre"
              >
                <span style={{ flex: 1 }}>
                  <strong>{p.nombre}</strong>
                  <span className={s.muted}> · {p.marca || 'Sin marca'}</span>
                </span>
                <span className={s.mono}>{precioDe(p, listaMin) == null ? 'sin precio' : money(precioDe(p, listaMin))}</span>
                {/* La señal de que el renglón ES el botón: el dueño buscó cómo
                    "escoger el producto" teniendo el buscador adelante (25/8) —
                    una fila que no parece apretable no existe. */}
                <span className={cx(s.btn, s['btn-ghost'], s['btn-sm'])} style={{ pointerEvents: 'none' }}>
                  + Agregar
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- La lista a imprimir ---- */}
      {filas.length === 0 ? (
        <div className={cx(s.callout, s.info)}>
          <strong>Escribí en el buscador de arriba y hacé clic en el producto</strong>: se suma a la
          lista con su marca, su nombre y su precio, sin tipear nada. Repetí con todos los que
          quieras — salen todos juntos con un solo Imprimir. <strong>+ Cartel libre</strong> es solo
          para carteles sin producto (&ldquo;ACEITES&rdquo;, la marca sola para toda una góndola).
        </div>
      ) : (
        <div className={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <h3 className={s['card-title']} style={{ margin: 0 }}>
              {filas.length} renglón(es) · {total} cartel(es)
            </h3>
            <span style={{ flex: 1 }} />
            <Btn disabled={guardando} onClick={guardarTextos}>Guardar los textos</Btn>
            <Btn variant="btn-primary" onClick={imprimir}>Imprimir</Btn>
          </div>

          {filas.map((f, i) => {
            const p = f.prodId ? items.find((x) => x.productoId === f.prodId) : null;
            const d = datosDe(f);
            return (
              <div
                key={`${f.prodId ?? 'libre'}-${i}`}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) minmax(200px,2fr) auto auto', gap: 8, alignItems: 'end', padding: '8px 0', borderBottom: '1px solid var(--crm-color-border)' }}
              >
                <div className={s.field} style={{ marginBottom: 0 }}>
                  <label>Marca</label>
                  <input value={f.marca} maxLength={60} onChange={(e) => setFila(i, { marca: e.target.value })} />
                </div>
                <div className={s.field} style={{ marginBottom: 0 }}>
                  <label>Nombre (va grande){p ? '' : ' — cartel libre'}</label>
                  <input value={f.nombre} maxLength={80} onChange={(e) => setFila(i, { nombre: e.target.value })} />
                </div>
                <div className={s.field} style={{ marginBottom: 0, width: 90 }}>
                  <label>Cantidad</label>
                  <input
                    type="number" min="1" step="1" value={f.cant}
                    onChange={(e) => setFila(i, { cant: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
                  <span className={cx(s.mono, s.hint)} style={{ whiteSpace: 'nowrap', margin: 0 }}>
                    {d.precio || (p ? 'sin precio' : '—')}
                    {d.precioMayorista && <> · may. {d.precioMayorista}</>}
                  </span>
                  <button type="button" className={s['pres-remove']} onClick={() => quitar(i)}>×</button>
                </div>
              </div>
            );
          })}

          <div className={s.hint} style={{ marginTop: 8 }}>
            Vaciá un campo y esa línea no se imprime. <strong>El precio no se tipea</strong>: sale del
            catálogo con IVA, el mismo que cobra la caja — si hay que cambiarlo, se cambia el precio y el
            cartel lo sigue solo. La línea de mayorista aparece solo en los productos que tienen ese
            precio cargado.
          </div>
          <AyudaEncabezadoNavegador />
        </div>
      )}

      {/* ---- Vista previa ---- */}
      {previa && (
        <div className={s.card}>
          <h3 className={s['card-title']} style={{ marginTop: 0 }}>Vista previa del primero</h3>
          <iframe
            title="Vista previa del cartel"
            srcDoc={previa}
            style={{ width: 320, height: 260, border: '1px solid var(--crm-color-border)', borderRadius: 'var(--crm-radius-sm)', background: '#fff' }}
          />
          <div className={s.hint}>
            El tamaño sale de <strong>Sistema › Impresión › Cartel de góndola</strong>.
            {plantilla && <> Este tamaño usa un <strong>diseño propio</strong> (botón &ldquo;Diseñar el cartel&rdquo;).</>}
          </div>
        </div>
      )}

      {/* ---- El diseñador: arrastrar cada elemento en la etiqueta real ---- */}
      {disenando && cfg && (
        <DisenadorCartel
          formato={formato}
          inicial={plantilla}
          empresa={cfg.empresa}
          guardando={guardandoDiseno}
          muestra={filas.length ? datosDe(filas[0]) : {
            marca: 'CUMANA', nombre: 'Aceite Oliva Intenso 500ml', precio: '$5.000,00', precioMayorista: '$4.500,00',
          }}
          onGuardar={guardarPlantilla}
          onRestaurar={() => guardarPlantilla(null)}
          onCerrar={() => setDisenando(false)}
        />
      )}
    </div>
  );
}
