import { BuscadorOpcion } from '@shared/components/BuscadorOpcion.jsx';
import { useEffect, useMemo, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, fmtFechaHora, MEDIOS_PAGO_PROVEEDOR, partesDelPago } from '../domain/format.js';
import { Table, Stat, Btn, Pill, PanelHead, usePaginado, s } from '../components/ui.jsx';
import { FiltroCuentaPropia, desdeCuentas } from '@shared/components/CuentaPropiaSelect.jsx';
import { Fechas } from '@modules/proveedores/components/Fechas.jsx';
import { rangoDe } from '@modules/gerencia/panels/metricas/formato.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';

/** El listado trae hasta este tope; más que eso pide achicar las fechas. */
const TOPE = 1000;
const DESTINOS = { mercaderia: 'Mercadería', gastos: 'Gastos' };
const medioTxt = (m) => MEDIOS_PAGO_PROVEEDOR[m] ?? m;

/** Cómo se pagó, en una línea: «Efectivo $10.000 + Transferencia $5.000» o el medio solo. */
function comoSePago(p) {
  const partes = partesDelPago(p);
  const txt = partes.length > 1
    ? partes.map((x) => `${medioTxt(x.medio)} ${money(x.importe)}`).join(' + ')
    : medioTxt(partes[0].medio);
  return p.cambioPor ? `${txt} · efectivo por transferencia (${p.cambioPor})` : txt;
}

/** De dónde salió: la caja de un turno o la administración, y quién lo registró. */
const origenTxt = (p) => (p.cajaSesionId
  ? `Caja · turno #${p.cajaSesionId}`
  : 'Administración · sin caja');

/**
 * PAGOS REALIZADOS (9/11/2026, pedido del dueño) — todo lo que se le pagó a los
 * proveedores, de mercadería y de gastos, en un solo listado con filtros.
 *
 * Es el mismo pago de siempre (`/pagos-proveedor`, una sola tabla para todo el
 * sistema): sale de la caja, de Proveedores, de Cuentas disponibles o del alta
 * de una factura, y acá se ve junto. De solo lectura: el clic abre el detalle
 * del pago, que es donde se corrige o se anula.
 *
 * El medio y el texto se filtran distinto a propósito: el medio va al servidor
 * (un pago mixto guarda sus medios aparte y solo la base los ve todos); quién lo
 * registró y el buscador filtran lo ya traído, sin otro viaje.
 */
