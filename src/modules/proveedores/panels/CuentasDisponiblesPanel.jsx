import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import {
  Btn, PanelHead, Pill, Stat, Table, fmtFecha, fmtFechaHora, money, s,
} from '../components/ui.jsx';

const ESTADOS = [['abiertas', 'Abiertas'], ['cubiertas', 'Cubiertas'], ['cortadas', 'Cortadas'], ['todas', 'Todas']];
const VISTAS = [['cuentas', 'Cuentas'], ['pagos', 'Pagos'], ['reporte', 'Reporte']];

const primeroDelMes = () => {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
};
const hoyISO = () => {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * CUENTAS DISPONIBLES — la transferencia tercerizada (0095).
 * ============================================================================
 * Se le debe a un proveedor y, en vez de pagarle de la cuenta propia, se le da
 * a los clientes SU alias: el cliente transfiere directo. Acá se cargan esas
 * cuentas ("a esta cuenta hay que hacerle llegar $X") y se mira cómo se van
 * cubriendo. Los PAGOS no se cargan acá: nacen del cobro (POS o recibo) y por
 * eso cada uno sabe de qué cliente y de qué comprobante viene.
 */
export function CuentasDisponiblesPanel() {
  const { openModal } = useProveedores();
  const [vista, setVista] = useState('cuentas');
  // El alta vive en la cabecera y la lista adentro: un tick los une.
  const [tick, setTick] = useState(0);
  return (
    <div>
      <PanelHead
        title="Cuentas disponibles"
        desc="Cuentas bancarias de proveedores a las que los clientes transfieren directo. Cada transferencia cobra la venta y le paga al proveedor en el mismo acto."
        actions={vista === 'cuentas' && (
          <Btn variant="btn-primary" onClick={() => openModal('cuentaDisponible', { onChange: () => setTick((t) => t + 1) })}>
            + Nueva cuenta
          </Btn>
        )}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {VISTAS.map(([k, v]) => (
          <Btn key={k} small variant={vista === k ? 'btn-primary' : undefined} onClick={() => setVista(k)}>{v}</Btn>
        ))}
      </div>
      {vista === 'cuentas' && <VistaCuentas tick={tick} />}
      {vista === 'pagos' && <VistaPagos />}
      {vista === 'reporte' && <VistaReporte />}
    </div>
  );
}

/* ------------------------------ Cuentas ------------------------------ */

function VistaCuentas({ tick }) {
  const { proveedores, openModal, toast, recargarContadores } = useProveedores();
  const [estado, setEstado] = useState('abiertas');
  const [proveedorId, setProveedorId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const { data, reload } = useResource(
    `ctas-disp:${tick}:${estado}:${proveedorId}:${desde}:${hasta}`,
    () => provApi.cuentasDisponibles({ estado, proveedorId: proveedorId || undefined, desde: desde || undefined, hasta: hasta || undefined }),
  );
  const refrescar = () => { reload(); recargarContadores(); };
  const filas = data?.filas ?? [];

  /** Los tildes se cambian en el lugar; la API decide y la lista se vuelve a pedir. */
  const cambiar = async (c, campo, valor) => {
    try {
      await provApi.editarCuentaDisponible(c.id, { [campo]: valor });
      refrescar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };
  const borrar = async (c) => {
    try {
      await provApi.borrarCuentaDisponible(c.id);
      toast('Cuenta eliminada.', 'ok');
      refrescar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };
  const copiar = async (c) => {
    try { await navigator.clipboard.writeText(c.cbuAlias); toast('Alias copiado.', 'ok'); }
    catch { toast('No se pudo copiar.', 'err'); }
  };

  const fondo = (c) => (c.estado === 'cubierta'
    ? { background: 'color-mix(in srgb, var(--crm-color-success) 12%, transparent)' }
    : c.estado === 'cortada' ? { opacity: 0.6 } : undefined);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {ESTADOS.map(([k, v]) => (
          <Btn key={k} small variant={estado === k ? 'btn-primary' : undefined} onClick={() => setEstado(k)}>{v}</Btn>
        ))}
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} style={{ marginLeft: 'auto' }}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
        {(proveedorId || desde || hasta) && (
          <Btn small onClick={() => { setProveedorId(''); setDesde(''); setHasta(''); }}>Limpiar</Btn>
        )}
        <Btn small onClick={refrescar}>Actualizar</Btn>
      </div>

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Proveedor' }, { h: 'Titular' }, { h: 'Alias / CBU' },
          { h: 'A cubrir', num: true }, { h: 'Pagado', num: true }, { h: 'Falta', num: true }, { h: 'Cant', num: true },
          { h: '★' }, { h: 'Enviado' }, { h: 'Corte' }, { h: 'Obs.' }, { h: 'Acciones' },
        ]}
        empty="Nada en este filtro."
      >
        {filas.map((c) => (
          <tr key={c.id} style={fondo(c)}>
            <td>{fmtFecha(c.fecha)}</td>
            <td><strong>{c.proveedorNombre}</strong></td>
            <td>{c.titular}</td>
            <td>
              <span className={s.mono}>{c.cbuAlias}</span>{' '}
              <Btn small onClick={() => copiar(c)} title="Copiar alias">⧉</Btn>
            </td>
            <td className={s.num}><strong>{money(c.importe)}</strong></td>
            <td className={s.num} style={{ color: 'var(--crm-color-success)' }}>{money(c.pagado)}</td>
            <td className={s.num}>
              {c.estado === 'cubierta' ? <Pill pill="est-recibida" label="cubierta" /> : <strong>{money(c.falta)}</strong>}
              {c.restoBajoMinimo && (
                <div><Pill pill="est-pendiente" label={`resto bajo el mínimo (${money(c.minimo)})`} /></div>
              )}
            </td>
            <td className={s.num}>{c.cant}</td>
            <td>
              <button
                type="button" onClick={() => cambiar(c, 'prioritaria', !c.prioritaria)}
                title={c.prioritaria ? 'Prioritaria: se ofrece primero en la caja' : 'Marcar como prioritaria'}
                style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 18, color: c.prioritaria ? '#d97706' : 'var(--crm-color-text-muted)' }}
              >
                {c.prioritaria ? '★' : '☆'}
              </button>
            </td>
            <td><input type="checkbox" checked={c.enviado} onChange={(e) => cambiar(c, 'enviado', e.target.checked)} title="Resumen enviado al proveedor" /></td>
            <td><input type="checkbox" checked={c.corte} onChange={(e) => cambiar(c, 'corte', e.target.checked)} title="Corte: cerrar aunque no esté completa" /></td>
            <td>{c.observaciones || <span className={s.muted}>—</span>}</td>
            <td>
              <div style={{ display: 'flex', gap: 4 }}>
                <Btn small variant="btn-primary" onClick={() => openModal('resumenCuenta', { cuentaId: c.id, onChange: refrescar })}>Resumen</Btn>
                <Btn small onClick={() => openModal('cuentaDisponible', { cuenta: c, onChange: refrescar })}>Editar</Btn>
                {c.puedeBorrar && <Btn small onClick={() => borrar(c)} title="Borrar (solo sin transferencias)">×</Btn>}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      {filas.length > 0 && (
        <div className={s.hint} style={{ marginTop: 8 }}>
          {data.total} cuenta(s) · a cubrir {money(data.totalImporte)} · falta {money(data.totalFalta)}
        </div>
      )}
    </>
  );
}

/* ------------------------------- Pagos ------------------------------- */

function VistaPagos() {
  const { proveedores, toast } = useProveedores();
  const [proveedorId, setProveedorId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [anulados, setAnulados] = useState(false);
  const { data } = useResource(
    `ctas-disp-pagos:${proveedorId}:${desde}:${hasta}:${anulados}`,
    () => provApi.pagosCuentasDisponibles({
      proveedorId: proveedorId || undefined, desde: desde || undefined, hasta: hasta || undefined, anulados: anulados || undefined,
    }),
  );
  const filas = data?.filas ?? [];
  const copiar = async (t) => {
    try { await navigator.clipboard.writeText(t); toast('Copiado.', 'ok'); }
    catch { toast('No se pudo copiar.', 'err'); }
  };

  return (
    <>
      <div className={s.hint} style={{ marginTop: 0 }}>
        Cada transferencia con su cliente y su comprobante. No se cargan a mano: nacen del cobro en la caja o del recibo.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={anulados} onChange={(e) => setAnulados(e.target.checked)} /> Ver anuladas
        </label>
        {(proveedorId || desde || hasta) && (
          <Btn small onClick={() => { setProveedorId(''); setDesde(''); setHasta(''); }}>Limpiar</Btn>
        )}
      </div>
      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Proveedor' }, { h: 'Titular · alias' }, { h: 'Cliente' }, { h: 'Comprobante' },
          { h: 'Monto', num: true }, { h: 'Cajero' }, { h: 'Obs.' }, { h: '' },
        ]}
        empty="Sin transferencias en este filtro."
      >
        {filas.map((p) => (
          <tr key={p.id} style={p.anuladoEn ? { opacity: 0.55, textDecoration: 'line-through' } : undefined}>
            <td>{fmtFechaHora(p.fecha)}</td>
            <td><strong>{p.proveedorNombre}</strong></td>
            <td>{p.titular} <span className={cx(s.mono, s.muted)}>{p.cbuAlias}</span></td>
            <td>{p.clienteNombre || '—'}</td>
            <td className={s.mono}>{p.documento ? `${p.documento.clase === 'recibo' ? 'Recibo' : 'Venta'} ${p.documento.etiqueta}` : '—'}</td>
            <td className={s.num} style={{ color: 'var(--crm-color-success)' }}><strong>{money(p.importe)}</strong></td>
            <td>{p.usuarioNombre || '—'}</td>
            <td>{p.anuladoEn ? <Pill pill="est-cancelada" label="anulada" /> : (p.observaciones || <span className={s.muted}>—</span>)}</td>
            <td><Btn small onClick={() => copiar(`${p.titular} · ${p.cbuAlias} · ${money(p.importe)}`)}>Copiar</Btn></td>
          </tr>
        ))}
      </Table>
      {filas.length > 0 && (
        <div className={s.hint} style={{ marginTop: 8 }}>
          Total filtrado: <strong>{money(data.totalImporte)}</strong> ({data.total} transferencia(s) viva(s))
        </div>
      )}
    </>
  );
}

