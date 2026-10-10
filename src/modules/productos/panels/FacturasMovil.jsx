/**
 * FACTURAS EN EL CELULAR (/facturas, 0153) — sacarle la foto al papel.
 * ============================================================================
 * Pedido del dueño: subir las facturas desde el teléfono. Fuera del menú del
 * ERP, con el estilo del Cash Flow: «Sacar foto» (cada foto es una factura),
 * «Otra hoja» para la que tiene varias, o elegir PDF/fotos en tanda. La IA las
 * lee sola en el servidor; acá se ve en qué anda cada una. La carga (revisar
 * y confirmar) se hace en la computadora: Compras › Procesamiento de facturas.
 * Solo superadmin y admin.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { httpClient } from '@core/services/httpClient.js';
import { leerSesion } from '@core/auth/sesion.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import c from '@modules/gerencia/panels/cashflow/CashFlowMovil.module.css';
import { money } from '../domain/format.js';
import { TIPOS_COMPROBANTE } from '../domain/constants.js';
import { TIPOS_ACEPTADOS, prepararArchivo, prepararFactura } from '../domain/leerFactura.js';

const errorDe = (e) => e?.data?.message || e?.message || 'No se pudo.';

/** En qué anda cada factura, en palabras. */
function estadoIa(l) {
  switch (l.iaEstado) {
    case 'en_cola': case 'leyendo': return { texto: 'La IA la está leyendo…', tono: '' };
    case 'lista': return l.iaResumen?.cierra
      ? { texto: `Leída ✓ · ${l.iaResumen.renglones} renglones · la cuenta cierra`, tono: 'ok' }
      : { texto: 'Leída · la cuenta no cierra: revisala en la compu', tono: 'warn' };
    case 'error': return { texto: `No se pudo leer: ${l.iaResumen?.error || ''}`, tono: 'error' };
    case 'tope': return { texto: 'Se llegó al tope de gasto del mes', tono: 'warn' };
    default: return { texto: l.paginas ? 'Sin leer' : 'Sin archivo', tono: '' };
  }
}

