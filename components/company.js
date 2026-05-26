// MULTI-EMPRESA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderEmpresasSel(){
  const sel=document.getElementById('empresa-sel');
  sel.innerHTML='<option value="">— Seleccioná una empresa —</option>';
  Object.entries(EMPRESAS).forEach(([id,emp])=>{
    const opt=document.createElement('option');
    opt.value=id; opt.textContent=emp.nombre||'(sin nombre)';
    if(id===empresaActivaId) opt.selected=true;
    sel.appendChild(opt);
  });
}
function cargarEmpresa(){
  const id=document.getElementById('empresa-sel').value;
  if(!id) return;
  // Guardar datos de empresa anterior
  if(empresaActivaId&&empresaActivaId!==id&&EMPRESAS[empresaActivaId]){
    EMPRESAS[empresaActivaId]={
      nombre:document.getElementById('emp-nombre').value,
      ruc:document.getElementById('emp-ruc').value,
      dir:document.getElementById('emp-dir').value,
      nota:document.getElementById('emp-nota').value,
      plazo:document.getElementById('emp-plazo').value,
      pago:document.getElementById('emp-pago').value,
      validez:document.getElementById('emp-validez').value,
      logo:logoDataURL||null,
    };
  }
  empresaActivaId=id;
  const emp=EMPRESAS[id]; if(!emp) return;
  document.getElementById('emp-nombre').value=emp.nombre||'';
  document.getElementById('emp-ruc').value=emp.ruc||'';
  document.getElementById('emp-dir').value=emp.dir||'';
  document.getElementById('emp-nota').value=emp.nota||'';
  document.getElementById('emp-plazo').value=emp.plazo||'';
  document.getElementById('emp-pago').value=emp.pago||'';
  document.getElementById('emp-validez').value=emp.validez||'';
  logoDataURL=emp.logo||null;
  const prev=document.getElementById('logo-preview');
  if(emp.logo) prev.innerHTML=`<img src="${emp.logo}" style="width:100%;height:100%;object-fit:contain;border-radius:6px">`;
  else prev.innerHTML='+ Logo';
  notif('Empresa cargada: '+(emp.nombre||id));
  generarPreview();
}
function agregarEmpresa(){
  const nombre=prompt('Nombre de la nueva empresa:'); if(!nombre) return;
  const id='emp_'+Date.now();
  EMPRESAS[id]={nombre,ruc:'',dir:'',logo:null,nota:'',plazo:'',pago:'',validez:''};
  empresaActivaId=id;
  renderEmpresasSel(); cargarEmpresa();
  notif('Empresa "'+nombre+'" creada'); marcarUnsaved();
}
function guardarEmpresaActual(){
  if(!empresaActivaId){ notif('Seleccioná o creá una empresa primero','#E05555'); return; }
  EMPRESAS[empresaActivaId]={
    nombre:document.getElementById('emp-nombre').value,
    ruc:document.getElementById('emp-ruc').value,
    dir:document.getElementById('emp-dir').value,
    nota:document.getElementById('emp-nota').value,
    plazo:document.getElementById('emp-plazo').value,
    pago:document.getElementById('emp-pago').value,
    validez:document.getElementById('emp-validez').value,
    logo:logoDataURL||null,
  };
  renderEmpresasSel(); marcarUnsaved(); notif('Empresa guardada');
}
function eliminarEmpresaActual(){
  if(!empresaActivaId){ notif('Seleccioná una empresa primero','#E05555'); return; }
  const nombre=EMPRESAS[empresaActivaId]?.nombre||'';
  if(!confirm(`¿Eliminar la empresa "${nombre}"?`)) return;
  delete EMPRESAS[empresaActivaId];
  empresaActivaId=null; logoDataURL=null;
  ['emp-nombre','emp-ruc','emp-dir','emp-nota','emp-plazo','emp-pago','emp-validez'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('logo-preview').innerHTML='+ Logo';
  renderEmpresasSel(); marcarUnsaved(); notif('Empresa eliminada','#E05555');
}

const CAP_RAMOS = ['todos','civil','vial','electrica','sanitaria','hvac','acabados'];

function abrirModalCaps(){
  renderCapsModal();
  abrirModal('modal-caps');
}

function buildChapterCode(index){
  return String(index + 1).padStart(2, '0');
}

function getChapterInsertIndex(){
  const raw = prompt(`Posicion del nuevo capitulo (1 a ${CAPS.length + 1}):`, String(CAPS.length + 1));
  if(raw === null) return null;
  const parsed = parseInt(raw, 10);
  if(!Number.isFinite(parsed)) return CAPS.length;
  return Math.max(0, Math.min(CAPS.length, parsed - 1));
}

function renumerarCapitulosYPartidas(){
  const oldToNew = {};
  CAPS.forEach((cap, idx) => {
    const oldId = cap.id;
    const newId = buildChapterCode(idx);
    oldToNew[oldId] = newId;
    cap.id = newId;
    cap.ramos = cap.ramos && cap.ramos.length ? cap.ramos : ['todos'];
  });

  const newApu = {};
  DB.forEach(partida => {
    const oldCap = partida.cap;
    const newCap = oldToNew[oldCap] || oldCap;
    const oldCod = partida.cod;
    const suffix = String(oldCod || '').includes('.') ? String(oldCod).split('.').slice(1).join('.') : String(oldCod || '');
    partida.cap = newCap;
    partida.cod = suffix ? `${newCap}.${suffix}` : newCap;

    const oldKey = partidaKeyFromCode(oldCod);
    const newKey = partidaKeyFromCode(partida.cod);
    if(APU[oldKey]) newApu[newKey] = [...APU[oldKey]];
    else if(APU[newKey]) newApu[newKey] = [...APU[newKey]];
  });
  APU = newApu;
}

function renderCapsModal(){
  const container = document.getElementById('caps-list');
  let html = '';

  CAPS.forEach((cap, idx) => {
    const ramosCheck = CAP_RAMOS.map(r => {
      const sel = cap.ramos && cap.ramos.includes(r);
      return `<label style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--txt2);cursor:pointer;white-space:nowrap">
        <input type="checkbox" id="cap-ramo-${idx}-${r}" ${sel ? 'checked' : ''} style="accent-color:var(--acento);width:12px;height:12px">${r}
      </label>`;
    }).join('');

    const cantidadPartidas = DB.filter(p => p.cap === cap.id).length;
    html += `
      <div style="padding:12px 0;border-bottom:1px solid var(--borde)">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-wrap:wrap">
          <input type="text" value="${cap.id}" readonly style="width:48px;text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:12px;background:var(--bg3);border:1px solid var(--borde2);border-radius:6px;padding:6px;color:var(--acento);flex-shrink:0">
          <input type="text" id="cap-name-${idx}" value="${cap.name}" style="flex:1;min-width:180px;padding:7px 10px;border:1px solid var(--borde2);border-radius:6px;font-size:12px;background:var(--bg2);color:var(--txt)">
          <input type="color" id="cap-color-${idx}" value="${cap.color}" style="width:38px;height:36px;border:none;border-radius:6px;cursor:pointer;background:none;padding:2px;flex-shrink:0">
          <span style="font-size:10px;color:var(--txt3);padding:0 6px">Partidas: ${cantidadPartidas}</span>
          <button class="btn btn-secondary btn-xs" onclick="moverCapitulo(${idx},-1)" ${idx === 0 ? 'disabled' : ''} title="Subir">↑</button>
          <button class="btn btn-secondary btn-xs" onclick="moverCapitulo(${idx},1)" ${idx === CAPS.length - 1 ? 'disabled' : ''} title="Bajar">↓</button>
          <button class="btn btn-danger btn-xs" onclick="eliminarCapitulo(${idx})" title="Eliminar">Eliminar</button>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;padding-left:56px">${ramosCheck}</div>
      </div>
    `;
  });

  container.innerHTML = html || '<p style="color:var(--txt3);font-size:12px">Sin capitulos definidos</p>';
}

function syncCapsModalToState(){
  CAPS.forEach((cap, idx) => {
    const n = document.getElementById(`cap-name-${idx}`);
    const c = document.getElementById(`cap-color-${idx}`);
    if(n) cap.name = n.value.trim() || cap.name;
    if(c) cap.color = c.value;

    const selRamos = CAP_RAMOS.filter(r => {
      const cb = document.getElementById(`cap-ramo-${idx}-${r}`);
      return cb && cb.checked;
    });
    if(selRamos.length) cap.ramos = selRamos;
  });
}

function moverCapitulo(idx, direction){
  syncCapsModalToState();
  const newIndex = idx + direction;
  if(newIndex < 0 || newIndex >= CAPS.length) return;
  const [cap] = CAPS.splice(idx, 1);
  CAPS.splice(newIndex, 0, cap);
  renumerarCapitulosYPartidas();
  renderCapsModal();
}

function agregarCapitulo(){
  syncCapsModalToState();
  const insertIndex = getChapterInsertIndex();
  if(insertIndex == null) return;
  const color = COLORES_PRESET[CAPS.length % COLORES_PRESET.length];
  CAPS.splice(insertIndex, 0, {
    id: '00',
    name: 'Nuevo capitulo',
    color,
    ramos: ['todos'],
  });
  renumerarCapitulosYPartidas();
  renderCapsModal();
}

function eliminarCapitulo(idx){
  syncCapsModalToState();
  const cap = CAPS[idx];
  const tienePartidas = DB.some(p => p.cap === cap.id);
  if(tienePartidas && CAPS.length === 1){
    notif('No podes eliminar el unico capitulo con partidas', '#E05555');
    return;
  }
  if(tienePartidas && !confirm(`"${cap.name}" tiene partidas asignadas.\nSi lo eliminas, esas partidas pasaran al capitulo anterior o siguiente disponible.`)) return;

  if(tienePartidas && CAPS.length > 1){
    const fallback = CAPS[idx - 1] || CAPS[idx + 1];
    DB.forEach(partida => {
      if(partida.cap === cap.id) partida.cap = fallback.id;
    });
  }

  CAPS.splice(idx, 1);
  renumerarCapitulosYPartidas();
  renderCapsModal();
}

function guardarCapitulos(){
  syncCapsModalToState();
  CAPS.forEach(cap => {
    cap.name = (cap.name || '').trim() || `Capitulo ${cap.id}`;
    cap.ramos = cap.ramos && cap.ramos.length ? cap.ramos : ['todos'];
  });

  renumerarCapitulosYPartidas();
  cerrarModal('modal-caps');
  marcarUnsaved();
  guardarFirebase();
  renderBD();
  renderPres();
  renderDashboard();
  notif(`Capitulos guardados: ${CAPS.length}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
