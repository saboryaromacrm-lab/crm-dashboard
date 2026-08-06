/**
 * Shell de modal del módulo: MUI Dialog (accesible, focus-trap, dark-mode) con
 * el cuerpo estilizado por el CSS del módulo (`.form`) para conservar la UX
 * original de los formularios. `footer` es un array de botones declarativos.
 *
 * `size` controla el ancho:
 *   'sm' (defecto)  formularios cortos
 *   'md'            formularios con dos columnas   (= `wide`, que se mantiene)
 *   'lg'            tablas de pocas columnas
 *   'xl'            CONSULTAS: tablas anchas que además ocupan el alto de la
 *                   pantalla, para que la grilla se vea entera sin scrollear
 *                   el modal completo.
 */
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Btn, s } from './ui.jsx';

export function ModalShell({ title, subtitle, size, wide, muted, onClose, children, footer = [] }) {
  const maxWidth = size ?? (wide ? 'md' : 'sm');
  const esConsulta = maxWidth === 'xl';
  const paperSx = {
    // Las consultas se fijan al alto de la ventana: el cuerpo scrollea por
    // dentro y la cabecera con los filtros queda siempre a la vista.
    ...(esConsulta && { height: 'min(88vh, 900px)' }),
    // `muted`: fondo gris del app en vez de blanco, para modales que flotan
    // sobre pantallas claras (la caja) y necesitan despegarse visualmente.
    ...(muted && { bgcolor: 'var(--crm-color-bg)' }),
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={Object.keys(paperSx).length ? { sx: paperSx } : undefined}
    >
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1, gap: 2 }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
          {subtitle && (
            <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--crm-color-text-muted)' }}>
              {subtitle}
            </span>
          )}
        </span>
        <IconButton aria-label="Cerrar" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={esConsulta ? { display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' } : undefined}
      >
        {esConsulta ? children : <div className={s.form}>{children}</div>}
      </DialogContent>

      {footer.length > 0 && (
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          {footer.map((b, i) => (
            <Btn key={i} variant={b.clase || 'btn-ghost'} onClick={b.onClick}>
              {b.texto}
            </Btn>
          ))}
        </DialogActions>
      )}
    </Dialog>
  );
}
