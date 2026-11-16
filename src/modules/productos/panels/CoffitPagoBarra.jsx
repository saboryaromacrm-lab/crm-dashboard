/**
 * «LO PAGÓ COFFIT» — la barra que registra las facturas tildadas como pagadas
 * por Coffit con su plata (0228). La comparten Coffit › Proveedores (un
 * proveedor) y Coffit › Compras (16/11/2026, pedido del dueño: «que desde
 * compras también pueda tildar las cosas que pagó directamente Coffit»), donde
 * se pueden tildar facturas de varios proveedores: va un pago por proveedor.
 *
 * Cada factura se paga por lo que debe. Las ya registradas se destildan apenas
 * entran (`onHechas`), así un reintento —por ejemplo tras el aviso de pago
 * repetido— no vuelve a pagarlas.
 */
import { useState } from 'react';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { useProductos } from '../context/ProductosContext.jsx';
import { money } from '../domain/format.js';
import { Btn, s } from '../components/ui.jsx';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const hoy = () => new Date().toLocaleDateString('sv-SE');

/** `elegidas`: [{ id, documento, saldo, compartida, proveedorId, proveedorNombre }]. */
export function PagoDeCoffitBarra({ elegidas, onHechas, onPagado }) {
  const { store, toast } = useProductos();
  const [fecha, setFecha] = useState(hoy());
  const [referencia, setReferencia] = useState('');
  const importe = r2(elegidas.reduce((a, d) => a + d.saldo, 0));
  const compartidaElegida = elegidas.some((d) => d.compartida);
  const grupos = [...elegidas.reduce((m, d) => {
    const g = m.get(d.proveedorId) ?? { proveedorId: d.proveedorId, nombre: d.proveedorNombre, docs: [] };
    g.docs.push(d);
    return m.set(d.proveedorId, g);
  }, new Map()).values()];
  const conf = useSegundaConfirmacion(JSON.stringify([elegidas.map((d) => d.id), fecha, referencia]));

  const validar = () => {
    if (!elegidas.length) { toast('Tildá las facturas que pagó Coffit.', 'err'); return false; }
    if (!fecha) { toast('Poné la fecha en que pagó Coffit.', 'err'); return false; }
    return true;
  };

  const registrar = async (confirmarDuplicado) => {
    let pagado = 0;
    try {
      for (const g of grupos) {
        const imp = r2(g.docs.reduce((a, d) => a + d.saldo, 0));
        await store.pagoDeCoffit({
          proveedorId: g.proveedorId,
          importe: imp,
          fecha,
          concepto: `Lo pagó Coffit · ${g.docs.map((d) => d.documento).join(' · ')}`.slice(0, 300),
          referencia: referencia.trim() || undefined,
          imputaciones: g.docs.map((d) => ({ comprobanteId: d.id, importe: d.saldo })),
          ...(confirmarDuplicado ? { confirmarDuplicado: true } : {}),
        });
        pagado = r2(pagado + imp);
        onHechas?.(g.docs.map((d) => d.id));
      }
      toast(`Listo: ${money(pagado)} pagados por Coffit. Las facturas quedan pagadas y en su cuenta entra a su favor.`, 'ok');
      setReferencia('');
    } catch (e) {
      if (pagado > 0) toast(`Se registraron ${money(pagado)}; el resto no.`, 'err');
      if (e?.status === 409) conf.alConflicto(e.data ?? {});
      else toast(e?.data?.message || 'No se pudo registrar el pago de Coffit.', 'err');
    } finally {
      if (pagado > 0) onPagado?.();
    }
  };

  const aQuien = grupos.length === 1 ? <strong>{grupos[0].nombre}</strong> : <><strong>{grupos.length} proveedores</strong> (un pago para cada uno)</>;
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className={s.hint} style={{ margin: 0 }}>
          Pagó el <input type="date" max={hoy()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className={s.hint} style={{ margin: 0 }}>
          Referencia <input value={referencia} maxLength={200} onChange={(e) => setReferencia(e.target.value)} placeholder="N.º de transferencia (optativo)" />
        </label>
        <Btn variant="btn-primary" disabled={!elegidas.length} onClick={() => conf.clic(validar, registrar)}>
          {textoBoton(conf, elegidas.length ? `Lo pagó Coffit: ${money(importe)}…` : 'Lo pagó Coffit…', `Sí, lo pagó Coffit: ${money(importe)}`)}
        </Btn>
      </div>
      <AvisoSegundaConfirmacion confirmando={conf.confirmando} gemelo={conf.gemelo}>
        Se registra que <strong>Coffit le pagó {money(importe)}</strong> a {aQuien} por{' '}
        {elegidas.length} factura{elegidas.length === 1 ? '' : 's'}: quedan pagadas, no sale plata de la empresa y en la
        cuenta con Coffit entran <strong>{money(importe)} a su favor</strong>.
        {compartidaElegida && <> <strong>Ojo:</strong> hay una factura compartida; si Coffit la pagó entera, la parte de Sabor y Aroma le queda a favor a Coffit.</>}
      </AvisoSegundaConfirmacion>
    </>
  );
}
