import { useState } from 'react';
import { useProductos } from '../../context/ProductosContext.jsx';
import { ModalShell } from '../Modal.jsx';
import { s } from '../ui.jsx';

/* ---- Alta / edición de proveedor ---- */
export function ProveedorFormModal({ provId }) {
  const { store, act, closeModal, toast } = useProductos();
  const prov = provId != null ? store.getProveedor(provId) : null;
  const ed = !!prov;

  const [nombre, setNombre] = useState(prov?.nombre || '');
  const [cuit, setCuit] = useState(prov?.cuit || '');
  const [telefono, setTelefono] = useState(prov?.telefono || '');
  const [email, setEmail] = useState(prov?.email || '');
  const [direccion, setDireccion] = useState(prov?.direccion || '');

  const guardar = () => {
    if (!nombre.trim()) { toast('El nombre comercial es obligatorio.', 'err'); return; }
    const o = { nombre, cuit, telefono, email, direccion };
    act(prov ? store.editarProveedor(prov.id, o) : store.crearProveedor(o), prov ? 'Proveedor actualizado.' : 'Proveedor creado.');
  };

  return (
    <ModalShell
      title={ed ? 'Editar proveedor' : 'Nuevo proveedor'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: ed ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.field}>
        <label>Nombre comercial <span className={s.req}>*</span></label>
        <input value={nombre} placeholder="Ej: Molino Sur" onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>CUIT</label>
          <input value={cuit} placeholder="30-71234567-9" onChange={(e) => setCuit(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Teléfono</label>
          <input value={telefono} placeholder="11-4000-0000" onChange={(e) => setTelefono(e.target.value)} />
        </div>
      </div>
      <div className={s.field}>
        <label>Email</label>
        <input value={email} placeholder="ventas@proveedor.com" onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className={s.field}>
        <label>Dirección</label>
        <input value={direccion} placeholder="Calle, número, localidad" onChange={(e) => setDireccion(e.target.value)} />
      </div>
    </ModalShell>
  );
}
