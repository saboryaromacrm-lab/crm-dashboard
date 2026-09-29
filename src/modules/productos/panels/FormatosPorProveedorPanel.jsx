/**
 * FORMATOS DE VENTA POR PROVEEDOR — la guía de importación (28/9/2026)
 * ============================================================================
 * Pedido del dueño: "son muchos proveedores y me voy a perder". Los formatos
 * de venta se importan de a un proveedor, y esta pestaña es la lista de
 * control: todos los proveedores con productos, cuáles ya se importaron y
 * cuáles faltan, con el botón para hacerlo ahí mismo.
 *
 * El ORDEN recomendado se ve en la fila: primero los costos del proveedor y
 * después sus formatos de venta — el precio nuevo es markup sobre el costo
 * del ERP, así que con el costo viejo el precio sale mal aunque el markup
 * esté bien.
 *
 * Qué se importó lo dice la API (`/productos/importaciones-por-proveedor`):
 * cada importación queda en la auditoría del proveedor. Cuántos productos
 * tiene cada uno sale del catálogo que el módulo ya tiene en memoria.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { fmtFecha, num } from '../domain/format.js';
import { Btn, PanelHead, Pill, Stat, Table, usePaginado, s } from '../components/ui.jsx';

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const ESTADO = {
  falta: { label: 'Falta', pill: 'est-pendiente', orden: 0 },
  sin_costos: { label: 'Faltan los costos', pill: 'est-revision', orden: 1 },
  importado: { label: 'Importado', pill: 'est-recibida', orden: 2 },
  sin_productos: { label: 'Sin productos', pill: 'est-cancelada', orden: 3 },
};

/** Cuándo y quién, en una línea. */
function Cuando({ imp }) {
  if (!imp) return <span className={s.muted}>—</span>;
  return (
    <div>
      {fmtFecha(imp.fecha)}{imp.usuario ? ` · ${imp.usuario}` : ''}
      {(imp.resumen || imp.fuente === 'historial') && (
        <div className={s.hint} style={{ margin: 0 }}>
          {imp.fuente === 'historial' ? 'según la evolución de precios' : imp.resumen}
        </div>
      )}
    </div>
  );
}

