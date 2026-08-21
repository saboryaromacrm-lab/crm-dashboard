/**
 * EL TRÁMITE DEL CERTIFICADO, DESDE LA PANTALLA
 * ============================================================================
 * El paso que no se hace en la web de ARCA: generar una clave privada y un
 * pedido (`.csr`), subir el pedido, y guardar el certificado que devuelven.
 * Se hacía con dos comandos de `openssl` a mano, y ahí se pierde media tarde
 * — el `serialNumber` tiene que ser LITERALMENTE `CUIT ` más once dígitos, y
 * en Windows `openssl` falla de dos maneras que no hablan de certificados.
 *
 * LA CLAVE PRIVADA NO PASA POR ACÁ. Se genera en el servidor y se escribe
 * donde apunta `ARCA_KEY_PATH`; de vuelta viene solo el `.csr`, que es
 * público. Es la única forma de que la clave no termine en la carpeta de
 * Descargas de una máquina del mostrador.
 *
 * Son tres pasos y la pantalla los muestra como tres, porque en el medio hay
 * un trámite en la web de ARCA que puede durar días.
 */
import { useEffect, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { Btn, fmtFecha, s } from './ui.jsx';

/** Sin espacios ni acentos: ARCA lo trata como nombre de sistema. */
const limpiarAlias = (v) => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9._-]/g, '')
  .toLowerCase();

