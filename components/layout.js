function getTabButton(id){
  return document.querySelector(`.tab[data-tab="${id}"]`);
}

function showTab(id, el){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  if(el) el.classList.add('active');
  if(id==='bd') renderBD(true);
  if(id==='resumen') recalcResumen();
  if(id==='pres') renderPres(true);
  if(id==='materiales' && typeof renderMateriales === 'function') renderMateriales(true);
  if(id==='imprimir') generarPreview();
  if(id==='admin') cargarUsuarios();
  if(id==='guardados') renderGuardados();
  if(id==='recursos' && typeof renderRecursos === 'function') renderRecursos(true);
  if(id==='dashboard') setTimeout(()=>renderDashboard(true), 30);
}

function setRamo(r){
  ramoActivo = r;
  document.querySelectorAll('.ramo-btn').forEach(b=>{
    b.classList.remove('activo');
    b.style.background='transparent';
    b.style.color='';
    b.style.borderColor='';
  });
  const btn = document.getElementById('ramo-'+r);
  if(!btn) return;
  btn.classList.add('activo');
  btn.style.background = RAMO_COLORS[r]+'33';
  btn.style.color = RAMO_COLORS[r];
  btn.style.borderColor = RAMO_COLORS[r];
  renderBD();
}

function filtrarDB(){
  const q = String((document.getElementById('bd-search')||{}).value || '').trim().toLowerCase();
  const modo = typeof bdModoActivo !== 'undefined' ? bdModoActivo : 'costeo';
  const recursoIndex = modo === 'mdo' && typeof getMdoResourceIndex === 'function' ? getMdoResourceIndex() : null;
  return DB.filter(p=>{
    const esMdo = typeof isManoObraPartida === 'function' ? isManoObraPartida(p) : false;
    if(modo === 'mdo' && !esMdo) return false;
    if(modo !== 'mdo' && esMdo) return false;
    const capRamos = capOf(p.cap).ramos || ['todos'];
    const coincideRamo = modo === 'mdo' || ramoActivo==='todos' || capRamos.includes(ramoActivo) || (p.ramo&&p.ramo===ramoActivo);
    const desc = String(p.desc || '').toLowerCase();
    const cod = String(p.cod || '').toLowerCase();
    const meta = modo === 'mdo' && typeof getMdoMeta === 'function' ? getMdoMeta(p, recursoIndex) : null;
    const metaText = meta ? `${meta.categoria} ${meta.grupo}`.toLowerCase() : '';
    const coincideTexto = !q || desc.includes(q) || cod.includes(q) || metaText.includes(q);
    return coincideRamo && coincideTexto;
  });
}

function notif(msg, color){
  const n = document.getElementById('notif');
  n.textContent = typeof sanitizeAppText === 'function' ? sanitizeAppText(msg) : msg;
  n.style.background = color||'var(--acento)';
  n.style.color = color?'#fff':'#03150C';
  n.classList.add('show');
  clearTimeout(n._t);
  n._t = setTimeout(()=>n.classList.remove('show'), 3000);
}

function cerrarModal(id){
  document.getElementById(id).classList.remove('open');
  if(id === 'modal-insumo' && typeof resetInsumoModalState === 'function'){
    resetInsumoModalState();
  }
}
function abrirModal(id){ document.getElementById(id).classList.add('open'); }

function buscarGlobal(q){
  const res = document.getElementById('global-results');
  if(!q || q.length < 2){ res.classList.remove('open'); return; }
  const ql = q.toLowerCase();
  let html = '';

  const partidas = DB.filter(p=>p.desc.toLowerCase().includes(ql)||p.cod.includes(ql)).slice(0,6);
  if(partidas.length){
    html += `<div style="padding:8px 12px;font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--borde)">Partidas (${partidas.length})</div>`;
    partidas.forEach(p=>{
      html += `<div style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--borde);transition:background .15s" onmousedown="irAPartida('${p.id}')" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="font-size:12px;font-weight:600;color:var(--txt)">${p.desc}</div>
        <div style="font-size:10px;color:var(--txt3);margin-top:2px">${p.cod} | ${capOf(p.cap).name} | ${fmt(pu(p))}</div>
      </div>`;
    });
  }

  const guardados = PRESUPUESTOS_GUARDADOS.filter(p=>(p.nombre||'').toLowerCase().includes(ql)||(p.cliente||'').toLowerCase().includes(ql)).slice(0,4);
  if(guardados.length){
    html += `<div style="padding:8px 12px;font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--borde);border-top:1px solid var(--borde)">Presupuestos guardados (${guardados.length})</div>`;
    guardados.forEach(p=>{
      html += `<div style="padding:9px 14px;cursor:pointer;transition:background .15s" onmousedown="abrirPresupuestoGuardadoDesdeSearch(${PRESUPUESTOS_GUARDADOS.indexOf(p)})" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="font-size:12px;font-weight:600;color:var(--txt)">${p.nombre||'Sin nombre'}</div>
        <div style="font-size:10px;color:var(--txt3);margin-top:2px">${p.cliente||'-'} | ${p.fecha||'-'}</div>
      </div>`;
    });
  }

  if(!html) html = `<div style="padding:20px;text-align:center;color:var(--txt3);font-size:12px">Sin resultados para "${q}"</div>`;
  res.innerHTML = html;
  res.classList.add('open');
}

function mostrarResultadosGlobal(){
  const q = document.getElementById('global-search').value;
  if(q && q.length >= 2) buscarGlobal(q);
}

function ocultarResultadosGlobal(){
  document.getElementById('global-results').classList.remove('open');
}

function irAPartida(id){
  document.getElementById('global-search').value='';
  ocultarResultadosGlobal();
  showTab('bd', getTabButton('bd'));
  setTimeout(()=>{
    expandirPartida(id, true);
    const row = document.querySelector(`tr[data-pid="${id}"]`);
    if(row){
      row.scrollIntoView({behavior:'smooth',block:'center'});
      row.style.outline='2px solid var(--acento)';
      setTimeout(()=>row.style.outline='',2000);
    }
  },200);
}

function abrirPresupuestoGuardadoDesdeSearch(idx){
  document.getElementById('global-search').value='';
  ocultarResultadosGlobal();
  showTab('guardados', getTabButton('guardados'));
}

