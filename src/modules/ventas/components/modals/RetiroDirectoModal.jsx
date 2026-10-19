/**
 * RETIRO DE MERCADERÍA SIN ABRIR EL POS (19/10/2026, pedido del dueño)
 * ============================================================================
 * El mismo retiro sin costo de la caja (0146), desde el acceso directo del
 * inicio: quién retira (un cliente marcado «Retiros sin costo»), de qué
 * sucursal sale, qué se lleva. Va al MISMO `POST /retiros`: baja el stock con su
 * propio movimiento, guarda el costo real en la ficha del cliente y no toca
 * caja, ventas, ARCA ni IVA. En el POS sigue todo igual.
 *
 * Los productos salen del catálogo de la caja de esa sucursal y se buscan con
 * el buscador de la caja (`buscarEnCatalogo`): un código escaneado o un nombre
 * encuentran lo mismo que en el POS, con las mismas reglas (sin archivados, sin
 * lo exclusivo de Coffit, el granel solo por sus paquetes). Registrar pide una
 * segunda confirmación y va con candado (`useRef`).
 */
import { useMemo, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg, ventasApi } from '@modules/ventas/services/ventas.api.js';
import { buscarEnCatalogo } from '@modules/ventas/domain/pos.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { ModalShell } from '@modules/productos/components/Modal.jsx';

/** El último que retiró, recordado por usuario en este navegador. */
const claveQuien = (usuarioId) => `erp.retiro.quien.${usuarioId ?? 'x'}`;
const leer = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const guardar = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* sin storage */ } };

/** La cantidad escrita, o null si no sirve: entera en lo que se cuenta por unidad. */
function cantidadDe(r) {
  const c = Number(String(r.cantidad).replace(',', '.'));
  if (!Number.isFinite(c) || c <= 0) return null;
  if (!r.item.fraccionable && !Number.isInteger(c)) return null;
  return c;
}

