import { useState } from 'react';
import { useProductos } from '../../context/ProductosContext.jsx';
import { ModalShell } from '../Modal.jsx';
import { s } from '../ui.jsx';

/* ---- Nueva sucursal ---- */
export function SucursalModal() {
  const { store, act, closeModal } = useProductos();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('express');
  return (
    <ModalShell
      title="Nueva sucursal"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Crear', clase: 'btn-primary', onClick: () => act(store.crearSucursal({ nombre: nombre.trim(), tipo }), 'Sucursal creada.') },
      ]}
    >
      <div className={s.field}>
        <label>Nombre <span className={s.req}>*</span></label>
        <input value={nombre} placeholder="Ej: Express 4" onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className={s.field}>
        <label>Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="express">Express (minorista)</option>
          <option value="distribuidora">Distribuidora (mayorista+minorista)</option>
        </select>
      </div>
    </ModalShell>
  );
}

