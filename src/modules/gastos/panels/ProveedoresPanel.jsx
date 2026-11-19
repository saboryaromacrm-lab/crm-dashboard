import { useMemo, useState } from 'react';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { inicioDeMes, hoyISO } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, Pill, Saldo, money, fmtFecha, usePaginado, s } from '../components/ui.jsx';

/**
 * GASTOS › PROVEEDORES (19/11/2026, pedido del dueño: «todos los de gastos
 * solamente»). Los que facturan gastos —servicios, fletes, honorarios,
 * alquiler—, con lo que se les gastó en el período, lo que falta pagarles y el
 * último gasto. Un proveedor de mercadería que además factura gastos (el que
 * cobra el flete) también está, marcado.
 *
 * Es EL MISMO padrón del módulo Proveedores —una entidad, un CUIT, una
 * cuenta—: acá se lo puede dar de alta o corregir sin salir de Gastos. La ficha
 * COMPLETA se pide aparte (`/proveedores?tipo=gastos`, detrás de
 * `gastos.proveedores`): el formulario de edición la reenvía entera, y
 * prellenarlo con una versión recortada le borraba al proveedor el CUIT y el
 * contacto. Los importes vienen de `/gastos/por-proveedor` (las mismas cuentas
 * que el Resumen).
 */
const ORDENES = {
  nombre: { label: 'Nombre', fn: (a, b) => a.nombre.localeCompare(b.nombre) },
  total: { label: 'Lo gastado en el período', fn: (a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre) },
  faltaPagar: { label: 'Lo que falta pagar', fn: (a, b) => b.faltaPagar - a.faltaPagar || a.nombre.localeCompare(b.nombre) },
  ultimo: { label: 'El último gasto', fn: (a, b) => String(b.ultimo ?? '').localeCompare(String(a.ultimo ?? '')) },
};

export function ProveedoresPanel() {
  const { openModal, recargar } = useGastos();
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('total');
  const { data: padron, reload: recargarPadron, loading } = useResource('padron-gastos', () => gastosApi.proveedores('gastos'));
  const filtros = { desde: desde || undefined, hasta: hasta || undefined };
  const { data: numeros, reload: recargarNumeros } = useResource(`gastos-por-proveedor:${desde}:${hasta}`, () => gastosApi.porProveedor(filtros));

  /** Después de crear o editar se refrescan la lista, sus números y el selector del formulario de gasto. */
  const trasGuardar = () => { recargarPadron(); recargarNumeros(); recargar(); };

  const filas = useMemo(() => {
    const de = new Map((numeros ?? []).map((n) => [n.proveedorId, n]));
    const ql = q.trim().toLowerCase();
    return (padron ?? [])
      .map((p) => ({ ...p, comprobantes: 0, total: 0, faltaPagar: 0, ultimo: null, rubro: '', ...de.get(p.id) }))
      .filter((p) => !ql || p.nombre.toLowerCase().includes(ql) || (p.cuit || '').includes(ql) || p.rubro.toLowerCase().includes(ql))
      .sort(ORDENES[orden].fn);
  }, [padron, numeros, q, orden]);
  const pag = usePaginado(filas, 'gastos-proveedores', `${q}|${orden}|${desde}|${hasta}`);

  const totales = useMemo(() => ({
    gastado: filas.reduce((a, p) => a + p.total, 0),
    faltaPagar: filas.reduce((a, p) => a + p.faltaPagar, 0),
    conDeuda: filas.filter((p) => p.faltaPagar > 0.009).length,
  }), [filas]);

  const stop = (e) => e.stopPropagation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Proveedores"
        desc="Los que facturan gastos: servicios, fletes, honorarios, alquiler. Lo que se les gastó en el período, lo que falta pagarles y el último gasto. Clic en uno para ver su cuenta corriente."
        actions={(
          <Btn variant="btn-primary" onClick={() => openModal('proveedorForm', { onChange: trasGuardar })}>
            + Nuevo proveedor
          </Btn>
        )}
      />

      <div className={s.stats}>
        <Stat label="Proveedores de gastos" value={filas.length} />
        <Stat label="Gastado en el período" value={money(totales.gastado)} />
        <Stat label="Falta pagar" value={money(totales.faltaPagar)} accent={totales.faltaPagar > 0.009 ? 'accent-red' : undefined} nota={`${totales.conDeuda} con saldo`} />
      </div>

      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar por nombre, CUIT o rubro…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <select className={s['select-inline']} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar por">
          {Object.entries(ORDENES).map(([k, o]) => <option key={k} value={k}>Ordenar por: {o.label.toLowerCase()}</option>)}
        </select>
      </div>

      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'Rubro de siempre' }, { h: 'Comprobantes', num: true },
          { h: 'Gastado', num: true }, { h: 'Falta pagar', num: true }, { h: 'Último gasto' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : q ? 'Ningún proveedor de gastos coincide con la búsqueda.' : 'Ningún proveedor está marcado como de gastos todavía.'}
        pag={pag}
      >
        {pag.visibles.map((p) => (
          <tr key={p.id} className={s.clickable} onClick={() => openModal('cuentaProveedor', { proveedorId: p.id })}>
            <td>
              <strong>{p.nombre}</strong>
              {p.proveeMercaderia && <> <Pill pill="est-recibida" label="También mercadería" /></>}
              <div className={s.hint} style={{ margin: 0 }}>
                {[p.cuit && `CUIT ${p.cuit}`, p.telefono].filter(Boolean).join(' · ') || 'Sin CUIT ni teléfono'}
              </div>
            </td>
            <td>{p.rubro || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{p.comprobantes || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{p.total ? money(p.total) : <span className={s.muted}>—</span>}</td>
            <td className={s.num}><Saldo valor={p.faltaPagar}>{p.faltaPagar > 0.009 ? money(p.faltaPagar) : '—'}</Saldo></td>
            <td style={{ whiteSpace: 'nowrap' }}>{p.ultimo ? fmtFecha(p.ultimo) : <span className={s.muted}>Nunca</span>}</td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']} onClick={stop}>
                {/* La ficha ENTERA del padrón, no la recortada: el formulario la reenvía al guardar. */}
                <Btn variant="btn-edit" small onClick={() => openModal('proveedorForm', { proveedor: p, onChange: trasGuardar })}>
                  Editar
                </Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        «Gastado» y «Comprobantes» son del período elegido (sin anulados; las notas de crédito restan). «Falta pagar» es lo que se le
        debe hoy, de cualquier fecha. Para sumar un proveedor que ya existe, marcale «Factura gastos» en su ficha.
      </div>
    </div>
  );
}
