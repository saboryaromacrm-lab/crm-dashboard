/**
 * GERENCIA › RENTABILIDAD — el margen de verdad (0072)
 * ============================================================================
 * El tablero que separa lo que PARECE que se gana de lo que se gana. La
 * diferencia tiene nombre y apellido: el IVA que el negocio absorbe por la
 * mercadería comprada sin factura — al facturar la venta ese IVA se paga
 * igual, y no hay crédito que lo compense.
 *
 * TODO el margen sale del costo CONGELADO en cada renglón al vender (0072).
 * Los renglones anteriores a esa fecha no lo tienen, y acá no se inventa: el
 * aviso de cobertura dice cuántos quedaron afuera. Con el tiempo desaparece.
 *
 * La tabla agrupa por producto / marca / categoría / proveedor con el MISMO
 * dato — no son cuatro reportes, es uno con cuatro lentes.
 */
import { useCallback, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
// El mismo hook chico que usan Ventas y Gastos: pedir, cachear por clave, recargar.
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, usePaginado, Paginador, s } from '@modules/productos/components/ui.jsx';

/** Primer día del mes y hoy, en 'AAAA-MM-DD' LOCAL (toISOString corre el día). */
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const LENTES = {
  producto: { label: 'Producto', clave: (x) => `p${x.productoId}`, nombre: (x) => x.nombre },
  marca: { label: 'Marca', clave: (x) => `m${x.marcaId ?? 0}`, nombre: (x) => x.marca || 'Sin marca' },
  categoria: { label: 'Categoría', clave: (x) => `c${x.categoriaId ?? 0}`, nombre: (x) => x.categoria || 'Sin categoría' },
  proveedor: { label: 'Proveedor', clave: (x) => `v${x.proveedorId ?? 0}`, nombre: (x) => x.proveedor || 'Sin proveedor' },
};

function Stat({ label, valor, detalle, tono }) {
  const color = tono === 'ok' ? 'var(--crm-color-success)' : tono === 'err' ? 'var(--crm-color-danger)'
    : tono === 'warn' ? 'var(--crm-color-warning, #b45309)' : undefined;
  return (
    <div className={cx(s.card, s.cardPad)} style={{ minWidth: 170, flex: 1 }}>
      <div className={s['mini-label']}>{label}</div>
      <strong className={s.mono} style={{ fontSize: 18, color }}>{valor}</strong>
      {detalle && <div className={s.hint} style={{ margin: '4px 0 0' }}>{detalle}</div>}
    </div>
  );
}

