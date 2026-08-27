import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi } from '../../services/ventas.api.js';
import { MEDIOS_PAGO } from '../../domain/constants.js';
import { r2 } from '../../domain/pos.js';
import { Table, Di, Btn, ModalShell, money, fmtFechaHora, s } from '../ui.jsx';

/* ==================================================================== *
 * Apertura
 * ==================================================================== */

export function AbrirCajaModal({ onChange }) {
  const { ctx, sucursales, usuarios, act, closeModal, toast } = useVentas();
  const [montoInicial, setMontoInicial] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const sucursal = sucursales.find((x) => x.id === ctx.sucursalId);
  const usuario = usuarios.find((u) => u.id === ctx.usuarioId);

  const abrir = async () => {
    // El fondo es obligatorio: sin punto de partida no hay arqueo posible.
    if (!(Number(montoInicial) > 0)) {
      toast('Declará el fondo inicial: la caja siempre arranca con un monto.', 'err');
      return;
    }
    const ok = await act(
      ventasApi.abrirCaja({
        sucursalId: ctx.sucursalId,
        usuarioId: ctx.usuarioId ?? undefined,
        montoInicial: r2(montoInicial),
        observaciones,
      }),
      'Caja abierta.',
      { recargar: false },
    );
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title="Abrir caja"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Abrir turno', clase: 'btn-primary', onClick: abrir },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Sucursal">{sucursal?.nombre || '—'}</Di>
        <Di label="Cajero">{usuario?.nombre || '—'}</Di>
      </div>

      <div className={s.field}>
        <label>Fondo inicial <span className={s.req}>*</span></label>
        <input
          type="number" min="0" step="100" autoFocus
          placeholder="Ej: 50000"
          value={montoInicial}
          onChange={(e) => setMontoInicial(e.target.value)}
        />
        <div className={s.hint} style={{ margin: '6px 0 0' }}>
          El efectivo con el que arranca el cajón. Es el punto de partida del arqueo
          y es obligatorio: sin fondo declarado no se abre el turno.
        </div>
      </div>

      <div className={s.field}>
        <label>Observaciones</label>
        <input value={observaciones} placeholder="Opcional" onChange={(e) => setObservaciones(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Movimiento de caja
 * ==================================================================== */

/**
 * UN solo modal para todo el dinero que entra o sale del cajón fuera de las
 * ventas. Al elegir EGRESO se abre la pregunta que importa: ¿a quién sale?
 *
 *   · Movimiento común — retiro, refuerzo de cambio, gasto menor sin papeles.
 *   · Pago a proveedor — la plata queda A CUENTA de un proveedor del padrón,
 *     esperando la factura. Es el caso "llegó el pedido y le pagué al
 *     repartidor": la cajera no carga factura, solo registra el pago.
 */
export function MovimientoCajaModal({ cajaSesionId, onChange }) {
  const { ctx, act, closeModal, toast, operadorId } = useVentas();
  const [tipo, setTipo] = useState('egreso');
  const [destino, setDestino] = useState('comun');
  const [importe, setImporte] = useState('');
  const [motivo, setMotivo] = useState('');

  // Campos del pago a proveedor.
  const [tipoProveedor, setTipoProveedor] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [referencia, setReferencia] = useState('');
  const [esFlete, setEsFlete] = useState(false);

  const esPagoProveedor = tipo === 'egreso' && destino === 'proveedor';

  /**
   * Primero el TIPO, después el proveedor: la lista se pide filtrada
   * (mercadería o gastos) y el que provee las dos cosas aparece en ambas. La
   * elección queda GRABADA en el pago como su `destino` — decide en qué
   * bandeja cae (Compras o Gastos) y contra qué documentos podrá aplicarse.
   */
  const { data, loading, error } = useResource(
    `padron-proveedores:${tipoProveedor}`,
    () => ventasApi.proveedoresPadron(tipoProveedor),
    { enabled: esPagoProveedor && !!tipoProveedor },
  );
  const proveedores = data ?? [];

  const elegirTipo = (valor) => {
    setTipoProveedor(valor);
    // El proveedor elegido puede no existir en la lista nueva: se limpia.
    setProveedorId('');
    // El flete que el proveedor descuenta solo existe del lado de mercadería:
    // el que se le paga a un fletero propio es un gasto y va por su módulo.
    if (valor !== 'mercaderia') setEsFlete(false);
  };

  const elegido = proveedores.find((pv) => pv.id === Number(proveedorId));

  const registrar = async () => {
    if (!(Number(importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }

    if (esPagoProveedor) {
      if (!tipoProveedor) { toast('Elegí el tipo de proveedor: mercadería o gastos.', 'err'); return; }
      if (!proveedorId) { toast('Elegí a qué proveedor se le pagó.', 'err'); return; }
      const ok = await act(
        ventasApi.crearPagoProveedor({
          proveedorId: Number(proveedorId),
          destino: tipoProveedor,
          importe: r2(importe),
          medio: 'efectivo',
          cajaSesionId,
          usuarioId: ctx.usuarioId ?? undefined,
          // El relevo (0088): el pago lo firma quien está en la caja.
          operadorId: operadorId ?? undefined,
          concepto: motivo.trim(),
          referencia: referencia.trim(),
          esFlete: esFlete || undefined,
        }),
        esFlete
          ? 'Flete registrado. Se le descuenta de su factura cuando se cargue.'
          : tipoProveedor === 'mercaderia'
            ? 'Pago registrado. Queda a cuenta en Compras › Pagos en sucursal hasta que se cargue la factura.'
            : 'Pago registrado. Queda a cuenta en Gastos › Pagos en sucursal hasta que se cargue el comprobante.',
        { recargar: false },
      );
      if (ok) onChange?.();
      return;
    }

    if (!motivo.trim()) { toast('Indicá el motivo.', 'err'); return; }
    const ok = await act(
      ventasApi.movimientoCaja(cajaSesionId, {
        tipo, importe: r2(importe), motivo,
        usuarioId: ctx.usuarioId ?? undefined,
        // El relevo (0088): el movimiento manual lo firma quien está en la caja.
        operadorId: operadorId ?? undefined,
      }),
      'Movimiento registrado.',
      { recargar: false },
    );
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title="Movimiento de caja"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: esPagoProveedor ? 'Registrar pago' : 'Registrar', clase: 'btn-primary', onClick: registrar },
      ]}
    >
      <div className={s.hint}>
        Entradas y salidas de dinero que no son ventas ni cobranzas. Impactan directo en el
        arqueo del turno.
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="egreso">Egreso (sale dinero)</option>
            <option value="ingreso">Ingreso (entra dinero)</option>
          </select>
        </div>
        {tipo === 'egreso' && (
          <div className={s.field}>
            <label>¿A quién sale?</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="comun">Movimiento común (retiro, gasto menor)</option>
              <option value="proveedor">Pago a un proveedor</option>
            </select>
          </div>
        )}
      </div>

      {esPagoProveedor && (
        <>
          {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar el padrón: <strong>{error}</strong></div>}

          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Tipo de proveedor <span className={s.req}>*</span></label>
              <select value={tipoProveedor} onChange={(e) => elegirTipo(e.target.value)}>
                <option value="">Elegí el tipo</option>
                <option value="mercaderia">Mercadería (trae stock: Coca-Cola, Molino Sur…)</option>
                <option value="gastos">Gastos (servicios: plomero, fletero, contador…)</option>
              </select>
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                Define en qué bandeja cae el pago: Compras o Gastos. Un proveedor que es las dos
                cosas aparece en las dos listas.
              </div>
            </div>
          </div>

          <div className={s.field}>
            <label>Proveedor <span className={s.req}>*</span></label>
            {/* Un solo campo: el desplegable ya se abre tipeando la primera
                letra, y la lista viene filtrada por tipo — un buscador aparte
                era otro control que hacía exactamente lo mismo. */}
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} disabled={!tipoProveedor || loading}>
              <option value="">
                {!tipoProveedor ? 'Primero elegí el tipo' : loading ? 'Cargando…' : 'Elegí el proveedor'}
              </option>
              {proveedores.map((pv) => (
                <option key={pv.id} value={pv.id}>{pv.nombre}{pv.cuit ? ` · ${pv.cuit}` : ''}</option>
              ))}
            </select>
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Tiene que estar en el padrón. Si no está, registralo como movimiento común: ese
              egreso no se puede aplicar después a una factura.
            </div>
          </div>

          {/* EL FLETE QUE EL PROVEEDOR DESCUENTA. Llega la mercadería por
              $100.000, el flete sale $20.000 y se le paga al fletero del cajón:
              esa plata NO es un gasto nuestro, es de la cuenta del proveedor,
              que la reconoce restándola de su factura. Tildarlo es lo que hace
              que después se pueda tomar en la factura sin que el candado del
              modo "por facturas" lo rechace por ser un pago parcial. */}
          {tipoProveedor === 'mercaderia' && (
            <div className={s.field}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                <input type="checkbox" checked={esFlete} onChange={(e) => setEsFlete(e.target.checked)} />
                Es el flete de esta entrega
              </label>
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                Tildalo si el flete lo paga el proveedor y te lo descuenta de la factura: se le
                resta de lo que se le debe. Si el flete es nuestro y nadie lo reintegra, dejalo
                sin tildar — eso es un gasto y va por Gastos.
              </div>
            </div>
          )}
        </>
      )}

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Importe <span className={s.req}>*</span></label>
          <input type="number" min="0" step="any" autoFocus value={importe} onChange={(e) => setImporte(e.target.value)} />
        </div>
        {esPagoProveedor && (
          <div className={s.field}>
            <label>Remito / referencia</label>
            <input
              value={referencia}
              placeholder="Nº de remito, quién lo recibió…"
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className={s.field}>
        <label>{esPagoProveedor ? 'Concepto' : 'Motivo'} {!esPagoProveedor && <span className={s.req}>*</span>}</label>
        <input
          value={motivo}
          placeholder={esFlete
            ? 'Ej: flete del pedido del martes · transportista'
            : esPagoProveedor ? 'Ej: pedido de gaseosas · arreglo del baño' : 'Ej: refuerzo de cambio'}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>

      {esPagoProveedor && (
        <div className={s.callout}>
          Se registra el <strong>egreso de caja</strong> con la hora exacta y tu nombre, y queda
          {esFlete ? ' como flete a cuenta de ' : ' como pago a cuenta de '}
          {elegido ? <strong>{elegido.nombre}</strong> : 'ese proveedor'}
          {tipoProveedor === 'mercaderia' && <> en <strong>Compras › Pagos en sucursal</strong></>}
          {tipoProveedor === 'gastos' && <> en <strong>Gastos › Pagos en sucursal</strong></>}.
          {esFlete
            ? ' Al cargar la factura de esa entrega se toma este flete y el proveedor queda debiendo el resto.'
            : ` El administrador lo aplica cuando carga ${tipoProveedor === 'gastos' ? 'el comprobante del gasto' : 'la factura'}.`}
        </div>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Contador de billetes
 * ==================================================================== */

/** Denominaciones vigentes de mayor a menor, como se apila el cajón. */
const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05];

/**
 * Contar el cajón sin calculadora: cantidad de cada billete/moneda y el total
 * sale solo. No es un dato que se guarde — es una ayuda para llenar "Efectivo
 * contado" sin errores de suma. El conteo queda en el modal padre mientras
 * esté abierto, así se puede volver a entrar a corregir una cantidad.
 */
function ContadorBilletesModal({ inicial, onUsar, onCerrar }) {
  const [cant, setCant] = useState(() => ({ ...(inicial || {}) }));
  const refs = useRef({});

  // La cuenta va en centavos: 3 monedas de $0,05 son 15 centavos justos,
  // no 0.15000000000000002.
  const totalCentavos = useMemo(() => DENOMINACIONES.reduce((acc, d) => {
    const n = Math.floor(Number(cant[d])) || 0;
    return acc + (n > 0 ? Math.round(d * 100) * n : 0);
  }, 0), [cant]);
  const total = totalCentavos / 100;

  const etiqueta = (d) => `$ ${d.toLocaleString('es-AR', { minimumFractionDigits: d < 1 ? 2 : 0 })}`;

  const fila = (d, i) => {
    const n = Math.floor(Number(cant[d])) || 0;
    return (
      <div key={d} style={{ display: 'grid', gridTemplateColumns: '82px 84px 1fr', gap: 8, alignItems: 'center' }}>
        <span className={s.mono} style={{ textAlign: 'right', fontWeight: 600 }}>{etiqueta(d)}</span>
        <input
          ref={(el) => { refs.current[d] = el; }}
          type="number" min="0" step="1" placeholder="0"
          autoFocus={i === 0}
          value={cant[d] ?? ''}
          onChange={(e) => setCant((c) => ({ ...c, [d]: e.target.value }))}
          onKeyDown={(e) => {
            // Enter baja al renglón siguiente: se cuenta de corrido, sin mouse.
            if (e.key === 'Enter') {
              const idx = DENOMINACIONES.indexOf(d);
              refs.current[DENOMINACIONES[idx + 1]]?.focus();
            }
          }}
        />
        <span className={cx(s.mono, !n && s.muted)} style={{ textAlign: 'right' }}>
          {n ? money((Math.round(d * 100) * n) / 100) : '—'}
        </span>
      </div>
    );
  };

  return (
    <ModalShell
      title="Contar el efectivo"
      subtitle="Cantidad de cada billete y moneda: el total se calcula solo. Enter salta al siguiente."
      wide
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: `Usar este total (${money(total)})`, clase: 'btn-primary', onClick: () => onUsar(cant, total) },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DENOMINACIONES.slice(0, 9).map((d, i) => fila(d, i))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DENOMINACIONES.slice(9).map((d) => fila(d, -1))}
        </div>
      </div>

      <div
        className={s.callout}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 0 0' }}
      >
        <span>Total contado</span>
        <strong className={s.mono} style={{ fontSize: 22 }}>{money(total)}</strong>
      </div>
    </ModalShell>
  );
}

/**
 * Botón + estado del contador para los dos modales que piden "Efectivo
 * contado" (control intermedio y cierre). Devuelve el botón a poner debajo
 * del campo y el modal ya cableado.
 */
function useContadorBilletes(setMonto) {
  const [abierto, setAbierto] = useState(false);
  const [conteo, setConteo] = useState(null);

  const boton = (
    <div style={{ marginTop: 6 }}>
      <Btn small onClick={() => setAbierto(true)}>🧮 Contar billetes</Btn>
    </div>
  );

  const modal = abierto && (
    <ContadorBilletesModal
      inicial={conteo}
      onCerrar={() => setAbierto(false)}
      onUsar={(cant, total) => {
        setConteo(cant);
        setMonto(String(total));
        setAbierto(false);
      }}
    />
  );

  return { boton, modal };
}

/* ==================================================================== *
 * Control de caja intermedio (no cierra nada)
 * ==================================================================== */

/**
 * Conteo de efectivo EN MEDIO del turno: compara lo contado contra lo que el
 * sistema espera y deja el registro (fecha/hora, montos, diferencia, quién).
 * No mueve dinero ni cambia el estado — es puro control entre arqueos.
 */
export function ControlCajaModal({ cajaSesionId, onChange }) {
  const { ctx, act, closeModal, toast, operadorId } = useVentas();
  const [contado, setContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const contador = useContadorBilletes(setContado);

  const { data: arqueo, loading, error } = useResource(
    `control-arqueo:${cajaSesionId}`,
    () => ventasApi.cajaArqueo(cajaSesionId),
  );

  const diferencia = useMemo(() => {
    if (!arqueo || contado === '') return null;
    return r2(Number(contado) - arqueo.esperadoEfectivo);
  }, [arqueo, contado]);

  const registrar = async () => {
    if (contado === '' || Number(contado) < 0) { toast('Contá el efectivo e ingresá el monto.', 'err'); return; }
    if (diferencia !== null && Math.abs(diferencia) > 0.009 && !observaciones.trim()) {
      toast('Hay diferencia: dejá una observación de por qué.', 'err');
      return;
    }
    const ok = await act(
      ventasApi.controlCaja(cajaSesionId, {
        contadoEfectivo: r2(contado),
        observaciones,
        usuarioId: ctx.usuarioId ?? undefined,
        // El relevo (0088): el conteo lo firma quien está parado en la caja.
        operadorId: operadorId ?? undefined,
      }),
      'Control de caja registrado.',
      { recargar: false },
    );
    if (ok) onChange?.();
  };

  if (loading || error || !arqueo) {
    return (
      <ModalShell title="Control de caja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        {loading
          ? <div className={s['empty-state']}>Calculando el efectivo esperado…</div>
          : <div className={cx(s.callout, s.warn)}>{error || 'No se pudo calcular el arqueo.'}</div>}
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Control de caja"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar control', clase: 'btn-primary', onClick: registrar },
      ]}
    >
      <div className={s.hint}>
        Conteo <strong>sin cerrar el turno</strong>: queda registrado con fecha, hora,
        montos y diferencia. El turno sigue abierto y se puede seguir vendiendo.
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Efectivo esperado (sistema)</label>
          <input value={money(arqueo.esperadoEfectivo)} readOnly tabIndex={-1} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Fondo inicial + efectivo cobrado + ingresos − egresos, al momento.
          </div>
        </div>
        <div className={s.field}>
          <label>Efectivo contado <span className={s.req}>*</span></label>
          <input
            type="number" min="0" step="100" autoFocus
            placeholder="Lo que hay en el cajón"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
          />
          {contador.boton}
        </div>
      </div>
      {contador.modal}

      {diferencia !== null && (
        <div
          className={cx(s.callout, Math.abs(diferencia) > 0.009 && s.warn)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <span>{Math.abs(diferencia) < 0.01 ? 'Sin diferencia' : 'Diferencia'}</span>
          <strong style={{
            fontSize: 22,
            color: Math.abs(diferencia) < 0.01 ? 'var(--crm-color-success)' : 'var(--crm-color-danger)',
          }}
          >
            {diferencia > 0 ? '+' : ''}{money(diferencia)}
          </strong>
        </div>
      )}

      <div className={s.field}>
        <label>Observaciones {diferencia !== null && Math.abs(diferencia) > 0.009 && <span className={s.req}>*</span>}</label>
        <input
          value={observaciones}
          placeholder={diferencia !== null && Math.abs(diferencia) > 0.009 ? 'Explicá la diferencia' : 'Opcional'}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Cierre / arqueo
 * ==================================================================== */

/** Historial de controles intermedios del turno (fecha/hora, montos, diferencia). */
function ControlesDelTurno({ controles }) {
  const { usuarios } = useVentas();
  if (!controles?.length) return null;
  return (
    <>
      <div className={s['section-title']}>Controles de caja del turno</div>
      <Table cols={[
        { h: 'Fecha y hora' }, { h: 'Esperado', num: true }, { h: 'Contado', num: true },
        { h: 'Diferencia', num: true }, { h: 'Quién' },
      ]}
      >
        {controles.map((c) => {
          const ok = Math.abs(c.diferencia) < 0.01;
          return (
            <tr key={c.id}>
              <td>
                {fmtFechaHora(c.fecha)}
                {c.observaciones && <div className={s.hint} style={{ margin: 0 }}>{c.observaciones}</div>}
              </td>
              <td className={s.num}>{money(c.esperadoEfectivo)}</td>
              <td className={s.num}>{money(c.contadoEfectivo)}</td>
              <td className={s.num}>
                <strong style={{ color: ok ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>
                  {c.diferencia > 0 ? '+' : ''}{money(c.diferencia)}
                </strong>
              </td>
              <td>{usuarios.find((u) => u.id === c.usuarioId)?.nombre || '—'}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}

/**
 * Movimientos del turno, plegados por defecto. Un turno con muchos egresos
 * empujaba el conteo de efectivo —lo que se viene a hacer acá— abajo de todo;
 * plegado, el detalle sigue a un clic y la pantalla arranca en lo importante.
 *
 * Orden inverso: el último movimiento arriba. Al abrirlo casi siempre se busca
 * lo que se acaba de cargar, no lo de hace seis horas.
 */
function MovimientosDelTurno({ movimientos }) {
  const { usuarios } = useVentas();
  const [abierto, setAbierto] = useState(false);
  if (!movimientos?.length) return null;

  // Copia antes de invertir: `arqueo.movimientos` es del estado del padre.
  const filas = [...movimientos].reverse();

  return (
    <>
      <button
        type="button"
        className={s.desplegable}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className={s.desplegableFlecha}>{abierto ? '▾' : '▸'}</span>
        Movimientos de caja
        <span className={s.desplegableConteo}>{movimientos.length}</span>
      </button>

      {abierto && (
        <Table cols={[
          { h: 'Fecha y hora' }, { h: 'Tipo' }, { h: 'Motivo' }, { h: 'Quién' }, { h: 'Importe', num: true },
        ]}
        >
          {filas.map((m) => (
            <tr key={m.id}>
              <td>{fmtFechaHora(m.fecha)}</td>
              <td>{m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</td>
              <td>{m.motivo}</td>
              <td>{usuarios.find((u) => u.id === m.usuarioId)?.nombre || <span className={s.muted}>—</span>}</td>
              <td className={s.num} style={{ color: m.tipo === 'egreso' ? 'var(--crm-color-danger)' : undefined }}>
                {m.tipo === 'egreso' ? '−' : '+'}{money(m.importe)}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

/** Renglón de la cuenta del cajón: etiqueta a la izquierda, importe a la derecha. */
function Renglon({ label, valor, tenue }) {
  return (
    <div className={cx(s.pasoFila, tenue && s.pasoTenue)}>
      <span>{label}</span>
      <span className={s.mono}>{valor}</span>
    </div>
  );
}

/** Detalle del arqueo. Se comparte entre el cierre y el historial de turnos. */
export function DetalleArqueo({ arqueo }) {
  const medios = Object.entries(arqueo.medios || {});
  const efectivo = arqueo.medios?.efectivo?.total ?? 0;
  const cerrado = arqueo.sesion?.estado === 'cerrada';
  const dif = arqueo.sesion?.diferencia ?? 0;
  const difOk = Math.abs(dif) < 0.01;

  return (
    <>
      {/*
        LA CUENTA DEL CAJÓN como una cuenta: renglones en columna, con los
        signos adelante y el resultado abajo separado por una línea. Antes eran
        cinco tarjetas sueltas del mismo tamaño donde el número que el cajero
        viene a buscar pesaba igual que "Cierre —". Es el mismo idioma visual
        que la cadena de costos del Formato de Compra.
      */}
      <div className={cx(s.cadena, s.cuentaBloque)}>
        <Renglon label="Fondo inicial" valor={money(arqueo.montoInicial)} />
        <Renglon label="+ Cobrado en efectivo" valor={money(efectivo)} />
        <Renglon label="+ Otros ingresos" valor={money(arqueo.ingresos)} tenue={!arqueo.ingresos} />
        <Renglon label="− Egresos" valor={money(arqueo.egresos)} tenue={!arqueo.egresos} />

        <div className={s.pasoResultado}>
          <span>Efectivo esperado</span>
          <strong
            className={s.mono}
            style={{ color: arqueo.esperadoEfectivo < 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-accent)' }}
          >
            {money(arqueo.esperadoEfectivo)}
          </strong>
        </div>

        {/* Solo con el turno cerrado hay conteo contra el cual comparar. */}
        {cerrado && (
          <>
            <Renglon label="Efectivo contado" valor={money(arqueo.sesion.declaradoEfectivo)} />
            <div className={cx(s.pasoFila, s.pasoFuerte)}>
              <span>Diferencia</span>
              <strong
                className={s.mono}
                style={{ color: difOk ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}
              >
                {dif > 0 ? '+' : ''}{money(dif)}
              </strong>
            </div>
          </>
        )}
      </div>

      <div className={s.hint} style={{ marginTop: 0 }}>
        <strong>Otros ingresos</strong> y <strong>egresos</strong> son solo los movimientos
        manuales del turno (retiros, refuerzos de cambio, pagos a proveedores): lo que se cobró
        vendiendo ya está contado en <strong>Cobrado en efectivo</strong>. Los demás medios de pago
        y las ventas en cuenta corriente no entran al cajón
        {arqueo.ctaCte.cantidad
          ? ` — en este turno hubo ${arqueo.ctaCte.cantidad} venta(s) en cuenta corriente por ${money(arqueo.ctaCte.total)}.`
          : '.'}
      </div>

      <div className={s['section-title']}>
        Por medio de pago
        <span className={s.hint} style={{ margin: '0 0 0 8px', fontWeight: 400 }}>
          total cobrado {money(arqueo.totalCobrado)}
        </span>
      </div>
      <Table
        cols={[{ h: 'Medio' }, { h: 'Ventas', num: true }, { h: 'Cobranzas', num: true }, { h: 'Total', num: true }]}
        empty="No entró dinero en este turno."
      >
        {medios.map(([medio, m]) => (
          <tr key={medio}>
            <td>{MEDIOS_PAGO[medio] || medio}</td>
            <td className={s.num}>{money(m.ventas)}</td>
            <td className={s.num}>{money(m.cobranzas)}</td>
            <td className={s.num}><strong>{money(m.total)}</strong></td>
          </tr>
        ))}
      </Table>

      <MovimientosDelTurno movimientos={arqueo.movimientos} />

      <ControlesDelTurno controles={arqueo.controles} />
    </>
  );
}

export function CerrarCajaModal({ cajaSesionId, onChange }) {
  const { act, closeModal, toast, setOperador } = useVentas();
  const [declarado, setDeclarado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const contador = useContadorBilletes(setDeclarado);

  const { data: arqueo, loading, error } = useResource(`arqueo:${cajaSesionId}`, () => ventasApi.cajaArqueo(cajaSesionId));

  // Solo se cuenta el EFECTIVO: los demás medios se concilian contra el banco.
  const diferencia = useMemo(() => {
    if (!arqueo || declarado === '') return null;
    return r2(Number(declarado) - arqueo.esperadoEfectivo);
  }, [arqueo, declarado]);

  const cerrar = async () => {
    /* El campo vacío NO es "cero contado": era un `r2('')` = 0 que cerraba el
     * turno con una diferencia inventada del tamaño de todo el efectivo del día,
     * firmada y sin poder reabrirse. El control intermedio ya exigía el conteo;
     * el cierre, que es el que queda, no lo pedía. */
    if (declarado === '') { toast('Contá el efectivo del cajón e ingresá el monto.', 'err'); return; }
    const ok = await act(
      ventasApi.cerrarCaja(cajaSesionId, { declaradoEfectivo: r2(declarado), observaciones }),
      'Turno cerrado.',
      { recargar: false },
    );
    if (ok) {
      /* El relevo muere con el turno (0088): el próximo arranca con el titular
       * de la sesión — un relevo que sobrevive al cierre es un olvido servido. */
      setOperador(null);
      onChange?.();
    }
  };

  if (loading) {
    return (
      <ModalShell title="Cerrar caja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={s['empty-state']}>Calculando el arqueo…</div>
      </ModalShell>
    );
  }
  if (error || !arqueo) {
    return (
      <ModalShell title="Cerrar caja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={cx(s.callout, s.warn)}>{error || 'No se pudo calcular el arqueo.'}</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Cerrar caja — arqueo"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Cerrar turno', clase: 'btn-delete', onClick: cerrar },
      ]}
    >
      <DetalleArqueo arqueo={arqueo} />

      <div className={s['section-title']}>Conteo de efectivo</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Efectivo esperado (sistema)</label>
          <input value={money(arqueo.esperadoEfectivo)} readOnly tabIndex={-1} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Fondo inicial + efectivo cobrado + ingresos − egresos.
          </div>
        </div>
        <div className={s.field}>
          <label>Efectivo contado <span className={s.req}>*</span></label>
          <input
            type="number" min="0" step="100" autoFocus
            placeholder="0,00"
            value={declarado}
            onChange={(e) => setDeclarado(e.target.value)}
          />
          {contador.boton}
        </div>
      </div>
      {contador.modal}

      {diferencia !== null && (
        <div
          className={cx(s.callout, Math.abs(diferencia) > 0.009 && s.warn)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <span>Diferencia</span>
          <strong style={{
            fontSize: 22,
            color: Math.abs(diferencia) < 0.01
              ? 'var(--crm-color-success)'
              : 'var(--crm-color-danger)',
          }}
          >
            {diferencia > 0 ? '+' : ''}{money(diferencia)}
          </strong>
        </div>
      )}

      <div className={s.field}>
        <label>Observaciones</label>
        <input
          value={observaciones}
          placeholder={diferencia && Math.abs(diferencia) > 0.009 ? 'Explicá la diferencia' : 'Opcional'}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      <div className={s.hint}>
        El turno queda cerrado con su arqueo y no se puede reabrir. La diferencia se guarda
        tal cual, incluso negativa: es el control.
      </div>
    </ModalShell>
  );
}

/** Arqueo de un turno ya cerrado (solo lectura, desde el historial). */
export function ArqueoTurnoModal({ cajaSesionId }) {
  const { closeModal, sucursales, usuarios } = useVentas();
  const { data: arqueo, loading, error } = useResource(`arqueo-ver:${cajaSesionId}`, () => ventasApi.cajaArqueo(cajaSesionId));

  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (loading) {
    return <ModalShell title="Arqueo del turno" onClose={closeModal} footer={footer}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }
  if (error || !arqueo) {
    return <ModalShell title="Arqueo del turno" onClose={closeModal} footer={footer}>
      <div className={cx(s.callout, s.warn)}>{error || 'No se encontró el turno.'}</div>
    </ModalShell>;
  }

  const { sesion } = arqueo;
  const cerrado = sesion.estado === 'cerrada';

  return (
    <ModalShell title={`Turno #${sesion.id}`} wide onClose={closeModal} footer={footer}>
      {/* Identidad del turno: contexto, no números. Va como tira compacta —
          en tarjetas grandes competía con la cuenta del cajón, que es lo que
          se viene a leer. El efectivo esperado, contado y la diferencia salen
          todos de la cuenta que arma `DetalleArqueo`: acá no se repiten. */}
      <div className={s.fichaMeta}>
        <div>
          <span className={s.l}>Sucursal</span>
          <span className={s.v}>{sucursales.find((x) => x.id === sesion.sucursalId)?.nombre || '—'}</span>
        </div>
        <div>
          <span className={s.l}>Cajero</span>
          <span className={s.v}>{usuarios.find((u) => u.id === sesion.usuarioId)?.nombre || '—'}</span>
        </div>
        <div>
          <span className={s.l}>Estado</span>
          <span className={s.v}>{cerrado ? 'Cerrado' : 'Abierto'}</span>
        </div>
        <div>
          <span className={s.l}>Apertura</span>
          <span className={s.v}>{fmtFechaHora(sesion.apertura)}</span>
        </div>
        <div>
          <span className={s.l}>Cierre</span>
          <span className={s.v}>{sesion.cierre ? fmtFechaHora(sesion.cierre) : '—'}</span>
        </div>
      </div>

      <DetalleArqueo arqueo={arqueo} />

      {sesion.observaciones && <div className={s.callout}>{sesion.observaciones}</div>}
    </ModalShell>
  );
}