export function CertificadoArca({ est, onCambio }) {
  const { toast } = useVentas();
  const [razonSocial, setRazonSocial] = useState('');
  const [alias, setAlias] = useState('');
  const [pedido, setPedido] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [crt, setCrt] = useState('');
  const [instalando, setInstalando] = useState(false);

  /* Se prellena con lo que el sistema ya sabe: la razón social del membrete y
   * un alias derivado de ella. Editable, porque ante ARCA la razón social
   * puede no ser la que figura en Sistema › Empresa. */
  useEffect(() => {
    setRazonSocial((v) => v || est?.empresaNombre || '');
    setAlias((v) => v || limpiarAlias(est?.empresaNombre || 'certificado'));
  }, [est?.empresaNombre]);

  const generar = async () => {
    setGenerando(true);
    try {
      const r = await ventasApi.arcaPedido({ razonSocial, alias });
      setPedido(r);
      toast(r.claveNueva
        ? 'Clave privada generada en el servidor y pedido listo.'
        : 'Pedido armado con la clave que ya estaba en el servidor.', 'ok');
      onCambio?.();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      setGenerando(false);
    }
  };

  const instalar = async () => {
    setInstalando(true);
    try {
      const r = await ventasApi.arcaInstalarCert(crt);
      toast(`Certificado instalado. Vence el ${fmtFecha(r.vence)}.`, 'ok');
      setCrt('');
      setPedido(null);
      onCambio?.();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      setInstalando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pedido.csr);
      toast('Pedido copiado: pegalo en ARCA.', 'ok');
    } catch {
      toast('No se pudo copiar solo. Seleccioná el texto y copialo a mano.', 'err');
    }
  };

  const bajar = () => {
    const url = URL.createObjectURL(new Blob([pedido.csr], { type: 'application/pkcs10' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${alias || 'pedido'}.csr`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cert = est?.certificado;
  const clave = est?.clave;

  return (
    <div style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>
      {/* --------- Lo que ya hay, si hay algo --------- */}
      {cert && !cert.ilegible && (
        <div className={cx(s.callout, cert.diasParaVencer < 30 ? s.warn : s.info)}>
          <strong>Certificado instalado</strong> — {cert.subject}. Vence el{' '}
          <strong>{fmtFecha(cert.vence)}</strong>
          {cert.diasParaVencer >= 0
            ? ` (faltan ${cert.diasParaVencer} días).`
            : ' — está VENCIDO, hay que renovarlo.'}
          {cert.diasParaVencer >= 0 && cert.diasParaVencer < 30
            ? ' Conviene renovarlo ya: es un trámite, no un botón.'
            : ''}
        </div>
      )}
      {cert?.ilegible && (
        <div className={cx(s.callout, s.warn)}>
          Hay un archivo en la ruta del certificado pero <strong>no se puede leer</strong> como
          certificado. Suele ser el archivo equivocado, o uno que quedó a medio copiar.
        </div>
      )}

      {/* LO QUE SE ESCRIBA ACÁ, ¿SOBREVIVE AL PRÓXIMO DEPLOY?
          Va arriba de todo y en rojo porque es lo único de esta pantalla que
          no se puede deshacer: enterarse después es enterarse con el trámite
          hecho, el certificado emitido y la clave borrada. */}
      {est?.certPersistente === false && (
        <div className={cx(s.callout, s.warn)}>
          <strong>Pará: la carpeta de los certificados no es un volumen montado.</strong> Existe,
          pero es el disco del contenedor y <strong>se borra entero en el próximo deploy</strong>,
          junto con la clave y el certificado. En Dokploy: <em>Advanced › Volumes › Add</em>, con{' '}
          <span className={s.mono}>Mount Path</span> apuntando a la carpeta de{' '}
          <span className={s.mono}>ARCA_KEY_PATH</span>, y después <strong>Redeploy</strong>.
          Hasta entonces el botón de generar no va a dejarte empezar.
        </div>
      )}

      {/* --------- Paso 1 --------- */}
      <div>
        <div className={s['card-title']}>1 · La clave y el pedido</div>
        <div className={s.hint} style={{ marginBottom: 8 }}>
          La <strong>clave privada</strong> se genera y se queda en el servidor — nunca pasa por
          esta pantalla ni por tu computadora. Lo que vas a copiar es el <strong>pedido</strong>,
          que es público y es lo que se sube a ARCA.
        </div>

        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Razón social <span className={s.req}>*</span></label>
            <input
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              maxLength={120}
              placeholder="Como figura en ARCA"
            />
            <div className={s.hint}>La que figura ante ARCA, no el nombre de fantasía.</div>
          </div>
          <div className={s.field}>
            <label>Alias del certificado <span className={s.req}>*</span></label>
            <input
              value={alias}
              onChange={(e) => setAlias(limpiarAlias(e.target.value))}
              maxLength={60}
              placeholder="saboryaroma"
            />
            <div className={s.hint}>Para distinguirlo dentro de tu CUIT. Sin espacios ni acentos.</div>
          </div>
        </div>

        {/* El CUIT no se edita: sale de la configuración del servidor y tiene
            que ser exactamente el del contribuyente que factura. */}
        <div className={s.hint}>
          El pedido va a llevar <span className={s.mono}>serialNumber=CUIT {est?.cuit || '—'}</span>,
          que es la línea que ARCA compara letra por letra.
        </div>

        {clave && (
          <div className={cx(s.callout, s.info)} style={{ marginTop: 8 }}>
            Ya hay una clave privada en el servidor (del {fmtFecha(clave.desde)}).{' '}
            <strong>No se reemplaza</strong>: el pedido se arma con esa misma. Pisarla dejaría
            muerto al certificado que le corresponde, sin vuelta atrás.
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <Btn variant="btn-primary" onClick={generar} disabled={generando || !razonSocial.trim() || !alias}>
            {generando ? 'Generando…' : clave ? 'Armar el pedido' : 'Generar clave y pedido'}
          </Btn>
        </div>
      </div>

      {/* --------- El pedido, cuando ya está --------- */}
      {pedido && (
        <div className={cx(s.card, s.cardPad)}>
          <div className={s['card-title']}>2 · Subí esto a ARCA</div>
          <div className={s.hint} style={{ marginBottom: 6 }}>
            {pedido.claveNueva
              ? <>Clave nueva guardada en <span className={s.mono}>{pedido.keyPath}</span>. </>
              : <>Armado con la clave que ya estaba. </>}
            En ARCA: <strong>WSASS</strong> para homologación, o{' '}
            <strong>Administración de Certificados Digitales</strong> para producción → pegá esto
            y descargá el <span className={s.mono}>.crt</span> que te devuelven.
          </div>
          <textarea
            readOnly
            value={pedido.csr}
            rows={8}
            onFocus={(e) => e.target.select()}
            style={{ width: '100%', fontFamily: 'var(--crm-font-mono, monospace)', fontSize: 11 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Btn variant="btn-primary" small onClick={copiar}>Copiar</Btn>
            <Btn small onClick={bajar}>Descargar .csr</Btn>
          </div>
          <div className={s.hint} style={{ marginTop: 6 }}>
            <strong>No te olvides de autorizarlo a los servicios</strong> — sin eso el certificado
            existe pero no puede hacer nada: <span className={s.mono}>wsfe</span> (facturación) y{' '}
            <span className={s.mono}>ws_sr_constancia_inscripcion</span> (consulta de CUIT).
          </div>
        </div>
      )}

      {/* --------- Paso 3 --------- */}
      <div>
        <div className={s['card-title']}>3 · Instalá el certificado que te dio ARCA</div>
        <div className={s.hint} style={{ marginBottom: 6 }}>
          Abrí el <span className={s.mono}>.crt</span> con el Bloc de notas y pegá todo, incluidas
          las líneas <span className={s.mono}>BEGIN</span> y <span className={s.mono}>END</span>.
          Antes de guardarlo se comprueba que sea de tu clave, de tu CUIT y que no esté vencido.
        </div>
        <textarea
          value={crt}
          onChange={(e) => setCrt(e.target.value)}
          rows={6}
          placeholder="-----BEGIN CERTIFICATE-----&#10;…&#10;-----END CERTIFICATE-----"
          style={{ width: '100%', fontFamily: 'var(--crm-font-mono, monospace)', fontSize: 11 }}
        />
        <div style={{ marginTop: 6 }}>
          <Btn variant="btn-primary" onClick={instalar} disabled={instalando || !crt.trim()}>
            {instalando ? 'Instalando…' : 'Instalar certificado'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
