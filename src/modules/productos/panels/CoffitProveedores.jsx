/**
 * COFFIT · SUS PROVEEDORES Y LO QUE LES PAGÓ ELLA (16/11/2026, pedido del dueño)
 * ============================================================================
 * «Una parte donde me liste los proveedores que Coffit tiene» —también los que
 * se comparten con Sabor y Aroma— y «registrar pagos de facturas cuando paga
 * Coffit, que no sume a la cuenta de Coffit con Sabor y Aroma».
 *
 * La lista sale sola de las facturas con parte de Coffit (API
 * `cafeteria/proveedores`): no hay una agenda aparte que mantener.
 *
 * «LO PAGÓ COFFIT» (0228) es un pago a proveedor común con un medio propio: las
 * facturas tildadas quedan pagadas en la cuenta del proveedor, no sale plata de
 * la caja ni de Mis cuentas, y en la cuenta con Coffit entra a SU FAVOR por lo
 * mismo, así la compra no se le cobra. Se paga cada factura por lo que debe;
 * un pago parcial o a cuenta se hace desde Proveedores › Cuentas corrientes,
 * con el medio «Lo pagó Coffit».
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, num, fmtFecha } from '../domain/format.js';
import { Table, Stat, Btn, Pill, s } from '../components/ui.jsx';

const EPS = 0.009;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const hoy = () => new Date().toLocaleDateString('sv-SE');

export function CoffitProveedores() {
  const { store, toast } = useProductos();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [q, setQ] = useState('');
  const [soloImpagos, setSoloImpagos] = useState(false);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null);
  const [vuelta, setVuelta] = useState(0);
  const version = store.getVersion?.() ?? 0;

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    store.proveedoresCoffit({ desde: desde || undefined, hasta: hasta || undefined })
      .then((d) => { if (vivo) setDatos(d); })
      .catch((e) => { if (vivo) toast(e?.data?.message || 'No se pudieron leer los proveedores de Coffit.', 'err'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [store, desde, hasta, version, vuelta, toast]);

  const lista = useMemo(() => {
    const ql = norm(q.trim());
    return (datos?.proveedores ?? [])
      .filter((p) => !ql || norm(p.nombre).includes(ql) || String(p.cuit || '').includes(q.trim()))
      .filter((p) => !soloImpagos || p.impago > EPS);
  }, [datos, q, soloImpagos]);

  const tot = useMemo(() => (datos?.proveedores ?? []).reduce((a, p) => ({
    parte: a.parte + p.parteCoffit, pagado: a.pagado + p.pagadoPorCoffit, compartidos: a.compartidos + (p.compartido ? 1 : 0),
  }), { parte: 0, pagado: 0, compartidos: 0 }), [datos]);

  const exportar = () => descargarCsv('coffit-proveedores.csv',
    ['Proveedor', 'CUIT', 'Teléfono', 'Correo', 'Compartido', 'Facturas', 'Compartidas', 'Parte de Coffit', 'Pagó Coffit', 'Impago', 'Última compra'],
    lista.map((p) => [p.nombre, p.cuit, p.telefono, p.email, p.compartido ? 'Sí' : 'No', p.facturas, p.compartidas,
      csvNum(p.parteCoffit), csvNum(p.pagadoPorCoffit), csvNum(p.impago), p.ultimaCompra ? fmtFecha(p.ultimaCompra) : '']));

  return (
    <>
      <div className={s.stats}>
        <Stat label="Proveedores" value={num(datos?.proveedores?.length ?? 0, 0)} />
        <Stat label="Compartidos con Sabor y Aroma" value={num(tot.compartidos, 0)} />
        <Stat label="Parte de Coffit (a su cuenta)" value={money(tot.parte)} accent="accent-amber" />
        <Stat label="Pagó Coffit directo" value={money(tot.pagado)} />
      </div>

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0 }}>
          Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className={s.hint} style={{ margin: 0 }}>
          Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        {(desde || hasta) && <Btn small onClick={() => { setDesde(''); setHasta(''); }}>Desde siempre</Btn>}
        <input
          className={s['select-inline']} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar proveedor o CUIT" style={{ minWidth: 200 }}
        />
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloImpagos} onChange={(e) => setSoloImpagos(e.target.checked)} /> Solo con facturas impagas
        </label>
        <Btn small onClick={exportar} disabled={!lista.length}>Exportar CSV</Btn>
      </div>

      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'Facturas', num: true }, { h: 'Parte de Coffit', num: true },
          { h: 'Pagó Coffit', num: true }, { h: 'Impago', num: true }, { h: 'Última compra' },
        ]}
        empty={cargando ? 'Cargando…' : 'Ningún proveedor con facturas de Coffit en el período.'}
      >
        {lista.map((p) => (
          <Fragment key={p.id}>
            <tr className={s.clickable} onClick={() => setAbierto((a) => (a === p.id ? null : p.id))}>
              <td>
                <span aria-hidden="true" style={{ display: 'inline-block', width: 14 }}>{abierto === p.id ? '▾' : '▸'}</span>
                <strong>{p.nombre}</strong>{' '}
                {p.compartido
                  ? <Pill pill="est-pendiente" label="Compartido" />
                  : <Pill pill="est-recibida" label="Solo Coffit" />}
                {(p.cuit || p.telefono) && (
                  <div className={s.hint} style={{ margin: '2px 0 0 14px' }}>
                    {[p.cuit && `CUIT ${p.cuit}`, p.telefono && `Tel. ${p.telefono}`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </td>
              <td className={cx(s.num, s.mono)}>
                {num(p.facturas, 0)}
                {p.compartidas > 0 && <div className={s.hint} style={{ margin: 0 }}>{p.compartidas} compartida{p.compartidas === 1 ? '' : 's'}</div>}
              </td>
              <td className={cx(s.num, s.mono)}>{money(p.parteCoffit)}</td>
              <td className={cx(s.num, s.mono)}>{p.pagadoPorCoffit > EPS ? money(p.pagadoPorCoffit) : '—'}</td>
              <td className={cx(s.num, s.mono)} style={{ fontWeight: p.impago > EPS ? 700 : 400 }}>{p.impago > EPS ? money(p.impago) : '—'}</td>
              <td>{p.ultimaCompra ? fmtFecha(p.ultimaCompra) : '—'}</td>
            </tr>
            {abierto === p.id && (
              <tr>
                <td colSpan={6} style={{ background: 'var(--crm-color-surface-2, rgba(0,0,0,.02))' }}>
                  <FacturasDelProveedor prov={p} onPagado={() => setVuelta((v) => v + 1)} />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </Table>

      <div className={s.hint}>
        Salen solos de las facturas de compra con parte de Coffit. <strong>Compartido</strong>: Sabor y Aroma también le
        compra (en esas facturas o en otras). <strong>Parte de Coffit</strong> es lo que esas facturas le suman a su cuenta;
        {' '}<strong>Impago</strong> es lo que todavía se le debe al proveedor por esas facturas (en una compartida, la
        factura entera). Abrí un proveedor para ver sus facturas y registrar las que <strong>pagó Coffit</strong> con su plata.
      </div>
    </>
  );
}

/** Las facturas de un proveedor con parte de Coffit, y el pago «Lo pagó Coffit». */
function FacturasDelProveedor({ prov, onPagado }) {
  const { store, toast } = useProductos();
  const [tildadas, setTildadas] = useState({});
  const [fecha, setFecha] = useState(hoy());
  const [referencia, setReferencia] = useState('');
  const impagas = prov.docs.filter((d) => d.saldo > EPS);
  const elegidas = impagas.filter((d) => tildadas[d.id]);
  const importe = r2(elegidas.reduce((a, d) => a + d.saldo, 0));
  const compartidaElegida = elegidas.some((d) => d.compartida);
  const conf = useSegundaConfirmacion(JSON.stringify([Object.keys(tildadas).filter((k) => tildadas[k]), fecha, referencia]));

  const validar = () => {
    if (!elegidas.length) { toast('Tildá las facturas que pagó Coffit.', 'err'); return false; }
    if (!fecha) { toast('Poné la fecha en que pagó Coffit.', 'err'); return false; }
    return true;
  };
  const registrar = (confirmarDuplicado) => store.pagoDeCoffit({
    proveedorId: prov.id,
    importe,
    fecha,
    concepto: `Lo pagó Coffit · ${elegidas.map((d) => d.documento).join(' · ')}`.slice(0, 300),
    referencia: referencia.trim() || undefined,
    imputaciones: elegidas.map((d) => ({ comprobanteId: d.id, importe: d.saldo })),
    ...(confirmarDuplicado ? { confirmarDuplicado: true } : {}),
  }).then(() => {
    toast(`Listo: ${money(importe)} pagados por Coffit. Las facturas quedan pagadas y en su cuenta entra a su favor.`, 'ok');
    setTildadas({});
    setReferencia('');
    onPagado();
  }).catch((e) => {
    if (e?.status === 409) { conf.alConflicto(e.data ?? {}); return; }
    toast(e?.data?.message || 'No se pudo registrar el pago de Coffit.', 'err');
  });

  return (
    <div style={{ display: 'grid', gap: 10, padding: '6px 0' }}>
      <Table
        cols={[
          { h: '' }, { h: 'Fecha' }, { h: 'Factura' }, { h: 'Total', num: true }, { h: 'Parte de Coffit', num: true },
          { h: 'Pagado', num: true }, { h: 'Debe', num: true },
        ]}
        empty="Sin facturas."
      >
        {prov.docs.map((d) => {
          const puede = d.saldo > EPS;
          return (
            <tr
              key={d.id}
              className={puede ? s.clickable : undefined}
              onClick={puede ? () => setTildadas((m) => ({ ...m, [d.id]: !m[d.id] })) : undefined}
            >
              <td>{puede && <input type="checkbox" readOnly checked={!!tildadas[d.id]} aria-label={`Tildar ${d.documento}`} />}</td>
              <td>{fmtFecha(d.fecha)}</td>
              <td>
                <span className={s.mono} style={{ fontSize: 12 }}>{d.documento}</span>
                {d.compartida && <> <Pill pill="est-pendiente" label="Compartida" /></>}
              </td>
              <td className={cx(s.num, s.mono)}>{money(d.total)}</td>
              <td className={cx(s.num, s.mono)}>{money(d.parteCoffit)}</td>
              <td className={cx(s.num, s.mono)}>
                {money(d.pagado)}
                {d.pagadoCoffit > EPS && <div className={s.hint} style={{ margin: 0 }}>{money(d.pagadoCoffit)} lo pagó Coffit</div>}
              </td>
              <td className={cx(s.num, s.mono)} style={{ fontWeight: puede ? 700 : 400 }}>{puede ? money(d.saldo) : 'Pagada'}</td>
            </tr>
          );
        })}
      </Table>

      {impagas.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className={s.hint} style={{ margin: 0 }}>
              Pagó el <input type="date" max={hoy()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className={s.hint} style={{ margin: 0 }}>
              Referencia <input value={referencia} maxLength={200} onChange={(e) => setReferencia(e.target.value)} placeholder="N.º de transferencia (optativo)" />
            </label>
            <Btn
              variant="btn-primary"
              disabled={!elegidas.length}
              onClick={() => conf.clic(validar, registrar)}
            >
              {textoBoton(conf, elegidas.length ? `Lo pagó Coffit: ${money(importe)}…` : 'Lo pagó Coffit…', `Sí, lo pagó Coffit: ${money(importe)}`)}
            </Btn>
          </div>
          <AvisoSegundaConfirmacion confirmando={conf.confirmando} gemelo={conf.gemelo}>
            Se registra que <strong>Coffit le pagó {money(importe)}</strong> a <strong>{prov.nombre}</strong> por{' '}
            {elegidas.length} factura{elegidas.length === 1 ? '' : 's'}: quedan pagadas, no sale plata de la empresa y en la
            cuenta con Coffit entran <strong>{money(importe)} a su favor</strong>.
            {compartidaElegida && <> <strong>Ojo:</strong> hay una factura compartida; si Coffit la pagó entera, la parte de Sabor y Aroma le queda a favor a Coffit.</>}
          </AvisoSegundaConfirmacion>
          <div className={s.hint} style={{ margin: 0 }}>
            Tildá las facturas que pagó Coffit con su plata: se pagan por lo que deben. Si pagó solo una parte o a cuenta,
            hacelo desde Proveedores › Cuentas corrientes con el medio «Lo pagó Coffit».
          </div>
        </>
      )}
    </div>
  );
}
