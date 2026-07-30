/**
 * Shell de modal del módulo: MUI Dialog (accesible, focus-trap, dark-mode) con
 * el cuerpo estilizado por el CSS del módulo (`.form`) para conservar la UX
 * original de los formularios. `footer` es un array de botones declarativos.
 */
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Btn, s } from './ui.jsx';

export function ModalShell({ title, wide, onClose, children, footer = [] }) {
  return (
    <Dialog open onClose={onClose} maxWidth={wide ? 'md' : 'sm'} fullWidth>
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}
      >
        <span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
        <IconButton aria-label="Cerrar" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <div className={s.form}>{children}</div>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {footer.map((b, i) => (
          <Btn key={i} variant={b.clase || 'btn-ghost'} onClick={b.onClick}>
            {b.texto}
          </Btn>
        ))}
      </DialogActions>
    </Dialog>
  );
}