export function FormatosPorProveedorPanel() {
  const { store, openModal, toast, isAdmin } = useProductos();
  const [importaciones, setImportaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('falta');
  const [q, setQ] = useState('');

  const cargar = useCallback(async () => {
    try { setImportaciones(await store.importacionesPorProveedor()); }
    catch { toast('No se pudo leer qué proveedores ya se importaron.', 'err'); }
    finally { setCargando(false); }
  }, [store, toast]);
  // Se vuelve a leer cuando el store versiona: una importación recién hecha
  // pasa a «Importado» sin tener que recargar la pantalla.
  const version = store.getVersion?.() ?? 0;
  useEffect(() => { cargar(); }, [cargar, version]);

  const filas = useMemo(() => {
    const imp = new Map(importaciones.map((i) => [i.proveedorId, i]));
    // Productos vigentes de cada proveedor, contados una sola vez por producto.
    const cuenta = new Map();
    for (const p of store.state.productos) {
      if (p.estado === 'archivado') continue;
      const provs = new Set((p.formatosCompra || p.proveedores || []).map((f) => f.proveedorId));
      for (const id of provs) {
        const c = cuenta.get(id) || { productos: 0, conFormato: 0 };
        c.productos += 1;
        if ((p.listas || []).length) c.conFormato += 1;
        cuenta.set(id, c);
      }
    }
    return store.state.proveedores
      .filter((p) => p.proveeMercaderia !== false)
      .map((p) => {
        const c = cuenta.get(p.id) || { productos: 0, conFormato: 0 };
        const i = imp.get(p.id) || {};
        let estado;
        if (!c.productos) estado = 'sin_productos';
        else if (i.formatos) estado = 'importado';
        else if (!i.costos) estado = 'sin_costos';
        else estado = 'falta';
        return { prov: p, ...c, costos: i.costos ?? null, formatos: i.formatos ?? null, estado };
      })
      .sort((a, b) => ESTADO[a.estado].orden - ESTADO[b.estado].orden
        || b.productos - a.productos
        || a.prov.nombre.localeCompare(b.prov.nombre));
  }, [store.state.productos, store.state.proveedores, importaciones]);

  const conProductos = filas.filter((f) => f.estado !== 'sin_productos');
  const importados = conProductos.filter((f) => f.estado === 'importado').length;
  const pendientes = conProductos.length - importados;
  const avance = conProductos.length ? Math.round((importados / conProductos.length) * 100) : 0;

  const cuentaDe = (id) => (id === 'pendientes'
    ? pendientes
    : id === 'todos' ? filas.length : filas.filter((f) => f.estado === id).length);

  const visibles = useMemo(() => {
    const ql = norm(q.trim());
    return filas.filter((f) => {
      if (filtro === 'pendientes' && !(f.estado === 'falta' || f.estado === 'sin_costos')) return false;
      if (filtro !== 'todos' && filtro !== 'pendientes' && f.estado !== filtro) return false;
      return !ql || norm(f.prov.nombre).includes(ql);
    });
  }, [filas, filtro, q]);
  const pag = usePaginado(visibles, 'formatos-por-proveedor', `${filtro}|${q}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Formatos de venta por proveedor"
        desc="La guía para importar de a un proveedor: cuáles ya están y cuáles faltan. El orden que conviene es primero los costos y después los formatos de venta."
      />

      <div className={s.stats}>
        <Stat label="Proveedores con productos" value={num(conProductos.length, 0)} />
        <Stat label="Formatos importados" value={`${num(importados, 0)} · ${avance}%`} accent={importados ? 'accent-green' : undefined} />
        <Stat label="Faltan" value={num(pendientes, 0)} accent={pendientes ? 'accent-amber' : undefined} />
      </div>
      {conProductos.length > 0 && (
        <div
          role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label="Proveedores importados"
          style={{ height: 8, borderRadius: 999, background: 'var(--crm-color-border)', overflow: 'hidden' }}
        >
          <div style={{ width: `${avance}%`, height: '100%', background: 'var(--crm-color-success)' }} />
        </div>
      )}

      <div className={s.toolbar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          id="fpp-buscar" type="search" placeholder="Buscar proveedor…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }}
        />
        {[
          ['pendientes', 'Faltan'],
          ['falta', 'Listos para importar'],
          ['sin_costos', 'Faltan los costos'],
          ['importado', 'Importados'],
          ['sin_productos', 'Sin productos'],
          ['todos', 'Todos'],
        ].map(([id, texto]) => (
          <Btn key={id} small variant={filtro === id ? 'btn-primary' : 'btn-ghost'} onClick={() => setFiltro(id)}>
            {texto} ({cuentaDe(id)})
          </Btn>
        ))}
      </div>

      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'Productos', num: true }, { h: 'Con formato de venta', num: true },
          { h: 'Costos importados' }, { h: 'Formatos importados' }, { h: 'Estado' }, { h: '' },
        ]}
        empty={cargando ? 'Cargando…' : 'No hay proveedores con este filtro.'}
        pag={pag}
      >
        {pag.visibles.map((f) => {
          const est = ESTADO[f.estado];
          return (
            <tr key={f.prov.id}>
              <td><strong>{f.prov.nombre}</strong></td>
              <td className={s.num}>{num(f.productos, 0)}</td>
              <td className={cx(s.num, f.productos && f.conFormato < f.productos ? s.muted : undefined)}>
                {f.productos ? `${num(f.conFormato, 0)} de ${num(f.productos, 0)}` : '—'}
              </td>
              <td><Cuando imp={f.costos} /></td>
              <td><Cuando imp={f.formatos} /></td>
              <td><Pill pill={est.pill} label={est.label} /></td>
              <td>
                {isAdmin && f.productos > 0 && (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Btn small onClick={() => openModal('importarCostos', { proveedorId: f.prov.id })}>Costos</Btn>
                    <Btn
                      small
                      variant={f.estado === 'falta' ? 'btn-primary' : 'btn-ghost'}
                      onClick={() => openModal('importarFormatosVenta', { proveedorId: f.prov.id })}
                    >
                      Formatos de venta
                    </Btn>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s.hint}>
        <strong>Faltan los costos</strong> = todavía no se importaron sus costos: conviene hacerlo antes,
        porque el precio sale del markup sobre el costo. <strong>Listo para importar</strong> = ya tiene
        costos y le faltan los formatos. Un proveedor cuenta como importado aunque el archivo no haya
        cambiado nada — en ese caso la importación lo marca como revisado. Lo importado antes de que
        existiera esta guía se reconoce por la evolución de precios.
      </div>
    </div>
  );
}
