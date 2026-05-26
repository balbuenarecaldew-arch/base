function generarDocHTML(){
  const nombre=document.getElementById('p-nombre').value||'';
  const cliente=document.getElementById('p-cliente').value||'';
  const ubic=document.getElementById('p-ubic').value||'';
  const resp=document.getElementById('p-resp').value||'';
  const nro=document.getElementById('p-nro').value||'';
  const fecha=document.getElementById('p-fecha').value?new Date(document.getElementById('p-fecha').value+'T00:00:00').toLocaleDateString('es-PY',{day:'2-digit',month:'long',year:'numeric'}):'';
  const empNombre=document.getElementById('emp-nombre').value||'';
  const empRuc=document.getElementById('emp-ruc').value||'';
  const empDir=document.getElementById('emp-dir').value||'';
  const empNota=document.getElementById('emp-nota').value||'';
  const empPlazo=document.getElementById('emp-plazo').value||'';
  const empPago=document.getElementById('emp-pago').value||'';
  const empValidez=document.getElementById('emp-validez').value||'';
  const gi=parseFloat(document.getElementById('pct-gi').value)||0;
  const bi=parseFloat(document.getElementById('pct-bi').value)||0;
  const iva=parseFloat(document.getElementById('pct-iva').value)||0;
  const factor=(1+gi/100)*(1+bi/100)*(1+iva/100);
  const puFinal=p=>Math.round(pu(p)*factor);
  const fmtP=n=>'₲ '+Math.round(n).toLocaleString('es-PY');
  let totalGeneral=0;
  PRESUPUESTO.forEach(it=>{const p=DB.find(x=>x.id===it.pid);if(p)totalGeneral+=puFinal(p)*it.qty});
  let html='';

  if(SECC_STATE['sec-portada']){
    html+=`<div class="doc-header">
      <div class="doc-empresa">
        ${logoDataURL?`<img src="${logoDataURL}" style="height:56px;margin-bottom:8px;display:block;max-width:180px;object-fit:contain">`:''}
        <h2>${empNombre}</h2>
        ${empRuc?`<p>RUC/Tel: ${empRuc}</p>`:''}
        ${empDir?`<p>${empDir}</p>`:''}
      </div>
      <div class="doc-datos">
        <p><strong>Nro. Presupuesto:</strong> ${nro}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p style="margin-top:6px"><strong>Proyecto:</strong> ${nombre}</p>
        <p><strong>Cliente:</strong> ${cliente}</p>
        ${ubic?`<p><strong>Ubicacion:</strong> ${ubic}</p>`:''}
        ${resp?`<p><strong>Responsable:</strong> ${resp}</p>`:''}
      </div>
    </div>
    <div class="doc-titulo">Presupuesto de Obra</div>
    <div class="doc-subtitulo">${nombre}${cliente?' - '+cliente:''}</div>`;
  }

  if(SECC_STATE['sec-detalle']&&PRESUPUESTO.length){
    const byCap={};
    PRESUPUESTO.forEach(it=>{const p=DB.find(x=>x.id===it.pid);if(!p)return;if(!byCap[p.cap])byCap[p.cap]=[];byCap[p.cap].push({it,p})});
    html+=`<h3 style="font-size:11pt;color:#1B4432;margin:14px 0 7px;border-bottom:2px solid #1B4432;padding-bottom:3px">Detalle de Partidas</h3>
    <table class="doc-table">
      <thead><tr>
        <th style="width:60px">Item</th><th>Descripcion</th>
        <th style="width:38px;text-align:center">Ud.</th>
        <th style="width:105px;text-align:right">P. Unit. ₲</th>
        <th style="width:70px;text-align:right">Cant.</th>
        <th style="width:115px;text-align:right">Total ₲</th>
      </tr></thead><tbody>`;
    Object.keys(byCap).sort().forEach(cid=>{
      const cap=capOf(cid);
      const capT=byCap[cid].reduce((a,{it,p})=>a+puFinal(p)*it.qty,0);
      html+=`<tr class="doc-cap-row"><td colspan="5" style="font-weight:700">${cid} - ${cap.name}</td><td style="text-align:right;font-weight:700">${fmtP(capT)}</td></tr>`;
      byCap[cid].forEach(({it,p})=>{
        const puf=puFinal(p); const t=puf*it.qty;
        html+=`<tr>
          <td style="font-family:monospace;font-size:8pt;color:#555">${p.cod}</td>
          <td style="font-size:9pt">${p.desc}</td>
          <td style="text-align:center;font-size:9pt;color:#555">${p.u}</td>
          <td style="text-align:right;font-size:9pt">${fmtP(puf)}</td>
          <td style="text-align:right;font-size:9pt">${it.qty%1===0?it.qty:it.qty.toFixed(2)}</td>
          <td style="text-align:right;font-weight:700;font-size:9pt">${fmtP(t)}</td>
        </tr>`;
      });
    });
    html+=`<tr>
      <td colspan="5" style="text-align:right;font-weight:700;font-size:10pt;padding:10px 8px;color:#111!important;background:#fff!important;border-top:3px solid #1B4432;border-bottom:2px solid #1B4432">TOTAL GENERAL DE OBRA</td>
      <td style="text-align:right;font-weight:700;font-size:13pt;padding:10px 8px;color:#1B4432!important;background:#fff!important;border-top:3px solid #1B4432;border-bottom:2px solid #1B4432">${fmtP(totalGeneral)}</td>
    </tr></tbody></table>`;
  }
  if(SECC_STATE['sec-letras']){
    html+=`<div style="border:1px solid #c5ddd4;border-radius:5px;padding:9px 13px;margin-top:8px;background:#f0f7f3">
      <span style="font-size:8pt;color:#1B4432;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Son: </span>
      <span style="font-size:9pt;color:#1B4432;font-weight:700">${numeroALetras(totalGeneral)} GUARANIES</span>
    </div>`;
  }
  if(SECC_STATE['sec-nota-pct']){
    html+=`<p style="font-size:7.5pt;color:#888;margin-top:6px;font-style:italic">* Precios unitarios incluyen: gastos indirectos (${gi}%), beneficio (${bi}%) e IVA (${iva}%).</p>`;
  }
  if(SECC_STATE['sec-caps']&&PRESUPUESTO.length){
    const byCap={}; PRESUPUESTO.forEach(it=>{const p=DB.find(x=>x.id===it.pid);if(!p)return;if(!byCap[p.cap])byCap[p.cap]=0;byCap[p.cap]+=puFinal(p)*it.qty});
    html+=`<h3 style="font-size:11pt;color:#1B4432;margin:14px 0 7px;border-bottom:2px solid #1B4432;padding-bottom:3px">Resumen por Capitulo</h3>
    <table class="doc-table"><thead><tr><th>Cap.</th><th>Capitulo</th><th style="text-align:right">Total ₲</th><th style="text-align:right">% Obra</th></tr></thead><tbody>`;
    Object.keys(byCap).sort().forEach(cid=>{const cap=capOf(cid);const pct=totalGeneral>0?(byCap[cid]/totalGeneral*100).toFixed(1):0;html+=`<tr><td><strong>${cid}</strong></td><td>${cap.name}</td><td style="text-align:right;font-weight:700">${fmtP(byCap[cid])}</td><td style="text-align:right">${pct}%</td></tr>`;});
    html+=`<tr><td colspan="2" style="text-align:right;font-weight:700;color:#111!important;background:#fff!important;padding:8px;border-top:3px solid #1B4432">TOTAL</td><td style="text-align:right;font-weight:700;color:#1B4432!important;background:#fff!important;padding:8px;border-top:3px solid #1B4432">${fmtP(totalGeneral)}</td><td style="text-align:right;color:#111!important;background:#fff!important;padding:8px;border-top:3px solid #1B4432">100%</td></tr></tbody></table>`;
  }
  if(SECC_STATE['sec-apu']){
    const lista=PRESUPUESTO.map(it=>DB.find(x=>x.id===it.pid)).filter(p=>p&&APU[p.cod.replace('.','_')]&&APU[p.cod.replace('.','_')].length);
    if(lista.length){
      html+=`<h3 style="font-size:11pt;color:#1B4432;margin:14px 0 7px;border-bottom:2px solid #1B4432;padding-bottom:3px">Analisis de Precios Unitarios</h3>`;
      lista.forEach(p=>{
        const ins=APU[p.cod.replace('.','_')];
        const matT=ins.filter(i=>i.tipo==='M').reduce((a,i)=>a+i.qty*i.pu,0);
        const moT =ins.filter(i=>i.tipo==='L').reduce((a,i)=>a+i.qty*i.pu,0);
        const eqT =ins.filter(i=>i.tipo==='E').reduce((a,i)=>a+i.qty*i.pu,0);
        const subT=ins.filter(i=>i.tipo==='S').reduce((a,i)=>a+i.qty*i.pu,0);
        // Encabezado de la partida
        html+=`<div style="margin-bottom:14px;border:1px solid #ddd;border-radius:6px;overflow:hidden;page-break-inside:avoid">
          <div style="background:#1B4432;color:#fff;padding:6px 12px;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="font-weight:700;font-size:9pt;color:#fff">${p.cod} - ${p.desc}</span>
            <span style="font-size:8.5pt;background:rgba(255,255,255,.15);padding:2px 8px;border-radius:4px;color:#fff">Unidad: ${p.u} &nbsp;|&nbsp; P.Unit: ${fmtP(pu(p))}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:8.5pt">
            <thead><tr style="background:#f0f7f3;-webkit-print-color-adjust:exact">
              <th style="padding:5px 10px;text-align:left;color:#1B4432;border-bottom:1px solid #c5ddd4;width:60px">Tipo</th>
              <th style="padding:5px 10px;text-align:left;color:#1B4432;border-bottom:1px solid #c5ddd4">Descripcion del insumo</th>
              <th style="padding:5px 10px;text-align:center;color:#1B4432;border-bottom:1px solid #c5ddd4;width:35px">Ud.</th>
              <th style="padding:5px 10px;text-align:right;color:#1B4432;border-bottom:1px solid #c5ddd4;width:60px">Cant.</th>
              <th style="padding:5px 10px;text-align:right;color:#1B4432;border-bottom:1px solid #c5ddd4;width:90px">P.Unit ₲</th>
              <th style="padding:5px 10px;text-align:right;color:#1B4432;border-bottom:1px solid #c5ddd4;width:90px">Subtotal ₲</th>
            </tr></thead>
            <tbody>`;
        // Filas de insumos agrupadas por tipo
        const tiposOrden=[['M','Material','#e8f2ff'],['L','Mano de Obra','#e8f9f3'],['E','Equipo','#fffae8'],['S','Subcontrato','#fff1e5']];
        tiposOrden.forEach(([tipo,tipoLabel,bg])=>{
          const grupo=ins.filter(i=>i.tipo===tipo); if(!grupo.length) return;
          html+=`<tr style="background:${bg};-webkit-print-color-adjust:exact"><td colspan="6" style="padding:3px 10px;font-size:7.5pt;font-weight:700;color:#555;letter-spacing:.04em;text-transform:uppercase">${tipoLabel}</td></tr>`;
          grupo.forEach(i=>{
            const st=i.qty*i.pu;
            html+=`<tr><td style="padding:4px 10px;color:#666;font-size:8pt"></td><td style="padding:4px 10px;color:#111">${i.desc}</td><td style="padding:4px 10px;text-align:center;color:#555">${i.u}</td><td style="padding:4px 10px;text-align:right;color:#111">${i.qty%1===0?i.qty:i.qty.toFixed(3)}</td><td style="padding:4px 10px;text-align:right;color:#111">${fmtP(i.pu)}</td><td style="padding:4px 10px;text-align:right;font-weight:600;color:#111">${fmtP(st)}</td></tr>`;
          });
        });
        // Fila de totales por tipo y total general
        html+=`<tr style="background:#f5f5f5;border-top:1px solid #ddd">
          <td colspan="4" style="padding:5px 10px;font-size:8pt;color:#555">
            ${matT>0?`<span style="margin-right:12px">Mat: ${fmtP(matT)}</span>`:''}
            ${moT>0?`<span style="margin-right:12px">M.O: ${fmtP(moT)}</span>`:''}
            ${eqT>0?`<span style="margin-right:12px">Eq: ${fmtP(eqT)}</span>`:''}
            ${subT>0?`<span>Subc: ${fmtP(subT)}</span>`:''}
          </td>
          <td style="padding:5px 10px;text-align:right;font-size:8pt;font-weight:700;color:#1B4432">P. UNITARIO</td>
          <td style="padding:5px 10px;text-align:right;font-weight:700;font-size:10pt;color:#1B4432">${fmtP(pu(p))}</td>
        </tr>
        </tbody></table></div>`;
      }); // fin lista.forEach
    }   // fin if lista.length
  }     // fin if sec-apu
  if(SECC_STATE['sec-condiciones']){
    html+=`<h3 style="font-size:11pt;color:#1B4432;margin:14px 0 7px;border-bottom:2px solid #1B4432;padding-bottom:3px">Condiciones Generales</h3>
    <table style="width:100%;border-collapse:collapse;font-size:9pt;border:1px solid #ddd">
      ${empPlazo?`<tr style="background:#f5faf7"><td style="padding:7px 12px;width:155px;font-weight:700;color:#1B4432;border-bottom:1px solid #eee">Plazo de ejecucion</td><td style="padding:7px 12px;border-bottom:1px solid #eee;color:#111">${empPlazo}</td></tr>`:''}
      ${empPago?`<tr style="background:#fff"><td style="padding:7px 12px;font-weight:700;color:#1B4432;border-bottom:1px solid #eee">Forma de pago</td><td style="padding:7px 12px;border-bottom:1px solid #eee;color:#111">${empPago}</td></tr>`:''}
      ${empValidez?`<tr style="background:#f5faf7"><td style="padding:7px 12px;font-weight:700;color:#1B4432">Validez</td><td style="padding:7px 12px;color:#111">${empValidez}</td></tr>`:''}
    </table>`;
  }
  if(SECC_STATE['sec-firmas']){
    html+=`<div class="doc-firma">
      <div class="doc-firma-item"><div class="linea"></div><p><strong>${resp||'_________________________'}</strong></p><p>Responsable Tecnico</p></div>
      <div class="doc-firma-item"><div class="linea"></div><p><strong>${cliente||'_________________________'}</strong></p><p>Cliente / Contratante</p></div>
    </div>`;
  }
  if(SECC_STATE['sec-nota']&&empNota){
    html+=`<p class="doc-nota">${empNota}</p>`;
  }
  return html;
}
function generarPreview(){
  document.getElementById('preview-doc').innerHTML = generarDocHTML() || '<p style="color:#999;text-align:center;padding:40px 0">Agrega partidas al presupuesto para ver la vista previa.</p>';
}
function imprimirDocumento(){
  const content = generarDocHTML();
  document.getElementById('print-output').innerHTML = content;
  window.print();
  setTimeout(()=>document.getElementById('print-output').innerHTML='', 500);
}

