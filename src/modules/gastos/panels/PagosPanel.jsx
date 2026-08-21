import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { MEDIOS_PAGO, inicioDeMes, hoyISO } from '../domain/constants.js';
import {
  Table, Stat, Btn, Pill, Saldo, usePaginado, money, fmtFechaHora, s,
} from '../components/ui.jsx';
import { imprimirDocumento, cuerpoOrdenDePago } from '@core/services/imprimir.js';
import { leerSesion } from '@core/auth/sesion.js';

/**
 * LA BANDEJA — pestaña "Pagos en sucursal" dentro de Gastos, espejo de la de
 * Compras › Facturación. Toda la plata que salió hacia un proveedor de gastos,
 * y sobre todo la que todavía no tiene un comprobante detrás.
 *
 * Es el control que cierra el circuito de la cajera: ella paga cuando llega el
 * pedido y sigue vendiendo; acá se ve qué falta rendir. Un pago que lleva días
 * sin aplicar significa una de dos cosas, y las dos hay que mirarlas: falta
 * cargar el comprobante, o salió plata sin respaldo.
 *
 * SOLO LECTURA: aplicar se hace siempre desde el GASTO (al cargarlo, o en su
 * detalle con "Aplicar un pago existente"), nunca desde el pago. El proveedor
 * llega como prop: es el filtro compartido con la pestaña Gastos.
 */
