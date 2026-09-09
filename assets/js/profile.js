// ==========================================================================
// GACIP · Mi Perfil (puntos, código QR propio y liderazgo transformacional)
// ==========================================================================
const session = requireRole(null); // cualquier rol autenticado

if (session) {
  renderNav('perfil.html');
  loadProfile();
}

const METRIC_LABELS = {
  idealized_influence_attributes: 'Influencia Idealizada (Atributos)',
  idealized_influence_behaviors: 'Influencia Idealizada (Comportamientos)',
  individualized_consideration: 'Consideración Individualizada',
  inspirational_motivation: 'Motivación Inspiracional',
  intellectual_stimulation: 'Estimulación Intelectual'
};

async function loadProfile() {
  const { data, error } = await supabase.rpc('get_my_profile', { p_user_id: session.id });
  const container = document.getElementById('profile-container');

  if (error || !data) {
    container.innerHTML = '<div class="empty-state">No se pudo cargar tu perfil. Intenta iniciar sesión de nuevo.</div>';
    return;
  }

  const u = data.user;
  const lp = data.leadership_profile || {};

  container.innerHTML = `
    <div class="page-head">
      <h1>Hola, ${u.full_name.split(' ')[0]} 👋</h1>
      <p>Este es tu resumen de asistencia y desarrollo como voluntario GACIP.</p>
    </div>

    <div class="grid grid-3" style="margin-bottom:22px;">
      <div class="stat-card"><div class="stat-icon">🏆</div><div><div class="stat-value">${u.points}</div><div class="stat-label">Puntos acumulados</div></div></div>
      <div class="stat-card"><div class="stat-icon">${data.attended_today ? '✅' : '⏳'}</div><div><div class="stat-value">${data.attended_today ? 'Sí' : 'No'}</div><div class="stat-label">Asistencia de hoy</div></div></div>
      <div class="stat-card"><div class="stat-icon">🎖️</div><div><div class="stat-value" style="text-transform:capitalize">${u.role}</div><div class="stat-label">Rol en el sistema</div></div></div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h3>Mi código QR</h3>
        <p class="muted">Muestra este código al encargado de asistencia en cada evento.</p>
        <div class="qr-box">
          <div id="my-qr"></div>
          <div class="muted">${u.email}</div>
        </div>
      </div>

      <div class="card">
        <h3>Perfil de Liderazgo Transformacional</h3>
        <p class="muted">Métricas evaluadas por el equipo de coordinación.</p>
        ${Object.keys(METRIC_LABELS).map(key => `
          <div class="metric">
            <div class="metric-head"><span>${METRIC_LABELS[key]}</span><span class="val">${lp[key] ?? 0}/100</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${lp[key] ?? 0}%"></div></div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="grid grid-3" style="margin-top:20px;">
      <div class="card">
        <h3>💪 Fortalezas</h3>
        <p class="tag-strengths" style="white-space:pre-wrap;">${lp.strengths || 'Aún no hay anotaciones.'}</p>
      </div>
      <div class="card">
        <h3>🎯 Áreas a trabajar</h3>
        <p class="tag-weak" style="white-space:pre-wrap;">${lp.weaknesses || 'Aún no hay anotaciones.'}</p>
      </div>
      <div class="card">
        <h3>📈 Mejoras y cambios</h3>
        <p style="white-space:pre-wrap;">${lp.improvement_notes || 'Aún no hay anotaciones.'}</p>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>Historial de asistencia</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Hora de registro</th></tr></thead>
          <tbody id="history-body"><tr><td colspan="2" class="muted">Cargando…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  new QRCode(document.getElementById('my-qr'), {
    text: u.qr_code,
    width: 180,
    height: 180,
    colorDark: '#123549',
    colorLight: '#ffffff'
  });

  loadHistory();
}

async function loadHistory() {
  const { data, error } = await supabase.rpc('get_attendance_history', {
    p_actor_id: session.id, p_target_id: session.id, p_limit: 30
  });
  const tbody = document.getElementById('history-body');
  if (error || !data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="muted">Todavía no tienes asistencias registradas.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${formatDate(r.attendance_date)}</td>
      <td class="muted">${new Date(r.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</td>
    </tr>
  `).join('');
}
