import { useEffect, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../../context/GastosContext.jsx';
import { gastosApi } from '../../services/gastos.api.js';
import { FRECUENCIAS, r2 } from '../../domain/constants.js';
import { ModalShell, money, s } from '../ui.jsx';

/* ==================================================================== *
 * Rubros
 * ==================================================================== */

export function CategoriaFormModal({ categoriaId }) {
  const { getCategoria, act, closeModal, toast } = useGastos();
  const original = categoriaId ? getCategoria(categoriaId) : null;

  const [f, setF] = useState({
    nombre: '', tipo: 'variable', descripcion: '', orden: 500, activa: true,
  });

  useEffect(() => {
    if (original) {
      setF({
        nombre: original.nombre,
        tipo: original.tipo,
        descripcion: original.descripcion ?? '',
        orden: original.orden,
        activa: original.activa,
      });
    }
  }, [original]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async () => {
    if (!f.nombre.trim()) { toast('Poné el nombre del rubro.', 'err'); return; }
    const payload = {
      nombre: f.nombre.trim(),
      tipo: f.tipo,
      descripcion: f.descripcion.trim(),
      orden: Number(f.orden) || 500,
      activa: !!f.activa,
    };
    await act(
      categoriaId ? gastosApi.editarCategoria(categoriaId, payload) : gastosApi.crearCategoria(payload),
      categoriaId ? 'Rubro actualizado.' : 'Rubro creado.',
      { recargar: true },
    );
  };

  return (
    <ModalShell
      title={categoriaId ? 'Editar rubro' : 'Nuevo rubro de gasto'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.field}>
        <label>Nombre <span className={s.req}>*</span></label>
        <input autoFocus value={f.nombre} placeholder="Ej: Combustible" onChange={set('nombre')} />
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo</label>
          <select value={f.tipo} onChange={set('tipo')}>
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
          </select>
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            <strong>Fijo</strong>: se repite todos los meses pase lo que pase (alquiler, seguro).
            <strong> Variable</strong>: depende de la actividad (combustible, fletes).
          </div>
        </div>
        <div className={s.field}>
          <label>Orden en los selectores</label>
          <input type="number" min="0" step="10" value={f.orden} onChange={set('orden')} />
        </div>
      </div>

      <div className={s.field}>
        <label>Descripción</label>
        <input value={f.descripcion} placeholder="Qué entra en este rubro" onChange={set('descripcion')} />
      </div>

      {categoriaId && (
        <div className={s.field}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={!!f.activa}
              onChange={(e) => setF((x) => ({ ...x, activa: e.target.checked }))}
            />
            Activo (aparece al cargar gastos)
          </label>
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Destildado, deja de ofrecerse pero los gastos históricos lo conservan.
          </div>
        </div>
      )}
    </ModalShell>
  );
}

export function BorrarCategoriaModal({ categoriaId }) {
  const { getCategoria, act, closeModal } = useGastos();
  const c = getCategoria(categoriaId);

  const borrar = () => act(gastosApi.borrarCategoria(categoriaId), 'Rubro eliminado.', { recargar: true });

  return (
    <ModalShell
      title={`Eliminar "${c?.nombre || ''}"`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Eliminar', clase: 'btn-delete', onClick: borrar },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        Solo se puede eliminar un rubro que <strong>no tenga ningún gasto imputado</strong>. Si
        tiene historia, la API lo va a rechazar: en ese caso editalo y destildá «Activo» para que
        deje de aparecer sin romper los informes viejos.
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Gastos fijos (plantillas)
 * ==================================================================== */

export function RecurrenteFormModal({ recurrenteId, onChange }) {
  const { recurrentes, categoriasActivas, proveedores, sucursales, act, closeModal, toast } = useGastos();
  const original = recurrenteId ? recurrentes.find((r) => r.id === recurrenteId) : null;

  const [f, setF] = useState({
    nombre: '', categoriaId: '', proveedorId: '', sucursalId: '',
    importeEstimado: '', frecuencia: 'mensual', diaVencimiento: 10, activo: true, observaciones: '',
  });

  useEffect(() => {
    if (!original) return;
    setF({
      nombre: original.nombre,
      categoriaId: original.categoriaId ?? '',
      proveedorId: original.proveedorId ?? '',
      sucursalId: original.sucursalId ?? '',
      importeEstimado: original.importeEstimado || '',
      frecuencia: original.frecuencia,
      diaVencimiento: original.diaVencimiento,
      activo: original.activo,
      observaciones: original.observaciones ?? '',
    });
  }, [original]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async () => {
    if (!f.nombre.trim()) { toast('Poné un nombre (ej.: "Alquiler del local").', 'err'); return; }
    if (!f.categoriaId) { toast('Elegí el rubro.', 'err'); return; }
    const payload = {
      nombre: f.nombre.trim(),
      categoriaId: Number(f.categoriaId),
      proveedorId: f.proveedorId ? Number(f.proveedorId) : null,
      sucursalId: f.sucursalId ? Number(f.sucursalId) : null,
      importeEstimado: r2(f.importeEstimado),
      frecuencia: f.frecuencia,
      diaVencimiento: Number(f.diaVencimiento) || 10,
      activo: !!f.activo,
      observaciones: f.observaciones.trim(),
    };
    const ok = await act(
      recurrenteId ? gastosApi.editarRecurrente(recurrenteId, payload) : gastosApi.crearRecurrente(payload),
      recurrenteId ? 'Gasto fijo actualizado.' : 'Gasto fijo creado.',
      { recargar: true },
    );
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title={recurrenteId ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}
      subtitle="Es una plantilla: el gasto real se genera cada período"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.field}>
        <label>Nombre <span className={s.req}>*</span></label>
        <input autoFocus value={f.nombre} placeholder="Ej: Alquiler del depósito" onChange={set('nombre')} />
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Rubro <span className={s.req}>*</span></label>
          <select value={f.categoriaId} onChange={set('categoriaId')}>
            <option value="">Elegí el rubro</option>
            {categoriasActivas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Proveedor</label>
          <select value={f.proveedorId} onChange={set('proveedorId')}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Sucursal</label>
          <select value={f.sucursalId} onChange={set('sucursalId')}>
            <option value="">Toda la empresa</option>
            {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Importe estimado</label>
          <input type="number" min="0" step="0.01" value={f.importeEstimado} onChange={set('importeEstimado')} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Referencia, no verdad: el importe real lo trae la factura del mes.
            {Number(f.importeEstimado) > 0 && ` Hoy: ${money(r2(f.importeEstimado))}.`}
          </div>
        </div>
        <div className={s.field}>
          <label>Frecuencia</label>
          <select value={f.frecuencia} onChange={set('frecuencia')}>
            {Object.entries(FRECUENCIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Vence el día</label>
          <input type="number" min="1" max="31" value={f.diaVencimiento} onChange={set('diaVencimiento')} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Si el mes no llega a ese día (31 en febrero), se usa el último.
          </div>
        </div>
      </div>

      <div className={s.field}>
        <label>Observaciones</label>
        <input value={f.observaciones} placeholder="Opcional" onChange={set('observaciones')} />
      </div>

      {recurrenteId && (
        <div className={s.field}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={!!f.activo}
              onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))}
            />
            Activo (se sigue generando cada período)
          </label>
        </div>
      )}
    </ModalShell>
  );
}

export function BorrarRecurrenteModal({ recurrenteId, onChange }) {
  const { recurrentes, act, closeModal } = useGastos();
  const r = recurrentes.find((x) => x.id === recurrenteId);

  const borrar = async () => {
    const ok = await act(gastosApi.borrarRecurrente(recurrenteId), 'Gasto fijo eliminado.', { recargar: true });
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title={`Eliminar "${r?.nombre || ''}"`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Eliminar', clase: 'btn-delete', onClick: borrar },
      ]}
    >
      <div className={s.callout}>
        Se borra la <strong>plantilla</strong>: deja de generar gastos. Los que ya generó son
        comprobantes reales y quedan intactos en el historial.
      </div>
      <div className={s.hint}>
        Si solo querés pausarlo un tiempo, editalo y destildá «Activo».
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Proveedor (el mismo padrón de Compras)
 * ==================================================================== */

/**
 * `proveedor` es la FICHA COMPLETA, no un id: la manda el panel, que es quien
 * pide el padrón entero. Antes salía del contexto —que trae una versión
 * recortada para los selectores— y como el guardado reenvía todos los campos,
 * editar acá le borraba al proveedor el CUIT, la dirección, el teléfono y el
 * mail, y lo pasaba a Responsable Inscripto. El CUIT es, además, lo que usa la
 * bandeja de facturas de Compras para reconocer de quién es un comprobante.
 */
export function ProveedorFormModal({ proveedor: original = null, onChange }) {
  const { act, closeModal, toast } = useGastos();

  const [f, setF] = useState({
    nombre: '', cuit: '', condicionIva: 'responsable_inscripto', direccion: '', telefono: '', email: '',
    proveeMercaderia: false, proveeGastos: true,
    /** La letra que factura (0067): la carga de gastos la precarga. '' = sin definir. */
    letraGasto: '',
  });

  useEffect(() => {
    if (!original) return;
    setF({
      nombre: original.nombre,
      cuit: original.cuit ?? '',
      condicionIva: original.condicionIva ?? 'responsable_inscripto',
      direccion: original.direccion ?? '',
      telefono: original.telefono ?? '',
      email: original.email ?? '',
      proveeMercaderia: !!original.proveeMercaderia,
      proveeGastos: !!original.proveeGastos,
      letraGasto: original.letraGasto ?? '',
    });
  }, [original]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setBool = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.checked }));

  const guardar = async () => {
    if (!f.nombre.trim()) { toast('Poné el nombre del proveedor.', 'err'); return; }
    if (!f.proveeMercaderia && !f.proveeGastos) {
      toast('Marcá al menos qué provee: mercadería, gastos o las dos cosas.', 'err');
      return;
    }
    const payload = { ...f, nombre: f.nombre.trim(), cuit: f.cuit.trim() };
    const ok = await act(
      original ? gastosApi.editarProveedor(original.id, payload) : gastosApi.crearProveedor(payload),
      original ? 'Proveedor actualizado.' : 'Proveedor creado.',
      { recargar: true },
    );
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title={original ? 'Editar proveedor' : 'Nuevo proveedor'}
      subtitle="Es el mismo padrón que usa Compras"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Nombre <span className={s.req}>*</span></label>
          <input autoFocus value={f.nombre} placeholder="Ej: Plomería Pérez" onChange={set('nombre')} />
        </div>
        <div className={s.field}>
          <label>CUIT</label>
          <input value={f.cuit} placeholder="30-12345678-9" onChange={set('cuit')} />
        </div>
        <div className={s.field}>
          <label>Qué factura hace</label>
          {/* La respuesta que hace simple la carga: se contesta UNA vez acá y
              el formulario de gasto precarga la letra en cada factura de este
              proveedor (editable — la excepción existe). */}
          <select value={f.letraGasto} onChange={set('letraGasto')}>
            <option value="">No sé todavía</option>
            <option value="A">Factura A</option>
            <option value="B">Factura B</option>
            <option value="C">Factura C</option>
            <option value="X">X / sin letra</option>
          </select>
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
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Define si su factura discrimina IVA: un monotributista factura sin IVA.
          </div>
        </div>
        <div className={s.field}>
          <label>Teléfono</label>
          <input value={f.telefono} onChange={set('telefono')} />
        </div>
        <div className={s.field}>
          <label>Dirección</label>
          <input value={f.direccion} onChange={set('direccion')} />
        </div>
        <div className={s.field}>
          <label>Email</label>
          <input value={f.email} onChange={set('email')} />
        </div>
      </div>

      <div className={s['section-title']}>Qué provee</div>
      <div className={s.field}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={f.proveeMercaderia} onChange={setBool('proveeMercaderia')} />
          Mercadería (aparece en Compras)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={f.proveeGastos} onChange={setBool('proveeGastos')} />
          Gastos (aparece en Gastos)
        </label>
        <div className={s.hint} style={{ margin: '8px 0 0' }}>
          Pueden estar las dos tildadas: el que trae la mercadería y además te cobra el flete es
          un solo proveedor, con un solo CUIT y una sola cuenta corriente.
        </div>
      </div>
    </ModalShell>
  );
}
