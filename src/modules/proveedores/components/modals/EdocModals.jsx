import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { provApi, MEDIOS_HABITUALES } from '../../services/proveedores.api.js';
import {
  Btn, Di, ModalShell, Pill, Saldo, Table, VencePill, money, fmtFecha, s,
} from '../ui.jsx';

/**
 * EL MAYOR DEL PROVEEDOR — el estado de cuenta que se le muestra al teléfono
 * cuando llama a reclamar: cada movimiento al DEBE o al HABER, la antigüedad
 * FIFO de la deuda, sus compromisos pendientes, las cuentas para transferirle
 * y la marca de conciliación.
 */
export function EdocDetalleModal({ proveedorId }) {
  const { act, closeModal, openModal, esJefe } = useProveedores();
  const { data: d, loading, reload } = useResource(
    `edoc:${proveedorId}`,
    () => provApi.edocProveedor(proveedorId),
  );

  const conciliar = () => act(provApi.conciliar(proveedorId), 'Conciliado hasta hoy.').then(() => reload());
  const desconciliar = () => act(provApi.desconciliar(proveedorId), 'Marca de conciliación quitada.').then(() => reload());
  const borrarAjuste = async (id) => {
    const ok = await act(provApi.borrarAjuste(id), 'Ajuste eliminado.');
    if (ok) reload();
  };

  if (loading || !d) {
    return (
      <ModalShell title="Estado de cuenta" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={s['empty-state']}>Cargando…</div>
      </ModalShell>
    );
  }

  const p = d.proveedor;
  const KIND_LABEL = {
    comprobante: 'Factura', nc: 'NC', gasto: 'Gasto', pago: 'Pago',
    ajuste_debe: 'Ajuste', ajuste_haber: 'Ajuste',
  };

  return (
    <ModalShell
      title={`Estado de cuenta · ${p.nombre}`}
      subtitle={`${p.modoCuenta === 'libre' ? 'Cuenta LIBRE (pagos a cuenta)' : 'Cuenta por facturas'}`
        + `${p.medioHabitual ? ` · cobra por ${MEDIOS_HABITUALES[p.medioHabitual] ?? p.medioHabitual}` : ''}`
        + `${p.diasPago ? ` a ${p.diasPago} días` : ''}`}
      wide
      onClose={closeModal}
      footer={[
        { texto: '+ Ajuste', clase: 'btn-ghost', onClick: () => openModal('ajuste', { proveedorId, onDone: reload }) },
        p.conciliadoHasta
          ? { texto: 'Quitar conciliación', clase: 'btn-ghost', onClick: desconciliar }
          : { texto: 'Concilié con su resumen', clase: 'btn-ghost', onClick: conciliar },
        { texto: 'Cerrar', clase: 'btn-primary', onClick: closeModal },
      ].filter(Boolean)}
    >
      <div className={s['form-grid']}>
        <Di label="Saldo"><Saldo valor={d.saldo}>{money(d.saldo)}</Saldo></Di>
        <Di label="Debe">{money(d.totDebe)}</Di>
        <Di label="Haber">{money(d.totHaber)}</Di>
        <Di label="Arrastra deuda desde">
          {d.deudaDesde ? fmtFecha(d.deudaDesde) : '—'}
        </Di>
        <Di label="Conciliado hasta">
          {p.conciliadoHasta ? fmtFecha(p.conciliadoHasta) : 'Sin conciliar'}
        </Di>
      </div>

      {p.modoCuenta === 'libre' && d.deudaDesde && (
        <div className={cx(s.callout, s.info)}>
          Cuenta libre: los pagos no van a facturas puntuales. La antigüedad se calcula
          por FIFO — lo cobrado cancela primero lo más viejo, y la deuda actual arrastra
          desde el <strong>{fmtFecha(d.deudaDesde)}</strong>.
        </div>
      )}

      {d.compromisos.length > 0 && (
        <>
          <div className={s['section-title']}>Compromisos pendientes</div>
          <Table cols={[{ h: 'Vence' }, { h: 'Detalle' }, { h: 'Importe', num: true }]}>
            {d.compromisos.map((k) => (
              <tr key={k.id}>
                <td>{fmtFecha(k.fechaVenc)} <VencePill dias={k.diasRest} /></td>
                <td>
                  {k.esEcheq ? 'Echeq' : 'Cta cte'}
                  {k.comprobanteEtiqueta ? ` · ${k.comprobanteEtiqueta}` : ''}
                  {k.cuota ? ` · cuota ${k.cuota}/${k.cuotas}` : ''}
                </td>
                <td className={s.num}>{money(k.importe)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      <div className={s['section-title']}>Movimientos</div>
      <Table cols={[{ h: 'Fecha' }, { h: 'Movimiento' }, { h: 'Debe', num: true }, { h: 'Haber', num: true }, { h: '' }]}>
        {d.movs.map((m) => (
          <tr key={`${m.kind}-${m.id}`}>
            <td>{fmtFecha(m.fecha)}</td>
            <td>
              <Pill pill={m.debe > 0 ? 'est-pendiente' : 'est-recibida'} label={KIND_LABEL[m.kind] ?? m.kind} />{' '}
              {m.etiqueta}
              {m.detalle && <div className={s.hint} style={{ margin: 0 }}>{m.detalle}</div>}
              {(m.formas?.length ?? 0) > 1 && (
                <div className={s.hint} style={{ margin: 0 }}>
                  {m.formas.map((f) => `${f.medio} ${money(f.importe)}`).join(' + ')}
                </div>
              )}
            </td>
            <td className={s.num}>{m.debe > 0 ? money(m.debe) : ''}</td>
            <td className={s.num}>{m.haber > 0 ? money(m.haber) : ''}</td>
            <td>
              {(m.kind === 'ajuste_debe' || m.kind === 'ajuste_haber') && esJefe && (
                <Btn small onClick={() => borrarAjuste(m.id)}>×</Btn>
              )}
            </td>
          </tr>
        ))}
      </Table>

      {d.cuentas.length > 0 && (
        <>
          <div className={s['section-title']}>Cuentas bancarias</div>
          {d.cuentas.map((c) => (
            <div key={c.id} className={s.hint} style={{ margin: '2px 0' }}>
              <code>{c.cbuAlias}</code>{c.descripcion ? ` — ${c.descripcion}` : ''}
            </div>
          ))}
        </>
      )}
    </ModalShell>
  );
}

/** Ajuste manual DEBE/HABER, con motivo obligatorio: sin explicación no se audita. */
export function AjusteModal({ proveedorId, onDone }) {
  const { act, closeModal, toast } = useProveedores();
  const [f, setF] = useState({ tipo: 'debe', monto: '', motivo: '', fecha: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async () => {
    if (!(Number(f.monto) > 0)) { toast('El monto tiene que ser mayor a 0.', 'err'); return; }
    if (!f.motivo.trim()) { toast('El motivo es obligatorio.', 'err'); return; }
    const res = await act(provApi.crearAjuste({
      proveedorId,
      tipo: f.tipo,
      monto: Math.round(Number(f.monto) * 100) / 100,
      motivo: f.motivo.trim(),
      fecha: f.fecha || undefined,
    }), 'Ajuste registrado.');
    if (res) onDone?.();
  };

  return (
    <ModalShell
      title="Ajuste manual"
      subtitle="DEBE suma deuda · HABER la resta — y el motivo queda escrito"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo</label>
          <select value={f.tipo} onChange={set('tipo')}>
            <option value="debe">DEBE (suma deuda)</option>
            <option value="haber">HABER (resta deuda)</option>
          </select>
        </div>
        <div className={s.field}>
          <label>Monto</label>
          <input type="number" min="0" step="0.01" value={f.monto} onChange={set('monto')} autoFocus />
        </div>
        <div className={s.field}>
          <label>Fecha</label>
          <input type="date" value={f.fecha} onChange={set('fecha')} />
        </div>
      </div>
      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input value={f.motivo} onChange={set('motivo')} placeholder="Diferencia de flete del reparto del 12/8…" />
      </div>
    </ModalShell>
  );
}
