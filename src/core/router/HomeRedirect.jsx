import { Navigate } from 'react-router-dom';
import { useNavigation } from '@core/navigation/useNavigation.js';
import { useAuth } from '@core/auth/AuthContext.jsx';

/**
 * La ruta raíz no puede ser un redirect fijo a /dashboard: si el rol no tiene
 * esa sección, sería un rebote infinito con el guard. Acá se manda al PRIMER
 * módulo que el rol sí puede ver; si no puede ver ninguno, se dice claro en
 * vez de mostrar una pantalla rota.
 */
export function HomeRedirect() {
  const groups = useNavigation();
  const { user, logout } = useAuth();

  const primero = groups[0]?.items?.[0];
  if (primero) return <Navigate to={primero.path} replace />;

  return (
    <div style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ marginBottom: 12 }}>Sin secciones asignadas</h2>
      <p style={{ color: 'var(--crm-color-text-muted)', lineHeight: 1.6 }}>
        El rol de <strong>{user?.name ?? 'este usuario'}</strong> no tiene ninguna sección
        habilitada, así que no hay nada para mostrar. Pedile al superadmin que le asigne
        secciones desde <strong>Gerencia &rsaquo; Usuarios y roles</strong>.
      </p>
      <button
        type="button"
        onClick={() => { logout(); window.location.href = '/login'; }}
        style={{
          marginTop: 20, padding: '10px 22px', border: 'none', borderRadius: 8,
          background: 'var(--crm-color-primary)', color: '#fff', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Cambiar de usuario
      </button>
    </div>
  );
}
