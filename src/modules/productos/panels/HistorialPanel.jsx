import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { num, fmtFechaHora } from '../domain/format.js';
import { TIPOS_MOV } from '../domain/constants.js';
import { sucursalOptions, productoOptions } from '../components/selectOptions.jsx';
import { Table, PanelHead, MovTag, Btn, usePaginado, s } from '../components/ui.jsx';
import { imprimirDocumento, cuerpoValeOperacion } from '@core/services/imprimir.js';

export function HistorialPanel() {
  const { store, toast } = useProductos();
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

  /* EL VALE, para firmar y archivar. Se ofrece en TODOS los movimientos y no
   * solo en las bajas: la regla "solo merma y ajuste" obliga a explicar por qué
   * esta fila tiene botón y la de al lado no, y la respuesta no le importa a
   * nadie. El motivo es lo único del vale que no se puede reconstruir después
   * mirando el stock, así que va aunque esté vacío. */
  const imprimirVale = async (m) => {
    const signo = m.signo > 0 ? '+' : m.signo < 0 ? '−' : '';
    const ok = await imprimirDocumento('valeMovimiento', {
      titulo: `${TIPOS_MOV[m.tipo]?.label ?? m.tipo} #${m.id}`,
      cuerpo: cuerpoValeOperacion({
        titulo: `${TIPOS_MOV[m.tipo]?.label ?? m.tipo} #${m.id}`,
        subtitulo: `${fmtFechaHora(m.fecha)} · ${m.sucursalNombre}${
          m.sucursalDestinoNombre ? ` → ${m.sucursalDestinoNombre}` : ''}`,
        datos: [
          ['Producto', m.productoNombre],
          ['Presentación', m.presLabel],
          ['Cantidad', `${signo}${num(m.cantidad, 3)} ${m.unidad === 'kg' ? 'kg' : 'u'}`],
          ['Usuario', m.usuarioNombre],
          ['Motivo', m.motivo || m.descripcion || ''],
        ],
        ahora: fmtFechaHora(new Date()),
        usuario: store.getUsuario(store.state.ctx.usuarioId)?.nombre,
      }),
    });
    if (!ok) toast('El navegador bloqueó la ventana de impresión. Permitile las ventanas emergentes y probá de nuevo.', 'err');
  };

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
          <td><Btn small variant="btn-ghost" onClick={() => imprimirVale(m)}>Vale</Btn></td>
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
          { h: 'Present.' }, { h: 'Cant.', num: true }, { h: 'Usuario' }, { h: '' },
        ]}
        empty="Sin movimientos."
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}
