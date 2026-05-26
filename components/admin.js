// ADMIN - USUARIOS
async function cargarUsuarios(){
  if(!isAdmin) return;

  const el = document.getElementById('users-list');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando...</div>';

  try{
    const snap = await db.collection('usuarios').get();

    if(snap.empty){
      el.innerHTML = `
        <div style="color:var(--txt3);font-size:12px;padding:20px 0">
          <p>No hay registros de usuarios aún.</p>
          <p style="margin-top:6px">Los usuarios aparecen aquí la primera vez que inician sesión.</p>
        </div>
      `;
      return;
    }

    const usuarios = [];
    snap.forEach(doc=>{
      usuarios.push({
        id: doc.id,
        ...doc.data(),
        activo: doc.data().activo !== false,
      });
    });

    usuarios.sort((a,b)=>String(a.email || a.id).localeCompare(String(b.email || b.id), 'es'));

    el.innerHTML = usuarios.map(u=>{
      const email = u.email || u.id;
      const esActual = currentUser?.uid === u.id;
      return `
        <div class="user-card">
          <div>
            <div class="uc-email">${email}</div>
            <div class="uc-role">${u.rol || 'Operador'} · Último acceso: ${u.ultimoAcceso || '—'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            <span class="${u.activo ? 'user-status-on' : 'user-status-off'}">${u.activo ? '● Activo' : '● Bloqueado'}</span>
            <button class="btn btn-sm ${u.activo ? 'btn-danger' : 'btn-primary'}" onclick="toggleUsuario('${u.id}', ${u.activo})">${u.activo ? 'Bloquear' : 'Habilitar'}</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarUsuario('${u.id}', '${email.replace(/'/g, "\\'")}')" ${esActual ? 'disabled title="No podés eliminar tu propio registro mientras estás usando la app"' : ''}>Eliminar</button>
          </div>
        </div>
      `;
    }).join('');
  }catch(e){
    el.innerHTML = `<p style="color:var(--rojo);font-size:12px">Error: ${e.message}</p>`;
  }
}

async function toggleUsuario(uid, activo){
  if(!confirm(`¿${activo ? 'Bloquear' : 'Habilitar'} el acceso de este usuario?`)) return;

  await db.collection('usuarios').doc(uid).update({ activo: !activo });
  notif(`Acceso ${activo ? 'bloqueado' : 'habilitado'}`);
  cargarUsuarios();
}

async function eliminarUsuario(uid, email){
  if(currentUser?.uid === uid){
    notif('No podés eliminar tu propio registro desde esta sesión.', '#E05555');
    return;
  }

  const confirmacion = prompt(`Para eliminar este registro escribí el correo exacto:\n\n${email}\n\nCorreo:`);
  if(confirmacion === null) return;

  if(confirmacion.trim().toLowerCase() !== String(email).trim().toLowerCase()){
    notif('Correo incorrecto. No se eliminó el registro.', '#E05555');
    return;
  }

  try{
    await db.collection('usuarios').doc(uid).delete();
    notif(`Registro eliminado: ${email}`);
    cargarUsuarios();
  }catch(e){
    notif(`No se pudo eliminar el registro: ${e.message}`, '#E05555');
  }
}

async function registrarAcceso(user){
  try{
    const docRef = db.collection('usuarios').doc(user.uid);
    const snap = await docRef.get();
    if(snap.exists && snap.data().activo === false) return false;

    await docRef.set({
      email: user.email,
      ultimoAcceso: new Date().toLocaleString('es-PY'),
    }, { merge: true });

    if(!snap.exists) await docRef.update({ activo: true });
    return true;
  }catch(e){
    console.warn('registrarAcceso error:', e);
    return true;
  }
}

async function verificarAdmin(user){
  try{
    const ref = db.collection('admins').doc(user.uid);
    const doc = await ref.get();
    if(doc.exists) return true;

    const snap = await db.collection('admins').limit(1).get();
    if(snap.empty){
      await ref.set({ email: user.email, desde: new Date().toISOString() });
      return true;
    }

    return false;
  }catch(e){
    console.warn('verificarAdmin error:', e);
    return false;
  }
}
