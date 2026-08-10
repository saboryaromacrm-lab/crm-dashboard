/**
 * OFERTAS — administración de promociones
 * ============================================================================
 * La tabla muestra el estado CALCULADO (vigente, programada, vencida,
 * inactiva): una promo con fecha de fin en el pasado figura "Vencida" sin que
 * nadie tenga que acordarse de apagarla.
 *
 * El panel trae su propia lista (`/ofertas`) y el catálogo del POS una sola
 * vez: el catálogo aporta los nombres para el alcance y los precios reales que
 * usa la vista previa del formulario.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { TIPOS_OFERTA, MEDIOS_PAGO } from '../domain/constants.js';
import { describirOferta, estadoOferta } from '../domain/ofertas.js';
import { PanelHead, Table, Btn, usePaginado, money, s } from '../components/ui.jsx';

const PILL_ESTADO = {
  vigente: 'est-recibida',
  programada: 'est-pendiente',
  vencida: 'est-revision',
  inactiva: 'est-cancelada',
};

export function OfertasPanel() {
  const { ctx, openModal, toast, sucursales } = useVentas();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ofertas, setOfertas] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  /**
   * El cruce con el vigía de fechas (Almacén › Vencimientos). Se mira ACÁ
   * porque acá está el remedio: una oferta que está descontando mercadería ya
   * vencida se apaga desde esta pantalla, no desde el depósito.
   */
  const [venc, setVenc] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setOfertas(await ventasApi.ofertas());
    } catch (e) { toast(errorMsg(e), 'err'); }
    // El aviso es accesorio: si no se puede leer, la pantalla funciona igual.
    ventasApi.vencimientosEnOferta().then(setVenc).catch(() => setVenc(null));
  }, [toast]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!ctx.sucursalId) return;
    ventasApi.catalogo(ctx.sucursalId).then(setCatalogo).catch(() => setCatalogo({ items: [] }));
  }, [ctx.sucursalId]);

  const items = catalogo?.items ?? [];

  /**
   * El universo del buscador de alcance: cada producto, marca, categoría y
   * etiqueta UNA vez. Se deriva del catálogo que ya está en memoria.
   */
  const universo = useMemo(() => {
    const out = [];
    const vistos = new Set();
    const add = (tipo, refId, nombre) => {
      if (!refId || !nombre) return;
      const k = `${tipo}:${refId}`;
      if (!vistos.has(k)) { vistos.add(k); out.push({ tipo, refId, nombre }); }
    };
    for (const it of items) {
      if (!it.presentacionId) add('producto', it.productoId, it.nombre);
      add('marca', it.marcaId, it.marca);
      add('categoria', it.categoriaId, it.categoria);
    }
    for (const e of catalogo?.etiquetasCatalogo ?? []) add('etiqueta', e.id, e.nombre);
    return out;
  }, [items, catalogo]);

  const nombreDe = useCallback((a) =>
    universo.find((u) => u.tipo === a.tipo && u.refId === a.refId)?.nombre ?? `#${a.refId}`, [universo]);

  const alcanceLegible = (o) => {
    if (o.tipo === 'ticket') return 'Todo el ticket';
    if (o.tipo === 'combo') {
      return (o.componentes ?? [])
        .map((c) => `${c.cantidad}× ${items.find((i) => i.productoId === c.productoId && !i.presentacionId)?.nombre ?? `#${c.productoId}`}`)
        .join(' + ');
    }
    return (o.alcances ?? []).map(nombreDe).join(', ') || '—';
  };

  const condiciones = (o) => {
    const parts = [];
    if (o.desde || o.hasta) {
      parts.push(`${o.desde ? new Date(o.desde).toLocaleDateString() : '…'} → ${o.hasta ? new Date(o.hasta).toLocaleDateString() : '…'}`);
    }
    if (o.dias) parts.push('días puntuales');
    if (o.sucursales) {
      const nombres = o.sucursales.split(',').map((id) => sucursales.find((x) => x.id === Number(id))?.nombre).filter(Boolean);
      if (nombres.length) parts.push(nombres.join(' / '));
    }
    if (o.mediosPago) parts.push(`solo ${o.mediosPago.split(',').map((m) => MEDIOS_PAGO[m.trim()] || m).join(' / ')}`);
    return parts.length ? parts.join(' · ') : 'Siempre';
  };

  const abrirForm = (oferta, vencimiento = null) =>
    openModal('ofertaForm', { oferta, items, universo, onListo: cargar, vencimiento });

  /**
   * `?nuevaOferta=<id de vencimiento>`: el vigía de fechas manda acá con el
   * formulario lleno. La API arma el borrador (es la que sabe las reglas: no se
   * ofrece lo vencido, ni lo ya ofertado, ni lo archivado) y esta pantalla solo
   * lo abre. Se espera a tener el catálogo para que la vista previa y la ficha
   * del alcance salgan con precios reales, y el parámetro se limpia enseguida:
   * un F5 no tiene que volver a abrir el mismo modal.
   */
  const pedido = searchParams.get('nuevaOferta');
  const yaAbierto = useRef(false);
  useEffect(() => {
    if (!pedido || yaAbierto.current || catalogo === null) return;
    yaAbierto.current = true;
    const sp = new URLSearchParams(searchParams);
    sp.delete('nuevaOferta');
    setSearchParams(sp, { replace: true });
    ventasApi.borradorOfertaVencimiento(pedido)
      .then((r) => abrirForm(r.borrador, r.registro))
      .catch((e) => toast(errorMsg(e), 'err'));
    // abrirForm cambia en cada render (usa items/universo): entra por la lista
    // de dependencias solo lo que decide SI hay que abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, catalogo]);

  /** Las alarmas del cruce, indexadas por oferta para pintarlas en la tabla. */
  const alarmasPorOferta = useMemo(() => {
    const m = new Map();
    for (const f of venc?.filas ?? []) {
      if (f.alarma?.severidad !== 'grave') continue;
      if (!m.has(f.ofertaId)) m.set(f.ofertaId, []);
      m.get(f.ofertaId).push(f);
    }
    return m;
  }, [venc]);

  const pag = usePaginado(ofertas ?? [], 'ofertas');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Ofertas"
        desc="Las mecánicas por cantidad (3×2, 2ª unidad, pack, combo) se aplican solas en la caja; la de monto del ticket se sugiere y el cajero la aplica con un clic. Por renglón gana UNA sola: la de mayor beneficio."
        actions={<Btn variant="btn-primary" onClick={() => abrirForm(null)}>+ Oferta</Btn>}
      />

      {/* Lo único urgente que esta pantalla puede resolver: apagar una oferta
          que está descontando mercadería que YA venció. */}
      {alarmasPorOferta.size > 0 && (
        <div className={cx(s.callout, s.warn)}>
          <strong>
            ⚠ {alarmasPorOferta.size === 1 ? 'Una oferta está descontando' : `${alarmasPorOferta.size} ofertas están descontando`}{' '}
            mercadería que ya venció
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {[...alarmasPorOferta.entries()].map(([ofertaId, filas]) => (
              <li key={ofertaId} style={{ marginBottom: 2 }}>
                <strong>{filas[0].ofertaNombre}</strong> — {filas.map((f) => (
                  `${f.nombre} (venció hace ${Math.abs(f.diasParaVencer)} d, ${f.cantidad} ${f.unidad})`
                )).join(' · ')}
              </li>
            ))}
          </ul>
          <div className={s.hint} style={{ marginTop: 6 }}>
            Editá la oferta para apagarla o recortarle el alcance, y procesá el vencimiento en
            Almacén › Vencimientos. El dato sale del control de fechas, no de la oferta.
          </div>
        </div>
      )}

      <Table
        cols={[
          { h: 'Oferta' }, { h: 'Mecánica' }, { h: 'Alcanza a' }, { h: 'Condiciones' },
          { h: 'Estado' }, { h: 'Acciones' },
        ]}
        empty={ofertas === null ? 'Cargando…' : 'Sin ofertas todavía. Creá la primera.'}
        pag={pag}
      >
        {pag.visibles.map((o) => {
          const est = estadoOferta(o);
          return (
            <tr key={o.id} style={{ opacity: est.id === 'vigente' || est.id === 'programada' ? 1 : 0.55 }}>
              <td>
                <strong>{o.nombre}</strong>
                {alarmasPorOferta.has(o.id) && (
                  <div>
                    <span className={cx(s.pill, s['est-revision'])} title="Alcanza mercadería vencida">
                      ⚠ mercadería vencida
                    </span>
                  </div>
                )}
              </td>
              <td>
                {TIPOS_OFERTA[o.tipo]?.label ?? o.tipo}
                <div className={s.muted} style={{ fontSize: 12 }}>{describirOferta(o).replace(/\$(\d+)/, (_, n) => money(Number(n)))}</div>
              </td>
              <td style={{ maxWidth: 260 }}>{alcanceLegible(o)}</td>
              <td style={{ maxWidth: 220 }}>{condiciones(o)}</td>
              <td><span className={cx(s.pill, s[PILL_ESTADO[est.id]])}>{est.label}</span></td>
              <td>
                <div className={s['row-actions']}>
                  <Btn small onClick={() => abrirForm(o)}>Editar</Btn>
                  <Btn variant="btn-delete" small onClick={() => openModal('borrarOferta', { oferta: o, onListo: cargar })}>
                    Eliminar
                  </Btn>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