export function FacturasMovil() {
  const navigate = useNavigate();
  const { can, esAdmin } = usePermissions();
  const puede = esAdmin && can('compras.lecturas');
  const [lista, setLista] = useState(null);
  const [subiendo, setSubiendo] = useState('');
  const [aviso, setAviso] = useState(null);
  const [ultima, setUltima] = useState(null);
  const foto = useRef(null);
  const hoja = useRef(null);
  const archivos = useRef(null);
  const enVuelo = useRef(false);

  const cargar = useCallback(async () => {
    try { setLista(await httpClient.get('/facturas/lecturas?estado=pendiente&limit=60')); } catch (e) { setAviso({ tono: 'error', texto: errorDe(e) }); }
  }, []);
  useEffect(() => { if (puede) cargar(); }, [puede, cargar]);
  const leyendo = (lista ?? []).some((l) => l.iaEstado === 'en_cola' || l.iaEstado === 'leyendo');
  useEffect(() => {
    if (!leyendo) return undefined;
    const t = setInterval(cargar, 4000);
    return () => clearInterval(t);
  }, [leyendo, cargar]);

  /** Cada archivo es una factura nueva; el QR se lee del original (antes de comprimir). */
  const subir = async (files) => {
    const todos = Array.from(files || []).filter(Boolean);
    if (!todos.length || enVuelo.current) return;
    enVuelo.current = true;
    const sesion = leerSesion();
    let ok = 0;
    try {
      for (const [i, file] of todos.entries()) {
        setSubiendo(todos.length > 1 ? `Subiendo ${i + 1} de ${todos.length}…` : 'Subiendo…');
        try {
          const { qr, archivo } = await prepararFactura(file);
          const r = await httpClient.post('/facturas/lecturas', {
            archivos: [archivo], qr: qr || undefined,
            usuarioId: sesion?.usuario?.id ?? undefined, sucursalId: sesion?.sucursal?.id ?? undefined,
          });
          setUltima(r.id);
          ok++;
        } catch (e) { setAviso({ tono: 'error', texto: `${file.name}: ${errorDe(e)}` }); }
      }
      if (ok) setAviso({ tono: 'ok', texto: `${ok === 1 ? 'Factura subida' : `${ok} facturas subidas`}: la IA la${ok === 1 ? '' : 's'} lee sola.` });
      cargar();
    } finally { setSubiendo(''); enVuelo.current = false; }
  };

  /** Otra hoja de la ÚLTIMA factura subida (la de varias hojas). */
  const agregarHoja = async (file) => {
    if (!file || !ultima || enVuelo.current) return;
    enVuelo.current = true;
    setSubiendo('Agregando la hoja…');
    try {
      await httpClient.post(`/facturas/lecturas/${ultima}/archivos`, await prepararArchivo(file));
      setAviso({ tono: 'ok', texto: 'Hoja agregada: la IA la vuelve a leer entera.' });
      cargar();
    } catch (e) { setAviso({ tono: 'error', texto: errorDe(e) }); } finally { setSubiendo(''); enVuelo.current = false; }
  };

  if (!puede) {
    return (
      <div className={c.app}>
        <div className={c.centro}>
          <strong style={{ fontSize: 18 }}>Cargar facturas es del superadmin y el admin</strong>
          <p className={c.nota}>Con este usuario no se puede. Entrá con el superadmin o el admin.</p>
          <button type="button" className={cx(c.btn, c.btnPrimario)} onClick={() => navigate('/')}>Ir al ERP</button>
        </div>
      </div>
    );
  }

  return (
    <div className={c.app} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
      <header className={c.top}>
        <div className={c.topTitulo}>
          <strong>Facturas</strong>
          <span>Sabor y Aroma · las lee la IA</span>
        </div>
        <button type="button" className={c.icono} onClick={cargar} aria-label="Actualizar"><RefreshIcon /></button>
        <button type="button" className={c.icono} onClick={() => navigate('/')} aria-label="Abrir el ERP"><OpenInNewRoundedIcon /></button>
      </header>

      <main className={c.contenido}>
        <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
        <input ref={hoja} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { agregarHoja(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={archivos} type="file" accept={TIPOS_ACEPTADOS} multiple hidden onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />

        <button type="button" className={cx(c.btn, c.btnPrimario, c.btnAncho)} style={{ minHeight: 64, fontSize: 17 }} disabled={!!subiendo} onClick={() => foto.current?.click()}>
          <PhotoCameraRoundedIcon /> {subiendo || 'Sacar foto de una factura'}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button type="button" className={c.btn} disabled={!!subiendo || !ultima} onClick={() => hoja.current?.click()}>+ Otra hoja de la última</button>
          <button type="button" className={c.btn} disabled={!!subiendo} onClick={() => archivos.current?.click()}><UploadFileRoundedIcon /> PDF o fotos</button>
        </div>
        <p className={c.nota}>
          Una foto por factura, derecha y con buena luz, que se lea entera. Si tiene varias hojas, sacá la primera y después «Otra hoja».
          La IA la lee sola; la revisás y la cargás en la computadora (Compras › Procesamiento de facturas).
        </p>

        {aviso && (
          <div className={c.aviso} data-tono={aviso.tono === 'error' ? 'error' : undefined} role="status">
            {aviso.tono !== 'ok' && <WarningAmberRoundedIcon />}<span>{aviso.texto}</span>
          </div>
        )}

        <section className={c.seccion}>
          <div className={c.seccionHead}><h2>Esperando ({lista?.length ?? '…'})</h2></div>
          <div className={cx(c.card, c.lista)}>
            {lista && !lista.length && <div className={c.vacio}>No hay facturas esperando.</div>}
            {(lista ?? []).map((l) => {
              const e = estadoIa(l);
              return (
                <div key={l.id} className={c.fila}>
                  <span className={c.filaTexto}>
                    <strong>{l.proveedorNombre || (l.cuit ? `CUIT ${l.cuit}` : `Factura #${l.id}`)}</strong>
                    <small>
                      {l.tipo ? `${TIPOS_COMPROBANTE[l.tipo]?.label || l.tipo} ${l.letra || ''} ${l.numero ? `${l.puntoVenta}-${l.numero}` : ''}` : 'Sin datos todavía'}
                      {l.paginas > 1 ? ` · ${l.paginas} hojas` : ''}
                    </small>
                    <small style={{ color: e.tono === 'ok' ? 'var(--crm-color-primary)' : e.tono === 'warn' ? 'var(--crm-color-warning)' : e.tono === 'error' ? 'var(--crm-color-danger)' : undefined }}>
                      {e.texto}
                    </small>
                  </span>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{Number(l.total) > 0 ? money(l.total) : ''}</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
