// AUTH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function togglePass(){
  const inp = document.getElementById('login-pass');
  const svg = document.getElementById('eye-icon');
  if(inp.type === 'password'){
    inp.type = 'text';
    svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>';
  } else {
    inp.type = 'password';
    svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
  }
}

async function loginBtn(){
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('login-submit');
  const err   = document.getElementById('login-err');
  err.textContent = ''; err.classList.remove('visible');

  if(!email){ mostrarErrorLogin('Ingresá tu correo electrónico'); return; }
  if(!pass){  mostrarErrorLogin('Ingresá tu contraseña'); return; }
  if(pass.length < 6){ mostrarErrorLogin('La contraseña debe tener al menos 6 caracteres'); return; }

  btn.textContent = 'Ingresando...'; btn.disabled = true;

  try{
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    const user = cred.user;
    currentUser = user;

    const accesoConcedido = await registrarAcceso(user);
    if(!accesoConcedido){
      await auth.signOut();
      mostrarErrorLogin('Tu acceso está bloqueado. Contactá al administrador.');
      btn.textContent = 'Ingresar'; btn.disabled = false;
      return;
    }
    isAdmin = await verificarAdmin(user);
    abrirApp(user);
  }catch(e){
    const msgs = {
      'auth/user-not-found':      'No existe una cuenta con ese correo electrónico.',
      'auth/wrong-password':      'Contraseña incorrecta. Verificá e intentá de nuevo.',
      'auth/invalid-credential':  'Correo o contraseña incorrectos. Verificá los datos.',
      'auth/invalid-email':       'El correo no tiene un formato válido (ej: usuario@dominio.com).',
      'auth/too-many-requests':   'Demasiados intentos fallidos. Esperá unos minutos antes de intentar de nuevo.',
      'auth/user-disabled':       'Tu cuenta fue deshabilitada. Contactá al administrador.',
      'auth/network-request-failed': 'Sin conexión a internet. Verificá tu red e intentá de nuevo.',
      'auth/operation-not-allowed': 'El acceso con email y contraseña no está habilitado en Firebase.',
      'auth/configuration-not-found': 'Error de configuración de Firebase. Contactá al administrador.',
    };
    mostrarErrorLogin(msgs[e.code] || 'Error inesperado. Intentá de nuevo o contactá al administrador.');
    btn.textContent = 'Ingresar'; btn.disabled = false;
  }
}

function mostrarErrorLogin(msg){
  const err = document.getElementById('login-err');
  err.textContent = msg;
  err.classList.add('visible');
}

function abrirApp(user){
  appAbierta = true;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('user-email-display').textContent = user.email.split('@')[0];
  if(isAdmin){
    document.getElementById('admin-badge').style.display = '';
    document.getElementById('tab-admin-btn').style.display = '';
    notif('Bienvenido, Administrador');
  } else {
    // Ocultar botones de peligro para no-admins
    document.querySelectorAll('.admin-only').forEach(el=>el.style.display='none');
    notif('Bienvenido, ' + user.email.split('@')[0]);
  }
  cargarDesdeFirebase();
  initSecciones();
  document.getElementById('p-fecha').value = new Date().toISOString().split('T')[0];
  actualizarBtnUndo();
  resetInactivity();
  iniciarAutosave();
}

function cerrarSesion(auto=false){
  if(!auto && !confirm('¿Cerrar sesión?')) return;
  appAbierta = false;
  currentUser = null;
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);
  clearInterval(countdownInterval);
  clearInterval(autosaveTimer);
  document.getElementById('inactivity-warning').classList.remove('show');
  // Desuscribir listener ANTES de signOut para evitar error de permisos
  if(_firestoreUnsub){ _firestoreUnsub(); _firestoreUnsub = null; }
  // Limpiar estado en memoria inmediatamente
  DB=[]; APU={}; PRESUPUESTO=[]; HISTORIAL=[];
  hayUnsaved = false;
  _initialLoadDone = false;
  _ignorarProximoSnapshotPres = 0;
  auth.signOut().then(() => {
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-email').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-err').textContent = '';
    document.getElementById('login-err').classList.remove('visible');
    document.getElementById('login-submit').textContent = 'Ingresar';
    document.getElementById('login-submit').disabled = false;
    notif(auto ? 'Sesión cerrada por inactividad' : 'Sesión cerrada');
  });
}

auth.onAuthStateChanged(async user => {
  if(!user && appAbierta){
    appAbierta = false; currentUser = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FIREBASE CRUD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