export function RetiroDirectoModal({ onCerrar }) {
  const { user } = useAuth();
  const esJefe = (user?.roles ?? []).some((r) => r === 'admin' || r === 'superadmin');
  const { data: clientes } = useResource('retiro-directo:clientes', () => httpClient.get('/clientes?activo=true'));
  const { data: sucursales } = useResource('retiro-directo:sucursales', () => httpClient.get('/sucursales'), { enabled: esJefe });
  const deRetiro = useMemo(() => (clientes ?? []).filter((c) => c.retiroSinCosto), [clientes]);

  const [quienId, setQuienId] = useState(() => leer(claveQuien(user?.id)));
  const quien = deRetiro.find((c) => String(c.id) === String(quienId)) ?? (deRetiro.length === 1 ? deRetiro[0] : null);
  const [sucursalId, setSucursalId] = useState(user?.sucursalId ?? '');
  const sucNombre = esJefe ? (sucursales ?? []).find((x) => String(x.id) === String(sucursalId))?.nombre : user?.sucursalNombre;

  const { data: catalogo, loading: cargandoCat, error: errorCat } = useResource(
    `retiro-directo:catalogo:${sucursalId}`, () => ventasApi.catalogo(sucursalId), { enabled: !!sucursalId },
  );
  const [q, setQ] = useState('');
  const encontrados = useMemo(() => buscarEnCatalogo(catalogo?.items ?? [], q, 10), [catalogo, q]);
  const [renglones, setRenglones] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(null);
  const candado = useRef(false);
  const buscador = useRef(null);

  const cambiarSucursal = (id) => { setSucursalId(id); setRenglones([]); setConfirmando(false); setError(''); };
  const agregar = (item) => {
    setRenglones((rs) => (rs.some((r) => r.item.key === item.key) ? rs : [...rs, { item, cantidad: '1' }]));
    setQ(''); setConfirmando(false); buscador.current?.focus();
  };
  const cambiar = (key, cantidad) => { setRenglones((rs) => rs.map((r) => (r.item.key === key ? { ...r, cantidad } : r))); setConfirmando(false); };
  const quitar = (key) => { setRenglones((rs) => rs.filter((r) => r.item.key !== key)); setConfirmando(false); };

  const malas = renglones.filter((r) => cantidadDe(r) == null);
  const faltaStock = renglones.filter((r) => !r.item.stockLibre && (cantidadDe(r) ?? 0) > (Number(r.item.stock) || 0) + 1e-9);
  const listo = !!quien && !!sucursalId && renglones.length > 0 && !malas.length && !faltaStock.length;

  const registrar = async () => {
    if (!listo) return;
    if (!confirmando) { setConfirmando(true); return; }
    if (candado.current) return;
    candado.current = true; setEnviando(true); setError('');
    try {
      const r = await ventasApi.registrarRetiro({
        clienteId: quien.id,
        items: renglones.map((x) => ({ productoId: x.item.productoId, presentacionId: x.item.presentacionId ?? null, cantidad: cantidadDe(x) })),
        ...(esJefe ? { sucursalId: Number(sucursalId) } : {}),
        confirmado: true,
      });
      guardar(claveQuien(user?.id), quien.id);
      setHecho({ ...r, sucursal: sucNombre });
    } catch (e) { setError(errorMsg(e)); setConfirmando(false); } finally { candado.current = false; setEnviando(false); }
  };
  const otro = () => { setHecho(null); setRenglones([]); setConfirmando(false); setQ(''); };

  if (hecho) {
    return (
      <ModalShell title="Retiro registrado" onClose={onCerrar} footer={[
        { texto: 'Hacer otro retiro', clase: 'btn-ghost', onClick: otro },
        { texto: 'Listo', clase: 'btn-primary', onClick: onCerrar },
      ]}>
        <div className={cx(s.callout, s.info)}>
          <strong>Retiro #{hecho.id}</strong> de <strong>{hecho.cliente}</strong>{hecho.sucursal ? ` en ${hecho.sucursal}` : ''}: {hecho.renglones} {hecho.renglones === 1 ? 'artículo' : 'artículos'}, <strong>{money(hecho.costoTotal)} a costo</strong>.
          {' '}El stock ya bajó. Queda en su ficha (Ventas › Clientes) y en Gerencia › Métricas; si hay que deshacerlo, se anula desde la ficha y la mercadería vuelve.
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Retiro de mercadería"
      subtitle="Sin cobrar y sin abrir la caja: baja el stock y queda a costo en la ficha de quien retira."
      size="md"
      onClose={enviando ? undefined : onCerrar}
      footer={[
        { texto: confirmando ? 'Volver' : 'Cancelar', clase: 'btn-ghost', onClick: confirmando ? () => setConfirmando(false) : onCerrar, disabled: enviando },
        { texto: enviando ? 'Registrando…' : confirmando ? 'Sí, registrar el retiro' : 'Registrar retiro', clase: 'btn-primary', onClick: registrar, disabled: !listo || enviando },
      ]}
    >
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className={s.field} style={{ flex: '1 1 220px' }}>
          <label htmlFor="retiro-quien">Quién retira</label>
          {clientes && !deRetiro.length ? (
            <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
              No hay ningún cliente marcado «Retiros sin costo». Se marca en Ventas › Clientes, en su ficha (solo el superadmin).
            </div>
          ) : (
            <select id="retiro-quien" value={quien?.id ?? ''} onChange={(e) => { setQuienId(e.target.value); setConfirmando(false); }}>
              {!quien && <option value="">Elegí…</option>}
              {deRetiro.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
        </div>
        <div className={s.field} style={{ flex: '1 1 200px' }}>
          <label htmlFor="retiro-sucursal">De qué sucursal sale</label>
          {esJefe ? (
            <select id="retiro-sucursal" value={sucursalId} onChange={(e) => cambiarSucursal(e.target.value)}>
              {!sucursalId && <option value="">Elegí…</option>}
              {(sucursales ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          ) : <input id="retiro-sucursal" value={user?.sucursalNombre ?? '—'} readOnly />}
        </div>
      </div>

      <div className={s.field} style={{ position: 'relative' }}>
        <label htmlFor="retiro-buscar">Agregar producto</label>
        <input
          id="retiro-buscar" ref={buscador} autoFocus value={q} autoComplete="off"
          placeholder={sucursalId ? (cargandoCat ? 'Cargando los productos…' : 'Nombre, marca o código (también con el lector)') : 'Primero elegí la sucursal'}
          disabled={!sucursalId || cargandoCat}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && encontrados[0]) { e.preventDefault(); agregar(encontrados[0]); } }}
        />
        {q.trim() && (
          <div style={{ border: '1px solid var(--crm-color-border)', borderRadius: 8, marginTop: 4, maxHeight: 260, overflowY: 'auto', background: 'var(--crm-color-surface)' }}>
            {encontrados.map((it) => (
              <button
                key={it.key} type="button" onClick={() => agregar(it)}
                style={{ display: 'flex', width: '100%', gap: 8, justifyContent: 'space-between', padding: '8px 10px', border: 'none', borderBottom: '1px solid var(--crm-color-border)', background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--crm-color-text)' }}
              >
                <span>{it.nombre}<span className={s.muted}> · {it.detalle}{it.marca ? ` · ${it.marca}` : ''}</span></span>
                <span className={s.muted} style={{ whiteSpace: 'nowrap' }}>{it.stockLibre ? 'sin control' : `hay ${num(it.stock)} ${it.unidad}`}</span>
              </button>
            ))}
            {!encontrados.length && <div className={s.hint} style={{ padding: 10, margin: 0 }}>Nada coincide con «{q}» en {sucNombre ?? 'esta sucursal'}.</div>}
          </div>
        )}
        {errorCat && <div className={cx(s.callout, s.warn)}>{errorCat}</div>}
      </div>

      {renglones.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {renglones.map((r) => {
            const c = cantidadDe(r);
            const sinStock = !r.item.stockLibre && (c ?? 0) > (Number(r.item.stock) || 0) + 1e-9;
            return (
              <div key={r.item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--crm-color-border)' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <strong>{r.item.nombre}</strong><span className={s.muted}> · {r.item.detalle}</span>
                  <div className={s.hint} style={{ margin: 0, color: sinStock ? 'var(--crm-color-danger)' : undefined }}>
                    {r.item.stockLibre ? 'Sin control de stock' : `En ${sucNombre ?? 'la sucursal'} hay ${num(r.item.stock)} ${r.item.unidad}`}
                    {sinStock && ': no alcanza'}
                    {c == null && r.cantidad !== '' && <span style={{ color: 'var(--crm-color-danger)' }}> · {r.item.fraccionable ? 'cantidad inválida' : 'va por unidad entera'}</span>}
                  </div>
                </div>
                <input
                  type="number" min="0" step={r.item.fraccionable ? '0.001' : '1'} inputMode={r.item.fraccionable ? 'decimal' : 'numeric'}
                  value={r.cantidad} onChange={(e) => cambiar(r.item.key, e.target.value)}
                  aria-label={`Cantidad de ${r.item.nombre}`} style={{ width: 90, textAlign: 'right' }}
                />
                <span className={s.muted} style={{ width: 24 }}>{r.item.unidad}</span>
                <Btn small onClick={() => quitar(r.item.key)} aria-label={`Quitar ${r.item.nombre}`}>×</Btn>
              </div>
            );
          })}
        </div>
      )}

      {confirmando && (
        <div className={cx(s.callout, s.warn)}>
          <strong>{quien?.nombre}</strong> se lleva {renglones.length} {renglones.length === 1 ? 'artículo' : 'artículos'} de <strong>{sucNombre}</strong>.
          {' '}<strong>No se cobra nada</strong> y no pasa por la caja: el stock baja ahora y queda en su ficha con el costo de cada producto. Tocá «Sí, registrar el retiro» para confirmar.
        </div>
      )}
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
    </ModalShell>
  );
}
