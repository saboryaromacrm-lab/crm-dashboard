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
 *
 * POR LOCAL (3/11/2026, pedido del dueño): con «Todas», una tabla compara los
 * locales; elegido uno, todo lo de las ventas es de ese local. Las compras, el
 * crédito fiscal y el stock sin factura son del negocio entero (un CUIT, un
 * depósito): con un local elegido no se muestran, para no mezclarlos con lo suyo.
 *
 * DÍAS ABIERTOS (9/11/2026): cuántos días abrió y cuántos turnos hubo, y la
 * venta por día abierto (del negocio y de cada local), para que un período con
 * feriados no parezca flojo.
 */
import { useCallback, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
// El mismo hook chico que usan Ventas y Gastos: pedir, cachear por clave, recargar.
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, usePaginado, Paginador, s } from '@modules/productos/components/ui.jsx';
import { DiasAbiertos } from './DiasAbiertos.jsx';

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
  const [sucursalId, setSucursalId] = useState('');
  const [lente, setLente] = useState('producto');
  const [soloSinFactura, setSoloSinFactura] = useState(false);

  const { data, loading, error, reload } = useResource(
    `rentabilidad:${desde}:${hasta}:${sucursalId}`,
    () => httpClient.get(`/gerencia/rentabilidad?desde=${desde}&hasta=${hasta}${sucursalId ? `&sucursalId=${sucursalId}` : ''}`),
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

  const pag = usePaginado(filas, 'rentabilidad', `${lente}|${soloSinFactura}|${desde}|${hasta}|${sucursalId}`);

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
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {(data?.sucursales ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        {loading && <span className={s.muted}>Cargando…</span>}
      </div>

      {!data && loading && <div className={s.muted}>Cargando el período…</div>}

      {data && (
        <>
          <DiasAbiertos a={data.actividad} />
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
              label="Venta por día abierto" valor={data.actividad.ventaPorDia != null ? money(data.actividad.ventaPorDia) : '—'}
              detalle={`La venta neta repartida en los ${data.actividad.abiertos} días que abrió: así un período con feriados no parece flojo.`}
            />
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

          {sucursalId ? (
            <div className={s.hint} style={{ margin: 0 }}>
              Ventas y margen de este local. Las compras, el crédito fiscal y el stock sin factura son de todo el negocio:
              se ven con «Todas las sucursales». Para saber si el local gana plata después de sus gastos y sueldos, mirá
              Gerencia › Resultados con el local elegido.
            </div>
          ) : data.porSucursal.length > 0 && (
            <PorSucursal filas={data.porSucursal} onElegir={(id) => setSucursalId(String(id))} />
          )}

          {/* ---- Lo sin factura y la posición fiscal ---- */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Stat
              label="Venta de mercadería sin factura" valor={money(sf.ventaNeta)}
              detalle={`${sf.productos} producto(s) · ${num(sf.participacion, 1)}% de la venta del período`}
            />
            {!sucursalId && (
              <Stat
                label="Stock sin factura hoy" valor={money(stock.valorReal)}
                detalle={`${stock.productos} producto(s) · si se vende todo, se absorben ${money(stock.ivaAbsorber)} más`}
              />
            )}
            {/* LO QUE ENTRÓ POR FINANCIAR, en su propio renglón. No suma al
                margen de ningún producto y no tiene que sumar: un mes con
                muchas cuotas parecería un mes de mejores márgenes, y lo único
                que pasó es que se le cobró más caro al que pagó en cuotas. */}
            {data?.recargoCuotas?.cobros > 0 && (
              <Stat
                label="Recargo por cuotas" valor={money(data.recargoCuotas.total)}
                detalle={`${data.recargoCuotas.cobros} cobro(s) financiado(s) · ${data.recargoCuotas.sobreVentaPct}% de lo vendido. No es margen: es lo que se le cobró al cliente por pagar en cuotas, y es lo que se queda la tarjeta.`}
              />
            )}
            <Stat
              label="IVA débito (ventas facturadas)" valor={money(f.debitoVentas)}
              detalle={`${f.ventasFacturadas} factura(s) de venta en el período`}
            />
            {!sucursalId && (
              <Stat
                label="Crédito vs. débito" valor={money(f.posicion)}
                tono={f.posicion > 0 ? 'warn' : 'ok'}
                detalle={`Crédito: ${money(f.creditoCompras)} compras + ${money(f.creditoGastos)} gastos. ${f.posicion > 0 ? 'El crédito NO alcanza: esto queda por pagar.' : 'El crédito cubre el débito del período.'}`}
              />
            )}
          </div>

          {/* ---- La plata sigue a la mercadería: qué parte de las compras es del café (0101) ---- */}
          {!sucursalId && data.coffit && (data.coffit.compradoDirecto > 0 || data.coffit.enviadoDesdeStock > 0) && (
            <div>
              <div className={s['section-title']}>Compras del período: distribuidora y Coffit</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Stat
                  label="Comprado a proveedores" valor={money(data.coffit.comprasBrutas)}
                  detalle="Facturado + liquidado, neto. Es lo que dice el libro: el CUIT es uno solo."
                />
                <Stat
                  label="Directo para Coffit" valor={money(data.coffit.compradoDirecto)}
                  detalle="Artículos de uso exclusivo del café. Se le imputaron en la factura y esperan en el depósito hasta que los pide."
                />
                <Stat
                  label="Enviado a Coffit desde tu stock" valor={money(data.coffit.enviadoDesdeStock)}
                  detalle="Lo que también vendés (azúcar, harina) y le mandaste: se le imputa recién al salir, al costo del envío."
                />
                <Stat
                  label="Compras propias de la distribuidora" valor={money(data.coffit.comprasPropias)} tono="ok"
                  detalle="Lo que de verdad compraste para vos. Es el número que mirar contra la venta del período."
                />
              </div>
            </div>
          )}

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
          {!sucursalId && data.porProveedor.length > 0 && (
            <div>
              <div className={s['section-title']}>Compras sin factura por proveedor</div>
              <div className={s.hint} style={{ marginTop: 0 }}>
                Lo que cada proveedor facturó de verdad en el período contra el % declarado en su
                ficha. Si difieren en serio, el costo de sus productos está mal partido — y el precio también.
                Cuenta solo la factura A (la que da crédito fiscal), en neto; no entran los proveedores que
                facturan B o C.
              </div>
              <Table
                cols={[
                  { h: 'Proveedor' }, { h: 'Factura A (neto)', num: true }, { h: 'Liquidación', num: true },
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

/** Los locales lado a lado: cuánto vende cada uno y cuánto le queda. Un clic lo elige arriba. */
function PorSucursal({ filas, onElegir }) {
  return (
    <div>
      <div className={s['section-title']}>Por sucursal</div>
      <div className={s.hint} style={{ marginTop: 0 }}>
        El margen es de lo vendido (venta − costo congelado), antes de los gastos del local. «Días» son los que abrió (vendió en el mostrador). Tocá un local para ver su detalle.
      </div>
      <Table cols={[
        { h: 'Sucursal' }, { h: 'Venta neta', num: true }, { h: '% de la venta', num: true }, { h: 'Días', num: true },
        { h: 'Por día abierto', num: true }, { h: 'Costo real', num: true },
        { h: 'Margen real', num: true }, { h: '%', num: true }, { h: 'IVA absorbido', num: true },
      ]}>
        {filas.map((x) => (
          <tr key={x.sucursalId}>
            <td>
              {x.sucursalId ? <button type="button" className={s.linkBtn} onClick={() => onElegir(x.sucursalId)}>{x.nombre}</button> : x.nombre}
              {x.renglones > x.conCosto && (
                <span className={s.hint} style={{ margin: 0 }}> · {x.renglones - x.conCosto} renglón(es) sin costo fuera del margen</span>
              )}
            </td>
            <td className={s.num}>{money(x.ventaNeta)}</td>
            <td className={s.num}>{num(x.participacion, 1)}%</td>
            <td className={s.num} title={`${x.turnos} turno(s) de caja`}>{x.diasAbiertos || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{x.ventaPorDia != null ? money(x.ventaPorDia) : <span className={s.muted}>—</span>}</td>
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
    </div>
  );
}
