/**
 * OFERTAS — alta/edición con vista previa EN VIVO
 * ============================================================================
 * El formulario cambia según la mecánica elegida (cada tipo muestra SOLO sus
 * campos), y abajo una vista previa corre el MOTOR REAL sobre un ticket de
 * ejemplo: lo que se ve ahí es exactamente lo que va a pasar en la caja,
 * porque es el mismo código — no una imitación.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { ventasApi, errorMsg } from '../../services/ventas.api.js';
import { MEDIOS_PAGO, TIPOS_OFERTA, norm } from '../../domain/constants.js';
import { resolverOfertas, describirOferta, alcanzaRenglon } from '../../domain/ofertas.js';
import { ModalShell, Btn, money, s } from '../ui.jsx';

const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/* ------------------------------------------------------------------ *
 * Alcance: buscador + fichas
 * ------------------------------------------------------------------ */

/**
 * Un solo buscador para las cuatro dimensiones: se tipea y se elige un
 * producto, una marca, una categoría o una etiqueta. Elegir es agregar una
 * ficha; la unión de fichas es el alcance.
 */
function AlcancePicker({ alcances, setAlcances, universo }) {
  const [q, setQ] = useState('');

  const opciones = useMemo(() => {
    const n = norm(q);
    if (n.length < 2) return [];
    const ya = new Set(alcances.map((a) => `${a.tipo}:${a.refId}`));
    const out = [];
    for (const u of universo) {
      if (out.length >= 8) break;
      if (!ya.has(`${u.tipo}:${u.refId}`) && norm(u.nombre).includes(n)) out.push(u);
    }
    return out;
  }, [q, alcances, universo]);

  const etiquetaTipo = {
    producto: 'Producto', marca: 'Marca', categoria: 'Categoría', etiqueta: 'Etiqueta',
    presentacion: 'Paquete',
  };

  return (
    <div className={s.field}>
      <label>Alcanza a <span className={s.req}>*</span></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: alcances.length ? 8 : 0 }}>
        {alcances.map((a, i) => (
          <span key={`${a.tipo}:${a.refId}`} className={s.badge}>
            {etiquetaTipo[a.tipo]}: <strong>{a.nombre}</strong>
            <button
              type="button" className={s['pres-remove']} style={{ marginLeft: 4 }}
              onClick={() => setAlcances(alcances.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={q}
        placeholder="Buscá un producto, un paquete fraccionado, marca, categoría o etiqueta…"
        onChange={(e) => setQ(e.target.value)}
      />
      {opciones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
          {opciones.map((u) => (
            <button
              key={`${u.tipo}:${u.refId}`} type="button" className={s['btn-ghost']}
              style={{ textAlign: 'left', padding: '5px 10px' }}
              onClick={() => { setAlcances([...alcances, u]); setQ(''); }}
            >
              <span className={s.muted}>{etiquetaTipo[u.tipo]} · </span>{u.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Vista previa en vivo
 * ------------------------------------------------------------------ */

/**
 * Ticket de ejemplo con el motor real. Se arma un renglón por artículo del
 * alcance (o los componentes del combo) con la cantidad que pide la mecánica,
 * y se muestra antes → después.
 */
function VistaPrevia({ oferta, items, alcances }) {
  const preview = useMemo(() => {
    if (!items.length) return null;

    // Qué artículos participarían: para combo, sus componentes; para el resto,
    // los que caen dentro del alcance actual.
    let muestra = [];
    if (oferta.tipo === 'combo') {
      muestra = oferta.componentes
        .map((c) => {
          const it = items.find((i) => i.productoId === c.productoId && !i.presentacionId);
          return it ? { it, cantidad: c.cantidad } : null;
        })
        .filter(Boolean);
      if (muestra.length !== oferta.componentes.length) return null;
    } else if (oferta.tipo === 'ticket') {
      muestra = items.slice(0, 2).map((it) => ({ it, cantidad: 1 }));
    } else {
      /* El artículo de muestra lo elige EL MOTOR, no una copia de sus reglas:
       * así la vista previa respeta el alcance `presentacion` y el tilde de los
       * fraccionados sin tener que repetir la lógica (y quedarse atrás). */
      const objetivo = items.find((it) => alcanzaRenglon(oferta, {
        productoId: it.productoId,
        presentacionId: it.presentacionId ?? null,
        marcaId: it.marcaId,
        categoriaId: it.categoriaId,
        etiquetas: it.etiquetas ?? [],
      }));
      if (!objetivo) return null;
      // La cantidad justa para que la mecánica dispare (2ª unidad → 2, 3×2 → 3…).
      const cant = oferta.tipo === 'nxm' || oferta.tipo === 'pack' ? (oferta.lleva || 2)
        : oferta.tipo === 'segunda_unidad' ? 2 : 1;
      muestra = [{ it: objetivo, cantidad: cant }];
    }

    const renglones = muestra.map(({ it, cantidad }, i) => ({
      key: it.key, uid: i, productoId: it.productoId, presentacionId: it.presentacionId ?? null,
      marcaId: it.marcaId, categoriaId: it.categoriaId, etiquetas: it.etiquetas ?? [],
      nombre: it.nombre, cantidad, precioUnitario: it.precio, descuento: 0,
      iva: it.iva, listaOrigen: 'base',
    }));

    const sim = { ...oferta, id: -1, activa: true, desde: null, hasta: null, dias: '', sucursales: '' };
    const res = resolverOfertas(renglones, [sim], {
      ahora: new Date(), sucursalId: null, ticketAplicadaId: oferta.tipo === 'ticket' ? -1 : null,
    });
    if (![...res.values()].length) return { renglones, res: null };
    return { renglones, res };
  }, [oferta, items, alcances]);

  if (!preview) {
    return (
      <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
        Elegí el alcance (o los componentes) y acá se muestra el resultado con
        precios reales del catálogo.
      </div>
    );
  }
  if (!preview.res) {
    return (
      <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
        Con estos valores la oferta <strong>no descuenta nada</strong> — revisá
        los números (¿el precio de oferta es más caro que el actual?).
      </div>
    );
  }

  let antes = 0; let despues = 0;
  const filas = preview.renglones.map((r) => {
    const conIva = r.cantidad * r.precioUnitario * (1 + r.iva / 100);
    const d = preview.res.get(r.key);
    const dFinal = d ? d.descuento * (1 + r.iva / 100) : 0;
    antes += conIva; despues += conIva - dFinal;
    return { r, conIva, dFinal, d };
  });

  return (
    <div className={cx(s.card, s.cardPad)} style={{ background: 'color-mix(in srgb, var(--crm-color-success) 6%, transparent)' }}>
      <div className={s['mini-label']} style={{ marginBottom: 8 }}>
        Así queda en la caja — {describirOferta(oferta)}
      </div>
      {filas.map(({ r, conIva, dFinal }) => (
        <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: 13 }}>
          <span>{r.cantidad}× {r.nombre}</span>
          <span className={s.mono}>
            {dFinal > 0
              ? <><s style={{ opacity: .55 }}>{money(conIva)}</s> <strong>{money(conIva - dFinal)}</strong></>
              : money(conIva)}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--crm-color-border)', marginTop: 6, paddingTop: 6, fontSize: 13.5 }}>
        <span>El cliente ahorra</span>
        <strong style={{ color: 'var(--crm-color-success)' }}>{money(antes - despues)} ({antes > 0 ? Math.round((antes - despues) / antes * 100) : 0}%)</strong>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Formulario
 * ------------------------------------------------------------------ */

/**
 * De dónde viene esta oferta cuando la manda el vigía de fechas: la ficha que
 * justifica el descuento. Sin esto habría que decidir el porcentaje a ciegas —
 * lo que está en juego es la plata que se pierde si no se vende.
 */
function FichaVencimiento({ v }) {
  const dias = v.diasParaVencer;
  return (
    <div className={cx(s.callout, s.info)} style={{ margin: '0 0 12px' }}>
      📅 Viene del <strong>control de vencimientos</strong>: {v.cantidad} {v.unidad} de{' '}
      <strong>{v.nombre}</strong> en {v.sucursalNombre} vencen el{' '}
      <strong>{v.fechaVencimiento.split('-').reverse().join('/')}</strong>{' '}
      ({dias === 0 ? 'HOY' : `en ${dias} día${dias === 1 ? '' : 's'}`}) — si no se venden se
      pierden <strong>{money(v.perdidaPotencial)}</strong>.
      <div className={s.hint} style={{ marginTop: 4 }}>
        Ya viene cargado el producto, la fecha de fin (el día que vence) y la sucursal del lote.
        Cambiá lo que quieras: es una oferta como cualquier otra. Al crearla queda atada a este registro.
      </div>
    </div>
  );
}

export function OfertaFormModal({ oferta, items = [], universo = [], onListo, vencimiento = null }) {
  const { closeModal, act, toast, sucursales } = useVentas();
  const editando = !!oferta?.id;

  const [f, setF] = useState(() => ({
    nombre: oferta?.nombre ?? '',
    tipo: oferta?.tipo ?? 'porcentaje',
    porcentaje: String(oferta?.porcentaje || ''),
    precio: String(oferta?.precio || ''),
    lleva: String(oferta?.lleva || ''),
    paga: String(oferta?.paga || ''),
    montoMinimo: String(oferta?.montoMinimo || ''),
    desde: oferta?.desde ? oferta.desde.slice(0, 10) : '',
    hasta: oferta?.hasta ? oferta.hasta.slice(0, 10) : '',
    dias: oferta?.dias || '',
    sucursales: oferta?.sucursales || '',
    mediosPago: oferta?.mediosPago || '',
    soloPrecioBase: oferta?.soloPrecioBase ?? true,
    incluyeFraccionados: oferta?.incluyeFraccionados ?? false,
    activa: oferta?.activa ?? true,
  }));
  const [alcances, setAlcances] = useState(() => (oferta?.alcances ?? []).map((a) => ({
    ...a,
    // El catálogo del POS primero; si el producto todavía no tiene precio de
    // mostrador no está ahí, y entonces vale el nombre que trajo el borrador.
    nombre: universo.find((u) => u.tipo === a.tipo && u.refId === a.refId)?.nombre
      ?? a.nombre ?? `#${a.refId}`,
  })));
  const [componentes, setComponentes] = useState(() => (oferta?.componentes ?? []).map((c) => ({
    productoId: c.productoId,
    cantidad: String(c.cantidad),
    nombre: items.find((i) => i.productoId === c.productoId && !i.presentacionId)?.nombre ?? `#${c.productoId}`,
  })));
  const [qComp, setQComp] = useState('');

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const meta = TIPOS_OFERTA[f.tipo];

  /** La oferta como la ve el MOTOR, armada en vivo para la vista previa. */
  const enVivo = useMemo(() => ({
    id: -1,
    nombre: f.nombre || 'Oferta',
    tipo: f.tipo,
    porcentaje: Number(f.porcentaje) || 0,
    precio: Number(f.precio) || 0,
    lleva: Number(f.lleva) || 0,
    paga: Number(f.paga) || 0,
    montoMinimo: Number(f.montoMinimo) || 0,
    soloPrecioBase: f.soloPrecioBase,
    incluyeFraccionados: f.incluyeFraccionados,
    alcances: alcances.map(({ tipo, refId }) => ({ tipo, refId })),
    componentes: componentes.map((c) => ({ productoId: c.productoId, cantidad: Number(c.cantidad) || 1 })),
  }), [f, alcances, componentes]);

  const toggleDia = (i) => {
    const base = (f.dias && f.dias.length === 7 ? f.dias : '1111111').split('');
    base[i] = base[i] === '1' ? '0' : '1';
    const mask = base.join('');
    set({ dias: mask === '1111111' ? '' : mask });
  };
  const diaActivo = (i) => !f.dias || f.dias[i] === '1';

  const toggleMedio = (m) => {
    const ya = f.mediosPago.split(',').map((x) => x.trim()).filter(Boolean);
    const next = ya.includes(m) ? ya.filter((x) => x !== m) : [...ya, m];
    set({ mediosPago: next.join(',') });
  };

  const opcionesComp = useMemo(() => {
    const n = norm(qComp);
    if (n.length < 2) return [];
    const ya = new Set(componentes.map((c) => c.productoId));
    return items
      .filter((i) => !i.presentacionId && !ya.has(i.productoId) && norm(i.nombre).includes(n))
      .slice(0, 6);
  }, [qComp, items, componentes]);

  const toggleSucursal = (id) => {
    const ya = f.sucursales.split(',').map((x) => x.trim()).filter(Boolean);
    const next = ya.includes(String(id)) ? ya.filter((x) => x !== String(id)) : [...ya, String(id)];
    // Todas tildadas es lo mismo que ninguna: se guarda vacío (= todas).
    set({ sucursales: next.length === sucursales.length ? '' : next.join(',') });
  };
  const sucActiva = (id) => !f.sucursales || f.sucursales.split(',').map((x) => x.trim()).includes(String(id));

  const guardar = async () => {
    const dto = {
      nombre: f.nombre.trim(),
      tipo: f.tipo,
      porcentaje: Number(f.porcentaje) || 0,
      precio: Number(f.precio) || 0,
      lleva: Number(f.lleva) || 0,
      paga: Number(f.paga) || 0,
      montoMinimo: Number(f.montoMinimo) || 0,
      desde: f.desde || undefined,
      hasta: f.hasta ? `${f.hasta}T23:59:59` : undefined,
      dias: f.dias,
      sucursales: f.sucursales,
      mediosPago: f.mediosPago,
      soloPrecioBase: f.soloPrecioBase,
      incluyeFraccionados: f.incluyeFraccionados,
      activa: f.activa,
      alcances: alcances.map(({ tipo, refId }) => ({ tipo, refId })),
      componentes: componentes.map((c) => ({ productoId: c.productoId, cantidad: Number(c.cantidad) || 1 })),
    };
    const promesa = editando ? ventasApi.editarOferta(oferta.id, dto) : ventasApi.crearOferta(dto);
    const res = await act(promesa, editando ? 'Oferta actualizada.' : 'Oferta creada.', { recargar: false });
    if (!res) return;

    /*
     * El vínculo con el registro de vencimiento: es lo que hace que el vigía
     * sepa que ese lote ya tiene su oferta y pueda avisar después si algo se
     * desalinea. Si falla, la oferta YA está creada y sigue siendo válida — se
     * dice lo que pasó en vez de fingir que no pasó nada.
     */
    if (vencimiento?.id && res?.id) {
      try {
        await ventasApi.vincularOfertaVencimiento(vencimiento.id, res.id);
        toast('Oferta creada y atada al vencimiento: el registro ya figura «en oferta».', 'ok');
      } catch (e) {
        toast(`La oferta se creó, pero NO quedó atada al vencimiento: ${errorMsg(e)}`, 'err');
      }
    }
    onListo?.();
  };

  return (
    <ModalShell
      title={editando ? `Editar — ${oferta.nombre}` : 'Nueva oferta'}
      onClose={closeModal}
      size="md"
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: editando ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.form}>
        {vencimiento && <FichaVencimiento v={vencimiento} />}
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Nombre <span className={s.req}>*</span></label>
            <input value={f.nombre} placeholder="3×2 en yerbas" onChange={(e) => set({ nombre: e.target.value })} />
          </div>
          <div className={s.field}>
            <label>Mecánica</label>
            <select value={f.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              {Object.entries(TIPOS_OFERTA).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
            </select>
          </div>
        </div>
        {meta?.ayuda && <div className={s.hint} style={{ margin: '-6px 0 10px' }}>{meta.ayuda}</div>}

        {/* --- Parámetros de la mecánica elegida --- */}
        <div className={s['form-grid']}>
          {meta.campos.includes('porcentaje') && (
            <div className={s.field}>
              <label>{f.tipo === 'segunda_unidad' ? 'Descuento en la 2ª unidad (%)' : 'Descuento (%)'}</label>
              <input type="number" min="0" max="100" step="0.5" value={f.porcentaje} onChange={(e) => set({ porcentaje: e.target.value })} />
            </div>
          )}
          {meta.campos.includes('lleva') && (
            <div className={s.field}>
              <label>{f.tipo === 'pack' ? 'Unidades del pack' : 'Llevando'}</label>
              <input type="number" min="2" step="1" value={f.lleva} onChange={(e) => set({ lleva: e.target.value })} />
            </div>
          )}
          {meta.campos.includes('paga') && (
            <div className={s.field}>
              <label>Paga</label>
              <input type="number" min="1" step="1" value={f.paga} onChange={(e) => set({ paga: e.target.value })} />
            </div>
          )}
          {meta.campos.includes('precio') && (
            <div className={s.field}>
              <label>{f.tipo === 'pack' ? 'Precio del pack (final, con IVA)' : f.tipo === 'combo' ? 'Precio del combo (final, con IVA)' : 'Precio de oferta (final, con IVA)'}</label>
              <input type="number" min="0" step="0.01" value={f.precio} onChange={(e) => set({ precio: e.target.value })} />
            </div>
          )}
          {meta.campos.includes('montoMinimo') && (
            <div className={s.field}>
              <label>Desde qué monto de ticket ($)</label>
              <input type="number" min="0" step="100" value={f.montoMinimo} onChange={(e) => set({ montoMinimo: e.target.value })} />
            </div>
          )}
        </div>

        {/* --- Alcance / componentes --- */}
        {meta.alcance && <AlcancePicker alcances={alcances} setAlcances={setAlcances} universo={universo} />}

        {f.tipo === 'combo' && (
          <div className={s.field}>
            <label>Componentes del combo <span className={s.req}>*</span></label>
            {componentes.map((c, i) => (
              <div key={c.productoId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input
                  type="number" min="1" step="1" style={{ width: 70 }}
                  value={c.cantidad}
                  onChange={(e) => setComponentes(componentes.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))}
                />
                <span style={{ flex: 1 }}>{c.nombre}</span>
                <button type="button" className={s['pres-remove']} onClick={() => setComponentes(componentes.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <input value={qComp} placeholder="Agregar producto al combo…" onChange={(e) => setQComp(e.target.value)} />
            {opcionesComp.map((it) => (
              <button
                key={it.key} type="button" className={s['btn-ghost']} style={{ textAlign: 'left', padding: '5px 10px', marginTop: 4 }}
                onClick={() => { setComponentes([...componentes, { productoId: it.productoId, cantidad: '1', nombre: it.nombre }]); setQComp(''); }}
              >
                {it.nombre} <span className={s.muted}>· {money(it.precio)}</span>
              </button>
            ))}
          </div>
        )}

        {f.tipo === 'ticket' && (
          <div className={s.field}>
            <label>Medios de pago que la habilitan</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {Object.entries(MEDIOS_PAGO).map(([id, label]) => (
                <label key={id} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={f.mediosPago.split(',').map((x) => x.trim()).includes(id)}
                    onChange={() => toggleMedio(id)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className={s.hint} style={{ margin: '6px 0 0' }}>Sin tildar = cualquier medio de pago.</div>
          </div>
        )}

        {/* --- Vigencia --- */}
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Desde</label>
            <input type="date" value={f.desde} onChange={(e) => set({ desde: e.target.value })} />
          </div>
          <div className={s.field}>
            <label>Hasta</label>
            <input type="date" value={f.hasta} onChange={(e) => set({ hasta: e.target.value })} />
          </div>
        </div>
        <div className={s.field}>
          <label>Días</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {DIAS.map((d, i) => (
              <button
                key={d} type="button"
                className={cx(s.badge)}
                style={{ cursor: 'pointer', opacity: diaActivo(i) ? 1 : 0.35, userSelect: 'none' }}
                onClick={() => toggleDia(i)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Dónde corre. Existía en el dato y en la tabla, pero no había forma de
            elegirlo: una promo para rematar un lote de UNA sucursal no tiene por
            qué regalar margen en las otras cuatro. */}
        <div className={s.field}>
          <label>Sucursales</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sucursales.map((x) => (
              <button
                key={x.id} type="button"
                className={cx(s.badge)}
                style={{ cursor: 'pointer', opacity: sucActiva(x.id) ? 1 : 0.35, userSelect: 'none' }}
                onClick={() => toggleSucursal(x.id)}
              >
                {x.nombre}
              </button>
            ))}
          </div>
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            {f.sucursales ? 'Solo en las tildadas.' : 'Todas tildadas = corre en todas.'}
          </div>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
          <input
            type="checkbox" checked={f.soloPrecioBase}
            onChange={(e) => set({ soloPrecioBase: e.target.checked })}
            style={{ marginTop: 2 }}
          />
          <span>
            Solo sobre el <strong>precio de mostrador</strong> — un renglón que ya está en lista
            mayorista no recibe además la promo (evita el doble beneficio).
          </span>
        </label>

        {/* El paquete fraccionado se cotiza solo, así que una oferta a la madre
            no lo alcanza salvo que se diga. Antes lo alcanzaba siempre, sin que
            nadie lo hubiera decidido. */}
        {meta.alcance && alcances.some((a) => a.tipo !== 'presentacion') && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
            <input
              type="checkbox" checked={f.incluyeFraccionados}
              onChange={(e) => set({ incluyeFraccionados: e.target.checked })}
              style={{ marginTop: 2 }}
            />
            <span>
              Incluir también los <strong>paquetes fraccionados</strong> de esos productos — el
              paquete tiene su propio precio, así que por defecto la oferta no lo toca. Para poner
              en oferta UN tamaño puntual, elegilo arriba como <strong>Paquete</strong>.
            </span>
          </label>
        )}

        {/* --- EN VIVO --- */}
        <VistaPrevia oferta={enVivo} items={items} alcances={alcances} />
      </div>
    </ModalShell>
  );
}

export function BorrarOfertaModal({ oferta, onListo }) {
  const { closeModal, act } = useVentas();
  return (
    <ModalShell
      title={`Eliminar — ${oferta.nombre}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: 'Eliminar',
          clase: 'btn-delete',
          onClick: () => act(ventasApi.borrarOferta(oferta.id), 'Oferta eliminada.', { recargar: false })
            .then((ok) => { if (ok) onListo?.(); }),
        },
      ]}
    >
      <p>
        Si ya se usó en alguna venta, se <strong>desactiva</strong> en vez de borrarse: los tickets
        viejos la referencian y tienen que seguir siendo explicables.
      </p>
    </ModalShell>
  );
}
