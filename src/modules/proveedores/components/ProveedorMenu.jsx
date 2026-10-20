/**
 * EL NOMBRE DEL PROVEEDOR CON SU MENÚ (5/10/2026, pedido del dueño): clic en
 * el nombre de una tarjeta de Pedidos y se abren los atajos — su stock, su
 * estado de cuenta, sus últimos ingresos y su WhatsApp (13/10) — para decidir
 * el pedido sin salir de la pizarra. Los datos se piden recién al abrir cada ventana.
 * En el padrón (`enPadron`, 13/10) ofrece crear la orden de pedido, su estado de cuenta e ir a WhatsApp.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, MenuItem, ListItemIcon, Typography, Divider } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { cx } from '@shared/utils/classNames.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { telefonoWa } from '@modules/ventas/domain/constants.js';
import { abrirWhatsApp } from '@shared/utils/whatsapp.js';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { provApi } from '../services/proveedores.api.js';
import { ModalShell, Table, money, fmtFecha, s } from './ui.jsx';

const TIPO = { factura: 'Factura', remito: 'Remito', liquidacion: 'Liquidación' };
const cant = (n, tipo) => `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 })}${tipo === 'granel' ? ' kg' : ''}`;
const nroDe = (c) => `${TIPO[c.tipo] ?? c.tipo}${c.tipo === 'factura' ? ` ${c.letra}` : ''} ${c.puntoVenta}-${String(c.numero ?? 0).padStart(8, '0')}`;

export function ProveedorMenu({ proveedorId, nombre, enPadron = false }) {
  const { openModal, goPanel, panels, panel, getProveedor } = useProveedores();
  const [anchor, setAnchor] = useState(null);
  /* El celular de la ficha en el formato de WhatsApp (el mismo que usa la orden de pedido): solo con el menú abierto. */
  const whatsapp = anchor ? telefonoWa(getProveedor(proveedorId)?.telefono) : '';
  const cerrar = () => setAnchor(null);
  /* El estado de cuenta es otra sección: se ofrece solo si este usuario la tiene. */
  const veEdoc = (panels ?? []).some((p) => p.id === 'edoc');
  /* «Ver stock» lleva a Almacén › Existencias con la orden de pedido de este
   * proveedor abierta (12/10/2026, pedido del dueño). Sin esa sección, la
   * ventanita de stock de siempre. Al cerrarla vuelve a esta sección (20/10/2026). */
  const { can } = usePermissions();
  const navigate = useNavigate();
  const puedeOrden = can('almacen.existencias');
  const crearOrden = () => navigate(`/almacen?panel=existencias&ordenPedido=${proveedorId}&volver=${encodeURIComponent(`/proveedores?panel=${panel}`)}`);
  const verStock = puedeOrden ? crearOrden : () => openModal('stockProveedor', { proveedorId, nombre });
  const ir = (fn) => () => { cerrar(); fn(); };
  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        title={enPadron ? 'Orden de pedido, estado de cuenta y WhatsApp' : 'Ver stock, estado de cuenta e ingresos'}
        style={{
          all: 'unset', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2,
          textDecoration: 'underline', textDecorationColor: 'var(--crm-color-border, #ccc)', textUnderlineOffset: 3,
        }}
      >
        {nombre}
        <ExpandMoreIcon fontSize="small" style={{ opacity: 0.6 }} />
      </button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={cerrar}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {nombre}
        </Typography>
        <Divider />
        {enPadron && puedeOrden && (
          <MenuItem onClick={ir(crearOrden)}>
            <ListItemIcon><PostAddOutlinedIcon fontSize="small" /></ListItemIcon>
            Crear orden de pedido
          </MenuItem>
        )}
        {!enPadron && (
          <MenuItem onClick={ir(verStock)}>
            <ListItemIcon><Inventory2OutlinedIcon fontSize="small" /></ListItemIcon>
            Ver stock
          </MenuItem>
        )}
        {veEdoc && (
          <MenuItem onClick={ir(() => goPanel('edoc', { proveedorId }))}>
            <ListItemIcon><AccountBalanceWalletOutlinedIcon fontSize="small" /></ListItemIcon>
            Ver estado de cuenta
          </MenuItem>
        )}
        {!enPadron && (
          <MenuItem onClick={ir(() => openModal('ingresosProveedor', { proveedorId, nombre }))}>
            <ListItemIcon><LocalShippingOutlinedIcon fontSize="small" /></ListItemIcon>
            Ver sus últimos ingresos
          </MenuItem>
        )}
        <MenuItem disabled={!whatsapp} onClick={ir(() => abrirWhatsApp(whatsapp))}>
          <ListItemIcon><WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} /></ListItemIcon>
          {whatsapp ? 'Ir a WhatsApp' : 'WhatsApp: sin celular en la ficha'}
        </MenuItem>
      </Menu>
    </>
  );
}

