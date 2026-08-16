import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../../context/GastosContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { errorMsg, gastosApi } from '../../services/gastos.api.js';
import {
  MEDIOS_PAGO, TIPOS_DOC_GASTO, hoyISO, r2, nombreProveedor,
} from '../../domain/constants.js';
import {
  Table, Btn, Di, ModalShell, GastoEstadoPill, Saldo, money, fmtFecha, fmtFechaHora, s,
} from '../ui.jsx';

/* ==================================================================== *
 * Alta y edición del gasto
 * ==================================================================== */

/**
 * Carga de un comprobante de gasto.
 *
 * El total se arma como neto + IVA + otros y se muestra en vivo: es el número
 * que el usuario está mirando en el papel, y si no coincide algo se cargó mal.
 *
 * Si el proveedor elegido tiene pagos a cuenta sin aplicar —el caso de la
 * cajera que ya le pagó— se avisa acá mismo y al guardar se ofrece aplicarlos.
 */
export function GastoFormModal({ gastoId, onChange }) {
  const {
    categoriasActivas, proveedores, sucursales, ctx, esJefe, closeModal, toast,
    nombreSucursal, recargarContadores,
  } = useGastos();
  const editando = !!gastoId;

  const { data: original, loading } = useResource(
    `gasto-form:${gastoId ?? 'nuevo'}`,
    () => gastosApi.gasto(gastoId),
    { enabled: editando },
  );

  /*
   * EL FORMULARIO SIMPLE (0067, pedido del dueño): sin "anotalo a mano", sin
   * "descripción", sin "negocio". El gasto se carga como se lee del papel:
   * CONCEPTOS con su monto final, y el total es la suma. `iva` quedó como el
   * "IVA incluido" opcional de la factura A — informativo, no cambia el total.
   * Los campos que se fueron siguen en la base (gastos viejos, fijos
   * generados): solo dejaron de pedirse acá.
   */
  const [f, setF] = useState({
    fecha: hoyISO(),
    tipoDoc: 'factura',
    letra: 'B',
    numero: '',
    proveedorId: '',
    categoriaId: '',
    sucursalId: '',
    condicionPago: 'contado',
    vencimiento: '',
    iva: '',
    observaciones: '',
  });
  /** Los renglones: concepto + monto final. Siempre queda al menos una fila. */
  const [items, setItems] = useState([{ concepto: '', monto: '' }]);

  useEffect(() => {
    if (!original) return;
    setF({
      fecha: String(original.fecha).slice(0, 10),
      tipoDoc: original.tipoDoc,
      letra: original.letra,
      numero: original.numero ?? '',
      proveedorId: original.proveedorId ?? '',
      categoriaId: original.categoriaId ?? '',
      sucursalId: original.sucursalId ?? '',
      condicionPago: original.condicionPago,
      vencimiento: original.vencimiento ? String(original.vencimiento).slice(0, 10) : '',
      iva: original.iva || '',
      observaciones: original.observaciones ?? '',
    });
    /* Un gasto viejo no tiene renglones: se le arma UNO con su descripción y
     * su total, así editarlo lo migra al formato nuevo sin perder nada. */
    setItems(original.items?.length
      ? original.items.map((i) => ({ concepto: i.concepto, monto: String(i.monto) }))
      : [{ concepto: original.descripcion || 'Gasto', monto: String(original.total || '') }]);
  }, [original]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setItem = (i, k) => (e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  const filasValidas = items.filter((i) => i.concepto.trim() && Number(i.monto) > 0);
  const total = r2(filasValidas.reduce((a, i) => a + Number(i.monto), 0));

  /**
   * LA LETRA VIENE DEL PROVEEDOR. Al elegirlo, si su ficha dice qué letra
   * factura, se precarga — y queda editable, porque la excepción existe. Se
   * pisa solo al CAMBIAR de proveedor: corregirla a mano después vale.
   */
  const alElegirProveedor = (e) => {
    const id = e.target.value;
    const p = proveedores.find((x) => x.id === Number(id));
    setF((x) => ({ ...x, proveedorId: id, ...(p?.letraGasto ? { letra: p.letraGasto } : {}) }));
  };

  // "Lo pagué y lo cargo": el caso más común de todos. Se registra el pago
  // junto con el gasto en vez de obligar a un segundo paso.
  const [pagaAhora, setPagaAhora] = useState(false);
  const [medioPago, setMedioPago] = useState('efectivo');
  const [desdeCaja, setDesdeCaja] = useState(true);
  const { data: caja } = useResource(
    `caja-gasto:${ctx.sucursalId}`,
    () => gastosApi.cajaActual(ctx.sucursalId),
    { enabled: !editando && !!ctx.sucursalId },
  );
  const hayTurno = !!caja?.id && caja.estado === 'abierta';
  const saleDeCaja = pagaAhora && medioPago === 'efectivo' && hayTurno && desdeCaja;

  // Pagos a cuenta del proveedor elegido: el aviso que cierra el circuito.
  const { data: disponibles } = useResource(
    `disp:${f.proveedorId}`,
    () => gastosApi.disponibles(Number(f.proveedorId)),
    { enabled: !!f.proveedorId && !editando },
  );
  /**
   * Pagos a cuenta OFRECIDOS: solo los de la sucursal del gasto — misma regla
   * que la factura de Compras. Un gasto de "toda la empresa" ve todos. Tomarlos
   * acá, en el alta, es lo que los APLICA; con tilde, porque tomar es una
   * decisión (este gasto pudo pagarse por otro lado y el pago que espera ser
   * de otro comprobante).
   */
  /*
   * La sucursal EFECTIVA del gasto. Para el jefe es la que eligió; para el
   * resto es la de su sesión, porque el servidor la clava ahí igual. Importa
   * más de lo que parece: de esto depende qué pagos a cuenta se ofrecen, y un
   * pago de otra sucursal la API ya no lo acepta.
   */
  const sucursalGasto = esJefe ? (Number(f.sucursalId) || 0) : (ctx.sucursalId ?? 0);

  const pagosOfrecidos = useMemo(() => {
    const sid = sucursalGasto;
    return (disponibles ?? [])
      .filter((p) => !sid || p.sucursalId === sid)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);
  }, [disponibles, sucursalGasto]);
  const aCuenta = useMemo(() => pagosOfrecidos.reduce((a, p) => a + p.saldo, 0), [pagosOfrecidos]);
  const aCuentaOtras = useMemo(
    () => r2((disponibles ?? []).reduce((a, p) => a + p.saldo, 0) - aCuenta),
    [disponibles, aCuenta],
  );

  /** Cuánto se toma de cada pago: { [pagoId]: '5000' }. Sin tilde no se toma. */
  const [tomados, setTomados] = useState({});
  const totalTomado = useMemo(
    () => Object.values(tomados).reduce((a, v) => a + (Number(v) || 0), 0),
    [tomados],
  );
  /** Lo que queda por cubrir después de los pagos tomados. */
  const resto = r2(Math.max(0, total - totalTomado));
  const toggleTomar = (p) => setTomados((m) => {
    if (m[p.id] != null) {
      const sinEl = { ...m };
      delete sinEl[p.id];
      return sinEl;
    }
    const yaTomado = Object.values(m).reduce((a, v) => a + (Number(v) || 0), 0);
    const falta = Math.max(0, r2(total - yaTomado));
    return { ...m, [p.id]: String(r2(Math.min(falta, p.saldo))) };
  });
  // Cambiar de proveedor o de sucursal cambia la bandeja ofrecida: lo tildado
  // hablaba de otra.
  useEffect(() => { setTomados({}); }, [f.proveedorId, sucursalGasto]);

  /**
   * Doble submit. El alta puede crear un gasto Y un egreso de caja, y el guard
   * de duplicado del servidor se rinde justo en el caso más común de este
   * módulo —"if (!proveedorId || !numero) return"—, que es el ticket de nafta o
   * la changa: sin número, no hay con qué comparar. Así que la única barrera
   * real es esta: mientras la petición vuela, el botón se apaga.
   */
  const [guardando, setGuardando] = useState(false);

  /** Con pagos registrados solo se tocan los campos descriptivos (lo dice el cartel). */
  const bloqueado = editando && original?.pagado > 0.009;

  const guardar = async () => {
    if (guardando) return;
    if (!f.categoriaId) { toast('Elegí el rubro al que se imputa.', 'err'); return; }
    if (!filasValidas.length) { toast('Cargá al menos un concepto con su monto.', 'err'); return; }
    if (!(total > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    if (Number(f.iva || 0) > total + 0.009) {
      toast('El IVA incluido no puede superar el total.', 'err');
      return;
    }
    // No se puede tomar más de lo que dice el gasto: sería inventar plata.
    if (totalTomado - total > 0.009) {
      toast(`Estás tomando ${money(r2(totalTomado - total))} más de lo que dice el gasto.`, 'err');
      return;
    }
    const tomas = pagosOfrecidos
      .map((p) => ({ pagoId: p.id, importe: r2(tomados[p.id]) }))
      .filter((t) => t.importe > 0.009);

    const payload = {
      categoriaId: Number(f.categoriaId),
      vencimiento: f.vencimiento || undefined,
      observaciones: f.observaciones.trim(),
      usuarioId: ctx.usuarioId ?? undefined,
      /*
       * LA SUCURSAL SOLO SE MANDA SI EL JEFE PUEDE ELEGIRLA. Para el resto es
       * un campo de solo lectura, y mandarlo no agrega nada. Va `null` —y no
       * `undefined`— cuando eligió "Toda la empresa": son cosas distintas del
       * lado del servidor, que solo toca el campo si viene, y con `undefined`
       * el jefe no podía sacarle la sucursal a un gasto nunca más.
       */
      ...(esJefe ? { sucursalId: sucursalGasto || null } : {}),
      /*
       * LOS CAMPOS QUE EL GASTO PAGADO TIENE BLOQUEADOS NO VIAJAN. El servidor
       * rechaza la edición entera si llega cualquiera de ellos con pagos
       * registrados —importes, número, proveedor—, y como esto los mandaba
       * SIEMPRE, la promesa del cartel de arriba ("con pagos podés cambiar el
       * rubro, la descripción, el vencimiento y las observaciones") era falsa:
       * ninguna edición pasaba, todas volvían con el mismo 400.
       */
      ...(bloqueado ? {} : {
        fecha: f.fecha || undefined,
        tipoDoc: f.tipoDoc,
        letra: f.letra,
        numero: f.numero.trim(),
        proveedorId: f.proveedorId ? Number(f.proveedorId) : undefined,
        condicionPago: f.condicionPago,
        /* Los RENGLONES mandan (0067): el servidor suma el total, acota el IVA
         * incluido y arma la descripción con los conceptos. */
        items: filasValidas.map((i) => ({ concepto: i.concepto.trim(), monto: r2(i.monto) })),
        iva: r2(f.iva),
      }),
      // "Se paga ahora" cubre EL RESTO: lo que los pagos tomados no explican.
      ...(pagaAhora && !editando && resto > 0.009
        ? {
          pagoInmediato: {
            importe: resto,
            medio: medioPago,
            fecha: f.fecha || undefined,
            cajaSesionId: saleDeCaja ? caja.id : undefined,
            // Sin `usuarioId`: el pago del gasto lo firma el mismo que carga el
            // gasto, y el servidor toma el del nivel de arriba a propósito.
          },
        }
        : {}),
    };

    /*
     * Guardado en dos tiempos, a mano (sin `act`): primero el gasto, después
     * las tomas — necesitan su id. Si una toma falla, el gasto YA quedó
     * cargado (correcto y auditable): se avisa y no se sigue aplicando a
     * ciegas; el resto queda en la bandeja.
     */
    let res;
    setGuardando(true);
    try {
      res = editando ? await gastosApi.editarGasto(gastoId, payload) : await gastosApi.crearGasto(payload);
    } catch (e) {
      setGuardando(false);
      toast(errorMsg(e), 'err');
      return;
    }

    let falloToma = false;
    let aplicados = 0;
    for (const t of tomas) {
      if (editando) break; // las tomas son solo del alta
      try {
        await gastosApi.aplicarPagoAGasto(res.id, { ...t, usuarioId: ctx.usuarioId ?? undefined });
        aplicados += 1;
      } catch (e) {
        falloToma = true;
        toast(`El gasto quedó cargado, pero un pago no se pudo aplicar: ${errorMsg(e)}`, 'err');
        break;
      }
    }
    await recargarContadores();
    closeModal();
    if (!falloToma) {
      toast(
        editando
          ? 'Gasto actualizado.'
          : aplicados
            ? `Gasto cargado · ${aplicados} pago(s) de sucursal aplicado(s).`
            : 'Gasto cargado.',
        'ok',
      );
    }
    onChange?.();
  };

  if (editando && loading) {
    return (
      <ModalShell title="Editar gasto" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={s['empty-state']}>Cargando…</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={editando ? `Editar gasto #${gastoId}` : 'Cargar gasto'}
      subtitle="Lo que la empresa paga y no es mercadería"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: guardando ? 'Guardando…' : (editando ? 'Guardar' : 'Cargar gasto'),
          clase: 'btn-primary',
          onClick: guardar,
          disabled: guardando,
        },
      ]}
    >
      {bloqueado && (
        <div className={cx(s.callout, s.warn)}>
          Este gasto ya tiene pagos aplicados: solo se pueden cambiar el rubro, la descripción,
          el vencimiento y las observaciones. Para tocar los importes, quitá antes el pago.
        </div>
      )}

      <div className={s['section-title']}>Comprobante</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Fecha del comprobante</label>
          <input type="date" value={f.fecha} onChange={set('fecha')} disabled={bloqueado} />
        </div>
        <div className={s.field}>
          <label>Tipo</label>
          <select value={f.tipoDoc} onChange={set('tipoDoc')} disabled={bloqueado}>
            {Object.entries(TIPOS_DOC_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Letra</label>
          <select value={f.letra} onChange={set('letra')} disabled={bloqueado}>
            {['A', 'B', 'C', 'X'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Número</label>
          <input
            value={f.numero}
            placeholder="0002-00013456"
            onChange={set('numero')}
            disabled={bloqueado}
          />
        </div>
      </div>

      {/* Sin "Quién y de qué", sin "anotalo a mano", sin "negocio" y sin
          "descripción" (0067, pedido del dueño): quedaron las tres decisiones
          reales — proveedor, rubro y sucursal — y los CONCEPTOS de abajo
          cuentan la historia que antes iba en texto libre. */}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Proveedor</label>
          {/* Solo los de GASTOS: a los de mercadería se les carga factura en
              Compras. Elegirlo precarga la LETRA de arriba con la de su ficha
              (editable — la excepción existe). */}
          <select value={f.proveedorId} onChange={alElegirProveedor} disabled={bloqueado}>
            <option value="">Sin proveedor del padrón</option>
            {proveedores
              .filter((p) => p.proveeGastos || p.id === Number(f.proveedorId))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.letraGasto ? ` · factura ${p.letraGasto}` : ''}{p.proveeGastos ? '' : ' (mercadería)'}
                </option>
              ))}
          </select>
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            ¿Falta uno? Tildale «provee gastos» en Proveedores — y ahí se le define qué factura hace.
          </div>
        </div>
        <div className={s.field}>
          <label>Rubro <span className={s.req}>*</span></label>
          <select value={f.categoriaId} onChange={set('categoriaId')}>
            <option value="">Elegí el rubro</option>
            {categoriasActivas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Sucursal</label>
          {/* Imputarle un gasto a OTRA sucursal es cosa de administración: define
              el resumen por sucursal y, sobre todo, qué pagos lo pueden
              explicar. El servidor decide lo mismo — esto es para no ofrecer una
              opción que la API va a corregir por atrás. */}
          {esJefe ? (
            <select value={f.sucursalId} onChange={set('sucursalId')}>
              <option value="">General (toda la empresa)</option>
              {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          ) : (
            <>
              <input value={nombreSucursal(ctx.sucursalId)} disabled />
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                El gasto se imputa a la sucursal con la que entraste.
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Los renglones: concepto + monto, como se lee del papel ---- */}
      <div className={s['section-title']}>Conceptos</div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <input
            value={it.concepto}
            placeholder={i === 0 ? 'Ej: factura de luz de julio' : 'Otro concepto…'}
            onChange={setItem(i, 'concepto')}
            disabled={bloqueado}
            style={{ flex: 1 }}
          />
          <input
            type="number" min="0" step="0.01"
            value={it.monto}
            placeholder="Monto"
            onChange={setItem(i, 'monto')}
            disabled={bloqueado}
            style={{ width: 130, textAlign: 'right' }}
          />
          {!bloqueado && items.length > 1 && (
            <Btn small onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>×</Btn>
          )}
        </div>
      ))}
      {!bloqueado && (
        <div style={{ marginBottom: 4 }}>
          <Btn small onClick={() => setItems((xs) => [...xs, { concepto: '', monto: '' }])}>
            + Agregar concepto
          </Btn>
        </div>
      )}

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>IVA incluido (si la factura lo discrimina)</label>
          <input
            type="number" min="0" step="0.01" value={f.iva} onChange={set('iva')}
            placeholder="Opcional" disabled={bloqueado}
          />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Informativo: no cambia el total, ya está adentro de los montos.
          </div>
        </div>
        <div className={s.field}>
          <label>Total</label>
          <input value={money(total)} readOnly tabIndex={-1} />
        </div>
      </div>

      {/* ---- Tomar pagos a cuenta: la puerta del caso "la cajera ya pagó" ---- */}
      {!editando && !!f.proveedorId && (pagosOfrecidos.length > 0 || aCuentaOtras > 0.009) && (
        <>
          <div className={s['section-title']}>Pagos a cuenta del proveedor</div>
          {pagosOfrecidos.length > 0 && (
            <>
              <div className={cx(s.callout, s.info)}>
                Hay <strong>{money(aCuenta)}</strong> pagados
                {sucursalGasto ? ` desde ${nombreSucursal(sucursalGasto)}` : ''} y sin
                aplicar. Tildá los que este gasto explica: tomarlos es lo que los{' '}
                <strong>aplica</strong> — no vuelve a mover plata. Si este gasto se pagó por otro
                lado, no tildes nada.
              </div>
              <Table
                cols={[
                  { h: 'Tomar' }, { h: 'Pago' }, { h: 'Origen' },
                  { h: 'Disponible', num: true }, { h: 'Importe a tomar', num: true },
                ]}
              >
                {pagosOfrecidos.map((p) => {
                  const tomado = tomados[p.id] != null;
                  return (
                    <tr key={p.id}>
                      <td style={{ width: 60 }}>
                        <input
                          type="checkbox"
                          checked={tomado}
                          aria-label={`Tomar el pago del ${fmtFecha(p.fecha)}`}
                          onChange={() => toggleTomar(p)}
                        />
                      </td>
                      <td>
                        {fmtFechaHora(p.fecha)}
                        {p.concepto && <div className={s.hint} style={{ margin: 0 }}>{p.concepto}</div>}
                      </td>
                      <td>
                        {p.sucursalNombre || <span className={s.muted}>—</span>}
                        {p.cajaSesionId && (
                          <div className={s.hint} style={{ margin: 0 }}>
                            turno #{p.cajaSesionId}{p.usuarioNombre ? ` · ${p.usuarioNombre}` : ''}
                          </div>
                        )}
                      </td>
                      <td className={s.num}>{money(p.saldo)}</td>
                      <td className={s.num}>
                        {tomado ? (
                          <input
                            type="number" min="0" step="0.01" style={{ maxWidth: 130 }}
                            placeholder="0,00"
                            value={tomados[p.id]}
                            onChange={(e) => setTomados((m) => ({ ...m, [p.id]: e.target.value }))}
                          />
                        ) : (
                          <span className={s.muted}>sin tomar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </>
          )}
          {aCuentaOtras > 0.009 && (
            <div className={s.hint}>
              El proveedor tiene además <strong>{money(aCuentaOtras)}</strong> pagados desde otras
              sucursales. Acá no se ofrecen: se aplican a gastos de la sucursal que pagó (o sin
              sucursal).
            </div>
          )}
        </>
      )}

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Condición</label>
          <select value={f.condicionPago} onChange={set('condicionPago')} disabled={bloqueado}>
            <option value="contado">Contado</option>
            <option value="cuenta_corriente">Cuenta corriente</option>
          </select>
        </div>
        <div className={s.field}>
          <label>Vence el</label>
          <input type="date" value={f.vencimiento} onChange={set('vencimiento')} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Sin vencimiento no aparece en Cuentas a pagar como atrasado.
          </div>
        </div>
      </div>

      <div className={s.field}>
        <label>Observaciones</label>
        <input value={f.observaciones} placeholder="Opcional" onChange={set('observaciones')} />
      </div>

      {/* "¿Ya está pagado?" cubre EL RESTO — desaparece si los pagos tomados
          ya saldan el gasto. */}
      {!editando && resto > 0.009 && (
        <>
          <div className={s['section-title']}>{totalTomado > 0.009 ? '¿El resto ya está pagado?' : '¿Ya está pagado?'}</div>
          <div className={s.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={pagaAhora} onChange={(e) => setPagaAhora(e.target.checked)} />
              Sí, se pagó al recibirlo — registrar el pago junto con el gasto
            </label>
          </div>

          {pagaAhora && (
            <div className={s['form-grid']}>
              <div className={s.field}>
                <label>Medio</label>
                <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                  {Object.entries(MEDIOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label>Importe del pago</label>
                <input value={money(resto)} readOnly tabIndex={-1} />
                <div className={s.hint} style={{ margin: '6px 0 0' }}>
                  {totalTomado > 0.009
                    ? 'Lo que los pagos tomados no cubren. Para pagar en partes, cargá el gasto y usá "Pagar".'
                    : 'Se paga el total. Para pagar en partes, cargá el gasto y usá "Pagar".'}
                </div>
              </div>
              {medioPago === 'efectivo' && (
                <div className={s.field}>
                  <label>Caja</label>
                  {hayTurno ? (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={desdeCaja} onChange={(e) => setDesdeCaja(e.target.checked)} />
                        Sale del turno #{caja.id}
                      </label>
                      <div className={s.hint} style={{ margin: '6px 0 0' }}>
                        Queda el egreso y el arqueo lo va a mostrar.
                      </div>
                    </>
                  ) : (
                    <div className={s.hint} style={{ margin: 0 }}>
                      No hay turno abierto en tu sucursal: no impacta en ningún arqueo.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* La cuenta a la vista, como en la factura de Compras. */}
      {!editando && total > 0 && (totalTomado > 0.009 || pagaAhora) && (
        <div
          className={cx(s.callout, totalTomado - total > 0.009 ? s.warn : s.ok)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <span>
            Total {money(total)} − tomado {money(totalTomado)} − ahora {money(pagaAhora && resto > 0.009 ? resto : 0)}
          </span>
          <strong style={{ fontSize: 16 }}>
            {totalTomado - total > 0.009
              ? `Te pasaste por ${money(r2(totalTomado - total))}`
              : (pagaAhora || resto <= 0.009)
                ? 'Queda saldado'
                : `Queda debiendo ${money(resto)}`}
          </strong>
        </div>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Detalle
 * ==================================================================== */

export function DetalleGastoModal({ gastoId, onChange }) {
  const {
    closeModal, openModal, proveedores, getCategoria, nombreSucursal, act,
  } = useGastos();
  const { data: g, loading, error, reload } = useResource(
    `gasto:${gastoId}`,
    () => gastosApi.gasto(gastoId),
  );

  const quitarPago = async (imputacionId) => {
    const ok = await act(gastosApi.desimputar(imputacionId), 'Pago desaplicado.');
    if (ok) { reload(); onChange?.(); }
  };

  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (loading || error || !g) {
    return (
      <ModalShell title="Gasto" onClose={closeModal} footer={footer}>
        {loading
          ? <div className={s['empty-state']}>Cargando…</div>
          : <div className={cx(s.callout, s.warn)}>{error || 'No se encontró el gasto.'}</div>}
      </ModalShell>
    );
  }

  const cat = getCategoria(g.categoriaId);
  const vivo = g.estado !== 'anulado';

  return (
    <ModalShell
      title={`Gasto #${g.id}`}
      subtitle={`${cat?.nombre || 'Sin rubro'} · ${g.descripcion || 'sin descripción'}`}
      wide
      onClose={closeModal}
      footer={[
        ...(vivo && g.saldo > 0.009 ? [
          { texto: 'Aplicar un pago existente', clase: 'btn-ghost', onClick: () => openModal('aplicarAGasto', { gastoId: g.id, onChange }) },
          { texto: 'Pagar', clase: 'btn-primary', onClick: () => openModal('pagarGasto', { gastoId: g.id, onChange }) },
        ] : []),
        ...(vivo ? [{ texto: 'Editar', clase: 'btn-edit', onClick: () => openModal('gastoForm', { gastoId: g.id, onChange }) }] : []),
        ...(vivo && g.pagado <= 0.009 ? [{ texto: 'Anular', clase: 'btn-delete', onClick: () => openModal('anularGasto', { gastoId: g.id, onChange }) }] : []),
        { texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Estado"><GastoEstadoPill estado={g.estado} /></Di>
        <Di label="Fecha">{fmtFecha(g.fecha)}</Di>
        <Di label="Comprobante">
          {TIPOS_DOC_GASTO[g.tipoDoc] || g.tipoDoc} {g.letra} {g.numero || '—'}
        </Di>
        <Di label="Proveedor">{nombreProveedor(g, proveedores)}</Di>
        <Di label="Rubro">{cat?.nombre || '—'}</Di>
        <Di label="Sucursal">{g.sucursalId ? nombreSucursal(g.sucursalId) : 'Toda la empresa'}</Di>
        <Di label="Condición">{g.condicionPago === 'contado' ? 'Contado' : 'Cuenta corriente'}</Di>
        <Di label="Vence">{g.vencimiento ? fmtFecha(g.vencimiento) : '—'}</Di>
      </div>

      <div className={s['section-title']}>Importes</div>
      <div className={s['detalle-grid']}>
        <Di label="Neto">{money(g.neto)}</Di>
        <Di label="IVA">{money(g.iva)}</Di>
        <Di label="Otros">{money(g.otros)}</Di>
        <Di label="Total"><strong>{money(g.total)}</strong></Di>
        <Di label="Pagado">{money(g.pagado)}</Di>
        <Di label="Saldo"><Saldo valor={g.saldo}>{money(g.saldo)}</Saldo></Di>
      </div>

      <div className={s['section-title']}>Pagos aplicados</div>
      <Table
        cols={[
          { h: 'Fecha y hora' }, { h: 'Medio' }, { h: 'Origen' }, { h: 'Referencia' },
          { h: 'Importe', num: true }, { h: '', cls: 'actions-col' },
        ]}
        empty="Todavía no se pagó nada de este gasto."
      >
        {(g.pagos || []).map((p) => (
          <tr key={p.imputacionId}>
            <td>{fmtFechaHora(p.fecha)}</td>
            <td>{MEDIOS_PAGO[p.medio] || p.medio}</td>
            <td>
              {p.cajaSesionId
                ? `Caja ${p.sucursalNombre || ''} · turno #${p.cajaSesionId}`
                : (p.sucursalNombre || '—')}
              {p.usuarioNombre && <div className={s.hint} style={{ margin: 0 }}>{p.usuarioNombre}</div>}
            </td>
            <td>{p.referencia || <span className={s.muted}>—</span>}</td>
            <td className={s.num}><strong>{money(p.importe)}</strong></td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                <Btn variant="btn-delete" small onClick={() => quitarPago(p.imputacionId)}>Quitar</Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {g.observaciones && (
        <>
          <div className={s['section-title']}>Observaciones</div>
          <div className={s.callout} style={{ whiteSpace: 'pre-line' }}>{g.observaciones}</div>
        </>
      )}

      <div className={s.hint}>
        <strong>Quitar</strong> desaplica el pago: la plata que salió sigue registrada y vuelve a
        la bandeja de pagos sin aplicar. No devuelve dinero a la caja.
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Pagar un gasto (crea el pago y lo imputa de una)
 * ==================================================================== */

export function PagarGastoModal({ gastoId, onChange }) {
  const { ctx, act, closeModal, toast } = useGastos();
  const { data: g, loading } = useResource(`gasto-pagar:${gastoId}`, () => gastosApi.gasto(gastoId));

  const [importe, setImporte] = useState('');
  const [medio, setMedio] = useState('efectivo');
  const [fecha, setFecha] = useState(hoyISO());
  const [referencia, setReferencia] = useState('');
  const [desdeCaja, setDesdeCaja] = useState(true);

  useEffect(() => { if (g) setImporte(String(g.saldo)); }, [g]);

  // Turno abierto en la sucursal del usuario: si hay, el efectivo puede salir
  // de ahí y quedar reflejado en el arqueo.
  const { data: caja } = useResource(
    `caja-actual:${ctx.sucursalId}`,
    () => gastosApi.cajaActual(ctx.sucursalId),
    { enabled: !!ctx.sucursalId },
  );
  const hayTurno = !!caja?.id && caja.estado === 'abierta';
  const saleDeCaja = medio === 'efectivo' && hayTurno && desdeCaja;

  const pagar = async () => {
    if (!(Number(importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    const ok = await act(
      gastosApi.pagarGasto(gastoId, {
        importe: r2(importe),
        medio,
        fecha,
        referencia: referencia.trim(),
        cajaSesionId: saleDeCaja ? caja.id : undefined,
        usuarioId: ctx.usuarioId ?? undefined,
      }),
      'Pago registrado.',
    );
    if (ok) onChange?.();
  };

  if (loading || !g) {
    return (
      <ModalShell title="Pagar gasto" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={s['empty-state']}>Cargando…</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={`Pagar el gasto #${g.id}`}
      subtitle={g.descripcion || undefined}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar pago', clase: 'btn-primary', onClick: pagar },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Total">{money(g.total)}</Di>
        <Di label="Ya pagado">{money(g.pagado)}</Di>
        <Di label="Saldo"><Saldo valor={g.saldo}>{money(g.saldo)}</Saldo></Di>
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Importe <span className={s.req}>*</span></label>
          <input type="number" min="0" step="0.01" autoFocus value={importe} onChange={(e) => setImporte(e.target.value)} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Se puede pagar en partes: viene cargado el saldo completo.
          </div>
        </div>
        <div className={s.field}>
          <label>Medio</label>
          <select value={medio} onChange={(e) => setMedio(e.target.value)}>
            {Object.entries(MEDIOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Referencia</label>
          <input value={referencia} placeholder="Nº de transferencia, cheque…" onChange={(e) => setReferencia(e.target.value)} />
        </div>
      </div>

      {medio === 'efectivo' && (
        hayTurno ? (
          <div className={s.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={desdeCaja} onChange={(e) => setDesdeCaja(e.target.checked)} />
              Sale del turno de caja #{caja.id}
            </label>
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Tildado, se registra el egreso en esa caja y el arqueo lo va a mostrar. Destildalo
              solo si la plata NO salió del cajón.
            </div>
          </div>
        ) : (
          <div className={s.hint}>
            No hay un turno de caja abierto en tu sucursal: el pago se registra igual, pero no
            impacta en ningún arqueo.
          </div>
        )
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Aplicar un pago que ya existe
 * ==================================================================== */

/**
 * El otro sentido del circuito: el pago ya está hecho (lo hizo la cajera) y
 * recién ahora aparece el comprobante. Acá no sale plata — solo se dice contra
 * qué documento se descuenta la que ya salió.
 */
export function AplicarAGastoModal({ gastoId, onChange }) {
  const { ctx, act, closeModal, toast, nombreSucursal } = useGastos();
  const { data: g, loading } = useResource(`gasto-aplicar:${gastoId}`, () => gastosApi.gasto(gastoId));
  const { data: pagos, loading: cargandoPagos } = useResource(
    `disponibles:${g?.proveedorId ?? 0}`,
    () => gastosApi.disponibles(g.proveedorId),
    { enabled: !!g?.proveedorId },
  );

  const [elegido, setElegido] = useState('');
  const [importe, setImporte] = useState('');

  /**
   * Misma regla que Compras: si el gasto es DE una sucursal, solo se ofrecen
   * los pagos de esa sucursal — la plata de la caja de Express 2 explica
   * gastos de Express 2. Un gasto de "toda la empresa" ve todos los pagos.
   */
  const sucGasto = g?.sucursalId ?? null;
  const lista = useMemo(() => {
    const todos = pagos ?? [];
    return sucGasto ? todos.filter((p) => p.sucursalId === sucGasto) : todos;
  }, [pagos, sucGasto]);
  const enOtras = r2(
    (pagos ?? []).reduce((a, p) => a + p.saldo, 0) - lista.reduce((a, p) => a + p.saldo, 0),
  );

  const pago = lista.find((p) => p.id === Number(elegido));

  useEffect(() => {
    if (!pago || !g) return;
    // Por defecto se aplica lo que se pueda: lo que quede del pago o lo que
    // falte del gasto, lo que sea menor.
    setImporte(String(Math.min(pago.saldo, g.saldo)));
  }, [pago, g]);

  const aplicar = async () => {
    if (!elegido) { toast('Elegí el pago que querés aplicar.', 'err'); return; }
    if (!(Number(importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    const ok = await act(
      gastosApi.aplicarPagoAGasto(gastoId, {
        pagoId: Number(elegido),
        importe: r2(importe),
        usuarioId: ctx.usuarioId ?? undefined,
      }),
      'Pago aplicado al gasto.',
    );
    if (ok) onChange?.();
  };

  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (loading || !g) {
    return <ModalShell title="Aplicar un pago" onClose={closeModal} footer={footer}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }
  if (!g.proveedorId) {
    return <ModalShell title="Aplicar un pago" onClose={closeModal} footer={footer}>
      <div className={cx(s.callout, s.warn)}>
        Este gasto no tiene proveedor del padrón, así que no hay cuenta contra la cual aplicar
        un pago a cuenta. Editalo y asignale el proveedor, o pagalo directamente.
      </div>
    </ModalShell>;
  }

  return (
    <ModalShell
      title={`Aplicar un pago al gasto #${g.id}`}
      subtitle="No mueve plata: imputa lo que ya salió"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Aplicar', clase: 'btn-primary', onClick: aplicar },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Total del gasto">{money(g.total)}</Di>
        <Di label="Saldo"><Saldo valor={g.saldo}>{money(g.saldo)}</Saldo></Di>
        <Di label="Sucursal">{sucGasto ? nombreSucursal(sucGasto) : 'Toda la empresa'}</Di>
      </div>

      <div className={s['section-title']}>
        Pagos a cuenta {sucGasto ? `de ${nombreSucursal(sucGasto)}` : 'de este proveedor'}
      </div>
      {cargandoPagos ? (
        <div className={s['empty-state']}>Buscando pagos sin aplicar…</div>
      ) : !lista.length ? (
        <div className={s.callout}>
          {sucGasto
            ? 'Este proveedor no tiene pagos a cuenta de la sucursal del gasto.'
            : 'Este proveedor no tiene pagos a cuenta sin aplicar.'}
        </div>
      ) : (
        <Table
          cols={[{ h: '' }, { h: 'Fecha y hora' }, { h: 'Concepto' }, { h: 'Origen' }, { h: 'Disponible', num: true }]}
        >
          {lista.map((p) => (
            <tr
              key={p.id}
              className={s.clickable}
              onClick={() => setElegido(String(p.id))}
              style={Number(elegido) === p.id ? { background: 'var(--crm-color-surface-hover, rgba(0,0,0,.04))' } : undefined}
            >
              <td><input type="radio" checked={Number(elegido) === p.id} onChange={() => setElegido(String(p.id))} /></td>
              <td>{fmtFechaHora(p.fecha)}</td>
              <td>
                {p.concepto || <span className={s.muted}>—</span>}
                {p.referencia && <div className={s.hint} style={{ margin: 0 }}>{p.referencia}</div>}
              </td>
              <td>
                {p.cajaSesionId ? `Caja ${p.sucursalNombre} · turno #${p.cajaSesionId}` : (p.sucursalNombre || '—')}
                {p.usuarioNombre && <div className={s.hint} style={{ margin: 0 }}>{p.usuarioNombre}</div>}
              </td>
              <td className={s.num}><strong>{money(p.saldo)}</strong></td>
            </tr>
          ))}
        </Table>
      )}

      {enOtras > 0.009 && (
        <div className={s.hint}>
          El proveedor tiene además <strong>{money(enOtras)}</strong> pagados desde otras
          sucursales. Acá no se ofrecen: se aplican a gastos de la sucursal que pagó.
        </div>
      )}

      {!!pago && (
        <div className={s.field}>
          <label>Cuánto aplicar <span className={s.req}>*</span></label>
          <input type="number" min="0" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Como máximo {money(Math.min(pago.saldo, g.saldo))}: lo que queda del pago o lo que falta
            del gasto, lo que sea menor.
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Anular
 * ==================================================================== */

export function AnularGastoModal({ gastoId, onChange }) {
  const { act, closeModal, toast } = useGastos();
  const [motivo, setMotivo] = useState('');

  const anular = async () => {
    if (!motivo.trim()) { toast('Escribí por qué se anula: queda en el historial.', 'err'); return; }
    const ok = await act(gastosApi.anularGasto(gastoId, motivo.trim()), 'Gasto anulado.');
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title={`Anular el gasto #${gastoId}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Anular', clase: 'btn-delete', onClick: anular },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        El gasto queda como anulado y deja de contar en el resumen y en las cuentas a pagar.
        No se borra: sigue en el historial con el motivo.
      </div>
      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input autoFocus value={motivo} placeholder="Ej: cargado dos veces" onChange={(e) => setMotivo(e.target.value)} />
      </div>
    </ModalShell>
  );
}
