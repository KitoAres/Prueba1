// ==========================================================================
// GACIP · Dashboard de escaneo QR (admin / sudo)
// ==========================================================================
const session = requireRole(['admin', 'sudo']);
if (session) {
  renderNav('dashboard.html');
  loadStats();
  loadRecent();
  startScanner();
}

let html5QrCode;
let isProcessing = false;
let lastScannedCode = null;
let lastScannedAt = 0;

async function loadStats() {
  const { data, error } = await supabase.rpc('get_dashboard_stats', { p_actor_id: session.id });
  if (error) return;
  document.getElementById('stat-today').textContent = data.today_attendance;
  document.getElementById('stat-total').textContent = data.total_volunteers;
  document.getElementById('stat-points').textContent = data.total_points;
}

async function loadRecent() {
  const { data, error } = await supabase.rpc('get_attendance_history', {
    p_actor_id: session.id, p_target_id: null, p_limit: 8
  });
  const tbody = document.getElementById('recent-body');
  if (error || !data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="muted">Sin registros aún.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td class="person"><span class="avatar">${initials(r.full_name)}</span> ${r.full_name}</td>
      <td class="muted">${new Date(r.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</td>
    </tr>
  `).join('');
}

function startScanner() {
  html5QrCode = new Html5Qrcode('qr-reader');
  Html5Qrcode.getCameras().then(cameras => {
    if (!cameras || cameras.length === 0) {
      document.getElementById('qr-reader').innerHTML =
        '<p style="color:#fff;padding:20px;">No se detectó ninguna cámara disponible.</p>';
      return;
    }
    const cameraId = cameras.find(c => /back|rear|trás|environment/i.test(c.label))?.id || cameras[0].id;
    html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: { width: 240, height: 240 } },
      onScanSuccess
    ).catch(() => {
      // Fallback: usar cámara por defecto orientada al ambiente
      html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, onScanSuccess);
    });
  }).catch(err => {
    document.getElementById('qr-reader').innerHTML =
      '<p style="color:#fff;padding:20px;">No se pudo acceder a la cámara: ' + err + '</p>';
  });
}

document.getElementById('btn-restart').addEventListener('click', () => {
  if (html5QrCode) {
    html5QrCode.stop().then(startScanner).catch(startScanner);
  } else {
    startScanner();
  }
});

async function onScanSuccess(decodedText) {
  const now = Date.now();
  // Evita procesar el mismo QR repetidamente mientras sigue en cuadro (debounce 3s)
  if (isProcessing || (decodedText === lastScannedCode && now - lastScannedAt < 3000)) return;
  isProcessing = true;
  lastScannedCode = decodedText;
  lastScannedAt = now;

  const { data, error } = await supabase.rpc('register_attendance', {
    p_actor_id: session.id,
    p_qr_code: decodedText
  });

  const area = document.getElementById('result-area');

  if (error) {
    area.innerHTML = `
      <div class="scan-result err">
        <div class="icon">⚠️</div>
        <div class="who">Código no reconocido</div>
        <div class="pts">${error.message.replace('Error: ', '') || 'Verifica el QR del voluntario.'}</div>
      </div>`;
  } else if (data.status === 'duplicate') {
    area.innerHTML = `
      <div class="scan-result dup">
        <div class="icon">🟡</div>
        <div class="who">${data.full_name}</div>
        <div class="pts">Ya registró su asistencia hoy · ${data.points} pts acumulados</div>
      </div>`;
  } else {
    area.innerHTML = `
      <div class="scan-result ok">
        <div class="icon">✅</div>
        <div class="who">${data.full_name}</div>
        <div class="pts">¡Asistencia registrada! +1 punto · ${data.points} pts acumulados</div>
      </div>`;
    loadStats();
    loadRecent();
  }

  setTimeout(() => { isProcessing = false; }, 1200);
}