/** Los productos que trae el proveedor con su stock: los que menos tienen, arriba. */
export function StockProveedorModal({ proveedorId, nombre }) {
  const { closeModal } = useProveedores();
  const { data, loading, error } = useResource(`prov-stock:${proveedorId}`, () => provApi.stockProveedor(proveedorId));
  const filas = data ?? [];
  const sinStock = filas.filter((p) => p.disponible <= 1e-9).length;
  return (
    <ModalShell title={`Stock de ${nombre}`} subtitle={loading ? 'Cargando…' : `${filas.length} producto(s) · ${sinStock} sin stock`} wide onClose={closeModal} footer={[{ texto: 'Cerrar', onClick: closeModal }]}>
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      <Table cols={[{ h: 'Producto' }, { h: 'Disponible', num: true }, { h: 'Por sucursal' }, { h: 'En camino', num: true }]} empty={loading ? 'Cargando…' : 'Este proveedor no tiene productos cargados en su lista.'}>
        {filas.map((p) => (
          <tr key={p.id}>
            <td>{p.nombre}{p.estado === 'discontinuado' && <span className={s.muted}> · discontinuado</span>}{p.codigo && <div className={s.hint} style={{ margin: 0 }}>{p.codigo}</div>}</td>
            <td className={s.num}>
              <strong style={{ color: p.disponible <= 1e-9 ? 'var(--crm-color-danger)' : undefined }}>{p.disponible <= 1e-9 ? 'sin stock' : cant(p.disponible, p.tipo)}</strong>
            </td>
            <td className={s.hint} style={{ margin: 0 }}>{(p.porSucursal ?? []).map((x) => `${x.sucursal}: ${cant(x.cantidad, p.tipo)}`).join(' · ') || '—'}</td>
            <td className={s.num}>{p.enCamino > 1e-9 ? cant(p.enCamino, p.tipo) : <span className={s.muted}>—</span>}</td>
          </tr>
        ))}
      </Table>
    </ModalShell>
  );
}

/** Las últimas facturas / remitos del proveedor, con lo que trajo cada una (se despliega). */
export function IngresosProveedorModal({ proveedorId, nombre }) {
  const { closeModal } = useProveedores();
  const { data, loading, error } = useResource(`prov-ingresos-cpbte:${proveedorId}`, () => provApi.ingresosProveedor(proveedorId));
  const [abierto, setAbierto] = useState(null);
  const filas = data ?? [];
  return (
    <ModalShell title={`Últimos ingresos de ${nombre}`} subtitle="Las últimas facturas, remitos y liquidaciones cargadas en Compras." wide onClose={closeModal} footer={[{ texto: 'Cerrar', onClick: closeModal }]}>
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      <Table cols={[{ h: 'Fecha' }, { h: 'Comprobante' }, { h: 'Sucursal' }, { h: 'Productos', num: true }, { h: 'Total', num: true }]} empty={loading ? 'Cargando…' : 'Todavía no hay comprobantes de este proveedor.'}>
        {filas.map((c) => [
          <tr key={c.id} className={s.clickable} onClick={() => setAbierto(abierto === c.id ? null : c.id)} title="Ver qué trajo">
            <td>{fmtFecha(c.fecha)}</td>
            <td>{abierto === c.id ? '▾ ' : '▸ '}{nroDe(c)}{c.recepcion && <span className={s.muted}> · ingresó mercadería</span>}</td>
            <td>{c.sucursal || '—'}</td>
            <td className={s.num}>{(c.items ?? []).length}</td>
            <td className={s.num}><strong>{money(c.total)}</strong></td>
          </tr>,
          abierto === c.id && (
            <tr key={`${c.id}-d`}>
              <td colSpan={5} style={{ background: 'var(--crm-color-surface-2)' }}>
                {(c.items ?? []).length
                  ? (c.items).map((it, i) => <div key={i} className={s.hint} style={{ margin: 0 }}>{cant(it.cantidad, it.tipo)} · {it.nombre}</div>)
                  : <span className={s.muted}>Sin renglones cargados.</span>}
              </td>
            </tr>
          ),
        ])}
      </Table>
    </ModalShell>
  );
}
