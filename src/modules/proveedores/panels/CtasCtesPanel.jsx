import { BuscadorOpcion } from '@shared/components/BuscadorOpcion.jsx';
import { useRef, useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import { agruparCompromisos } from '../domain/agruparCompromisos.js';
import {
  Btn, ImporteCompromiso, PanelHead, Pill, Stat, Table, VencePill, fmtFecha, money, s,
} from '../components/ui.jsx';

const FILTROS = [
  ['pendientes', 'Pendientes'], ['vencidos', 'Vencidos'], ['semana', 'Esta semana'],
  ['mes', 'Este mes'], ['futuros', 'Futuros'], ['pagados', 'Pagados'], ['todos', 'Todos'],
];

/**
 * CUENTAS CORRIENTES — los compromisos que NO son echeq (esos tienen su
 * sección). El saldo proyectado del EDOC sale de lo que se ve acá + la
 * cartera de echeqs.
 *
 * Siempre agrupado por proveedor (5/11/2026, pedido del dueño): una fila con
 * el total que se despliega con cada comprobante. Se paga todo junto desde la
 * fila del proveedor (la misma pantalla de pago del estado de cuenta, con sus
 * facturas tildadas) o un comprobante solo desde lo desplegado.
 */
export function CtasCtesPanel() {
  const { proveedores, openModal, toast, recargarContadores, panels, goPanel, getProveedor } = useProveedores();
  /* Clic en el proveedor → su estado de cuenta (2/11/2026, pedido del dueño), si este usuario tiene esa sección. */
  const veEdoc = (panels ?? []).some((p) => p.id === 'edoc');
  const [filtro, setFiltro] = useState('pendientes');
  const [proveedorId, setProveedorId] = useState('');
  const [abiertos, setAbiertos] = useState(() => new Set());
  const abriendoPago = useRef(false);
  const { data, reload } = useResource(
    `compromisos:${filtro}:${proveedorId}`,
    () => provApi.compromisos({ filtro, proveedorId: proveedorId || undefined }),
  );
  const { data: stats, reload: reloadStats } = useResource('compromisos-stats', provApi.statsCompromisos);
  const filas = data?.filas ?? [];
  const grupos = agruparCompromisos(filas);

  const refrescar = () => { reload(); reloadStats(); recargarContadores(); };
  const borrar = async (k) => {
    try {
      await provApi.borrarCompromiso(k.id);
      toast('Compromiso eliminado.', 'ok');
      refrescar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };
  const alternar = (id) => setAbiertos((xs) => {
    const ys = new Set(xs);
    if (!ys.delete(id)) ys.add(id);
    return ys;
  });
  /**
   * Pagar todo lo del proveedor: la pantalla de pago del estado de cuenta, con
   * sus facturas ya tildadas. Esa pantalla paga cada factura COMPLETA; si su
   * suma no es lo que se le debe acá (pagos a cuenta, cuotas que no vencen
   * todavía, compromisos manuales), no se abre: se pagaría de más o de menos.
   * Entonces se despliega para pagar de a uno, que sí usa lo que falta.
   */
  const pagarGrupo = async (g) => {
    if (abriendoPago.current) return;
    abriendoPago.current = true;
    try {
      const d = await provApi.edocProveedor(g.proveedorId);
      const docs = d.docsPendientes ?? [];
      const preseleccion = g.comprobantesAPagar.map((id) => `comprobante-${id}`);
      const sumaFacturas = docs.filter((doc) => preseleccion.includes(`${doc.tipo}-${doc.docId}`)).reduce((a, doc) => a + doc.saldo, 0);
      if (Math.abs(sumaFacturas - g.aPagar) > 0.009) {
        setAbiertos((xs) => new Set(xs).add(g.proveedorId));
        toast(`A ${g.proveedorNombre} le debés ${money(g.aPagar)}, pero pagar sus facturas completas sería ${money(sumaFacturas)} (tiene pagos a cuenta, cuotas o compromisos manuales). Pagá cada uno desde lo desplegado.`, 'err');
        return;
      }
      openModal('pagoProveedor', { proveedor: d.proveedor, docs, preseleccion, saldo: d.saldo, onChange: refrescar });
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally { abriendoPago.current = false; }
  };

  const nombre = (proveedorIdFila, texto) => (
    <>
      {veEdoc ? (
        <button
          type="button" title="Ver su estado de cuenta"
          onClick={(e) => { e.stopPropagation(); goPanel('edoc', { proveedorId: proveedorIdFila }); }}
          style={{
            all: 'unset', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline',
            textDecorationColor: 'var(--crm-color-border, #ccc)', textUnderlineOffset: 3,
          }}
        >
          {texto}
        </button>
      ) : texto}
      {getProveedor(proveedorIdFila)?.modoCuenta === 'libre' && (
        <div className={s.hint} style={{ margin: 0 }}>cuenta libre: lo pagado cubre lo más viejo</div>
      )}
    </>
  );

  /** Un compromiso: la fila de un proveedor con uno solo, o un renglón de lo desplegado. */
  const fila = (k, dentro) => (
    <tr key={k.id} style={dentro ? { background: 'var(--crm-color-surface-2)' } : undefined}>
      <td style={dentro ? { paddingLeft: 28 } : undefined}>{fmtFecha(k.fechaVenc)} {!k.pagado && <VencePill dias={k.diasRest} />}</td>
      <td>{dentro ? <span className={s.hint} style={{ margin: 0 }}>{k.proveedorNombre}</span> : nombre(k.proveedorId, k.proveedorNombre)}</td>
      <td>
        {k.comprobanteEtiqueta || (k.origen === 'manual' ? 'Manual' : '—')}
        {k.cuota ? ` · cuota ${k.cuota}/${k.cuotas}` : ''}
        {k.obs && <div className={s.hint} style={{ margin: 0 }}>{k.obs}</div>}
      </td>
      <td>{k.diasPlazo ? `Cta cte ${k.diasPlazo}` : 'Cta cte'}</td>
      <td className={s.num}><ImporteCompromiso k={k} /></td>
      <td>{k.pagado ? <Pill pill="est-recibida" label="pagado" /> : <Pill pill="est-pendiente" label="pendiente" />}</td>
      <td>
        {!k.pagado && (
          <div style={{ display: 'flex', gap: 4 }}>
            {k.falta > 0.009
              ? <Btn small variant="btn-primary" onClick={() => openModal('pagarCompromiso', { compromiso: k, onChange: refrescar })}>Pagar</Btn>
              : <span className={s.hint} style={{ margin: 0 }}>{k.cubiertoACuenta > 0.009 ? 'cubierta con lo pagado a cuenta' : 'cubierta'}</span>}
            <Btn small onClick={() => openModal('compromiso', { compromiso: k, onChange: refrescar })}>Editar</Btn>
            <Btn small onClick={() => borrar(k)}>×</Btn>
          </div>
        )}
      </td>
    </tr>
  );

  /** La fila del proveedor con varios: el total, y al tocarla se despliega. */
  const filaGrupo = (g) => {
    const abierto = abiertos.has(g.proveedorId);
    const k = g.primera;
    return (
      <tr key={`p-${g.proveedorId}`} className={s.clickable} onClick={() => alternar(g.proveedorId)} aria-expanded={abierto} title={abierto ? 'Plegar' : 'Ver cada uno'}>
        <td>{fmtFecha(k.fechaVenc)} {!g.pagado && <VencePill dias={k.diasRest} />}</td>
        <td>{nombre(g.proveedorId, g.proveedorNombre)}</td>
        <td>{abierto ? '▾ ' : '▸ '}<strong>{g.filas.length} {g.todasConComprobante ? 'comprobantes' : 'compromisos'}</strong></td>
        <td>{g.plazo ? (g.plazo.dias ? `Cta cte ${g.plazo.dias}` : 'Cta cte') : 'varios'}</td>
        <td className={s.num}><strong>{money(g.total)}</strong></td>
        <td>{g.pagado ? <Pill pill="est-recibida" label="pagado" /> : <Pill pill="est-pendiente" label="pendiente" />}</td>
        <td>
          {veEdoc && g.comprobantesAPagar.length > 0 && (
            <Btn small variant="btn-primary" onClick={(e) => { e.stopPropagation(); pagarGrupo(g); }}>Pagar</Btn>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <PanelHead
        title="Cuentas corrientes"
        desc="Las promesas de pago con fecha. Nacen solas al confirmar la factura de un proveedor de cta cte, y se cierran solas cuando el pago salda la factura. Lo pagado a cuenta y los ajustes ya están descontados: cubren primero lo que vence antes, así que acá nunca ves más de lo que le debés a cada proveedor."
        actions={<Btn variant="btn-primary" onClick={() => openModal('compromiso', { onChange: refrescar })}>+ Compromiso manual</Btn>}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Vencidos" value={`${stats?.vencidos?.n ?? 0} · ${money(stats?.vencidos?.monto ?? 0)}`} accent={stats?.vencidos?.n ? 'accent-red' : undefined} />
        <Stat label="Próximos 3 días" value={`${stats?.prox3?.n ?? 0} · ${money(stats?.prox3?.monto ?? 0)}`} accent={stats?.prox3?.n ? 'accent-amber' : undefined} />
        <Stat label="Esta semana" value={`${stats?.semana?.n ?? 0} · ${money(stats?.semana?.monto ?? 0)}`} />
        <Stat label="Total pendiente" value={`${stats?.total?.n ?? 0} · ${money(stats?.total?.monto ?? 0)}`} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {FILTROS.map(([k, v]) => (
          <Btn key={k} small variant={filtro === k ? 'btn-primary' : undefined} onClick={() => setFiltro(k)}>{v}</Btn>
        ))}
        <BuscadorOpcion
          ariaLabel="Proveedor" style={{ marginLeft: 'auto' }}
          opciones={proveedores}
          value={proveedorId} onChange={setProveedorId}
          todos="Todos los proveedores" placeholder="Escribí el proveedor…"
        />
      </div>

      <Table cols={[
        { h: 'Vence' }, { h: 'Proveedor' }, { h: 'Detalle' },
        { h: 'Plazo' }, { h: 'Importe', num: true }, { h: 'Estado' }, { h: 'Acciones' },
      ]}>
        {grupos.flatMap((g) => (g.filas.length === 1
          ? [fila(g.filas[0], false)]
          : [filaGrupo(g), ...(abiertos.has(g.proveedorId) ? g.filas.map((k) => fila(k, true)) : [])]))}
      </Table>
      {!filas.length && <div className={s['empty-state']}>Nada en este filtro.</div>}
      {filas.length > 0 && (
        <div className={s.hint} style={{ marginTop: 8 }}>
          {grupos.length} proveedor(es) · {data.total} compromiso(s) · {money(data.totalImporte)}
        </div>
      )}
    </div>
  );
}
