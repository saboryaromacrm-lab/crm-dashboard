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
 *    (marca, categoría, proveedor, tipo): el dueño cuenta por marca, no todo
 *    junto, y el alcance define qué renglones nacen en la sesión.
 */
import { useCallback, useEffect, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { Table, Btn, PanelHead, usePaginado, Paginador, s } from '../components/ui.jsx';

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

  const abiertas = (filas ?? []).filter((f) => f.estado === 'en_curso' || f.estado === 'cerrado');
  const historicas = (filas ?? []).filter((f) => f.estado === 'aplicado' || f.estado === 'descartado');
  const pag = usePaginado(historicas, 'conteosHist');

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

      <div>
        <div className={s['section-title']}>En curso y para revisar</div>
        <Table
          cols={[{ h: 'Control' }, { h: 'Sucursal' }, { h: 'Estado' }, { h: 'Contados', num: true }, { h: 'Fecha' }, { h: 'Abierto por' }]}
          empty={filas === null ? 'Cargando…' : 'No hay controles abiertos. "+ Nuevo control" para arrancar uno.'}
        >
          {abiertas.map((f) => <Fila key={f.id} f={f} />)}
        </Table>
      </div>

      {historicas.length > 0 && (
        <div>
          <div className={s['section-title']}>Historial</div>
          <Table
            cols={[{ h: 'Control' }, { h: 'Sucursal' }, { h: 'Estado' }, { h: 'Contados', num: true }, { h: 'Fecha' }, { h: 'Abierto por' }]}
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
