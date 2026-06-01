function ensureDashboardCanvas(canvasId, fallbackMessage){
  let canvas = document.getElementById(canvasId);
  if(canvas) return canvas;

  if(canvasId === 'chart-caps'){
    const host = document.getElementById('chart-caps-host');
    if(host){
      host.innerHTML = `<canvas id="chart-caps"></canvas>`;
      return document.getElementById('chart-caps');
    }
  }

  if(canvasId === 'chart-tipos'){
    const host = document.getElementById('chart-tipos-host');
    if(host){
      host.innerHTML = `<canvas id="chart-tipos"></canvas>`;
      return document.getElementById('chart-tipos');
    }
  }

  console.warn(fallbackMessage);
  return null;
}

let _dashboardRenderTimer = null;
let _dashboardDirty = true;

function isDashboardActive(){
  return document.getElementById('tab-dashboard')?.classList.contains('active');
}

function requestRenderDashboard(delay = 180){
  _dashboardDirty = true;
  if(!isDashboardActive()) return;
  clearTimeout(_dashboardRenderTimer);
  _dashboardRenderTimer = setTimeout(()=>renderDashboard(true), delay);
}

function buildDashboardRows(factor){
  const rows = typeof getPresupuestoResolvedItems === 'function'
    ? getPresupuestoResolvedItems()
    : PRESUPUESTO.map(item=>({
        item,
        p: new Map(DB.map(partida=>[partida.id, partida])).get(item.pid),
      })).filter(entry=>entry.p);

  return rows.map(({ item, p })=>{
    const qty = Math.max(0, parseFloat(item.qty) || 0);
    const directo = Math.round(pu(p) * qty);
    const final = Math.round(directo * factor);
    return {
      item,
      p,
      qty,
      directo,
      final,
      capName: capOf(p.cap).name,
      origen: p._budgetOnly ? 'Manual' : (p._budgetEdited ? 'Editado' : 'Base'),
    };
  });
}

function renderDashboardInsights(rows, breakdown, cd, total, factor){
  const host = document.getElementById('dash-insights');
  if(!host) return;
  if(!rows.length){
    host.innerHTML = '<div class="empty-state"><h3>Sin presupuesto activo</h3><p>Agrega partidas para ver indicadores de control.</p></div>';
    return;
  }

  const tipos = [
    ['Materiales', breakdown.tipos.mat, '#77c8ff'],
    ['Mano de Obra', breakdown.tipos.mo, '#5ec8ff'],
    ['Equipo', breakdown.tipos.eq, '#D4B820'],
    ['Subcontrato', breakdown.tipos.sub, '#E89020'],
  ].sort((a,b)=>b[1] - a[1]);
  const mainType = tipos[0];
  const caps = Object.entries(breakdown.byCap).sort((a,b)=>b[1] - a[1]);
  const mainCap = caps[0] || ['-', 0];
  const manuales = rows.filter(row=>row.p._budgetOnly || row.p._budgetEdited).length;
  const promedio = rows.length ? Math.round(cd / rows.length) : 0;

  host.innerHTML = `
    <div class="dash-insight-list">
      <div class="dash-insight">
        <div>
          <div class="dash-insight-label">Mayor tipo de costo</div>
          <div class="dash-insight-value" style="color:${mainType[2]}">${mainType[0]}</div>
          <div class="dash-insight-sub">${cd ? ((mainType[1] / cd) * 100).toFixed(1) : 0}% del costo directo</div>
        </div>
        <div class="dash-insight-kpi">${fmt(mainType[1])}</div>
      </div>
      <div class="dash-insight">
        <div>
          <div class="dash-insight-label">Capítulo dominante</div>
          <div class="dash-insight-value">${capOf(mainCap[0]).name || '-'}</div>
          <div class="dash-insight-sub">${mainCap[0]} | ${cd ? ((mainCap[1] / cd) * 100).toFixed(1) : 0}% del presupuesto</div>
        </div>
        <div class="dash-insight-kpi">${fmt(mainCap[1])}</div>
      </div>
      <div class="dash-insight">
        <div>
          <div class="dash-insight-label">Rubros adaptados</div>
          <div class="dash-insight-value">${manuales} de ${rows.length}</div>
          <div class="dash-insight-sub">Manual o editado solo para este presupuesto</div>
        </div>
        <div class="dash-insight-kpi">${rows.length ? ((manuales / rows.length) * 100).toFixed(0) : 0}%</div>
      </div>
      <div class="dash-insight">
        <div>
          <div class="dash-insight-label">Promedio por rubro</div>
          <div class="dash-insight-value">${fmt(promedio)}</div>
          <div class="dash-insight-sub">Costo directo promedio | factor ${(factor).toFixed(3)}</div>
        </div>
        <div class="dash-insight-kpi">${fmt(total)}</div>
      </div>
    </div>
  `;
}

