import { useMemo, useState } from 'react';
import { useGastos } from '../context/GastosContext.jsx';
import { Table, PanelHead, Stat, Btn, Pill, TipoGastoBadge, s } from '../components/ui.jsx';

/**
 * El plan de gastos: contra qué rubro se imputa cada comprobante. Chico y
 * estable, así que vive en el contexto y no necesita su propio pedido.
 *
 * `fijo` vs `variable` no es decoración: es lo que hace comparable el resumen
 * de gerencia. El alquiler no se compara con el combustible.
 */
export function CategoriasPanel() {
  const { categorias, openModal } = useGastos();
  const [verBajas, setVerBajas] = useState(false);

  const visibles = useMemo(
    () => (verBajas ? categorias : categorias.filter((c) => c.activa)),
    [categorias, verBajas],
  );

  const stats = useMemo(() => ({
    fijos: categorias.filter((c) => c.activa && c.tipo === 'fijo').length,
    variables: categorias.filter((c) => c.activa && c.tipo === 'variable').length,
    bajas: categorias.filter((c) => !c.activa).length,
  }), [categorias]);

  const stop = (e) => e.stopPropagation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Rubros de gasto"
        desc="El plan contra el que se imputa cada comprobante. Un rubro con gastos cargados no se borra: se da de baja."
        actions={
          <Btn variant="btn-primary" onClick={() => openModal('categoriaForm', {})}>
            + Nuevo rubro
          </Btn>
        }
      />

      <div className={s.stats}>
        <Stat label="Rubros fijos" value={stats.fijos} />
        <Stat label="Rubros variables" value={stats.variables} />
        <Stat label="Dados de baja" value={stats.bajas} />
      </div>

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
          Mostrar los dados de baja
        </label>
      </div>

      <Table
        cols={[
          { h: 'Rubro' }, { h: 'Tipo' }, { h: 'Descripción' }, { h: 'Orden', num: true },
          { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="No hay rubros cargados."
      >
        {visibles.map((c) => (
          <tr key={c.id} className={s.clickable} onClick={() => openModal('categoriaForm', { categoriaId: c.id })}>
            <td><strong>{c.nombre}</strong></td>
            <td><TipoGastoBadge tipo={c.tipo} /></td>
            <td>{c.descripcion || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{c.orden}</td>
            <td>
              {c.activa
                ? <Pill pill="est-recibida" label="Activo" />
                : <Pill pill="est-cancelada" label="De baja" />}
            </td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']} onClick={stop}>
                <Btn variant="btn-edit" small onClick={() => openModal('categoriaForm', { categoriaId: c.id })}>
                  Editar
                </Btn>
                <Btn variant="btn-delete" small onClick={() => openModal('borrarCategoria', { categoriaId: c.id })}>
                  Eliminar
                </Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        El <strong>orden</strong> define cómo aparecen en los selectores: poné los que más usás
        con un número bajo para tenerlos arriba.
      </div>
    </div>
  );
}
