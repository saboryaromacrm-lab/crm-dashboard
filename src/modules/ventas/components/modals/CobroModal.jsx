import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi } from '../../services/ventas.api.js';
import { MEDIOS_PAGO, nroComprobante } from '../../domain/constants.js';
import { r2 } from '../../domain/pos.js';
import { Table, Btn, Di, ModalShell, VentaTag, money, fmtFechaHora, s } from '../ui.jsx';
import { configImpresion, imprimirVenta } from '@core/services/imprimir.js';
import p from '../../styles/Pos.module.css';

/**
 * COBRO
 * ============================================================================
 * El último paso del ticket: **confirma el borrador**, no crea una venta nueva.
 * Lo que se emite es exactamente lo último que se guardó del ticket abierto, y
 * recién en ese momento se asigna número y se descuenta stock.
 *
 * Dos formas de cerrar, con su atajo:
 *  - **Liquidar (F10)**: comprobante interno (ticket), siempre al contado.
 *  - **Facturar (F8)**: comprobante fiscal; la letra la resuelve el backend
 *    según la condición de IVA de la empresa y la del cliente. Admite contado o
 *    cuenta corriente.
 *
 * Y dos condiciones de pago que no se mezclan:
 *  - **Contado**: los medios de pago tienen que sumar el total exacto (el
 *    backend lo revalida). El vuelto se calcula aparte, sobre lo que el cliente
 *    entrega en mano; no se guarda porque el cajón neto es el total.
 *  - **Cuenta corriente**: no lleva pagos. El dinero entra después con un
 *    recibo de cobranza, y ahí se imputa a este comprobante.
 *
 * DISEÑO DE CAJA: lo justo para cobrar rápido. El total grande, el foco entra
 * directo en "Con cuánto paga" (Enter cobra; vacío = pagó justo) y el vuelto
 * salta a la vista. El selector Contado/Cta.Cte. solo existe si ESTE cliente
 * tiene cuenta corriente habilitada — si no, toda venta es al contado y no hay
 * nada que elegir. Los medios de pago arrancan en efectivo por el total.
 */
