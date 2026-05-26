function renderGuardados(){
  const el = document.getElementById('lista-guardados');
  const q = (document.getElementById('guardados-search')?.value || '').toLowerCase();
  const lista = q
    ? PRESUPUESTOS_GUARDADOS.filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.cliente || '').toLowerCase().includes(q) ||
        (p.nro || '').toLowerCase().includes(q)
      )
    : PRESUPUESTOS_GUARDADOS;

  if(!lista.length){
    el.innerHTML = `<div class="empty-state"><div class="icon">+</div><h3>Sin presupuestos guardados</h3><p>Clic en <strong style="color:var(--acento)">Guardar en archivo</strong> para archivar el presupuesto activo.</p></div>`;
    return;
  }

  let html = `<div class="tbl-wrap"><table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="padding:8px 12px;background:var(--bg2);font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">Nro.</th>
      <th style="padding:8px 12px;background:var(--bg2);font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">Proyecto</th>
      <th style="padding:8px 12px;background:var(--bg2);font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">Cliente</th>
      <th style="padding:8px 12px;background:var(--bg2);font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">Fecha</th>
      <th style="padding:8px 12px;background:var(--bg2);font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;text-align:right">Total Gs.</th>
      <th style="padding:8px 12px;background:var(--bg2);font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">Guardado por</th>
      <th style="padding:8px 12px;background:var(--bg2);width:180px;font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">Acciones</th>
    </tr></thead><tbody>`;

  lista.forEach(pres => {
    const realIdx = PRESUPUESTOS_GUARDADOS.indexOf(pres);
    const total = pres.items.reduce((a, it) => {
      const p = DB.find(x => x.id === it.pid);
      return a + (p ? pu(p) * it.qty : 0);
    }, 0);
    const esActivo = pres.id === presupuestoActivoGuardadoId;
    html += `
      <tr style="${esActivo ? 'background:rgba(29,186,123,.06);' : ''}">
        <td style="padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--acento)">${pres.nro || '-'}</td>
        <td style="padding:8px 12px;font-size:13px;font-weight:${esActivo ? 700 : 400}">
          ${pres.nombre || 'Sin nombre'}
          ${esActivo ? '<span style="background:var(--acento4);color:var(--acento);font-size:9px;padding:1px 7px;border-radius:99px;margin-left:6px;font-weight:700">Activo</span>' : ''}
        </td>
        <td style="padding:8px 12px;font-size:12px;color:var(--txt2)">${pres.cliente || '-'}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--txt3)">${pres.fecha || '-'}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--acento);font-family:'IBM Plex Mono',monospace;font-size:12px">Gs. ${fmtN(total)}</td>
        <td style="padding:8px 12px;font-size:10px;color:var(--txt3)">${pres.guardadoPor || '-'}</td>
        <td style="padding:8px 12px">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-primary btn-xs" onclick="abrirPresupuestoGuardado(${realIdx})">Abrir</button>
            <button class="btn btn-secondary btn-xs" onclick="duplicarPresupuesto(${realIdx})">Duplicar</button>
            <button class="btn btn-danger btn-xs" onclick="eliminarPresupuestoGuardado(${realIdx})">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

async function guardarPresupuestoActual(){
  if(!PRESUPUESTO.length){
    notif('El presupuesto activo esta vacio', '#E05555');
    return;
  }

  const nombre = document.getElementById('p-nombre').value || 'Sin nombre';
  if(!confirm(`Guardar el presupuesto "${nombre}"?\n\nDespues podras reabrirlo o duplicarlo.`)) return;

  let nro = document.getElementById('p-nro').value.trim();
  if(!nro){
    nro = generarNroAutoSilencioso();
    document.getElementById('p-nro').value = nro;
  }

  const nuevo = {
    id: 'pres_' + Date.now(),
    nombre: document.getElementById('p-nombre').value,
    cliente: document.getElementById('p-cliente').value,
    nro,
    fecha: document.getElementById('p-fecha').value,
    items: JSON.parse(JSON.stringify(PRESUPUESTO)),
    guardadoPor: currentUser?.email || '-',
    guardadoEl: new Date().toLocaleString('es-PY'),
    config: {
      pNombre: document.getElementById('p-nombre').value,
      pCliente: document.getElementById('p-cliente').value,
      pUbic: document.getElementById('p-ubic').value,
      pResp: document.getElementById('p-resp').value,
      pNro: nro,
      pFecha: document.getElementById('p-fecha').value,
      pctGi: document.getElementById('pct-gi').value,
      pctBi: document.getElementById('pct-bi').value,
      pctIva: document.getElementById('pct-iva').value,
    },
  };

  PRESUPUESTOS_GUARDADOS.unshift(nuevo);
  presupuestoActivoGuardadoId = null;
  PRESUPUESTO = [];

  ['p-nombre', 'p-cliente', 'p-ubic', 'p-resp', 'p-nro'].forEach(id => {
    const input = document.getElementById(id);
    if(input) input.value = '';
  });
  document.getElementById('p-fecha').value = new Date().toISOString().split('T')[0];

  _ignorarProximoSnapshotPres = Date.now() + 5000;
  await guardarFirebase();

  renderPres();
  renderBD();
  renderGuardados();
  setTimeout(() => renderDashboard(), 50);
  notif(`Presupuesto "${nuevo.nombre || 'Sin nombre'}" guardado y panel vaciado`);
}

function abrirPresupuestoGuardado(idx){
  const pres = PRESUPUESTOS_GUARDADOS[idx];
  if(!confirm(`Abrir "${pres.nombre}"?\n\nEsto reemplazara el presupuesto activo actual.`)) return;

  PRESUPUESTO = JSON.parse(JSON.stringify(pres.items));
  presupuestoActivoGuardadoId = pres.id;

  if(pres.config){
    ['pNombre', 'pCliente', 'pUbic', 'pResp', 'pNro', 'pFecha'].forEach(k => {
      const id = 'p-' + k.slice(1).toLowerCase();
      const el = document.getElementById(id);
      if(el && pres.config[k]) el.value = pres.config[k];
    });
    if(pres.config.pctGi) document.getElementById('pct-gi').value = pres.config.pctGi;
    if(pres.config.pctBi) document.getElementById('pct-bi').value = pres.config.pctBi;
    if(pres.config.pctIva) document.getElementById('pct-iva').value = pres.config.pctIva;
  }

  showTab('pres', getTabButton('pres'));
  renderPres();
  renderGuardados();
  renderDashboard();
  notif(`Presupuesto "${pres.nombre}" cargado`);
}

function duplicarPresupuesto(idx){
  const pres = PRESUPUESTOS_GUARDADOS[idx];
  const copia = JSON.parse(JSON.stringify(pres));
  copia.id = 'pres_' + Date.now();
  copia.nombre = (pres.nombre || 'Sin nombre') + ' (copia)';
  copia.guardadoPor = currentUser?.email || '-';
  copia.guardadoEl = new Date().toLocaleString('es-PY');
  if(copia.nro) copia.nro = copia.nro + '-COPIA';
  PRESUPUESTOS_GUARDADOS.splice(idx + 1, 0, copia);
  marcarUnsaved();
  renderGuardados();
  renderDashboard();
  notif('Presupuesto duplicado');
}

function eliminarPresupuestoGuardado(idx){
  const pres = PRESUPUESTOS_GUARDADOS[idx];
  const ok = prompt(`Para eliminar escribi el nombre exacto:\n\n"${pres.nombre}"\n\nNombre:`);
  if(ok === null) return;
  if(ok.trim() !== pres.nombre){
    notif('Nombre incorrecto. No se elimino.', '#E05555');
    return;
  }
  PRESUPUESTOS_GUARDADOS.splice(idx, 1);
  marcarUnsaved();
  renderGuardados();
  renderDashboard();
  notif('Presupuesto eliminado', '#E05555');
}
