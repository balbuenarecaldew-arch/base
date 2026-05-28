const CP1252_SPECIAL_BYTE_MAP = {
  8364: 128,
  8218: 130,
  402: 131,
  8222: 132,
  8230: 133,
  8224: 134,
  8225: 135,
  710: 136,
  8240: 137,
  352: 138,
  8249: 139,
  338: 140,
  381: 142,
  8216: 145,
  8217: 146,
  8220: 147,
  8221: 148,
  8226: 149,
  8211: 150,
  8212: 151,
  732: 152,
  8482: 153,
  353: 154,
  8250: 155,
  339: 156,
  382: 158,
  376: 159,
};

function toNonNegativeNumber(value){
  return Math.max(0, parseFloat(value) || 0);
}

function nextNumericId(collection){
  return collection.length ? Math.max(...collection.map(item=>item.id)) + 1 : 1;
}

function maybeDecodeLatin1Mojibake(text){
  if(typeof text !== 'string' || !/[ÃÂâð]/.test(text)) return text;

  try{
    const bytes = [];
    for(const char of text){
      const code = char.codePointAt(0);
      if(code <= 255){
        bytes.push(code);
        continue;
      }
      if(CP1252_SPECIAL_BYTE_MAP[code] !== undefined){
        bytes.push(CP1252_SPECIAL_BYTE_MAP[code]);
        continue;
      }
      return text;
    }

    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    return decoded || text;
  }catch(_error){
    return text;
  }
}

function sanitizeAppText(value){
  if(typeof value !== 'string') return value;

  let text = value;
  for(let i = 0; i < 3; i++){
    const decoded = maybeDecodeLatin1Mojibake(text);
    if(decoded === text) break;
    text = decoded;
  }

  return text
    .replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\u2713/g, 'OK')
    .replace(/[\u2013\u2014]/g, '-');
}

function sanitizeDataDeep(value){
  if(Array.isArray(value)) return value.map(item=>sanitizeDataDeep(item));
  if(value && typeof value === 'object'){
    const proto = Object.getPrototypeOf(value);
    if(proto && proto !== Object.prototype && proto !== null) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item])=>[key, sanitizeDataDeep(item)])
    );
  }
  return sanitizeAppText(value);
}

function sanitizeCapitulosList(capitulos){
  if(!Array.isArray(capitulos)) return [];
  return capitulos.map(cap=>({
    ...cap,
    id: String(cap.id || '').padStart(2, '0'),
    name: sanitizeAppText(cap.name || `Capitulo ${cap.id || ''}`),
    color: cap.color || '#35506B',
    ramos: (() => {
      const baseRamos = Array.isArray(cap.ramos) && cap.ramos.length
        ? cap.ramos.map(item=>sanitizeAppText(item || '').toLowerCase())
        : [];
      return [...new Set(['todos', ...baseRamos])];
    })(),
  }));
}

function sanitizePartidasList(partidas){
  if(!Array.isArray(partidas)) return [];
  return partidas.map(partida=>({
    ...partida,
    cap: String(partida.cap || '01').padStart(2, '0'),
    cod: sanitizeAppText(partida.cod || ''),
    desc: sanitizeAppText(partida.desc || ''),
    u: sanitizeAppText(partida.u || 'un'),
    ramo: sanitizeAppText(partida.ramo || 'civil').toLowerCase(),
    mat: Math.round(parseFloat(partida.mat) || 0),
    mo: Math.round(parseFloat(partida.mo) || 0),
    eq: Math.round(parseFloat(partida.eq) || 0),
    sub: Math.round(parseFloat(partida.sub) || 0),
  }));
}

