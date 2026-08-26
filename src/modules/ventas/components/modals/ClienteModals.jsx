import { useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi } from '../../services/ventas.api.js';
import {
  CONDICIONES_IVA, CONDICIONES_PAGO, TIPOS_DOC, docLegible, nroComprobante,
} from '../../domain/constants.js';
import {
  Table, Btn, Di, ModalShell, VentaTag, VentaEstadoPill, SaldoMonto,
  money, fmtFecha, s,
} from '../ui.jsx';

/* ==================================================================== *
 * Alta / edición
 * ==================================================================== */

/** Estado inicial del formulario: cliente existente, o defaults de la config. */
function estadoInicial(cliente, config) {
  return {
    nombre: cliente?.nombre ?? '',
    nombreFantasia: cliente?.nombreFantasia ?? '',
    tipoDoc: cliente?.tipoDoc ?? 'dni',
    numeroDoc: cliente?.numeroDoc ?? '',
    condicionIva: cliente?.condicionIva ?? 'consumidor_final',
    direccion: cliente?.direccion ?? '',
    localidad: cliente?.localidad ?? '',
    telefono: cliente?.telefono ?? '',
    email: cliente?.email ?? '',
    listas: cliente?.listas ?? [],
    descuento: cliente?.descuento ?? 0,
    vendedorId: cliente?.vendedorId ?? '',
    sucursalId: cliente?.sucursalId ?? '',
    ctaCteHabilitada: cliente?.ctaCteHabilitada ?? false,
    limiteCredito: cliente?.limiteCredito ?? (config.ctaCteLimiteDefault || 0),
    diasPlazo: cliente?.diasPlazo ?? (config.ctaCteDiasPlazo || 0),
    observaciones: cliente?.observaciones ?? '',
  };
}