export function CobroModal({ ventaId, totales, clienteId, cajaSesionId, onCobrado }) {
  const { getCliente, config, ctx, closeModal, toast } = useVentas();
  const cliente = getCliente(clienteId);

  const [condicionPago, setCondicionPago] = useState('contado');
  const [pagos, setPagos] = useState(() => [{ medio: 'efectivo', importe: String(totales.total) }]);
  const [entregado, setEntregado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [enviando, setEnviando] = useState(false);

  /*
   * EL REDONDEO DEL COBRO (27/8, venía del sistema viejo): "$39.893 se cobra
   * $39.900" para no pelear el vuelto chico en efectivo — hasta $100 de más y
   * solo hacia arriba. Acá vive el IMPORTE que se suma (los $7); el servidor
   * lo materializa al confirmar como el extra "Redondeo" (IVA 0), así que el
   * ticket impreso lo lista y el total del comprobante da el número redondo
   * EXACTO. Todo lo que se valida y cobra en este modal mira `totalCobrar`.
   */
  const [redondeo, setRedondeo] = useState(0);
  const totalCobrar = r2(totales.total + redondeo);

  /** Los números redondos alcanzables: el próximo $100, $500 y $1.000 hacia
   *  arriba, mientras el salto no pase el tope de $100. Deduplicados (para
   *  $39.920 el próximo 100 y el próximo 1.000 son los mismos $40.000). */
  const sugerencias = useMemo(() => {
    const base = Number(totales.total) || 0;
    const vistos = new Set();
    const out = [];
    for (const esc of [100, 500, 1000]) {
      const objetivo = Math.ceil((base - 0.001) / esc) * esc;
      const delta = r2(objetivo - base);
      if (delta > 0.009 && delta <= 100.009 && !vistos.has(objetivo)) {
        vistos.add(objetivo);
        out.push({ objetivo, delta });
      }
    }
    return out.sort((a, b) => a.objetivo - b.objetivo);
  }, [totales.total]);

  /** Aplica (o quita, con 0) el redondeo y acomoda el pago único al total
   *  nuevo — el caso de caja es "efectivo por el total". Con varios medios no
   *  se toca nada: el aviso de faltante y el botón Resto guían. */
  const aplicarRedondeo = (delta) => {
    setRedondeo(delta);
    setPagos((ps) => (ps.length === 1
      ? [{ ...ps[0], importe: String(r2(totales.total + delta)) }]
      : ps));
  };

  // El foco entra directo en "Con cuánto paga". Diferido porque el focus-trap
  // del Dialog de MUI corre después del montaje y pisa un autoFocus normal.
  const pagaRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => pagaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const ctaCteDisponible = !!config.ctaCteHabilitada && !!cliente?.ctaCteHabilitada;

  // El crédito se consulta solo si el camino de cuenta corriente está en juego.
  const { data: cuenta } = useResource(
    `cobro-cuenta:${clienteId}`,
    () => ventasApi.cuentaCliente(clienteId),
    { enabled: ctaCteDisponible && condicionPago === 'cuenta_corriente' },
  );

  const medios = useMemo(() => {
    const habilitados = (config.mediosPago ?? []).filter((m) => MEDIOS_PAGO[m]);
    return habilitados.length ? habilitados : Object.keys(MEDIOS_PAGO);
  }, [config.mediosPago]);

  const pagado = r2(pagos.reduce((a, x) => a + (Number(x.importe) || 0), 0));
  const faltante = r2(totalCobrar - pagado);

  /**
   * Medios que EXIGEN factura (configuración, 19/8/2026): un peso cobrado con
   * uno de estos bloquea "Liquidar" — la venta sale facturada sí o sí. Solo
   * cuentan los renglones con importe: una transferencia en $0 no obliga.
   * La API lo revalida al confirmar; acá se avisa ANTES de apretar.
   */
  const medioExigeFactura = useMemo(() => {
    if (condicionPago !== 'contado') return null;
    const exigen = config.mediosFacturar ?? [];
    const usado = pagos.find((x) => Number(x.importe) > 0 && exigen.includes(x.medio));
    return usado ? (MEDIOS_PAGO[usado.medio] ?? usado.medio) : null;
  }, [pagos, condicionPago, config.mediosFacturar]);

  const efectivoAsignado = r2(
    pagos.filter((x) => x.medio === 'efectivo').reduce((a, x) => a + (Number(x.importe) || 0), 0),
  );
  const hayEfectivo = efectivoAsignado > 0;
  const vuelto = entregado === '' ? null : r2(Number(entregado) - efectivoAsignado);

  const excedeCredito = useMemo(() => {
    if (condicionPago !== 'cuenta_corriente' || !cuenta || !cliente?.limiteCredito) return false;
    return cuenta.saldo + totales.total > cliente.limiteCredito + 1e-9;
  }, [condicionPago, cuenta, cliente, totales.total]);

  /* ------------------------------- Pagos ------------------------------- */
  const setPago = (i, campo, valor) =>
    setPagos((ps) => ps.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  /** El renglón nuevo arranca con lo que falta: el caso típico es partir el pago. */
  const agregarPago = () => setPagos((ps) => {
    const asignado = r2(ps.reduce((a, x) => a + (Number(x.importe) || 0), 0));
    const resto = Math.max(0, r2(totalCobrar - asignado));
    return [...ps, {
      medio: medios.find((m) => m !== 'efectivo') || medios[0],
      importe: resto > 0 ? String(resto) : '',
    }];
  });
  const quitarPago = (i) => setPagos((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps));
  /** Completa este renglón con lo que falta para llegar al total. */
  const completar = (i) => {
    const otros = r2(pagos.reduce((a, x, j) => (j === i ? a : a + (Number(x.importe) || 0)), 0));
    setPago(i, 'importe', String(Math.max(0, r2(totalCobrar - otros))));
  };
  /** Reparte el total en partes iguales entre los medios cargados. */
  const dividir = () => setPagos((ps) => {
    const parte = r2(totalCobrar / ps.length);
    return ps.map((x, i) => ({
      ...x,
      // El último absorbe el centavo del redondeo para que sume exacto.
      importe: String(i === ps.length - 1 ? r2(totalCobrar - parte * (ps.length - 1)) : parte),
    }));
  });

  /* ------------------------------ Confirmar ------------------------------ */

  /** `tipo`: 'ticket' liquida, 'factura' emite comprobante fiscal. */
  const confirmar = async (tipo) => {
    if (tipo === 'ticket' && condicionPago !== 'contado') {
      toast('Liquidar es al contado. Para cuenta corriente, facturá (F8).', 'err');
      return;
    }
    // El botón nunca es un no-op silencioso: si Liquidar está bloqueado, acá
    // está el porqué (el mismo que muestra el aviso de abajo).
    if (tipo === 'ticket' && medioExigeFactura) {
      toast(`${medioExigeFactura} exige factura: facturá (F8) o cambiá el medio de pago.`, 'err');
      return;
    }
    if (condicionPago === 'contado' && Math.abs(faltante) > 0.01) {
      toast(faltante > 0 ? `Faltan ${money(faltante)}.` : `Sobran ${money(-faltante)}.`, 'err');
      return;
    }
    if (excedeCredito && config.ctaCteBloquearSuperado) {
      toast('Supera el límite de crédito del cliente.', 'err');
      return;
    }
    setEnviando(true);
    try {
      let venta;
      try {
        venta = await ventasApi.confirmarVenta(ventaId, {
          tipo,
          condicionPago,
          cajaSesionId: cajaSesionId ?? undefined,
          usuarioId: ctx.usuarioId ?? undefined,
          observaciones,
          // El importe del redondeo (los $7 de "39.893 → 39.900"): el servidor
          // lo materializa como el extra "Redondeo" y ajusta el total.
          redondeo: condicionPago === 'contado' && redondeo > 0.009 ? redondeo : undefined,
          pagos: condicionPago === 'contado'
            ? pagos.filter((x) => Number(x.importe) > 0).map((x) => ({ medio: x.medio, importe: r2(x.importe) }))
            : [],
        });
      } catch (e1) {
        /*
         * NO LLEGÓ LA RESPUESTA ≠ LA VENTA NO SE HIZO.
         *
         * El cliente corta a los 20 segundos (`timeoutMs`), y facturar llama a
         * ARCA — pedir un ticket de acceso nuevo ya son unos 10. Colgada de los
         * datos del celular, pasarse es normal. Cuando eso ocurre el navegador
         * corta pero **el servidor no se entera y termina la venta igual**, con
         * CAE incluido si alcanzó a pedirlo.
         *
         * Antes acá caía el mismo cartel que un rechazo de verdad ("No se pudo
         * registrar la venta"), así que la cajera no podía distinguir "no
         * salió" de "salió y no me enteré" — y con el cliente enfrente lo
         * natural es rehacerla, que es como se termina con la venta duplicada,
         * el stock descontado dos veces y DOS CAE para la misma compra. La
         * duplicación no era técnica sino humana, inducida por el mensaje.
         *
         * Así que no se adivina: se le PREGUNTA al servidor cómo quedó el
         * ticket. Los tres finales posibles se dicen con todas las letras, y el
         * único que pide acción es el del medio.
         */
        if (!e1?.sinRespuesta) throw e1;
        toast('Se cortó la conexión: averiguando si la venta salió. No toques nada.', 'ok');
        /*
         * SE PREGUNTA VARIAS VECES, no una.
         *
         * Que el navegador haya cortado a los 20 s no quiere decir que el
         * servidor haya terminado: puede seguir esperando a ARCA o a un candado
         * unos segundos más. Preguntando una sola vez se vería "borrador" y se
         * diría "no salió" **justo antes de que salga** — el peor momento
         * posible para mandarla a rehacer la venta.
         *
         * Cuatro intentos cada 2 s. Si igual se le escapa y la cajera rehace el
         * cobro, el candado de `confirmar` en la API es la red de abajo: el
         * segundo cobro se rechaza en vez de duplicar la venta.
         */
        let comoQuedo = null;
        for (let intento = 0; intento < 4; intento += 1) {
          try { comoQuedo = await ventasApi.venta(ventaId); } catch { comoQuedo = null; }
          if (comoQuedo && comoQuedo.estado !== 'borrador') break;
          if (intento < 3) await new Promise((r) => { setTimeout(r, 2000); });
        }

        if (!comoQuedo) {
          // Sigue sin haber conexión: NO sabemos. Es el único caso donde el
          // peor consejo posible sería "volvé a cobrarla".
          toast(
            'Se cortó la conexión y todavía no se puede averiguar si la venta salió. '
            + 'NO la rehagas: buscala en Ventas cuando vuelva internet.',
            'err',
          );
          return;
        }
        if (comoQuedo.estado === 'borrador') {
          toast('Se cortó la conexión y la venta no llegó a registrarse: el ticket sigue abierto, cobralo de nuevo.', 'err');
          return;
        }
        // Estaba hecha. Se sigue con ella como si la respuesta hubiera llegado:
        // imprime el ticket y cierra la venta en pantalla.
        venta = comoQuedo;
        toast('Se cortó la conexión, pero la venta ya se había registrado. Se sigue con esa — no la rehagas.', 'ok');
      }
      /*
       * ARCA CAÍDO ≠ VENTA CAÍDA (0073): si se pidió factura y el servicio no
       * contestó, la venta salió igual como ticket provisorio y quedó en la
       * pestaña Sin facturar. El cajero se entera ACÁ, con el cliente enfrente
       * — el ticket que imprime ya lleva la leyenda.
       */
      if (tipo === 'factura' && venta.facturarPendiente) {
        toast('ARCA no respondió: salió un ticket provisorio y la venta quedó en Ventas › Sin facturar para reintentarla.', 'err');
      }
      // Ticket automático (se apaga en Sistema › Impresión). El último queda
      // guardado para "Reimprimir" desde la registradora.
      try { localStorage.setItem('crm_ultimo_ticket', String(venta.id)); } catch { /* privado */ }
      /*
       * DE ACÁ EN ADELANTE LA VENTA YA ESTÁ HECHA, y lo que falla es el papel.
       *
       * `configImpresion()` es OTRA llamada HTTP: con la conexión colgada del
       * celular puede fallar sola, después de una venta perfectamente
       * registrada. Antes eso caía en el `catch` de abajo y sacaba "No se pudo
       * registrar la venta" — mentira, y la misma mentira que se acaba de
       * arreglar arriba: la cajera la rehacía. Un problema de impresora no
       * puede parecerse a una venta fallada.
       *
       * Con CAE sale la FACTURA (con su QR) y no el ticket: `imprimirVenta`
       * decide, para que las tres pantallas que sacan papel coincidan.
       */
      try {
        const { impresion } = await configImpresion();
        if (impresion.imprimirTicketAlCobrar) {
          await imprimirVenta(venta, { moneda: money, fechaHora: fmtFechaHora });
        }
      } catch {
        toast('La venta se registró bien, pero no se pudo imprimir: reimprimila desde Ventas.', 'err');
      }
      onCobrado(venta, vuelto && vuelto > 0 ? vuelto : 0);
    } catch (e) {
      toast(e?.data?.message || 'No se pudo registrar la venta.', 'err');
    } finally {
      setEnviando(false);
    }
  };

  const pagosOk = condicionPago === 'cuenta_corriente'
    ? !(excedeCredito && config.ctaCteBloquearSuperado)
    : Math.abs(faltante) <= 0.01;
  const puedeLiquidar = pagosOk && condicionPago === 'contado' && !medioExigeFactura && !enviando;
  const puedeFacturar = pagosOk && !enviando;

  /* ------------------------------ Atajos ------------------------------ */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F10') { e.preventDefault(); if (puedeLiquidar) confirmar('ticket'); }
      else if (e.key === 'F8') { e.preventDefault(); if (puedeFacturar) confirmar('factura'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeLiquidar, puedeFacturar, condicionPago, pagos, observaciones, vuelto, redondeo]);

  return (
    <ModalShell
      title="Cobrar"
      muted
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        // Los botones nunca son un no-op silencioso: si no se puede cerrar,
        // `confirmar` avisa POR QUÉ (falta plata, es cta. cte., excede crédito).
        {
          texto: enviando ? 'Registrando…' : 'Facturar · F8',
          clase: puedeFacturar ? 'btn-ingreso' : 'btn-ghost',
          onClick: () => confirmar('factura'),
        },
        {
          texto: enviando ? 'Registrando…' : `Liquidar ${money(totalCobrar)} · F10`,
          clase: puedeLiquidar ? 'btn-primary' : 'btn-ghost',
          onClick: () => confirmar('ticket'),
        },
      ]}
    >
      <div className={p.cobroTotal}>
        <span className={p.cobroTotalLabel}>Total</span>
        <span className={p.cobroTotalValor}>{money(totalCobrar)}</span>
      </div>

      {/* EL REDONDEO, pegado al total porque ES del total: los números redondos
          alcanzables con hasta $100 de más, a un clic. Aplicado, se dice cuánto
          se sumó y se puede quitar — el papel va a listar "Redondeo". */}
      {condicionPago === 'contado' && (redondeo > 0.009 ? (
        <div className={s.hint} style={{ margin: '0 0 var(--crm-space-3)', textAlign: 'center' }}>
          Redondeado: el ticket sale de {money(totales.total)} y se cobra{' '}
          <strong>+{money(redondeo)}</strong>{' '}
          <button type="button" className={s.linkBtn} onClick={() => aplicarRedondeo(0)}>quitar</button>
        </div>
      ) : sugerencias.length > 0 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--crm-space-3)' }}>
          {sugerencias.map((sug) => (
            <Btn key={sug.objetivo} small onClick={() => aplicarRedondeo(sug.delta)}>
              Redondear a {money(sug.objetivo)} (+{money(sug.delta)})
            </Btn>
          ))}
        </div>
      ))}

      {/* El selector solo existe cuando hay algo que elegir: cliente con cta. cte. */}
      {ctaCteDisponible && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--crm-space-3)' }}>
          <Btn
            variant={condicionPago === 'contado' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setCondicionPago('contado')}
          >
            Contado
          </Btn>
          <Btn
            variant={condicionPago === 'cuenta_corriente' ? 'btn-primary' : 'btn-ghost'}
            // En cta. cte. no hay vuelto que simplificar: el redondeo se apaga
            // y el comprobante va por su total exacto (la API también lo corta).
            onClick={() => { setCondicionPago('cuenta_corriente'); aplicarRedondeo(0); }}
          >
            Cuenta corriente
          </Btn>
        </div>
      )}

      {condicionPago === 'cuenta_corriente' ? (
        <>
          {cuenta && (
            <div className={s['detalle-grid']}>
              <Di label="Saldo actual">{money(cuenta.saldo)}</Di>
              <Di label="Con esta venta">{money(cuenta.saldo + totales.total)}</Di>
              <Di label="Límite">{cliente?.limiteCredito > 0 ? money(cliente.limiteCredito) : 'Sin tope'}</Di>
            </div>
          )}
          {excedeCredito && (
            <div className={cx(s.callout, s.warn)}>
              Esta venta <strong>supera el límite de crédito</strong> de {cliente?.nombre}.
              {config.ctaCteBloquearSuperado
                ? ' Con el bloqueo activo no se puede confirmar: cobrala al contado o pedí una cobranza.'
                : ' El bloqueo está desactivado, así que se puede confirmar igual.'}
            </div>
          )}
          <div className={s.callout}>
            No se cobra ahora: el comprobante queda impago y se salda con un recibo de cobranza.
          </div>
        </>
      ) : (
        <>
          {/* Lo primero que toca el cajero: qué le entregan. Vacío = pagó justo,
              y el placeholder muestra ESE importe (el efectivo del ticket) en
              gris: se lee el número sin tipear nada, y se puede escribir encima. */}
          {hayEfectivo && (
            <>
              <div className={cx(s.field, p.pagaGrande)}>
                <label>Con cuánto paga</label>
                <input
                  ref={pagaRef}
                  type="number" min="0" step="100"
                  placeholder={money(efectivoAsignado)}
                  value={entregado}
                  onChange={(e) => setEntregado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && puedeLiquidar) { e.preventDefault(); confirmar('ticket'); }
                  }}
                />
              </div>
              {vuelto !== null && (
                <div className={cx(p.vuelto, vuelto < 0 && p.faltante)}>
                  <span>{vuelto < 0 ? 'Falta que entregue' : 'Vuelto'}</span>
                  <span className={p.vueltoValor}>{money(Math.abs(vuelto))}</span>
                </div>
              )}
            </>
          )}

          <div className={s['section-title']}>Medios de pago</div>
          {pagos.map((x, i) => (
            <div key={i} className={p.pagoFila}>
              <div className={s.field} style={{ marginBottom: 0 }}>
                {i === 0 && <label>Medio</label>}
                <select value={x.medio} onChange={(e) => setPago(i, 'medio', e.target.value)}>
                  {medios.map((m) => <option key={m} value={m}>{MEDIOS_PAGO[m]}</option>)}
                </select>
              </div>
              <div className={s.field} style={{ marginBottom: 0 }}>
                {i === 0 && <label>Importe</label>}
                <input
                  type="number" min="0" step="0.01"
                  value={x.importe}
                  onChange={(e) => setPago(i, 'importe', e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn small onClick={() => completar(i)}>Resto</Btn>
                <Btn variant="btn-delete" small onClick={() => quitarPago(i)} disabled={pagos.length === 1}>×</Btn>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn small onClick={agregarPago}>+ Otro medio</Btn>
            {pagos.length > 1 && <Btn small onClick={dividir}>Partes iguales</Btn>}
          </div>

          {/* El aviso del medio que obliga a facturar: aparece apenas se elige,
              no cuando el Liquidar rebota. */}
          {medioExigeFactura && (
            <div className={cx(s.callout, s.warn)} style={{ marginTop: 'var(--crm-space-3)' }}>
              <strong>{medioExigeFactura} exige factura.</strong> Esta venta no puede salir como
              ticket: se factura (F8) o se cobra con otro medio.
            </div>
          )}

          {/* Solo habla cuando algo está mal; si los pagos suman justo, silencio. */}
          {Math.abs(faltante) > 0.01 && (
            <div className={cx(s.callout, s.warn)} style={{ marginTop: 'var(--crm-space-3)' }}>
              {faltante > 0
                ? <>Falta asignar <strong>{money(faltante)}</strong> (asignado {money(pagado)} de {money(totales.total)}).</>
                : <>Los medios suman <strong>{money(-faltante)}</strong> de más.</>}
            </div>
          )}
        </>
      )}

      <div className={s.field} style={{ marginTop: 'var(--crm-space-3)' }}>
        <label>Observaciones</label>
        <input value={observaciones} placeholder="Opcional" onChange={(e) => setObservaciones(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Comprobante emitido
 * ==================================================================== */

/**
 * Confirmación posterior a la venta: qué se emitió y cuánto vuelto dar.
 * Los nombres salen de los renglones del ticket (la venta guarda ids), así que
 * el cajero lee lo mismo que acabó de cargar.
 */
export function VentaEmitidaModal({ venta, vuelto = 0, renglones = [], onNuevoTicket }) {
  const { closeModal, getCliente } = useVentas();
  const cliente = getCliente(venta.clienteId);

  const nombreDe = (it) => {
    const r = renglones.find(
      (x) => x.productoId === it.productoId && (x.presentacionId ?? null) === (it.presentacionId ?? null),
    );
    return r ? `${r.nombre} · ${r.detalle}` : `Producto #${it.productoId}`;
  };

  const cerrar = () => { closeModal(); onNuevoTicket?.(); };

  return (
    <ModalShell
      title="Venta registrada"
      wide
      onClose={cerrar}
      footer={[
        { texto: 'Imprimir', clase: 'btn-ghost', onClick: () => window.print() },
        { texto: 'Nuevo ticket', clase: 'btn-primary', onClick: cerrar },
      ]}
    >
      {vuelto > 0 && (
        <div className={p.vuelto} style={{ marginBottom: 'var(--crm-space-4)' }}>
          <span>Vuelto a entregar</span>
          <span className={p.vueltoValor}>{money(vuelto)}</span>
        </div>
      )}

      <div className={s['detalle-grid']}>
        <Di label="Comprobante"><VentaTag tipo={venta.tipo} /> <span className={s.mono}>{nroComprobante(venta)}</span></Di>
        <Di label="Cliente">{cliente?.nombre || '—'}</Di>
        <Di label="Condición">{venta.condicionPago === 'contado' ? 'Contado' : 'Cuenta corriente'}</Di>
      </div>

      <Table
        cols={[{ h: 'Artículo' }, { h: 'Cant.', num: true }, { h: 'Precio', num: true }, { h: 'Subtotal', num: true }]}
      >
        {venta.items.map((it) => (
          <tr key={it.id}>
            <td>{nombreDe(it)}</td>
            <td className={s.num}>{it.cantidad}</td>
            <td className={s.num}>{money(it.precioUnitario)}</td>
            <td className={s.num}>{money(it.subtotal)}</td>
          </tr>
        ))}
        {/* Los extras (envío, packaging, el Redondeo del cobro): sin ellos el
            total de abajo no se explicaba con las filas de arriba. Importe
            neto, igual que el subtotal de los renglones. */}
        {(venta.extras ?? []).map((e) => (
          <tr key={`extra-${e.id}`}>
            <td>{e.concepto}</td>
            <td className={s.num}>—</td>
            <td className={s.num}>—</td>
            <td className={s.num}>{money(e.importe)}</td>
          </tr>
        ))}
      </Table>

      <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-3)' }}>
        <Di label="Neto">{money(venta.subtotalNeto)}</Di>
        <Di label="IVA">{money(venta.ivaTotal)}</Di>
        <Di label="Total"><strong style={{ fontSize: 20 }}>{money(venta.total)}</strong></Di>
      </div>
    </ModalShell>
  );
}
