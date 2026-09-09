// ==========================================================================
// GACIP · Lógica de autenticación (página de login)
// ==========================================================================
(function () {
  // Si ya hay sesión activa, saltar directo a la vista que corresponda.
  const existing = getSession();
  if (existing) {
    window.location.href = (existing.role === 'usuario') ? 'perfil.html' : 'dashboard.html';
    return;
  }

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('error-box');
  const btn = document.getElementById('btn-login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    const { data, error } = await supabase.rpc('login', {
      p_email: email,
      p_password: password
    });

    btn.disabled = false;
    btn.textContent = 'Ingresar';

    if (error) {
      errorBox.textContent = 'Correo o contraseña incorrectos.';
      errorBox.style.display = 'block';
      return;
    }

    saveSession(data);
    window.location.href = (data.role === 'usuario') ? 'perfil.html' : 'dashboard.html';
  });
})();
