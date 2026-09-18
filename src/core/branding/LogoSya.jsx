import { cx } from '@shared/utils/classNames.js';
import logo from './logos/sya-logo.svg';
import styles from './Coftech.module.css';

/**
 * EL LOGO DE SABOR Y AROMA.
 * ============================================================================
 * UN SOLO ARCHIVO para los dos lugares donde aparece. El dibujo es una silueta
 * de un color: tener un SVG blanco y otro verde serían 23 KB de trazos
 * idénticos repetidos, y dos archivos que hay que acordarse de cambiar juntos
 * el día que el logo cambie. Va uno, en el verde de marca, y donde hace falta
 * blanco lo pinta el CSS con un filtro.
 *
 * Va como `<img>` y no inline en el JSX a propósito: así es un archivo aparte
 * que el navegador cachea con su hash y que NO se re-parsea en cada arranque
 * —son 10 KB comprimidos de puros trazos—, mientras que inline viajaría dentro
 * del bundle de JavaScript todas las veces.
 *
 * El `alt` va vacío y con `aria-hidden` donde el nombre del sistema ya está
 * escrito al lado: repetirlo haría que un lector de pantalla diga la marca dos
 * veces seguidas.
 */
export function LogoSya({ variante = 'verde', alto, className, decorativo = false }) {
  return (
    <img
      src={logo}
      alt={decorativo ? '' : 'Sabor y Aroma'}
      aria-hidden={decorativo || undefined}
      draggable="false"
      className={cx(
        styles.logo,
        variante === 'blanco' ? styles.logoBlanco : styles.logoEntrada,
        className,
      )}
      style={alto ? { height: alto } : undefined}
    />
  );
}
