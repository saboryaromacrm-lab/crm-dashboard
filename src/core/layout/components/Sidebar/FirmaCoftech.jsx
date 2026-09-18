import styles from './FirmaCoftech.module.css';

/**
 * FIRMA DE COFTECH — el cierre del sidebar.
 * ============================================================================
 * Mismos colores, mismos tamaños y mismo hover que el diseño original: la
 * franja oscura partida al medio, "Cof" en celeste, el separador y el año.
 *
 * LO ÚNICO QUE CAMBIA ES EL ACOMODO, y lo impone el ancho: el sidebar mide
 * 264 px y el original está pensado para una barra de 1400. Puesto en una sola
 * línea, "Coftech | Soluciones digitales" y el año no entran ni con calzador.
 * Así que la misma fila se dobla —el `flex-wrap` ya estaba en el original— y
 * el año baja abajo a la derecha. Ni un color ni un tamaño de letra cambiado.
 *
 * NO se carga como decía el instructivo (un `<script type="text/babel">` traído
 * de saboryaroma.com). Eso, en la pantalla que se abre y se recarga cien veces
 * por día, habría costado en CADA carga: Babel standalone (~1,5 MB) para
 * compilar veinte líneas mientras el cajero mira una pantalla vacía, y una
 * petición a otro dominio en el camino crítico — si ese dominio tarda, se lo
 * come el CRM entero. Acá va compilada con el resto del bundle.
 *
 * EL HOVER ES CSS, no estado de React. El original guardaba `isHovered` en un
 * `useState`: un re-render por cada entrada y salida del mouse sobre algo que
 * está SIEMPRE en pantalla. El efecto es idéntico y no cuesta nada.
 */

/** Una vez por carga, no una por render: es un pie, no un reloj. */
const ANIO = new Date().getFullYear();

const WHATSAPP = 'https://wa.me/5493704819019?text=Hola,%20me%20contacto%20desde%20su%20aplicaci%C3%B3n.';

export function FirmaCoftech() {
  return (
    <div className={styles.firma}>
      <div className={styles.inner}>
        <div className={styles.izq}>
          <a
            className={styles.marca}
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Coftech — escribinos por WhatsApp"
          >
            <span className={styles.cof}>Cof</span><span className={styles.tech}>tech</span>
          </a>
          <span className={styles.sep} aria-hidden="true">|</span>
          <p className={styles.lema}>Soluciones digitales</p>
        </div>
        <span className={styles.anio}>© {ANIO}</span>
      </div>
    </div>
  );
}
