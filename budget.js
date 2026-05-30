function abrirSelector(){
  document.getElementById('sel-q').value = '';
  renderSel();
  abrirModal('modal-sel');
}

let _selectorRenderTimer = null;
let editPresPid = null;

function requestRenderSel(delay = 120){
  clearTimeout(_selectorRenderTimer);
  _selectorRenderTimer = setTimeout(renderSel, delay);
}

function presPidEquals(a, b){
  return String(a) === String(b);
}

function presPidArg(pid){
  return `'${String(pid).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function findPresupuestoItem(pid){
  return PRESUPUESTO.find(item=>presPidEquals(item.pid, pid)) || null;
}

function normalizeBudgetRubroData(data){
  return {
    cap: String(data.cap || '01').padStart(2, '0'),
    cod: String(data.cod || '').trim(),
    desc: String(data.desc || '').trim(),
    u: String(data.u || 'un').trim() || 'un',
    ramo: data.ramo || 'todos',
    mat: Math.round(parseFloat(data.mat) || 0),
    mo: Math.round(parseFloat(data.mo) || 0),
    eq: Math.round(parseFloat(data.eq) || 0),
    sub: Math.round(parseFloat(data.sub) || 0),
  };
}

function getBudgetItemPartida(item, dbById = null){
  if(!item) return null;
  const base = item.manual ? null : (dbById || new Map(DB.map(partida=>[partida.id, partida]))).get(item.pid);
  if(!base && !item.manual && !item.override) return null;

  const data = normalizeBudgetRubroData({
    ...(base || {}),
    ...(item.manual ? item : (item.override || {})),
  });
  const baseCost = base
    ? [base.mat, base.mo, base.eq, base.sub].map(value=>Math.round(parseFloat(value) || 0)).join('|')
    : '';
  const dataCost = [data.mat, data.mo, data.eq, data.sub].join('|');

  return {
    ...(base || {}),
    ...data,
    id: item.pid,
    sourceId: base?.id || null,
    sourceCod: base?.cod || data.cod,
    _budgetOnly: Boolean(item.manual),
    _budgetEdited: Boolean(item.override),
    _budgetCostEdited: Boolean(item.manual || (item.override && baseCost !== dataCost)),
  };
}

function getPartidasPresupuestoMap(){
  const ids = new Set(PRESUPUESTO.filter(item=>!item.manual).map(item=>item.pid));
  const dbById = new Map();
  if(ids.size){
    for(const partida of DB){
      if(ids.has(partida.id)){
        dbById.set(partida.id, partida);
        if(dbById.size === ids.size) break;
      }
    }
  }
  const map = new Map();
  PRESUPUESTO.forEach(item=>{
    const partida = getBudgetItemPartida(item, dbById);
    if(partida) map.set(item.pid, partida);
  });
  return map;
}

function getPresupuestoResolvedItems(items = PRESUPUESTO){
  const ids = new Set((items || []).filter(item=>!item.manual).map(item=>item.pid));
  const dbById = new Map();
  if(ids.size){
    DB.forEach(partida=>{
      if(ids.has(partida.id)) dbById.set(partida.id, partida);
    });
  }
  return (items || [])
    .map(item=>({ item, p: getBudgetItemPartida(item, dbById) }))
    .filter(entry=>entry.p);
}

function nextManualBudgetCode(capId){
  const cap = String(capId || '01').padStart(2, '0');
  const used = new Set(getPresupuestoResolvedItems().map(({p})=>String(p.cod || '').toLowerCase()));
  for(let i = 1; i <= 999; i++){
    const code = `${cap}.M${String(i).padStart(2, '0')}`;
    if(!used.has(code.toLowerCase())) return code;
  }
  return `${cap}.M${Date.now().toString().slice(-4)}`;
}

function renderSel(){
  const q = (document.getElementById('sel-q').value || '').toLowerCase();
  let html = '';
  let prevCap = null;
  const presMap = new Map(PRESUPUESTO.map(item=>[item.pid, item]));
  const maxRows = q ? 500 : 350;
  const partidas = DB
    .filter(p => {
      const desc = String(p.desc || '').toLowerCase();
      const cod = String(p.cod || '').toLowerCase();
      return !q || desc.includes(q) || cod.includes(q);
    });

  partidas
    .slice(0, maxRows)
    .forEach(p => {
      const cap = capOf(p.cap);
      if(p.cap !== prevCap){
        prevCap = p.cap;
        html += `<tr><td colspan="5" style="background:${cap.color};color:#fff;padding:4px 12px;font-size:10px;font-weight:700">${p.cap} - ${cap.name}</td></tr>`;
      }

      const en = presMap.has(p.id);
      html += `
        <tr style="${en ? 'background:rgba(29,186,123,.06)' : ''}">
          <td style="padding:7px 12px"><code style="background:var(--bg2);padding:2px 6px;border-radius:4px;font-size:10px;color:var(--acento)">${p.cod}</code></td>
          <td style="padding:7px 12px;font-size:12px">${p.desc}</td>
          <td style="padding:7px 12px;font-size:10px;color:var(--txt3)">${p.u}</td>
          <td style="padding:7px 12px;text-align:right;font-weight:700;color:var(--acento);font-size:12px;font-family:'IBM Plex Mono',monospace">${fmtN(pu(p))}</td>
          <td style="padding:7px 12px"><button class="btn btn-primary btn-sm" onclick="addToPres(${p.id})">${en ? '+1' : 'Agregar'}</button></td>
        </tr>
      `;
    });

  if(partidas.length > maxRows){
    html += `<tr><td colspan="5" style="padding:10px 12px;text-align:center;color:var(--txt3);font-size:11px;background:var(--bg2)">Mostrando ${maxRows} de ${partidas.length} partidas. Escribi mas datos para afinar la busqueda.</td></tr>`;
  }

  document.getElementById('sel-tbody').innerHTML = html;
}

function addToPres(pid){
  const ex = findPresupuestoItem(pid);
  if(ex) ex.qty += 1;
  else PRESUPUESTO.push({ pid, qty: 1 });

  const p = DB.find(x => x.id === pid);
  notif(p ? `${p.cod} agregado al presupuesto` : 'Partida agregada al presupuesto');
  marcarUnsaved();
  renderSel();
  renderPres();
  refreshMateriales();
  renderBD();
  refreshDashboard();
}

function fillPresupuestoCapSelect(selected = '01'){
  const select = document.getElementById('pr-cap');
  if(!select) return;
  select.innerHTML = CAPS.map(cap=>`<option value="${cap.id}">${cap.id} - ${cap.name}</option>`).join('');
  select.value = selected || CAPS[0]?.id || '01';
}

function updatePresupuestoManualTotal(){
  const total = ['pr-mat', 'pr-mo', 'pr-eq', 'pr-sub']
    .reduce((acc, id)=>acc + (parseFloat(document.getElementById(id)?.value) || 0), 0);
  const el = document.getElementById('pr-pu-show');
  if(el) el.textContent = `Gs. ${fmtN(total)}`;
}

function autoCodPresupuesto(){
  if(editPresPid) return;
  const cap = document.getElementById('pr-cap')?.value || '01';
  const cod = document.getElementById('pr-cod');
  if(cod) cod.value = nextManualBudgetCode(cap);
}

function abrirModalRubroPresupuesto(pid = null){
  editPresPid = pid;
  const item = pid != null ? findPresupuestoItem(pid) : null;
  const partida = item ? getBudgetItemPartida(item) : null;
  const cap = partida?.cap || (CAPS[0]?.id || '01');
  fillPresupuestoCapSelect(cap);

  document.getElementById('pr-title').textContent = item ? 'Editar rubro del presupuesto' : 'Nuevo rubro manual';
  document.getElementById('pr-cap').value = cap;
  document.getElementById('pr-cod').value = partida?.cod || nextManualBudgetCode(cap);
  document.getElementById('pr-desc').value = partida?.desc || '';
  document.getElementById('pr-u').value = partida?.u || 'un';
  document.getElementById('pr-qty').value = item?.qty || 1;
  document.getElementById('pr-mat').value = partida?.mat || 0;
  document.getElementById('pr-mo').value = partida?.mo || 0;
  document.getElementById('pr-eq').value = partida?.eq || 0;
  document.getElementById('pr-sub').value = partida?.sub || 0;

  const restoreBtn = document.getElementById('pr-restaurar');
  if(restoreBtn) restoreBtn.style.display = item && item.override ? 'inline-flex' : 'none';

  updatePresupuestoManualTotal();
  abrirModal('modal-rubro-presupuesto');
}

function guardarRubroPresupuesto(){
  const desc = document.getElementById('pr-desc').value.trim();
  const cod = document.getElementById('pr-cod').value.trim();
  const qty = Math.max(0.01, parseFloat(document.getElementById('pr-qty').value) || 1);
  if(!cod || !desc){
    notif('Completa codigo y descripcion del rubro', '#E05555');
    return;
  }

  const data = normalizeBudgetRubroData({
    cap: document.getElementById('pr-cap').value,
    cod,
    desc,
    u: document.getElementById('pr-u').value,
    ramo: 'todos',
    mat: document.getElementById('pr-mat').value,
    mo: document.getElementById('pr-mo').value,
    eq: document.getElementById('pr-eq').value,
    sub: document.getElementById('pr-sub').value,
  });

  if(editPresPid != null){
    const item = findPresupuestoItem(editPresPid);
    if(!item) return;
    pushHistorial('editPresItem', { pid: item.pid, prevItem: JSON.parse(JSON.stringify(item)) });
    item.qty = qty;
    if(item.manual){
      Object.assign(item, data, { manual: true });
    }else{
      item.override = data;
    }
  }else{
    const item = {
      pid: `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      qty,
      manual: true,
      ...data,
    };
    PRESUPUESTO.push(item);
    pushHistorial('addPresManual', { pid: item.pid });
  }

  editPresPid = null;
  cerrarModal('modal-rubro-presupuesto');
  marcarUnsaved();
  renderPres();
  refreshMateriales();
  renderBD();
  refreshDashboard();
  notif('Rubro del presupuesto guardado');
}

