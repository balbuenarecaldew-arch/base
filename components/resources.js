const RECURSO_TIPOS = {
  M: { label: 'Insumos', singular: 'Insumo' },
  L: { label: 'MDO', singular: 'Mano de obra' },
  E: { label: 'Equipos', singular: 'Equipo' },
  S: { label: 'Subcontratos', singular: 'Subcontrato' },
};

let recursoTipoActivo = 'M';
let editRecursoId = null;

function catalogosShape(catalogos){
  const base = { M: [], L: [], E: [], S: [] };
  Object.keys(base).forEach(tipo=>{
    base[tipo] = Array.isArray(catalogos?.[tipo]) ? catalogos[tipo] : [];
  });
  return base;
}

function normalizarCatalogos(){
  CATALOGOS = catalogosShape(CATALOGOS);
  Object.keys(CATALOGOS).forEach(tipo=>{
    CATALOGOS[tipo] = CATALOGOS[tipo]
      .filter(item=>item && item.desc)
      .map(item=>({
        id: item.id || nextRecursoId(tipo),
        tipo: item.tipo || tipo,
        desc: typeof sanitizeAppText === 'function' ? sanitizeAppText(item.desc) : item.desc,
        u: typeof sanitizeAppText === 'function' ? sanitizeAppText(item.u || 'un') : (item.u || 'un'),
        pu: Math.round(parseFloat(item.pu) || 0),
        categoria: typeof sanitizeAppText === 'function' ? sanitizeAppText(item.categoria || '') : (item.categoria || ''),
        grupo: typeof sanitizeAppText === 'function' ? sanitizeAppText(item.grupo || '') : (item.grupo || ''),
      }));
  });
}

function recursoKey(tipo, desc, unidad){
  return `${normalizeExcelKey(tipo || 'M')}|${normalizeExcelKey(unidad || 'un')}|${normalizeExcelKey(desc || '')}`;
}

function getRecursos(tipo){
  normalizarCatalogos();
  return CATALOGOS[tipo] || [];
}

function getAllRecursos(){
  normalizarCatalogos();
  return Object.values(CATALOGOS).flat();
}

function getRecursoById(id){
  if(!id) return null;
  return getAllRecursos().find(item=>item.id === id) || null;
}

function findRecursoByData(tipo, desc, unidad){
  const key = recursoKey(tipo, desc, unidad);
  return getRecursos(tipo).find(item=>recursoKey(item.tipo, item.desc, item.u) === key) || null;
}

function nextRecursoId(tipo){
  const prefix = `${tipo || 'R'}-`;
  const source = Object.values(catalogosShape(CATALOGOS)).flat();
  const max = source
    .map(item=>String(item.id || ''))
    .filter(id=>id.startsWith(prefix))
    .map(id=>parseInt(id.slice(prefix.length), 10))
    .filter(Number.isFinite)
    .reduce((acc, value)=>Math.max(acc, value), 0);
  return `${prefix}${String(max + 1).padStart(5, '0')}`;
}

function ensureRecursoParaInsumo(insumo, usarPrecioMaestro){
  if(!insumo || !normalizeExcelText(insumo.desc)) return null;
  normalizarCatalogos();

  const tipo = insumo.tipo || 'M';
  let recurso = getRecursoById(insumo.resourceId);
  if(!recurso || recurso.tipo !== tipo){
    recurso = findRecursoByData(tipo, insumo.desc, insumo.u);
  }

  if(!recurso){
    recurso = {
      id: nextRecursoId(tipo),
      tipo,
      desc: normalizeExcelText(insumo.desc),
      u: normalizeExcelText(insumo.u || 'un') || 'un',
      pu: Math.round(parseFloat(insumo.pu) || 0),
      categoria: '',
      grupo: '',
    };
    CATALOGOS[tipo].push(recurso);
  }

  insumo.resourceId = recurso.id;
  if(usarPrecioMaestro) insumo.pu = recurso.pu;
  return recurso;
}

function sincronizarCatalogosConApu(renderizar = true){
  normalizarCatalogos();
  Object.values(APU || {}).forEach(insumos=>{
    if(!Array.isArray(insumos)) return;
    insumos.forEach(insumo=>ensureRecursoParaInsumo(insumo, false));
  });
  if(renderizar) renderRecursos();
}

function recalcularPartidasPorCodKeys(codKeys){
  (codKeys || new Set()).forEach(codKey=>{
    const partida = DB.find(item=>partidaKeyFromCode(item.cod) === codKey);
    if(partida) recalcDesdeAPU(partida.cod);
  });
}

