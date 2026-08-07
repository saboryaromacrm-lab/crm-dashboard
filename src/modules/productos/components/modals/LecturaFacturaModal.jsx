/**
 * UNA FACTURA DE LA BANDEJA — revisar el encabezado y procesarla.
 * ============================================================================
 * Lo que hace útil a esta pantalla no es el formulario: es tener **el papel al
 * lado**. El encabezado ya vino del QR (exacto), así que casi nunca hay nada que
 * corregir; lo que falta es lo que el papel NO dice y nadie puede adivinar —
 * sobre todo **en qué sucursal entró la mercadería**, que lo sabe la persona que
 * la recibió y no está escrito en ninguna parte de la factura.
 *
 * "Procesar" guarda las correcciones y abre el alta del comprobante con todo
 * puesto: los renglones se cargan ahí, y el pie compara contra el total del
 * papel para avisar si cierra.
 */
import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { ModalShell } from '../Modal.jsx';
import { money, fmtFecha } from '../../domain/format.js';
import { TIPOS_COMPROBANTE } from '../../domain/constants.js';
import { s } from '../ui.jsx';
import { TIPOS_ACEPTADOS, prepararArchivo, esPdf } from '../../domain/leerFactura.js';

export function LecturaFacturaModal({ id }) {
  const { store, closeModal, toast, openModal } = useProductos();

  const [l, setL] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  /* El encabezado, editable. Arranca con lo que dijo el QR. */
  const [proveedorId, setProveedorId] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [tipo, setTipo] = useState('factura');
  const [letra, setLetra] = useState('A');
  const [puntoVenta, setPuntoVenta] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState('');
  const [total, setTotal] = useState('');

  const cargar = async () => {
    try {
      const r = await store.lecturaFactura(id);
      setL(r);
      setProveedorId(r.proveedorId ? String(r.proveedorId) : '');
      setSucursalId(r.sucursalId ? String(r.sucursalId) : '');
      setTipo(r.tipo || 'factura');
      setLetra(r.letra || 'A');
      setPuntoVenta(r.puntoVenta || '0001');
      setNumero(r.numero != null ? String(r.numero) : '');
      setFecha(r.fecha ? String(r.fecha).slice(0, 10) : '');
      setTotal(Number(r.total) > 0 ? String(r.total) : '');
    } catch (e) {
      setError(e?.data?.message || 'No se pudo cargar la factura.');
    }
  };
  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useMemo(() => ({
    proveedorId: proveedorId ? Number(proveedorId) : 0,
    sucursalId: sucursalId ? Number(sucursalId) : 0,
    tipo,
    letra,
    puntoVenta: puntoVenta || '0001',
    numero: numero ? Number(numero) : 0,
    fecha: fecha || '',
    total: Number(total) || 0,
  }), [proveedorId, sucursalId, tipo, letra, puntoVenta, numero, fecha, total]);

  /** Lo que falta, calculado acá para que el botón reaccione a cada tecla. */
  const faltan = useMemo(() => {
    const f = [];
    if (!patch.proveedorId) f.push('el proveedor');
    if (!patch.numero) f.push('el número');
    if (!patch.sucursalId) f.push('la sucursal que recibió la mercadería');
    return f;
  }, [patch]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await store.guardarLecturaFactura(id, patch);
      setL(r);
      return r;
    } finally {
      setGuardando(false);
    }
  };

  const procesar = async () => {
    if (faltan.length) { toast(`Falta ${faltan.join(', ')}.`, 'err'); return; }
    try {
      const actual = await guardar();
      if (actual.duplicadoDe) {
        toast(`Esta factura ya está cargada (comprobante #${actual.duplicadoDe}).`, 'err');
        return;
      }
      // El alta se abre con el encabezado ya puesto y el proveedor FIJO: salió
      // del CUIT del papel, que es exacto — no es una coincidencia de nombre.
      openModal('comprobanteForm', { proveedorId: actual.proveedorId, lectura: actual });
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar.', 'err');
    }
  };

  const vincular = async () => {
    try {
      const r = await store.vincularLecturaFactura(id, l.duplicadoDe);
      if (r && r.ok === false) throw new Error(r.error);
      toast(`El papel quedó guardado en el comprobante #${l.duplicadoDe}.`, 'ok');
      closeModal();
    } catch (e) {
      toast(e?.data?.message || e?.message || 'No se pudo enganchar el papel.', 'err');
    }
  };

  const descartar = async () => {
    try {
      await store.descartarLecturaFactura(id, l?.duplicadoDe ? 'Duplicada' : '');
      toast('Factura descartada. El papel queda guardado.', 'ok');
      closeModal();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo descartar.', 'err');
    }
  };

  const agregarPagina = async (file) => {
    if (!file) return;
    try {
      const archivo = await prepararArchivo(file);
      setL(await store.agregarPaginaFactura(id, archivo));
      toast('Página agregada.', 'ok');
    } catch (e) {
      toast(e?.data?.message || e?.message || 'No se pudo agregar la página.', 'err');
    }
  };

  const borrarPagina = async (archivoId) => {
    try {
      setL(await store.borrarPaginaFactura(archivoId));
      toast('Página quitada.', 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo quitar la página.', 'err');
    }
  };

  if (error) {
    return (
      <ModalShell title="Factura de la bandeja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={cx(s.callout, s.warn)}>{error}</div>
      </ModalShell>
    );
  }
  if (!l) {
    return (
      <ModalShell title="Factura de la bandeja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={s.hint}>Cargando…</div>
      </ModalShell>
    );
  }

  const editable = l.estado === 'pendiente';
  const footer = editable
    ? [
      { texto: 'Descartar', clase: 'btn-ghost', onClick: descartar },
      { texto: guardando ? 'Guardando…' : 'Guardar', clase: 'btn-ghost', onClick: () => guardar().then(() => toast('Guardado.', 'ok')).catch((e) => toast(e?.data?.message || 'No se pudo guardar.', 'err')) },
      { texto: 'Procesar', clase: 'btn-primary', onClick: procesar },
    ]
    : [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];

  return (
    <ModalShell
      title="Factura de la bandeja"
      subtitle={l.leido
        ? 'El encabezado salió del QR del papel: es exacto, no interpretado'
        : 'Sin QR legible: el encabezado se carga a mano'}
      wide
      onClose={closeModal}
      footer={footer}
    >
      {/* Lo que frena la carga, primero y en rojo: son decisiones, no datos que
          el sistema pueda inventar. */}
      {editable && faltan.length > 0 && (
        <div className={cx(s.callout, s.warn)}>
          Para poder cargarla falta <strong>{faltan.join(', ')}</strong>.
          {!l.proveedorId && l.cuit && (
            <> El CUIT <span className={s.mono}>{l.cuit}</span> no está en ningún proveedor:
              cargalo en su ficha (Proveedores) y la próxima factura se reconoce sola.</>
          )}
        </div>
      )}

      {l.duplicadoDe && (
        <div className={cx(s.callout, s.warn)}>
          <strong>Esta factura ya está cargada</strong> en el comprobante #{l.duplicadoDe}. Si la
          habías cargado a mano, engancharle el papel es mejor que descartarlo: queda guardado
          donde corresponde.
          <div style={{ marginTop: 8 }}>
            <button type="button" className={cx(s.btn, s['btn-primary'], s['btn-sm'])} onClick={vincular}>
              Enganchar el papel al #{l.duplicadoDe}
            </button>
          </div>
        </div>
      )}

      {l.observaciones && <div className={cx(s.callout)}>{l.observaciones}</div>}

      {l.amarillos?.length > 0 && (
        <div className={s.hint}>{l.amarillos.join(' · ')}</div>
      )}

      {/* EL PAPEL. Es la razón de ser de esta pantalla: se mira mientras se
          revisa, y se abre en grande en otra pestaña para leer la letra chica. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: 'var(--crm-space-3) 0' }}>
        {(l.archivos || []).map((a, i) => (
          <div key={a.id} style={{ position: 'relative' }}>
            <a href={store.urlPapelFactura(a.id)} target="_blank" rel="noreferrer" title="Abrir en grande">
              {esPdf({ type: a.mime })
                ? (
                  <div style={{
                    width: 120, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--crm-color-border)', borderRadius: 8, fontSize: 12, textAlign: 'center', padding: 8,
                  }}>
                    PDF · página {i + 1}
                  </div>
                )
                : (
                  <img
                    src={store.urlPapelFactura(a.id)}
                    alt={`Página ${i + 1}`}
                    style={{
                      width: 120, height: 150, objectFit: 'cover', objectPosition: 'top',
                      border: '1px solid var(--crm-color-border)', borderRadius: 8, background: '#fff',
                    }}
                  />
                )}
            </a>
            {editable && (l.archivos || []).length > 1 && (
              <button
                type="button"
                className={s['pres-remove']}
                title="Quitar esta página"
                style={{ position: 'absolute', top: -6, right: -6 }}
                onClick={() => borrarPagina(a.id)}
              >×</button>
            )}
          </div>
        ))}
        {editable && (
          <label
            className={cx(s.btn, s['btn-ghost'], s['btn-sm'])}
            style={{ alignSelf: 'center', cursor: 'pointer' }}
          >
            + Agregar página
            <input
              type="file"
              accept={TIPOS_ACEPTADOS}
              hidden
              onChange={(e) => { agregarPagina(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
        )}
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Proveedor <span className={s.req}>*</span></label>
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} disabled={!editable}>
            <option value="">— elegir —</option>
            {store.state.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {l.cuit && <div className={s.hint}>CUIT del papel: <span className={s.mono}>{l.cuit}</span></div>}
        </div>
        <div className={s.field}>
          <label>Sucursal que recibió <span className={s.req}>*</span></label>
          <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} disabled={!editable}>
            <option value="">— elegir —</option>
            {store.state.sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
          <div className={s.hint}>La factura no lo dice: lo sabe quien recibió la mercadería.</div>
        </div>
        <div className={s.field}>
          <label>Tipo <span className={s.req}>*</span></label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={!editable}>
            {Object.keys(TIPOS_COMPROBANTE).map((k) => (
              <option key={k} value={k}>{TIPOS_COMPROBANTE[k].label}</option>
            ))}
          </select>
        </div>
        <div className={s.field}>
          <label>Letra</label>
          <select value={letra} onChange={(e) => setLetra(e.target.value)} disabled={!editable}>
            {['A', 'B', 'C', 'X'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Punto de venta</label>
          <input value={puntoVenta} onChange={(e) => setPuntoVenta(e.target.value)} disabled={!editable} />
        </div>
        <div className={s.field}>
          <label>Número <span className={s.req}>*</span></label>
          <input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} disabled={!editable} />
        </div>
        <div className={s.field}>
          <label>Fecha del papel</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={!editable} />
        </div>
        <div className={s.field}>
          <label>Total que dice el papel</label>
          <input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} disabled={!editable} />
          <div className={s.hint}>
            Es el número contra el que se valida que los renglones cierren. Sin él, la carga no se
            puede verificar.
          </div>
        </div>
      </div>

      <div className={s.hint}>
        {l.cae && <>CAE <span className={s.mono}>{l.cae}</span> · </>}
        Subida {fmtFecha(l.subidoEn)}
        {l.usuarioNombre ? ` por ${l.usuarioNombre}` : ''}
        {l.estado === 'cargada' && l.comprobanteId && <> · cargada como comprobante #{l.comprobanteId}</>}
        {Number(l.total) > 0 && <> · el papel dice {money(l.total)}</>}
      </div>
    </ModalShell>
  );
}
