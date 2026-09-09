// ==========================================================================
// GACIP · Sesión de usuario (localStorage) + utilidades comunes
// ==========================================================================
const SESSION_KEY = 'gacip_session';

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function logout() {
  clearSession();
  window.location.href = 'index.html';
}

// Redirige a login si no hay sesión, o si el rol no está permitido en esta página.
function requireRole(allowedRoles) {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    window.location.href = 'perfil.html';
    return null;
  }
  return session;
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function roleBadgeClass(role) {
  return { sudo: 'badge-sudo', admin: 'badge-admin', usuario: 'badge-usuario' }[role] || 'badge-usuario';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Renderiza el topbar de navegación de acuerdo al rol de la sesión activa.
function renderNav(activePage) {
  const session = getSession();
  const el = document.getElementById('app-nav');
  if (!el || !session) return;

  const links = [];
  if (session.role === 'admin' || session.role === 'sudo') {
    links.push({ href: 'dashboard.html', label: 'Escanear QR' });
    links.push({ href: 'voluntarios.html', label: 'Voluntarios' });
  }
  links.push({ href: 'perfil.html', label: 'Mi Perfil' });
  if (session.role === 'sudo') {
    links.push({ href: 'sudo.html', label: 'Panel Sudo' });
  }

  el.innerHTML = `
    <div class="container">
      <div class="brand"><span class="dot"></span> GACIP</div>
      <nav class="nav-links">
        ${links.map(l => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}">${l.label}</a>`).join('')}
      </nav>
      <div class="nav-user">
        <span>${session.full_name}</span>
        <span class="role-badge">${session.role}</span>
        <button class="btn-logout" onclick="logout()">Salir</button>
      </div>
    </div>
  `;
}