function aplicarRecursoAInsumos(recurso, oldKey){
  if(!recurso) return 0;
  const newKey = recursoKey(recurso.tipo, recurso.desc, recurso.u);
  const touchedCods = new Set();
  let cambios = 0;

  Object.entries(APU || {}).forEach(([codKey, insumos])=>{
    if(!Array.isArray(insumos)) return;
    insumos.forEach(insumo=>{
      const itemKey = recursoKey(insumo.tipo, insumo.desc, insumo.u);
      const coincide = insumo.resourceId === recurso.id || itemKey === newKey || (oldKey && itemKey === oldKey);
      if(!coincide) return;

      insumo.resourceId = recurso.id;
      insumo.tipo = recurso.tipo;
      insumo.desc = recurso.desc;
      insumo.u = recurso.u;
      insumo.pu = Math.round(parseFloat(recurso.pu) || 0);
      touchedCods.add(codKey);
      cambios++;
    });
  });

  recalcularPartidasPorCodKeys(touchedCods);
  return cambios;
}

function contarUsoRecurso(recurso){
  if(!recurso) return 0;
  const key = recursoKey(recurso.tipo, recurso.desc, recurso.u);
  let count = 0;
  Object.values(APU || {}).forEach(insumos=>{
    if(!Array.isArray(insumos)) return;
    insumos.forEach(insumo=>{
      if(insumo.resourceId === recurso.id || recursoKey(insumo.tipo, insumo.desc, insumo.u) === key) count++;
    });
  });
  return count;
}

function setRecursoTipo(tipo){
  recursoTipoActivo = tipo || 'M';
  renderRecursos();
}

function limpiarBusquedaRecursos(){
  const input = document.getElementById('recursos-q');
  if(input) input.value = '';
  renderRecursos();
}

