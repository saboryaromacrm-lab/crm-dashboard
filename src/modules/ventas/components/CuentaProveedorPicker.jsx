import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { agruparPorProveedor, etiquetaCuenta, fmt, seOfrece, validarTransferenciaProveedor } from '../domain/cuentasProveedor.js';
import { Btn, s } from './ui.jsx';
import p from '../styles/Pos.module.css';

/**
 * EL SELECTOR DE "TRANSF. A PROVEEDOR" — el mismo en el cobro y en el recibo.
 * ============================================================================
 * Proveedor → cuál de sus cuentas → y ahí, en grande, lo que el cajero le dicta
 * al cliente: el titular y el alias, con un botón para copiarlo y pegarlo en
 * WhatsApp. Debajo, lo que le falta a la cuenta y el mínimo del proveedor, y
 * el rechazo —si lo hay— ANTES de apretar.
 *
 * No pide nada por su cuenta: recibe la lista de cuentas abiertas del padre
 * (que la pide una vez por modal) y devuelve la cuenta elegida. `total` es el
 * de la venta o el recibo: las cuentas «solo para ventas desde $X» no se
 * ofrecen por debajo de X (0168).
 */
export function CuentaProveedorPicker({ cuentas, total, loading, error, cuentaId, importe, onSeleccionar, onRefrescar }) {
  const { toast } = useVentas();
  const ofrecidas = useMemo(() => (cuentas ?? []).filter((c) => seOfrece(c, total)), [cuentas, total]);
  const ocultas = (cuentas?.length ?? 0) - ofrecidas.length;
  const pisoOcultas = ocultas ? Math.min(...cuentas.filter((c) => !seOfrece(c, total)).map((c) => c.ventaMinima)) : 0;
  const grupos = useMemo(() => agruparPorProveedor(ofrecidas), [ofrecidas]);
  const elegida = useMemo(() => ofrecidas.find((c) => c.id === cuentaId) || null, [ofrecidas, cuentaId]);
  // El proveedor se elige primero; si ya hay cuenta, es el de esa cuenta.
  const [provElegido, setProvElegido] = useState('');
  const proveedorId = elegida ? elegida.proveedorId : Number(provElegido) || 0;
  const delProveedor = grupos.find((g) => g.proveedorId === proveedorId)?.cuentas ?? [];

  const elegirProveedor = (id) => {
    setProvElegido(id);
    const grupo = grupos.find((g) => g.proveedorId === Number(id));
    // Un proveedor con UNA sola cuenta abierta no necesita un segundo paso.
    if (grupo?.cuentas.length === 1) onSeleccionar(grupo.cuentas[0]);
    else if (elegida) onSeleccionar(null);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(elegida.cbuAlias);
      toast('Alias copiado: pegalo en el WhatsApp del cliente.', 'ok');
    } catch {
      toast('No se pudo copiar. Dictalo: ' + elegida.cbuAlias, 'err');
    }
  };

  if (loading) return <div className={s.hint}>Buscando cuentas de proveedores…</div>;
  if (error) {
    return (
      <div className={cx(s.callout, s.warn)}>
        No se pudieron traer las cuentas: {error}
        {onRefrescar && <Btn small onClick={onRefrescar} style={{ marginLeft: 8 }}>Reintentar</Btn>}
      </div>
    );
  }
  const notaOcultas = ocultas > 0 && (
    <div className={s.hint} style={{ margin: '4px 0 0' }}>
      {ocultas === 1 ? 'Una cuenta no se ofrece' : `${ocultas} cuentas no se ofrecen`} en esta venta: son para ventas desde {fmt(pisoOcultas)}.
    </div>
  );
  if (!grupos.length) {
    return (
      <div className={cx(s.callout, s.warn)}>
        No hay ninguna cuenta de proveedor abierta para recibir transferencias{ocultas ? ' en una venta de este total' : ''}.
        Se cargan en <strong>Proveedores › Cuentas disponibles</strong>.
        {notaOcultas}
      </div>
    );
  }

  const aviso = validarTransferenciaProveedor(importe, elegida, total);

  return (
    <div className={p.terc}>
      <div className={p.tercSelects}>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Proveedor</label>
          <select value={proveedorId || ''} onChange={(e) => elegirProveedor(e.target.value)}>
            <option value="">Elegí el proveedor…</option>
            {grupos.map((g) => (
              <option key={g.proveedorId} value={g.proveedorId}>
                {g.proveedorNombre} ({g.cuentas.length})
              </option>
            ))}
          </select>
        </div>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Cuenta</label>
          <select
            value={elegida?.id ?? ''}
            disabled={!proveedorId}
            onChange={(e) => onSeleccionar(delProveedor.find((c) => c.id === Number(e.target.value)) || null)}
          >
            <option value="">{proveedorId ? 'Elegí la cuenta…' : '—'}</option>
            {delProveedor.map((c) => (
              <option key={c.id} value={c.id}>{c.prioritaria ? '★ ' : ''}{etiquetaCuenta(c)}</option>
            ))}
          </select>
        </div>
      </div>
      {notaOcultas}

      {elegida && (
        <div className={p.tercCard}>
          <div className={p.tercTitular}>{elegida.titular}</div>
          <div className={p.tercAliasFila}>
            <code className={p.tercAlias}>{elegida.cbuAlias}</code>
            <Btn small variant="btn-primary" onClick={copiar}>Copiar</Btn>
          </div>
          <div className={p.tercDatos}>
            <span>Faltan <strong>{fmt(elegida.falta)}</strong> de {fmt(elegida.importe)}</span>
            {elegida.minimo > 0 && <span>Mínimo del proveedor: <strong>{fmt(elegida.minimo)}</strong></span>}
            {elegida.ventaMinima > 0 && <span>Solo ventas desde <strong>{fmt(elegida.ventaMinima)}</strong></span>}
            {elegida.puedePasarse && <span>Puede pasarse: <strong>toma el pago entero</strong> y se cierra</span>}
          </div>
          {aviso && <div className={cx(s.callout, s.warn)} style={{ marginTop: 8, marginBottom: 0 }}>{aviso}</div>}
        </div>
      )}
    </div>
  );
}
