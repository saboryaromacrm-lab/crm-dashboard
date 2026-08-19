import { useEffect, useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { provApi, MEDIOS_HABITUALES, CONDICIONES_COMPRA } from '../../services/proveedores.api.js';
import { Btn, ModalShell, s } from '../ui.jsx';

/**
 * LA FICHA COMPLETA del proveedor — la única del sistema desde 0068: los ABM
 * chicos de Compras y Gastos se fueron y todo apunta acá. Junta lo fiscal
 * (CUIT, condición de IVA, letra), la clasificación (mercadería/gastos) y lo
 * COMERCIAL de la app vieja: qué emite, cómo cobra, a cuántos días, el modo
 * de cuenta y las cuentas bancarias.
 */
export function FichaProveedorModal({ proveedorId, onChange }) {
  const { getProveedor, act, closeModal, toast } = useProveedores();
  const editando = !!proveedorId;
  const original = editando ? getProveedor(proveedorId) : null;

  const [f, setF] = useState({
    nombre: '', cuit: '', email: '', telefono: '', direccion: '',
    condicionIva: 'responsable_inscripto',
    proveeMercaderia: true, proveeGastos: false, letraGasto: '',
    condicionCompra: 'factura', medioHabitual: '', diasPago: '', modoCuenta: 'facturas',
    porcSinFactura: '',
  });
  const [cuentas, setCuentas] = useState([{ cbuAlias: '', descripcion: '' }]);

  useEffect(() => {
    if (!original) return;
    setF({
      nombre: original.nombre ?? '', cuit: original.cuit ?? '', email: original.email ?? '',
      telefono: original.telefono ?? '', direccion: original.direccion ?? '',
      condicionIva: original.condicionIva ?? 'responsable_inscripto',
      proveeMercaderia: !!original.proveeMercaderia, proveeGastos: !!original.proveeGastos,
      letraGasto: original.letraGasto ?? '',
      condicionCompra: original.condicionCompra ?? 'factura',
      medioHabitual: original.medioHabitual ?? '',
      diasPago: original.diasPago ?? '',
      modoCuenta: original.modoCuenta ?? 'facturas',
      porcSinFactura: original.porcSinFactura ? String(original.porcSinFactura) : '',
    });
  }, [original]);

  const { data: cuentasApi } = useResource(
    `prov-cuentas:${proveedorId ?? 'nuevo'}`,
    () => provApi.cuentas(proveedorId),
    { enabled: editando },
  );
  useEffect(() => {
    if (cuentasApi?.length) {
      setCuentas(cuentasApi.map((c) => ({ cbuAlias: c.cbuAlias, descripcion: c.descripcion })));
    }
  }, [cuentasApi]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setBool = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.checked }));
  const setCta = (i, k) => (e) => setCuentas((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));

  const esDiferido = f.medioHabitual === 'cta_cte' || f.medioHabitual === 'echeq';

  const guardar = async () => {
    if (!f.nombre.trim()) { toast('El nombre es obligatorio.', 'err'); return; }
    if (esDiferido && !(Number(f.diasPago) > 0)) {
      toast('Un proveedor diferido necesita sus días de plazo ("Cta cte 15").', 'err');
      return;
    }
    const payload = {
      nombre: f.nombre.trim(), cuit: f.cuit.trim(), email: f.email.trim(),
      telefono: f.telefono.trim(), direccion: f.direccion.trim(),
      condicionIva: f.condicionIva,
      proveeMercaderia: f.proveeMercaderia, proveeGastos: f.proveeGastos,
      letraGasto: f.letraGasto,
      condicionCompra: f.condicionCompra,
      medioHabitual: f.medioHabitual,
      diasPago: f.diasPago === '' ? null : Number(f.diasPago),
      modoCuenta: f.modoCuenta,
      /* El % sin factura del proveedor: liquidación pura sin número = 100 (es
       * lo único que puede querer decir), factura pura = 0 siempre. */
      porcSinFactura: f.condicionCompra === 'factura'
        ? 0
        : (f.porcSinFactura === '' ? (f.condicionCompra === 'liquidacion' ? 100 : 0) : Number(f.porcSinFactura)),
    };
    const res = await act(
      editando ? provApi.editarProveedor(proveedorId, payload) : provApi.crearProveedor(payload),
      editando ? 'Proveedor actualizado.' : 'Proveedor creado.',
      { recargar: true },
    );
    if (!res) return;
    const id = editando ? proveedorId : res.id;
    const filas = cuentas.filter((c) => c.cbuAlias.trim());
    try { await provApi.guardarCuentas(id, filas); } catch { toast('La ficha se guardó, pero las cuentas bancarias no.', 'err'); }
    onChange?.();
  };

  return (
    <ModalShell
      title={editando ? `Ficha de ${original?.nombre ?? 'proveedor'}` : 'Nuevo proveedor'}
      subtitle="La ficha única: fiscal, clasificación y lo comercial"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: editando ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['section-title']}>Identidad</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Nombre <span className={s.req}>*</span></label>
          <input value={f.nombre} onChange={set('nombre')} autoFocus={!editando} />
        </div>
        <div className={s.field}>
          <label>CUIT</label>
          <input value={f.cuit} onChange={set('cuit')} placeholder="30-12345678-9" />
        </div>
        <div className={s.field}>
          <label>Email</label>
          <input value={f.email} onChange={set('email')} placeholder="Opcional" />
        </div>
        <div className={s.field}>
          <label>Teléfono</label>
          <input value={f.telefono} onChange={set('telefono')} placeholder="Opcional" />
        </div>
      </div>

      <div className={s['section-title']}>Cómo trabaja</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Qué emite</label>
          {/* La "liquidación" es la mitad sin factura (el "remito" de la app vieja). */}
          <select value={f.condicionCompra} onChange={set('condicionCompra')}>
            {Object.entries(CONDICIONES_COMPRA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Sin factura %</label>
          <input
            type="number" min="0" max="100" step="0.01"
            value={f.condicionCompra === 'factura' ? '' : f.porcSinFactura}
            onChange={set('porcSinFactura')}
            placeholder={f.condicionCompra === 'liquidacion' ? '100' : f.condicionCompra === 'mixto' ? 'Ej: 50' : 'Solo liquidación/mixto'}
            disabled={f.condicionCompra === 'factura'}
          />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Qué parte del valor viene sin factura. Precarga los formatos de compra nuevos
            de este proveedor; el que manda para cada producto es el del formato.
          </div>
        </div>
        <div className={s.field}>
          <label>Cómo cobra habitualmente</label>
          {/* Cta cte y Echeq son los DIFERIDOS: la factura confirmada genera
              su compromiso con el plazo de abajo. */}
          <select value={f.medioHabitual} onChange={set('medioHabitual')}>
            <option value="">Sin definir</option>
            {Object.entries(MEDIOS_HABITUALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Días de plazo</label>
          <input
            type="number" min="0" max="365" value={f.diasPago} onChange={set('diasPago')}
            placeholder={esDiferido ? 'Ej: 15' : 'Solo diferidos'} disabled={!esDiferido}
          />
        </div>
        <div className={s.field}>
          <label>Modo de cuenta</label>
          <select value={f.modoCuenta} onChange={set('modoCuenta')}>
            <option value="facturas">Por facturas (se pagan completas)</option>
            <option value="libre">Libre (pagos a cuenta)</option>
          </select>
        </div>
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Clasificación</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={f.proveeMercaderia} onChange={setBool('proveeMercaderia')} />
            Provee mercadería (aparece en Compras)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={f.proveeGastos} onChange={setBool('proveeGastos')} />
            Factura gastos (aparece en Gastos)
          </label>
        </div>
        <div className={s.field}>
          <label>Condición de IVA</label>
          <select value={f.condicionIva} onChange={set('condicionIva')}>
            <option value="responsable_inscripto">Responsable inscripto</option>
            <option value="monotributo">Monotributo</option>
            <option value="exento">Exento</option>
            <option value="consumidor_final">Consumidor final</option>
            <option value="no_categorizado">No categorizado</option>
          </select>
        </div>
        <div className={s.field}>
          <label>Letra que factura (gastos)</label>
          <select value={f.letraGasto} onChange={set('letraGasto')}>
            <option value="">No sé todavía</option>
            {['A', 'B', 'C', 'X'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Dirección</label>
          <input value={f.direccion} onChange={set('direccion')} placeholder="Opcional" />
        </div>
      </div>

      <div className={s['section-title']}>Cuentas bancarias</div>
      {cuentas.map((cta, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <input
            value={cta.cbuAlias} placeholder="CBU de 22 dígitos o alias"
            onChange={setCta(i, 'cbuAlias')} style={{ flex: 1 }}
          />
          <input
            value={cta.descripcion} placeholder="Descripción (Galicia, del titular…)"
            onChange={setCta(i, 'descripcion')} style={{ flex: 1 }}
          />
          {cuentas.length > 1 && (
            <Btn small onClick={() => setCuentas((xs) => xs.filter((_, j) => j !== i))}>×</Btn>
          )}
        </div>
      ))}
      {cuentas.length < 5 && (
        <Btn small onClick={() => setCuentas((xs) => [...xs, { cbuAlias: '', descripcion: '' }])}>
          + Agregar cuenta
        </Btn>
      )}
    </ModalShell>
  );
}