function getBudgetExportContext(){
  const wb = XLSX.utils.book_new();
  const gi=parseFloat(document.getElementById('pct-gi').value)||0;
  const bi=parseFloat(document.getElementById('pct-bi').value)||0;
  const iva=parseFloat(document.getElementById('pct-iva').value)||0;
  const factor=(1+gi/100)*(1+bi/100)*(1+iva/100);
  const puFinal=p=>Math.round(pu(p)*factor);
  return { wb, gi, bi, iva, factor, puFinal };
}

function normalizeExcelText(value){
  return String(value == null ? '' : value).trim();
}

function normalizeExcelKey(value){
  return normalizeExcelText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseExcelNumber(value){
  if(typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = normalizeExcelText(value)
    .replace(/₲/g, '')
    .replace(/gs\.?/gi, '')
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.');
  const num = parseFloat(text);
  return Number.isFinite(num) ? num : 0;
}

function ensureImportedCapitulo(id, name, color, ramos){
  const capId = String(id || '01').padStart(2, '0');
  const defaultColor = color || '#35506B';
  const defaultRamos = Array.isArray(ramos) && ramos.length ? ramos : ['todos', 'civil'];
  let cap = CAPS.find(item=>item.id === capId);

  if(!cap){
    cap = {
      id: capId,
      name: name || `Capitulo ${capId}`,
      color: defaultColor,
      ramos: [...new Set(defaultRamos)],
    };
    CAPS.push(cap);
    CAPS.sort((a,b)=>a.id.localeCompare(b.id));
    return capId;
  }

  if(name) cap.name = name;
  if(color) cap.color = color;
  if(Array.isArray(ramos) && ramos.length){
    cap.ramos = [...new Set(ramos)];
  }

  return capId;
}

function inferTipoInsumo(rawTipo, descripcion){
  const merged = `${normalizeExcelKey(rawTipo)} ${normalizeExcelKey(descripcion)}`;
  if(merged.includes('subcontr')) return 'S';
  if(merged.includes('equipo') || merged.includes('maquina') || merged.includes('herramienta')) return 'E';
  if(merged.includes('mano de obra') || merged.includes('jornal') || merged.includes('oficial') || merged.includes('ayudante')) return 'L';
  return 'M';
}

function appendCapitulosSheet(wb){
  const rows = [['ID','Capitulo','Color','Ramos']];
  CAPS
    .slice()
    .sort((a,b)=>a.id.localeCompare(b.id))
    .forEach(cap=>{
      rows.push([cap.id, cap.name, cap.color || '#35506B', (cap.ramos || []).join(', ')]);
    });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:8},{wch:34},{wch:12},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'Capitulos');
}

