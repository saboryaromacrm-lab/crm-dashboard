/**
 * PROCESAMIENTO DE FACTURAS — la bandeja de papeles subidos (Compras).
 * (Se llamaba "Por procesar" hasta el 28/9/2026.) Dos pestañas: la bandeja de
 * facturas y LECTURA CON IA (0153): el consumo, el tope y los últimos usos.
 * ============================================================================
 * Separa dos momentos que hasta ahora eran uno solo y no tienen por qué serlo:
 * **recibir el papel** y **cargar la factura**. La cajera saca la foto cuando
 * llega el camión y ahí termina su trabajo; el admin procesa la bandeja el
 * viernes. Ese desacople es lo que ahorra tiempo de verdad — el papel deja de
 * perderse entre el mostrador y el escritorio.
 *
 * LA IA LEE EL PAPEL (0153): al subirlo, el servidor se lo manda a la IA
 * (PDF, foto o escaneo) y vuelve con el encabezado, los renglones y el pie,
 * con la cuenta controlada. El **QR de la RG 4892**, si se leyó, manda en el
 * encabezado (es exacto) y su total es el control final. Nada se carga solo:
 * la persona revisa en el alta y confirma.
 *
 * El semáforo lo calcula la API: **rojo frena** (no hay forma de resolverlo
 * solo: falta el proveedor, el número, la sucursal, o está duplicada),
 * **amarillo avisa**. La regla es que los rojos sean pocos y verdaderos — si la
 * bandeja pregunta quince cosas por factura, el admin tipea más rápido a mano.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, fmtFecha } from '../domain/format.js';
import { ESTADOS_LECTURA, TIPOS_COMPROBANTE } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, Pill, usePaginado, s } from '../components/ui.jsx';
import { TIPOS_ACEPTADOS, MAX_ENTRADA_MB, prepararFactura } from '../domain/leerFactura.js';
import { LecturaIaPanel } from './LecturaIaPanel.jsx';

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

const TAB_KEY = 'crm.facturas.tab';

/** En qué anda la lectura con IA de una factura (y si la cuenta cerró). */
function EstadoIa({ l }) {
  const ia = l.iaResumen;
  switch (l.iaEstado) {
    case 'en_cola': return <span className={s.muted}>En cola…</span>;
    case 'leyendo': return <span className={s.muted}>Leyendo…</span>;
    case 'lista':
      return ia?.cierra
        ? <span title={`${ia.renglones} renglones`}><Pill pill="est-recibida" label="Leída ✓" /></span>
        : <span title={(ia?.problemas || []).join(' · ')}><Pill pill="est-pendiente" label="Leída · revisar" /></span>;
    case 'error': return <span title={ia?.error || ''}><Pill pill="est-cancelada" label="No se pudo leer" /></span>;
    case 'tope': return <span title={ia?.error || ''}><Pill pill="est-pendiente" label="Tope del mes" /></span>;
    default: return <span className={s.muted}>{l.paginas ? 'Sin leer' : '—'}</span>;
  }
}

