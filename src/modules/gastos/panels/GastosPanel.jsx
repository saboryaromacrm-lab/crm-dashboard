import { useEffect, useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { TIPOS_DOC_GASTO, inicioDeMes, hoyISO, nombreProveedor } from '../domain/constants.js';
import {
  Table, PanelHead, Stat, Btn, GastoEstadoPill, Saldo, usePaginado, money, fmtFecha, s,
} from '../components/ui.jsx';
import { PagosSucursalTab } from './PagosPanel.jsx';

/**
 * Gastos — hub document-centric, espejo de Compras › Facturación: los
 * comprobantes de gasto y la bandeja de PAGOS EN SUCURSAL como segunda pestaña.
 *
 * Viven juntas porque son las dos caras de la misma pregunta: qué me facturó
 * este proveedor y qué plata le salió a las sucursales. Por eso el filtro de
 * PROVEEDOR está afuera de las pestañas y manda sobre las dos. Los filtros que
 * solo aplican a una (rubro, estado, fechas del gasto; sucursal y "sin aplicar"
 * del pago) viven adentro de la suya.
 */
export function GastosPanel() {
  const { categorias, proveedores, sucursales, openModal, nombreSucursal, recargarContadores } = useGastos();
  const { can } = usePermissions();

  /** Filtro COMPARTIDO por las dos pestañas. */
  const [provF, setProvF] = useState('');
  const [tab, setTab] = useState('gastos');
  const verPagos = can('gastos.pagos_proveedor');

  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [categoriaId, setCategoriaId] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [estado, setEstado] = useState('');
  const [negocio, setNegocio] = useState('');
  const [busqueda, setBusqueda] = useState('');

  /*
   * La búsqueda espera a que dejes de escribir. Va en la identidad del pedido,
   * así que sin esto cada tecla dispara un `GET /gastos` que puede traer hasta
   * 300 filas: escribir "coca cola" eran nueve consultas para leer una.
   */
  const [buscado, setBuscado] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBuscado(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  /** El techo que aplica la API (`limit` por defecto). Ver el aviso de abajo. */
  const TOPE_LISTADO = 300;

  const filtros = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    categoriaId: categoriaId || undefined,
    proveedorId: provF || undefined,
    sucursalId: sucursalId || undefined,
    estado: estado || undefined,
    negocio: negocio || undefined,
    q: buscado || undefined,
  };
  const key = `gastos:${Object.values(filtros).join('|')}`;
  const { data, loading, error, reload } = useResource(key, () => gastosApi.gastos(filtros));

  const gastos = data ?? [];
  /* Los cuatro números de arriba suman lo que TRAJO la consulta, no el período
   * entero: si se llegó al techo, hay que decirlo en vez de mostrar totales que
   * no cierran con nada. */
  const truncado = gastos.length >= TOPE_LISTADO;
  // Un cambio en una pestaña afecta a la otra (aplicar mueve saldos de los dos
  // lados): se refresca el listado de gastos y los contadores del sub-menú.
  const alCambiar = () => { reload(); recargarContadores(); };

  const stats = useMemo(() => {
    const vivos = gastos.filter((g) => g.estado !== 'anulado');
    return {
      cantidad: vivos.length,
      total: vivos.reduce((a, g) => a + g.total, 0),
      iva: vivos.reduce((a, g) => a + g.iva, 0),
      saldo: vivos.reduce((a, g) => a + (g.total - g.pagado), 0),
    };
  }, [gastos]);

  const pag = usePaginado(gastos, 'gastos', key);
  const stop = (e) => e.stopPropagation();

  const abrirDetalle = (g) => openModal('detalleGasto', { gastoId: g.id, onChange: alCambiar });

  const filas = pag.visibles.map((g) => {
    const cat = categorias.find((c) => c.id === g.categoriaId);
    const saldo = g.total - g.pagado;
    return (
      <tr key={g.id} className={s.clickable} onClick={() => abrirDetalle(g)}>
        <td>{fmtFecha(g.fecha)}</td>
        <td>
          <div>{TIPOS_DOC_GASTO[g.tipoDoc] || g.tipoDoc} {g.letra}</div>
          {g.numero && <div className={cx(s.hint, s.mono)} style={{ margin: 0 }}>{g.numero}</div>}
        </td>
        <td>{nombreProveedor(g, proveedores)}</td>
        <td>
          <div>{cat?.nombre || '—'}</div>
          {g.descripcion && <div className={s.hint} style={{ margin: 0 }}>{g.descripcion}</div>}
        </td>
        <td>{g.sucursalId ? nombreSucursal(g.sucursalId) : <span className={s.muted}>Todas</span>}</td>
        <td className={s.num}>{money(g.total)}</td>
        <td className={s.num}>
          {g.estado === 'anulado'
            ? <span className={s.muted}>—</span>
            : <Saldo valor={saldo}>{money(saldo)}</Saldo>}
        </td>
        <td><GastoEstadoPill estado={g.estado} /></td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={stop}>
            {g.estado !== 'anulado' && saldo > 0.009 && (
              <Btn variant="btn-primary" small onClick={() => openModal('pagarGasto', { gastoId: g.id, onChange: alCambiar })}>
                Pagar
              </Btn>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Gastos"
        desc="Comprobantes de lo que la empresa paga y no es mercadería, y la plata que las sucursales ya pagaron."
        actions={
          <Btn variant="btn-primary" onClick={() => openModal('gastoForm', { onChange: alCambiar })}>
            + Cargar gasto
          </Btn>
        }
      />

      {/* El proveedor manda sobre las dos pestañas: va afuera, arriba de todo. */}
      {verPagos && (
        <div className={s.toolbar}>
          <select className={s['select-inline']} value={provF} onChange={(e) => setProvF(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <span className={s.hint} style={{ margin: 0 }}>
            Filtra las dos pestañas: los gastos de ese proveedor y los pagos que se le hicieron.
          </span>
        </div>
      )}

      {verPagos ? (
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
        >
          <Tab value="gastos" label="Gastos" sx={{ minHeight: 40 }} />
          <Tab value="pagos" label="Pagos en sucursal" sx={{ minHeight: 40 }} />
        </Tabs>
      ) : null}

      {tab === 'pagos' && verPagos ? (
        <PagosSucursalTab proveedorId={provF} onCambio={alCambiar} />
      ) : (
        <>
          <div className={s.stats}>
            <Stat label={truncado ? 'Comprobantes (parcial)' : 'Comprobantes'} value={stats.cantidad} />
            <Stat label="Total del período" value={money(stats.total)} accent="accent-amber" />
            <Stat label="IVA (crédito fiscal)" value={money(stats.iva)} />
            <Stat label="Falta pagar" value={money(stats.saldo)} accent={stats.saldo > 0.009 ? 'accent-red' : undefined} />
          </div>
          {truncado && (
            <div className={cx(s.callout, s.warn)}>
              El período tiene más de {TOPE_LISTADO} comprobantes y solo se trajeron los primeros:
              <strong> los totales de arriba son de lo que se ve</strong>, no del período completo.
              Acotá las fechas o filtrá por rubro. Para los números del período entero está{' '}
              <strong>Resumen</strong>, que los calcula en la base.
            </div>
          )}

          <div className={s.toolbar}>
            <label className={s.hint} style={{ margin: 0 }}>
              Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className={s.hint} style={{ margin: 0 }}>
              Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            <select className={s['select-inline']} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Todos los rubros</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {!verPagos && (
              <select className={s['select-inline']} value={provF} onChange={(e) => setProvF(e.target.value)}>
                <option value="">Todos los proveedores</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
            <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
            <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="pagado">Pagados</option>
              <option value="anulado">Anulados</option>
            </select>
            <select className={s['select-inline']} value={negocio} onChange={(e) => setNegocio(e.target.value)}>
              <option value="">Los dos negocios</option>
              <option value="distribuidora">Distribuidora</option>
              <option value="cafeteria">Cafetería</option>
            </select>
            <input
              type="search"
              placeholder="Buscar por número, descripción…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
          </div>

          {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar el listado: <strong>{error}</strong></div>}

          <Table
            cols={[
              { h: 'Fecha' }, { h: 'Comprobante' }, { h: 'Proveedor' }, { h: 'Rubro' }, { h: 'Sucursal' },
              { h: 'Total', num: true }, { h: 'Saldo', num: true }, { h: 'Estado' },
              { h: 'Acciones', cls: 'actions-col' },
            ]}
            empty={loading ? 'Cargando…' : 'No hay gastos con esos filtros.'}
            pag={pag}
          >
            {filas}
          </Table>
        </>
      )}
    </div>
  );
}
