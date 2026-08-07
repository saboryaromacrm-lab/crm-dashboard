/**
 * FACTURAS POR PROCESAR — la bandeja de papeles subidos (Compras).
 * ============================================================================
 * Separa dos momentos que hasta ahora eran uno solo y no tienen por qué serlo:
 * **recibir el papel** y **cargar la factura**. La cajera saca la foto cuando
 * llega el camión y ahí termina su trabajo; el admin procesa la bandeja el
 * viernes. Ese desacople es lo que ahorra tiempo de verdad — el papel deja de
 * perderse entre el mostrador y el escritorio.
 *
 * El encabezado NO se tipea: sale del **QR de la RG 4892** que trae toda factura
 * electrónica, y que el navegador lee solo (CUIT, tipo, punto de venta, número,
 * fecha, total y CAE). El detalle de renglones sí se carga a mano, y ahí el
 * total del QR sirve de control: si los renglones cierran contra ese número, la
 * carga está demostrada.
 *
 * El semáforo lo calcula la API: **rojo frena** (no hay forma de resolverlo
 * solo: falta el proveedor, el número, la sucursal, o está duplicada),
 * **amarillo avisa**. La regla es que los rojos sean pocos y verdaderos — si la
 * bandeja pregunta quince cosas por factura, el admin tipea más rápido a mano.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, fmtFecha } from '../domain/format.js';
import { ESTADOS_LECTURA, TIPOS_COMPROBANTE } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, Pill, usePaginado, s } from '../components/ui.jsx';
import { TIPOS_ACEPTADOS, MAX_ENTRADA_MB, prepararFactura } from '../domain/leerFactura.js';

const VISTAS = [
  { id: 'pendiente', label: 'Esperando' },
  { id: 'cargada', label: 'Cargadas' },
  { id: 'descartada', label: 'Descartadas' },
];

/** Etiqueta corta del comprobante: "Factura A 0003-41627". */
function etiquetaDoc(l) {
  if (!l.tipo) return '—';
  const t = TIPOS_COMPROBANTE[l.tipo]?.label || l.tipo;
  const nro = l.numero ? `${l.puntoVenta || '????'}-${String(l.numero).padStart(8, '0')}` : 'sin número';
  return `${t} ${l.letra || ''} ${nro}`.replace(/\s+/g, ' ').trim();
}