export function LecturasPanel() {
  const { isAdmin } = useProductos();
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem(TAB_KEY) === 'ia' ? 'ia' : 'facturas'; } catch { return 'facturas'; }
  });
  const elegir = (v) => {
    setTab(v);
    try { sessionStorage.setItem(TAB_KEY, v); } catch { /* sin storage: arranca en Facturas */ }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <Tabs
        value={tab}
        onChange={(e, v) => elegir(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        <Tab value="facturas" label="Facturas" sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />
        {isAdmin && <Tab value="ia" label="Lectura con IA" sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />}
      </Tabs>
      {tab === 'ia' && isAdmin ? <LecturaIaPanel /> : <BandejaFacturas />}
    </div>
  );
}

/**
 * EL ESPACIO DE LAS YA CARGADAS (28/9/2026, pedido del dueño): una vez cargada,
 * la factura queda como comprobante y el archivo no hace falta. Las nuevas se
 * borran solas al cargarlas; esto libera las que quedaron guardadas de antes.
 * Borrar es para siempre: doble confirmación.
 */
function LiberarEspacio() {
  const { store, toast, isAdmin } = useProductos();
  const [espacio, setEspacio] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const enVuelo = useRef(false);
  useEffect(() => {
    let vivo = true;
    store.espacioFacturas().then((e) => { if (vivo) setEspacio(e); }).catch(() => {});
    return () => { vivo = false; };
  }, [store]);
  if (!isAdmin || !espacio?.archivos) return null;
  const mb = (espacio.bytes / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 });
  const liberar = async () => {
    if (!confirmando) { setConfirmando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setBorrando(true);
    try {
      const r = await store.liberarFacturas();
      setEspacio({ archivos: 0, bytes: 0 });
      toast(`Listo: se borraron ${r.borrados} archivo(s) de facturas ya cargadas.`, 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo liberar el espacio.', 'err');
    } finally {
      enVuelo.current = false;
      setBorrando(false);
      setConfirmando(false);
    }
  };
  return (
    <div className={cx(s.callout, confirmando ? s.warn : s.info)} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 240 }}>
        {confirmando
          ? <><strong>Segunda confirmación.</strong> Se borran para siempre {espacio.archivos} archivo(s) ({mb} MB) de facturas que ya están cargadas como comprobante. Los comprobantes no se tocan.</>
          : <>Las facturas ya cargadas todavía guardan <strong>{espacio.archivos} archivo(s)</strong> ({mb} MB). Una vez cargadas no hacen falta: liberarlas aliviana la base y los respaldos.</>}
      </span>
      {confirmando && <Btn small onClick={() => setConfirmando(false)} disabled={borrando}>Cancelar</Btn>}
      <Btn small variant={confirmando ? 'btn-danger' : 'btn-ghost'} onClick={liberar} disabled={borrando}>
        {borrando ? 'Borrando…' : confirmando ? 'Sí, borrar los archivos' : 'Liberar espacio'}
      </Btn>
    </div>
  );
}

