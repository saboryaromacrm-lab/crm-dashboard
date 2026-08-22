/**
 * SISTEMA — lo que es del sistema, no de un circuito
 * ============================================================================
 * Arranca con dos secciones:
 *   - EMPRESA: nombre, CUIT, logo y color de marca → el membrete de TODOS los
 *     documentos impresos.
 *   - IMPRESIÓN: qué formato usa cada documento (rollo 80/58 · A4 · Carta),
 *     el ticket automático al cobrar y el pie. Con vista previa en vivo.
 *
 * La impresora FÍSICA la elige cada puesto en el diálogo del navegador; en la
 * caja, Chrome con --kiosk-printing imprime directo a la predeterminada.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import {
  FORMATOS_LABEL, cuerpoCartelGondola, cuerpoEtiquetas, cuerpoFactura, cuerpoPlanillaConteo, esFormatoEtiqueta,
  formatoPorDefecto, htmlDocumento, imprimirDocumento, invalidarConfigImpresion,
} from '@core/services/imprimir.js';
import { PanelHead, Btn, s } from '@modules/productos/components/ui.jsx';
import { money, fmtFechaHora } from '@modules/productos/domain/format.js';
import { SISTEMA_SECCIONES } from '../config/sistema.config.js';
import { EsteEquipoPanel } from './EsteEquipoPanel.jsx';

/**
 * Los documentos configurables. `etiqueta: true` marca los que van a la
 * impresora TÉRMICA DE ETIQUETAS: solo se les ofrecen medidas de etiqueta, y a
 * los de papel no se les ofrece ninguna — elegir "50 × 30 mm" para el ticket o
 * "A4" para una etiqueta solo puede terminar en papel tirado.
 */
const DOCUMENTOS = [
  { clave: 'ticketPos', label: 'Ticket de venta (POS)', hint: 'Rollo 80 mm recomendado: más texto por línea. 58 mm para posnet/portátil.' },
  {
    clave: 'facturaVenta',
    label: 'Factura electrónica (ARCA)',
    hint: 'REEMPLAZA al ticket cuando la venta sale con CAE. Arranca en rollo porque sale de la misma impresora del mostrador; pasalo a A4 si el fuerte pasa a ser la Factura A del mayorista.',
  },
  { clave: 'presupuesto', label: 'Presupuesto (cliente)', hint: 'La hoja formal que se le manda al cliente.' },
  { clave: 'hojaArmado', label: 'Hoja de armado (presupuestos)', hint: 'Sin precios, con columna en blanco para el lápiz.' },
  { clave: 'listaPreparacion', label: 'Listas de preparación (envíos)', hint: 'Enteros y Fraccionados de las transferencias.' },
  { clave: 'remitoCafeteria', label: 'Remito a Cafetería', hint: 'El papel que acompaña la mercadería que sale para el café, valorizada a costo.' },
  { clave: 'planillaConteo', label: 'Planilla del control de stock', hint: 'La hoja que se lleva a la góndola: casillero en blanco para anotar a lápiz. Papel grande — en rollo no queda lugar para escribir.' },
  { clave: 'remitoTransferencia', label: 'Remito de transferencia', hint: 'Se reimprime desde el detalle de un envío. Lleva las tres cantidades —pedido, enviado y recibido— porque la diferencia entre ellas es lo que se reclama.' },
  { clave: 'valeMovimiento', label: 'Vale de movimiento de stock', hint: 'El papel que se firma al dar de baja mercadería (merma, vencido, defectuoso, ajuste). Chico a propósito: son tres renglones y se archiva de a uno.' },
  { clave: 'comprobanteGasto', label: 'Comprobante de gasto', hint: 'La ficha del gasto para archivar junto al papel del proveedor, con su IVA y percepciones.' },
  { clave: 'ordenPago', label: 'Orden de pago (proveedor)', hint: 'El recibo que se le ENTREGA al proveedor, con el detalle de qué se le cancela. En A4 aunque salga de la caja: un rollo térmico se borra en unos meses y esto es un recibo que pueden reclamarte.' },
  {
    clave: 'etiquetaFraccionado',
    label: 'Etiquetas del fraccionado (autoadhesivas)',
    hint: 'Impresora térmica de etiquetas: una etiqueta por página, sin membrete. Se sacan en Almacén › Fraccionamiento › Etiquetas.',
    etiqueta: true,
  },
  {
    clave: 'etiquetaGondola',
    label: 'Cartel de góndola (autoadhesivas)',
    hint: 'El precio que el cliente lee en el estante. Misma impresora que las del fraccionado, pero con el nombre más grande y sin código de barras — arranca en la medida más grande porque se lee de lejos. Se sacan en Ventas › Carteles de góndola.',
    etiqueta: true,
  },
];