export function PagosSucursalTab({ proveedorId, onCambio }) {
  const { sucursales, openModal, contadores, toast } = useGastos();
  const [sucursalId, setSucursalId] = useState('');
  // Arranca mostrando TODO el período, no solo lo pendiente: un pago recién
  // tomado tiene que seguir viéndose — con su "Aplicado a" — y no esfumarse.
  const [soloSinAplicar, setSoloSinAplicar] = useState(false);
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(hoyISO());

  const filtros = {
    proveedorId: proveedorId || undefined,
    sucursalId: sucursalId || undefined,
    // Cuando se miran solo los pendientes, el rango de fechas estorba: un pago
    // sin aplicar de hace tres meses es justamente el que hay que ver.
    desde: soloSinAplicar ? undefined : (desde || undefined),
    hasta: soloSinAplicar ? undefined : (hasta || undefined),
    sinAplicar: soloSinAplicar ? 'true' : undefined,
  };
  const key = `pagos:${Object.values(filtros).join('|')}`;
  const { data, loading, error, reload } = useResource(key, () => gastosApi.pagos(filtros));

  const pagos = data ?? [];
  const alCambiar = () => { reload(); onCambio?.(); };

  const stats = useMemo(() => {
    const vivos = pagos.filter((p) => p.estado === 'activo');
    return {
      cantidad: vivos.length,
      total: vivos.reduce((a, p) => a + p.importe, 0),
      sinAplicar: vivos.reduce((a, p) => a + p.saldo, 0),
    };
  }, [pagos]);

  const pag = usePaginado(pagos, 'pagos-proveedor', key);

  /* LA ORDEN DE PAGO — el único de los comprobantes nuevos que SALE DE LA CASA.
   * Por eso lleva el detalle de qué se cancela (sin eso el proveedor no puede
   * imputarlo en su cuenta) y un lugar para firmar. Se arma con `imputadoA`,
   * que la fila ya trae: no hace falta pedir nada. */
  const imprimirOrden = async (p) => {
    const ok = await imprimirDocumento('ordenPago', {
      titulo: `Orden de pago #${p.id}`,
      cuerpo: cuerpoOrdenDePago({
        pago: {
          numero: `#${p.id}`,
          fecha: fmtFechaHora(p.fecha),
          sucursal: p.sucursalNombre,
          proveedor: p.proveedorNombre,
          medio: MEDIOS_PAGO[p.medio] || p.medio,
          referencia: p.referencia,
          total: p.importe,
          observaciones: p.estado === 'anulado' ? 'PAGO ANULADO' : (p.concepto || ''),
        },
        imputaciones: (p.imputadoA ?? []).map((d) => ({ concepto: d.etiqueta, importe: d.importe })),
        moneda: money,
        ahora: fmtFechaHora(new Date()),
        // Quién sacó el papel. En un recibo que se entrega, importa: si el
        // proveedor vuelve con una copia, se sabe de qué mostrador salió.
        usuario: leerSesion()?.usuario?.nombre,
      }),
    });
    if (!ok) toast('El navegador bloqueó la ventana de impresión. Permitile las ventanas emergentes y probá de nuevo.', 'err');
  };

  const filas = pag.visibles.map((p) => {
    const anulado = p.estado === 'anulado';
    const destinos = p.imputadoA ?? [];
    return (
      <tr
        key={p.id}
        className={s.clickable}
        onClick={() => openModal('detallePago', { pagoId: p.id, onChange: alCambiar })}
      >
        <td>{fmtFechaHora(p.fecha)}</td>
        <td>
          <div>{p.proveedorNombre}</div>
          {p.concepto && <div className={s.hint} style={{ margin: 0 }}>{p.concepto}</div>}
        </td>
        <td>{MEDIOS_PAGO[p.medio] || p.medio}</td>
        <td>
          {p.sucursalNombre || <span className={s.muted}>—</span>}
          {p.cajaSesionId && <div className={s.hint} style={{ margin: 0 }}>Turno #{p.cajaSesionId} · {p.usuarioNombre}</div>}
        </td>
        <td className={s.num}>{money(p.importe)}</td>
        {/* La contracara de la traza del gasto: qué documento lo explica. */}
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
          {anulado ? <span className={s.muted}>—</span> : <Saldo valor={p.saldo}>{money(p.saldo)}</Saldo>}
        </td>
        <td>
          {anulado
            ? <Pill pill="est-cancelada" label="Anulado" />
            : p.saldo > 0.009
              ? <Pill pill="est-pendiente" label="Sin aplicar" />
              : <Pill pill="est-recibida" label="Aplicado" />}
        </td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={(e) => e.stopPropagation()}>
            <Btn small onClick={() => imprimirOrden(p)}>Orden</Btn>
          </div>
        </td>
      </tr>
    );
  });

  return (
    <>
      <div className={s.stats}>
        <Stat label="Pagos listados" value={stats.cantidad} />
        <Stat label="Importe" value={money(stats.total)} />
        <Stat
          label="Sin aplicar"
          value={money(stats.sinAplicar)}
          accent={stats.sinAplicar > 0.009 ? 'accent-amber' : undefined}
        />
        <Stat label="Pendientes de rendir" value={contadores.sinAplicar ?? 0} />
      </div>

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloSinAplicar} onChange={(e) => setSoloSinAplicar(e.target.checked)} />
          Solo sin aplicar
        </label>
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        {!soloSinAplicar && (
          <>
            <label className={s.hint} style={{ margin: 0 }}>
              Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className={s.hint} style={{ margin: 0 }}>
              Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </>
        )}
        <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
        <span style={{ flex: 1 }} />
        {/* El pago del administrador (transferencia desde el escritorio). */}
        <Btn variant="btn-primary" small onClick={() => openModal('pagoForm', { onChange: alCambiar })}>
          + Registrar pago
        </Btn>
      </div>

      {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar: <strong>{error}</strong></div>}

      <Table
        cols={[
          { h: 'Fecha y hora' }, { h: 'Proveedor' }, { h: 'Medio' }, { h: 'Origen' },
          { h: 'Importe', num: true }, { h: 'Aplicado a' }, { h: 'Sin aplicar', num: true },
          { h: 'Estado' }, { h: '', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : soloSinAplicar ? 'No hay pagos pendientes de aplicar.' : 'No hay pagos con esos filtros.'}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        Esta bandeja es de <strong>solo lectura</strong>: es el control de qué plata salió sin
        comprobante detrás. Un pago se aplica desde el GASTO — al cargarlo, o en su detalle con
        "Aplicar un pago existente" — y aplicar <strong>no vuelve a mover plata</strong>.
      </div>
    </>
  );
}