function BandejaFacturas() {
  const { store, isAdmin, openModal, toast } = useProductos();

  const [vista, setVista] = useState('pendiente');
  const [lecturas, setLecturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef(null);

  const cargar = useCallback(async ({ callado = false } = {}) => {
    if (!callado) setCargando(true);
    try {
      setLecturas(await store.lecturasFactura(vista));
    } catch {
      if (!callado) toast('No se pudo cargar la bandeja de facturas.', 'err');
    } finally {
      if (!callado) setCargando(false);
    }
  }, [store, vista, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  /* Mientras la IA lee (en cola o leyendo), la bandeja se actualiza sola cada 4 s. */
  const leyendo = lecturas.some((l) => l.iaEstado === 'en_cola' || l.iaEstado === 'leyendo');
  useEffect(() => {
    if (!leyendo) return undefined;
    const t = setInterval(() => cargar({ callado: true }), 4000);
    return () => clearInterval(t);
  }, [leyendo, cargar]);

  const enVueloIa = useRef(false);
  /** Leer con la IA estas facturas (o, sin ids, todas las pendientes sin leer). */
  const leerConIa = async (ids) => {
    if (enVueloIa.current) return;
    enVueloIa.current = true;
    try {
      const r = await store.leerFacturasConIa(ids);
      toast(r.encoladas ? `La IA está leyendo ${r.encoladas} factura(s).` : 'No había facturas para leer.', 'ok');
      cargar({ callado: true });
    } catch (e) {
      toast(e?.data?.message || 'No se pudo mandar a leer.', 'err');
    } finally { enVueloIa.current = false; }
  };

  /*
   * Confirmar una factura crea un comprobante (que sí pasa por `_mutate`): al
   * versionar el store, la bandeja se re-pide y la que se cargó desaparece.
   *
   * SALTEA EL PRIMER RENDER. Sin eso, este efecto y el de arriba disparaban los
   * dos al montar y cada entrada a "Por procesar" pedía la bandeja DOS veces —
   * dos consultas idénticas, y la segunda pisando el resultado de la primera.
   */
  const version = store.getVersion?.() ?? 0;
  const versionVista = useRef(version);
  useEffect(() => {
    if (versionVista.current === version) return;
    versionVista.current = version;
    cargar();
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

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
      toast(`Listo: ${leidas + sinQr} factura(s) subida(s). La IA las lee en segundo plano.`, 'ok');
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
          {/* Cargada = el archivo se borró (no hace falta): 0 páginas es lo normal. */}
          {!l.paginas
            ? <span className={s.muted}>{l.estado === 'cargada' ? 'cargada' : 'sin archivo'}</span>
            : <span className={l.paginas > 1 ? s.mono : s.muted}>{l.paginas} pág.</span>}
        </td>
        <td>
          {l.proveedorNombre || <span className={cx(s.badge)}>sin proveedor</span>}
          {l.cuit && <div className={s.hint} style={{ margin: 0 }}>CUIT {l.cuit}</div>}
        </td>
        <td>
          {etiquetaDoc(l)}
          {!l.leido && <div className={s.hint} style={{ margin: 0 }}>{l.iaEstado === 'lista' ? 'leído por la IA' : 'sin QR'}</div>}
        </td>
        <td>{l.fecha ? fmtFecha(l.fecha) : '—'}</td>
        <td><EstadoIa l={l} /></td>
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
            {l.estado === 'pendiente' && isAdmin && l.paginas > 0 && ['', 'error', 'tope'].includes(l.iaEstado || '') && (
              <Btn small onClick={() => leerConIa([l.id])}>{l.iaEstado ? 'Reintentar IA' : 'Leer con IA'}</Btn>
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
        title="Procesamiento de facturas"
        desc="Subí las facturas (PDF, fotos o escaneos, de a una o en tanda): la IA las lee sola y deja la carga lista para revisar. Una vez cargada, el archivo se borra."
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isAdmin && vista === 'pendiente' && lecturas.some((l) => l.paginas > 0 && ['', 'error', 'tope'].includes(l.iaEstado || '')) && (
              <Btn onClick={() => leerConIa()}>Leer las pendientes con IA</Btn>
            )}
            <Btn variant="btn-primary" onClick={() => inputRef.current?.click()} disabled={!!subiendo}>
              {subiendo ? 'Subiendo…' : '+ Subir facturas'}
            </Btn>
          </div>
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
          {subiendo ? `Guardando… ${subiendo}` : 'Arrastrá acá las facturas (o tocá para elegirlas)'}
        </div>
        <div className={s.hint} style={{ marginTop: 6 }}>
          PDF o fotos JPG/PNG/WebP, hasta {MAX_ENTRADA_MB} MB cada uno, todas juntas si querés. Cada archivo
          es una factura (la de varias hojas se arma agregando páginas desde su detalle).
          Desde el celular, para sacarle la foto: <strong>erp.saboryaroma.com/facturas</strong>.
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

      {vista === 'cargada' && <LiberarEspacio />}

      <Table
        cols={[
          { h: 'Papel' }, { h: 'Proveedor' }, { h: 'Comprobante' }, { h: 'Fecha' }, { h: 'IA' },
          { h: 'Total del papel', num: true }, { h: 'Recibió' }, { h: 'Estado' },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={cargando ? 'Cargando…' : ({
          pendiente: 'No hay facturas esperando. Subilas y la IA las lee sola.',
          cargada: 'Todavía no se procesó ninguna factura de la bandeja.',
          descartada: 'Nada descartado.',
        }[vista])}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        <strong>Cómo lee la IA.</strong> Copia lo impreso (encabezado, renglones y pie) y el sistema
        controla la cuenta: cada renglón (cantidad × precio − descuentos), la suma contra el subtotal y
        el total. Si no cierra, la vuelve a leer sola con un modelo más fuerte; si igual no cierra,
        queda en amarillo para revisar. El QR, cuando se lee, manda en el encabezado. Los productos los
        reconoce el sistema con lo aprendido de cada proveedor. <strong>El control mira la plata, no las
        cantidades</strong>: una caja de 12 cargada como 1 unidad cierra igual, así que los bultos hay que
        mirarlos aparte.
      </div>
    </div>
  );
}
