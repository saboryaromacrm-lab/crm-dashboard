import { InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

/**
 * Placeholder global search. Wired for looks today; a future module can hook a
 * command-palette / omnisearch service here without changing the layout.
 */
export function GlobalSearch() {
  return (
    <TextField
      size="small"
      placeholder="Buscar…"
      fullWidth
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
      }}
      sx={{
        maxWidth: 420,
        '& .MuiOutlinedInput-root': { borderRadius: 'var(--crm-radius-pill)' },
      }}
    />
  );
}