export function ClienteFormModal({ clienteId }) {
  const { getCliente, act, closeModal, toast, config, usuarios, sucursales, listasCatalogo } = useVentas();
  const cliente = clienteId != null ? getCliente(clienteId) : null;
  const editando = !!cliente;

  const [f, setF] = useState(() => estadoInicial(cliente, config));
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setChk = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.checked }));

  const largoDoc = TIPOS_DOC[f.tipoDoc]?.largo ?? 0;
  const digitos = (f.numeroDoc || '').replace(/\D/g, '');
  const docInvalido = largoDoc > 0 && digitos.length > 0 && digitos.length !== largoDoc;

  // La cta. cte. depende de que esté habilitada globalmente: si el circuito está
  // apagado, no tiene sentido ofrecer crédito por cliente.
  const ctaCteDisponible = !!config.ctaCteHabilitada;

  /* LA LLAVE DEL CRÉDITO (`cta_cte`, 26/8): la ficha completa es del admin,
   * pero habilitar la cuenta corriente y ponerle monto es otorgar crédito y
   * lo decide el superadmin. Sin la llave los tres campos se muestran como
   * info y NO viajan en el guardado — la API los preserva tal como están
   * (y rechaza fuerte cualquier intento de cambiarlos por atrás). */
  const { can } = usePermissions();
  const puedeCredito = can('cta_cte');

  const guardar = () => {
    if (!f.nombre.trim()) { toast('Ingresá el nombre o razón social.', 'err'); return; }
    if (docInvalido) { toast(`El ${TIPOS_DOC[f.tipoDoc].label} debe tener ${largoDoc} dígitos.`, 'err'); return; }

    const datos = {
      ...f,
      descuento: Number(f.descuento) || 0,
      limiteCredito: Number(f.limiteCredito) || 0,
      diasPlazo: Number(f.diasPlazo) || 0,
      vendedorId: f.vendedorId ? Number(f.vendedorId) : null,
      sucursalId: f.sucursalId ? Number(f.sucursalId) : null,
      ctaCteHabilitada: ctaCteDisponible && f.ctaCteHabilitada,
    };
    if (!puedeCredito) {
      delete datos.ctaCteHabilitada;
      delete datos.limiteCredito;
      delete datos.diasPlazo;
    }
    // Las listas viven en su propia tabla (el cliente puede tener varias), así
    // que se guardan en un segundo paso con el id ya resuelto.
    const guardado = editando
      ? ventasApi.editarCliente(cliente.id, datos).then((c) => ventasApi.setListasCliente(c.id, f.listas).then(() => c))
      : ventasApi.crearCliente(datos).then((c) => ventasApi.setListasCliente(c.id, f.listas).then(() => c));
    act(guardado, editando ? 'Cliente actualizado.' : 'Cliente creado.');
  };

  const esCF = !!cliente?.esConsumidorFinal;

  return (
    <ModalShell
      title={editando ? `Editar ${cliente.nombre}` : 'Nuevo cliente'}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: editando ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {esCF && (
        <div className={cx(s.callout, s.warn)}>
          Es el <strong>Consumidor Final</strong> del sistema: la caja lo usa por defecto. Sus datos
          fiscales no se editan y no se puede dar de baja.
        </div>
      )}

      <div className={s['section-title']}>Identificación</div>
      <div className={s.field}>
        <label>Nombre o razón social <span className={s.req}>*</span></label>
        <input value={f.nombre} placeholder="Ej: Kiosco La Esquina" onChange={set('nombre')} />
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Nombre de fantasía</label>
          <input value={f.nombreFantasia} placeholder="Opcional" onChange={set('nombreFantasia')} />
        </div>
        <div className={s.field}>
          <label>Condición frente al IVA</label>
          <select value={f.condicionIva} onChange={set('condicionIva')} disabled={esCF}>
            {Object.entries(CONDICIONES_IVA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo de documento</label>
          <select value={f.tipoDoc} onChange={set('tipoDoc')} disabled={esCF}>
            {Object.entries(TIPOS_DOC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Número</label>
          <input
            value={f.numeroDoc}
            placeholder={largoDoc ? `${largoDoc} dígitos` : 'Opcional'}
            onChange={set('numeroDoc')}
            disabled={esCF || f.tipoDoc === 'sin_identificar'}
          />
          {docInvalido && <div className={s.hint} style={{ color: 'var(--crm-color-danger)' }}>Faltan dígitos: {digitos.length}/{largoDoc}.</div>}
        </div>
      </div>
      <div className={s.hint}>
        La condición de IVA define la letra del comprobante que se emite en la caja.
      </div>

      <div className={s['section-title']}>Contacto</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Teléfono</label>
          <input value={f.telefono} placeholder="11-4000-0000" onChange={set('telefono')} />
        </div>
        <div className={s.field}>
          <label>Email</label>
          <input value={f.email} placeholder="cliente@correo.com" onChange={set('email')} />
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Dirección</label>
          <input value={f.direccion} placeholder="Calle y número" onChange={set('direccion')} />
        </div>
        <div className={s.field}>
          <label>Localidad</label>
          <input value={f.localidad} onChange={set('localidad')} />
        </div>
      </div>

      <div className={s['section-title']}>Comercial</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Listas de precio</label>
          {/*
            Varias predeterminadas: al cotizar se prueban en su orden de
            preferencia y gana la primera que el renglón califique. Sin ninguna,
            el cliente va con la lista base del sistema.
          */}
          <div style={{ display: 'grid', gap: 6 }}>
            {listasCatalogo.listas.filter((l) => l.activa).map((l) => (
              <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={f.listas.includes(l.id)}
                  onChange={(e) => setF((prev) => ({
                    ...prev,
                    listas: e.target.checked
                      ? [...prev.listas, l.id]
                      : prev.listas.filter((x) => x !== l.id),
                  }))}
                />
                <span>{l.etiqueta}</span>
                <span className={s.hint} style={{ margin: 0 }}>
                  {l.modalidad} · orden {l.orden}
                </span>
              </label>
            ))}
            {!listasCatalogo.listas.length && <span className={s.muted}>No hay listas configuradas.</span>}
          </div>
        </div>
        <div className={s.field}>
          <label>Descuento general (%)</label>
          <input type="number" min="0" max="100" step="0.5" value={f.descuento} onChange={set('descuento')} />
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Vendedor asignado</label>
          <select value={f.vendedorId} onChange={set('vendedorId')}>
            <option value="">Sin asignar</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Sucursal habitual</label>
          <select value={f.sucursalId} onChange={set('sucursalId')}>
            <option value="">Sin asignar</option>
            {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className={s['section-title']}>Cuenta corriente</div>
      {!ctaCteDisponible ? (
        <div className={cx(s.callout, s.warn)}>
          La venta en cuenta corriente está deshabilitada en <strong>Configuración</strong>.
        </div>
      ) : !puedeCredito ? (
        /* Sin la llave se VE el estado (para atender al cliente hay que saber
         * si tiene crédito) pero no se toca: habilitarla es otorgar crédito. */
        <div className={s.callout}>
          {cliente?.ctaCteHabilitada
            ? <>Habilitada — límite {cliente.limiteCredito > 0 ? money(cliente.limiteCredito) : 'sin tope'} · plazo {cliente.diasPlazo} día(s).</>
            : 'No habilitada: este cliente opera al contado.'}
          {' '}Habilitarla y fijar el monto lo hace el <strong>superadmin</strong> desde este mismo
          formulario. El resto de la ficha se guarda normalmente.
        </div>
      ) : (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.ctaCteHabilitada} onChange={setChk('ctaCteHabilitada')} />
            Habilitar cuenta corriente
          </label>
          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Límite de crédito</label>
              <input type="number" min="0" step="1000" value={f.limiteCredito} onChange={set('limiteCredito')} disabled={!f.ctaCteHabilitada} />
              <div className={s.hint} style={{ margin: '6px 0 0' }}>0 = sin tope.</div>
            </div>
            <div className={s.field}>
              <label>Plazo de pago (días)</label>
              <input type="number" min="0" step="1" value={f.diasPlazo} onChange={set('diasPlazo')} disabled={!f.ctaCteHabilitada} />
            </div>
          </div>
        </>
      )}

      <div className={s.field}>
        <label>Observaciones</label>
        <textarea rows={2} value={f.observaciones} onChange={set('observaciones')} />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Detalle
 * ==================================================================== */

/**
 * El cliente opera al contado. Si quien mira tiene la llave del crédito
 * (`cta_cte`), puede habilitarle la cuenta corriente ACÁ MISMO, sin pasar por
 * la edición completa del cliente — pedido del dueño del 26/8. Al habilitar,
 * el modal queda abierto y la pestaña pasa sola a mostrar la cuenta.
 */
function TabSinCuenta({ cliente }) {
  const { config, toast, recargar } = useVentas();
  const { can } = usePermissions();
  const [limite, setLimite] = useState(config.ctaCteLimiteDefault || 0);
  const [dias, setDias] = useState(config.ctaCteDiasPlazo || 0);
  const [ocupado, setOcupado] = useState(false);

  const habilitar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await ventasApi.creditoCliente(cliente.id, {
        ctaCteHabilitada: true,
        limiteCredito: Number(limite) || 0,
        diasPlazo: Number(dias) || 0,
      });
      toast(`Cuenta corriente habilitada para ${cliente.nombre}.`, 'ok');
      await recargar();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo habilitar la cuenta corriente.', 'err');
      setOcupado(false);
    }
  };

  return (
    <div>
      <div className={cx(s.callout, s.warn)}>
        Este cliente opera al contado: no tiene cuenta corriente habilitada.
      </div>

      {can('cta_cte') && !!config.ctaCteHabilitada && !cliente.esConsumidorFinal && (
        <>
          <div className={s['section-title']}>Habilitar ahora</div>
          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Límite de crédito</label>
              <input type="number" min="0" step="1000" value={limite} onChange={(e) => setLimite(e.target.value)} />
              <div className={s.hint} style={{ margin: '6px 0 0' }}>0 = sin tope.</div>
            </div>
            <div className={s.field}>
              <label>Plazo de pago (días)</label>
              <input type="number" min="0" step="1" value={dias} onChange={(e) => setDias(e.target.value)} />
            </div>
          </div>
          <Btn variant="btn-primary" onClick={habilitar} disabled={ocupado}>
            {ocupado ? 'Habilitando…' : 'Habilitar cuenta corriente'}
          </Btn>
        </>
      )}
    </div>
  );
}

/** Pestaña de cuenta corriente: saldo, crédito disponible y qué se debe. */
function TabCuenta({ clienteId, cliente }) {
  const { openModal } = useVentas();
  const { data, loading, error } = useResource(`cuenta:${clienteId}`, () => ventasApi.cuentaCliente(clienteId));

  if (loading) return <div className={s['empty-state']}>Cargando cuenta corriente…</div>;
  if (error) return <div className={cx(s.callout, s.warn)}>{error}</div>;
  if (!data) return null;

  const excedido = data.disponible != null && data.disponible < 0;

  return (
    <div>
      <div className={s['detalle-grid']}>
        <Di label="Saldo deudor"><SaldoMonto valor={data.saldo}>{money(data.saldo)}</SaldoMonto></Di>
        <Di label="Facturado (cta. cte.)">{money(data.facturado)}</Di>
        <Di label="Cobrado">{money(data.cobrado)}</Di>
        <Di label="Límite de crédito">{data.limiteCredito > 0 ? money(data.limiteCredito) : 'Sin tope'}</Di>
        <Di label="Crédito disponible">
          {data.disponible == null
            ? <span className={s.muted}>—</span>
            : <SaldoMonto valor={-data.disponible}>{money(data.disponible)}</SaldoMonto>}
        </Di>
        <Di label="Comprobantes impagos">{data.comprobantes.length}</Di>
      </div>

      {excedido && (
        <div className={cx(s.callout, s.warn)}>
          El saldo <strong>supera el límite de crédito</strong>. Con el bloqueo activado, la caja
          va a rechazar nuevas ventas en cuenta corriente.
        </div>
      )}

      <Table
        cols={[
          { h: 'Comprobante' }, { h: 'Fecha' }, { h: 'Vence' },
          { h: 'Total', num: true }, { h: 'Cobrado', num: true }, { h: 'Saldo', num: true },
        ]}
        empty="No hay comprobantes impagos. La cuenta está al día."
      >
        {data.comprobantes.map((c) => (
          <tr key={c.id}>
            <td><VentaTag tipo={c.tipo} /> <span className={s.mono}>{nroComprobante(c)}</span></td>
            <td>{fmtFecha(c.fecha)}</td>
            <td>{c.vencimientoPago ? fmtFecha(c.vencimientoPago) : <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{money(c.total)}</td>
            <td className={s.num}>{money(c.cobrado)}</td>
            <td className={s.num}><SaldoMonto valor={c.saldo}>{money(c.saldo)}</SaldoMonto></td>
          </tr>
        ))}
      </Table>

      {data.comprobantes.length > 0 && (
        <div className={s['detalle-actions']}>
          <Btn variant="btn-primary" onClick={() => openModal('cobranzaForm', { clienteId: cliente.id })}>
            Registrar cobranza
          </Btn>
        </div>
      )}
    </div>
  );
}

/** Pestaña de comprobantes emitidos (últimos 100). */
function TabComprobantes({ clienteId }) {
  const { data, loading, error } = useResource(
    `ventas:${clienteId}`,
    () => ventasApi.ventas({ clienteId, limit: 100 }),
  );

  if (loading) return <div className={s['empty-state']}>Cargando comprobantes…</div>;
  if (error) return <div className={cx(s.callout, s.warn)}>{error}</div>;

  return (
    <Table
      cols={[
        { h: 'Comprobante' }, { h: 'Fecha' }, { h: 'Condición' },
        { h: 'Total', num: true }, { h: 'Saldo', num: true }, { h: 'Estado' },
      ]}
      empty="Este cliente todavía no tiene comprobantes."
    >
      {(data ?? []).map((v) => (
        <tr key={v.id}>
          <td><VentaTag tipo={v.tipo} /> <span className={s.mono}>{nroComprobante(v)}</span></td>
          <td>{fmtFecha(v.fecha)}</td>
          <td>{CONDICIONES_PAGO[v.condicionPago] || v.condicionPago}</td>
          <td className={s.num}>{money(v.total)}</td>
          <td className={s.num}>{v.saldo > 0.009 ? <SaldoMonto valor={v.saldo}>{money(v.saldo)}</SaldoMonto> : <span className={s.muted}>—</span>}</td>
          <td><VentaEstadoPill estado={v.estado} /></td>
        </tr>
      ))}
    </Table>
  );
}

export function DetalleClienteModal({ clienteId }) {
  const { getCliente, closeModal, openModal, usuarios, sucursales } = useVentas();
  const [tab, setTab] = useState(0);
  const cliente = getCliente(clienteId);

  const vendedor = useMemo(
    () => usuarios.find((u) => u.id === cliente?.vendedorId)?.nombre,
    [usuarios, cliente],
  );
  const sucursal = useMemo(
    () => sucursales.find((x) => x.id === cliente?.sucursalId)?.nombre,
    [sucursales, cliente],
  );

  if (!cliente) return null;

  return (
    <ModalShell
      title={cliente.nombre}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Editar', clase: 'btn-primary', onClick: () => openModal('clienteForm', { clienteId }) },
      ]}
    >
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab label="Resumen" />
        <Tab label="Cuenta corriente" />
        <Tab label="Comprobantes" />
      </Tabs>

      {tab === 0 && (
        <div>
          <div className={s['detalle-grid']}>
            <Di label="Documento"><span className={s.mono}>{docLegible(cliente)}</span></Di>
            <Di label="Condición IVA">{CONDICIONES_IVA[cliente.condicionIva]?.label || '—'}</Di>
            <Di label="Estado">{cliente.activo ? 'Activo' : 'Dado de baja'}</Di>
            <Di label="Teléfono">{cliente.telefono || '—'}</Di>
            <Di label="Email">{cliente.email || '—'}</Di>
            <Di label="Localidad">{cliente.localidad || '—'}</Di>
            <Di label="Dirección">{cliente.direccion || '—'}</Di>
            <Di label="Listas de precio">{cliente.listas?.length ? cliente.listas.length + ' asignada(s)' : 'Base del sistema'}</Di>
            <Di label="Descuento general">{cliente.descuento ? `${cliente.descuento}%` : '—'}</Di>
            <Di label="Vendedor">{vendedor || '—'}</Di>
            <Di label="Sucursal habitual">{sucursal || '—'}</Di>
            <Di label="Cuenta corriente">
              {cliente.ctaCteHabilitada
                ? `${cliente.limiteCredito > 0 ? money(cliente.limiteCredito) : 'Sin tope'} · ${cliente.diasPlazo} días`
                : 'No habilitada'}
            </Di>
          </div>
          {cliente.observaciones && (
            <div className={s.callout}>{cliente.observaciones}</div>
          )}
        </div>
      )}

      {tab === 1 && (
        cliente.ctaCteHabilitada
          ? <TabCuenta clienteId={clienteId} cliente={cliente} />
          : <TabSinCuenta cliente={cliente} />
      )}

      {tab === 2 && <TabComprobantes clienteId={clienteId} />}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Baja / reactivación
 * ==================================================================== */

export function EliminarClienteModal({ clienteId }) {
  const { getCliente, act, closeModal } = useVentas();
  const cliente = getCliente(clienteId);
  if (!cliente) return null;

  return (
    <ModalShell
      title="Dar de baja el cliente"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Dar de baja', clase: 'btn-delete', onClick: () => act(ventasApi.eliminarCliente(cliente.id), 'Cliente dado de baja.') },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        ¿Dar de baja a <strong>{cliente.nombre}</strong>?
        <div style={{ marginTop: 8 }}>
          Si tiene comprobantes o cobranzas queda <strong>inactivo</strong> (el historial no se toca)
          y deja de aparecer en las búsquedas. Si no tiene movimientos, se elimina.
        </div>
      </div>
    </ModalShell>
  );
}

export function ReactivarClienteModal({ clienteId }) {
  const { getCliente, act, closeModal } = useVentas();
  const cliente = getCliente(clienteId);
  if (!cliente) return null;

  return (
    <ModalShell
      title="Reactivar el cliente"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Reactivar', clase: 'btn-primary', onClick: () => act(ventasApi.reactivarCliente(cliente.id), 'Cliente reactivado.') },
      ]}
    >
      <div className={s.callout}>
        <strong>{cliente.nombre}</strong> vuelve a estar disponible para vender y cobrar.
      </div>
    </ModalShell>
  );
}