const MAX_LOGO_KB = 400;

/**
 * Documento de muestra para la vista previa (no toca datos reales).
 *
 * Es `async` porque la factura dibuja su QR, y eso devuelve una promesa. Los
 * demás documentos siguen siendo texto y no esperan nada.
 */
async function cuerpoMuestra(clave, empresa) {
  if (clave === 'facturaVenta') {
    /* La MISMA función que imprime la factura de verdad, con una venta de
     * mentira: una vista previa armada aparte es la que después no se parece
     * a lo que sale. El CAE y el QR son inventados — el QR va a existir y a
     * dibujarse, pero ARCA no lo va a reconocer, que es lo correcto para una
     * muestra. */
    /* Los números CIERRAN entre sí (neto + IVA = total, y los renglones suman
     * el neto): una muestra que no cuadra enseña a desconfiar del documento. */
    return cuerpoFactura({
      tipo: 'factura_b',
      codigoComprobante: 6,
      puntoVenta: '0003',
      numero: 42,
      fecha: '2026-08-19T18:30:00-03:00',
      clienteNombre: 'Consumidor Final',
      cliente: { tipoDoc: 'sin_identificar', numeroDoc: '', condicionIva: 'consumidor_final', direccion: '' },
      items: [
        { nombre: 'Miel Pura 500g', cantidad: 2, subtotal: 10000, iva: 21 },
        { nombre: 'Barrita de Cereal Frutal', cantidad: 3, subtotal: 2000, iva: 21 },
      ],
      extras: [],
      subtotalNeto: 12000,
      total: 14520,
      cae: '75123456789012',
      caeVencimiento: '2026-08-29T12:00:00-03:00',
      qrArca: 'https://www.afip.gob.ar/fe/qr/?p=VISTA_PREVIA_SIN_VALOR_FISCAL',
    }, { moneda: money, fecha: fmtFechaHora, empresa: empresa ?? {} });
  }
  if (clave === 'etiquetaFraccionado') {
    // Dos etiquetas para que se vea cómo queda una al lado de la otra en el rollo.
    return cuerpoEtiquetas({
      nombre: 'Lentejas', peso: '500 g', precio: '$1.850,00',
      codigo: '6850000001491', vencimiento: '15/09/2026', cantidad: 2,
    });
  }
  if (clave === 'etiquetaGondola') {
    /* Dos carteles y a propósito distintos: uno completo con los dos precios y
     * otro con la marca sola, que es el caso que más sorprende y el que hay que
     * poder ver antes de mandar cincuenta al rollo. */
    return cuerpoCartelGondola({
      marca: 'Zuelo', nombre: 'Aceite Oliva Intenso 500 ml',
      precio: '$5.000,00', precioMayorista: '$4.300,00',
    }) + cuerpoCartelGondola({ marca: '', nombre: 'ACEITES', precio: '', precioMayorista: '' });
  }
  if (clave === 'ticketPos') {
    return `
      <h1>Ticket 0001-00000042</h1>
      <div class="sub">03/08/2026 18:30 · Consumidor Final</div>
      <table><tbody>
        <tr><td>Miel Pura 500g<br /><span style="color:#555">2 x $6.020,00</span></td><td class="n">$12.040,00</td></tr>
        <tr><td>Barrita de Cereal Frutal<br /><span style="color:#555">3 x $900,00</span></td><td class="n">$2.700,00</td></tr>
      </tbody></table>
      <div class="tot"><strong>TOTAL $14.740,00</strong></div>
      <div class="fiscal">DOCUMENTO NO FISCAL</div>`;
  }
  if (clave === 'planillaConteo') {
    // La MISMA función que imprime la planilla de verdad: una vista previa que
    // se arma aparte es la que después no se parece a lo que sale.
    return cuerpoPlanillaConteo({
      titulo: 'Góndola CUMANA',
      alcance: 'Marca CUMANA · solo con stock',
      sucursal: 'Distribuidora',
      impresa: '18/08/2026 21:40',
      hoja: 'pendientes de contar',
      filas: [
        { nombre: 'Avena Tradicional CUMANA x400g', presLabel: '', unidad: 'u', codigo: '7790040001234', apartados: 0 },
        { nombre: 'Ajo en Polvo', presLabel: '500 g', unidad: 'u', codigo: '6850000001491', apartados: 12 },
        { nombre: 'Ajo en Polvo', presLabel: '', unidad: 'kg', codigo: '', apartados: 0, recontar: true },
      ],
    });
  }
  return `
    <h1>Presupuesto PR0001</h1>
    <div class="sub">Kiosco La Esquina · 03/08/2026 · <strong>válido hasta 10/08/2026</strong></div>
    <table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Importe</th></tr></thead>
    <tbody>
      <tr><td>Barrita de Cereal Frutal</td><td class="chica n">24</td><td class="chica n">$900,00</td><td class="chica n"><strong>$21.600,00</strong></td></tr>
      <tr><td>Miel Pura 500g</td><td class="chica n">6</td><td class="chica n">$6.020,00</td><td class="chica n"><strong>$36.120,00</strong></td></tr>
    </tbody></table>
    <div class="tot">Total: <strong>$57.720,00</strong></div>`;
}

