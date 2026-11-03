import { useLayoutEffect, useRef, useState } from 'react';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useBreakpoint } from '@core/hooks/useBreakpoint.js';
import styles from '../MainLayout.module.css';

const CLAVE = 'erp.avisosAbiertos';

/**
 * LOS AVISOS DE ARRIBA, PLEGADOS EN EL TELÉFONO (3/11/2026).
 * ============================================================================
 * Cajas sin cerrar, cuentas vencidas, feriados, pedidos de acceso: en la PC
 * van uno abajo del otro. En el teléfono, con dos o tres a la vez, llenaban la
 * primera pantalla entera antes de llegar a lo que se vino a hacer. Ahí van
 * plegados en un renglón —«3 avisos», en el color del más urgente— que se
 * abre con un toque; abierto o cerrado se recuerda mientras dure la pestaña.
 *
 * Cada aviso sigue decidiendo solo si aparece (devuelve `null` si no): acá se
 * cuentan los que quedaron dibujados.
 */
export function AvisosArriba({ children }) {
  const { isMobile } = useBreakpoint();
  const ref = useRef(null);
  const [cuantos, setCuantos] = useState(0);
  const [abierto, setAbierto] = useState(() => {
    try { return sessionStorage.getItem(CLAVE) === '1'; } catch { return false; }
  });

  useLayoutEffect(() => {
    const caja = ref.current;
    if (!caja) return undefined;
    const contar = () => setCuantos(caja.childElementCount);
    contar();
    const obs = new MutationObserver(contar);
    obs.observe(caja, { childList: true });
    return () => obs.disconnect();
  }, []);

  const alternar = () => {
    setAbierto((v) => {
      try { sessionStorage.setItem(CLAVE, v ? '0' : '1'); } catch { /* sin storage */ }
      return !v;
    });
  };

  const plegado = isMobile && cuantos > 0 && !abierto;
  return (
    <>
      {isMobile && cuantos > 0 && (
        <button type="button" className={styles.avisosBarra} onClick={alternar} aria-expanded={abierto} aria-controls="avisos-arriba">
          <WarningAmberRoundedIcon fontSize="small" />
          <span>{cuantos === 1 ? '1 aviso' : `${cuantos} avisos`}</span>
          <span className={styles.avisosVer}>{abierto ? 'Ocultar' : 'Ver'}</span>
          <ExpandMoreRoundedIcon fontSize="small" className={abierto ? styles.avisosFlechaArriba : undefined} />
        </button>
      )}
      <div id="avisos-arriba" ref={ref} className={plegado ? styles.avisosPlegados : styles.avisos}>
        {children}
      </div>
    </>
  );
}
