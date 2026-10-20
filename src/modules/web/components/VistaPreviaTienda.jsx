/**
 * EL LINK DE VISTA PREVIA (20/10/2026): con él se ven (y se compra de prueba
 * en) las tiendas en preparación. Se pide al abrir el bloque (la primera vez la
 * API crea la clave) y se puede cambiar: el link anterior deja de abrir la
 * tienda. Cambiarlo pide un segundo clic; candado con useRef.
 */
import { useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { env } from '@core/config/env.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';

const linkDe = (clave) => `${env.tiendaUrl}/vista-previa?clave=${encodeURIComponent(clave)}`;

export function VistaPreviaTienda({ avisar }) {
  const [clave, setClave] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);

  useEffect(() => {
    httpClient.get('/web/vista-previa')
      .then((r) => setClave(r.clave))
      .catch((e) => avisar('err', e?.data?.message || 'No se pudo leer el link de vista previa.'));
  }, [avisar]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(linkDe(clave));
      avisar('ok', 'Link copiado: abrilo en el celular o pasáselo a quien quieras que pruebe.');
    } catch {
      avisar('err', 'No se pudo copiar: seleccioná el link y copialo a mano.');
    }
  };

  const nuevo = async () => {
    if (!cambiando) { setCambiando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    try {
      setClave((await httpClient.post('/web/vista-previa/nueva')).clave);
      setCambiando(false);
      avisar('ok', 'Link nuevo: el anterior ya no abre la tienda.');
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo cambiar el link.');
    } finally {
      enVuelo.current = false;
      setEnviando(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className={s.field} style={{ margin: 0 }}>
        <label htmlFor="cfg-vista-previa">Link de vista previa</label>
        <input id="cfg-vista-previa" readOnly value={clave ? linkDe(clave) : 'Cargando…'} onFocus={(e) => e.target.select()} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Btn small variant="btn-primary" onClick={copiar} disabled={!clave}>Copiar link</Btn>
        <Btn small onClick={() => window.open(linkDe(clave), '_blank', 'noopener')} disabled={!clave}>Abrir la vista previa</Btn>
        <Btn small variant={cambiando ? 'btn-delete' : 'btn-ghost'} onClick={nuevo} disabled={!clave || enviando}>
          {cambiando ? 'Sí, cambiar el link' : 'Cambiar el link'}
        </Btn>
        {cambiando && <Btn small onClick={() => setCambiando(false)} disabled={enviando}>Cancelar</Btn>}
      </div>
      {cambiando && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          El link actual deja de abrir la tienda (también a quien se lo hayas pasado). Tocá «Sí, cambiar el link» para confirmar.
        </div>
      )}
    </div>
  );
}
