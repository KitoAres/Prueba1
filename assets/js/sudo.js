// ==========================================================================
// GACIP · Panel Sudo — control total de cuentas
// ==========================================================================
const session = requireRole(['sudo']);
if (session) {
  renderNav('sudo.html');
  loadUsers();
}

let allUsers = [];
let currentTarget = null;

async function loadUsers() {
  const { data, error } = await supabase.rpc('get_users', { p_actor_id: session.id });
  const tbody = document.getElementById('users-body');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${error.message}</td></tr>`;
    return;
  }
  allUsers = data || [];
  renderTable(allUsers);
}

function renderTable(list) {
  const tbody = document.getElementById('users-body');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No hay cuentas.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td class="person"><span class="avatar">${initials(u.full_name)}</span> ${u.full_name}</td>
      <td class="muted">${u.email}</td>
      <td><span class="badge ${roleBadgeClass(u.role)}">${u.role}</span></td>
      <td>${u.points}</td>
      <td><span class="badge ${u.active ? 'badge-usuario' : 'badge-inactive'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openEdit('${u.id}')">Gestionar</button></td>
    </tr>
  `).join('');
}

document.getElementById('search-box').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderTable(allUsers.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
});

// ---------- Crear cuenta ----------
document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('create-error');
  const successBox = document.getElementById('create-success');
  errorBox.style.display = 'none';
  successBox.style.display = 'none';

  const { error } = await supabase.rpc('create_user', {
    p_actor_id: session.id,
    p_full_name: document.getElementById('c-name').value.trim(),
    p_email: document.getElementById('c-email').value.trim(),
    p_password: document.getElementById('c-password').value,
    p_role_name: document.getElementById('c-role').value
  });

  if (error) {
    errorBox.textContent = error.message;
    errorBox.style.display = 'block';
    return;
  }

  successBox.style.display = 'block';
  document.getElementById('create-form').reset();
  loadUsers();
});

// ---------- Editar cuenta (modal) ----------
function openEdit(userId) {
  currentTarget = allUsers.find(u => u.id === userId);
  document.getElementById('modal-title').textContent = `Gestionar · ${currentTarget.full_name}`;
  document.getElementById('e-role').value = currentTarget.role;
  document.getElementById('e-password').value = '';
  document.getElementById('edit-success').style.display = 'none';
  document.getElementById('modal-backdrop').classList.add('open');
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal-backdrop').classList.remove('open');
});
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modal-backdrop') e.currentTarget.classList.remove('open');
});

document.getElementById('btn-save-role').addEventListener('click', async () => {
  const { error } = await supabase.rpc('set_role', {
    p_actor_id: session.id, p_target_id: currentTarget.id, p_new_role: document.getElementById('e-role').value
  });
  if (error) return alert('Error: ' + error.message);
  showEditSuccess();
  loadUsers();
});

document.getElementById('btn-save-password').addEventListener('click', async () => {
  const pass = document.getElementById('e-password').value;
  if (pass.length < 6) return alert('La contraseña debe tener al menos 6 caracteres.');
  const { error } = await supabase.rpc('set_password', {
    p_actor_id: session.id, p_target_id: currentTarget.id, p_new_password: pass
  });
  if (error) return alert('Error: ' + error.message);
  showEditSuccess();
});

document.getElementById('btn-toggle-active').addEventListener('click', async () => {
  const { error } = await supabase.rpc('set_active', {
    p_actor_id: session.id, p_target_id: currentTarget.id, p_active: !currentTarget.active
  });
  if (error) return alert('Error: ' + error.message);
  showEditSuccess();
  loadUsers();
  document.getElementById('modal-backdrop').classList.remove('open');
});

document.getElementById('btn-delete').addEventListener('click', async () => {
  if (currentTarget.id === session.id) return alert('No puedes eliminar tu propia cuenta.');
  if (!confirm(`¿Eliminar permanentemente la cuenta de ${currentTarget.full_name}? Esta acción no se puede deshacer.`)) return;
  const { error } = await supabase.rpc('delete_user', { p_actor_id: session.id, p_target_id: currentTarget.id });
  if (error) return alert('Error: ' + error.message);
  document.getElementById('modal-backdrop').classList.remove('open');
  loadUsers();
});

function showEditSuccess() {
  const box = document.getElementById('edit-success');
  box.style.display = 'block';
  setTimeout(() => { box.style.display = 'none'; }, 1800);
}
