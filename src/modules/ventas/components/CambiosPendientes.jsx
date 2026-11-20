import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { Btn, money, s } from './ui.jsx';

/**
 * LOS CAMBIOS DEL LOCAL, arriba del ticket (0236, 19/11/2026).
 *
 * Una nota de crédito emitida con «se lleva otra mercadería» deja su importe a
 * favor del cliente para ESE momento. Acá la cajera la pone en el ticket que
 * está armando («Usar en este ticket»: se descuenta al cobrar) o, si al final
 * no se lleva nada, devuelve la plata. Mientras quede alguna sin resolver, la
 * caja del local no cierra.
 *
 * `cambios`: [{ id, etiqueta, saldo, efectivoDisponible, mismoMedio }]; `elegidoId`: el que
 * paga el ticket abierto; `puedeElegir`: hay un ticket abierto.
 */
export function CambiosPendientes({ cambios, elegidoId, puedeElegir, onElegir, onDevolver }) {
  const [devolviendo, setDevolviendo] = useState(null);
  const [enVuelo, setEnVuelo] = useState(false);
  if (!cambios?.length) return null;

  const devolver = async (c, como) => {
    if (enVuelo) return;
    setEnVuelo(true);
    try {
      if (await onDevolver(c, como)) setDevolviendo(null);
    } finally {
      setEnVuelo(false);
    }
  };

  return (
    <div className={cx(s.callout, s.info)} style={{ margin: 0, display: 'grid', gap: 8 }}>
      {cambios.map((c) => {
        const elegido = c.id === elegidoId;
        const efectivoAlcanza = c.efectivoDisponible + 0.009 >= c.saldo;
        return (
          <div key={c.id} style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 280px' }}>
                <strong>Cambio:</strong> la {c.etiqueta} deja <strong>{money(c.saldo)}</strong> a favor del cliente.{' '}
                {elegido ? 'Se descuenta al cobrar este ticket.' : 'Usala en el ticket de lo que se lleva, o devolvé la plata.'}
              </span>
              {devolviendo !== c.id && (
                <>
                  {elegido
                    ? <Btn small onClick={() => onElegir(null)}>No usarla en este ticket</Btn>
                    : (
                      <Btn
                        variant="btn-primary" small disabled={!puedeElegir}
                        title={puedeElegir ? undefined : 'Abrí un ticket para usarla'}
                        onClick={() => onElegir(c.id)}
                      >
                        Usar en este ticket
                      </Btn>
                    )}
                  <Btn small onClick={() => setDevolviendo(c.id)}>No se lleva nada: devolver la plata</Btn>
                </>
              )}
            </div>
            {devolviendo === c.id && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>¿Cómo le devolvés los {money(c.saldo)}?</span>
                <Btn
                  small disabled={enVuelo || !efectivoAlcanza}
                  title={efectivoAlcanza ? undefined : `La venta original cobró en efectivo ${money(c.efectivoDisponible)}: del cajón no sale más que eso.`}
                  onClick={() => devolver(c, 'efectivo')}
                >
                  En efectivo, del cajón
                </Btn>
                {c.mismoMedio && <Btn small disabled={enVuelo} onClick={() => devolver(c, 'medio')}>Por el mismo medio con que pagó</Btn>}
                <Btn small variant="btn-ghost" disabled={enVuelo} onClick={() => setDevolviendo(null)}>Cancelar</Btn>
                {!efectivoAlcanza && (
                  <span className={s.hint} style={{ margin: 0 }}>
                    En efectivo no: la venta original no se cobró en efectivo (o no alcanza).
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
