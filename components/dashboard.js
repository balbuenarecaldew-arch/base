function ensureDashboardCanvas(canvasId, fallbackMessage){
  let canvas = document.getElementById(canvasId);
  if(canvas) return canvas;

  if(canvasId === 'chart-caps'){
    const host = document.querySelector('#tab-dashboard .card:nth-of-type(1) .chart-wrap');
    if(host){
      host.innerHTML = `<canvas id="chart-caps"></canvas>`;
      return document.getElementById('chart-caps');
    }
  }

  if(canvasId === 'chart-tipos'){
    const host = document.querySelector('#tab-dashboard .card:nth-of-type(2) .chart-wrap');
    if(host){
      host.innerHTML = `<canvas id="chart-tipos"></canvas>`;
      return document.getElementById('chart-tipos');
    }
  }

  console.warn(fallbackMessage);
  return null;
}

function renderDashboard(){
  const gi = parseFloat(document.getElementById('pct-gi')?.value || '13') || 13;
  const bi = parseFloat(document.getElementById('pct-bi')?.value || '6') || 6;
  const iva = parseFloat(document.getElementById('pct-iva')?.value || '10') || 10;
  const cd = cdTotal();
  const factor = (1 + gi / 100) * (1 + bi / 100) * (1 + iva / 100);
  const total = Math.round(cd * factor);

  document.getElementById('dash-stats').innerHTML = `
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

  const byCap = {};
  PRESUPUESTO.forEach(it => {
    const p = DB.find(x => x.id === it.pid);
    if(!p) return;
    if(!byCap[p.cap]) byCap[p.cap] = 0;
    byCap[p.cap] += pu(p) * it.qty;
  });

  const capKeys = Object.keys(byCap).sort();
  const capLabels = capKeys.map(k => {
    const n = capOf(k).name;
    return n.length > 22 ? `${n.substring(0, 21)}...` : n;
  });
  const capData = capKeys.map(k => Math.round(byCap[k]));
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
              backgroundColor: capColors.map(c => c + 'BB'),
              borderColor: capColors,
              borderWidth: 1,
              borderRadius: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => `Gs. ${Math.round(ctx.raw).toLocaleString('es-PY')}`,
                },
              },
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8aa7be', font: { size: 10 } } },
              y: {
                grid: { color: 'rgba(255,255,255,.05)' },
                ticks: {
                  color: '#8aa7be',
                  font: { size: 10 },
                  callback: v => `Gs. ${Math.round(v / 1000).toLocaleString('es-PY')}k`,
                },
              },
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

  const matT = PRESUPUESTO.reduce((a, it) => {
    const p = DB.find(x => x.id === it.pid);
    return a + (p ? p.mat * it.qty : 0);
  }, 0);
  const moT = PRESUPUESTO.reduce((a, it) => {
    const p = DB.find(x => x.id === it.pid);
    return a + (p ? p.mo * it.qty : 0);
  }, 0);
  const eqT = PRESUPUESTO.reduce((a, it) => {
    const p = DB.find(x => x.id === it.pid);
    return a + (p ? p.eq * it.qty : 0);
  }, 0);
  const subT = PRESUPUESTO.reduce((a, it) => {
    const p = DB.find(x => x.id === it.pid);
    return a + (p ? p.sub * it.qty : 0);
  }, 0);

  const ctxTipos = ensureDashboardCanvas('chart-tipos', 'chart-tipos host not found');
  if(ctxTipos){
    if(dashCharts.tipos){
      try { dashCharts.tipos.destroy(); } catch (e) {}
    }
    const tiposData = [Math.round(matT), Math.round(moT), Math.round(eqT), Math.round(subT)].filter(v => v > 0);
    const tiposLabels = ['Materiales', 'Mano de Obra', 'Equipo', 'Subcontrato'].filter((_, i) => [matT, moT, eqT, subT][i] > 0);
    const tiposColors = ['#77c8ff', '#5ec8ff', '#D4B820', '#E89020'].filter((_, i) => [matT, moT, eqT, subT][i] > 0);
    if(tiposData.length){
      try{
        dashCharts.tipos = new Chart(ctxTipos, {
          type: 'doughnut',
          data: {
            labels: tiposLabels,
            datasets: [{
              data: tiposData,
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
                  label: ctx => `${ctx.label}: Gs. ${Math.round(ctx.raw).toLocaleString('es-PY')} (${((ctx.raw / (matT + moT + eqT + subT)) * 100).toFixed(1)}%)`,
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
      const db = DB.find(x => x.id === it.pid);
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
