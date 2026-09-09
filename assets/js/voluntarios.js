// ==========================================================================
// GACIP · Gestión de voluntarios y perfiles de liderazgo (admin / sudo)
// ==========================================================================
const session = requireRole(['admin', 'sudo']);
if (session) {
  renderNav('voluntarios.html');
  loadUsers();
}

const METRICS = [
  { key: 'idealized_influence_attributes', label: 'Influencia Idealizada (Atributos)' },
  { key: 'idealized_influence_behaviors', label: 'Influencia Idealizada (Comportamientos)' },
  { key: 'individualized_consideration', label: 'Consideración Individualizada' },
  { key: 'inspirational_motivation', label: 'Motivación Inspiracional' },
  { key: 'intellectual_stimulation', label: 'Estimulación Intelectual' }
];

let allUsers = [];
let currentTargetId = null;

async function loadUsers() {
  const { data, error } = await supabase.rpc('get_users', { p_actor_id: session.id });
  const tbody = document.getElementById('users-body');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Error al cargar: ${error.message}</td></tr>`;
    return;
  }
  allUsers = (data || []).filter(u => u.role === 'usuario');
  renderTable(allUsers);
}

function renderTable(list) {
  const tbody = document.getElementById('users-body');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">No hay voluntarios registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td class="person"><span class="avatar">${initials(u.full_name)}</span> ${u.full_name}</td>
      <td class="muted">${u.email}</td>
      <td><strong>${u.points}</strong></td>
      <td><span class="badge ${u.active ? 'badge-usuario' : 'badge-inactive'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openProfile('${u.id}')">Ver perfil</button></td>
    </tr>
  `).join('');
}

document.getElementById('search-box').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderTable(allUsers.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
});

async function openProfile(userId) {
  currentTargetId = userId;
  const user = allUsers.find(u => u.id === userId);
  document.getElementById('modal-title').textContent = `Perfil de liderazgo · ${user.full_name}`;
  document.getElementById('modal-success').style.display = 'none';

  const { data, error } = await supabase.rpc('get_leadership_profile', {
    p_actor_id: session.id, p_target_id: userId
  });
  const lp = error ? {} : (data || {});

  const slidersEl = document.getElementById('metric-sliders');
  slidersEl.innerHTML = METRICS.map(m => `
    <div class="metric">
      <div class="metric-head"><span>${m.label}</span><span class="val" id="val-${m.key}">${lp[m.key] ?? 0}</span></div>
      <input type="range" min="0" max="100" value="${lp[m.key] ?? 0}" id="slider-${m.key}"
        oninput="document.getElementById('val-${m.key}').textContent = this.value">
    </div>
  `).join('');

  document.getElementById('f-improvements').value = lp.improvement_notes || '';
  document.getElementById('f-weaknesses').value = lp.weaknesses || '';
  document.getElementById('f-strengths').value = lp.strengths || '';

  document.getElementById('modal-backdrop').classList.add('open');
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal-backdrop').classList.remove('open');
});
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modal-backdrop') e.currentTarget.classList.remove('open');
});

document.getElementById('btn-save-profile').addEventListener('click', async () => {
  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  const values = {};
  METRICS.forEach(m => { values[m.key] = parseInt(document.getElementById(`slider-${m.key}`).value, 10); });

  const { error } = await supabase.rpc('upsert_leadership_profile', {
    p_actor_id: session.id,
    p_target_id: currentTargetId,
    p_ii_attr: values.idealized_influence_attributes,
    p_ii_behav: values.idealized_influence_behaviors,
    p_ic: values.individualized_consideration,
    p_im: values.inspirational_motivation,
    p_is: values.intellectual_stimulation,
    p_improvements: document.getElementById('f-improvements').value.trim(),
    p_weaknesses: document.getElementById('f-weaknesses').value.trim(),
    p_strengths: document.getElementById('f-strengths').value.trim()
  });

  btn.disabled = false;
  btn.textContent = 'Guardar cambios';

  if (error) {
    alert('Error al guardar: ' + error.message);
    return;
  }
  document.getElementById('modal-success').style.display = 'block';
  setTimeout(() => document.getElementById('modal-backdrop').classList.remove('open'), 900);
});
