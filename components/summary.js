function recalcResumen(){
  const cd = cdTotal();
  const gi = parseFloat(document.getElementById('pct-gi').value) || 0;
  const bi = parseFloat(document.getElementById('pct-bi').value) || 0;
  const iva = parseFloat(document.getElementById('pct-iva').value) || 0;

  const giV = cd * gi / 100;
  const sub1 = cd + giV;
  const biV = sub1 * bi / 100;
  const sub2 = sub1 + biV;
  const ivaV = sub2 * iva / 100;
  const total = sub2 + ivaV;

  document.getElementById('r-cd').textContent = fmt(cd);
  document.getElementById('r-gi').textContent = fmt(giV);
  document.getElementById('r-sub1').textContent = fmt(sub1);
  document.getElementById('r-bi').textContent = fmt(biV);
  document.getElementById('r-sub2').textContent = fmt(sub2);
  document.getElementById('r-iva').textContent = fmt(ivaV);
  document.getElementById('r-total').textContent = fmt(total);

  const byCap = {};
  PRESUPUESTO.forEach(it => {
    const p = DB.find(x => x.id === it.pid);
    if(!p) return;
    if(!byCap[p.cap]) byCap[p.cap] = 0;
    byCap[p.cap] += pu(p) * it.qty;
  });

  let cHtml = '';
  if(!Object.keys(byCap).length){
    cHtml = '<p style="color:var(--txt3);font-style:italic;font-size:12px">Sin partidas en el presupuesto</p>';
  }else{
    const mx = Math.max(...Object.values(byCap));
    Object.keys(byCap).sort().forEach(cid => {
      const cap = capOf(cid);
      const pct = cd > 0 ? (byCap[cid] / cd * 100).toFixed(1) : 0;
      const w = mx > 0 ? (byCap[cid] / mx * 100).toFixed(1) : 0;
      cHtml += `<div class="barra-item"><div class="barra-label"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${cap.color};margin-right:5px"></span>${cid}. ${cap.name}</div><div class="barra-track"><div class="barra-fill" style="width:${w}%;background:${cap.color}"></div></div><div class="barra-val">${pct}% - ${fmtN(byCap[cid])}</div></div>`;
    });
  }
  document.getElementById('res-caps').innerHTML = cHtml;

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

  let tHtml = '';
  if(!cd){
    tHtml = '<p style="color:var(--txt3);font-style:italic;font-size:12px">Sin datos</p>';
  }else{
    [
      ['Materiales', matT, '#77c8ff'],
      ['Mano de Obra', moT, '#5ec8ff'],
      ['Equipo', eqT, '#D4B820'],
      ['Subcontrato', subT, '#E89020'],
    ].forEach(([label, value, color]) => {
      if(!value) return;
      const pct = (value / cd * 100).toFixed(1);
      tHtml += `<div class="barra-item"><div class="barra-label" style="color:${color};font-weight:700">${label}</div><div class="barra-track"><div class="barra-fill" style="width:${pct}%;background:${color}"></div></div><div class="barra-val" style="color:${color}">${pct}% - ${fmtN(value)}</div></div>`;
    });
  }
  document.getElementById('res-tipos').innerHTML = tHtml;
}

function numeroALetras(n){
  n = Math.round(n);
  if(n === 0) return 'CERO';
  const u = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const d = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const c = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function lt100(x){
    if(x < 20) return u[x];
    const dec = Math.floor(x / 10);
    const uni = x % 10;
    if(dec === 2 && uni > 0) return 'VEINTI' + u[uni];
    return d[dec] + (uni ? ' Y ' + u[uni] : '');
  }

  function lt1000(x){
    if(x < 100) return lt100(x);
    const cent = Math.floor(x / 100);
    const rest = x % 100;
    if(x === 100) return 'CIEN';
    return c[cent] + (rest ? ' ' + lt100(rest) : '');
  }

  function lt1M(x){
    if(x < 1000) return lt1000(x);
    const mil = Math.floor(x / 1000);
    const rest = x % 1000;
    return (mil === 1 ? 'MIL' : lt1000(mil) + ' MIL') + (rest ? ' ' + lt1000(rest) : '');
  }

  if(n < 1000000) return lt1M(n);
  const mill = Math.floor(n / 1000000);
  const rest = n % 1000000;
  return (mill === 1 ? 'UN MILLON' : lt1M(mill) + ' MILLONES') + (rest ? ' ' + lt1M(rest) : '');
}

const COLORES_PRESET = ['#4A7C5A','#8B6A14','#9B2020','#8B5A1A','#1A5A8B','#3A7A30','#8A3070','#1A7A5A','#5A4AAA','#6A6A6A','#8A6A14','#2A7A55','#C45000','#1A6B8B'];

function initSecciones(){
  ['sec-portada', 'sec-detalle', 'sec-letras', 'sec-firmas'].forEach(s => SECC_STATE[s] = true);
  ['sec-apu', 'sec-caps', 'sec-condiciones', 'sec-nota', 'sec-nota-pct'].forEach(s => SECC_STATE[s] = false);
}

function toggleSeccion(label, secId){
  const cb = label.querySelector('input[type=checkbox]');
  cb.checked = !cb.checked;
  label.classList.toggle('on', cb.checked);
  SECC_STATE[secId] = cb.checked;
  generarPreview();
}

function cargarLogo(){
  document.getElementById('logo-input').click();
}

function mostrarLogo(e){
  const file = e.target.files[0];
  if(!file) return;
  const r = new FileReader();
  r.onload = ev => {
    logoDataURL = ev.target.result;
    const prev = document.getElementById('logo-preview');
    prev.innerHTML = `<img src="${logoDataURL}" style="width:100%;height:100%;object-fit:contain;border-radius:6px">`;
    generarPreview();
    marcarUnsaved();
  };
  r.readAsDataURL(file);
}