function sanitizeApuMap(apu){
  if(!apu || typeof apu !== 'object') return {};
  return Object.fromEntries(
    Object.entries(apu).map(([key, items])=>[
      sanitizeAppText(key),
      Array.isArray(items)
        ? items.map(item=>({
            ...item,
            tipo: sanitizeAppText(item.tipo || 'M'),
            resourceId: sanitizeAppText(item.resourceId || ''),
            desc: sanitizeAppText(item.desc || ''),
            u: sanitizeAppText(item.u || 'un'),
            qty: parseFloat(item.qty) || 0,
            pu: Math.round(parseFloat(item.pu) || 0),
          }))
        : [],
    ])
  );
}

function sanitizeCatalogoItem(item, tipoFallback){
  return {
    ...item,
    id: sanitizeAppText(item.id || ''),
    tipo: sanitizeAppText(item.tipo || tipoFallback || 'M'),
    desc: sanitizeAppText(item.desc || ''),
    u: sanitizeAppText(item.u || 'un'),
    pu: Math.round(parseFloat(item.pu) || 0),
    categoria: sanitizeAppText(item.categoria || ''),
    grupo: sanitizeAppText(item.grupo || ''),
  };
}

function sanitizeCatalogosMap(catalogos){
  const base = { M: [], L: [], E: [], S: [] };
  if(!catalogos || typeof catalogos !== 'object') return base;

  Object.keys(base).forEach(tipo=>{
    const items = Array.isArray(catalogos[tipo]) ? catalogos[tipo] : [];
    base[tipo] = items
      .map(item=>sanitizeCatalogoItem(item || {}, tipo))
      .filter(item=>item.id && item.desc);
  });

  return base;
}

function sanitizePresupuestoList(items){
  if(!Array.isArray(items)) return [];
  return items.map(item=>({
    ...item,
    pid: parseInt(item.pid, 10) || item.pid,
    qty: parseFloat(item.qty) || 0,
  }));
}

function sanitizeAppPayload(payload){
  const data = sanitizeDataDeep(payload || {});

  if(Array.isArray(data.DB)) data.DB = sanitizePartidasList(data.DB);
  if(data.APU) data.APU = sanitizeApuMap(data.APU);
  if(data.CATALOGOS) data.CATALOGOS = sanitizeCatalogosMap(data.CATALOGOS);
  if(data.catalogos) data.catalogos = sanitizeCatalogosMap(data.catalogos);
  if(Array.isArray(data.CAPS)) data.CAPS = sanitizeCapitulosList(data.CAPS);
  if(Array.isArray(data.PRESUPUESTO)) data.PRESUPUESTO = sanitizePresupuestoList(data.PRESUPUESTO);
  if(Array.isArray(data.PRESUPUESTOS_GUARDADOS)){
    data.PRESUPUESTOS_GUARDADOS = data.PRESUPUESTOS_GUARDADOS.map(item=>sanitizeDataDeep(item));
  }
  if(data.EMPRESAS) data.EMPRESAS = sanitizeDataDeep(data.EMPRESAS);
  if(data.presupuesto_activo) data.presupuesto_activo = sanitizeDataDeep(data.presupuesto_activo);
  if(data.config) data.config = sanitizeDataDeep(data.config);

  return data;
}

function sanearEstadoApp(){
  if(typeof DB !== 'undefined') DB = sanitizePartidasList(DB);
  if(typeof APU !== 'undefined') APU = sanitizeApuMap(APU);
  if(typeof CATALOGOS !== 'undefined') CATALOGOS = sanitizeCatalogosMap(CATALOGOS);
  if(typeof CAPS !== 'undefined') CAPS = sanitizeCapitulosList(CAPS);
  if(typeof PRESUPUESTO !== 'undefined') PRESUPUESTO = sanitizePresupuestoList(PRESUPUESTO);
  if(typeof PRESUPUESTOS_GUARDADOS !== 'undefined' && Array.isArray(PRESUPUESTOS_GUARDADOS)){
    PRESUPUESTOS_GUARDADOS = PRESUPUESTOS_GUARDADOS.map(item=>sanitizeDataDeep(item));
  }
  if(typeof EMPRESAS !== 'undefined' && EMPRESAS){
    EMPRESAS = sanitizeDataDeep(EMPRESAS);
  }
}
