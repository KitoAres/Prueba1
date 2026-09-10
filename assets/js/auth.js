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

    try {
      const { data, error } = await supabase.rpc('login', {
        p_email: email,
        p_password: password
      });

      if (error) {
        console.error('Error de login (Supabase):', error);
        errorBox.textContent = 'Correo o contraseña incorrectos. Detalle: ' + error.message;
        errorBox.style.display = 'block';
        return;
      }

      saveSession(data);
      window.location.href = (data.role === 'usuario') ? 'perfil.html' : 'dashboard.html';

    } catch (err) {
      // Esto atrapa errores de red / conexión (URL mal copiada, sin internet, CORS, etc.)
      console.error('Excepción inesperada al iniciar sesión:', err);
      errorBox.textContent = 'No se pudo conectar con el servidor. Revisa tu conexión o la configuración de Supabase. (' + err.message + ')';
      errorBox.style.display = 'block';

    } finally {
      // Esto SIEMPRE se ejecuta, pase lo que pase, así el botón nunca se queda colgado.
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
})();