/* ------------------------------ Reporte ------------------------------ */

function VistaReporte() {
  const { proveedores } = useProveedores();
  const [desde, setDesde] = useState(primeroDelMes);
  const [hasta, setHasta] = useState(hoyISO);
  const [proveedorId, setProveedorId] = useState('');
  const { data } = useResource(
    `ctas-disp-reporte:${desde}:${hasta}:${proveedorId}`,
    () => provApi.reporteCuentasDisponibles({ desde: desde || undefined, hasta: hasta || undefined, proveedorId: proveedorId || undefined }),
  );
  const filas = useMemo(() => data?.porProveedor ?? [], [data]);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label className={s.hint} style={{ margin: 0 }}>Desde</label>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <label className={s.hint} style={{ margin: 0 }}>Hasta</label>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <Btn small onClick={() => { setDesde(primeroDelMes()); setHasta(hoyISO()); setProveedorId(''); }}>Este mes</Btn>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Total del período" value={money(data?.total ?? 0)} accent="accent-green" />
        <Stat label="Cantidad de transferencias" value={String(data?.n ?? 0)} />
        <Stat label="Promedio por transferencia" value={money(data?.promedio ?? 0)} />
      </div>
      <Table cols={[{ h: 'Proveedor' }, { h: 'Cantidad', num: true }, { h: 'Monto', num: true }]} empty="Sin transferencias en el período.">
        {filas.map((r) => (
          <tr key={r.proveedorId}>
            <td><strong>{r.proveedorNombre}</strong></td>
            <td className={s.num}>{r.n}</td>
            <td className={s.num}><strong>{money(r.monto)}</strong></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
