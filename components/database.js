let _renderBDTimer = null;
let _bdDirty = true;
let expandedPartidas = new Set();
let collapsedCapitulos = new Set();
let bdModoActivo = 'costeo';

const APU_TYPE_META = {
  M: { label: 'Material', short: 'MAT', color: 'var(--azul)' },
  L: { label: 'Mano de Obra', short: 'M.O.', color: 'var(--acento)' },
  E: { label: 'Equipo', short: 'EQ.', color: 'var(--amarillo)' },
  S: { label: 'Subcontrato', short: 'SUB', color: 'var(--naranja)' },
};

function partidaKeyFromCode(cod){
  return String(cod || '').replace(/\./g, '_');
}

function getPartidaApu(cod){
  return APU[partidaKeyFromCode(cod)] || [];
}

function formatCantidad(valor){
  return Number.isInteger(valor) ? String(valor) : Number(valor || 0).toFixed(3);
}

function bdTextKey(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isManoObraCapituloName(value){
  const key = bdTextKey(value);
  return key.includes('mano de obra') || key === 'mdo' || key.includes('jornales');
}

function isManoObraPartida(partida){
  if(!partida) return false;
  if(partida.mdoCategoria || partida.mdoGrupo) return true;
  if(isManoObraCapituloName(partida.capName)) return true;
  if(isManoObraCapituloName(capOf(partida.cap).name)) return true;
  return false;
}

function setModoBaseDatos(modo){
  bdModoActivo = modo === 'mdo' ? 'mdo' : 'costeo';
  collapsedCapitulos.clear();
  document.querySelectorAll('.bd-mode-btn').forEach(btn=>{
    btn.classList.toggle('activo', btn.dataset.bdMode === bdModoActivo);
  });
  renderBD(true);
}

function getMdoResourceIndex(){
  const map = new Map();
  (CATALOGOS?.L || []).forEach(recurso=>{
    const key = `${bdTextKey(recurso.desc)}|${bdTextKey(recurso.u)}`;
    if(key !== '|') map.set(key, recurso);
  });
  return map;
}

function deriveMdoCategoria(desc){
  const key = bdTextKey(desc);
  const rules = [
    ['Movimiento de tierra y excavaciones', ['excav', 'desmonte', 'relleno', 'compact', 'zanja', 'tierra', 'suelo']],
    ['Demoliciones y retiros', ['demolic', 'retiro', 'sacar', 'desarme', 'desmontaje']],
    ['Hormigon y estructuras', ['hormigon', 'h a', 'encofrado', 'armadura', 'zapata', 'viga', 'losa', 'columna']],
    ['Albanileria y mamposteria', ['mamposter', 'ladrillo', 'bloque', 'muro', 'cimiento', 'revoque', 'contrapiso']],
    ['Revestimientos y pisos', ['piso', 'ceram', 'porcelanato', 'baldosa', 'revest', 'azulejo']],
    ['Cubiertas y techos', ['techo', 'cubierta', 'chapa', 'teja', 'canaleta']],
    ['Carpinteria y aberturas', ['puerta', 'ventana', 'marco', 'carpinter']],
    ['Herrerias y metalicas', ['metal', 'hierro', 'reja', 'porton', 'soldadura']],
    ['Instalaciones sanitarias', ['sanitar', 'caneria', 'canilla', 'pileta', 'desague', 'pvc', 'registro']],
    ['Instalaciones electricas', ['electric', 'cable', 'llave', 'toma', 'tablero', 'ducto']],
    ['Pinturas e impermeabilizaciones', ['pint', 'impermeab', 'membrana', 'sellador']],
  ];
  const found = rules.find(([, words])=>words.some(word=>key.includes(word)));
  return found ? found[0] : 'Mano de obra general';
}

function getMdoMeta(partida, recursoIndex = getMdoResourceIndex()){
  const directCategoria = partida.mdoCategoria || partida.categoria || '';
  const directGrupo = partida.mdoGrupo || partida.grupo || '';
  const recurso = recursoIndex.get(`${bdTextKey(partida.desc)}|${bdTextKey(partida.u)}`);
  const categoria = directCategoria || recurso?.categoria || deriveMdoCategoria(partida.desc);
  const grupo = directGrupo || recurso?.grupo || '';
  return { categoria, grupo };
}

function getApuTotals(insumos){
  return {
    M: Math.round(insumos.filter(i=>i.tipo === 'M').reduce((acc, i)=>acc + (i.qty * i.pu), 0)),
    L: Math.round(insumos.filter(i=>i.tipo === 'L').reduce((acc, i)=>acc + (i.qty * i.pu), 0)),
    E: Math.round(insumos.filter(i=>i.tipo === 'E').reduce((acc, i)=>acc + (i.qty * i.pu), 0)),
    S: Math.round(insumos.filter(i=>i.tipo === 'S').reduce((acc, i)=>acc + (i.qty * i.pu), 0)),
  };
}

function expandirPartida(id, forceOpen){
  const key = String(id);
  const open = typeof forceOpen === 'boolean' ? forceOpen : !expandedPartidas.has(key);
  if(open) expandedPartidas.add(key);
  else expandedPartidas.delete(key);
  renderBD();
}

function toggleCapituloBD(capId){
  const key = String(capId);
  if(collapsedCapitulos.has(key)) collapsedCapitulos.delete(key);
  else collapsedCapitulos.add(key);
  renderBD();
}

function expandirTodosCapitulosBD(){
  collapsedCapitulos.clear();
  renderBD(true);
}

function retraerTodosCapitulosBD(){
  if(bdModoActivo === 'mdo'){
    collapsedCapitulos = new Set(buildMdoGrupos(filtrarDB()).map(grupo=>`mdo:${grupo.key}`));
  }else{
    const visibles = filtrarDB().map(partida=>String(partida.cap));
    const capIds = visibles.length
      ? visibles
      : CAPS.filter(cap=>!isManoObraCapituloName(cap.name)).map(cap=>String(cap.id));
    collapsedCapitulos = new Set(capIds);
  }
  renderBD(true);
}

function isBDActive(){
  return document.getElementById('tab-bd')?.classList.contains('active');
}

function renderBD(force = false){
  const badge = document.getElementById('badge-count');
  if(badge) badge.textContent = `${DB.length} partidas`;
  if(!force && !isBDActive()){
    _bdDirty = true;
    return;
  }
  clearTimeout(_renderBDTimer);
  _renderBDTimer = setTimeout(()=>_renderBDNow(force), 50);
}

function limpiarBusquedaBD(){
  const input = document.getElementById('bd-search');
  if(input) input.value = '';
  renderBD();
}

function getRamoLabel(ramo){
  const labels = {
    todos: 'Todos',
    vial: 'Viales',
    civil: 'Civiles',
    electrica: 'Eléctricas',
    sanitaria: 'Sanitarias',
    hvac: 'Climatización',
    acabados: 'Acabados',
  };
  return labels[ramo] || ramo;
}

function valorTablaBD(valor){
  return valor > 0 ? fmtN(valor) : '-';
}

function renderCapituloRow(capId, partidas){
  const cap = capOf(capId);
  const collapsed = collapsedCapitulos.has(String(capId));
  const totalCap = partidas.reduce((acc, p)=>acc + pu(p), 0);
  const capArg = String(capId).replace(/'/g, "\\'");
  return `
    <tr class="cap-row cap-row-toggle" data-cap="${capId}">
      <td colspan="11" style="background:${cap.color}CC">
        <div class="cap-row-inner">
          <button
            type="button"
            class="chapter-toggle ${collapsed ? '' : 'is-open'}"
            onclick="toggleCapituloBD('${capId}')"
            aria-expanded="${collapsed ? 'false' : 'true'}"
            title="${collapsed ? 'Expandir capitulo' : 'Replegar capitulo'}"
          >
            <span>${collapsed ? '+' : '-'}</span>
          </button>
          <div class="cap-row-copy">
            <strong>${capId} - ${cap.name}</strong>
            <span>${partidas.length} partida${partidas.length === 1 ? '' : 's'}</span>
          </div>
          <div class="cap-row-total">Gs. ${fmtN(totalCap)}</div>
          <div class="cap-row-actions">
            <button
              type="button"
              class="cap-row-action"
              onclick="event.stopPropagation(); abrirNuevaPartidaEnCapitulo('${capArg}')"
              title="Agregar partida en este capitulo"
            >+ Partida</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function renderCapituloEmptyRow(capId){
  const capArg = String(capId).replace(/'/g, "\\'");
  return `
    <tr class="db-empty-cap-row">
      <td colspan="11">
        <div class="empty-state" style="padding:22px 0">
          <h3 style="margin-bottom:4px">Capitulo ${capId} sin partidas</h3>
          <p>Usa el boton del capitulo para cargar items directamente aqui.</p>
          <button class="btn btn-primary btn-sm" onclick="abrirNuevaPartidaEnCapitulo('${capArg}')">+ Agregar partida</button>
        </div>
      </td>
    </tr>
  `;
}

function buildMdoGrupos(partidas){
  const recursoIndex = getMdoResourceIndex();
  const colors = ['#1A7A5A', '#1A5A8B', '#8A6A14', '#8A3070', '#6A6A6A', '#3A7A30', '#9B2020', '#5A4AAA'];
  const groups = new Map();

  (partidas || []).forEach(partida=>{
    const meta = getMdoMeta(partida, recursoIndex);
    const label = meta.categoria || 'Mano de obra general';
    const key = bdTextKey(label) || 'general';
    if(!groups.has(key)){
      groups.set(key, {
        key,
        label,
        color: colors[groups.size % colors.length],
        partidas: [],
      });
    }
    groups.get(key).partidas.push({ partida, meta });
  });

  return Array.from(groups.values())
    .map((grupo, index)=>({
      ...grupo,
      id: `M${String(index + 1).padStart(2, '0')}`,
      total: grupo.partidas.reduce((acc, item)=>acc + pu(item.partida), 0),
    }))
    .sort((a,b)=>a.label.localeCompare(b.label, 'es', { numeric: true }));
}

function renderMdoGrupoRow(grupo){
  const collapsed = collapsedCapitulos.has(`mdo:${grupo.key}`);
  return `
    <tr class="cap-row cap-row-toggle" data-cap="${grupo.id}">
      <td colspan="11" style="background:${grupo.color}CC">
        <div class="cap-row-inner">
          <button
            type="button"
            class="chapter-toggle ${collapsed ? '' : 'is-open'}"
            onclick="toggleCapituloBD('mdo:${grupo.key}')"
            aria-expanded="${collapsed ? 'false' : 'true'}"
            title="${collapsed ? 'Expandir capitulo' : 'Replegar capitulo'}"
          >
            <span>${collapsed ? '+' : '-'}</span>
          </button>
          <div class="cap-row-copy">
            <strong>${grupo.id} - ${grupo.label}</strong>
            <span>${grupo.partidas.length} mano${grupo.partidas.length === 1 ? '' : 's'} de obra</span>
          </div>
          <div class="cap-row-total">Gs. ${fmtN(grupo.total)}</div>
        </div>
      </td>
    </tr>
  `;
}

function renderMdoBD(lista, presMap = null){
  const grupos = buildMdoGrupos(lista);
  if(!grupos.length){
    document.getElementById('bd-tbody').innerHTML = `
      <tr>
        <td colspan="11">
          <div class="empty-state" style="padding:48px 0">
            <h3>Sin mano de obra</h3>
            <p>Importa una planilla de mano de obra o agrega recursos MDO para crear esta base.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  grupos.forEach(grupo=>{
    const collapsed = collapsedCapitulos.has(`mdo:${grupo.key}`);
    html += renderMdoGrupoRow(grupo);
    if(collapsed) return;
    grupo.partidas.forEach(({ partida, meta })=>{
      html += renderPartidaSummaryRow({
        ...partida,
        _mdoMeta: meta,
      }, presMap);
      if(expandedPartidas.has(String(partida.id))){
        html += renderDetallePartidaRow(partida, capOf(partida.cap), getPartidaApu(partida.cod));
      }
    });
  });

  document.getElementById('bd-tbody').innerHTML = html;
}

function _renderBDNow(force = false){
  if(!force && !isBDActive()){
    _bdDirty = true;
    return;
  }
  _bdDirty = false;
  document.getElementById('badge-count').textContent = `${DB.length} partidas`;

  const lista = filtrarDB();
  const q = (document.getElementById('bd-search')?.value || '').trim();
  const ramoFiltrado = ramoActivo !== 'todos';
  const clearBtn = document.getElementById('bd-clear-btn');
  const status = document.getElementById('bd-status-text');
  const totalMdo = DB.filter(isManoObraPartida).length;
  const totalCosteo = DB.length - totalMdo;

  document.querySelectorAll('.bd-mode-btn').forEach(btn=>{
    btn.classList.toggle('activo', btn.dataset.bdMode === bdModoActivo);
  });

  if(clearBtn) clearBtn.style.display = q ? 'inline-flex' : 'none';
  if(status){
    if(bdModoActivo === 'mdo'){
      status.textContent = `Base exclusiva de mano de obra: ${lista.length} visibles de ${totalMdo}. Agrupada por capitulos de MDO segun categoria, grupo o descripcion.`;
    } else if(q && ramoFiltrado){
      status.textContent = `Mostrando ${lista.length} de ${DB.length} partidas para "${q}" en ${getRamoLabel(ramoActivo)}.`;
    } else if(q){
      status.textContent = `Mostrando ${lista.length} de ${totalCosteo} partidas de costeo para "${q}". Limpia el filtro para ver toda la base.`;
    } else if(ramoFiltrado){
      status.textContent = `Mostrando ${lista.length} de ${totalCosteo} partidas de costeo del ramo ${getRamoLabel(ramoActivo)}.`;
    } else {
      status.textContent = `Base de costeo: ${lista.length} visibles de ${totalCosteo}. La mano de obra queda separada en su propia base.`;
    }
  }

  const presMap = new Map(PRESUPUESTO.map(item=>[item.pid, item]));

  if(bdModoActivo === 'mdo'){
    renderMdoBD(lista, presMap);
    return;
  }

  if(!lista.length){
    document.getElementById('bd-tbody').innerHTML = `
      <tr>
        <td colspan="11">
          <div class="empty-state" style="padding:48px 0">
            <div class="icon">+</div>
            <h3>Sin partidas de costeo</h3>
            <p>No hay coincidencias con el filtro actual. Cambiá el ramo, limpiá la búsqueda o agregá una nueva partida.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const gruposMap = new Map();
  lista.forEach(partida=>{
    if(!gruposMap.has(partida.cap)) gruposMap.set(partida.cap, []);
    gruposMap.get(partida.cap).push(partida);
  });

  const mostrarSoloGruposConResultados = q || ramoFiltrado;
  const grupos = mostrarSoloGruposConResultados
    ? Array.from(gruposMap.entries()).map(([capId, partidas])=>({ capId, partidas }))
    : CAPS
      .filter(cap=>!isManoObraCapituloName(cap.name))
      .map(cap=>({ capId: cap.id, partidas: gruposMap.get(cap.id) || [] }));

  let html = '';

  grupos.forEach(grupo=>{
    const collapsed = collapsedCapitulos.has(String(grupo.capId));
    html += renderCapituloRow(grupo.capId, grupo.partidas);
    if(collapsed) return;
    if(!grupo.partidas.length){
      html += renderCapituloEmptyRow(grupo.capId);
      return;
    }
    grupo.partidas.forEach(partida=>{
      html += renderPartidaSummaryRow(partida, presMap);
      if(expandedPartidas.has(String(partida.id))){
        html += renderDetallePartidaRow(partida, capOf(partida.cap), getPartidaApu(partida.cod));
      }
    });
  });

  document.getElementById('bd-tbody').innerHTML = html;
}

function renderPartidaSummaryRow(partida, presMap = null){
  const apu = getPartidaApu(partida.cod);
  const presItem = presMap
    ? (presMap.get(partida.id) || presMap.get(String(partida.id)))
    : PRESUPUESTO.find(item=>String(item.pid) === String(partida.id));
  const enPres = Boolean(presItem);
  const qtyPres = presItem ? presItem.qty : 0;
  const pidArg = typeof presPidArg === 'function' ? presPidArg(partida.id) : JSON.stringify(partida.id);
  const open = expandedPartidas.has(String(partida.id));
  const rowBg = enPres ? 'background:rgba(94,200,255,.06);border-left:2px solid var(--acento)' : '';
  const ramoBadge = partida.ramo && partida.ramo !== 'todos'
    ? `<span class="chip" style="background:${RAMO_COLORS[partida.ramo] || '#888'}22;color:${RAMO_COLORS[partida.ramo] || '#888'}">${getRamoLabel(partida.ramo)}</span>`
    : '<span class="chip chip-muted">general</span>';
  const mdoMeta = partida._mdoMeta || null;
  const mdoBadge = mdoMeta
    ? `<span class="chip chip-outline">${mdoMeta.grupo || mdoMeta.categoria}</span>`
    : '';
  const presBadge = enPres
    ? `<span class="chip chip-success">En presupuesto | ${qtyPres % 1 === 0 ? qtyPres : qtyPres.toFixed(2)}</span>`
    : '';

  return `
    <tr class="db-summary-row" style="${rowBg}" data-pid="${partida.id}">
      <td>
        <button
          class="accordion-toggle ${open ? 'is-open' : ''}"
          type="button"
          onclick="expandirPartida(${partida.id})"
          aria-expanded="${open ? 'true' : 'false'}"
          aria-controls="apu-panel-${partida.id}"
          title="${open ? 'Ocultar APU' : 'Mostrar APU'}"
        >
          <span>${open ? '-' : '+'}</span>
        </button>
      </td>
      <td><code class="cell-code">${partida.cod}</code></td>
      <td>
        <div class="cell-description">${partida.desc}</div>
        <div class="cell-meta">
          ${mdoBadge}
          ${presBadge}
          <span class="chip chip-outline">${apu.length} insumo${apu.length === 1 ? '' : 's'}</span>
        </div>
      </td>
      <td class="cell-unit">${partida.u}</td>
      <td>${ramoBadge}</td>
      <td class="num" style="color:var(--azul)">${valorTablaBD(partida.mat)}</td>
      <td class="num" style="color:var(--acento)">${valorTablaBD(partida.mo)}</td>
      <td class="num" style="color:var(--amarillo)">${valorTablaBD(partida.eq)}</td>
      <td class="num" style="color:var(--naranja)">${valorTablaBD(partida.sub)}</td>
      <td class="num total-cell">${fmtN(pu(partida))}</td>
      <td>
          <div class="table-actions">
            <div class="budget-action-group">
            <button class="budget-action-btn add" onclick="addToPres(${pidArg})">${enPres ? 'Agregar +1' : 'Agregar'}</button>
            <button class="budget-action-btn remove" onclick="quitarPres(${pidArg})" ${enPres ? '' : 'disabled'}>Excluir</button>
          </div>
          <div class="table-actions-secondary">
            <button class="btn btn-secondary btn-xs" onclick="editarPartida(${pidArg})">Editar</button>
            <button class="btn btn-danger btn-xs" onclick="eliminarPartida(${pidArg})">Eliminar</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function enPresStyle(enPres){
  return enPres
    ? 'background:var(--acento4);color:var(--acento);border:1px solid var(--acento2)'
    : 'background:var(--naranjabg);color:var(--naranja);border:1px solid rgba(232,144,32,.2)';
}

function renderDetallePartidaRow(partida, cap, insumos){
  const totals = insumos.length
    ? getApuTotals(insumos)
    : { M: partida.mat || 0, L: partida.mo || 0, E: partida.eq || 0, S: partida.sub || 0 };
  const total = Math.round(totals.M + totals.L + totals.E + totals.S);

  const resumenTecnico = `
    <div class="apu-inline-summary">
      <div>
        <p class="apu-inline-label">Capitulo</p>
        <strong>${cap.id} - ${cap.name}</strong>
      </div>
      <div>
        <p class="apu-inline-label">Unidad</p>
        <strong>${partida.u}</strong>
      </div>
      <div>
        <p class="apu-inline-label">Ramo</p>
        <strong>${getRamoLabel(partida.ramo || 'todos')}</strong>
      </div>
      <div>
        <p class="apu-inline-label">Precio unitario</p>
        <strong>${fmt(total)}</strong>
      </div>
    </div>
  `;

  const kpis = Object.entries(APU_TYPE_META).map(([tipo, meta])=>`
    <div class="apu-kpi">
      <span class="bdg bdg-${tipo}">${meta.short}</span>
      <div>
        <p>${meta.label}</p>
        <strong style="color:${meta.color}">${fmt(totals[tipo])}</strong>
      </div>
    </div>
  `).join('');

  const tabla = insumos.length
    ? renderTablaApuInline(partida, insumos, totals)
    : `
      <div class="apu-empty">
        <div>
          <h3>Sin insumos cargados</h3>
          <p>Agrega materiales, mano de obra, equipo o subcontrato para construir el APU de esta partida.</p>
        </div>
        <button class="btn btn-primary" onclick="agregarInsumoA('${partida.cod}')">+ Agregar insumo</button>
      </div>
    `;

  return `
    <tr class="db-detail-row">
      <td colspan="11">
        <article class="apu-inline-card" id="apu-panel-${partida.id}">
          <div class="apu-inline-head">
            <div>
              <p class="apu-inline-eyebrow">APU integrado</p>
              <h3>${partida.cod} - ${partida.desc}</h3>
              <p class="apu-inline-sub">El desglose tecnico ahora vive dentro de la Base de Datos para mantener contexto, trazabilidad y edicion rapida.</p>
            </div>
            <div class="apu-inline-head-actions">
              <button class="btn btn-secondary" onclick="editarPartida(${partida.id})">Editar partida</button>
              <button class="btn btn-primary" onclick="agregarInsumoA('${partida.cod}')">+ Agregar insumo</button>
            </div>
          </div>
          ${resumenTecnico}
          <div class="apu-kpis">${kpis}</div>
          ${tabla}
        </article>
      </td>
    </tr>
  `;
}

function renderTablaApuInline(partida, insumos, totals){
  const total = Math.max(1, totals.M + totals.L + totals.E + totals.S);
  const rows = insumos.map((insumo, idx)=>{
    const subtotal = Math.round(insumo.qty * insumo.pu);
    const pct = ((subtotal / total) * 100).toFixed(1);
    const meta = APU_TYPE_META[insumo.tipo] || APU_TYPE_META.M;
    const recurso = typeof getRecursoById === 'function' ? getRecursoById(insumo.resourceId) : null;
    const recursoChip = recurso ? '<span class="chip chip-success">maestro</span>' : '';
    return `
      <tr class="apu-inline-row" onclick="editarInsumo('${partida.cod}',${idx})">
        <td>${idx + 1}</td>
        <td>${insumo.desc}${recursoChip ? `<div class="cell-meta">${recursoChip}</div>` : ''}</td>
        <td class="cell-unit">${insumo.u}</td>
        <td><span class="bdg bdg-${insumo.tipo}">${meta.short}</span></td>
        <td class="num">${formatCantidad(insumo.qty)}</td>
        <td class="num">${fmtN(insumo.pu)}</td>
        <td class="num" style="color:${meta.color}">${fmtN(subtotal)}</td>
        <td class="num">${pct}%</td>
        <td><button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); eliminarInsumo('${partida.cod}',${idx})">Quitar</button></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="tbl-wrap apu-inline-table-wrap">
      <table class="apu-inline-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Descripcion</th>
            <th>Unidad</th>
            <th>Tipo</th>
            <th class="num">Cantidad</th>
            <th class="num">P. unitario</th>
            <th class="num">Subtotal</th>
            <th class="num">% APU</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="5">
              <div class="apu-foot-pills">
                <span class="cost-pill" style="color:var(--azul)">Materiales: ${fmt(totals.M)}</span>
                <span class="cost-pill" style="color:var(--acento)">Mano de obra: ${fmt(totals.L)}</span>
                <span class="cost-pill" style="color:var(--amarillo)">Equipo: ${fmt(totals.E)}</span>
                <span class="cost-pill" style="color:var(--naranja)">Subcontrato: ${fmt(totals.S)}</span>
              </div>
            </td>
            <td colspan="3" class="num apu-total-label">Precio unitario final [${partida.u}]</td>
            <td class="num apu-total-value">${fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function abrirModalPartida(id, preferredCapId = null){
  editPid = id == null ? null : id;
  document.getElementById('f-cap').innerHTML = CAPS.map(c=>`<option value="${c.id}">${c.id} - ${c.name}</option>`).join('');

  if(id != null){
    const partida = DB.find(item=>String(item.id) === String(id));
    if(!partida){
      notif('No se encontro la partida para editar', '#E05555');
      editPid = null;
      return;
    }
    document.getElementById('mp-title').textContent = `Editar Partida - ${partida.cod}`;
    document.getElementById('f-cap').value = partida.cap;
    document.getElementById('f-cod').value = partida.cod;
    document.getElementById('f-ramo').value = partida.ramo || 'todos';
    document.getElementById('f-u').value = partida.u;
    document.getElementById('f-desc').value = partida.desc;
    document.getElementById('f-mat').value = partida.mat;
    document.getElementById('f-mo').value = partida.mo;
    document.getElementById('f-eq').value = partida.eq;
    document.getElementById('f-sub').value = partida.sub;
  }else{
    const defaultCap = preferredCapId && CAPS.some(cap=>cap.id === preferredCapId) ? preferredCapId : '01';
    const capInfo = capOf(defaultCap);
    const defaultRamo = ramoActivo !== 'todos'
      ? ramoActivo
      : ((capInfo.ramos || []).find(ramo=>ramo !== 'todos') || 'civil');
    document.getElementById('mp-title').textContent = 'Nueva Partida';
    document.getElementById('f-cod').value = '';
    document.getElementById('f-desc').value = '';
    ['f-mat', 'f-mo', 'f-eq', 'f-sub'].forEach(idCampo=>{
      document.getElementById(idCampo).value = 0;
    });
    document.getElementById('f-cap').value = defaultCap;
    document.getElementById('f-ramo').value = defaultRamo;
    autoCod();
  }

  updPU();
  abrirModal('modal-partida');
}

function editarPartida(id){
  abrirModalPartida(id);
}

function abrirNuevaPartidaEnCapitulo(capId){
  const targetCap = String(capId || '01');
  collapsedCapitulos.delete(targetCap);
  abrirModalPartida(null, targetCap);
}

function autoCod(){
  if(editPid) return;
  const cap = document.getElementById('f-cap').value;
  const correlativos = DB
    .filter(partida=>partida.cap === cap)
    .map(partida=>parseInt((String(partida.cod).split('.')[1] || '0'), 10))
    .filter(Number.isFinite);
  const siguiente = correlativos.length ? Math.max(...correlativos) + 1 : 1;
  document.getElementById('f-cod').value = `${cap}.${String(siguiente).padStart(2, '0')}`;
}

function updPU(){
  const total = ['f-mat', 'f-mo', 'f-eq', 'f-sub']
    .reduce((acc, idCampo)=>acc + (parseFloat(document.getElementById(idCampo).value) || 0), 0);
  document.getElementById('f-pu-show').textContent = `Gs. ${Math.round(total).toLocaleString('es-PY')}`;
}

function guardarPartida(){
  const cod = document.getElementById('f-cod').value.trim();
  const desc = document.getElementById('f-desc').value.trim();

  if(!cod || !desc){
    notif('Completa codigo y descripcion', '#E05555');
    return;
  }

  const editando = editPid != null;
  const codigoDuplicado = DB.some(partida=>partida.cod === cod && String(partida.id) !== String(editPid));
  if(codigoDuplicado){
    notif('Ya existe una partida con ese codigo', '#E05555');
    return;
  }

  const idxEditando = editando ? DB.findIndex(item=>String(item.id) === String(editPid)) : -1;
  const idActual = idxEditando >= 0 ? Number(DB[idxEditando].id) : null;
  const partidaId = editando && Number.isFinite(idActual) && idActual > 0
    ? idActual
    : nextNumericId(DB);

  const partida = {
    id: partidaId,
    cap: document.getElementById('f-cap').value,
    cod,
    desc,
    u: document.getElementById('f-u').value,
    ramo: document.getElementById('f-ramo').value,
    mat: toNonNegativeNumber(document.getElementById('f-mat').value),
    mo: toNonNegativeNumber(document.getElementById('f-mo').value),
    eq: toNonNegativeNumber(document.getElementById('f-eq').value),
    sub: toNonNegativeNumber(document.getElementById('f-sub').value),
  };

  if(editando && idxEditando >= 0){
    const idx = idxEditando;
    const anterior = DB[idx];
    pushHistorial('editPartida', { partida: { ...anterior } });
    DB[idx] = partida;

    if(String(anterior.id) !== String(partida.id)){
      PRESUPUESTO.forEach(item=>{
        if(String(item.pid) === String(anterior.id)) item.pid = partida.id;
      });
    }

    if(anterior.cod !== cod){
      const oldKey = partidaKeyFromCode(anterior.cod);
      const newKey = partidaKeyFromCode(cod);
      if(APU[oldKey]){
        APU[newKey] = [...(APU[newKey] || []), ...APU[oldKey]];
        delete APU[oldKey];
      }
    }
  }else{
    DB.push(partida);
  }

  cerrarModal('modal-partida');
  marcarUnsaved();
  renderBD();
  renderPres();
  refreshMateriales();
  refreshDashboard();
  notif(editando ? 'Partida actualizada' : 'Partida agregada');
}

function eliminarPartida(id){
  const partida = DB.find(item=>String(item.id) === String(id));
  if(!partida){
    notif('No se encontro la partida para eliminar', '#E05555');
    return;
  }
  const ok = prompt(`Para eliminar escribi el codigo exacto:\n\n"${partida.cod} - ${partida.desc}"\n\nCodigo:`);
  if(ok === null) return;
  if(ok.trim() !== partida.cod){
    notif('Codigo incorrecto - no se elimino', '#E05555');
    return;
  }

  const idx = DB.findIndex(item=>String(item.id) === String(id));
  const presItems = PRESUPUESTO.filter(item=>String(item.pid) === String(id));
  pushHistorial('elimPartida', {
    idx,
    partida: { ...partida },
    apu: getPartidaApu(partida.cod).length ? [...getPartidaApu(partida.cod)] : null,
    presItems: [...presItems],
  });

  DB = DB.filter(item=>String(item.id) !== String(id));
  PRESUPUESTO = PRESUPUESTO.filter(item=>String(item.pid) !== String(id));
  expandedPartidas.delete(String(id));
  delete APU[partidaKeyFromCode(partida.cod)];
  marcarUnsaved();
  renderBD();
  renderPres();
  refreshMateriales();
  refreshDashboard();
  notif('Eliminada - Ctrl+Z para deshacer', '#E05555');
}

function renderAPU(){
  renderBD();
}

function abrirModalInsumo(){
  resetInsumoModalState();
  _openIM();
}

function agregarInsumoA(cod){
  resetInsumoModalState();
  editInsCod = cod;
  _openIM(cod);
}

function editarInsumo(cod, idx){
  editInsCod = cod;
  editInsIdx = idx;
  const insumo = getPartidaApu(cod)[idx];
  _openIM(cod);
  document.getElementById('ai-desc').value = insumo.desc;
  document.getElementById('ai-u').value = insumo.u;
  document.getElementById('ai-tipo').value = insumo.tipo;
  document.getElementById('ai-qty').value = insumo.qty;
  document.getElementById('ai-pu').value = insumo.pu;
  if(typeof actualizarSelectRecursosInsumo === 'function') actualizarSelectRecursosInsumo(insumo.tipo, insumo.resourceId || '');
  document.getElementById('mi-title').textContent = 'Editar Insumo';
}

function _openIM(cod){
  document.getElementById('ai-partida').innerHTML = DB.map(partida=>`
    <option value="${partida.cod}" ${partida.cod === (cod || '') ? 'selected' : ''}>${partida.cod} - ${partida.desc}</option>
  `).join('');
  document.getElementById('ai-partida').disabled = editInsIdx != null;
  document.getElementById('mi-title').textContent = 'Agregar Insumo';
  if(editInsIdx == null){
    document.getElementById('ai-desc').value = '';
    document.getElementById('ai-u').value = 'un';
    document.getElementById('ai-tipo').value = 'M';
    document.getElementById('ai-qty').value = 1;
    document.getElementById('ai-pu').value = 0;
  }
  if(typeof actualizarSelectRecursosInsumo === 'function'){
    actualizarSelectRecursosInsumo(document.getElementById('ai-tipo').value);
  }
  abrirModal('modal-insumo');
}

function resetInsumoModalState(){
  editInsIdx = null;
  editInsCod = null;
  const selectPartida = document.getElementById('ai-partida');
  if(selectPartida) selectPartida.disabled = false;
}

function guardarInsumo(){
  const cod = document.getElementById('ai-partida').value;
  const desc = document.getElementById('ai-desc').value.trim();
  const qty = parseFloat(document.getElementById('ai-qty').value);
  const puInsumo = parseFloat(document.getElementById('ai-pu').value);

  if(!desc){
    notif('Ingresa la descripcion del insumo', '#E05555');
    return;
  }
  if(!(qty > 0)){
    notif('La cantidad del insumo debe ser mayor a cero', '#E05555');
    return;
  }
  if(puInsumo < 0){
    notif('El precio unitario del insumo no puede ser negativo', '#E05555');
    return;
  }

  const insumo = {
    desc,
    u: document.getElementById('ai-u').value,
    tipo: document.getElementById('ai-tipo').value,
    qty,
    pu: toNonNegativeNumber(puInsumo),
  };
  if(typeof recursoDesdeFormularioInsumo === 'function') recursoDesdeFormularioInsumo(insumo);

  const codKey = partidaKeyFromCode(cod);
  if(!APU[codKey]) APU[codKey] = [];
  const prevIns = [...APU[codKey]];

  if(editInsIdx != null){
    pushHistorial('editInsumo', { cod: codKey, insumosPrev: prevIns });
    APU[codKey][editInsIdx] = insumo;
  }else{
    pushHistorial('agregarInsumo', { cod: codKey, insumosPrev: prevIns });
    APU[codKey].push(insumo);
  }

  recalcDesdeAPU(cod);
  const partida = DB.find(item=>item.cod === cod);
  if(partida){
    expandedPartidas.add(String(partida.id));
    collapsedCapitulos.delete(String(partida.cap));
  }
  resetInsumoModalState();
  cerrarModal('modal-insumo');
  marcarUnsaved();
  renderBD();
  renderPres();
  refreshMateriales();
  refreshDashboard();
  notif('Insumo guardado');
}

function eliminarInsumo(cod, idx){
  const codKey = partidaKeyFromCode(cod);
  pushHistorial('elimInsumo', { cod: codKey, idx, insumo: { ...APU[codKey][idx] } });
  APU[codKey].splice(idx, 1);
  recalcDesdeAPU(cod);
  marcarUnsaved();
  renderBD();
  renderPres();
  refreshMateriales();
  refreshDashboard();
  notif('Eliminado - Ctrl+Z para deshacer', '#E89020');
}

function recalcDesdeAPU(cod){
  const insumos = getPartidaApu(cod);
  const partida = DB.find(item=>item.cod === cod);
  if(!partida) return;
  partida.mat = Math.round(insumos.filter(i=>i.tipo === 'M').reduce((acc, i)=>acc + (i.qty * i.pu), 0));
  partida.mo = Math.round(insumos.filter(i=>i.tipo === 'L').reduce((acc, i)=>acc + (i.qty * i.pu), 0));
  partida.eq = Math.round(insumos.filter(i=>i.tipo === 'E').reduce((acc, i)=>acc + (i.qty * i.pu), 0));
  partida.sub = Math.round(insumos.filter(i=>i.tipo === 'S').reduce((acc, i)=>acc + (i.qty * i.pu), 0));
}


