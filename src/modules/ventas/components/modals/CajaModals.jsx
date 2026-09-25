import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { errorMsg, ventasApi } from '../../services/ventas.api.js';
import { MEDIOS_PAGO } from '../../domain/constants.js';
import { r2 } from '../../domain/pos.js';
import { imprimirArqueoCaja } from '@core/services/imprimir.js';
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

  /*
   * SE CONFIRMA DOS VECES (25/9/2026, pedido del dueño). Un ingreso o egreso
   * manual mueve el efectivo esperado del cajón y no se puede borrar: un cero
   * de más en el importe ($50.000.000 en vez de $5.000) quedaba firmado en el
   * arqueo sin que nadie lo viera. El primer "Registrar" valida y muestra el
   * resumen; recién "Sí, registrar" lo guarda. Cambiar cualquier dato vuelve
   * a pedir la confirmación.
   */
  const [confirmando, setConfirmando] = useState(false);
  const enviando = useRef(false);
  const firma = [tipo, destino, importe, motivo, tipoProveedor, proveedorId, referencia, esFlete].join('|');
  const firmaConfirmada = useRef('');
  if (confirmando && firmaConfirmada.current !== firma) setConfirmando(false);

  const validar = () => {
    if (!(Number(importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return false; }
    if (esPagoProveedor) {
      if (!tipoProveedor) { toast('Elegí el tipo de proveedor: mercadería o gastos.', 'err'); return false; }
      if (!proveedorId) { toast('Elegí a qué proveedor se le pagó.', 'err'); return false; }
    } else if (!motivo.trim()) { toast('Indicá el motivo.', 'err'); return false; }
    return true;
  };

  const pedirConfirmacion = () => {
    if (!validar()) return;
    firmaConfirmada.current = firma;
    setConfirmando(true);
  };

  const registrar = async () => {
    if (!validar() || enviando.current) return;
    enviando.current = true;
    try {
      await guardar();
    } finally {
      enviando.current = false;
    }
  };

  const guardar = async () => {
    if (esPagoProveedor) {
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
      footer={confirmando
        ? [
          { texto: 'Volver a editar', clase: 'btn-ghost', onClick: () => setConfirmando(false) },
          { texto: 'Sí, registrar', clase: tipo === 'egreso' ? 'btn-delete' : 'btn-primary', onClick: registrar },
        ]
        : [
          { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
          { texto: esPagoProveedor ? 'Registrar pago' : 'Registrar', clase: 'btn-primary', onClick: pedirConfirmacion },
        ]}
    >
      {confirmando && (
        <div className={cx(s.callout, s.warn)} style={{ marginBottom: 'var(--crm-space-3)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            ¿Confirmás {tipo === 'egreso' ? 'la SALIDA' : 'la ENTRADA'} de{' '}
            <span style={{ fontSize: 20 }}>{money(r2(importe))}</span>
            {tipo === 'egreso' ? ' del cajón' : ' al cajón'}?
          </div>
          <div>
            {esPagoProveedor
              ? <>{esFlete ? 'Flete' : 'Pago'} en efectivo a <strong>{elegido?.nombre ?? 'el proveedor'}</strong>{motivo.trim() ? <> · {motivo.trim()}</> : null}</>
              : <>Motivo: <strong>{motivo.trim()}</strong></>}
          </div>
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Cambia el efectivo esperado del arqueo y no se puede borrar. Revisá el importe antes de confirmar.
          </div>
        </div>
      )}
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

/**
 * Denominaciones de mayor a menor, como se apila el cajón.
 *
 * Llega hasta $20 y ahí se corta: de $10 para abajo no circula nada en la
 * caja, y ocho renglones que siempre quedan en cero son ocho lugares donde
 * el Enter se pierde mientras se cuenta.
 */
const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20];

/**
 * Contar el cajón sin calculadora: cantidad de cada billete/moneda y el total
 * sale solo. No es un dato que se guarde — es una ayuda para llenar "Efectivo
 * contado" sin errores de suma. El conteo queda en el modal padre mientras
 * esté abierto, así se puede volver a entrar a corregir una cantidad.
 */
function ContadorBilletesModal({ inicial, onUsar, onCerrar }) {
  const [cant, setCant] = useState(() => ({ ...(inicial || {}) }));
  const refs = useRef({});

  /* Todas las denominaciones son pesos enteros, así que la suma es exacta sin
   * dar vueltas por los centavos (lo que hacía falta cuando la lista bajaba
   * hasta los $0,05 y 3 × 0,05 daba 0.15000000000000002). */
  const total = useMemo(() => DENOMINACIONES.reduce((acc, d) => {
    const n = Math.floor(Number(cant[d])) || 0;
    return acc + (n > 0 ? d * n : 0);
  }, 0), [cant]);

  const etiqueta = (d) => `$ ${d.toLocaleString('es-AR')}`;

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
          {n ? money(d * n) : '—'}
        </span>
      </div>
    );
  };

  return (
    <ModalShell
      title="Contar el efectivo"
      subtitle="Cuántos de cada billete: el total se calcula solo. Enter baja al siguiente."
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: `Usar este total (${money(total)})`, clase: 'btn-primary', onClick: () => onUsar(cant, total) },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {DENOMINACIONES.map((d, i) => fila(d, i))}
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
 * Conteo de efectivo EN MEDIO del turno, A CIEGAS (25/9/2026, pedido del
 * dueño): se cuenta sin ver lo que el sistema espera, se registra, y recién
 * ahí aparecen el esperado y la diferencia. Con el esperado a la vista, el
 * conteo se volvía "copiar el número"; ahora el conteo es el que se registra,
 * tal cual. Si hay diferencia, se pide el porqué en un segundo paso (el
 * servidor solo deja escribir el texto: el conteo no se toca).
 */
export function ControlCajaModal({ cajaSesionId, onChange }) {
  const { ctx, closeModal, toast, operadorId } = useVentas();
  const [contado, setContado] = useState('');
  const [nota, setNota] = useState('');
  const [explicacion, setExplicacion] = useState('');
  /** El control ya registrado: con él llegan el esperado y la diferencia. */
  const [control, setControl] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const candado = useRef(false);
  const avisoSalida = useRef(false);
  const contador = useContadorBilletes(setContado);

  const conDiferencia = !!control && Math.abs(control.diferencia) > 0.009;
  /* La nota que vino CON el conteo ("saqué $5.000 de cambio") ya explica. */
  const faltaExplicar = conDiferencia && !nota.trim();

  const conCandado = async (fn) => {
    if (candado.current) return;
    candado.current = true;
    setEnviando(true);
    try { await fn(); } catch (e) { toast(errorMsg(e), 'err'); } finally {
      candado.current = false;
      setEnviando(false);
    }
  };

  const registrar = () => {
    if (contado === '' || !(Number(contado) >= 0)) { toast('Contá el efectivo e ingresá el monto.', 'err'); return; }
    return conCandado(async () => {
      const c = await ventasApi.controlCaja(cajaSesionId, {
        contadoEfectivo: r2(contado),
        observaciones: nota.trim(),
        usuarioId: ctx.usuarioId ?? undefined,
        // El relevo (0088): el conteo lo firma quien está parado en la caja.
        operadorId: operadorId ?? undefined,
      });
      setControl(c);
      onChange?.();
    });
  };

  const explicar = () => {
    if (!explicacion.trim()) { toast('Escribí por qué hay diferencia.', 'err'); return; }
    return conCandado(async () => {
      await ventasApi.explicarControl(cajaSesionId, control.id, { observaciones: explicacion.trim() });
      toast('Control registrado con su explicación.', 'ok');
      onChange?.();
      closeModal();
    });
  };

  /* Salir sin explicar una diferencia se avisa una vez: el conteo ya quedó
   * registrado igual, pero sin el porqué el que revisa no tiene por dónde
   * empezar. La segunda vez deja salir — nunca se queda nadie encerrado. */
  const salir = () => {
    if (faltaExplicar && !avisoSalida.current) {
      avisoSalida.current = true;
      toast('El conteo ya quedó registrado. Explicá la diferencia antes de salir.', 'err');
      return;
    }
    closeModal();
  };

  if (!control) {
    return (
      <ModalShell
        title="Control de caja"
        onClose={closeModal}
        footer={[
          { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
          { texto: enviando ? 'Registrando…' : 'Registrar conteo', clase: 'btn-primary', onClick: registrar, disabled: enviando },
        ]}
      >
        <div className={s.hint}>
          Contá el efectivo del cajón <strong>sin mirar el sistema</strong>. Al registrar, el conteo
          queda guardado tal cual y recién ahí aparecen el esperado y la diferencia. El turno sigue
          abierto y se puede seguir vendiendo.
        </div>

        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Efectivo contado <span className={s.req}>*</span></label>
            <input
              type="number" min="0" step="any" autoFocus
              placeholder="Lo que hay en el cajón"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); registrar(); } }}
            />
            {contador.boton}
          </div>
          <div className={s.field}>
            <label>Nota (opcional)</label>
            <input
              value={nota}
              placeholder="Ej.: saqué $5.000 para cambio"
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
        </div>
        {contador.modal}
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Control de caja — resultado"
      onClose={salir}
      footer={faltaExplicar
        ? [{ texto: enviando ? 'Guardando…' : 'Guardar explicación', clase: 'btn-primary', onClick: explicar, disabled: enviando }]
        : [{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}
    >
      <ResultadoConteo
        esperado={control.esperadoEfectivo}
        contado={control.contadoEfectivo}
        diferencia={control.diferencia}
      />
      <div className={s.hint}>
        El conteo quedó registrado en los controles del turno{conDiferencia ? ', con su diferencia' : ''}.
      </div>
      {conDiferencia && (nota.trim()
        ? <div className={s.callout}>Tu nota: {nota.trim()}</div>
        : (
          <div className={s.field}>
            <label>¿Por qué hay diferencia? <span className={s.req}>*</span></label>
            <input
              autoFocus
              value={explicacion}
              placeholder="Ej.: un vuelto mal dado, un egreso sin cargar"
              onChange={(e) => setExplicacion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); explicar(); } }}
            />
          </div>
        ))}
    </ModalShell>
  );
}

/**
 * Los tres números de un conteo, grandes: es lo que se viene a leer después de
 * contar. La diferencia en verde si cierra, en rojo si no, con su signo.
 */
function ResultadoConteo({ esperado, contado, diferencia }) {
  const ok = Math.abs(diferencia) < 0.01;
  return (
    <div className={cx(s.callout, !ok && s.warn)} style={{ marginBottom: 'var(--crm-space-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 16px', justifyContent: 'start', alignItems: 'baseline' }}>
        <span>Contado</span>
        <strong style={{ fontSize: 22 }}>{money(contado)}</strong>
        <span>Esperado (sistema)</span>
        <strong style={{ fontSize: 18 }}>{money(esperado)}</strong>
        <span>Diferencia</span>
        <strong style={{ fontSize: 22, color: ok ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>
          {ok ? 'Sin diferencia' : `${diferencia > 0 ? '+' : ''}${money(diferencia)} ${diferencia > 0 ? '(sobra)' : '(falta)'}`}
        </strong>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Cierre / arqueo
 * ==================================================================== */

/** Historial de controles intermedios del turno (fecha/hora, montos, diferencia). */
function ControlesDelTurno({ controles, ciego }) {
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
          /* A ciegas el esperado y la diferencia no se muestran (con el turno
           * abierto el servidor ni los manda): solo lo que se contó. */
          const oculto = ciego || c.esperadoEfectivo == null;
          const ok = Math.abs(c.diferencia) < 0.01;
          return (
            <tr key={c.id}>
              <td>
                {fmtFechaHora(c.fecha)}
                {c.observaciones && <div className={s.hint} style={{ margin: 0 }}>{c.observaciones}</div>}
              </td>
              <td className={s.num}>{oculto ? <span className={s.muted}>—</span> : money(c.esperadoEfectivo)}</td>
              <td className={s.num}>{money(c.contadoEfectivo)}</td>
              <td className={s.num}>
                {oculto ? <span className={s.muted}>—</span> : (
                  <strong style={{ color: ok ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>
                    {c.diferencia > 0 ? '+' : ''}{money(c.diferencia)}
                  </strong>
                )}
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

/**
 * Detalle del arqueo. Se comparte entre el cierre y el historial de turnos.
 *
 * `ciego`: el turno abierto visto por quien tiene que contarlo. Sin el efectivo
 * cobrado, el esperado ni el total cobrado —con cualquiera de los tres se
 * reconstruye el esperado—. El servidor ya los saca para el que no es jefe
 * (`arqueo.ciego`); el cierre lo fuerza para todos hasta que se declara el conteo.
 */
export function DetalleArqueo({ arqueo, ciego: forzarCiego = false }) {
  const cerrado = arqueo.sesion?.estado === 'cerrada';
  const ciego = !cerrado && (forzarCiego || !!arqueo.ciego);
  const medios = Object.entries(arqueo.medios || {}).filter(([m]) => !ciego || m !== 'efectivo');
  const efectivo = arqueo.medios?.efectivo?.total ?? 0;
  const aCiegas = <span className={s.muted}>se ve después de contar</span>;
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
        <Renglon label="+ Cobrado en efectivo" valor={ciego ? aCiegas : money(efectivo)} />
        <Renglon label="+ Otros ingresos" valor={money(arqueo.ingresos)} tenue={!arqueo.ingresos} />
        <Renglon label="− Egresos" valor={money(arqueo.egresos)} tenue={!arqueo.egresos} />

        <div className={s.pasoResultado}>
          <span>Efectivo esperado</span>
          {ciego ? aCiegas : (
            <strong
              className={s.mono}
              style={{ color: arqueo.esperadoEfectivo < 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-accent)' }}
            >
              {money(arqueo.esperadoEfectivo)}
            </strong>
          )}
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
        {ciego ? 'Otros medios de pago' : 'Por medio de pago'}
        {!ciego && (
          <span className={s.hint} style={{ margin: '0 0 0 8px', fontWeight: 400 }}>
            total cobrado {money(arqueo.totalCobrado)}
          </span>
        )}
      </div>
      <Table
        cols={[
          { h: 'Medio' }, { h: 'Ventas', num: true }, { h: 'Cobranzas', num: true },
          { h: 'De eso, recargo', num: true }, { h: 'Total', num: true },
        ]}
        empty={ciego ? 'Todavía no entró dinero por otros medios.' : 'No entró dinero en este turno.'}
      >
        {medios.map(([medio, m]) => (
          <tr key={medio}>
            <td>{MEDIOS_PAGO[medio] || medio}</td>
            <td className={s.num}>{money(m.ventas)}</td>
            <td className={s.num}>{money(m.cobranzas)}</td>
            {/* EL RECARGO POR CUOTAS, DENTRO DEL MISMO COBRO. Va al lado del
                medio y no en una fila aparte porque es plata que entró por ESE
                medio: separarla en otro renglón haría que los totales de la
                tabla dejaran de sumar el total cobrado. */}
            <td className={s.num}>
              {m.recargo > 0
                ? <span style={{ color: 'var(--crm-color-warning)' }}>{money(m.recargo)}</span>
                : <span className={s.muted}>—</span>}
            </td>
            <td className={s.num}><strong>{money(m.total)}</strong></td>
          </tr>
        ))}
      </Table>
      {arqueo.recargos > 0 && !ciego && (
        <div className={s.hint}>
          De los {money(arqueo.totalCobrado)} que entraron, <strong>{money(arqueo.recargos)}</strong> son
          recargo por cuotas: no es venta de mercadería, es lo que se le cobró al cliente por
          financiar. Esa plata es la que se va a quedar la tarjeta cuando liquide.
        </div>
      )}

      <MovimientosDelTurno movimientos={arqueo.movimientos} />

      <ControlesDelTurno controles={arqueo.controles} ciego={ciego} />
    </>
  );
}

/**
 * SACA EL PAPEL DE LA RENDICION.
 *
 * Resuelve aca los NOMBRES de sucursal y cajero -el arqueo trae los ids- porque
 * el papel lo lee una persona: un "sucursal 3" no le sirve a nadie para rendir.
 *
 * Devuelve `false` si el navegador bloqueo la ventana emergente, para que quien
 * llama lo avise: en el cierre eso es la diferencia entre "se imprimio" y "creí
 * que se imprimio".
 */
function sacarComprobanteArqueo(arqueo, { sucursales, usuarios, ctx, reimpresion = false }) {
  const ses = arqueo?.sesion ?? {};
  const nombreDe = (id) => usuarios?.find((u) => u.id === id)?.nombre || '';
  return imprimirArqueoCaja(arqueo, {
    moneda: money,
    fechaHora: fmtFechaHora,
    /* Solo la hora, para el rollo: los movimientos son todos del mismo turno. */
    hora: (v) => new Date(v).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    sucursal: sucursales?.find((x) => x.id === ses.sucursalId)?.nombre || '',
    /* El CAJERO del papel es el DUEÑO DEL TURNO, no quien esta mirando la
     * pantalla: el que rinde la plata es el que la cobro. */
    cajero: nombreDe(ses.usuarioId),
    /* En cambio el sello de reimpresion lleva a QUIEN LA SACO, que puede ser
     * otro -el encargado sacando de nuevo el papel de un turno ajeno. */
    usuario: nombreDe(ctx?.usuarioId),
    ahora: fmtFechaHora(new Date()),
    reimpresion,
  });
}

export function CerrarCajaModal({ cajaSesionId, onChange }) {
  const { ctx, act, closeModal, toast, setOperador, sucursales, usuarios, operadorId } = useVentas();
  const [declarado, setDeclarado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const contador = useContadorBilletes(setDeclarado);

  const { data: arqueo, loading, error } = useResource(`arqueo:${cajaSesionId}`, () => ventasApi.cajaArqueo(cajaSesionId));

  /*
   * EL CIERRE ES A CIEGAS (25/9/2026, pedido del dueño), para todos: se cuenta
   * sin ver el esperado. "Ver resultado" manda el conteo al servidor, que
   * devuelve el arqueo completo — y si el conteo NO coincide, lo deja
   * registrado como control ANTES de mostrar el esperado. Así "volver a contar"
   * sigue siendo posible (un billete pegado pasa) pero el primer número queda.
   *
   * El resultado es además la confirmación del cierre: el turno cerrado no se
   * reabre, así que recién "Sí, cerrar el turno" lo cierra. Con diferencia, la
   * explicación es obligatoria (el servidor también la exige).
   */
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const candado = useRef(false);
  const conDiferencia = !!resultado && Math.abs(resultado.diferencia) > 0.009;

  const verResultado = async () => {
    /* El campo vacío NO es "cero contado": era un `r2('')` = 0 que cerraba el
     * turno con una diferencia inventada del tamaño de todo el efectivo del día,
     * firmada y sin poder reabrirse. */
    if (declarado === '') { toast('Contá el efectivo del cajón e ingresá el monto.', 'err'); return; }
    if (!(Number(declarado) >= 0)) { toast('El efectivo contado no puede ser negativo.', 'err'); return; }
    if (candado.current) return;
    candado.current = true;
    setEnviando(true);
    try {
      setResultado(await ventasApi.conteoCierre(cajaSesionId, {
        contadoEfectivo: r2(declarado),
        usuarioId: ctx.usuarioId ?? undefined,
        // El relevo (0088): el conteo lo firma quien está en la caja.
        operadorId: operadorId ?? undefined,
      }));
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      candado.current = false;
      setEnviando(false);
    }
  };

  const cerrar = async () => {
    if (!resultado || candado.current) return;
    if (conDiferencia && !observaciones.trim()) { toast('Hay diferencia: escribí por qué antes de cerrar.', 'err'); return; }
    candado.current = true;
    setEnviando(true);
    try {
      await guardarCierre();
    } finally {
      candado.current = false;
      setEnviando(false);
    }
  };

  const guardarCierre = async () => {
    const ok = await act(
      ventasApi.cerrarCaja(cajaSesionId, { declaradoEfectivo: resultado.contado, observaciones: observaciones.trim() }),
      'Turno cerrado.',
      { recargar: false },
    );
    if (ok) {
      /*
       * EL PAPEL SALE SOLO, y sale ANTES de cerrar el modal.
       *
       * Con este comprobante se rinde la plata, asi que pedirlo con un boton
       * aparte lo volveria opcional: el turno que se cierra sin papel deja al
       * cajero entregando efectivo contra nada. Se imprime con la sesion YA
       * cerrada (`sesionCerrada`) y con el arqueo COMPLETO que devolvio el
       * conteo (el de la pantalla, a ciegas, no tiene el esperado).
       *
       * Si el navegador bloquea la ventana emergente se avisa: siempre se puede
       * reimprimir desde el historial del turno.
       */
      const completo = resultado.arqueo;
      const sesionCerrada = ok?.id ? ok : {
        ...completo.sesion, estado: 'cerrada', cierre: new Date(),
        declaradoEfectivo: resultado.contado, diferencia: resultado.diferencia,
      };
      const salio = sacarComprobanteArqueo(
        { ...completo, sesion: sesionCerrada },
        { sucursales, usuarios, ctx },
      );
      if (!salio) toast('El turno se cerro, pero el navegador bloqueo la impresion. Reimprimilo desde el historial.', 'err');
      /* El relevo muere con el turno (0088): el próximo arranca con el titular
       * de la sesión — un relevo que sobrevive al cierre es un olvido servido. */
      setOperador(null);
      onChange?.();
    }
  };

  if (loading) {
    return (
      <ModalShell title="Cerrar caja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={s['empty-state']}>Preparando el arqueo…</div>
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

  /* ---------------- Paso 1: contar a ciegas ---------------- */
  if (!resultado) {
    return (
      <ModalShell
        title="Cerrar caja — conteo a ciegas"
        wide
        onClose={closeModal}
        footer={[
          { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
          { texto: enviando ? 'Verificando…' : 'Ver resultado', clase: 'btn-primary', onClick: verResultado, disabled: enviando },
        ]}
      >
        <div className={s.callout}>
          Contá el efectivo del cajón <strong>sin mirar el sistema</strong> y escribí lo que contaste.
          El esperado aparece después. Si no coincide, ese primer conteo <strong>queda registrado</strong>{' '}
          aunque vuelvas a contar.
        </div>

        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Efectivo contado <span className={s.req}>*</span></label>
            <input
              type="number" min="0" step="any" autoFocus
              placeholder="Lo que hay en el cajón"
              value={declarado}
              onChange={(e) => setDeclarado(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); verResultado(); } }}
            />
            {contador.boton}
          </div>
        </div>
        {contador.modal}

        <DetalleArqueo arqueo={arqueo} ciego />
      </ModalShell>
    );
  }

  /* ---------------- Paso 2: resultado y confirmación ---------------- */
  return (
    <ModalShell
      title="Cerrar caja — resultado"
      wide
      onClose={closeModal}
      footer={[
        /* Volver a contar NO borra nada: si hubo diferencia, el primer conteo
         * ya está en los controles del turno. */
        { texto: 'Volver a contar', clase: 'btn-ghost', onClick: () => { setResultado(null); setObservaciones(''); }, disabled: enviando },
        { texto: enviando ? 'Cerrando…' : 'Sí, cerrar el turno', clase: 'btn-delete', onClick: cerrar, disabled: enviando },
      ]}
    >
      <ResultadoConteo esperado={resultado.arqueo.esperadoEfectivo} contado={resultado.contado} diferencia={resultado.diferencia} />
      {resultado.control && (
        <div className={s.hint}>
          Como no coincidió, este conteo quedó registrado en los controles del turno. Si volvés a
          contar, los dos conteos quedan a la vista de quien revise.
        </div>
      )}

      <div className={s.field}>
        <label>Observaciones {conDiferencia && <span className={s.req}>*</span>}</label>
        <input
          autoFocus={conDiferencia}
          value={observaciones}
          placeholder={conDiferencia ? 'Explicá por qué hay diferencia' : 'Opcional'}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      <div className={s.hint}>
        El turno cerrado <strong>no se puede reabrir</strong>. Si el contado tiene un cero de más o de
        menos, volvé a contar. La diferencia se guarda tal cual, incluso negativa: es el control.
      </div>

      <DetalleArqueo arqueo={resultado.arqueo} />
    </ModalShell>
  );
}

/** Arqueo de un turno ya cerrado (solo lectura, desde el historial). */
export function ArqueoTurnoModal({ cajaSesionId }) {
  const { closeModal, sucursales, usuarios, ctx, toast } = useVentas();
  const { data: arqueo, loading, error } = useResource(`arqueo-ver:${cajaSesionId}`, () => ventasApi.cajaArqueo(cajaSesionId));

  const footer = [
    { texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal },
    /* Reimprimir SIEMPRE, no solo los turnos cerrados: con el turno abierto el
     * papel sale sin conteo y avisandolo, que es justo lo que se necesita para
     * un control a mitad del dia. Salvo A CIEGAS: el papel del turno abierto
     * lleva el esperado, y el que cuenta no lo tiene que ver. */
    !arqueo?.ciego && {
      texto: 'Imprimir',
      clase: 'btn-primary',
      onClick: () => {
        if (!arqueo) return;
        const salio = sacarComprobanteArqueo(arqueo, { sucursales, usuarios, ctx, reimpresion: true });
        if (!salio) toast('El navegador bloqueó la ventana de impresión.', 'err');
      },
    },
  ].filter(Boolean);
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

      {arqueo.ciego && (
        <div className={s.callout}>
          El efectivo esperado de un turno abierto se ve después de contar: en <strong>Control de
          caja</strong> o al <strong>cerrar la caja</strong>.
        </div>
      )}

      <DetalleArqueo arqueo={arqueo} />

      {sesion.observaciones && <div className={s.callout}>{sesion.observaciones}</div>}
    </ModalShell>
  );
}