export function LecturasPanel() {
  const { store, isAdmin, openModal, toast } = useProductos();

  const [vista, setVista] = useState('pendiente');
  const [lecturas, setLecturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setLecturas(await store.lecturasFactura(vista));
    } catch {
      toast('No se pudo cargar la bandeja de facturas.', 'err');
    } finally {
      setCargando(false);
    }
  }, [store, vista, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  // Confirmar una factura crea un comprobante (que sí pasa por `_mutate`): al
  // versionar el store, la bandeja se re-pide y la que se cargó desaparece.
  const version = store.getVersion?.() ?? 0;
  useEffect(() => { cargar(); }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Sube archivos. **El QR se lee del original**, antes de comprimir: al
   * recomprimir se pierde justo el detalle fino que el detector necesita.
   *
   * Cada archivo es UNA factura, que es el caso común (una foto por factura). La
   * de tres hojas se arma agregando páginas desde su detalle.
   */
  const subir = async (files) => {
    const lista = Array.from(files || []).filter(Boolean);
    if (!lista.length) return;
    let leidas = 0;
    let sinQr = 0;
    for (let i = 0; i < lista.length; i++) {
      const file = lista[i];
      setSubiendo(`${i + 1} de ${lista.length}: ${file.name}`);
      try {
        const { qr, archivo } = await prepararFactura(file);
        await store.subirFactura({ archivos: [archivo], qr: qr || undefined });
        if (qr) leidas += 1; else sinQr += 1;
      } catch (e) {
        toast(e?.data?.message || e?.message || `No se pudo subir ${file.name}.`, 'err');
      }
    }
    setSubiendo(null);
    if (leidas || sinQr) {
      const partes = [];
      if (leidas) partes.push(`${leidas} con el encabezado leído del QR`);
      if (sinQr) partes.push(`${sinQr} sin QR (encabezado a mano)`);
      toast(`Listo · ${partes.join(' · ')}.`, 'ok');
    }
    setVista('pendiente');
    cargar();
  };

  const onDrop = (ev) => {
    ev.preventDefault();
    setArrastrando(false);
    subir(ev.dataTransfer?.files);
  };

  const descartar = async (l) => {
    try {
      await store.descartarLecturaFactura(l.id, l.duplicadoDe ? 'Duplicada' : '');
      toast('Factura descartada. El papel queda guardado.', 'ok');
      cargar();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo descartar.', 'err');
    }
  };

  const recuperar = async (l) => {
    try {
      await store.recuperarLecturaFactura(l.id);
      toast('Volvió a la bandeja.', 'ok');
      cargar();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo recuperar.', 'err');
    }
  };

  const resumen = useMemo(() => ({
    total: lecturas.length,
    listas: lecturas.filter((l) => l.listo).length,
    frenadas: lecturas.filter((l) => !l.listo).length,
    importe: lecturas.reduce((a, l) => a + (Number(l.total) || 0), 0),
  }), [lecturas]);

  const pag = usePaginado(lecturas, 'lecturas', vista);
  const stop = (ev) => ev.stopPropagation();

  const filas = pag.visibles.map((l) => {
    const est = ESTADOS_LECTURA[l.estado] || {};
    return (
      <tr
        key={l.id}
        className={s.clickable}
        onClick={() => openModal('lecturaFactura', { id: l.id })}
      >
        <td>
          {l.archivos?.length || l.paginas > 1
            ? <span className={s.mono}>{l.paginas} pág.</span>
            : <span className={s.muted}>1 pág.</span>}
        </td>
        <td>
          {l.proveedorNombre || <span className={cx(s.badge)}>sin proveedor</span>}
          {l.cuit && <div className={s.hint} style={{ margin: 0 }}>CUIT {l.cuit}</div>}
        </td>
        <td>
          {etiquetaDoc(l)}
          {!l.leido && <div className={s.hint} style={{ margin: 0 }}>sin QR</div>}
        </td>
        <td>{l.fecha ? fmtFecha(l.fecha) : '—'}</td>
        <td className={cx(s.num, s.mono)}>{Number(l.total) > 0 ? money(l.total) : '—'}</td>
        <td>
          {l.sucursalNombre || <span className={s.muted}>—</span>}
          {l.usuarioNombre && <div className={s.hint} style={{ margin: 0 }}>subió {l.usuarioNombre}</div>}
        </td>
        <td>
          {l.estado === 'pendiente' ? (
            l.listo
              ? <Pill pill="est-recibida" label="Lista para cargar" />
              : (
                <span title={l.rojos.join(' · ')}>
                  <Pill pill="est-pendiente" label={l.rojos.length === 1 ? 'Falta un dato' : `Faltan ${l.rojos.length} datos`} />
                </span>
              )
          ) : <Pill pill={est.pill} label={est.label || l.estado} />}
          {l.duplicadoDe && (
            <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger, #b91c1c)' }}>
              ya cargada (#{l.duplicadoDe})
            </div>
          )}
        </td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={stop}>
            {l.estado === 'pendiente' && isAdmin && (
              <Btn
                variant={l.listo ? 'btn-primary' : 'btn-ghost'}
                small
                onClick={() => openModal('lecturaFactura', { id: l.id })}
              >
                {l.listo ? 'Procesar' : 'Completar'}
              </Btn>
            )}
            {l.estado === 'pendiente' && isAdmin && (
              <Btn small onClick={() => descartar(l)}>Descartar</Btn>
            )}
            {l.estado === 'descartada' && isAdmin && (
              <Btn small onClick={() => recuperar(l)}>Recuperar</Btn>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Facturas por procesar"
        desc="Subí la foto de la factura cuando llega el camión; cargarla puede esperar. El encabezado sale del QR del papel: proveedor, número, fecha, total y CAE, sin tipear nada."
        actions={(
          <Btn variant="btn-primary" onClick={() => inputRef.current?.click()} disabled={!!subiendo}>
            {subiendo ? 'Subiendo…' : '+ Subir facturas'}
          </Btn>
        )}
      />

      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_ACEPTADOS}
        multiple
        hidden
        onChange={(e) => { subir(e.target.files); e.target.value = ''; }}
      />

      {/* Soltar los archivos encima es la forma natural de descargar un pilón de
          fotos del celular: se seleccionan todas y se arrastran de una. */}
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${arrastrando ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`,
          background: arrastrando ? 'var(--crm-color-surface-2, rgba(0,0,0,.02))' : 'transparent',
          borderRadius: 'var(--crm-radius-md, 10px)',
          padding: 'var(--crm-space-5) var(--crm-space-4)',
          textAlign: 'center',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontWeight: 600 }}>
          {subiendo ? `Leyendo el QR y guardando… ${subiendo}` : 'Arrastrá acá las fotos de las facturas'}
        </div>
        <div className={s.hint} style={{ marginTop: 6 }}>
          Fotos JPG/PNG/WebP o PDF, hasta {MAX_ENTRADA_MB} MB cada uno. Cada archivo es una factura
          (la de varias hojas se arma agregando páginas desde su detalle). Del PDF no se lee el QR:
          su encabezado se carga a mano.
        </div>
      </div>

      {vista === 'pendiente' && lecturas.length > 0 && (
        <div className={s.stats}>
          <Stat label="Esperando" value={resumen.total} />
          <Stat label="Listas para cargar" value={resumen.listas} accent="accent-green" />
          <Stat label="Les falta un dato" value={resumen.frenadas} accent="accent-amber" />
          <Stat label="Suman (según el papel)" value={money(resumen.importe)} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={cx(s.badge)}
            style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 13, border: '1px solid var(--crm-color-border)',
              ...(vista === v.id
                ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                : {}),
            }}
            onClick={() => setVista(v.id)}
          >
            {v.label}
          </button>
        ))}
        <Btn small onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      <Table
        cols={[
          { h: 'Papel' }, { h: 'Proveedor' }, { h: 'Comprobante' }, { h: 'Fecha' },
          { h: 'Total del papel', num: true }, { h: 'Recibió' }, { h: 'Estado' },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={cargando ? 'Cargando…' : ({
          pendiente: 'No hay facturas esperando. Subí las fotos y el encabezado se lee solo del QR.',
          cargada: 'Todavía no se procesó ninguna factura de la bandeja.',
          descartada: 'Nada descartado.',
        }[vista])}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        <strong>Lo que se lee del papel y lo que no.</strong> El QR de la factura es un dato exacto
        —o se lee o no se lee— y de ahí salen proveedor, tipo, número, fecha, total y CAE. Los
        renglones se cargan a mano, y al hacerlo el pie compara con el total del papel: si cierra,
        la carga está verificada. <strong>Ese control mira la plata, no las cantidades</strong>: una
        caja de 12 cargada como 1 unidad cierra igual y el stock queda mal, así que el número de
        bultos hay que mirarlo aparte.
      </div>
    </div>
  );
}
