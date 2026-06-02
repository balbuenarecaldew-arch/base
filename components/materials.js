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

let _materialesRenderTimer = null;
let _materialesDirty = true;

function isMaterialesActive(){
  return document.getElementById('tab-materiales')?.classList.contains('active');
}

function requestRenderMateriales(delay = 160){
  _materialesDirty = true;
  if(!isMaterialesActive()) return;
  clearTimeout(_materialesRenderTimer);
  _materialesRenderTimer = setTimeout(()=>renderMateriales(true), delay);
}

function getMaterialesRecursoMap(){
  const map = new Map();
  Object.values(CATALOGOS || {}).forEach(lista=>{
    if(!Array.isArray(lista)) return;
    lista.forEach(recurso=>{
      if(recurso?.id) map.set(recurso.id, recurso);
    });
  });
  return map;
}

function getMaterialInsumoData(insumo, recursosById){
  const recurso = recursosById?.get(insumo.resourceId) || null;
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
  const recursosById = getMaterialesRecursoMap();

  const items = typeof getPresupuestoResolvedItems === 'function'
    ? getPresupuestoResolvedItems()
    : (PRESUPUESTO || []).map(item=>({
        item,
        p: new Map((DB || []).map(partida=>[partida.id, partida])).get(item.pid),
      })).filter(entry=>entry.p);

  items.forEach(({ item, p: partida }, itemIndex)=>{
    if(!partida) return;

    const cap = capOf(partida.cap);
    const qtyRubro = Math.max(0, parseFloat(item.qty) || 0);
    const puedeUsarApuBase = !partida._budgetOnly && !partida._budgetCostEdited;
    const apuCod = partida.sourceCod || partida.cod;
    const apu = puedeUsarApuBase
      ? (typeof getPartidaApu === 'function' ? getPartidaApu(apuCod) : (APU[partidaKeyFromCode(apuCod)] || []))
      : [];
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
      const material = getMaterialInsumoData(insumo, recursosById);
      const qtyPorRubro = parseFloat(insumo.qty) || 0;
      const cantidadTotal = qtyPorRubro * qtyRubro;
      const total = cantidadTotal * material.pu;
      const line = {
        itemIndex,
        itemNo: itemIndex + 1,
        budgetPid: item.pid,
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

function renderMateriales(force = false){
  const stats = document.getElementById('mat-stats');
  if(!stats) return;
  if(!force && !isMaterialesActive()){
    _materialesDirty = true;
    return;
  }
  _materialesDirty = false;

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
  renderMaterialesMatriz(data, q);
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

function renderMaterialesMatriz(data, q){
  const host = document.getElementById('mat-matriz');
  if(!host) return;

  const matrix = buildMaterialesMatrix(data);
  if(!matrix.materiales.length || !matrix.rubros.length){
    host.innerHTML = '<div class="empty-state" style="padding:44px 0"><h3>Sin cuadro</h3><p>No hay materiales detallados en APU para cruzar con rubros.</p></div>';
    return;
  }

  const rubroMatches = new Set();
  if(q){
    matrix.rubros.forEach(rubro=>{
      const text = materialTextKey(`${rubro.cod} ${rubro.desc} ${rubro.capId} ${rubro.capName}`);
      if(text.includes(q)) rubroMatches.add(rubro.key);
    });
  }

  const materiales = q
    ? matrix.materiales.filter(material=>{
        const materialMatch = materialTextKey(`${material.material} ${material.u}`).includes(q);
        if(materialMatch) return true;
        return matrix.rubros.some(rubro=>rubroMatches.has(rubro.key) && (matrix.qtyMap.get(`${material.key}::${rubro.key}`) || 0));
      })
    : matrix.materiales;

  if(!materiales.length){
    host.innerHTML = '<div class="empty-state" style="padding:44px 0"><h3>Sin resultados</h3><p>No hay insumos o rubros que coincidan con la busqueda.</p></div>';
    return;
  }

  const minWidth = Math.max(980, 420 + matrix.rubros.length * 160);
  host.innerHTML = `
    <table class="data-table material-matrix-table" style="min-width:${minWidth}px">
      <thead>
        <tr>
          <th class="matrix-sticky matrix-material-col">Material / Insumo</th>
          <th class="matrix-sticky matrix-unit-col">Ud.</th>
          ${matrix.rubros.map(rubro=>`
            <th class="matrix-rubro-col" title="${materialEscape(`${rubro.cod} - ${rubro.desc}`)}">
              <div class="matrix-rubro-code">${materialEscape(rubro.cod)}</div>
              <div class="matrix-rubro-desc">${materialEscape(rubro.desc)}</div>
            </th>
          `).join('')}
          <th class="num matrix-total-col">Cantidad total</th>
        </tr>
      </thead>
      <tbody>
        ${materiales.map(material=>{
          const qtyCells = matrix.rubros.map(rubro=>{
            const qty = matrix.qtyMap.get(`${material.key}::${rubro.key}`) || 0;
            return `<td class="num matrix-qty-cell ${qty ? '' : 'matrix-empty-cell'}">${qty ? formatMaterialQty(qty) : ''}</td>`;
          }).join('');
          return `
            <tr>
              <td class="matrix-sticky matrix-material-col"><div class="cell-description">${materialEscape(material.material)}</div></td>
              <td class="matrix-sticky matrix-unit-col cell-unit">${materialEscape(material.u)}</td>
              ${qtyCells}
              <td class="num matrix-total-cell">${formatMaterialQty(material.totalQty)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
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
  renderMateriales(true);
}

function formatMaterialSheetRange(ws, range, format){
  if(!XLSX?.utils?.decode_range) return;
  const ref = XLSX.utils.decode_range(range);
  for(let r = ref.s.r; r <= ref.e.r; r++){
    for(let c = ref.s.c; c <= ref.e.c; c++){
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if(cell && cell.t === 'n') cell.z = format;
    }
  }
}

function layoutMaterialSheet(ws, options = {}){
  ws['!margins'] = { left: 0.35, right: 0.35, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.2 };
  if(options.filter) ws['!autofilter'] = { ref: options.filter };
  if(options.freezeRows || options.freezeCols){
    const view = { state: 'frozen' };
    if(options.freezeRows) view.ySplit = options.freezeRows;
    if(options.freezeCols) view.xSplit = options.freezeCols;
    ws['!views'] = [view];
  }
  if(options.rowHeights){
    ws['!rows'] = ws['!rows'] || [];
    Object.entries(options.rowHeights).forEach(([idx, hpt])=>{
      ws['!rows'][Number(idx)] = { hpt };
    });
  }
}

function getMaterialesExportInfo(title){
  return [
    [title],
    ['Proyecto', document.getElementById('p-nombre')?.value || ''],
    ['Cliente', document.getElementById('p-cliente')?.value || ''],
    ['Nro. Presupuesto', document.getElementById('p-nro')?.value || ''],
    ['Fecha', document.getElementById('p-fecha')?.value || ''],
    [],
  ];
}

function materialExcelCol(colIndex){
  if(XLSX?.utils?.encode_col) return XLSX.utils.encode_col(colIndex);
  let col = '';
  let n = colIndex + 1;
  while(n > 0){
    const mod = (n - 1) % 26;
    col = String.fromCharCode(65 + mod) + col;
    n = Math.floor((n - mod) / 26);
  }
  return col;
}

function setMaterialFormulaCell(ws, rowIndex, colIndex, formula, value = 0){
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  ws[addr] = { t: 'n', f: formula, v: value };
}

function materialQtyValue(value){
  const n = parseFloat(value) || 0;
  return Math.round(n * 1000000) / 1000000;
}

function buildMaterialesMatrix(data){
  const rubrosMap = new Map();
  const materialesMap = new Map();
  const qtyMap = new Map();

  data.detalle.forEach(line=>{
    const rubroKey = `${line.itemIndex ?? ''}|${line.capId}|${line.cod}|${line.desc}`;
    if(!rubrosMap.has(rubroKey)){
      rubrosMap.set(rubroKey, {
        key: rubroKey,
        itemNo: line.itemNo || rubrosMap.size + 1,
        capId: line.capId,
        capName: line.capName,
        cod: line.cod,
        desc: line.desc,
        u: line.uRubro,
        qtyRubro: line.qtyRubro,
      });
    }

    const materialKey = `${line.resourceId || materialTextKey(line.material)}|${materialTextKey(line.uMaterial)}`;
    if(!materialesMap.has(materialKey)){
      materialesMap.set(materialKey, {
        key: materialKey,
        material: line.material,
        u: line.uMaterial,
        pu: Math.round(parseFloat(line.pu) || 0),
        totalQty: 0,
        totalCost: 0,
      });
    }
    const material = materialesMap.get(materialKey);
    material.totalQty += parseFloat(line.cantidadTotal) || 0;
    material.totalCost += parseFloat(line.total) || 0;
    if(!material.pu && line.pu) material.pu = Math.round(parseFloat(line.pu) || 0);

    const matrixKey = `${materialKey}::${rubroKey}`;
    qtyMap.set(matrixKey, (qtyMap.get(matrixKey) || 0) + (parseFloat(line.cantidadTotal) || 0));
  });

  const rubros = Array.from(rubrosMap.values())
    .sort((a,b)=>
      String(a.capId).localeCompare(String(b.capId), 'es', { numeric: true }) ||
      String(a.cod).localeCompare(String(b.cod), 'es', { numeric: true }) ||
      a.itemNo - b.itemNo
    );
  const materiales = Array.from(materialesMap.values())
    .map(item=>({
      ...item,
      totalQty: materialQtyValue(item.totalQty),
      totalCost: Math.round(item.totalCost),
      puPromedio: item.totalQty ? Math.round(item.totalCost / item.totalQty) : item.pu,
    }))
    .sort((a,b)=>b.totalCost - a.totalCost || a.material.localeCompare(b.material, 'es', { numeric: true }));

  return { rubros, materiales, qtyMap };
}

function appendPedidoMaterialesMatrixSheet(wb, data){
  const matrix = buildMaterialesMatrix(data);
  if(!matrix.materiales.length || !matrix.rubros.length) return false;

  const firstRubroCol = 2;
  const info = getMaterialesExportInfo('CUADRO DE MATERIALES POR RUBRO');
  const headerRow = info.length;
  const firstDataRow = headerRow + 1;
  const lastDataRow = firstDataRow + matrix.materiales.length - 1;
  const lastRubroCol = firstRubroCol + matrix.rubros.length - 1;
  const totalCol = lastRubroCol + 1;
  const firstRubroColName = materialExcelCol(firstRubroCol);
  const lastRubroColName = materialExcelCol(lastRubroCol);
  const totalColName = materialExcelCol(totalCol);

  const rows = [
    ...info,
    ['Material / Insumo', 'Ud.', ...matrix.rubros.map(r=>`${r.cod} ${r.desc}`), 'Cantidad total'],
    ...matrix.materiales.map(material=>[
      material.material,
      material.u,
      ...matrix.rubros.map(r=>materialQtyValue(matrix.qtyMap.get(`${material.key}::${r.key}`) || 0) || null),
      material.totalQty,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  matrix.materiales.forEach((material, idx)=>{
    const rowIndex = firstDataRow + idx;
    const excelRow = rowIndex + 1;
    setMaterialFormulaCell(ws, rowIndex, totalCol, `SUM(${firstRubroColName}${excelRow}:${lastRubroColName}${excelRow})`, material.totalQty);
  });

  ws['!cols'] = [
    {wch:44},
    {wch:10},
    ...matrix.rubros.map(()=>({wch:18})),
    {wch:16},
  ];
  formatMaterialSheetRange(ws, `${firstRubroColName}${firstDataRow + 1}:${totalColName}${lastDataRow + 1}`, '#,##0.000');
  layoutMaterialSheet(ws, {
    filter: `A${headerRow + 1}:${totalColName}${lastDataRow + 1}`,
    freezeRows: headerRow + 1,
    freezeCols: 2,
    rowHeights: { 0: 24, [headerRow]: 42 },
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Cuadro Materiales');
  return true;
}

function appendRubroInsumoMatrixSheet(wb, data){
  const matrix = buildMaterialesMatrix(data);
  if(!matrix.materiales.length || !matrix.rubros.length) return false;

  const firstMaterialCol = 7;
  const info = getMaterialesExportInfo('MATRIZ RUBRO x INSUMO - CANTIDADES');
  const unitRow = info.length;
  const priceRow = unitRow + 1;
  const headerRow = priceRow + 1;
  const firstDataRow = headerRow + 1;
  const lastDataRow = firstDataRow + matrix.rubros.length - 1;
  const totalRow = lastDataRow + 1;
  const lastMaterialCol = firstMaterialCol + matrix.materiales.length - 1;
  const lastCol = materialExcelCol(lastMaterialCol);

  const rows = [
    ...info,
    ['', '', '', '', '', '', 'Unidad', ...matrix.materiales.map(material=>material.u)],
    ['', '', '', '', '', '', 'Precio ref. Gs.', ...matrix.materiales.map(material=>material.puPromedio || material.pu)],
    ['Item', 'Capitulo', 'Codigo', 'Rubro', 'Ud.', 'Cant. rubro', 'Total materiales Gs.', ...matrix.materiales.map(material=>material.material)],
    ...matrix.rubros.map(rubro=>[
      rubro.itemNo,
      `${rubro.capId} - ${rubro.capName}`,
      rubro.cod,
      rubro.desc,
      rubro.u,
      rubro.qtyRubro,
      0,
      ...matrix.materiales.map(material=>materialQtyValue(matrix.qtyMap.get(`${material.key}::${rubro.key}`) || 0) || null),
    ]),
    ['TOTAL', '', '', 'TOTAL CANTIDADES', '', '', 0, ...matrix.materiales.map(()=>0)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  matrix.rubros.forEach((rubro, idx)=>{
    const rowIndex = firstDataRow + idx;
    const excelRow = rowIndex + 1;
    const value = matrix.materiales.reduce((acc, material)=>{
      const qty = matrix.qtyMap.get(`${material.key}::${rubro.key}`) || 0;
      return acc + qty * (material.puPromedio || material.pu || 0);
    }, 0);
    setMaterialFormulaCell(
      ws,
      rowIndex,
      6,
      `SUMPRODUCT(H${excelRow}:${lastCol}${excelRow},$H$${priceRow + 1}:$${lastCol}$${priceRow + 1})`,
      Math.round(value)
    );
  });

  matrix.materiales.forEach((material, idx)=>{
    const colIndex = firstMaterialCol + idx;
    const col = materialExcelCol(colIndex);
    setMaterialFormulaCell(
      ws,
      totalRow,
      colIndex,
      `SUM(${col}${firstDataRow + 1}:${col}${lastDataRow + 1})`,
      material.totalQty
    );
  });
  setMaterialFormulaCell(ws, totalRow, 6, `SUM(G${firstDataRow + 1}:G${lastDataRow + 1})`, Math.round(data.totalDetallado));

  ws['!cols'] = [
    {wch:8},
    {wch:30},
    {wch:13},
    {wch:48},
    {wch:9},
    {wch:12},
    {wch:18},
    ...matrix.materiales.map(()=>({wch:18})),
  ];
  formatMaterialSheetRange(ws, `F${firstDataRow + 1}:G${totalRow + 1}`, '#,##0');
  formatMaterialSheetRange(ws, `H${priceRow + 1}:${lastCol}${priceRow + 1}`, '#,##0');
  formatMaterialSheetRange(ws, `H${firstDataRow + 1}:${lastCol}${totalRow + 1}`, '#,##0.000');
  layoutMaterialSheet(ws, {
    filter: `A${headerRow + 1}:${lastCol}${lastDataRow + 1}`,
    freezeRows: headerRow + 1,
    freezeCols: 7,
    rowHeights: { 0: 24, [headerRow]: 42, [totalRow]: 22 },
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Rubro x Insumo');
  return true;
}

function appendMaterialesSheets(wb){
  const data = buildMaterialesPresupuesto();
  const info = getMaterialesExportInfo('PLANILLA DETALLADA DE MATERIALES');

  appendPedidoMaterialesMatrixSheet(wb, data);

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
  const wsDetalle = XLSX.utils.aoa_to_sheet(detalle);
  wsDetalle['!cols'] = [
    {wch:34},{wch:13},{wch:48},{wch:10},{wch:13},{wch:44},
    {wch:12},{wch:14},{wch:16},{wch:16},{wch:18},
  ];
  if(detalle.length > info.length + 1){
    const last = detalle.length;
    formatMaterialSheetRange(wsDetalle, `E8:E${last}`, '#,##0.000');
    formatMaterialSheetRange(wsDetalle, `H8:I${last}`, '#,##0.000');
    formatMaterialSheetRange(wsDetalle, `J8:K${last}`, '#,##0');
    layoutMaterialSheet(wsDetalle, { filter: `A7:K${last}`, freezeRows: 7, rowHeights: { 0: 24 } });
  }
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Materiales');

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
  const wsConsolidado = XLSX.utils.aoa_to_sheet(consolidado);
  wsConsolidado['!cols'] = [{wch:50},{wch:12},{wch:18},{wch:16},{wch:18},{wch:12},{wch:12}];
  if(consolidado.length > info.length + 1){
    const last = consolidado.length;
    formatMaterialSheetRange(wsConsolidado, `C8:C${last}`, '#,##0.000');
    formatMaterialSheetRange(wsConsolidado, `D8:E${last}`, '#,##0');
    layoutMaterialSheet(wsConsolidado, { filter: `A7:G${Math.max(7, data.consolidado.length + 7)}`, freezeRows: 7, rowHeights: { 0: 24 } });
  }
  XLSX.utils.book_append_sheet(wb, wsConsolidado, 'Total Materiales');

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
    const wsPendientes = XLSX.utils.aoa_to_sheet(pendientes);
    wsPendientes['!cols'] = [{wch:34},{wch:13},{wch:54},{wch:10},{wch:14},{wch:20}];
    const last = pendientes.length;
    formatMaterialSheetRange(wsPendientes, `E8:F${last}`, '#,##0');
    layoutMaterialSheet(wsPendientes, { filter: `A7:F${last}`, freezeRows: 7, rowHeights: { 0: 24 } });
    XLSX.utils.book_append_sheet(wb, wsPendientes, 'Material Sin APU');
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