function Proximamente({ seccion }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead title={seccion.label} desc={seccion.desc} />
      <div className={cx(s.callout, s.info)}>
        <strong>Próximamente.</strong> Esta sección está en la agenda y todavía no se construyó.
      </div>
    </div>
  );
}

export function SistemaPage() {
  const { can } = usePermissions();
  // Solo las secciones del rol: lo no asignado no se muestra, ni en el menú.
  const secciones = useMemo(() => SISTEMA_SECCIONES.filter((x) => can(x.permiso)), [can]);
  const [seccion, setSeccion] = useState(secciones[0]?.id);
  const [empresa, setEmpresa] = useState(null);
  const [impresion, setImpresion] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [previewDoc, setPreviewDoc] = useState('ticketPos');

  const cargar = useCallback(async () => {
    try {
      const [e, i] = await Promise.all([
        httpClient.get('/configuracion/empresa'),
        httpClient.get('/configuracion/impresion'),
      ]);
      setEmpresa(e);
      setImpresion(i);
    } catch (err) {
      setAviso({ tipo: 'err', texto: err?.data?.message || 'No se pudo conectar con la API.' });
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  /**
   * Guarda y SE QUEDA CON LO QUE DEVOLVIÓ EL SERVIDOR, que es el valor ya
   * saneado. No es un detalle: el CUIT `30123456789` se guarda como
   * `30-12345678-9` y un color inválido vuelve al de la marca — sin esto, la
   * pantalla seguía mostrando lo que se tipeó hasta la próxima recarga, o sea
   * mintiendo sobre lo que quedó guardado.
   */
  const guardar = async (clave, valores) => {
    setGuardando(true);
    try {
      const saneado = await httpClient.put(`/configuracion/${clave}`, valores);
      if (saneado && typeof saneado === 'object') {
        if (clave === 'empresa') setEmpresa(saneado);
        if (clave === 'impresion') setImpresion(saneado);
      }
      invalidarConfigImpresion();
      setAviso({ tipo: 'ok', texto: 'Guardado. Impacta en la próxima impresión.' });
    } catch (e) {
      setAviso({ tipo: 'err', texto: e?.data?.message || 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  };

  const subirLogo = (file) => {
    if (!file) return;
    if (file.size > MAX_LOGO_KB * 1024) {
      setAviso({ tipo: 'err', texto: `El logo pesa demasiado: usá una imagen de hasta ${MAX_LOGO_KB} KB.` });
      return;
    }
    const r = new FileReader();
    r.onload = () => setEmpresa((e) => ({ ...e, logo: String(r.result) }));
    r.readAsDataURL(file);
  };

  /**
   * Vista previa EN VIVO: el mismo HTML que va a la impresora, en un iframe.
   *
   * Es un efecto y no un `useMemo` porque el cuerpo puede ser ASÍNCRONO — la
   * factura dibuja su QR, y eso devuelve una promesa. El `vivo` corta la
   * carrera: cambiando de documento rápido, la promesa vieja podía pisar la
   * nueva y la vista previa quedaba mostrando el documento anterior.
   */
  const [previewHtml, setPreviewHtml] = useState('');
  useEffect(() => {
    if (!empresa || !impresion) { setPreviewHtml(''); return undefined; }
    let vivo = true;
    (async () => {
      const html = htmlDocumento({
        empresa,
        formato: impresion[previewDoc] || formatoPorDefecto(previewDoc),
        titulo: 'Vista previa',
        cuerpo: await cuerpoMuestra(previewDoc, empresa),
        pie: previewDoc === 'ticketPos' ? impresion.pieTicket : '',
        esTicket: previewDoc === 'ticketPos',
      });
      if (vivo) setPreviewHtml(html);
    })();
    return () => { vivo = false; };
  }, [empresa, impresion, previewDoc]);

  if (!secciones.length) {
    return (
      <div style={{ padding: 'var(--crm-space-6)' }}>
        <PanelHead title="Sistema" desc="Configuración general del sistema." />
        <div className={cx(s.callout, s.warn)}>
          Tu rol no tiene ninguna sección de <strong>Sistema</strong> asignada.
        </div>
      </div>
    );
  }

  const cargando = !empresa || !impresion;
  // Si el permiso de la sección activa se fue (rol editado), cae a la primera visible.
  const seccionActiva = secciones.some((x) => x.id === seccion) ? seccion : secciones[0].id;

  return (
    <div style={{ padding: 'var(--crm-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead title="Sistema" desc="Identidad de la empresa, impresión y todo lo que es del sistema." />

      <div className={s.shell}>
        <nav className={s.subnav} aria-label="Secciones de Sistema">
          {secciones.map((x) => {
            const Icon = x.icon;
            return (
              <button
                key={x.id}
                type="button"
                className={cx(s.subnavItem, seccionActiva === x.id && s.subnavItemActive)}
                onClick={() => setSeccion(x.id)}
              >
                <span className={s.subnavIcon}><Icon fontSize="small" /></span>
                <span className={s.subnavLabel}>{x.label}</span>
                {x.pronto && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 7px',
                    borderRadius: 999, border: '1px solid var(--crm-color-border)',
                    color: 'var(--crm-color-text-muted)', whiteSpace: 'nowrap',
                  }}>
                    PRONTO
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={s.content}>
          {aviso && (
            <div className={cx(s.callout, aviso.tipo === 'ok' ? s.info : s.warn)} style={{ marginBottom: 12 }}>
              {aviso.texto}
            </div>
          )}
          {/* "Respaldos" no depende de la configuración: es texto fijo. Antes
              quedaba atrás del mismo candado de carga que las otras dos, así
              que con la API caída la sección se quedaba en "Cargando…" para
              siempre — una pantalla que no necesita ningún dato, esperando dos
              consultas que no le hacen falta. */}
          {cargando && seccionActiva !== 'respaldos' && <div className={s.hint}>Cargando…</div>}

          {!cargando && seccionActiva === 'empresa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
              <PanelHead
                title="Empresa"
                desc="El membrete de todos los documentos impresos: tickets, presupuestos y hojas de trabajo."
                actions={<Btn variant="btn-primary" disabled={guardando} onClick={() => guardar('empresa', empresa)}>{guardando ? 'Guardando…' : 'Guardar'}</Btn>}
              />
              <div className={s['form-grid']}>
                <div className={s.field}>
                  <label>Nombre de la empresa <span className={s.req}>*</span></label>
                  <input value={empresa.nombre} onChange={(e) => setEmpresa((x) => ({ ...x, nombre: e.target.value }))} />
                  <div className={s.hint}>El nombre de fantasía: con el que te conoce el cliente. Va grande en el membrete.</div>
                </div>
                <div className={s.field}>
                  <label>CUIT</label>
                  <input value={empresa.cuit} placeholder="30-12345678-9" onChange={(e) => setEmpresa((x) => ({ ...x, cuit: e.target.value }))} />
                </div>
              </div>
              {/* Separada del nombre a propósito: en una factura la razón social
                  es obligatoria (RG 1415) y puede no ser el nombre de fantasía
                  — acá se conoce "Sabor y Aroma" y factura una persona. */}
              <div className={s['form-grid']}>
                <div className={s.field}>
                  <label>Razón social (ante ARCA)</label>
                  <input
                    value={empresa.razonSocial ?? ''}
                    placeholder={empresa.nombre || 'Como figura en ARCA'}
                    onChange={(e) => setEmpresa((x) => ({ ...x, razonSocial: e.target.value }))}
                  />
                  <div className={s.hint}>
                    Quién factura, como figura ante ARCA. Va en las facturas y adentro del
                    certificado. Si es igual al nombre de arriba, dejala vacía.
                  </div>
                </div>
              </div>
              <div className={s['form-grid']}>
                <div className={s.field}>
                  <label>Dirección</label>
                  <input value={empresa.direccion} onChange={(e) => setEmpresa((x) => ({ ...x, direccion: e.target.value }))} />
                </div>
                <div className={s.field}>
                  <label>Teléfono</label>
                  <input value={empresa.telefono} onChange={(e) => setEmpresa((x) => ({ ...x, telefono: e.target.value }))} />
                </div>
              </div>
              <div className={s['form-grid']}>
                <div className={s.field}>
                  <label>Logo (PNG/JPG, hasta {MAX_LOGO_KB} KB)</label>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => subirLogo(e.target.files?.[0])} />
                  {empresa.logo ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <img src={empresa.logo} alt="Logo" style={{ maxHeight: 56, maxWidth: 180, border: '1px solid var(--crm-color-border)', borderRadius: 6, padding: 4 }} />
                      <Btn small onClick={() => setEmpresa((x) => ({ ...x, logo: '' }))}>Quitar</Btn>
                    </div>
                  ) : (
                    <div className={s.hint}>Sin logo todavía: los documentos salen solo con el nombre. Subilo cuando lo tengas.</div>
                  )}
                </div>
                <div className={s.field}>
                  <label>Color de la marca (documentos A4 — los rollos son B/N)</label>
                  <input type="color" value={empresa.colorMarca || '#166534'} style={{ width: 64, height: 38, padding: 2 }} onChange={(e) => setEmpresa((x) => ({ ...x, colorMarca: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {!cargando && seccionActiva === 'impresion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
              <PanelHead
                title="Impresión"
                desc="Qué formato usa cada documento. La impresora física la elige cada puesto al imprimir."
                actions={<Btn variant="btn-primary" disabled={guardando} onClick={() => guardar('impresion', impresion)}>{guardando ? 'Guardando…' : 'Guardar'}</Btn>}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(280px, 420px)', gap: 'var(--crm-space-5)', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {DOCUMENTOS.map((d) => (
                    <div key={d.clave} className={s.field} style={{ marginBottom: 0 }}>
                      <label>{d.label}</label>
                      <select value={impresion[d.clave] || formatoPorDefecto(d.clave)} onChange={(e) => setImpresion((x) => ({ ...x, [d.clave]: e.target.value }))}>
                        {Object.entries(FORMATOS_LABEL)
                          .filter(([id]) => esFormatoEtiqueta(id) === !!d.etiqueta)
                          .map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                      </select>
                      <div className={s.hint} style={{ margin: '4px 0 0' }}>{d.hint}</div>
                    </div>
                  ))}

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                    <input type="checkbox" checked={!!impresion.imprimirTicketAlCobrar} onChange={(e) => setImpresion((x) => ({ ...x, imprimirTicketAlCobrar: e.target.checked }))} />
                    Imprimir el ticket automáticamente al cobrar
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!impresion.leyendaNoFiscal} onChange={(e) => setImpresion((x) => ({ ...x, leyendaNoFiscal: e.target.checked }))} />
                    Leyenda “DOCUMENTO NO FISCAL” en el ticket (hasta que llegue ARCA)
                  </label>
                  <div className={s.field}>
                    <label>Pie del ticket</label>
                    <input value={impresion.pieTicket || ''} placeholder="¡Gracias por su compra!" onChange={(e) => setImpresion((x) => ({ ...x, pieTicket: e.target.value }))} />
                  </div>
                  <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
                    <strong>Caja sin diálogo:</strong> en la PC del POS, abrí Chrome con{' '}
                    <code>--kiosk-printing</code> y el ticket sale directo a la impresora predeterminada.
                  </div>
                </div>

                <div>
                  <div className={s.toolbar} style={{ marginBottom: 8 }}>
                    <span className={s['mini-label']}>Vista previa:</span>
                    <select className={s['select-inline']} value={previewDoc} onChange={(e) => setPreviewDoc(e.target.value)}>
                      {DOCUMENTOS.map((d) => <option key={d.clave} value={d.clave}>{d.label}</option>)}
                    </select>
                    <Btn
                      small
                      onClick={async () => {
                        await guardar('impresion', impresion);
                        imprimirDocumento(previewDoc, {
                          titulo: 'Impresión de prueba',
                          cuerpo: await cuerpoMuestra(previewDoc, empresa),
                          esTicket: previewDoc === 'ticketPos',
                        });
                      }}
                    >
                      Impresión de prueba
                    </Btn>
                  </div>
                  {/* El MISMO HTML que va a la impresora, achicado a la vista. */}
                  <iframe
                    title="Vista previa de impresión"
                    srcDoc={previewHtml}
                    style={{
                      // La etiqueta y el rollo se ven en su ancho real; el papel, a lo que dé.
                      // `formatoPorDefecto` y no 'a4' pelado: es el MISMO
                      // fallback que usan el motor y la vista previa de arriba.
                      // Con un documento sin clave guardada, el 'a4' suelto
                      // renderizaba una etiqueta y la mostraba a ancho completo.
                      width: esFormatoEtiqueta(impresion[previewDoc] || formatoPorDefecto(previewDoc)) ? 260
                        : (impresion[previewDoc] || formatoPorDefecto(previewDoc)).startsWith('rollo') ? 320 : '100%',
                      height: 460, border: '1px solid var(--crm-color-border)',
                      borderRadius: 'var(--crm-radius-sm)', background: '#fff',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* FUERA del `cargando`: esta sección no necesita ni empresa ni
              impresión, y si el rol no tuviera esos dos permisos la carga de
              arriba falla y el panel no aparecería nunca. */}
          {seccionActiva === 'terminales' && <EsteEquipoPanel onAviso={setAviso} />}

          {!cargando && seccionActiva === 'respaldos' && <Proximamente seccion={secciones.find((x) => x.id === 'respaldos')} />}
        </div>
      </div>
    </div>
  );
}