export function RentabilidadPanel() {
  const hoy = new Date();
  const [desde, setDesde] = useState(isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(isoLocal(hoy));
  const [lente, setLente] = useState('producto');
  const [soloSinFactura, setSoloSinFactura] = useState(false);

  const { data, loading, error, reload } = useResource(
    `rentabilidad:${desde}:${hasta}`,
    () => httpClient.get(`/gerencia/rentabilidad?desde=${desde}&hasta=${hasta}`),
  );

  /* ---- El lente: agrupar los productos por la clave elegida ---- */
  const filas = useMemo(() => {
    const base = (data?.porProducto ?? []).filter((x) => !soloSinFactura || x.sinFactura);
    if (lente === 'producto') return base;
    const L = LENTES[lente];
    const grupos = new Map();
    for (const x of base) {
      const k = L.clave(x);
      const g = grupos.get(k) ?? {
        nombre: L.nombre(x), productos: 0, unidades: 0, ventaNeta: 0, ventaCosteada: 0,
        costo: 0, margenReal: 0, margenAparente: 0, ivaAbsorbido: 0, sinFactura: false,
      };
      g.productos += 1;
      g.unidades += x.unidades;
      g.ventaNeta += x.ventaNeta;
      g.ventaCosteada += x.ventaCosteada;
      g.costo += x.costo ?? 0;
      g.margenReal += x.margenReal ?? 0;
      g.margenAparente += x.margenAparente ?? 0;
      g.ivaAbsorbido += x.ivaAbsorbido;
      g.sinFactura = g.sinFactura || x.sinFactura;
      grupos.set(k, g);
    }
    return [...grupos.values()]
      .map((g) => ({ ...g, margenRealPct: g.ventaCosteada > 0 ? (g.margenReal / g.ventaCosteada) * 100 : null }))
      .sort((a, b) => b.ventaNeta - a.ventaNeta);
  }, [data, lente, soloSinFactura]);

  const pag = usePaginado(filas, 'rentabilidad', `${lente}|${soloSinFactura}|${desde}|${hasta}`);

  const recargar = useCallback(() => reload(), [reload]);

  if (error) {
    return (
      <div>
        <PanelHead title="Rentabilidad" desc="El margen real del período." />
        <div className={cx(s.callout, s.warn)}>
          No se pudo cargar: <strong>{String(error?.data?.message || error?.message || error)}</strong>
          <div style={{ marginTop: 8 }}><Btn small variant="btn-primary" onClick={recargar}>Reintentar</Btn></div>
        </div>
      </div>
    );
  }

  const t = data?.totales;
  const f = data?.fiscal;
  const sf = data?.sinFactura;
  const stock = data?.stockSinFactura;
  const cob = data?.cobertura;
  const sinCosto = cob ? cob.renglones - cob.conCosto : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Rentabilidad"
        desc="Margen real contra margen aparente: la diferencia es el IVA que el negocio absorbe por la mercadería sin factura. Todo sale del costo congelado en cada venta."
        actions={<Btn variant="btn-ghost" small onClick={recargar}>Actualizar</Btn>}
      />

      {/* ---- El período ---- */}
      <div className={s.toolbar}>
        <label className={s['mini-label']} style={{ margin: 0 }}>Desde</label>
        <input type="date" className={s['select-inline']} value={desde} onChange={(e) => setDesde(e.target.value)} />
        <label className={s['mini-label']} style={{ margin: 0 }}>Hasta</label>
        <input type="date" className={s['select-inline']} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        {loading && <span className={s.muted}>Cargando…</span>}
      </div>

      {!data && loading && <div className={s.muted}>Cargando el período…</div>}

      {data && (
        <>
          {/*
           * LA COBERTURA VA PRIMERA: si la mitad de los renglones no tiene costo
           * congelado (son de antes de la 0072), los totales hablan solo de la
           * otra mitad — y eso se dice ANTES de los números, no en un pie.
           */}
          {sinCosto > 0 && (
            <div className={cx(s.callout, s.info)}>
              <strong>{sinCosto}</strong> de {cob.renglones} renglones del período son anteriores al
              costo congelado y quedan <strong>fuera del margen</strong> (la venta sí se cuenta).
              A medida que se venda, este aviso desaparece solo.
            </div>
          )}

          {/* ---- Los cuatro números del período ---- */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Stat label="Venta neta" valor={money(t.ventaNeta)} detalle="Sin IVA ni cargos extra. Anuladas afuera." />
            <Stat
              label="Margen real" valor={money(t.margenReal)} tono={t.margenReal >= 0 ? 'ok' : 'err'}
              detalle={t.ventaCosteada > 0 ? `${num((t.margenReal / t.ventaCosteada) * 100, 1)}% sobre la venta costeada` : 'Sin renglones con costo'}
            />
            <Stat
              label="Margen aparente" valor={money(t.margenAparente)}
              detalle="El que se ve si solo se mira el markup."
            />
            <Stat
              label="IVA absorbido" valor={money(t.ivaAbsorbido)} tono={t.ivaAbsorbido > 0 ? 'warn' : undefined}
              detalle="La diferencia entre los dos márgenes: sale de tu bolsillo al facturar."
            />
          </div>

          {/* ---- Lo sin factura y la posición fiscal ---- */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Stat
              label="Venta de mercadería sin factura" valor={money(sf.ventaNeta)}
              detalle={`${sf.productos} producto(s) · ${num(sf.participacion, 1)}% de la venta del período`}
            />
            <Stat
              label="Stock sin factura hoy" valor={money(stock.valorReal)}
              detalle={`${stock.productos} producto(s) · si se vende todo, se absorben ${money(stock.ivaAbsorber)} más`}
            />
            <Stat
              label="IVA débito (ventas facturadas)" valor={money(f.debitoVentas)}
              detalle={`${f.ventasFacturadas} factura(s) de venta en el período`}
            />
            <Stat
              label="Crédito vs. débito" valor={money(f.posicion)}
              tono={f.posicion > 0 ? 'warn' : 'ok'}
              detalle={`Crédito: ${money(f.creditoCompras)} compras + ${money(f.creditoGastos)} gastos. ${f.posicion > 0 ? 'El crédito NO alcanza: esto queda por pagar.' : 'El crédito cubre el débito del período.'}`}
            />
          </div>

          {/* ---- La tabla, con sus cuatro lentes ---- */}
          <div className={s.toolbar}>
            {Object.entries(LENTES).map(([k, v]) => (
              <Btn key={k} small variant={lente === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setLente(k)}>
                {v.label}
              </Btn>
            ))}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, marginLeft: 'auto', cursor: 'pointer' }}>
              <input type="checkbox" checked={soloSinFactura} onChange={(e) => setSoloSinFactura(e.target.checked)} />
              Solo mercadería sin factura
            </label>
          </div>

          <Table
            cols={[
              { h: LENTES[lente].label },
              ...(lente !== 'producto' ? [{ h: 'Prod.', num: true }] : []),
              { h: 'Unid.', num: true }, { h: 'Venta neta', num: true }, { h: 'Costo real', num: true },
              { h: 'Margen real', num: true }, { h: '%', num: true }, { h: 'IVA absorbido', num: true },
            ]}
            empty={soloSinFactura ? 'Nada vendido como sin factura en el período.' : 'Sin ventas en el período.'}
            pag={pag}
          >
            {pag.visibles.map((x, i) => (
              <tr key={x.productoId ?? `${lente}-${i}`}>
                <td>
                  {x.nombre}
                  {lente === 'producto' && x.sinFactura && (
                    <span className={s.hint} style={{ margin: 0 }}> · sin factura{x.porcAhora ? ` (hoy ${num(x.porcAhora, 0)}%)` : ''}</span>
                  )}
                </td>
                {lente !== 'producto' && <td className={s.num}>{x.productos}</td>}
                <td className={s.num}>{num(x.unidades, 2)}</td>
                <td className={s.num}>{money(x.ventaNeta)}</td>
                <td className={s.num}>{x.costo != null ? money(x.costo) : <span className={s.muted}>—</span>}</td>
                <td className={s.num}>
                  {x.margenReal != null
                    ? <strong style={{ color: x.margenReal < 0 ? 'var(--crm-color-danger)' : undefined }}>{money(x.margenReal)}</strong>
                    : <span className={s.muted}>—</span>}
                </td>
                <td className={s.num}>{x.margenRealPct != null ? `${num(x.margenRealPct, 1)}%` : ''}</td>
                <td className={s.num}>{x.ivaAbsorbido > 0 ? money(x.ivaAbsorbido) : <span className={s.muted}>—</span>}</td>
              </tr>
            ))}
          </Table>
          <Paginador pag={pag} />
          {data.productosRecortados > 0 && (
            <div className={s.hint}>La tabla muestra los 500 productos con más venta; quedaron {data.productosRecortados} afuera. Achicá el período para verlos.</div>
          )}

          {/* ---- El control por proveedor: lo declarado contra lo real ---- */}
          {data.porProveedor.length > 0 && (
            <div>
              <div className={s['section-title']}>Compras sin factura por proveedor</div>
              <div className={s.hint} style={{ marginTop: 0 }}>
                Lo que cada proveedor facturó de verdad en el período contra el % declarado en su
                ficha. Si difieren en serio, el costo de sus productos está mal partido — y el precio también.
              </div>
              <Table
                cols={[
                  { h: 'Proveedor' }, { h: 'Facturado (neto)', num: true }, { h: 'Liquidación', num: true },
                  { h: '% real', num: true }, { h: '% declarado', num: true }, { h: '' },
                ]}
                empty="Sin compras con liquidación en el período."
              >
                {data.porProveedor.map((p) => (
                  <tr key={p.proveedorId}>
                    <td>{p.nombre}</td>
                    <td className={s.num}>{money(p.facturadoNeto)}</td>
                    <td className={s.num}>{money(p.liquidado)}</td>
                    <td className={s.num}>{num(p.porcReal, 1)}%</td>
                    <td className={s.num}>{num(p.porcDeclarado, 1)}%</td>
                    <td>
                      {p.desvio && (
                        <span style={{ color: 'var(--crm-color-danger)', fontWeight: 700 }}>
                          ⚠ revisar el % de sus formatos
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