function restaurarRubroPresupuesto(){
  if(editPresPid == null) return;
  const item = findPresupuestoItem(editPresPid);
  if(!item || !item.override) return;
  pushHistorial('editPresItem', { pid: item.pid, prevItem: JSON.parse(JSON.stringify(item)) });
  delete item.override;
  cerrarModal('modal-rubro-presupuesto');
  editPresPid = null;
  marcarUnsaved();
  renderPres();
  refreshMateriales();
  renderBD();
  refreshDashboard();
  notif('Rubro restaurado desde la base');
}

function getFactorBeneficios(){
  const gi = parseFloat(document.getElementById('pct-gi')?.value || '13') || 13;
  const bi = parseFloat(document.getElementById('pct-bi')?.value || '6') || 6;
  const iva = parseFloat(document.getElementById('pct-iva')?.value || '10') || 10;
  return { factor: (1 + gi / 100) * (1 + bi / 100) * (1 + iva / 100), gi, bi, iva };
}

let _presDirty = true;

function isPresActive(){
  return document.getElementById('tab-pres')?.classList.contains('active');
}

function renderPres(force = false){
  const tbody = document.getElementById('pres-tbody');
  if(!tbody) return;
  if(!force && !isPresActive()){
    _presDirty = true;
    return;
  }
  _presDirty = false;
  if(!PRESUPUESTO.length){
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:50px 0"><div class="icon">+</div><h3>Presupuesto vacio</h3><p>Clic en <strong style="color:var(--acento)">+ Agregar partida</strong> para comenzar</p></div></td></tr>`;
    document.getElementById('pres-cd').textContent = 'Gs. 0';
    document.getElementById('pres-total').textContent = 'Gs. 0';
    document.getElementById('pres-factor-label').textContent = '';
    return;
  }

  const { factor, gi, bi, iva } = getFactorBeneficios();
  document.getElementById('pres-factor-label').textContent = `GI ${gi}% | B ${bi}% | IVA ${iva}%`;

  const byCap = {};
  const dbById = getPartidasPresupuestoMap();
  PRESUPUESTO.forEach(item => {
    const p = dbById.get(item.pid);
    if(!p) return;
    if(!byCap[p.cap]) byCap[p.cap] = [];
    byCap[p.cap].push({ item, p });
  });

  let html = '';
  let cd = 0;

  Object.keys(byCap).sort().forEach(capId => {
    const cap = capOf(capId);
    const capT = byCap[capId].reduce((a, { item, p }) => a + pu(p) * item.qty, 0);
    const capTFin = Math.round(capT * factor);
    html += `
      <tr class="cap-row" style="border-left-color:${cap.color}">
        <td colspan="5" style="background:${cap.color}CC">&nbsp;${capId} - ${cap.name}</td>
        <td class="num" style="background:${cap.color}CC;color:#fff;font-weight:700;font-family:'IBM Plex Mono',monospace">Gs. ${fmtN(capT)}</td>
        <td class="num" style="background:${cap.color}99;color:#fff;font-weight:700;font-family:'IBM Plex Mono',monospace;font-size:11px">Gs. ${fmtN(capTFin)}</td>
        <td style="background:${cap.color}CC"></td>
      </tr>
    `;

    byCap[capId].forEach(({ item, p }) => {
      const t = pu(p) * item.qty;
      cd += t;
      const tFin = Math.round(t * factor);
      html += `
        <tr>
          <td><code style="background:var(--bg3);padding:2px 7px;border-radius:5px;font-size:10px;color:var(--acento)">${p.cod}</code></td>
          <td style="font-size:13px">
            <div>${p.desc}</div>
            ${p._budgetOnly ? '<div class="cell-meta"><span class="chip chip-success">Manual</span></div>' : ''}
            ${p._budgetEdited ? '<div class="cell-meta"><span class="chip chip-outline">Editado en presupuesto</span></div>' : ''}
          </td>
          <td style="color:var(--txt3);font-size:11px">${p.u}</td>
          <td class="num" style="font-size:12px;color:var(--txt2);font-family:'IBM Plex Mono',monospace">${fmtN(pu(p))}</td>
          <td class="num">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value="${item.qty}"
              style="width:90px;padding:5px 8px;text-align:right;border:1px solid var(--borde2);border-radius:7px;font-size:12px;background:var(--bg2);color:var(--txt)"
              onchange="updQty(${presPidArg(item.pid)},this.value,'${item.qty}')"
              oninput="updQtyRapido(${presPidArg(item.pid)},this.value)"
            >
          </td>
          <td id="pres-item-total-${item.pid}" class="num" style="font-weight:700;font-size:14px;color:var(--acento);font-family:'IBM Plex Mono',monospace">Gs. ${fmtN(t)}</td>
          <td id="pres-item-final-${item.pid}" class="num" style="font-weight:700;font-size:13px;color:var(--amarillo);font-family:'IBM Plex Mono',monospace">Gs. ${fmtN(tFin)}</td>
          <td>
            <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
              <button class="btn btn-secondary btn-xs" onclick="abrirModalRubroPresupuesto(${presPidArg(item.pid)})">Editar</button>
              <button class="btn btn-danger btn-xs" onclick="quitarPres(${presPidArg(item.pid)})">Quitar</button>
            </div>
          </td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = html;
  const cdTotal = cd;
  const totalFin = Math.round(cdTotal * factor);
  document.getElementById('pres-cd').textContent = fmt(cdTotal);
  document.getElementById('pres-total').textContent = fmt(totalFin);
}

function updQtyRapido(pid, val){
  const item = findPresupuestoItem(pid);
  if(item) item.qty = Math.max(0.01, parseFloat(val) || 0.01);

  const { factor } = getFactorBeneficios();
  let cd = 0;
  const dbById = getPartidasPresupuestoMap();
  PRESUPUESTO.forEach(it => {
    const p = dbById.get(it.pid);
    if(!p) return;
    const totalItem = pu(p) * it.qty;
    const totalItemFinal = Math.round(totalItem * factor);
    cd += totalItem;

    const totalCell = document.getElementById(`pres-item-total-${it.pid}`);
    const finalCell = document.getElementById(`pres-item-final-${it.pid}`);
    if(totalCell) totalCell.textContent = `Gs. ${fmtN(totalItem)}`;
    if(finalCell) finalCell.textContent = `Gs. ${fmtN(totalItemFinal)}`;
  });
  document.getElementById('pres-cd').textContent = fmt(cd);
  document.getElementById('pres-total').textContent = fmt(Math.round(cd * factor));
  if(typeof recalcResumen === 'function') recalcResumen();
  refreshMateriales();
  refreshDashboard();
}

function updQty(pid, val, prevVal){
  pushHistorial('updQty', { pid, prevQty: parseFloat(prevVal) || 1 });
  updQtyRapido(pid, val);
  marcarUnsaved();
  renderPres();
  refreshMateriales();
  refreshDashboard();
}

function quitarPres(pid){
  const item = findPresupuestoItem(pid);
  if(item) pushHistorial('quitarPres', { item: { ...item } });
  PRESUPUESTO = PRESUPUESTO.filter(x => !presPidEquals(x.pid, pid));
  marcarUnsaved();
  renderPres();
  refreshMateriales();
  renderBD();
  refreshDashboard();
  notif('Partida quitada del presupuesto', '#E89020');
}

function limpiarPres(){
  if(!PRESUPUESTO.length || !confirm('Vaciar el presupuesto?\n\nLas partidas quedan en la base de datos.')) return;
  pushHistorial('limpiarPres', { items: [...PRESUPUESTO] });
  PRESUPUESTO = [];
  marcarUnsaved();
  renderPres();
  refreshMateriales();
  renderBD();
  refreshDashboard();
}

function generarNroAutoSilencioso(){
  const anio = new Date().getFullYear();
  const maxNro = PRESUPUESTOS_GUARDADOS.reduce((max, p) => {
    const match = (p.nro || '').match(new RegExp(`PRES-${anio}-(\\d+)`));
    if(match){
      const n = parseInt(match[1], 10);
      return n > max ? n : max;
    }
    return max;
  }, 0);
  return `PRES-${anio}-${String(maxNro + 1).padStart(3, '0')}`;
}

function generarNroAuto(){
  const nro = generarNroAutoSilencioso();
  document.getElementById('p-nro').value = nro;
  marcarUnsaved();
  notif(`Numero generado: ${nro}`);
}

function cdTotal(){
  const dbById = getPartidasPresupuestoMap();
  return PRESUPUESTO.reduce((a, it) => {
    const p = dbById.get(it.pid);
    return a + (p ? pu(p) * it.qty : 0);
  }, 0);
}
