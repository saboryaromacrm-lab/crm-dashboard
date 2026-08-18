import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, fmtFechaHora } from '../domain/format.js';
import { Table, Stat, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

/**
 * PAGOS EN SUCURSAL — la plata que salió de las cajas hacia proveedores de
 * MERCADERÍA, como segunda pestaña de Facturación.
 *
 * Es el espejo de Gastos › Pagos en sucursal, del lado de Compras: la cajera le
 * pagó al repartidor de Coca-Cola y siguió vendiendo; acá el administrador ve
 * esa plata esperando su factura.
 *
 * **De solo lectura, a propósito.** No hay botón "Aplicar": un pago se aplica
 * CARGANDO la factura que lo explica, no con un botón suelto en una bandeja.
 * Esta pantalla es el control —"qué plata salió y todavía no tiene comprobante
 * detrás"—, no un lugar de acción. Un pago que lleva días acá significa una de
 * dos cosas, y las dos hay que mirarlas: falta cargar la factura, o salió plata
 * sin respaldo.
 *
 * `proveedorId` viene de Facturación: el filtro es compartido por las dos
 * pestañas, así que acá no se repite.
 */
export function PagosSucursalTab({ proveedorId = '' }) {
  const { store, openModal, toast } = useProductos();
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  // Arranca mostrando TODO, no solo lo pendiente: un pago recién tomado tiene
  // que seguir viéndose — con su "Aplicado a" — y no esfumarse de la lista.
  const [soloSinAplicar, setSoloSinAplicar] = useState(false);
  const [sucursalId, setSucursalId] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setPagos(await store.pagosSucursal({
        sinAplicar: soloSinAplicar ? 'true' : undefined,
        proveedorId: proveedorId || undefined,
        sucursalId: sucursalId || undefined,
      }));
    } catch {
      toast('No se pudieron cargar los pagos.', 'err');
    } finally {
      setCargando(false);
    }
  }, [store, soloSinAplicar, proveedorId, sucursalId, toast]);

  useEffect(() => { cargar(); }, [cargar]);

  const stats = useMemo(() => {
    const vivos = pagos.filter((x) => x.estado === 'activo');
    return {
      cantidad: vivos.length,
      importe: vivos.reduce((a, x) => a + x.importe, 0),
      sinAplicar: vivos.reduce((a, x) => a + x.saldo, 0),
    };
  }, [pagos]);

  const clave = `${soloSinAplicar}|${proveedorId}|${sucursalId}`;
  const pag = usePaginado(pagos, 'pagos-sucursal', clave);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={s.stats}>
        <Stat label="Pagos listados" value={stats.cantidad} />
        <Stat label="Importe" value={money(stats.importe)} />
        <Stat
          label="Sin aplicar"
          value={money(stats.sinAplicar)}
          accent={stats.sinAplicar > 0.009 ? 'accent-amber' : undefined}
        />
      </div>

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloSinAplicar} onChange={(e) => setSoloSinAplicar(e.target.checked)} />
          Solo sin aplicar
        </label>
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {store.state.sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <Btn small onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      <Table
        cols={[
          { h: 'Fecha y hora' }, { h: 'Proveedor' }, { h: 'Origen' },
          { h: 'Importe', num: true }, { h: 'Aplicado a' }, { h: 'Sin aplicar', num: true },
          { h: 'Estado' },
        ]}
        empty={cargando
          ? 'Cargando…'
          : soloSinAplicar
            ? 'No hay pagos esperando factura. '
            : 'No hay pagos con esos filtros.'}
        pag={pag}
      >
        {pag.visibles.map((x) => {
          const anulado = x.estado === 'anulado';
          const destinos = x.imputadoA ?? [];
          return (
            <tr
              key={x.id}
              className={s.clickable}
              onClick={() => openModal('pagoSucursalDetalle', { pagoId: x.id, onChange: cargar })}
            >
              <td>{fmtFechaHora(x.fecha)}</td>
              <td>
                <div>
                  {x.esFlete && <><Pill pill="est-recibida" label="Flete" />{' '}</>}
                  {x.proveedorNombre}
                </div>
                {x.concepto && <div className={s.hint} style={{ margin: 0 }}>{x.concepto}</div>}
              </td>
              <td>
                {x.sucursalNombre || <span className={s.muted}>—</span>}
                {x.cajaSesionId
                  ? <div className={s.hint} style={{ margin: 0 }}>Turno #{x.cajaSesionId} · {x.usuarioNombre}</div>
                  : <div className={s.hint} style={{ margin: 0 }}>Administración · sin caja</div>}
              </td>
              <td className={s.num}>{money(x.importe)}</td>
              {/* La contracara de la traza de la factura: qué comprobante lo explica. */}
              <td>
                {destinos.length === 0
                  ? <span className={s.muted}>todavía nada</span>
                  : destinos.map((d, i) => (
                    <div key={i} className={i === 0 ? undefined : s.hint} style={i === 0 ? undefined : { margin: 0 }}>
                      {d.etiqueta}
                      {destinos.length > 1 ? ` · ${money(d.importe)}` : ''}
                    </div>
                  ))}
              </td>
              <td className={s.num}>
                {anulado
                  ? <span className={s.muted}>—</span>
                  : <strong style={{ color: x.saldo > 0.009 ? 'var(--crm-color-danger)' : 'var(--crm-color-text-muted)' }}>{money(x.saldo)}</strong>}
              </td>
              <td>
                {anulado
                  ? <Pill pill="est-cancelada" label="Anulado" />
                  : x.saldo > 0.009
                    ? <Pill pill="est-pendiente" label="Sin aplicar" />
                    : <Pill pill="est-recibida" label="Aplicado" />}
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s.hint}>
        Los marcados <strong>Flete</strong> son la plata que se le adelantó al fletero por cuenta
        del proveedor: al cargar la factura de esa entrega se toman igual que cualquier otro pago
        y el proveedor queda debiendo el resto.
      </div>

      <div className={s.hint}>
        Un pago se <strong>aplica cargando la factura</strong> que lo explica: en el alta del
        comprobante aparecen los pagos de ese proveedor y se toman ahí. Si la factura ya estaba
        cargada, se toma desde su detalle. Aplicar nunca vuelve a mover plata — el egreso ya quedó
        en el arqueo de la caja que pagó.
      </div>
    </div>
  );
}
