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
import { useModalModo } from './modalModo.js';

/* Modo celular (ver modalModo.js): pantalla entera, campos de 16 px, botones
 * grandes abajo y margen para la muesca y la barra de gestos del teléfono. */
const SX_MOVIL = {
  paper: { borderRadius: 0, '& .MuiDialogContent-root input, & .MuiDialogContent-root select, & .MuiDialogContent-root textarea': { fontSize: 16 } },
  titulo: { pt: 'calc(12px + env(safe-area-inset-top, 0px))', pb: 1.5, pl: 2, position: 'sticky', top: 0 },
  contenido: { px: 2 },
  acciones: {
    px: 2, pt: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom, 0px))', gap: 1, flexWrap: 'wrap',
    '& > button': { flex: '1 1 130px', minHeight: 48, fontSize: 15, m: 0 },
  },
};

export function ModalShell({ title, subtitle, size, wide, muted, onClose, children, footer = [] }) {
  const { movil } = useModalModo();
  const maxWidth = size ?? (wide ? 'md' : 'sm');
  const esConsulta = maxWidth === 'xl';
  const paperSx = {
    // Las consultas se fijan al alto de la ventana: el cuerpo scrollea por
    // dentro y la cabecera con los filtros queda siempre a la vista.
    ...(esConsulta && { height: 'min(88vh, 900px)' }),
    // `muted`: fondo gris del app en vez de blanco, para modales que flotan
    // sobre pantallas claras (la caja) y necesitan despegarse visualmente.
    ...(muted && { bgcolor: 'var(--crm-color-bg)' }),
    ...(movil && SX_MOVIL.paper),
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={movil}
      PaperProps={Object.keys(paperSx).length ? { sx: paperSx } : undefined}
    >
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1, gap: 2, ...(movil && SX_MOVIL.titulo) }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
          {subtitle && (
            <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--crm-color-text-muted)' }}>
              {subtitle}
            </span>
          )}
        </span>
        <IconButton aria-label="Cerrar" onClick={onClose} size={movil ? 'medium' : 'small'}>
          <CloseIcon fontSize={movil ? 'medium' : 'small'} />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={esConsulta ? { display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' } : movil ? SX_MOVIL.contenido : undefined}
      >
        {esConsulta ? children : <div className={s.form}>{children}</div>}
      </DialogContent>

      {footer.length > 0 && (
        <DialogActions disableSpacing={movil} sx={movil ? SX_MOVIL.acciones : { px: 3, py: 2, gap: 1 }}>
          {/* `disabled` para que el botón que confirma se pueda apagar mientras
              la petición vuela: sin eso, un doble click en una conexión lenta
              manda la operación dos veces (dos gastos, dos egresos de caja). */}
          {footer.map((b, i) => (
            <Btn key={i} variant={b.clase || 'btn-ghost'} onClick={b.onClick} disabled={b.disabled}>
              {b.texto}
            </Btn>
          ))}
        </DialogActions>
      )}
    </Dialog>
  );
}
