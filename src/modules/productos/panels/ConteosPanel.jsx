/**
 * CONTROL DE STOCK — el físico contra el virtual (0066)
 * ============================================================================
 * La lista de sesiones de conteo del local. El trabajo de verdad pasa en el
 * modal (`ConteosModals.jsx`): contar es una sesión larga con lector, no una
 * pantalla que se mira.
 *
 * Lo que este panel decide mostrar:
 *  · Las sesiones con su progreso ("28 de 41"), estado y quién la abrió.
 *  · El botón de abrir una nueva, que es donde viven los FILTROS del alcance
 *    (marcas, categoría, proveedor, tipo): el dueño cuenta por marca, no todo
 *    junto, y el alcance define qué renglones nacen en la sesión.
 *  · Filtros de la lista (12/10/2026): texto (control, marca, responsable),
 *    estado, responsable, sucursal y fechas. Valen para las dos tablas.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { norm } from '../components/CatalogoPicker.jsx';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { Table, Btn, PanelHead, usePaginado, Paginador, s } from '../components/ui.jsx';

const FILTROS_VACIOS = { q: '', estado: '', responsable: '', sucursalId: '', desde: '', hasta: '' };
/** El día local de una fecha, como AAAA-MM-DD (para comparar con los <input type="date">). */
const diaLocal = (v) => {
  const d = new Date(v);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const ESTADO_CONTEO = {
  en_curso: { label: 'En curso', tono: 'info' },
  cerrado: { label: 'Cerrado — para revisar', tono: 'warn' },
  aplicado: { label: 'Aplicado', tono: 'ok' },
  descartado: { label: 'Descartado', tono: 'muted' },
};

export function ConteosPanel() {
  const { store, isAdmin, openModal, toast } = useProductos();
  const [filas, setFilas] = useState(null);
  const puedeAplicar = isAdmin || store.can('conteos_aplicar');

  const recargar = useCallback(async () => {
    const r = await store.listarConteos();
    if (!r.ok) { toast(r.error, 'err'); setFilas([]); return; }
    setFilas(r.data ?? []);
  }, [store, toast]);

  useEffect(() => { recargar(); }, [recargar]);

  const [fl, setFl] = useState(FILTROS_VACIOS);
  const setFiltro = (k) => (e) => setFl((x) => ({ ...x, [k]: e.target.value }));
  const hayFiltro = Object.values(fl).some(Boolean);
  const responsables = useMemo(
    () => [...new Set((filas ?? []).map((f) => (f.responsable || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [filas],
  );
  const sucursalesConControles = useMemo(() => [...new Set((filas ?? []).map((f) => f.sucursalId))], [filas]);
  const filtradas = useMemo(() => {
    const q = norm(fl.q.trim());
    return (filas ?? []).filter((f) => {
      if (fl.estado && f.estado !== fl.estado) return false;
      if (fl.responsable && (f.responsable || '').trim() !== fl.responsable) return false;
      if (fl.sucursalId && String(f.sucursalId) !== fl.sucursalId) return false;
      const dia = diaLocal(f.creadoEn);
      if (fl.desde && dia < fl.desde) return false;
      if (fl.hasta && dia > fl.hasta) return false;
      if (q) {
        const texto = norm(`#${f.id} ${f.nombre} ${f.alcance} ${f.responsable} ${store.getUsuario(f.usuarioId)?.nombre ?? ''}`);
        if (!q.split(/\s+/).every((t) => texto.includes(t))) return false;
      }
      return true;
    });
  }, [filas, fl, store]);

  const abiertas = filtradas.filter((f) => f.estado === 'en_curso' || f.estado === 'cerrado');
  const historicas = filtradas.filter((f) => f.estado === 'aplicado' || f.estado === 'descartado');
  const pag = usePaginado(historicas, 'conteosHist', JSON.stringify(fl));

  const abrir = (id) => openModal('conteo', { conteoId: id, alTerminar: recargar });

  const Fila = ({ f }) => {
    const est = ESTADO_CONTEO[f.estado] ?? { label: f.estado };
    return (
      <tr className={s.clickable} onClick={() => abrir(f.id)}>
        <td>
          <strong>{f.nombre || `Control #${f.id}`}</strong>
          <div className={s.hint} style={{ margin: 0 }}>{f.alcance}</div>
        </td>
        <td>{store.getSucursal(f.sucursalId)?.nombre ?? '—'}</td>
        <td>
          <span className={cx(s.badge)}>{est.label}</span>
          {f.aRecontar > 0 && <span className={s.hint} style={{ margin: '2px 0 0' }}>⚠ {f.aRecontar} para recontar</span>}
        </td>
        <td className={s.num}>
          <strong>{f.contados}</strong> de {f.total}
        </td>
        <td>{new Date(f.creadoEn).toLocaleDateString('es-AR')}</td>
        <td><strong>{f.responsable || '—'}</strong></td>
        <td>{store.getUsuario(f.usuarioId)?.nombre ?? '—'}</td>
      </tr>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Control de stock"
        desc="Se cuenta lo que hay en la góndola y el sistema lo compara contra lo que él cree. El conteo es ciego —se cuenta la realidad, no lo que dice la pantalla— y se hace con el local cerrado."
        actions={<Btn variant="btn-primary" onClick={() => openModal('conteoNuevo', { alCrear: abrir })}>+ Nuevo control</Btn>}
      />

      <div className={s.toolbar}>
        <input
          id="conteos-buscar" type="search" value={fl.q} onChange={setFiltro('q')} placeholder="Buscar control, marca o responsable…"
          style={{ minWidth: 240 }}
        />
        <select id="conteos-estado" className={s['select-inline']} value={fl.estado} onChange={setFiltro('estado')} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CONTEO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select id="conteos-responsable" className={s['select-inline']} value={fl.responsable} onChange={setFiltro('responsable')} aria-label="Responsable">
          <option value="">Todos los responsables</option>
          {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {sucursalesConControles.length > 1 && (
          <select id="conteos-sucursal" className={s['select-inline']} value={fl.sucursalId} onChange={setFiltro('sucursalId')} aria-label="Sucursal">
            <option value="">Todas las sucursales</option>
            {sucursalesConControles.map((id) => <option key={id} value={id}>{store.getSucursal(id)?.nombre ?? `#${id}`}</option>)}
          </select>
        )}
        <label className={s.hint} style={{ margin: 0 }}>
          Desde <input id="conteos-desde" type="date" value={fl.desde} max={fl.hasta || undefined} onChange={setFiltro('desde')} />
        </label>
        <label className={s.hint} style={{ margin: 0 }}>
          Hasta <input id="conteos-hasta" type="date" value={fl.hasta} min={fl.desde || undefined} onChange={setFiltro('hasta')} />
        </label>
        {hayFiltro && (
          <>
            <Btn small onClick={() => setFl(FILTROS_VACIOS)}>Limpiar filtros</Btn>
            <span className={s.hint} style={{ margin: 0 }}>{filtradas.length} de {filas?.length ?? 0} controles</span>
          </>
        )}
      </div>

      <div>
        <div className={s['section-title']}>En curso y para revisar</div>
        <Table
          cols={[{ h: 'Control' }, { h: 'Sucursal' }, { h: 'Estado' }, { h: 'Contados', num: true }, { h: 'Fecha' }, { h: 'Responsable' }, { h: 'Abierto por' }]}
          empty={filas === null ? 'Cargando…' : hayFiltro ? 'Ningún control abierto con esos filtros.' : 'No hay controles abiertos. "+ Nuevo control" para arrancar uno.'}
        >
          {abiertas.map((f) => <Fila key={f.id} f={f} />)}
        </Table>
      </div>

      {historicas.length > 0 && (
        <div>
          <div className={s['section-title']}>Historial</div>
          <Table
            cols={[{ h: 'Control' }, { h: 'Sucursal' }, { h: 'Estado' }, { h: 'Contados', num: true }, { h: 'Fecha' }, { h: 'Responsable' }, { h: 'Abierto por' }]}
            pag={pag}
          >
            {pag.visibles.map((f) => <Fila key={f.id} f={f} />)}
          </Table>
          <Paginador pag={pag} />
        </div>
      )}

      {!puedeAplicar && (
        <div className={s.hint}>
          Podés abrir controles, contar y cerrarlos. Las diferencias las revisa
          y aplica quien tiene la llave de aplicar (admin o encargado).
        </div>
      )}
    </div>
  );
}
