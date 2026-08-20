/**
 * EL PANEL DE DIAGNÓSTICO DE ARCA (fase 6)
 * ============================================================================
 * La pregunta que contesta es una sola: **¿puedo facturar?** Y cuando la
 * respuesta es no, cuál de las cinco cosas falta.
 *
 * Vive pegado al interruptor de facturación electrónica porque son las dos
 * mitades de lo mismo: el interruptor es la INTENCIÓN (quiero facturar) y esto
 * es la CAPACIDAD (puedo). Separarlos deja al dueño prendiendo una perilla sin
 * forma de saber si va a hacer algo.
 *
 * DOS LECTURAS, Y NO ES UN CAPRICHO:
 *
 *  · **El estado** (entorno, CUIT, punto de venta, certificado, trabadas) sale
 *    de leer el entorno y mirar el disco. Es instantáneo y se pide al abrir.
 *  · **Probar la conexión** sale a la red contra ARCA y puede tardar diez
 *    segundos —eso es lo que cuesta un ticket de acceso nuevo—, así que lo
 *    dispara el usuario. Si esto corriera solo, abrir Configuración se
 *    colgaría diez segundos contra un servicio ajeno.
 *
 * PRODUCCIÓN VA EN ROJO. No es decoración: es la única diferencia visible
 * entre emitir contra un ambiente de prueba sin ningún valor fiscal y emitir
 * facturas de verdad, y la equivocación no se puede deshacer.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { TIPOS_VENTA } from '../domain/constants.js';
import { CertificadoArca } from './CertificadoArca.jsx';
import { Table, Btn, Di, money, fmtFechaHora, s } from './ui.jsx';

/** '30715556667' → '30-71555666-7'. Como se lee en un papel. */
const cuitLindo = (c) => {
  const d = String(c ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : (d || '—');
};

export function PanelArca({ habilitado }) {
  const { toast } = useVentas();
  const { data: est, loading, error, reload } = useResource('arca-estado', () => ventasApi.arcaEstado());
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [facturando, setFacturando] = useState(0);

  const probar = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      setPrueba(await ventasApi.arcaProbar());
    } catch (e) {
      toast(`No se pudo probar: ${errorMsg(e)}`, 'err');
    } finally {
      setProbando(false);
    }
  };

  /* El mismo reintento que la pestaña Sin facturar, y es inocuo por lo mismo:
   * no toca plata, stock ni turno. Si ARCA sigue caído, dice por qué y la
   * venta queda donde estaba. */
  const facturar = async (v) => {
    setFacturando(v.id);
    try {
      await ventasApi.facturarVenta(v.id);
      toast(`Facturada: ${v.puntoVenta}-${String(v.numero ?? 0).padStart(8, '0')}.`, 'ok');
      reload();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      setFacturando(0);
    }
  };

  /*
   * EL CARTEL DE CARGANDO SOLO EN LA PRIMERA VEZ (`!est`), y no es cosmética:
   * cada recarga desmontaba este panel entero, y con él el pedido de
   * certificado recién generado. O sea que apretar "Generar clave y pedido"
   * creaba la clave y BORRABA de la pantalla el `.csr` que había que copiar.
   * Mientras haya datos previos se sigue mostrando lo que hay.
   */
  if (loading && !est) return <div className={s.hint}>Leyendo la configuración de ARCA…</div>;
  if (error && !est) return <div className={cx(s.callout, s.warn)}>No se pudo leer el estado de ARCA: <strong>{error}</strong></div>;
  if (!est) return null;

  const trab = est.trabadas ?? { cantidad: 0, filas: [] };

  return (
    <div style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>
      {/* --------------------------- El entorno --------------------------- */}
      {est.produccion ? (
        <div
          className={cx(s.callout, s.warn)}
          style={{ borderLeft: '4px solid var(--crm-color-danger)' }}
        >
          <strong style={{ color: 'var(--crm-color-danger)', letterSpacing: 1 }}>PRODUCCIÓN</strong>
          {' — '}lo que se emita acá son <strong>facturas de verdad</strong>, con validez fiscal y
          numeración que no se recicla. No hay forma de deshacerlas: se corrigen con una nota de
          crédito.
        </div>
      ) : (
        <div className={cx(s.callout, s.info)}>
          <strong>Homologación</strong> — el ambiente de prueba de ARCA. Lo que se emita acá{' '}
          <strong>no tiene ningún valor fiscal</strong>: sirve para ensayar el circuito completo
          sin consecuencias.
        </div>
      )}

      <div className={s['detalle-grid']}>
        <Di label="CUIT del certificado">
          <span className={s.mono}>{cuitLindo(est.cuit)}</span>
        </Di>
        <Di label="Punto de venta de la casa">
          <span className={s.mono}>{est.puntoVenta || '—'}</span>
        </Di>
        <Di label="Estado">
          {est.disponible
            ? <strong style={{ color: 'var(--crm-color-success)' }}>✔ Configurado</strong>
            : <strong style={{ color: 'var(--crm-color-danger)' }}>✕ Falta configurar</strong>}
        </Di>
        <Di label="Espera máxima">{Math.round((est.timeoutMs ?? 0) / 1000)} s</Di>
      </div>

      {/* ---------------- Un punto de venta por sucursal ---------------- */}
      <div>
        <div className={s['card-title']}>Punto de venta de cada local</div>
        <div className={s.hint} style={{ marginBottom: 6 }}>
          ARCA declara cada punto de venta contra un <strong>domicilio</strong> y cada uno lleva
          su numeración correlativa aparte. Se cargan en{' '}
          <strong>Gerencia › Sucursales</strong>, y el último número lo trae Probar conexión.
        </div>
        <Table
          cols={[
            { h: 'Sucursal' }, { h: 'Punto de venta' }, { h: 'Domicilio del comprobante' },
            { h: 'Último autorizado', num: true },
          ]}
          empty="No hay sucursales cargadas."
        >
          {(est.sucursales ?? []).map((su) => {
            const probado = (prueba?.numeracion ?? []).find((n) => n.sucursalId === su.id);
            return (
              <tr key={su.id}>
                <td>
                  {su.nombre}
                  {su.tipo === 'distribuidora' ? <div className={s.hint}>distribuidora</div> : null}
                </td>
                <td className={s.mono}>
                  {su.puntoVenta || (
                    <span style={{ color: 'var(--crm-color-danger)' }}>
                      sin cargar{est.puntoVenta ? ` · usa ${est.puntoVenta}` : ''}
                    </span>
                  )}
                </td>
                <td className={su.direccion ? undefined : s.muted}>
                  {su.direccion || 'el de la empresa'}
                </td>
                <td className={s.num}>
                  {probado
                    ? probado.tipos.map((t) => (
                      <div key={t.tipo} className={s.hint}>
                        {TIPOS_VENTA[t.tipo]?.label ?? t.tipo}:{' '}
                        {t.error
                          ? <span style={{ color: 'var(--crm-color-danger)' }}>✕</span>
                          : <span className={s.mono}>{t.ultimo}</span>}
                      </div>
                    ))
                    : <span className={s.muted}>—</span>}
                </td>
              </tr>
            );
          })}
        </Table>
        {/* Con UN local, no cargar el punto de venta es lo normal: cae al de la
            variable de entorno y no hay nada que elegir. Con varios, significa
            que sus facturas saldrían por la boca de expendio de otro. */}
        {est.sinPuntoVenta > 0 && (est.sucursales?.length ?? 0) > 1 && (
          <div className={cx(s.callout, s.warn)} style={{ marginTop: 8 }}>
            {est.sinPuntoVenta === 1 ? 'Hay 1 local sin' : `Hay ${est.sinPuntoVenta} locales sin`}{' '}
            punto de venta propio: sus facturas saldrían por el{' '}
            <strong className={s.mono}>{est.puntoVenta || '(ninguno)'}</strong>, que es la boca de
            expendio de otro domicilio. Cargáselos en <strong>Gerencia › Sucursales</strong>.
          </div>
        )}
      </div>

      {/* Lo que falta, dicho con nombre y apellido. Un "no disponible" pelado
          manda a adivinar entre cinco causas. */}
      {!est.disponible && (
        <div className={cx(s.callout, s.warn)}>
          <strong>No se puede facturar:</strong> {est.motivo}
          <div className={s.hint} style={{ marginTop: 6 }}>
            Estas cinco variables van en el <span className={s.mono}>.env</span> del servidor
            (los certificados en un volumen montado, nunca adentro de la imagen). Después de subir
            o <strong>renombrar</strong> un certificado, volvé a abrir esta pantalla: relee el
            disco sin reiniciar la API.
          </div>
        </div>
      )}

      {/* Prendido sin poder: es exactamente el modo de ENSAYO del circuito de
          caída, y conviene que se sepa que es a propósito. */}
      {habilitado && !est.disponible && (
        <div className={cx(s.callout, s.info)}>
          El interruptor está <strong>prendido</strong> pero falta la configuración, así que cada
          venta que pida factura va a salir como <strong>ticket provisorio</strong> y a quedar en
          Ventas › ⚠ Sin facturar. Sirve para ensayar el circuito de caída; para operar normal,
          apagalo hasta tener el certificado.
        </div>
      )}
      {!habilitado && est.disponible && (
        <div className={cx(s.callout, s.info)}>
          Está todo configurado pero el interruptor está <strong>apagado</strong>: no se pide CAE
          y todo sale como ticket interno.
        </div>
      )}

      {(est.avisos ?? []).map((a) => (
        <div key={a} className={cx(s.callout, s.warn)}>{a}</div>
      ))}

      {/* --------------------- El trámite del certificado ---------------------
          Va después del estado y antes de la prueba, que es el orden real: sin
          certificado no hay nada que probar. Solo aparece si las rutas están
          configuradas — sin ellas no hay dónde escribir. */}
      {est.certPath && est.keyPath ? (
        <div className={cx(s.card, s.cardPad)}>
          <CertificadoArca est={est} onCambio={reload} />
        </div>
      ) : (
        <div className={cx(s.callout, s.info)}>
          Para tramitar el certificado desde acá faltan{' '}
          <span className={s.mono}>ARCA_CERT_PATH</span> y{' '}
          <span className={s.mono}>ARCA_KEY_PATH</span>: son las rutas del volumen montado donde
          se guardan, y se configuran en el servidor.
        </div>
      )}

      {/* ------------------------ Probar conexión ------------------------ */}
      <div>
        {/* Se puede apretar SIN certificado, y ahí es cuando más sirve: la
            primera pregunta ("¿ARCA está vivo?") no lleva credenciales, así
            que contesta si el problema es de ellos o nuestro. */}
        <Btn onClick={probar} disabled={probando}>
          {probando ? 'Probando…' : 'Probar conexión'}
        </Btn>
        <span className={s.hint} style={{ marginLeft: 10 }}>
          Las preguntas van en orden y se cortan en la primera que falla. Puede tardar unos
          segundos: pedir un ticket de acceso nuevo cuesta cerca de diez.
        </span>
      </div>

      {prueba && (
        <div className={cx(s.card, s.cardPad)}>
          <div
            className={cx(s.callout, prueba.pasos?.every((p) => p.ok) ? s.info : s.warn)}
            style={{ marginBottom: 'var(--crm-space-2)' }}
          >
            {prueba.veredicto}
          </div>

          {prueba.pasos?.length > 0 && (
            <Table cols={[{ h: '' }, { h: 'Paso' }, { h: 'Qué contestó' }, { h: 'Tardó', num: true }]}>
              {prueba.pasos.map((p) => (
                <tr key={p.clave}>
                  <td style={{ width: 28, color: p.ok ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>
                    <strong>{p.ok ? '✔' : '✕'}</strong>
                  </td>
                  <td>{p.titulo}</td>
                  <td className={s.hint}>{p.detalle}</td>
                  <td className={s.num}>{p.ms} ms</td>
                </tr>
              ))}
            </Table>
          )}

          {/* Los pasos se CORTAN en el primero que falla: seguir preguntando
              después de un certificado rechazado da tres errores que dicen lo
              mismo y esconden cuál era la causa. */}
          {prueba.pasos?.some((p) => !p.ok) && (
            <div className={s.hint} style={{ marginTop: 6 }}>
              Los pasos que faltan no se probaron: el primero que falla es la causa, y lo demás
              sería consecuencia.
            </div>
          )}

          {/* Los últimos números autorizados van en la tabla de sucursales de
              arriba, al lado del punto de venta al que pertenecen: son de un
              punto de venta y de ninguno más. Acá solo lo que no entra ahí —
              el local que cae al de la variable de entorno. */}
          {(prueba.numeracion ?? []).filter((n) => !n.propio).map((n) => (
            <div key={n.puntoVenta} className={s.hint} style={{ marginTop: 6 }}>
              <strong className={s.mono}>{n.puntoVenta}</strong> (usado por {n.sucursal}):{' '}
              {n.tipos.map((t) => `${TIPOS_VENTA[t.tipo]?.label ?? t.tipo} ${t.error ? '✕' : t.ultimo}`).join(' · ')}
            </div>
          ))}
        </div>
      )}

      {/* -------------------------- Las trabadas -------------------------- */}
      {trab.cantidad > 0 && (
        <div className={cx(s.card, s.cardPad)}>
          <div className={s['card-title']}>
            ⚠ {trab.cantidad} {trab.cantidad === 1 ? 'venta sin facturar' : 'ventas sin facturar'}
            {' · '}{money(trab.plata)}
          </div>
          <div className={s.hint} style={{ marginBottom: 'var(--crm-space-2)' }}>
            Salieron como ticket provisorio porque ARCA no contestó. Reintentar es inocuo: no toca
            plata, stock ni turno — si sigue caído, la venta queda como está.
            {trab.desde ? ` La más vieja es del ${fmtFechaHora(trab.desde)}.` : ''}
          </div>
          <Table
            cols={[
              { h: 'Comprobante' }, { h: 'Fecha' }, { h: 'Cliente' },
              { h: 'Total', num: true }, { h: 'Por qué quedó pendiente' }, { h: '' },
            ]}
          >
            {trab.filas.map((v) => (
              <tr key={v.id}>
                <td className={s.mono}>
                  {v.puntoVenta}-{String(v.numero ?? 0).padStart(8, '0')}
                  <div className={s.hint}>{v.sucursalNombre ?? '—'}</div>
                </td>
                <td>{fmtFechaHora(v.fecha)}</td>
                <td>{v.clienteNombre}</td>
                <td className={s.num}>{money(v.total)}</td>
                <td className={s.hint}>{v.motivo || '—'}</td>
                <td>
                  <Btn small variant="btn-ingreso" disabled={facturando === v.id} onClick={() => facturar(v)}>
                    {facturando === v.id ? 'Facturando…' : 'Facturar'}
                  </Btn>
                </td>
              </tr>
            ))}
          </Table>
          {trab.ocultas > 0 && (
            <div className={s.hint} style={{ marginTop: 6 }}>
              Hay {trab.ocultas} más que no entran acá. Están todas en{' '}
              <strong>Ventas › Ventas › ⚠ Sin facturar</strong>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
