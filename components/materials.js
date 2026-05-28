function materialTextKey(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function materialEscape(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMaterialQty(value){
  const n = parseFloat(value) || 0;
  const decimals = Math.abs(n) >= 100 ? 2 : 3;
  return n.toLocaleString('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function getMaterialInsumoData(insumo){
  const recurso = typeof getRecursoById === 'function' ? getRecursoById(insumo.resourceId) : null;
  return {
    id: recurso?.id || insumo.resourceId || '',
    desc: recurso?.desc || insumo.desc || 'Material sin descripcion',
    u: recurso?.u || insumo.u || 'un',
    pu: Math.round(parseFloat(insumo.pu) || parseFloat(recurso?.pu) || 0),
  };
}

function getMaterialCapAcc(map, capId, cap){
  if(!map.has(capId)){
    map.set(capId, {
      capId,
      capName: cap.name,
      color: cap.color,
      partidas: new Set(),
      lineas: 0,
      total: 0,
      totalSinApu: 0,
    });
  }
  return map.get(capId);
}

function buildMaterialesPresupuesto(){
  const detalle = [];
  const consolidadoMap = new Map();
  const capitulosMap = new Map();
  const sinApu = [];
  const partidasConMateriales = new Set();

  (PRESUPUESTO || []).forEach(item=>{
    const partida = DB.find(p=>p.id === item.pid);
    if(!partida) return;

    const cap = capOf(partida.cap);
    const qtyRubro = Math.max(0, parseFloat(item.qty) || 0);
    const apu = typeof getPartidaApu === 'function' ? getPartidaApu(partida.cod) : (APU[partidaKeyFromCode(partida.cod)] || []);
    const materiales = (apu || []).filter(insumo=>insumo && insumo.tipo === 'M');
    const capAcc = getMaterialCapAcc(capitulosMap, partida.cap, cap);

    if(!materiales.length){
      const totalDirecto = Math.round((parseFloat(partida.mat) || 0) * qtyRubro);
      if(totalDirecto > 0){
        capAcc.partidas.add(partida.id);
        capAcc.totalSinApu += totalDirecto;
        sinApu.push({
          capId: partida.cap,
          capName: cap.name,
          cod: partida.cod,
          desc: partida.desc,
          u: partida.u,
          qtyRubro,
          totalDirecto,
        });
      }
      return;
    }

    partidasConMateriales.add(partida.id);
    capAcc.partidas.add(partida.id);

    materiales.forEach(insumo=>{
      const material = getMaterialInsumoData(insumo);
      const qtyPorRubro = parseFloat(insumo.qty) || 0;
      const cantidadTotal = qtyPorRubro * qtyRubro;
      const total = cantidadTotal * material.pu;
      const line = {
        capId: partida.cap,
        capName: cap.name,
        capColor: cap.color,
        cod: partida.cod,
        desc: partida.desc,
        uRubro: partida.u,
        qtyRubro,
        material: material.desc,
        uMaterial: material.u,
        qtyPorRubro,
        cantidadTotal,
        pu: material.pu,
        total,
        resourceId: material.id,
      };

      detalle.push(line);
      capAcc.lineas += 1;
      capAcc.total += total;

      const key = `${material.id || materialTextKey(material.desc)}|${materialTextKey(material.u)}`;
      if(!consolidadoMap.has(key)){
        consolidadoMap.set(key, {
          material: material.desc,
          u: material.u,
          cantidadTotal: 0,
          total: 0,
          usos: 0,
          partidas: new Set(),
        });
      }
      const acc = consolidadoMap.get(key);
      acc.cantidadTotal += cantidadTotal;
      acc.total += total;
      acc.usos += 1;
      acc.partidas.add(partida.id);
    });
  });

  const porCapitulo = Array.from(capitulosMap.values())
    .map(item=>({
      ...item,
      partidasCount: item.partidas.size,
      total: Math.round(item.total),
      totalSinApu: Math.round(item.totalSinApu),
    }))
    .filter(item=>item.lineas || item.totalSinApu)
    .sort((a,b)=>String(a.capId).localeCompare(String(b.capId), 'es', { numeric: true }));

  const consolidado = Array.from(consolidadoMap.values())
    .map(item=>({
      material: item.material,
      u: item.u,
      cantidadTotal: item.cantidadTotal,
      total: Math.round(item.total),
      puPromedio: item.cantidadTotal ? item.total / item.cantidadTotal : 0,
      usos: item.usos,
      partidasCount: item.partidas.size,
    }))
    .sort((a,b)=>b.total - a.total || a.material.localeCompare(b.material, 'es', { numeric: true }));

  detalle.sort((a,b)=>
    String(a.capId).localeCompare(String(b.capId), 'es', { numeric: true }) ||
    String(a.cod).localeCompare(String(b.cod), 'es', { numeric: true }) ||
    a.material.localeCompare(b.material, 'es', { numeric: true })
  );

  const totalDetallado = Math.round(detalle.reduce((acc, item)=>acc + item.total, 0));
  const totalSinApu = Math.round(sinApu.reduce((acc, item)=>acc + item.totalDirecto, 0));

  return {
    detalle,
    consolidado,
    porCapitulo,
    sinApu,
    totalDetallado,
    totalSinApu,
    totalGeneral: totalDetallado + totalSinApu,
    partidasConMateriales: partidasConMateriales.size,
  };
}

function filtrarMaterialesLista(lista, q){
  if(!q) return lista;
  return lista.filter(item=>materialTextKey(Object.values(item).join(' ')).includes(q));
}

function renderMateriales(){
  const stats = document.getElementById('mat-stats');
  if(!stats) return;

  const data = buildMaterialesPresupuesto();
  const q = materialTextKey(document.getElementById('materiales-q')?.value || '');
  const detalleFiltrado = filtrarMaterialesLista(data.detalle, q);
  const consolidadoFiltrado = filtrarMaterialesLista(data.consolidado, q);

  stats.innerHTML = `
    <div class="stat-card"><div class="stat-card-label">Total materiales</div><div class="stat-card-value">${fmt(data.totalGeneral)}</div><div class="stat-card-sub">APU detallado + material directo sin desglose</div></div>
    <div class="stat-card"><div class="stat-card-label">Rubros con materiales</div><div class="stat-card-value">${data.partidasConMateriales}</div><div class="stat-card-sub">de ${(PRESUPUESTO || []).length} rubros en presupuesto</div></div>
    <div class="stat-card"><div class="stat-card-label">Materiales consolidados</div><div class="stat-card-value">${data.consolidado.length}</div><div class="stat-card-sub">sumados por material y unidad</div></div>
    <div class="stat-card"><div class="stat-card-label">Lineas detalladas</div><div class="stat-card-value">${data.detalle.length}</div><div class="stat-card-sub">insumos materiales usados</div></div>
  `;

  renderMaterialesAlert(data);
  renderMaterialesCapitulos(data.porCapitulo);
  renderMaterialesConsolidado(consolidadoFiltrado, q);
  renderMaterialesDetalle(detalleFiltrado, q);
}

function renderMaterialesAlert(data){
  const alert = document.getElementById('mat-alert');
  if(!alert) return;

  if(!(PRESUPUESTO || []).length){
    alert.innerHTML = '<div class="materials-note">El presupuesto activo no tiene rubros para calcular materiales.</div>';
    return;
  }

  if(data.sinApu.length){
    alert.innerHTML = `<div class="materials-note warning">${data.sinApu.length} rubro${data.sinApu.length === 1 ? '' : 's'} tienen importe de material sin APU detallado. Se suma el monto, pero no se puede descomponer en cantidades de insumos.</div>`;
    return;
  }

  alert.innerHTML = '<div class="materials-note ok">Todos los materiales de esta planilla salen del APU detallado del presupuesto activo.</div>';
}

function renderMaterialesCapitulos(capitulos){
  const tbody = document.getElementById('mat-caps-tbody');
  if(!tbody) return;

  if(!capitulos.length){
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state" style="padding:36px 0"><h3>Sin materiales</h3><p>No hay materiales detallados en el presupuesto activo.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = capitulos.map(item=>`
    <tr>
      <td>
        <span class="chip" style="background:${item.color}22;color:${item.color}">${materialEscape(item.capId)}</span>
        <span style="font-weight:700">${materialEscape(item.capName)}</span>
      </td>
      <td class="num">${fmtN(item.partidasCount)}</td>
      <td class="num">${fmtN(item.lineas)}</td>
      <td class="num" style="color:var(--acento);font-weight:800">${fmtN(item.total)}</td>
      <td class="num" style="color:${item.totalSinApu ? 'var(--naranja)' : 'var(--txt3)'}">${item.totalSinApu ? fmtN(item.totalSinApu) : '-'}</td>
    </tr>
  `).join('');
}

function renderMaterialesConsolidado(consolidado, q){
  const tbody = document.getElementById('mat-total-tbody');
  if(!tbody) return;

  if(!consolidado.length){
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:36px 0"><h3>Sin resultados</h3><p>${q ? 'No hay materiales que coincidan con la busqueda.' : 'No hay materiales para consolidar.'}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = consolidado.map(item=>`
    <tr>
      <td><div class="cell-description">${materialEscape(item.material)}</div><div class="cell-meta"><span class="chip chip-outline">${fmtN(item.usos)} uso${item.usos === 1 ? '' : 's'} APU</span></div></td>
      <td class="cell-unit">${materialEscape(item.u)}</td>
      <td class="num" style="font-weight:800;color:var(--txt)">${formatMaterialQty(item.cantidadTotal)}</td>
      <td class="num">${fmtN(item.puPromedio)}</td>
      <td class="num" style="color:var(--acento);font-weight:800">${fmtN(item.total)}</td>
      <td class="num">${fmtN(item.partidasCount)}</td>
    </tr>
  `).join('');
}

function renderMaterialesDetalle(detalle, q){
  const tbody = document.getElementById('mat-detalle-tbody');
  if(!tbody) return;

  if(!detalle.length){
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state" style="padding:44px 0"><h3>Sin detalle</h3><p>${q ? 'No hay rubros o materiales que coincidan con la busqueda.' : 'El presupuesto activo no tiene materiales detallados en APU.'}</p></div></td></tr>`;
    return;
  }

  let html = '';
  let capActual = null;
  detalle.forEach(item=>{
    if(item.capId !== capActual){
      capActual = item.capId;
      html += `
        <tr class="cap-row" style="border-left-color:${item.capColor}">
          <td colspan="10" style="background:${item.capColor}CC">${materialEscape(item.capId)} - ${materialEscape(item.capName)}</td>
        </tr>
      `;
    }
    html += `
      <tr>
        <td><code class="cell-code">${materialEscape(item.cod)}</code></td>
        <td><div class="cell-description">${materialEscape(item.desc)}</div></td>
        <td class="cell-unit">${materialEscape(item.uRubro)}</td>
        <td class="num">${formatMaterialQty(item.qtyRubro)}</td>
        <td><div class="cell-description">${materialEscape(item.material)}</div>${item.resourceId ? '<div class="cell-meta"><span class="chip chip-success">maestro</span></div>' : ''}</td>
        <td class="cell-unit">${materialEscape(item.uMaterial)}</td>
        <td class="num">${formatMaterialQty(item.qtyPorRubro)}</td>
        <td class="num" style="font-weight:800;color:var(--txt)">${formatMaterialQty(item.cantidadTotal)}</td>
        <td class="num">${fmtN(item.pu)}</td>
        <td class="num" style="color:var(--acento);font-weight:800">${fmtN(item.total)}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function limpiarBusquedaMateriales(){
  const input = document.getElementById('materiales-q');
  if(input) input.value = '';
  renderMateriales();
}

function appendMaterialesSheets(wb){
  const data = buildMaterialesPresupuesto();
  const info = [
    ['PLANILLA DETALLADA DE MATERIALES'],
    ['Proyecto', document.getElementById('p-nombre')?.value || ''],
    ['Cliente', document.getElementById('p-cliente')?.value || ''],
    ['Nro. Presupuesto', document.getElementById('p-nro')?.value || ''],
    ['Fecha', document.getElementById('p-fecha')?.value || ''],
    [],
  ];

  const detalle = [
    ...info,
    ['Capitulo', 'Cod. rubro', 'Rubro', 'Ud. rubro', 'Cant. rubro', 'Material', 'Ud. material', 'Cant./rubro', 'Cantidad total', 'Precio unitario', 'Total'],
    ...data.detalle.map(item=>[
      `${item.capId} - ${item.capName}`,
      item.cod,
      item.desc,
      item.uRubro,
      item.qtyRubro,
      item.material,
      item.uMaterial,
      item.qtyPorRubro,
      item.cantidadTotal,
      item.pu,
      Math.round(item.total),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detalle), 'Detalle Materiales');

  const consolidado = [
    ...info,
    ['Material', 'Unidad', 'Cantidad total', 'Precio ref.', 'Total', 'Usos APU', 'Rubros'],
    ...data.consolidado.map(item=>[
      item.material,
      item.u,
      item.cantidadTotal,
      Math.round(item.puPromedio),
      item.total,
      item.usos,
      item.partidasCount,
    ]),
    [],
    ['TOTAL MATERIALES DETALLADOS', '', '', '', data.totalDetallado, '', ''],
    ['MATERIAL DIRECTO SIN APU', '', '', '', data.totalSinApu, '', ''],
    ['TOTAL GENERAL MATERIALES', '', '', '', data.totalGeneral, '', ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(consolidado), 'Total Materiales');

  if(data.sinApu.length){
    const pendientes = [
      ...info,
      ['Capitulo', 'Cod. rubro', 'Rubro', 'Ud.', 'Cant. rubro', 'Material directo sin APU'],
      ...data.sinApu.map(item=>[
        `${item.capId} - ${item.capName}`,
        item.cod,
        item.desc,
        item.u,
        item.qtyRubro,
        item.totalDirecto,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pendientes), 'Material Sin APU');
  }

  return data;
}

function exportarMaterialesExcel(){
  if(typeof XLSX === 'undefined'){
    notif('No se pudo cargar el modulo Excel', '#E05555');
    return;
  }

  const data = buildMaterialesPresupuesto();
  if(!data.detalle.length && !data.sinApu.length){
    notif('No hay materiales para exportar', '#E05555');
    return;
  }

  const wb = XLSX.utils.book_new();
  appendMaterialesSheets(wb);
  const nro = (document.getElementById('p-nro')?.value || 'Presupuesto')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Presupuesto';
  XLSX.writeFile(wb, `Planilla_Materiales_${nro}_${new Date().toISOString().slice(0,10)}.xlsx`);
  notif('Planilla de materiales exportada');
}
