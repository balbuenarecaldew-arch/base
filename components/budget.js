function abrirSelector(){
  document.getElementById('sel-q').value = '';
  renderSel();
  abrirModal('modal-sel');
}

function renderSel(){
  const q = (document.getElementById('sel-q').value || '').toLowerCase();
  let html = '';
  let prevCap = null;

  DB
    .filter(p => !q || p.desc.toLowerCase().includes(q) || p.cod.includes(q))
    .forEach(p => {
      const cap = capOf(p.cap);
      if(p.cap !== prevCap){
        prevCap = p.cap;
        html += `<tr><td colspan="5" style="background:${cap.color};color:#fff;padding:4px 12px;font-size:10px;font-weight:700">${p.cap} - ${cap.name}</td></tr>`;
      }

      const en = PRESUPUESTO.some(x => x.pid === p.id);
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

  document.getElementById('sel-tbody').innerHTML = html;
}

function addToPres(pid){
  const ex = PRESUPUESTO.find(x => x.pid === pid);
  if(ex) ex.qty += 1;
  else PRESUPUESTO.push({ pid, qty: 1 });

  const p = DB.find(x => x.id === pid);
  notif(`${p.cod} agregado al presupuesto`);
  marcarUnsaved();
  renderSel();
  renderPres();
  renderBD();
  renderDashboard();
}

function getFactorBeneficios(){
  const gi = parseFloat(document.getElementById('pct-gi')?.value || '13') || 13;
  const bi = parseFloat(document.getElementById('pct-bi')?.value || '6') || 6;
  const iva = parseFloat(document.getElementById('pct-iva')?.value || '10') || 10;
  return { factor: (1 + gi / 100) * (1 + bi / 100) * (1 + iva / 100), gi, bi, iva };
}

function renderPres(){
  const tbody = document.getElementById('pres-tbody');
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
  PRESUPUESTO.forEach(item => {
    const p = DB.find(x => x.id === item.pid);
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
          <td style="font-size:13px">${p.desc}</td>
          <td style="color:var(--txt3);font-size:11px">${p.u}</td>
          <td class="num" style="font-size:12px;color:var(--txt2);font-family:'IBM Plex Mono',monospace">${fmtN(pu(p))}</td>
          <td class="num">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value="${item.qty}"
              style="width:90px;padding:5px 8px;text-align:right;border:1px solid var(--borde2);border-radius:7px;font-size:12px;background:var(--bg2);color:var(--txt)"
              onchange="updQty(${item.pid},this.value,'${item.qty}')"
              oninput="updQtyRapido(${item.pid},this.value)"
            >
          </td>
          <td id="pres-item-total-${item.pid}" class="num" style="font-weight:700;font-size:14px;color:var(--acento);font-family:'IBM Plex Mono',monospace">Gs. ${fmtN(t)}</td>
          <td id="pres-item-final-${item.pid}" class="num" style="font-weight:700;font-size:13px;color:var(--amarillo);font-family:'IBM Plex Mono',monospace">Gs. ${fmtN(tFin)}</td>
          <td><button class="btn btn-danger btn-xs" onclick="quitarPres(${item.pid})">Quitar</button></td>
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
  const item = PRESUPUESTO.find(x => x.pid === pid);
  if(item) item.qty = Math.max(0.01, parseFloat(val) || 0.01);

  const { factor } = getFactorBeneficios();
  let cd = 0;
  PRESUPUESTO.forEach(it => {
    const p = DB.find(x => x.id === it.pid);
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
  if(typeof renderDashboard === 'function') renderDashboard();
}

function updQty(pid, val, prevVal){
  pushHistorial('updQty', { pid, prevQty: parseFloat(prevVal) || 1 });
  updQtyRapido(pid, val);
  marcarUnsaved();
  renderPres();
  renderDashboard();
}

function quitarPres(pid){
  const item = PRESUPUESTO.find(x => x.pid === pid);
  if(item) pushHistorial('quitarPres', { item: { ...item } });
  PRESUPUESTO = PRESUPUESTO.filter(x => x.pid !== pid);
  marcarUnsaved();
  renderPres();
  renderBD();
  renderDashboard();
  notif('Partida quitada del presupuesto', '#E89020');
}

function limpiarPres(){
  if(!PRESUPUESTO.length || !confirm('Vaciar el presupuesto?\n\nLas partidas quedan en la base de datos.')) return;
  pushHistorial('limpiarPres', { items: [...PRESUPUESTO] });
  PRESUPUESTO = [];
  marcarUnsaved();
  renderPres();
  renderBD();
  renderDashboard();
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
  return PRESUPUESTO.reduce((a, it) => {
    const p = DB.find(x => x.id === it.pid);
    return a + (p ? pu(p) * it.qty : 0);
  }, 0);
}