export function PagosRealizadosPanel() {
  const { store, openModal, toast } = useProductos();
  const [[desde, hasta], setRango] = useState(() => rangoDe('mes'));
  const [proveedorId, setProveedorId] = useState('');
  const [medio, setMedio] = useState('');
  const [destino, setDestino] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [cuentaPropiaId, setCuentaPropiaId] = useState('');
  const [estado, setEstado] = useState('activo');
  const [usuario, setUsuario] = useState('');
  const [buscar, setBuscar] = useState('');
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  const filtros = useMemo(() => ({
    desde, hasta, proveedorId, medio, destino, sucursalId, cuentaPropiaId, estado, limit: TOPE,
  }), [desde, hasta, proveedorId, medio, destino, sucursalId, cuentaPropiaId, estado]);

  /* La respuesta de un filtro viejo no pisa la del último: cada pedido sabe si sigue vigente. */
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    store.pagosRealizados(filtros)
      .then((r) => { if (vigente) setPagos(r); })
      .catch(() => { if (vigente) toast('No se pudieron cargar los pagos.', 'err'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [store, filtros, version, toast]);

  const proveedores = useMemo(
    () => store.state.proveedores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [store.state.proveedores],
  );
  const usuarios = useMemo(
    () => [...new Set(pagos.map((p) => p.usuarioNombre).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [pagos],
  );

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return pagos.filter((p) => (!usuario || p.usuarioNombre === usuario)
      && (!q || [p.proveedorNombre, p.concepto, p.referencia, p.observaciones, p.cambioPor, `#${p.id}`]
        .some((t) => String(t ?? '').toLowerCase().includes(q))));
  }, [pagos, usuario, buscar]);

  /* Con un medio elegido, el total es solo esa parte: de un pago mixto no se cuenta lo pagado con otro medio. */
  const stats = useMemo(() => {
    const vivos = visibles.filter((p) => p.estado === 'activo');
    const porMedio = {};
    for (const p of vivos) {
      for (const x of partesDelPago(p)) porMedio[x.medio] = (porMedio[x.medio] ?? 0) + x.importe;
    }
    return {
      cantidad: vivos.length,
      total: medio ? (porMedio[medio] ?? 0) : vivos.reduce((a, p) => a + p.importe, 0),
      sinAplicar: vivos.reduce((a, p) => a + p.saldo, 0),
      proveedores: new Set(vivos.map((p) => p.proveedorId)).size,
      porMedio: Object.entries(porMedio).sort((a, b) => b[1] - a[1]),
      anulados: visibles.length - vivos.length,
    };
  }, [visibles, medio]);

  const clave = `${Object.values(filtros).join('|')}|${usuario}|${buscar}`;
  const pag = usePaginado(visibles, 'pagos-realizados', clave);

  const exportar = () => descargarCsv(
    `pagos-realizados${desde ? `-${desde}` : ''}${hasta ? `-${hasta}` : ''}.csv`,
    ['N°', 'Fecha', 'Proveedor', 'Tipo', 'Medio', 'Cuenta', 'Importe', 'Concepto', 'Referencia', 'Sucursal', 'Origen', 'Registró', 'Aplicado a', 'Sin aplicar', 'Estado'],
    visibles.map((p) => [
      p.id, fmtFechaHora(p.fecha), p.proveedorNombre, DESTINOS[p.destino] ?? p.destino, comoSePago(p),
      desdeCuentas(p).replace(/^desde /, ''), csvNum(p.importe), p.concepto, p.referencia, p.sucursalNombre,
      origenTxt(p), p.usuarioNombre, (p.imputadoA ?? []).map((d) => d.etiqueta).join(' · '),
      csvNum(p.estado === 'anulado' ? 0 : p.saldo), p.estado === 'anulado' ? 'Anulado' : 'Activo',
    ]),
  );

  const limpiar = () => {
    setRango(rangoDe('mes'));
    setProveedorId(''); setMedio(''); setDestino(''); setSucursalId('');
    setCuentaPropiaId(''); setEstado('activo'); setUsuario(''); setBuscar('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Pagos realizados"
        desc="Todo lo que se le pagó a los proveedores, de mercadería y de gastos: desde la caja, la administración o una cuenta propia."
        actions={<Btn small onClick={exportar} disabled={!visibles.length}>Exportar a Excel</Btn>}
      />

      <div className={s.toolbar}>
        <Fechas desde={desde} hasta={hasta} onChange={(d, h) => setRango([d, h])} />
      </div>

      <div className={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar concepto, referencia, N°…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          style={{ minWidth: 220 }}
          aria-label="Buscar en los pagos"
        />
        <BuscadorOpcion
          ariaLabel="Proveedor" className={s['select-inline']}
          opciones={proveedores}
          value={proveedorId} onChange={setProveedorId}
          todos="Todos los proveedores" placeholder="Escribí el proveedor…"
        />
        <select className={s['select-inline']} value={medio} onChange={(e) => setMedio(e.target.value)} aria-label="Medio de pago">
          <option value="">Todos los medios</option>
          {Object.entries(MEDIOS_PAGO_PROVEEDOR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={s['select-inline']} value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Tipo de pago">
          <option value="">Mercadería y gastos</option>
          {Object.entries(DESTINOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {store.state.sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <FiltroCuentaPropia className={s['select-inline']} value={cuentaPropiaId} onChange={setCuentaPropiaId} />
        <select className={s['select-inline']} value={usuario} onChange={(e) => setUsuario(e.target.value)} aria-label="Quién lo registró">
          <option value="">Lo registró cualquiera</option>
          {usuarios.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="activo">Sin los anulados</option>
          <option value="anulado">Solo anulados</option>
          <option value="">Con los anulados</option>
        </select>
        <Btn small onClick={limpiar}>Limpiar filtros</Btn>
        <Btn small onClick={recargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      <div className={s.stats}>
        <Stat label="Pagos" value={stats.cantidad} nota={stats.anulados ? `+ ${stats.anulados} anulado${stats.anulados === 1 ? '' : 's'}` : undefined} />
        <Stat label={medio ? `Pagado en ${medioTxt(medio)}` : 'Total pagado'} value={money(stats.total)} />
        <Stat label="Proveedores" value={stats.proveedores} />
        <Stat
          label="Sin aplicar"
          value={money(stats.sinAplicar)}
          accent={stats.sinAplicar > 0.009 ? 'accent-amber' : undefined}
          nota="Plata pagada que todavía no está aplicada a una factura o gasto"
        />
      </div>

      {stats.porMedio.length > 1 && !medio && (
        <div className={s.hint} style={{ margin: 0 }}>
          Por medio: {stats.porMedio.map(([m, v]) => `${medioTxt(m)} ${money(v)}`).join(' · ')}
        </div>
      )}

      {pagos.length >= TOPE && (
        <div className={s.callout}>
          Se muestran los {TOPE} pagos más nuevos. Achicá las fechas para ver el resto y que los totales sumen todo.
        </div>
      )}

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Proveedor' }, { h: 'Medio' }, { h: 'Origen' },
          { h: 'Importe', num: true }, { h: 'Aplicado a' }, { h: 'Estado' },
        ]}
        empty={cargando ? 'Cargando…' : 'No hay pagos con esos filtros.'}
        pag={pag}
      >
        {pag.visibles.map((p) => {
          const anulado = p.estado === 'anulado';
          const destinos = p.imputadoA ?? [];
          const cuentas = desdeCuentas(p);
          return (
            <tr
              key={p.id}
              className={s.clickable}
              onClick={() => openModal('pagoSucursalDetalle', { pagoId: p.id, onChange: recargar })}
            >
              <td>
                {fmtFechaHora(p.fecha)}
                <div className={s.hint} style={{ margin: 0 }}>N° {p.id}</div>
              </td>
              <td>
                <div>
                  {p.esFlete && <><Pill pill="est-recibida" label="Flete" />{' '}</>}
                  {p.destino === 'gastos' && <><Pill pill="est-pendiente" label="Gasto" />{' '}</>}
                  {p.proveedorNombre}
                </div>
                {(p.concepto || p.referencia) && (
                  <div className={s.hint} style={{ margin: 0 }}>{[p.concepto, p.referencia].filter(Boolean).join(' · ')}</div>
                )}
              </td>
              <td>
                {comoSePago(p)}
                {cuentas && <div className={s.hint} style={{ margin: 0 }}>{cuentas}</div>}
              </td>
              <td>
                {p.sucursalNombre || <span className={s.muted}>—</span>}
                <div className={s.hint} style={{ margin: 0 }}>
                  {[origenTxt(p), p.usuarioNombre].filter(Boolean).join(' · ')}
                </div>
              </td>
              <td className={s.num}><strong>{money(p.importe)}</strong></td>
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
              <td>
                {anulado
                  ? <Pill pill="est-cancelada" label="Anulado" />
                  : p.saldo > 0.009
                    ? <Pill pill="est-pendiente" label={`Sin aplicar ${money(p.saldo)}`} />
                    : <Pill pill="est-recibida" label="Aplicado" />}
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s.hint}>
        Un pago con varios medios aparece cuando alguno coincide con el medio elegido, y el total
        cuenta solo esa parte. Tocá un pago para ver su detalle, completar el papel o anularlo.
      </div>
    </div>
  );
}