function renderDashboardTopRubros(rows){
  const host = document.getElementById('dash-top-rubros');
  if(!host) return;
  const top = rows.slice().sort((a,b)=>b.directo - a.directo).slice(0, 8);
  if(!top.length){
    host.innerHTML = '<div class="empty-state"><h3>Sin rubros</h3><p>El presupuesto activo todavía no tiene partidas.</p></div>';
    return;
  }

  host.innerHTML = `
    <div class="tbl-wrap-fixed" style="max-height:330px">
      <table class="dash-mini-table">
        <thead><tr>
          <th>#</th><th>Rubro</th><th>Cap.</th><th class="num">Cant.</th><th class="num">Costo directo</th><th>Origen</th>
        </tr></thead>
        <tbody>
          ${top.map((row, idx)=>`
            <tr>
              <td class="dash-rank">${idx + 1}</td>
              <td>
                <div style="font-weight:700;color:var(--txt)">${row.p.cod}</div>
                <div style="color:var(--txt3);font-size:11px;line-height:1.25">${row.p.desc}</div>
              </td>
              <td style="color:var(--txt2)">${row.p.cap}</td>
              <td class="num">${row.qty % 1 === 0 ? row.qty : row.qty.toFixed(2)}</td>
              <td class="num" style="color:var(--acento);font-weight:800">${fmtN(row.directo)}</td>
              <td><span class="chip ${row.origen === 'Base' ? 'chip-muted' : 'chip-success'}">${row.origen}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDashboard(force = false){
  if(!force && !isDashboardActive()){
    _dashboardDirty = true;
    return;
  }
  _dashboardDirty = false;
  const statsHost = document.getElementById('dash-stats');
  if(!statsHost) return;

  const gi = parseFloat(document.getElementById('pct-gi')?.value || '13') || 13;
  const bi = parseFloat(document.getElementById('pct-bi')?.value || '6') || 6;
  const iva = parseFloat(document.getElementById('pct-iva')?.value || '10') || 10;
  const cd = cdTotal();
  const factor = (1 + gi / 100) * (1 + bi / 100) * (1 + iva / 100);
  const total = Math.round(cd * factor);

  statsHost.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">Costo Directo</div>
      <div class="stat-card-value" style="color:var(--acento);font-size:18px">${fmt(cd)}</div>
      <div class="stat-card-sub">Presupuesto activo</div>
      <div class="stat-card-accent">Gs</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Total con Gastos + IVA</div>
      <div class="stat-card-value" style="color:var(--amarillo);font-size:18px">${fmt(total)}</div>
      <div class="stat-card-sub">GI ${gi}% + B ${bi}% + IVA ${iva}%</div>
      <div class="stat-card-accent">Tot</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Partidas en presupuesto</div>
      <div class="stat-card-value">${PRESUPUESTO.length}</div>
      <div class="stat-card-sub">de ${DB.length} en base de datos</div>
      <div class="stat-card-accent">Items</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Presupuestos guardados</div>
      <div class="stat-card-value">${PRESUPUESTOS_GUARDADOS.length}</div>
      <div class="stat-card-sub">proyectos archivados</div>
      <div class="stat-card-accent">Arch</div>
    </div>
  `;

  const dbById = typeof getPartidasPresupuestoMap === 'function'
    ? getPartidasPresupuestoMap()
    : new Map(DB.map(p=>[p.id, p]));
  const breakdown = typeof getBudgetCostBreakdown === 'function'
    ? getBudgetCostBreakdown()
    : { byCap: {}, tipos: { mat: 0, mo: 0, eq: 0, sub: 0 } };
  const dashboardRows = buildDashboardRows(factor);
  const byCap = breakdown.byCap;
  const matT = breakdown.tipos.mat;
  const moT = breakdown.tipos.mo;
  const eqT = breakdown.tipos.eq;
  const subT = breakdown.tipos.sub;
  renderDashboardInsights(dashboardRows, breakdown, cd, total, factor);
  renderDashboardTopRubros(dashboardRows);

  const capKeys = Object.keys(byCap).sort();
  const capLabels = capKeys.map(k => {
    const n = capOf(k).name;
    return n.length > 22 ? `${n.substring(0, 21)}...` : n;
  });
  const capTotals = capKeys.map(k => Math.round(byCap[k]));
  const capData = capKeys.map(k => cd > 0 ? (byCap[k] / cd * 100) : 0);
  const capColors = capKeys.map(k => capOf(k).color);

  const ctxCaps = ensureDashboardCanvas('chart-caps', 'chart-caps host not found');
  if(ctxCaps){
    if(dashCharts.caps){
      try { dashCharts.caps.destroy(); } catch (e) {}
    }
    if(capData.length){
      try{
        dashCharts.caps = new Chart(ctxCaps, {
          type: 'bar',
          data: {
            labels: capLabels,
            datasets: [{
              data: capData,
              rawTotals: capTotals,
              backgroundColor: capColors.map(c => c + 'BB'),
              borderColor: capColors,
              borderWidth: 1,
              borderRadius: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const value = Number(ctx.raw) || 0;
                    const totalCap = ctx.dataset.rawTotals?.[ctx.dataIndex] || 0;
                    return `${value.toFixed(1)}% | Gs. ${Math.round(totalCap).toLocaleString('es-PY')}`;
                  },
                },
              },
            },
            scales: {
              x: {
                min: 0,
                max: 100,
                grid: { color: 'rgba(255,255,255,.05)' },
                ticks: {
                  color: '#8aa7be',
                  font: { size: 10 },
                  callback: v => `${v}%`,
                },
              },
              y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8aa7be', font: { size: 10 } } },
            },
          },
        });
      }catch(e){
        console.warn('Chart caps error:', e);
      }
    }else{
      ctxCaps.parentElement.innerHTML = '<div class="empty-state" style="height:240px;display:flex;flex-direction:column;justify-content:center"><div class="icon">+</div><p>Sin datos en el presupuesto activo</p></div>';
    }
  }

  const ctxTipos = ensureDashboardCanvas('chart-tipos', 'chart-tipos host not found');
  if(ctxTipos){
    if(dashCharts.tipos){
      try { dashCharts.tipos.destroy(); } catch (e) {}
    }
    const tipoTotal = matT + moT + eqT + subT;
    const tiposSource = [
      { label: 'Materiales', total: Math.round(matT), color: '#77c8ff' },
      { label: 'Mano de Obra', total: Math.round(moT), color: '#5ec8ff' },
      { label: 'Equipo', total: Math.round(eqT), color: '#D4B820' },
      { label: 'Subcontrato', total: Math.round(subT), color: '#E89020' },
    ].filter(item => item.total > 0);
    const tiposData = tiposSource.map(item => tipoTotal > 0 ? (item.total / tipoTotal * 100) : 0);
    const tiposLabels = tiposSource.map(item => item.label);
    const tiposColors = tiposSource.map(item => item.color);
    const tiposTotals = tiposSource.map(item => item.total);
    if(tiposData.length){
      try{
        dashCharts.tipos = new Chart(ctxTipos, {
          type: 'doughnut',
          data: {
            labels: tiposLabels,
            datasets: [{
              data: tiposData,
              rawTotals: tiposTotals,
              backgroundColor: tiposColors.map(c => c + 'CC'),
              borderColor: tiposColors,
              borderWidth: 2,
              hoverOffset: 8,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: '#a7bfd3', font: { size: 11 }, padding: 14 } },
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const value = Number(ctx.raw) || 0;
                    const totalTipo = ctx.dataset.rawTotals?.[ctx.dataIndex] || 0;
                    return `${ctx.label}: ${value.toFixed(1)}% | Gs. ${Math.round(totalTipo).toLocaleString('es-PY')}`;
                  },
                },
              },
            },
            cutout: '60%',
          },
        });
      }catch(e){
        console.warn('Chart tipos error:', e);
      }
    }else{
      ctxTipos.parentElement.innerHTML = '<div class="empty-state" style="height:240px;display:flex;flex-direction:column;justify-content:center"><div class="icon">+</div><p>Sin datos de costos</p></div>';
    }
  }

  const recientes = PRESUPUESTOS_GUARDADOS.slice(0, 5);
  if(!recientes.length){
    document.getElementById('dash-recientes').innerHTML = '<div class="empty-state"><div class="icon">+</div><h3>Sin presupuestos guardados</h3><p>Guarda el presupuesto activo para verlos aqui</p></div>';
    return;
  }

  let html = '<div class="tbl-wrap-fixed" style="max-height:280px"><table style="width:100%;border-collapse:collapse"><thead><tr>';
  ['Proyecto', 'Cliente', 'Nro.', 'Fecha', 'Total Gs.'].forEach(h => {
    html += `<th style="padding:7px 12px;background:var(--bg2);font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">${h}</th>`;
  });
  html += '</tr></thead><tbody>';

  recientes.forEach((p, idx) => {
    const totalPres = p.items.reduce((a, it) => {
      const db = typeof getBudgetItemPartida === 'function'
        ? getBudgetItemPartida(it, dbById)
        : dbById.get(it.pid);
      return a + (db ? pu(db) * it.qty : 0);
    }, 0);
    html += `
      <tr style="cursor:pointer" onclick="abrirPresupuestoGuardado(${idx})" onmouseover="this.querySelectorAll('td').forEach(td=>td.style.background='rgba(255,255,255,.02)')" onmouseout="this.querySelectorAll('td').forEach(td=>td.style.background='')">
        <td style="padding:8px 12px;font-size:13px;font-weight:600">${p.nombre || 'Sin nombre'}</td>
        <td style="padding:8px 12px;font-size:12px;color:var(--txt2)">${p.cliente || '-'}</td>
        <td style="padding:8px 12px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:var(--acento)">${p.nro || '-'}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--txt3)">${p.fecha || '-'}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--acento);font-family:'IBM Plex Mono',monospace">Gs. ${fmtN(totalPres)}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  document.getElementById('dash-recientes').innerHTML = html;
}
