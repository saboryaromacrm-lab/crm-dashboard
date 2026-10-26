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
import { bultosDelRenglon, nombreBulto } from '@modules/productos/domain/bulto.js';
import { fmtTam } from '@modules/productos/domain/format.js';
import { abrirWhatsApp } from '@shared/utils/whatsapp.js';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { provApi } from '../services/proveedores.api.js';
import { ModalShell, Table, money, num, fmtFecha, s } from './ui.jsx';

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

/**
 * Lo que entró de un producto, como la factura: «4 bultos × 14 u. (56 u.)»,
 * «2 bolsas × 25 kg (50 kg)» o «56 u.»; lo bonificado, aparte
 * («2 bultos × 12 u. + 2 u. sin cargo (26 u.)», «18 u. (3 sin cargo)»).
 */
function cuantoEntro(it) {
  const granel = it.granel && !it.tamKg;
  const uni = granel ? 'kg' : 'u.';
  const total = `${num(it.cantidad, 3)} ${uni}`;
  const gratis = Number(it.sinCargo) || 0;
  const b = bultosDelRenglon(it.cantidad - gratis, it.porBulto);
  if (!b) return gratis ? `${total} (${num(gratis, 3)} sin cargo)` : total;
  return `${b} ${nombreBulto(b, granel)} × ${num(it.porBulto, 3)} ${uni}${gratis ? ` + ${num(gratis, 3)} ${uni} sin cargo` : ''} (${total})`;
}

/**
 * LA ÚLTIMA VEZ QUE ENTRÓ SU MERCADERÍA (26/10/2026, pedido del dueño): junto a
 * las notas del pedido, cuánto entró de cada producto en su último comprobante
 * con ingreso, para comparar con el pedido nuevo. Plegado (varios proveedores a
 * la vez) se pide recién al abrirlo.
 */
export function UltimoIngreso({ proveedorId, nombre, plegado = false }) {
  const [abierto, setAbierto] = useState(!plegado);
  const { data, loading, error } = useResource(
    `prov-ultimo-ingreso:${proveedorId}`, () => provApi.ultimoIngreso(proveedorId), { enabled: abierto },
  );
  const c = data?.ingreso;
  return (
    <details
      open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)}
      style={{ border: '1px solid var(--crm-color-border)', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        La última vez que entró mercadería{nombre ? ` de ${nombre}` : ''}
        {c && <span className={s.muted} style={{ fontWeight: 400 }}> · {fmtFecha(c.fecha)} · {nroDe(c)}{c.sucursal ? ` · ${c.sucursal}` : ''}</span>}
      </summary>
      <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
        {loading && <div className={s.hint} style={{ margin: 0 }}>Buscando…</div>}
        {error && <div className={s.hint} style={{ margin: 0 }}>{error}</div>}
        {!loading && !error && data && !c && <div className={s.hint} style={{ margin: 0 }}>Todavía no entró mercadería de este proveedor.</div>}
        {c && !c.items.length && <div className={s.hint} style={{ margin: 0 }}>Ese comprobante no tiene renglones cargados.</div>}
        {c?.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '2px 0', borderBottom: '1px dashed var(--crm-color-border)' }}>
            <span>{it.nombre}{it.tamKg ? ` · ${fmtTam(it.tamKg)}` : ''}</span>
            <strong style={{ whiteSpace: 'nowrap' }}>{cuantoEntro(it)}</strong>
          </div>
        ))}
      </div>
    </details>
  );
}
