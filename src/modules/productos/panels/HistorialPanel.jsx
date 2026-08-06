import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { num, fmtFechaHora } from '../domain/format.js';
import { TIPOS_MOV } from '../domain/constants.js';
import { sucursalOptions, productoOptions } from '../components/selectOptions.jsx';
import { Table, PanelHead, MovTag, usePaginado, s } from '../components/ui.jsx';

export function HistorialPanel() {
  const { store } = useProductos();
  useSeccion('movimientos');
  const [tipoF, setTipoF] = useState('');
  const [prodF, setProdF] = useState('');
  const [sucF, setSucF] = useState('');

  const movs = store.state.movimientos
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((m) => {
      if (tipoF && m.tipo !== tipoF) return false;
      if (prodF && m.productoId !== parseInt(prodF, 10)) return false;
      if (sucF && m.sucursalId !== parseInt(sucF, 10) && m.sucursalDestinoId !== parseInt(sucF, 10)) return false;
      return true;
    });

  const pag = usePaginado(movs, 'movimientos', `${tipoF}|${prodF}|${sucF}`);

  const filas = pag.visibles.map((m) => {
      const signo = m.signo > 0
        ? <span style={{ color: 'var(--crm-color-success)', fontWeight: 700 }}>+</span>
        : m.signo < 0
          ? <span style={{ color: 'var(--crm-color-danger)', fontWeight: 700 }}>−</span>
          : '';
      return (
        <tr key={m.id}>
          <td>{fmtFechaHora(m.fecha)}</td>
          <td><MovTag tipo={m.tipo} /></td>
          <td>{m.productoNombre}</td>
          <td>{m.sucursalNombre}{m.sucursalDestinoNombre ? ' → ' + m.sucursalDestinoNombre : ''}</td>
          <td>{m.presLabel}</td>
          <td className={s.num}>{signo}{num(m.cantidad, 3)} {m.unidad === 'kg' ? 'kg' : 'u'}</td>
          <td>{m.usuarioNombre}</td>
        </tr>
      );
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Historial de movimientos"
        desc={`Registro inmutable de toda alta y baja de inventario. ${store.state.movimientos.length} movimientos.`}
      />
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
          <option value="">Todos los movimientos</option>
          {Object.keys(TIPOS_MOV).map((k) => <option key={k} value={k}>{TIPOS_MOV[k].label}</option>)}
        </select>
        <select className={s['select-inline']} value={prodF} onChange={(e) => setProdF(e.target.value)}>
          <option value="">Todos los productos</option>
          {productoOptions(store, false)}
        </select>
        <select className={s['select-inline']} value={sucF} onChange={(e) => setSucF(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursalOptions(store, false)}
        </select>
      </div>
      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Tipo' }, { h: 'Producto' }, { h: 'Sucursal' },
          { h: 'Present.' }, { h: 'Cant.', num: true }, { h: 'Usuario' },
        ]}
        empty="Sin movimientos."
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}
