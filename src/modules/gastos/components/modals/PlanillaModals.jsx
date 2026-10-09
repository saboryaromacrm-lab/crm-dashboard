import { useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../../context/GastosContext.jsx';
import { errorMsg, gastosApi } from '../../services/gastos.api.js';
import { hoyISO, mesLargo, periodoISO, r2 } from '../../domain/constants.js';
import { costoMensual, cuotaMensual } from '../../domain/sueldos.js';
import { ModalShell, Table, Btn, money, s } from '../ui.jsx';

/**
 * LA PLANILLA DE RESULTADOS (0152, solo superadmin): empleados con su
 * historia de sueldos y bienes de uso. Cada guardado tiene candado contra el
 * doble clic; borrar pide una segunda confirmación (cambia meses ya pasados).
 */

/** El selector de local de la planilla: un local, o «sin local» (se reparte o queda en Administración, según el rubro). */
function SelectorLocal({ valor, onChange, sucursales, textoSinLocal }) {
  return (
    <select value={valor} onChange={onChange}>
      <option value="">{textoSinLocal}</option>
      {sucursales.filter((x) => x.activa || String(x.id) === String(valor)).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
    </select>
  );
}

/** Ejecuta una vez (candado con useRef) y avisa el error sin cerrar la ventana. */
function useUnaVez() {
  const enVuelo = useRef(false);
  const { toast } = useGastos();
  return async (fn) => {
    if (enVuelo.current) return null;
    enVuelo.current = true;
    try { return await fn(); } catch (e) { toast(errorMsg(e), 'err'); return null; } finally { enVuelo.current = false; }
  };
}

export function EmpleadoFormModal({ empleado: inicial, sucursales = [], onChange }) {
  const { act, closeModal, toast } = useGastos();
  const unaVez = useUnaVez();
  const [e, setE] = useState(inicial);
  const editando = !!e;
  const [f, setF] = useState({
    nombre: inicial?.nombre ?? '', cuil: inicial?.cuil ?? '', sucursalId: inicial?.sucursalId ?? '',
    alta: inicial?.alta ?? hoyISO(), baja: inicial?.baja ?? '', observaciones: inicial?.observaciones ?? '',
    bruto: '', cargas: '',
  });
  const ultimo = e?.sueldos?.[e.sueldos.length - 1];
  const [nuevo, setNuevo] = useState({ desde: periodoISO(), bruto: '', cargas: ultimo ? String(ultimo.cargas) : '' });
  const [borrando, setBorrando] = useState(false);
  const set = (k) => (ev) => setF((x) => ({ ...x, [k]: ev.target.value }));
  const setN = (k) => (ev) => setNuevo((x) => ({ ...x, [k]: ev.target.value }));
  const prev = costoMensual(f.bruto, f.cargas);
  const prevNuevo = costoMensual(nuevo.bruto, nuevo.cargas);

  const guardar = () => unaVez(async () => {
    if (!f.nombre.trim()) { toast('Poné el nombre del empleado.', 'err'); return; }
    if (!f.alta) { toast('Poné la fecha de alta.', 'err'); return; }
    if (f.baja && f.baja < f.alta) { toast('La baja no puede ser anterior al alta.', 'err'); return; }
    const base = {
      nombre: f.nombre.trim(), cuil: f.cuil.trim(), sucursalId: f.sucursalId ? Number(f.sucursalId) : null,
      alta: f.alta, observaciones: f.observaciones.trim(),
    };
    if (editando) {
      const ok = await act(gastosApi.editarEmpleado(e.id, { ...base, baja: f.baja || null }), 'Empleado actualizado.');
      if (ok) onChange?.();
      return;
    }
    if (!(Number(f.bruto) > 0)) { toast('Poné el sueldo bruto.', 'err'); return; }
    if (f.cargas === '' || Number(f.cargas) < 0 || Number(f.cargas) > 100) { toast('Poné el % de cargas del empleador (entre 0 y 100).', 'err'); return; }
    const ok = await act(gastosApi.crearEmpleado({ ...base, bruto: r2(f.bruto), cargas: r2(f.cargas) }), `${base.nombre} cargado.`);
    if (ok) onChange?.();
  });

  const agregarSueldo = () => unaVez(async () => {
    if (!/^\d{4}-\d{2}$/.test(nuevo.desde)) { toast('Elegí desde qué mes vale.', 'err'); return; }
    if (!(Number(nuevo.bruto) > 0)) { toast('Poné el sueldo bruto nuevo.', 'err'); return; }
    if (nuevo.cargas === '' || Number(nuevo.cargas) < 0 || Number(nuevo.cargas) > 100) { toast('Poné el % de cargas (entre 0 y 100).', 'err'); return; }
    const r = await gastosApi.guardarSueldo(e.id, { desde: nuevo.desde, bruto: r2(nuevo.bruto), cargas: r2(nuevo.cargas) });
    const act2 = r?.empleados?.find((x) => x.id === e.id);
    if (act2) setE(act2);
    setNuevo((x) => ({ ...x, bruto: '' }));
    toast(`Sueldo desde ${mesLargo(nuevo.desde)} guardado.`, 'ok');
    onChange?.();
  });

  const borrarSueldo = (id) => unaVez(async () => {
    const r = await gastosApi.borrarSueldo(id);
    const act2 = r?.empleados?.find((x) => x.id === e.id);
    if (act2) setE(act2);
    toast('Sueldo borrado.', 'ok');
    onChange?.();
  });

  const borrar = () => unaVez(async () => {
    if (!borrando) { setBorrando(true); return; }
    const ok = await act(gastosApi.borrarEmpleado(e.id), `${e.nombre} borrado.`);
    if (ok) onChange?.();
  });

  return (
    <ModalShell
      title={editando ? e.nombre : 'Nuevo empleado'}
      subtitle={editando ? 'Datos, baja y sueldos' : 'Su costo entra en Resultados desde el mes del alta'}
      wide
      onClose={closeModal}
      footer={[
        ...(editando ? [{ texto: borrando ? 'Sí, borrar' : 'Borrar', clase: 'btn-delete', onClick: borrar }] : []),
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {borrando && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          ¿Borrar a <strong>{e.nombre}</strong> con todos sus sueldos? Cambia el resultado de los meses en que trabajó.
          Si dejó de trabajar, mejor poné la <strong>baja</strong>: así su costo queda en los meses que trabajó.
        </div>
      )}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Nombre <span className={s.req}>*</span></label>
          <input autoFocus value={f.nombre} maxLength={120} onChange={set('nombre')} />
        </div>
        <div className={s.field}>
          <label>CUIL</label>
          <input value={f.cuil} maxLength={20} placeholder="Opcional" onChange={set('cuil')} />
        </div>
        <div className={s.field}>
          <label>Local</label>
          <SelectorLocal valor={f.sucursalId} onChange={set('sucursalId')} sucursales={sucursales} textoSinLocal="Varios locales / Administración" />
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Alta <span className={s.req}>*</span></label>
          <input type="date" value={f.alta} onChange={set('alta')} />
        </div>
        {editando && (
          <div className={s.field}>
            <label>Baja</label>
            <input type="date" min={f.alta || undefined} value={f.baja} onChange={set('baja')} />
            <div className={s.hint} style={{ margin: '6px 0 0' }}>El último día que trabajó. Vacía = sigue trabajando.</div>
          </div>
        )}
        <div className={s.field}>
          <label>Observaciones</label>
          <input value={f.observaciones} maxLength={300} placeholder="Opcional" onChange={set('observaciones')} />
        </div>
      </div>

      {!editando && (
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Sueldo bruto mensual <span className={s.req}>*</span></label>
            <input type="number" min="0" step="0.01" value={f.bruto} onChange={set('bruto')} />
          </div>
          <div className={s.field}>
            <label>Cargas del empleador (%) <span className={s.req}>*</span></label>
            <input type="number" min="0" max="100" step="0.01" value={f.cargas} onChange={set('cargas')} />
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Contribuciones patronales + ART + seguro de vida. Pedile el número a la contadora.
            </div>
          </div>
          <div className={s.field}>
            <label>Costo de un mes</label>
            <div className={s.hint} style={{ margin: 0 }}>
              {Number(f.bruto) > 0
                ? <>{money(prev.total)} <span className={s.muted}>(cargas {money(prev.cargas)} · aguinaldo {money(prev.aguinaldo)})</span></>
                : 'Sueldo + cargas + 1/12 de aguinaldo.'}
            </div>
          </div>
        </div>
      )}

      {editando && (
        <>
          <div className={s['section-title']}>Sueldos</div>
          {e.sueldos?.length > 0 && e.sueldos[0].desde > String(f.alta).slice(0, 7) && (
            <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
              Entre el alta ({mesLargo(String(f.alta).slice(0, 7))}) y {mesLargo(e.sueldos[0].desde)} no tiene sueldo cargado: esos meses cuentan $0.
              Cargá el sueldo «vigente desde» el mes del alta.
            </div>
          )}
          <Table cols={[{ h: 'Vigente desde' }, { h: 'Bruto', num: true }, { h: 'Cargas', num: true }, { h: 'Costo del mes', num: true }, { h: '' }]}>
            {(e.sueldos ?? []).map((x) => (
              <tr key={x.id}>
                <td>{mesLargo(x.desde)}</td>
                <td className={s.num}>{money(x.bruto)}</td>
                <td className={s.num}>{x.cargas} %</td>
                <td className={s.num}>{money(costoMensual(x.bruto, x.cargas).total)}</td>
                <td>{e.sueldos.length > 1 && <Btn small variant="btn-delete" onClick={() => borrarSueldo(x.id)}>Borrar</Btn>}</td>
              </tr>
            ))}
          </Table>
          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Aumento o cambio · vigente desde</label>
              <input type="month" value={nuevo.desde} onChange={setN('desde')} />
            </div>
            <div className={s.field}>
              <label>Sueldo bruto</label>
              <input type="number" min="0" step="0.01" value={nuevo.bruto} onChange={setN('bruto')} />
            </div>
            <div className={s.field}>
              <label>Cargas (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={nuevo.cargas} onChange={setN('cargas')} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn variant="btn-primary" small onClick={agregarSueldo}>Guardar sueldo</Btn>
            {Number(nuevo.bruto) > 0 && <span className={s.hint} style={{ margin: 0 }}>Costo de un mes: {money(prevNuevo.total)}</span>}
            <span className={s.hint} style={{ margin: 0 }}>Si ya hay uno de ese mes, se corrige.</span>
          </div>
        </>
      )}
    </ModalShell>
  );
}

export function BienFormModal({ bien, sucursales = [], onChange }) {
  const { act, closeModal, toast } = useGastos();
  const unaVez = useUnaVez();
  const editando = !!bien;
  const [f, setF] = useState({
    nombre: bien?.nombre ?? '', sucursalId: bien?.sucursalId ?? '', valor: bien?.valor ?? '',
    alta: bien?.alta?.slice(0, 7) ?? periodoISO(), vidaMeses: bien?.vidaMeses ?? 60,
    baja: bien?.baja ?? '', observaciones: bien?.observaciones ?? '',
  });
  const [borrando, setBorrando] = useState(false);
  const set = (k) => (ev) => setF((x) => ({ ...x, [k]: ev.target.value }));

  const guardar = () => unaVez(async () => {
    if (!f.nombre.trim()) { toast('Poné qué es el bien (ej.: «Heladera exhibidora»).', 'err'); return; }
    if (!(Number(f.valor) > 0)) { toast('Poné el valor (sin IVA).', 'err'); return; }
    if (!(Number(f.vidaMeses) >= 1 && Number(f.vidaMeses) <= 600)) { toast('La vida útil va en meses (de 1 a 600).', 'err'); return; }
    const payload = {
      nombre: f.nombre.trim(), sucursalId: f.sucursalId ? Number(f.sucursalId) : null, valor: r2(f.valor),
      alta: f.alta, vidaMeses: Math.round(Number(f.vidaMeses)), observaciones: f.observaciones.trim(),
      ...(editando ? { baja: f.baja || null } : {}),
    };
    const ok = await act(editando ? gastosApi.editarBien(bien.id, payload) : gastosApi.crearBien(payload), editando ? 'Bien actualizado.' : 'Bien cargado.');
    if (ok) onChange?.();
  });

  const borrar = () => unaVez(async () => {
    if (!borrando) { setBorrando(true); return; }
    const ok = await act(gastosApi.borrarBien(bien.id), 'Bien borrado.');
    if (ok) onChange?.();
  });

  return (
    <ModalShell
      title={editando ? bien.nombre : 'Nuevo bien de uso'}
      subtitle="Se amortiza en línea recta: el valor dividido la vida útil, cada mes"
      wide
      onClose={closeModal}
      footer={[
        ...(editando ? [{ texto: borrando ? 'Sí, borrar' : 'Borrar', clase: 'btn-delete', onClick: borrar }] : []),
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {borrando && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          ¿Borrar <strong>{bien.nombre}</strong>? Su amortización sale de todos los meses. Si se vendió o se tiró, mejor poné la <strong>baja</strong>.
        </div>
      )}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Qué es <span className={s.req}>*</span></label>
          <input autoFocus value={f.nombre} maxLength={120} placeholder="Ej.: Heladera exhibidora" onChange={set('nombre')} />
        </div>
        <div className={s.field}>
          <label>Local</label>
          <SelectorLocal valor={f.sucursalId} onChange={set('sucursalId')} sucursales={sucursales} textoSinLocal="Toda la empresa (se reparte por ventas)" />
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Valor sin IVA <span className={s.req}>*</span></label>
          <input type="number" min="0" step="0.01" value={f.valor} onChange={set('valor')} />
        </div>
        <div className={s.field}>
          <label>Mes de alta <span className={s.req}>*</span></label>
          <input type="month" value={f.alta} onChange={set('alta')} />
        </div>
        <div className={s.field}>
          <label>Vida útil (meses) <span className={s.req}>*</span></label>
          <input type="number" min="1" max="600" step="1" value={f.vidaMeses} onChange={set('vidaMeses')} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Referencia: heladeras y balanzas 60 a 120 meses; reformas, lo que dure el alquiler.
            {Number(f.valor) > 0 && Number(f.vidaMeses) > 0 && ` Cuota: ${money(cuotaMensual(f.valor, f.vidaMeses))} por mes.`}
          </div>
        </div>
      </div>
      <div className={s['form-grid']}>
        {editando && (
          <div className={s.field}>
            <label>Baja</label>
            <input type="date" value={f.baja} onChange={set('baja')} />
            <div className={s.hint} style={{ margin: '6px 0 0' }}>Si se vendió o se tiró: deja de amortizarse después de ese mes.</div>
          </div>
        )}
        <div className={s.field}>
          <label>Observaciones</label>
          <input value={f.observaciones} maxLength={300} placeholder="Opcional" onChange={set('observaciones')} />
        </div>
      </div>
    </ModalShell>
  );
}