function renderRecursos(){
  const tbody = document.getElementById('recursos-tbody');
  if(!tbody) return;

  sincronizarCatalogosConApu(false);
  const q = normalizeExcelKey(document.getElementById('recursos-q')?.value || '');
  const recursos = getRecursos(recursoTipoActivo)
    .filter(item=>{
      const text = normalizeExcelKey(`${item.desc} ${item.u} ${item.categoria} ${item.grupo}`);
      return !q || text.includes(q);
    })
    .sort((a,b)=>a.desc.localeCompare(b.desc, 'es', { numeric: true }));

  document.querySelectorAll('.resource-type-btn').forEach(btn=>{
    btn.classList.toggle('activo', btn.dataset.tipo === recursoTipoActivo);
  });

  const stats = document.getElementById('recursos-stats');
  if(stats){
    const total = getAllRecursos().length;
    const tipoCounts = Object.keys(RECURSO_TIPOS)
      .map(tipo=>`${RECURSO_TIPOS[tipo].label}: ${getRecursos(tipo).length}`)
      .join(' | ');
    stats.textContent = `${total} recursos maestros | ${tipoCounts}`;
  }

  if(!recursos.length){
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state" style="padding:40px 0">
            <h3>Sin recursos</h3>
            <p>Agrega un recurso o sincroniza desde los APUs para poblar esta lista.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recursos.map(recurso=>{
    const uso = contarUsoRecurso(recurso);
    const meta = RECURSO_TIPOS[recurso.tipo] || RECURSO_TIPOS.M;
    return `
      <tr>
        <td><span class="bdg bdg-${recurso.tipo}">${meta.label}</span></td>
        <td>
          <div class="cell-description" style="font-size:15px">${recurso.desc}</div>
          ${recurso.grupo ? `<div class="cell-meta"><span class="chip chip-outline">${recurso.grupo}</span></div>` : ''}
        </td>
        <td class="cell-unit">${recurso.u}</td>
        <td class="num">${fmtN(recurso.pu)}</td>
        <td>${recurso.categoria || '-'}</td>
        <td class="num">${uso}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-xs" onclick="abrirModalRecurso('${recurso.tipo}','${recurso.id}')">Editar</button>
            <button class="btn btn-primary btn-xs" onclick="aplicarPrecioRecurso('${recurso.id}')">Aplicar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirModalRecurso(tipo = recursoTipoActivo, id = null){
  editRecursoId = id || null;
  const recurso = id ? getRecursoById(id) : null;
  const resolvedTipo = recurso?.tipo || tipo || 'M';

  document.getElementById('mr-title').textContent = recurso ? 'Editar recurso' : 'Nuevo recurso';
  document.getElementById('r-tipo').value = resolvedTipo;
  document.getElementById('r-desc').value = recurso?.desc || '';
  document.getElementById('r-u').value = recurso?.u || 'un';
  document.getElementById('r-pu').value = recurso?.pu || 0;
  document.getElementById('r-categoria').value = recurso?.categoria || '';
  document.getElementById('r-grupo').value = recurso?.grupo || '';
  abrirModal('modal-recurso');
}

function guardarRecurso(){
  normalizarCatalogos();
  const tipo = document.getElementById('r-tipo').value;
  const desc = document.getElementById('r-desc').value.trim();
  const unidad = document.getElementById('r-u').value.trim() || 'un';
  const puRecurso = toNonNegativeNumber(document.getElementById('r-pu').value);

  if(!desc){
    notif('Ingresa la descripcion del recurso', '#E05555');
    return;
  }

  let recurso = editRecursoId ? getRecursoById(editRecursoId) : null;
  const oldKey = recurso ? recursoKey(recurso.tipo, recurso.desc, recurso.u) : null;

  if(!recurso){
    recurso = {
      id: nextRecursoId(tipo),
      tipo,
      desc,
      u: unidad,
      pu: puRecurso,
      categoria: '',
      grupo: '',
    };
    CATALOGOS[tipo].push(recurso);
  }else if(recurso.tipo !== tipo){
    CATALOGOS[recurso.tipo] = CATALOGOS[recurso.tipo].filter(item=>item.id !== recurso.id);
    CATALOGOS[tipo].push(recurso);
  }

  recurso.tipo = tipo;
  recurso.desc = desc;
  recurso.u = unidad;
  recurso.pu = puRecurso;
  recurso.categoria = document.getElementById('r-categoria').value.trim();
  recurso.grupo = document.getElementById('r-grupo').value.trim();

  const cambios = aplicarRecursoAInsumos(recurso, oldKey);
  recursoTipoActivo = tipo;
  cerrarModal('modal-recurso');
  editRecursoId = null;
  marcarUnsaved();
  renderRecursos();
  renderBD();
  renderPres();
  renderDashboard();
  notif(`Recurso guardado${cambios ? ` y aplicado a ${cambios} insumos` : ''}`);
}

function aplicarPrecioRecurso(id){
  const recurso = getRecursoById(id);
  if(!recurso) return;
  const cambios = aplicarRecursoAInsumos(recurso);
  marcarUnsaved();
  renderRecursos();
  renderBD();
  renderPres();
  renderDashboard();
  notif(cambios ? `${recurso.desc}: precio aplicado a ${cambios} insumos` : 'No hay APUs vinculados a ese recurso');
}

function actualizarSelectRecursosInsumo(tipo, selectedId = ''){
  const select = document.getElementById('ai-resource');
  if(!select) return;
  const recursos = getRecursos(tipo || document.getElementById('ai-tipo')?.value || 'M')
    .slice()
    .sort((a,b)=>a.desc.localeCompare(b.desc, 'es', { numeric: true }));
  select.innerHTML = '<option value="">Manual / crear recurso nuevo</option>' + recursos.map(item=>`
    <option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${item.desc} | ${item.u} | ${fmtN(item.pu)}</option>
  `).join('');
}

function onTipoInsumoChange(){
  actualizarSelectRecursosInsumo(document.getElementById('ai-tipo').value);
}

function aplicarRecursoSeleccionado(){
  const recurso = getRecursoById(document.getElementById('ai-resource')?.value || '');
  if(!recurso) return;
  document.getElementById('ai-tipo').value = recurso.tipo;
  document.getElementById('ai-desc').value = recurso.desc;
  document.getElementById('ai-u').value = recurso.u;
  document.getElementById('ai-pu').value = recurso.pu;
}

function recursoDesdeFormularioInsumo(insumo){
  const selectedId = document.getElementById('ai-resource')?.value || '';
  const recursoSeleccionado = getRecursoById(selectedId);
  if(recursoSeleccionado){
    insumo.resourceId = recursoSeleccionado.id;
    insumo.tipo = recursoSeleccionado.tipo;
    insumo.desc = recursoSeleccionado.desc;
    insumo.u = recursoSeleccionado.u;
    insumo.pu = recursoSeleccionado.pu;
    return recursoSeleccionado;
  }
  return ensureRecursoParaInsumo(insumo, false);
}

function parseManoObraSheetData(data){
  const recursos = [];
  let categoria = '';
  let grupo = '';

  (data || []).forEach(row=>{
    const col0 = normalizeExcelText(row?.[0] || '');
    const item = normalizeExcelText(row?.[2] || '');
    const unidad = normalizeExcelText(row?.[3] || '');
    const precio = parseExcelNumber(row?.[4]);
    const onlyFirstCol = col0 && !(row || []).slice(1).some(cell=>normalizeExcelText(cell));

    if(onlyFirstCol){
      const clean = col0.replace(/^[\s▸•·-]+/, '').replace(/\s+/g, ' ').trim();
      if(clean === clean.toUpperCase()) categoria = clean;
      else grupo = clean;
      return;
    }

    if(!item || !unidad || !(precio > 0)) return;
    recursos.push({
      tipo: 'L',
      desc: grupo ? `${grupo} - ${item}` : item,
      u: unidad,
      pu: precio,
      categoria,
      grupo,
    });
  });

  return recursos;
}

function parseJornalesSheetData(data){
  const recursos = [];
  let categoria = '';

  (data || []).forEach(row=>{
    const col0 = normalizeExcelText(row?.[0] || '');
    const concepto = normalizeExcelText(row?.[1] || '');
    const unidad = normalizeExcelText(row?.[2] || '');
    const precio = parseExcelNumber(row?.[3]);
    const onlyFirstCol = col0 && !(row || []).slice(1).some(cell=>normalizeExcelText(cell));

    if(onlyFirstCol){
      categoria = col0.replace(/^[\s▸•·-]+/, '').replace(/\s+/g, ' ').trim();
      return;
    }
    if(!concepto || !unidad || !(precio > 0)) return;

    recursos.push({
      tipo: 'L',
      desc: concepto,
      u: unidad,
      pu: precio,
      categoria,
      grupo: '',
    });
  });

  return recursos;
}

function parseRecursosSheetData(data){
  const headerRow = detectHeaderRow(data || [], ['tipo', 'descripcion'], 10);
  if(headerRow === -1) return [];
  const headers = data[headerRow].map(normalizeExcelKey);
  const findIndex = aliases=>headers.findIndex(h=>aliases.some(alias=>h.includes(alias)));
  const idxTipo = findIndex(['tipo']);
  const idxDesc = findIndex(['descripcion', 'recurso']);
  const idxU = findIndex(['unidad']);
  const idxPu = findIndex(['precio']);
  const idxCategoria = findIndex(['categoria']);
  const idxGrupo = findIndex(['grupo']);

  return data.slice(headerRow + 1)
    .filter(row=>row.some(cell=>normalizeExcelText(cell)))
    .map(row=>{
      const rawTipo = normalizeExcelKey(row[idxTipo] || 'M');
      const tipo = rawTipo.includes('mdo') || rawTipo.includes('mano') ? 'L'
        : rawTipo.includes('equipo') ? 'E'
        : rawTipo.includes('sub') ? 'S'
        : 'M';
      return {
        tipo,
        desc: normalizeExcelText(row[idxDesc] || ''),
        u: normalizeExcelText(row[idxU] || 'un') || 'un',
        pu: parseExcelNumber(row[idxPu]),
        categoria: normalizeExcelText(row[idxCategoria] || ''),
        grupo: normalizeExcelText(row[idxGrupo] || ''),
      };
    })
    .filter(item=>item.desc);
}

function mergeCatalogoItems(base, items){
  const catalogos = catalogosShape(base);
  (items || []).forEach(item=>{
    const tipo = item.tipo || 'M';
    const existing = catalogos[tipo].find(recurso=>recursoKey(recurso.tipo, recurso.desc, recurso.u) === recursoKey(tipo, item.desc, item.u));
    if(existing){
      if(item.pu > 0) existing.pu = Math.round(item.pu);
      if(item.categoria) existing.categoria = item.categoria;
      if(item.grupo) existing.grupo = item.grupo;
      return;
    }
    catalogos[tipo].push({
      id: item.id || `${tipo}-${String(catalogos[tipo].length + 1).padStart(5, '0')}`,
      tipo,
      desc: item.desc,
      u: item.u || 'un',
      pu: Math.round(parseFloat(item.pu) || 0),
      categoria: item.categoria || '',
      grupo: item.grupo || '',
    });
  });
  return catalogos;
}

function buildCatalogosFromWorkbookData(data){
  let catalogos = { M: [], L: [], E: [], S: [] };
  catalogos = mergeCatalogoItems(catalogos, parseRecursosSheetData(data?.recursos || []));
  catalogos = mergeCatalogoItems(catalogos, parseManoObraSheetData(data?.manoObra || []));
  catalogos = mergeCatalogoItems(catalogos, parseJornalesSheetData(data?.jornales || []));
  return catalogos;
}
