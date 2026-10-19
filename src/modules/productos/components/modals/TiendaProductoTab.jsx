/**
 * COMPRAS › PRODUCTOS › DETALLE › TIENDA ONLINE (19/10/2026, pedido del dueño)
 * ============================================================================
 * Todo lo del producto para la tienda, en su ficha (antes estaba aparte, en
 * Tienda online › Productos del sitio): la FOTO, el DESTACADO de la portada, el
 * MÍNIMO WEB y cómo se ve en cada tienda (mayorista y minorista), leído del
 * mismo catálogo que ve el cliente — la regla de publicación no se repite acá.
 * Lo edita quien edita la ficha (Compras › Productos).
 */
import { useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num } from '../../domain/format.js';
import { Btn, s } from '../ui.jsx';
import { Miniatura } from '@modules/web/components/Miniatura.jsx';
import { SubirImagenBtn } from '@modules/web/components/SubirImagenBtn.jsx';
import { PRESETS_IMAGEN } from '@modules/web/services/imagenes.js';

const TIENDAS = [['mayorista', 'Tienda mayorista'], ['minorista', 'Tienda minorista']];

export function TiendaProductoTab({ prod: p }) {
  const { store, can, toast } = useProductos();
  const puede = can('compras.productos');
  const [vista, setVista] = useState(null);
  const [minimo, setMinimo] = useState(String(p.webStockMin ?? 0));
  const [ocupado, setOcupado] = useState(false);
  const candado = useRef(false);
  const dist = store.distribuidora();
  const unidad = p.tipo === 'granel' ? 'kg' : 'u.';

  useEffect(() => {
    let vivo = true;
    store.vistaTienda(p.id).then((r) => { if (vivo) setVista(r.ok ? r.data : { error: r.error }); });
    return () => { vivo = false; };
  }, [store, p.id]);
  useEffect(() => { setMinimo(String(p.webStockMin ?? 0)); }, [p.webStockMin]);

  /** Una acción a la vez (candado con `useRef`), con su aviso. */
  const ejecutar = async (fn, ok) => {
    if (candado.current) return;
    candado.current = true; setOcupado(true);
    const r = await fn();
    candado.current = false; setOcupado(false);
    toast(r.ok ? ok : r.error, r.ok ? 'ok' : 'err');
  };
  const guardarMinimo = () => {
    const n = Number(String(minimo).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) { setMinimo(String(p.webStockMin ?? 0)); return; }
    if (n === (p.webStockMin ?? 0)) return;
    ejecutar(() => store.guardarTiendaProducto(p.id, { webStockMin: n }),
      n > 0 ? `La tienda vende hasta que queden ${num(n)} ${unidad} en ${dist?.nombre ?? 'la Distribuidora'}.` : 'Sin mínimo: la tienda vende hasta la última unidad.');
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Miniatura url={p.fotoUrl} alt={p.nombre} size={150} />
        <div style={{ flex: '1 1 260px', display: 'grid', gap: 10 }}>
          <div className={s['section-title']} style={{ margin: 0 }}>Foto</div>
          {puede && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <SubirImagenBtn preset="producto" small={false} onData={(data) => ejecutar(() => store.subirFotoProducto(p.id, data), 'Foto guardada: ya se ve en la tienda.')}>
                {p.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
              </SubirImagenBtn>
              {/* La URL externa (de la importación vieja) no se borra desde acá: se reemplaza subiendo una. */}
              {p.fotoUrl && !/^https?:/.test(p.fotoUrl) && (
                <Btn variant="btn-delete" disabled={ocupado} onClick={() => ejecutar(() => store.quitarFotoProducto(p.id), 'Foto quitada.')}>Quitar foto</Btn>
              )}
            </div>
          )}
          <div className={s.hint} style={{ margin: 0 }}>{PRESETS_IMAGEN.producto.hint} Al subir podés quitarle el fondo y ver cómo queda antes de confirmar.</div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: puede ? 'pointer' : 'default', fontWeight: 600 }}>
            <input
              id="tienda-destacado" type="checkbox" checked={!!p.destacado} disabled={!puede || ocupado} style={{ width: 'auto' }}
              onChange={(e) => ejecutar(() => store.guardarTiendaProducto(p.id, { destacado: e.target.checked }),
                e.target.checked ? 'Destacado: aparece en el carrusel de la portada.' : 'Ya no está destacado.')}
            />
            ★ Destacado en la portada de la tienda
          </label>

          <div className={s.field} style={{ margin: 0 }}>
            <label htmlFor="tienda-minimo">Mínimo web ({unidad})</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                id="tienda-minimo" inputMode="decimal" value={minimo} disabled={!puede || ocupado} style={{ width: 100, textAlign: 'right' }}
                onChange={(e) => setMinimo(e.target.value)} onBlur={guardarMinimo}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <span className={s.hint} style={{ margin: 0 }}>
                Hoy hay {num(dist ? store.cant(p.id, dist.id, null, 'disponible') : 0, 2)} {unidad} en {dist?.nombre ?? 'la Distribuidora'}.
              </span>
            </div>
            <div className={s.hint} style={{ margin: '4px 0 0' }}>
              Al llegar a este stock la tienda muestra «Sin stock» y lo que queda se guarda para fraccionar o para el mostrador. 0 = se vende hasta la última unidad.
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className={s['section-title']} style={{ margin: '0 0 6px' }}>Cómo se ve en la tienda</div>
        {!vista ? <div className={s.hint}>Mirando la tienda…</div> : vista.error ? (
          <div className={cx(s.callout, s.warn)}>{vista.error}</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {TIENDAS.map(([k, titulo]) => {
              const v = vista[k];
              return (
                <div key={k} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--crm-color-border)' }}>
                  <strong style={{ flex: '0 0 150px' }}>{titulo}</strong>
                  {v ? (
                    <span>
                      {money(v.precio)}{v.unidad === 'kg' ? ' /kg' : ''}
                      {v.opciones > 1 && <span className={s.muted}> · {v.opciones} opciones</span>}
                      {' · '}<span style={{ color: v.enStock ? 'var(--crm-color-success)' : 'var(--crm-color-danger)', fontWeight: 600 }}>{v.enStock ? 'en stock' : 'sin stock'}</span>
                      {v.oferta && <span style={{ color: 'var(--crm-color-accent-2)', fontWeight: 700 }}> · {v.oferta}</span>}
                    </span>
                  ) : (
                    <span className={s.muted}>No aparece: le falta precio en una lista de esa tienda (pestaña Formato de Venta).</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className={s.hint} style={{ margin: '6px 0 0' }}>
          El precio sale del Formato de Venta; el nombre, la marca, la categoría y las etiquetas, de «Editar producto». Todo se ve en la tienda sin cargar nada aparte.
        </div>
      </div>
    </div>
  );
}
