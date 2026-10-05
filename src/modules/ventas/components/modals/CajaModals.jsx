import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { errorMsg, ventasApi } from '../../services/ventas.api.js';
import { MEDIOS_PAGO } from '../../domain/constants.js';
import { r2 } from '../../domain/pos.js';
import { imprimirArqueoCaja, imprimirEnvioCaja } from '@core/services/imprimir.js';
import { separarEnvio, sumaBilletes } from '../../domain/separarEnvio.js';
import { Table, Di, Btn, Pill, ModalShell, money, fmtFechaHora, s } from '../ui.jsx';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';

/* ==================================================================== *
 * Apertura
 * ==================================================================== */

/*
 * APERTURA CON FONDO FIJO (0111, pedido del dueño): "si abrí con $50.000, que
 * quede eso". Con fondo cargado en la sucursal, el que no es jefe no escribe
 * el monto: confirma que están o los cuenta billete por billete, y lo que
 * falte queda avisado al administrador. El jefe abre con el monto propuesto
 * (lo puede cambiar para ese turno; el fondo fijo lo cambia el superadmin en
 * Gerencia › Sucursales). Sin fondo cargado, la primera apertura lo fija.
 */
export function AbrirCajaModal({ onChange }) {
  const { ctx, sucursales, usuarios, act, closeModal, toast, esJefe } = useVentas();
  const sucursal = sucursales.find((x) => x.id === ctx.sucursalId);
  const usuario = usuarios.find((u) => u.id === ctx.usuarioId);
  /* FRESCO DEL SERVIDOR, no de la lista del arranque (26/9/2026): la primera
   * apertura fija el fondo y la lista de sucursales cargada al entrar seguía
   * diciendo que no había — el modal pedía un monto que el servidor rechazaba. */
  const { data: ap, loading: cargandoAp, error: errorAp } = useResource(
    `apertura:${ctx.sucursalId}`,
    () => ventasApi.cajaApertura(ctx.sucursalId),
    { enabled: !!ctx.sucursalId },
  );
  /* Lo propuesto: lo que dejó de cambio el último cierre, o el fondo fijo. */
  const fondo = ap?.propuesto != null ? Number(ap.propuesto) : null;
  const conFondoFijo = fondo != null && !esJefe;

  const [montoInicial, setMontoInicial] = useState('');
  /* El jefe arranca con lo propuesto ya escrito (lo puede cambiar). */
  useEffect(() => {
    if (fondo != null) setMontoInicial((m) => (m === '' ? String(fondo) : m));
  }, [fondo]);
  const [observaciones, setObservaciones] = useState('');
  /** Para el que no es jefe: 'si' (están) o 'contar' (no están: se cuentan). */
  const [respuesta, setRespuesta] = useState(null);
  const [billetes, setBilletes] = useState({});
  const contado = totalBilletes(billetes);
  const [enviando, setEnviando] = useState(false);
  const candado = useRef(false);

  const abrir = async () => {
    if (candado.current) return;
    let cuerpo;
    if (conFondoFijo) {
      if (!respuesta) { toast(`Confirmá si están los ${money(fondo)} del fondo.`, 'err'); return; }
      if (respuesta === 'contar' && !Object.values(billetes).some((c) => Number(c) > 0)) {
        toast('Contá los billetes del cajón: el turno abre con lo que haya.', 'err');
        return;
      }
      cuerpo = respuesta === 'si' ? { fondoCompleto: true } : { billetes: billetesLimpios(billetes) };
    } else {
      // El fondo es obligatorio: sin punto de partida no hay arqueo posible.
      if (!(Number(montoInicial) > 0)) {
        toast('Declará el fondo inicial: la caja siempre arranca con un monto.', 'err');
        return;
      }
      cuerpo = { montoInicial: r2(montoInicial) };
    }
    candado.current = true;
    setEnviando(true);
    try {
      const ok = await act(
        ventasApi.abrirCaja({
          sucursalId: ctx.sucursalId,
          usuarioId: ctx.usuarioId ?? undefined,
          observaciones,
          ...cuerpo,
        }),
        'Caja abierta.',
        { recargar: false },
      );
      if (ok) onChange?.();
    } finally {
      candado.current = false;
      setEnviando(false);
    }
  };

  const dif = conFondoFijo && respuesta === 'contar' ? r2(contado - fondo) : 0;

  if (cargandoAp || errorAp) {
    return (
      <ModalShell title="Abrir caja" onClose={closeModal} footer={[{ texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal }]}>
        {errorAp
          ? <div className={cx(s.callout, s.warn)}>No se pudo consultar el fondo de la caja: <strong>{errorAp}</strong></div>
          : <div className={s['empty-state']}>Consultando el fondo de la caja…</div>}
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Abrir caja"
      wide={conFondoFijo && respuesta === 'contar'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: enviando ? 'Abriendo…' : 'Abrir turno', clase: 'btn-primary', onClick: abrir, disabled: enviando || (conFondoFijo && !respuesta) },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Sucursal">{sucursal?.nombre || '—'}</Di>
        <Di label="Cajero">{usuario?.nombre || '—'}</Di>
      </div>

      {conFondoFijo ? (
        <>
          <div className={s.callout}>
            {ap.dejadoEnCaja != null ? (
              <>
                En el último cierre{ap.ultimoCierre ? ` (${fmtFechaHora(ap.ultimoCierre)})` : ''} quedaron{' '}
                <strong>{money(fondo)}</strong> de cambio en la caja de {sucursal?.nombre || 'esta sucursal'}.
                {ap.fondoFijo != null && Math.abs(ap.fondoFijo - fondo) > 0.009 && (
                  <> El fondo fijo es {money(ap.fondoFijo)}.</>
                )}
              </>
            ) : (
              <>El fondo fijo de la caja de {sucursal?.nombre || 'esta sucursal'} es <strong>{money(fondo)}</strong>.</>
            )}
          </div>
          <div className={s.field}>
            <label>¿Están los {money(fondo)} en el cajón?</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant={respuesta === 'si' ? 'btn-primary' : undefined} onClick={() => setRespuesta('si')}>Sí, están</Btn>
              <Btn variant={respuesta === 'contar' ? 'btn-primary' : undefined} onClick={() => setRespuesta('contar')}>No, los cuento</Btn>
            </div>
          </div>
          {respuesta === 'contar' && (
            <>
              <ConteoBilletes cant={billetes} setCant={setBilletes} />
              {Object.values(billetes).some((c) => Number(c) > 0) && Math.abs(dif) > 0.009 && (
                <div className={cx(s.callout, s.warn)}>
                  {dif < 0 ? `Faltan ${money(-dif)}` : `Sobran ${money(dif)}`} respecto de los {money(fondo)}. El turno abre con{' '}
                  <strong>{money(contado)}</strong> y queda avisado al administrador.
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className={s.field}>
          <label>Fondo inicial <span className={s.req}>*</span></label>
          <input
            type="number" min="0" step="100" autoFocus
            placeholder="Ej: 50000"
            value={montoInicial}
            onChange={(e) => setMontoInicial(e.target.value)}
          />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            {ap?.fondoFijo == null
              ? <>Este monto queda como <strong>fondo fijo</strong> de la caja de {sucursal?.nombre || 'esta sucursal'}: las próximas aperturas arrancan con él.</>
              : <>Propuesto: {ap.dejadoEnCaja != null ? 'lo que quedó de cambio en el último cierre' : 'el fondo fijo'} ({money(fondo)}). Podés abrir este turno con otro monto; el fondo fijo lo cambia el superadmin en Gerencia › Sucursales.</>}
          </div>
        </div>
      )}

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
  /* El pago gemelo (27/9/2026): la API avisa con 409 que ese día ya hay un
   * pago igual al mismo proveedor; el siguiente "Sí" lo confirma a propósito. */
  const [gemelo, setGemelo] = useState(null);
  const enviando = useRef(false);
  const firma = [tipo, destino, importe, motivo, tipoProveedor, proveedorId, referencia, esFlete].join('|');
  const firmaConfirmada = useRef('');
  if (confirmando && firmaConfirmada.current !== firma) { setConfirmando(false); setGemelo(null); }

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
          confirmarDuplicado: gemelo != null || undefined,
        }),
        esFlete
          ? 'Flete registrado. Se le descuenta de su factura cuando se cargue.'
          : tipoProveedor === 'mercaderia'
            ? 'Pago registrado. Queda a cuenta en Compras › Pagos en sucursal hasta que se cargue la factura.'
            : 'Pago registrado. Queda a cuenta en Gastos › Pagos en sucursal hasta que se cargue el comprobante.',
        { recargar: false, alConflicto: (d) => setGemelo(d?.duplicado ?? '—') },
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
          { texto: gemelo != null ? 'Sí, es otro pago' : 'Sí, registrar', clase: tipo === 'egreso' ? 'btn-delete' : 'btn-primary', onClick: registrar },
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
          {gemelo != null && (
            <div style={{ marginTop: 8 }}>
              <strong>Hoy ya hay un pago igual a este proveedor{gemelo !== '—' ? ` (pago #${gemelo})` : ''}.</strong>{' '}
              Si fue un doble clic, volvé. Si de verdad se le pagó dos veces lo mismo, confirmalo.
            </div>
          )}
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

/** El total de un conteo por billete (pesos enteros: la suma es exacta). */
function totalBilletes(cant) {
  return DENOMINACIONES.reduce((acc, d) => {
    const n = Math.floor(Number(cant?.[d])) || 0;
    return acc + (n > 0 ? d * n : 0);
  }, 0);
}
/** Solo los billetes con cantidad, como los espera la API. */
function billetesLimpios(cant) {
  const out = {};
  for (const d of DENOMINACIONES) {
    const n = Math.floor(Number(cant?.[d])) || 0;
    if (n > 0) out[d] = n;
  }
  return out;
}

/**
 * EL CONTADOR DE BILLETES EN LA PANTALLA, sin campo de monto (0111): el total
 * sale SOLO de los billetes. Es la forma de contar del cajero al cerrar y al
 * abrir con el fondo incompleto — no hay manera de tipear un número.
 */
function ConteoBilletes({ cant, setCant }) {
  const refs = useRef({});
  const total = totalBilletes(cant);
  return (
    <div className={s.callout} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className={s.hint} style={{ margin: 0 }}>Cuántos de cada billete. Enter baja al siguiente; el total se calcula solo.</div>
      {DENOMINACIONES.map((d, i) => {
        const n = Math.floor(Number(cant[d])) || 0;
        return (
          <div key={d} style={{ display: 'grid', gridTemplateColumns: '90px 90px 1fr', gap: 8, alignItems: 'center' }}>
            <span className={s.mono} style={{ textAlign: 'right', fontWeight: 600 }}>$ {d.toLocaleString('es-AR')}</span>
            <input
              ref={(el) => { refs.current[d] = el; }}
              type="number" min="0" step="1" placeholder="0" inputMode="numeric"
              autoFocus={i === 0}
              value={cant[d] ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                setCant((c) => ({ ...c, [d]: v }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); refs.current[DENOMINACIONES[i + 1]]?.focus(); }
              }}
            />
            <span className={cx(s.mono, !n && s.muted)} style={{ textAlign: 'right' }}>{n ? money(d * n) : '—'}</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
        <span>Total contado</span>
        <strong className={s.mono} style={{ fontSize: 22 }}>{money(total)}</strong>
      </div>
    </div>
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
  const { ctx, closeModal, toast, operadorId, esJefe } = useVentas();
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
  /* El texto del paso 1 no le promete al que no es jefe que va a ver el
   * esperado: no lo va a ver (0111). */

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

  /* A ciegas (0111): el que no es jefe registra su conteo y nada más — la
   * respuesta del servidor no trae el esperado ni la diferencia. */
  if (control?.ciego) {
    return (
      <ModalShell title="Control de caja" onClose={closeModal} footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}>
        <div className={cx(s.callout, s.ok)}>
          Conteo registrado: <strong>{money(control.contadoEfectivo)}</strong>. Queda en los controles del turno y lo revisa el administrador.
        </div>
      </ModalShell>
    );
  }

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
          queda guardado tal cual{esJefe ? ' y recién ahí aparecen el esperado y la diferencia' : ' y lo revisa el administrador'}.
          El turno sigue abierto y se puede seguir vendiendo.
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
function MovimientosDelTurno({ movimientos, onAnular }) {
  const { usuarios } = useVentas();
  /* Con algo asentado después del cierre, abierto: es lo que se viene a mirar. */
  const [abierto, setAbierto] = useState(() => (movimientos ?? []).some((m) => m.posterior));
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
          ...(onAnular ? [{ h: '' }] : []),
        ]}
        >
          {filas.map((m) => {
            const anulado = !!m.anuladoEn;
            return (
              <tr key={m.id} style={anulado ? { opacity: 0.55 } : undefined}>
                <td>{fmtFechaHora(m.fecha)}</td>
                <td>
                  {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                  {m.posterior && <div><Pill pill="est-pendiente" label="después del cierre" /></div>}
                </td>
                <td>
                  <span style={anulado ? { textDecoration: 'line-through' } : undefined}>{m.motivo}</span>
                  {anulado && <div className={s.hint} style={{ margin: 0 }}>Anulado por {usuarios.find((u) => u.id === m.anuladoPor)?.nombre || '—'}: {m.anuladoMotivo}</div>}
                </td>
                <td>{usuarios.find((u) => u.id === m.usuarioId)?.nombre || <span className={s.muted}>—</span>}</td>
                <td className={s.num} style={{ color: m.tipo === 'egreso' ? 'var(--crm-color-danger)' : undefined, textDecoration: anulado ? 'line-through' : undefined }}>
                  {m.tipo === 'egreso' ? '−' : '+'}{money(m.importe)}
                </td>
                {onAnular && (
                  <td>{m.posterior && !anulado && <Btn small variant="btn-delete" onClick={() => onAnular(m)}>Anular</Btn>}</td>
                )}
              </tr>
            );
          })}
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
export function DetalleArqueo({ arqueo, ciego: forzarCiego = false, onAnularPosterior }) {
  const cerrado = arqueo.sesion?.estado === 'cerrada';
  /* El servidor lo manda ciego al que no es jefe SIEMPRE, también cerrado
   * (0111). `forzarCiego` es el paso 1 del cierre del jefe. */
  const ciego = !!arqueo.ciego || (!cerrado && forzarCiego);
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

        {/* A ciegas y cerrado: lo que contó, envió y dejó de fondo — sin la
            diferencia, que solo ve el administrador (0111). */}
        {cerrado && ciego && (
          <>
            <Renglon label="Efectivo contado" valor={money(arqueo.sesion.declaradoEfectivo)} />
            {arqueo.sesion.envioEfectivo != null && (
              <>
                <Renglon label="Quedó de fondo" valor={money(arqueo.sesion.fondoQueda)} />
                <Renglon label="Enviado" valor={money(arqueo.sesion.envioEfectivo)} />
              </>
            )}
          </>
        )}
        {/* Solo con el turno cerrado hay conteo contra el cual comparar. */}
        {cerrado && !ciego && (
          <>
            <Renglon label="Efectivo contado" valor={money(arqueo.sesion.declaradoEfectivo)} />
            {arqueo.sesion.envioEfectivo != null && (
              <>
                <Renglon label="Quedó de fondo" valor={money(arqueo.sesion.fondoQueda)} tenue />
                <Renglon label="Enviado" valor={money(arqueo.sesion.envioEfectivo)} tenue />
              </>
            )}
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

      <MovimientosDelTurno movimientos={arqueo.movimientos} onAnular={onAnularPosterior} />

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

/*
 * CERRAR CAJA: UN SOLO CIERRE PARA TODOS (1/10/2026, pedido del dueño). Se
 * cuenta billete por billete, queda el fondo y se envía el resto — también
 * administración. El «Ver resultado» con monto se dio de baja. Si el que
 * cierra ve lo que tiene que haber lo decide la configuración
 * (`cajaVeEsperado`, Ventas › Configuración › Caja y cobro).
 */
export function CerrarCajaModal(props) {
  return <CerrarCajaEnvioModal {...props} />;
}

/**
 * LO QUE TIENE QUE HABER EN LA CAJA, detallado (con `cajaVeEsperado`): fondo
 * con el que abrió, efectivo cobrado (ventas y cobranzas), ingresos y egresos
 * del turno, y lo que da. Con lo contado, la diferencia en vivo.
 */
function LoQueTieneQueHaber({ turno, contado, conto }) {
  const ef = turno?.medios?.efectivo ?? {};
  const esperado = Number(turno?.esperadoEfectivo) || 0;
  const dif = r2(contado - esperado);
  const fila = (txt, v, fuerte) => (
    <><span style={fuerte ? { fontWeight: 700 } : undefined}>{txt}</span><strong className={s.mono} style={fuerte ? { fontSize: 18 } : undefined}>{v}</strong></>
  );
  return (
    <div className={cx(s.callout, s.info)}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Lo que tiene que haber en la caja</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 16px', justifyContent: 'start', alignItems: 'baseline' }}>
        {fila('Fondo con el que abrió', money(turno?.montoInicial))}
        {fila('+ Cobrado en efectivo (ventas)', money(ef.ventas ?? ef.total))}
        {Number(ef.cobranzas) ? fila('+ Cobrado en efectivo (cuentas corrientes)', money(ef.cobranzas)) : null}
        {fila('+ Ingresos de caja', money(turno?.ingresos))}
        {fila('− Egresos de caja', money(turno?.egresos))}
        {fila('= Tiene que haber', money(esperado), true)}
      </div>
      {conto && (
        <div style={{ marginTop: 8, fontWeight: 700, color: Math.abs(dif) < 0.01 ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>
          Contaste {money(contado)}: {Math.abs(dif) < 0.01 ? 'sin diferencia' : `${dif > 0 ? 'sobran' : 'faltan'} ${money(Math.abs(dif))}`}.
        </div>
      )}
    </div>
  );
}

/**
 * EL CIERRE DEL CAJERO: CONTAR, DEJAR EL FONDO Y ENVIAR (0111, pedido del dueño).
 *
 * 1. Cuenta el cajón billete por billete — no hay campo de monto.
 * 2. Ve lo que ÉL contó, lo que queda de fondo para mañana y lo que envía;
 *    nunca el esperado ni la diferencia.
 * 3. Confirma una segunda vez, y el envío cierra el turno.
 * El servidor recibe los billetes y suma él: tampoco por la API se tipea.
 */
function CerrarCajaEnvioModal({ cajaSesionId, onChange }) {
  const { ctx, closeModal, toast, setOperador, sucursales, usuarios, operadorId, config } = useVentas();
  const [billetes, setBilletes] = useState({});
  /* Los billetes que van al SOBRE (0130): los propone el sistema al pasar a «Separar» y se pueden ajustar. */
  const [envioB, setEnvioB] = useState({});
  const [paso, setPaso] = useState('contar');
  const [enviando, setEnviando] = useState(false);
  const candado = useRef(false);
  const { data: turno, loading } = useResource(`turno-envio:${cajaSesionId}`, () => ventasApi.cajaArqueo(cajaSesionId));
  const sucursalId = turno?.sesion?.sucursalId ?? ctx.sucursalId;
  /* El fondo fijo, fresco del servidor (la lista del arranque puede estar vieja). */
  const { data: ap, loading: cargandoAp } = useResource(
    `apertura-cierre:${sucursalId}`, () => ventasApi.cajaApertura(sucursalId), { enabled: !!sucursalId },
  );
  const sucursal = sucursales.find((x) => x.id === sucursalId);
  const fondo = ap?.fondoFijo != null ? Number(ap.fondoFijo) : Number(turno?.montoInicial) || 0;
  const contado = totalBilletes(billetes);
  const conto = Object.values(billetes).some((c) => Number(c) > 0);
  const debeQuedar = Math.min(contado, fondo);
  /* Antes de separar: la cuenta de siempre. Separando: lo que dicen los billetes del sobre. */
  const separando = paso !== 'contar';
  const envio = separando ? r2(sumaBilletes(envioB)) : r2(contado - debeQuedar);
  const queda = r2(contado - envio);
  const faltaFondo = r2(Math.max(0, fondo - queda));
  const quedaPoco = separando && queda + 0.009 < debeQuedar;
  const cantDe = (b, d) => Math.floor(Number(b[d])) || 0;
  const proponer = () => setEnvioB(separarEnvio(billetesLimpios(billetes), debeQuedar).envio);
  const ajustarSobre = (d, delta) => setEnvioB((e) => {
    const n = Math.max(0, Math.min(cantDe(billetes, d), cantDe(e, d) + delta));
    const o = { ...e };
    if (n > 0) o[d] = n; else delete o[d];
    return o;
  });
  /* A ciegas salvo que la configuración deje ver lo que tiene que haber: ahí el
   * servidor manda el arqueo completo y se muestra el detalle. Apagada, ni
   * administración lo ve al cerrar («que hagan envíos a ciegas»). */
  const ve = !!config?.cajaVeEsperado && turno?.esperadoEfectivo != null;

  const aSeparar = () => {
    if (!conto) { toast('Contá los billetes del cajón antes de enviar.', 'err'); return; }
    proponer();
    setPaso('separar');
  };
  const aConfirmar = () => {
    if (quedaPoco) { toast(`Tienen que quedar por lo menos ${money(debeQuedar)} en la caja: sacá billetes del sobre.`, 'err'); return; }
    setPaso('confirmar');
  };

  const enviar = async () => {
    if (candado.current) return;
    candado.current = true;
    setEnviando(true);
    try {
      const r = await ventasApi.enviarCierreCaja(cajaSesionId, {
        billetes: billetesLimpios(billetes),
        billetesEnvio: billetesLimpios(envioB),
        confirmado: true,
        usuarioId: ctx.usuarioId ?? undefined,
        operadorId: operadorId ?? undefined,
      });
      const nombreDe = (id) => usuarios?.find((u) => u.id === id)?.nombre || '';
      const salio = await imprimirEnvioCaja(
        { ...r, sesionId: r.sesion?.id, cierre: r.sesion?.cierre, esperadoEfectivo: ve ? r.esperadoEfectivo : null, diferencia: ve ? r.diferencia : null },
        { moneda: money, fechaHora: fmtFechaHora, sucursal: sucursal?.nombre || '', cajero: nombreDe(r.sesion?.usuarioId) },
      );
      toast(`Caja cerrada. Quedan ${money(r.fondoQueda)} en la caja y va el sobre de ${money(r.envio)}.`, 'ok');
      if (!salio) toast('La caja se cerró, pero el navegador bloqueó la impresión. Reimprimila desde el historial.', 'err');
      setOperador(null);
      onChange?.();
      closeModal();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      candado.current = false;
      setEnviando(false);
    }
  };

  if (loading || cargandoAp) {
    return (
      <ModalShell title="Cerrar caja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={s['empty-state']}>Preparando el cierre…</div>
      </ModalShell>
    );
  }

  const resumen = (
    <div className={s.callout}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 16px', justifyContent: 'start', alignItems: 'baseline' }}>
        <span>Contaste en el cajón</span><strong className={s.mono} style={{ fontSize: 18 }}>{money(contado)}</strong>
        <span>Dejar en caja</span><strong className={s.mono} style={{ fontSize: 18 }}>{money(queda)}</strong>
        <span>Va en el sobre</span><strong className={s.mono} style={{ fontSize: 22, color: 'var(--crm-color-accent)' }}>{money(envio)}</strong>
      </div>
      <div className={s.hint} style={{ margin: '8px 0 0' }}>
        Dejá <strong>{money(queda)}</strong> en la caja: es el fondo para el próximo turno{fondo ? ` (fondo fijo ${money(fondo)})` : ''}.
        {separando && queda > debeQuedar + 0.009 && ` Con estos billetes no se llega justo al fondo: quedan ${money(r2(queda - debeQuedar))} de más en la caja.`}
      </div>
      {quedaPoco && (
        <div className={cx(s.callout, s.warn)} style={{ margin: '8px 0 0' }}>
          Así quedarían {money(queda)} en la caja y tienen que quedar {money(debeQuedar)}: sacá billetes del sobre.
        </div>
      )}
      {conto && faltaFondo > 0.009 && (
        <div className={cx(s.callout, s.warn)} style={{ margin: '8px 0 0' }}>
          Contaste menos que el fondo fijo: <strong>no se envía nada</strong>, todo queda como fondo y
          queda avisado al administrador (faltan {money(faltaFondo)}).
        </div>
      )}
    </div>
  );

  if (paso === 'confirmar') {
    return (
      <ModalShell
        title="Cerrar caja — confirmar envío"
        onClose={closeModal}
        footer={[
          { texto: 'Volver a separar', clase: 'btn-ghost', onClick: () => setPaso('separar'), disabled: enviando },
          { texto: enviando ? 'Enviando…' : `Sí, enviar ${money(envio)} y cerrar`, clase: 'btn-delete', onClick: enviar, disabled: enviando },
        ]}
      >
        <div className={cx(s.callout, s.warn)}>
          ¿Confirmás? <strong>Dejás {money(queda)} en la caja</strong> y va el <strong>sobre de {money(envio)}</strong>{' '}
          con los billetes de abajo. <strong>El turno se cierra</strong>: no se puede reabrir.
        </div>
        <TablaBilletes titulo={`Dejar en caja · ${money(queda)}`} filas={DENOMINACIONES.map((d) => [d, cantDe(billetes, d) - cantDe(envioB, d)])} />
        <TablaBilletes titulo={`Va en el sobre · ${money(envio)}`} filas={DENOMINACIONES.map((d) => [d, cantDe(envioB, d)])} vacio="El sobre va vacío." />
        {resumen}
        {ve && <LoQueTieneQueHaber turno={turno} contado={contado} conto={conto} />}
      </ModalShell>
    );
  }

  if (paso === 'separar') {
    const filas = DENOMINACIONES.filter((d) => cantDe(billetes, d) > 0);
    return (
      <ModalShell
        title="Cerrar caja — separar el sobre"
        wide
        onClose={closeModal}
        footer={[
          { texto: 'Volver a contar', clase: 'btn-ghost', onClick: () => setPaso('contar') },
          { texto: `Continuar: sobre de ${money(envio)}`, clase: 'btn-primary', onClick: aConfirmar, disabled: quedaPoco },
        ]}
      >
        <div className={s.hint}>
          Separá los billetes así: <strong>lo que queda en la caja</strong> (el fondo, con los billetes más chicos para
          el cambio) y <strong>lo que va en el sobre</strong>. Si querés cambiar qué billetes van, usá − y +.
        </div>
        <Table cols={[{ h: 'Billete' }, { h: 'Contaste', num: true }, { h: 'Queda en caja', num: true }, { h: 'Va en el sobre', num: true }]}>
          {filas.map((d) => {
            const sobre = cantDe(envioB, d);
            return (
              <tr key={d}>
                <td className={s.mono}>$ {d.toLocaleString('es-AR')}</td>
                <td className={s.num}>{cantDe(billetes, d)}</td>
                <td className={s.num}><strong>{cantDe(billetes, d) - sobre}</strong></td>
                <td className={s.num}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Btn small onClick={() => ajustarSobre(d, -1)} disabled={sobre <= 0} aria-label={`Uno menos de $${d} en el sobre`}>−</Btn>
                    <strong className={s.mono} style={{ minWidth: 28, textAlign: 'center' }}>{sobre}</strong>
                    <Btn small onClick={() => ajustarSobre(d, 1)} disabled={sobre >= cantDe(billetes, d)} aria-label={`Uno más de $${d} en el sobre`}>+</Btn>
                  </span>
                </td>
              </tr>
            );
          })}
          <tr>
            <td><strong>Total</strong></td>
            <td className={s.num}><strong>{money(contado)}</strong></td>
            <td className={s.num}><strong>{money(queda)}</strong></td>
            <td className={s.num}><strong>{money(envio)}</strong></td>
          </tr>
        </Table>
        <div><Btn small onClick={proponer}>Volver a la separación propuesta</Btn></div>
        {resumen}
        {ve && <LoQueTieneQueHaber turno={turno} contado={contado} conto={conto} />}
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Cerrar caja — contar y enviar"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Separar el sobre', clase: 'btn-primary', onClick: aSeparar, disabled: !conto },
      ]}
    >
      <div className={s.hint}>
        Contá <strong>todo el efectivo del cajón</strong>, billete por billete. Después el sistema te dice
        qué billetes dejar en la caja (el fondo para mañana) y cuáles van en el sobre.
      </div>
      <ConteoBilletes cant={billetes} setCant={setBilletes} />
      {conto && resumen}
      {ve && <LoQueTieneQueHaber turno={turno} contado={contado} conto={conto} />}
    </ModalShell>
  );
}

/** Una tabla de billetes con título y total (dejar en caja / va en el sobre). */
function TablaBilletes({ titulo, filas, vacio = 'Nada.' }) {
  const con = filas.filter(([, n]) => n > 0);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 700, margin: '4px 0' }}>{titulo}</div>
      {con.length ? (
        <Table cols={[{ h: 'Billete' }, { h: 'Cantidad', num: true }, { h: 'Importe', num: true }]}>
          {con.map(([d, n]) => (
            <tr key={d}>
              <td className={s.mono}>$ {d.toLocaleString('es-AR')}</td>
              <td className={s.num}>{n}</td>
              <td className={s.num}>{money(d * n)}</td>
            </tr>
          ))}
        </Table>
      ) : <div className={s.hint} style={{ margin: 0 }}>{vacio}</div>}
    </div>
  );
}

/* ==================================================================== *
 * Después del cierre (0137): lo que el cajero se olvidó de asentar
 * ==================================================================== */

/** La diferencia del cierre con su signo y color: lo que el superadmin viene a arreglar. */
function DifCierre({ v }) {
  const ok = Math.abs(v) < 0.01;
  return <strong className={s.mono} style={{ color: ok ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>{v > 0 ? '+' : ''}{money(v)}</strong>;
}

/**
 * ASENTAR UN MOVIMIENTO OLVIDADO EN UN TURNO CERRADO (pedido del dueño, solo
 * superadmin). Muestra en vivo cómo queda la diferencia del cierre —contado
 * menos esperado: un egreso olvidado baja lo esperado y achica un faltante— y
 * se confirma dos veces. Lo contado y lo enviado no cambian: son la plata que
 * ya se contó.
 */
function MovimientoPosterior({ sesion, onHecho, onCancelar }) {
  const { toast } = useVentas();
  const [tipo, setTipo] = useState('egreso');
  const [importe, setImporte] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const n = Number(importe);
  const valido = Number.isFinite(n) && n > 0;
  const difAntes = Number(sesion.diferencia) || 0;
  const difDespues = valido ? r2(difAntes + (tipo === 'egreso' ? n : -n)) : difAntes;
  const sc = useSegundaConfirmacion(`${tipo}|${importe}|${motivo}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!valido) { setError('Escribí el importe.'); return false; }
      if (motivo.trim().length < 5) { setError('Escribí el motivo: qué fue y quién avisó.'); return false; }
      return true;
    },
    async () => {
      try {
        const r = await ventasApi.movimientoPosterior(sesion.id, { tipo, importe: n, motivo: motivo.trim(), confirmado: true });
        toast(`${tipo === 'egreso' ? 'Egreso' : 'Ingreso'} asentado en el turno #${sesion.id}. Diferencia del cierre: ${money(r.sesion.diferencia)}.`, 'ok');
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <div className={cx(s.callout, s.info)} style={{ display: 'grid', gap: 10 }}>
      <strong>Asentar un movimiento que el cajero no cargó</strong>
      <span className={s.hint} style={{ margin: 0 }}>Queda en este turno marcado «después del cierre», firmado por vos, y el cierre se recalcula. Lo contado y lo enviado no cambian.</span>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Qué fue</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="egreso">Egreso (salió plata del cajón)</option>
            <option value="ingreso">Ingreso (entró plata al cajón)</option>
          </select>
        </div>
        <div className={s.field}>
          <label>Importe <span className={s.req}>*</span></label>
          <input type="number" min="0" step="any" autoFocus value={importe} onChange={(e) => setImporte(e.target.value)} />
        </div>
      </div>
      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input value={motivo} maxLength={300} placeholder="Ej: pago al flete de $5.000; avisó Ale el 6/10" onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div>Diferencia del cierre: <DifCierre v={difAntes} /> → <DifCierre v={difDespues} /></div>
      <AvisoSegundaConfirmacion {...sc}>
        Se asienta un <strong>{tipo}</strong> de <strong>{money(valido ? n : 0)}</strong> en el turno #{sesion.id} y la diferencia pasa a <DifCierre v={difDespues} />.
      </AvisoSegundaConfirmacion>
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn small onClick={onCancelar}>Cancelar</Btn>
        <Btn small variant="btn-primary" onClick={confirmar}>{textoBoton(sc, 'Asentar movimiento', 'Sí, asentar')}</Btn>
      </div>
    </div>
  );
}

/** Anular un movimiento asentado después del cierre: tachado (no se borra) y el cierre vuelve. */
function AnularPosterior({ sesion, mov, onHecho, onCancelar }) {
  const { toast } = useVentas();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const difAntes = Number(sesion.diferencia) || 0;
  const difDespues = r2(difAntes + (mov.tipo === 'egreso' ? -mov.importe : mov.importe));
  const sc = useSegundaConfirmacion(motivo);
  const confirmar = () => sc.clic(
    () => { setError(''); if (motivo.trim().length < 3) { setError('Escribí por qué se anula.'); return false; } return true; },
    async () => {
      try {
        const r = await ventasApi.anularMovimientoPosterior(sesion.id, mov.id, { motivo: motivo.trim() });
        toast(`Movimiento anulado. Diferencia del cierre: ${money(r.sesion.diferencia)}.`, 'ok');
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <div className={cx(s.callout, s.warn)} style={{ display: 'grid', gap: 10 }}>
      <strong>Anular el {mov.tipo} de {money(mov.importe)} («{mov.motivo}»)</strong>
      <span className={s.hint} style={{ margin: 0 }}>Queda tachado a la vista con tu motivo y deja de sumar en el cierre.</span>
      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input value={motivo} maxLength={300} autoFocus placeholder="Ej: lo cargué dos veces" onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div>Diferencia del cierre: <DifCierre v={difAntes} /> → <DifCierre v={difDespues} /></div>
      <AvisoSegundaConfirmacion {...sc}>Se anula y la diferencia vuelve a <DifCierre v={difDespues} />.</AvisoSegundaConfirmacion>
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn small onClick={onCancelar}>Cancelar</Btn>
        <Btn small variant="btn-delete" onClick={confirmar}>{textoBoton(sc, 'Anular', 'Sí, anular')}</Btn>
      </div>
    </div>
  );
}

/**
 * Arqueo de un turno desde el historial. Para el SUPERADMIN, con el turno
 * cerrado: asentar lo que el cajero se olvidó y anular lo asentado así (0137).
 */
export function ArqueoTurnoModal({ cajaSesionId, onChange }) {
  const { closeModal, sucursales, usuarios, ctx, toast } = useVentas();
  const { data: arqueo, loading, error, reload } = useResource(`arqueo-ver:${cajaSesionId}`, () => ventasApi.cajaArqueo(cajaSesionId));
  const esSuperadmin = usuarios.find((u) => u.id === ctx?.usuarioId)?.rolClave === 'superadmin';
  /** null | 'asentar' | { anular: movimiento } */
  const [modo, setModo] = useState(null);
  const corregible = esSuperadmin && arqueo?.sesion?.estado === 'cerrada' && !arqueo?.ciego;
  const hecho = () => { setModo(null); reload(); onChange?.(); };

  const footer = [
    { texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal },
    corregible && !modo && { texto: 'Asentar movimiento olvidado', clase: 'btn-ghost', onClick: () => setModo('asentar') },
    /* Reimprimir SIEMPRE, no solo los turnos cerrados: con el turno abierto el
     * papel sale sin conteo y avisandolo, que es justo lo que se necesita para
     * un control a mitad del dia. Salvo A CIEGAS: el papel del turno abierto
     * lleva el esperado, y el que cuenta no lo tiene que ver. */
    /* El ENVÍO (billetes, fondo y enviado) se reimprime para todos; quien ve
     * el arqueo completo lo saca además con lo que tenía que haber. */
    arqueo?.sesion?.envioEfectivo != null && {
      texto: 'Reimprimir envío',
      clase: 'btn-primary',
      onClick: async () => {
        const ses = arqueo.sesion;
        const nombreDe = (id) => usuarios?.find((u) => u.id === id)?.nombre || '';
        const suc = sucursales.find((x) => x.id === ses.sucursalId);
        const fondoSuc = suc?.fondoCaja != null ? Number(suc.fondoCaja) : null;
        const salio = await imprimirEnvioCaja({
          sesionId: ses.id, cierre: ses.cierre, billetes: ses.billetes, billetesEnvio: ses.billetesEnvio, contado: ses.declaradoEfectivo,
          envio: ses.envioEfectivo, fondoQueda: ses.fondoQueda, fondo: fondoSuc,
          esperadoEfectivo: arqueo.ciego ? null : arqueo.esperadoEfectivo, diferencia: arqueo.ciego ? null : ses.diferencia,
          faltaFondo: fondoSuc != null ? Math.max(0, fondoSuc - (Number(ses.fondoQueda) || 0)) : 0,
        }, {
          moneda: money, fechaHora: fmtFechaHora, sucursal: suc?.nombre || '',
          cajero: nombreDe(ses.usuarioId), usuario: nombreDe(ctx?.usuarioId), reimpresion: true,
        });
        if (!salio) toast('El navegador bloqueó la ventana de impresión.', 'err');
      },
    },
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

      {modo === 'asentar' && <MovimientoPosterior sesion={sesion} onHecho={hecho} onCancelar={() => setModo(null)} />}
      {modo?.anular && <AnularPosterior sesion={sesion} mov={modo.anular} onHecho={hecho} onCancelar={() => setModo(null)} />}

      <DetalleArqueo arqueo={arqueo} onAnularPosterior={corregible ? (m) => setModo({ anular: m }) : undefined} />

      {sesion.observaciones && <div className={s.callout}>{sesion.observaciones}</div>}
    </ModalShell>
  );
}
