import styles from './Sidebar.module.css';

/**
 * FIRMA DE COFTECH — el pie del sidebar.
 * ============================================================================
 * Quién hizo el sistema, al pie de la navegación, con el contacto a un clic.
 *
 * NO se integra como decía el instructivo original (un `<script type="text/babel">`
 * traído de saboryaroma.com y compilado en el navegador). Ese camino sirve para
 * una página suelta, pero acá habría costado, EN CADA CARGA:
 *
 *   · Babel standalone, que son ~1,5 MB de JavaScript cuyo único trabajo sería
 *     compilar estas veinte líneas mientras el usuario mira una pantalla vacía.
 *   · Una petición a otro dominio en el camino crítico — y si ese dominio se
 *     cae o tarda, se lo come el CRM entero.
 *   · La fuente Nunito Sans, una familia completa para escribir una palabra.
 *
 * Nada de eso se nota en una landing; en la caja, donde se abre y se recarga
 * cien veces por día, se nota. Acá va compilado con el resto del bundle: pesa
 * lo que pesan estas líneas y no agrega ni una petición.
 *
 * EL HOVER ES CSS, no estado de React. El original guardaba `isHovered` en un
 * `useState`, o sea un re-render por cada entrada y salida del mouse sobre un
 * elemento que está SIEMPRE en pantalla. El efecto es idéntico y no cuesta nada.
 */

/** Una vez por carga, no una por render: es un pie, no un reloj. */
const ANIO = new Date().getFullYear();

const WHATSAPP = 'https://wa.me/5493704819019?text=Hola,%20me%20contacto%20desde%20su%20aplicaci%C3%B3n.';

export function FirmaCoftech() {
  return (
    <a
      className={styles.firma}
      href={WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      title="Coftech · Soluciones digitales — escribinos por WhatsApp"
    >
      <span className={styles.firmaMarca}>
        <span className={styles.firmaCof}>Cof</span><span className={styles.firmaTech}>tech</span>
      </span>
      <span className={styles.firmaPie}>Soluciones digitales · © {ANIO}</span>
    </a>
  );
}
