import { useMemo, useRef, useState } from 'react';

/** Sin tildes ni mayúsculas: «Panificadora Zárate» se encuentra escribiendo «zara». */
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * BUSCADOR DONDE SE ESCRIBE (11/11/2026, pedido del dueño) — reemplazo de un
 * <select> largo, pensado para elegir proveedor sin bajar por toda la lista.
 *
 * Se escribe parte del nombre (en cualquier lugar del nombre, sin importar
 * tildes), aparecen los que coinciden y se elige con clic o con ↑ ↓ + Enter.
 * La × vuelve a «todos». Al salir sin elegir, queda lo que estaba elegido.
 *
 * `value` y `onChange` funcionan igual que en el <select> que reemplaza: el id
 * como texto, y '' para «todos». `extras` son opciones especiales que van
 * arriba de todo, después de «todos» (p. ej. «Solo proveedores locales»).
 */
export function BuscadorOpcion({
  opciones, value, onChange, todos = 'Todos', placeholder = 'Escribí para buscar…',
  extras = [], className, style, id, ariaLabel,
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  const elegida = [...extras, ...opciones].find((o) => String(o.id) === String(value ?? ''));
  const q = norm(texto);
  const lista = useMemo(() => {
    const t = q ? opciones.filter((o) => norm(o.nombre).includes(q)) : opciones;
    // Los que EMPIEZAN con lo escrito van primero.
    return q ? [...t].sort((a, b) => (norm(b.nombre).startsWith(q) - norm(a.nombre).startsWith(q))) : t;
  }, [opciones, q]);
  // Sin texto, la primera opción es «todos» y después las especiales.
  const items = q
    ? [...extras.filter((o) => norm(o.nombre).includes(q)), ...lista]
    : [{ id: '', nombre: todos }, ...extras, ...lista];

  const elegir = (o) => {
    onChange(String(o.id));
    setTexto('');
    setAbierto(false);
    inputRef.current?.blur();
  };

  // Con actualización funcional: dos flechas seguidas avanzan dos, aunque no haya redibujado en el medio.
  const mover = (paso) => {
    setActivo((a) => {
      const n = Math.max(0, Math.min(items.length - 1, a + paso));
      requestAnimationFrame(() => listaRef.current?.children[n]?.scrollIntoView({ block: 'nearest' }));
      return n;
    });
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!abierto) setAbierto(true); mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Enter') { if (abierto && items[activo]) { e.preventDefault(); elegir(items[activo]); } }
    else if (e.key === 'Escape') { setTexto(''); setAbierto(false); inputRef.current?.blur(); }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', minWidth: 260, ...style }}>
      <input
        ref={inputRef} id={id} type="text" autoComplete="off" role="combobox"
        aria-label={ariaLabel} aria-expanded={abierto} aria-autocomplete="list"
        className={className}
        style={{ width: '100%', paddingRight: value ? 30 : undefined }}
        value={abierto ? texto : (elegida ? elegida.nombre : '')}
        placeholder={abierto ? placeholder : todos}
        onFocus={() => { setTexto(''); setAbierto(true); setActivo(0); }}
        onBlur={() => { setAbierto(false); setTexto(''); }}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(0); }}
        onKeyDown={onKeyDown}
      />
      {value && !abierto && (
        <button
          type="button" aria-label="Ver todos" title="Ver todos"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1,
            color: 'var(--crm-color-text-muted, #777)', padding: '2px 6px',
          }}
        >×</button>
      )}
      {abierto && (
        <ul
          ref={listaRef} role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
            margin: 0, padding: 4, listStyle: 'none', maxHeight: 320, overflowY: 'auto',
            background: 'var(--crm-color-surface, #fff)', border: '1px solid var(--crm-color-border, #ddd)',
            borderRadius: 'var(--crm-radius-sm, 6px)', boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          }}
        >
          {items.length === 0 && (
            <li style={{ padding: '8px 10px', color: 'var(--crm-color-text-muted, #777)' }}>Ninguno coincide con «{texto}»</li>
          )}
          {items.map((o, i) => (
            <li
              key={o.id === '' ? '__todos__' : o.id} role="option" aria-selected={String(o.id) === String(value ?? '')}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(o)}
              style={{
                padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                background: i === activo ? 'color-mix(in srgb, var(--crm-color-primary, #1b6b3a) 12%, transparent)' : 'transparent',
                fontWeight: String(o.id) === String(value ?? '') ? 600 : 400,
                fontStyle: o.id === '' ? 'italic' : 'normal',
              }}
            >{o.nombre}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