function appendBaseDatosSheet(wb){
  const bd = [[
    'Capitulo ID',
    'Capitulo',
    'Codigo',
    'Descripcion',
    'Unidad',
    'Ramo',
    'Materiales',
    'Mano Obra',
    'Equipo',
    'Subcontrato',
    'P. Unitario',
  ]];
  DB.forEach(p=>{
    const cap = capOf(p.cap);
    bd.push([cap.id, cap.name, p.cod, p.desc, p.u, p.ramo||'', p.mat, p.mo, p.eq, p.sub, pu(p)]);
  });
  const ws = XLSX.utils.aoa_to_sheet(bd);
  ws['!cols']=[{wch:10},{wch:30},{wch:12},{wch:54},{wch:8},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'Base de Datos');
}

function appendPresupuestoSheet(wb){
  const { gi, bi, iva, puFinal } = getBudgetExportContext();
  const pd = [
    ['PRESUPUESTO DE OBRA'],
    ['Proyecto:', document.getElementById('p-nombre').value],
    ['Cliente:', document.getElementById('p-cliente').value],
    ['Ubicacion:', document.getElementById('p-ubic').value],
    ['Responsable:', document.getElementById('p-resp').value],
    ['Nro. Presupuesto:', document.getElementById('p-nro').value],
    ['Fecha:', document.getElementById('p-fecha').value],
    [''],
    ['GI %:', gi, 'Beneficio %:', bi, 'IVA %:', iva],
    [''],
    ['Codigo','Descripcion','Unidad','P. Unit. Base ₲','P. Unit. Final ₲','Cantidad','Total ₲','Capitulo']
  ];
  const byCap={};
  PRESUPUESTO.forEach(it=>{const p=DB.find(x=>x.id===it.pid);if(!p)return;if(!byCap[p.cap])byCap[p.cap]=[];byCap[p.cap].push({it,p})});
  let total=0, totalBase=0;
  Object.keys(byCap).sort().forEach(cid=>{
    pd.push([`--- ${cid}: ${capOf(cid).name} ---`,'','','','','','','']);
    byCap[cid].forEach(({it,p})=>{
      const puf=puFinal(p); const t=puf*it.qty; total+=t;
      const pb=pu(p); totalBase+=pb*it.qty;
      pd.push([p.cod, p.desc, p.u, pb, puf, it.qty, t, capOf(p.cap).name]);
    });
  });
  pd.push([''],['','','','','','TOTAL COSTO DIRECTO','',totalBase],[],['','','','','','TOTAL OBRA (c/GI+B+IVA)','',total]);
  const ws = XLSX.utils.aoa_to_sheet(pd);
  ws['!cols']=[{wch:12},{wch:50},{wch:7},{wch:16},{wch:16},{wch:10},{wch:16},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto Final');
}

function appendGuardadosSheet(wb){
  if(PRESUPUESTOS_GUARDADOS.length){
    const pg=[['Proyectos Archivados','','','',''],['Nombre','Cliente','Nro.','Fecha','Guardado por']];
    PRESUPUESTOS_GUARDADOS.forEach(p=>pg.push([p.nombre||'-',p.cliente||'-',p.nro||'-',p.fecha||'-',p.guardadoPor||'-']));
    const ws=XLSX.utils.aoa_to_sheet(pg);
    ws['!cols']=[{wch:35},{wch:25},{wch:15},{wch:15},{wch:25}];
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos Archivados');
  }
}

function appendApuSheet(wb){
  const apuRows=[['APU - Analisis de Precio Unitario por item'],['']];
  let apuCount = 0;

  DB.forEach(p=>{
    const ins=APU[p.cod.replace(/\./g,'_')]||[];
    if(!ins.length) return;
    apuCount++;
    apuRows.push([`APU #${apuCount}: ${p.cod} - ${p.desc}`,'','','','Total por:',p.u]);
    apuRows.push(['Tipo','Material / Insumo','Unidad','Cantidad','P. Unit. (Gs.)','Subtotal (Gs.)']);
    ins.forEach(i=>{
      const st = (parseFloat(i.qty) || 0) * (parseFloat(i.pu) || 0);
      const tipoLabel = {M:'Material',L:'Mano de Obra',E:'Equipo',S:'Subcontrato'}[i.tipo] || i.tipo;
      apuRows.push([tipoLabel, i.desc, i.u, i.qty, i.pu, st]);
    });
    apuRows.push(['TOTAL APU','','','',pu(p),p.u]);
    apuRows.push(['']);
  });

  if(apuCount){
    const ws=XLSX.utils.aoa_to_sheet(apuRows);
    ws['!cols']=[{wch:18},{wch:54},{wch:10},{wch:12},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb, ws, 'APU');
  }
}

function exportarPresupuestoFinalExcel(){
  if(!PRESUPUESTO.length){
    notif('No hay partidas en el presupuesto activo', '#E05555');
    return;
  }
  const { wb } = getBudgetExportContext();
  appendPresupuestoSheet(wb);
  const nroFile = document.getElementById('p-nro').value||'OBRA';
  XLSX.writeFile(wb, `Presupuesto_Final_${nroFile}_${new Date().toISOString().split('T')[0]}.xlsx`);
  notif('Presupuesto final exportado a Excel');
}

function exportarExcel(){
  if(!isAdmin){
    notif('Solo el administrador puede exportar el Excel completo', '#E05555');
    return;
  }
  const { wb } = getBudgetExportContext();
  appendCapitulosSheet(wb);
  appendBaseDatosSheet(wb);
  appendPresupuestoSheet(wb);
  appendGuardadosSheet(wb);
  appendApuSheet(wb);
  const nroFile = document.getElementById('p-nro').value||'OBRA';
  XLSX.writeFile(wb, `PresupuestAPP_${nroFile}_${new Date().toISOString().split('T')[0]}.xlsx`);
  notif('Excel completo exportado');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// IMPORTAR EXCEL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function resetImportPreview(){
  _importData = [];
  const preview = document.getElementById('import-preview');
  const confirmBtn = document.getElementById('btn-confirmar-import');
  const importFile = document.getElementById('import-file');
  const table = document.getElementById('import-table');
  const info = document.getElementById('import-info');

  if(preview) preview.style.display = 'none';
  if(confirmBtn) confirmBtn.style.display = 'none';
  if(importFile) importFile.value = '';
  if(table) table.innerHTML = '';
  if(info) info.textContent = '';
}

function abrirImportarExcel(){
  resetImportPreview();
  abrirModal('modal-importar');
}
function dragOver(e){ e.preventDefault(); document.getElementById('import-drop-zone').classList.add('drag-over'); }
function dragLeave(e){ document.getElementById('import-drop-zone').classList.remove('drag-over'); }
function dropImport(e){
  e.preventDefault(); dragLeave(e);
  const file=e.dataTransfer.files[0]; if(!file) return;
  leerArchivoImport(file);
}
function procesarImportExcel(e){ const file=e.target.files[0]; if(!file) return; leerArchivoImport(file); }

function findSheetName(wb, aliases){
  const normalizedAliases = aliases.map(normalizeExcelKey);
  return wb.SheetNames.find(name=>{
    const normalizedName = normalizeExcelKey(name);
    return normalizedAliases.some(alias=>normalizedName.includes(alias));
  });
}

function detectHeaderRow(data, keys, maxRows){
  const searchRows = Math.min(maxRows || 12, data.length);
  for(let i = 0; i < searchRows; i++){
    const row = (data[i] || []).map(normalizeExcelKey);
    if(keys.every(key=>row.some(cell=>cell.includes(key)))) return i;
  }
  return -1;
}

function parseCapitulosSheetData(data){
  const headerRow = detectHeaderRow(data, ['id', 'capitulo'], 8);
  if(headerRow === -1) return [];
  const headers = data[headerRow].map(normalizeExcelKey);
  const idxId = headers.findIndex(h=>h === 'id' || h.includes('capitulo id'));
  const idxName = headers.findIndex(h=>h.includes('capitulo'));
  const idxColor = headers.findIndex(h=>h.includes('color'));
  const idxRamos = headers.findIndex(h=>h.includes('ramo'));

  return data
    .slice(headerRow + 1)
    .filter(row=>row.some(cell=>normalizeExcelText(cell)))
    .map(row=>{
      const id = String(normalizeExcelText(row[idxId] || '')).padStart(2, '0');
      const name = normalizeExcelText(row[idxName] || '');
      const color = normalizeExcelText(row[idxColor] || '');
      const ramos = normalizeExcelText(row[idxRamos] || '')
        .split(',')
        .map(item=>normalizeExcelKey(item))
        .filter(Boolean);
      return { id, name, color, ramos: ramos.length ? [...new Set(['todos', ...ramos])] : ['todos', 'civil'] };
    })
    .filter(row=>row.id && row.name);
}

function parseBaseDatosSheetData(data){
  const headerRow = detectHeaderRow(data, ['codigo', 'descripcion'], 10);
  if(headerRow === -1) return [];
  const headers = data[headerRow].map(normalizeExcelKey);
  const findIndex = aliases=>headers.findIndex(h=>aliases.some(alias=>h.includes(alias)));
  const idxCapId = findIndex(['capitulo id', 'cap id', 'capitulo codigo', 'capitulo']);
  const idxCapName = findIndex(['capitulo']);
  const idxCod = findIndex(['codigo']);
  const idxDesc = findIndex(['descripcion']);
  const idxUd = findIndex(['unidad', 'ud.']);
  const idxRamo = findIndex(['ramo']);
  const idxMat = findIndex(['material']);
  const idxMo = findIndex(['mano obra', 'mano de obra']);
  const idxEq = findIndex(['equipo']);
  const idxSub = findIndex(['subcontrato']);

  return data
    .slice(headerRow + 1)
    .filter(row=>row.some(cell=>normalizeExcelText(cell)))
    .map(row=>{
      const capIdRaw = normalizeExcelText(row[idxCapId] || '');
      const capId = /^\d+$/.test(capIdRaw) ? capIdRaw.padStart(2, '0') : (capIdRaw.match(/\d+/)?.[0] || '01').padStart(2, '0');
      const capName = normalizeExcelText(row[idxCapName] || '');
      return {
        cap: capId,
        capName,
        cod: normalizeExcelText(row[idxCod] || ''),
        desc: normalizeExcelText(row[idxDesc] || ''),
        u: normalizeExcelText(row[idxUd] || 'un'),
        ramo: normalizeExcelKey(row[idxRamo] || 'civil') || 'civil',
        mat: parseExcelNumber(row[idxMat]),
        mo: parseExcelNumber(row[idxMo]),
        eq: parseExcelNumber(row[idxEq]),
        sub: parseExcelNumber(row[idxSub]),
      };
    })
    .filter(row=>row.cod && row.desc);
}

function parseApuSheetData(data){
  const bloques = [];
  let i = 0;

  while(i < data.length){
    const firstCell = normalizeExcelText(data[i]?.[0] || '');
    if(!/^apu\b/i.test(firstCell)){
      i++;
      continue;
    }

    const title = firstCell;
    const afterColon = title.includes(':') ? title.split(':').slice(1).join(':').trim() : title.trim();
    const matchCode = afterColon.match(/^(\d{2}\.\d{2,3})\s*-\s*(.+)$/);
    const code = matchCode ? matchCode[1] : '';
    const desc = matchCode ? matchCode[2].trim() : afterColon;
    const unit = normalizeExcelText(data[i]?.[5] || data[i]?.[6] || 'un') || 'un';

    let j = i + 1;
    while(j < data.length && !normalizeExcelText(data[j]?.[0] || '')) j++;
    const header = (data[j] || []).map(normalizeExcelKey);
    const hasTipoColumn = header[0]?.includes('tipo');
    const insumos = [];
    let total = 0;

    j++;
    while(j < data.length){
      const row = data[j] || [];
      const label = normalizeExcelText(row[0] || '');
      const labelKey = normalizeExcelKey(label);
      if(!row.some(cell=>normalizeExcelText(cell))){
        j++;
        break;
      }
      if(/^apu\b/i.test(label)){
        j--;
        break;
      }
      if(labelKey.includes('total apu')){
        total = parseExcelNumber(row[4] || row[5]);
        j++;
        break;
      }

      const tipoBase = hasTipoColumn ? row[0] : '';
      const descCell = hasTipoColumn ? row[1] : row[0];
      const unitCell = hasTipoColumn ? row[2] : row[1];
      const qtyCell = hasTipoColumn ? row[3] : row[2];
      const puCell = hasTipoColumn ? row[4] : row[3];

      const descInsumo = normalizeExcelText(descCell || '');
      if(descInsumo){
        insumos.push({
          tipo: inferTipoInsumo(tipoBase, descInsumo),
          desc: descInsumo,
          u: normalizeExcelText(unitCell || 'un') || 'un',
          qty: parseExcelNumber(qtyCell),
          pu: parseExcelNumber(puCell),
        });
      }
      j++;
    }

    bloques.push({ cod: code, desc, u: unit, total, insumos });
    i = j + 1;
  }

  return bloques.filter(item=>item.desc && item.insumos.length);
}

function buildImportPayloadFromWorkbook(wb){
  const capitulosSheetName = findSheetName(wb, ['capitulos', 'capitulos base']);
  const baseSheetName = findSheetName(wb, ['base de datos', 'base datos']);
  const apuSheetName = findSheetName(wb, ['costeo (apus)', 'apu detallado', 'apu']);

  const capitulos = capitulosSheetName
    ? parseCapitulosSheetData(XLSX.utils.sheet_to_json(wb.Sheets[capitulosSheetName], { header: 1, defval: '' }))
    : [];

  const basePartidas = baseSheetName
    ? parseBaseDatosSheetData(XLSX.utils.sheet_to_json(wb.Sheets[baseSheetName], { header: 1, defval: '' }))
    : [];

  const apuBloques = apuSheetName
    ? parseApuSheetData(XLSX.utils.sheet_to_json(wb.Sheets[apuSheetName], { header: 1, defval: '' }))
    : [];

  const partidasMap = new Map();
  basePartidas.forEach(item=>{
    partidasMap.set(item.cod, { ...item, source: 'base' });
  });

  apuBloques.forEach((bloque, index)=>{
    const apuTotals = {
      mat: Math.round(bloque.insumos.filter(i=>i.tipo === 'M').reduce((acc, i)=>acc + (i.qty * i.pu), 0)),
      mo: Math.round(bloque.insumos.filter(i=>i.tipo === 'L').reduce((acc, i)=>acc + (i.qty * i.pu), 0)),
      eq: Math.round(bloque.insumos.filter(i=>i.tipo === 'E').reduce((acc, i)=>acc + (i.qty * i.pu), 0)),
      sub: Math.round(bloque.insumos.filter(i=>i.tipo === 'S').reduce((acc, i)=>acc + (i.qty * i.pu), 0)),
    };
    const existing = bloque.cod ? partidasMap.get(bloque.cod) : null;
    const fallbackCode = `01.${String(index + 1).padStart(2, '0')}`;
    const cod = bloque.cod || existing?.cod || fallbackCode;
    const cap = existing?.cap || cod.split('.')[0] || '01';

    partidasMap.set(cod, {
      cap,
      capName: existing?.capName || '',
      cod,
      desc: existing?.desc || bloque.desc,
      u: existing?.u || bloque.u || 'un',
      ramo: existing?.ramo || 'civil',
      mat: apuTotals.mat,
      mo: apuTotals.mo,
      eq: apuTotals.eq,
      sub: apuTotals.sub,
      source: existing ? 'base+apu' : 'apu',
      apu: bloque.insumos,
    });
  });

  return {
    capitulos,
    partidas: Array.from(partidasMap.values()),
    apuCount: apuBloques.length,
    hasBaseSheet: Boolean(baseSheetName),
    hasApuSheet: Boolean(apuSheetName),
  };
}

function getImportColorByIndex(index){
  if(typeof COLORES_PRESET !== 'undefined' && Array.isArray(COLORES_PRESET) && COLORES_PRESET.length){
    return COLORES_PRESET[index % COLORES_PRESET.length];
  }
  const fallback = ['#35506B','#48657F','#577A92','#678FA4','#76A4B6','#85B9C8'];
  return fallback[index % fallback.length];
}

function buildImportedCapitulos(metaCapitulos, partidas){
  if(Array.isArray(metaCapitulos) && metaCapitulos.length){
    return metaCapitulos.map((cap, index)=>({
      id: String(cap.id || '').padStart(2, '0'),
      name: cap.name || `Capitulo ${String(cap.id || '').padStart(2, '0')}`,
      color: cap.color || getImportColorByIndex(index),
      ramos: Array.isArray(cap.ramos) && cap.ramos.length
        ? [...new Set(['todos', ...cap.ramos])]
        : ['todos'],
    }));
  }

  const detectados = [];
  const seen = new Map();
  partidas.forEach(partida=>{
    const capId = String(partida.cap || String(partida.cod || '').split('.')[0] || '01').padStart(2, '0');
    const ramo = partida.ramo || 'civil';

    if(!seen.has(capId)){
      const nuevo = {
        id: capId,
        name: partida.capName || `Capitulo ${capId}`,
        color: getImportColorByIndex(detectados.length),
        ramos: ['todos', ramo],
      };
      seen.set(capId, nuevo);
      detectados.push(nuevo);
      return;
    }

    const actual = seen.get(capId);
    actual.ramos = [...new Set([...(actual.ramos || ['todos']), ramo])];
    if((!actual.name || /^Capitulo\s+\d+$/i.test(actual.name)) && partida.capName){
      actual.name = partida.capName;
    }
  });

  return detectados;
}

function sortImportedPartidas(partidas, capitulos){
  const orderMap = new Map(capitulos.map((cap, index)=>[cap.id, index]));
  return partidas.slice().sort((a, b)=>{
    const orderA = orderMap.has(a.cap) ? orderMap.get(a.cap) : 9999;
    const orderB = orderMap.has(b.cap) ? orderMap.get(b.cap) : 9999;
    if(orderA !== orderB) return orderA - orderB;
    return String(a.cod || '').localeCompare(String(b.cod || ''), 'es', { numeric: true });
  });
}

function limpiarDatosOperativosActuales(){
  DB = [];
  APU = {};
  CAPS = [];
  PRESUPUESTO = [];
  PRESUPUESTOS_GUARDADOS = [];
  HISTORIAL = [];
  presupuestoActivoGuardadoId = null;
  if(typeof expandedPartidas !== 'undefined') expandedPartidas = new Set();
  if(typeof collapsedCapitulos !== 'undefined') collapsedCapitulos = new Set();
  if(typeof actualizarBtnUndo === 'function') actualizarBtnUndo();
}

function reemplazarBaseDesdeImportacion(partidas, metaCapitulos){
  const capitulos = buildImportedCapitulos(metaCapitulos, partidas);
  const partidasOrdenadas = sortImportedPartidas(partidas, capitulos);

  limpiarDatosOperativosActuales();
  CAPS = capitulos;

  partidasOrdenadas.forEach((partida, index)=>{
    const cleanPartida = {
      id: index + 1,
      cap: String(partida.cap || '01').padStart(2, '0'),
      cod: partida.cod,
      desc: partida.desc,
      u: partida.u || 'un',
      ramo: partida.ramo || 'civil',
      mat: Math.round(partida.mat || 0),
      mo: Math.round(partida.mo || 0),
      eq: Math.round(partida.eq || 0),
      sub: Math.round(partida.sub || 0),
    };
    DB.push(cleanPartida);

    if(Array.isArray(partida.apu) && partida.apu.length){
      APU[cleanPartida.cod.replace(/\./g, '_')] = partida.apu.map(item=>({
        tipo: item.tipo || inferTipoInsumo('', item.desc),
        desc: item.desc,
        u: item.u || 'un',
        qty: parseFloat(item.qty) || 0,
        pu: Math.round(parseFloat(item.pu) || 0),
      }));
    }
  });

  if(typeof sanearEstadoApp === 'function') sanearEstadoApp();
}

function leerArchivoImport(file){
  const r=new FileReader(); r.onload=ev=>{
    try{
      const wb=XLSX.read(ev.target.result,{type:'binary'});
      const rawPayload = buildImportPayloadFromWorkbook(wb);
      const payload = typeof sanitizeAppPayload === 'function'
        ? sanitizeAppPayload(rawPayload)
        : rawPayload;
      if(!payload.partidas.length){
        notif('No se encontraron partidas validas en el Excel', '#E05555');
        return;
      }

      _importData = payload.partidas;
      _importData.meta = {
        capitulos: payload.capitulos,
        apuCount: payload.apuCount,
        hasBaseSheet: payload.hasBaseSheet,
        hasApuSheet: payload.hasApuSheet,
        sourceName: file.name,
      };

      // Preview
      const preview=document.getElementById('import-preview');
      const info=document.getElementById('import-info');
      const tbl=document.getElementById('import-table');
      const meta = _importData.meta;
      info.textContent = `${_importData.length} partidas detectadas en "${file.name}"${meta.hasApuSheet ? ` | ${meta.apuCount} APUs` : ''}${meta.capitulos.length ? ` | ${meta.capitulos.length} capitulos` : ''}. Esta importacion reemplazara la base actual y ordenara las partidas por capitulo.`;
      let th='<thead><tr><th style="padding:5px 8px;background:var(--bg2);font-size:10px;color:var(--txt3)">Codigo</th><th style="padding:5px 8px;background:var(--bg2);font-size:10px;color:var(--txt3)">Descripcion</th><th style="padding:5px 8px;background:var(--bg2);font-size:10px;color:var(--txt3)">Ud.</th><th style="padding:5px 8px;background:var(--bg2);font-size:10px;color:var(--txt3);text-align:right">P. Unit. Gs.</th><th style="padding:5px 8px;background:var(--bg2);font-size:10px;color:var(--txt3);text-align:center">APU</th></tr></thead><tbody>';
      _importData.slice(0,10).forEach(r=>{
        const total = (r.mat || 0) + (r.mo || 0) + (r.eq || 0) + (r.sub || 0);
        th+=`<tr><td style="padding:4px 8px;font-size:11px;font-family:monospace">${r.cod}</td><td style="padding:4px 8px;font-size:11px">${r.desc}</td><td style="padding:4px 8px;font-size:11px">${r.u}</td><td style="padding:4px 8px;font-size:11px;text-align:right">${fmtN(total)}</td><td style="padding:4px 8px;font-size:11px;text-align:center">${Array.isArray(r.apu) && r.apu.length ? `${r.apu.length} ins.` : '-'}</td></tr>`;
      });
      if(_importData.length>10) th+=`<tr><td colspan="5" style="padding:6px 8px;font-size:10px;color:var(--txt3);text-align:center">... y ${_importData.length-10} mas</td></tr>`;
      th+='</tbody>';
      tbl.innerHTML=th; preview.style.display='block';
      document.getElementById('btn-confirmar-import').style.display='';
    }catch(e){ notif('Error al leer el archivo: '+e.message,'#E05555'); }
  }; r.readAsBinaryString(file);
}
async function confirmarImport(){
  if(!_importData.length) return;
  const meta = _importData.meta || {};
  const totalPartidas = _importData.length;
  const totalCapitulos = buildImportedCapitulos(meta.capitulos || [], _importData).length;
  const confirmMsg = `Se va a reemplazar la base operativa actual con "${meta.sourceName || 'el Excel seleccionado'}".\n\nEsto va a borrar:\n- Partidas actuales\n- APUs actuales\n- Presupuesto activo\n- Presupuestos guardados\n\nCapitulos detectados: ${totalCapitulos}\nPartidas detectadas: ${totalPartidas}\n\nDeseas continuar?`;
  if(!confirm(confirmMsg)) return;

  reemplazarBaseDesdeImportacion(_importData, meta.capitulos || []);

  cerrarModal('modal-importar');
  marcarUnsaved();
  renderBD();
  renderDashboard();
  if(typeof renderPres === 'function') renderPres();
  if(typeof renderGuardados === 'function') renderGuardados();
  if(typeof recalcResumen === 'function') recalcResumen();
  if(typeof generarPreview === 'function') generarPreview();
  await guardarFirebase(true);
  resetImportPreview();
  notif(`Base reemplazada: ${totalPartidas} partidas en ${totalCapitulos} capitulos.`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PRESUPUESTOS GUARDADOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
