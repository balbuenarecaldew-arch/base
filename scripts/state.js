let CAPS = [
  {id:'01',name:'Trabajos previos y demoliciones',color:'#4A7C5A',ramos:['todos','civil','vial']},
  {id:'02',name:'Movimiento de tierras',color:'#8B6A14',ramos:['todos','civil','vial']},
  {id:'03',name:'Fundaciones y estructuras',color:'#9B2020',ramos:['todos','civil','vial']},
  {id:'04',name:'Mampostería y albañilería',color:'#8B5A1A',ramos:['todos','civil']},
  {id:'05',name:'Cubierta y techos',color:'#1A5A8B',ramos:['todos','civil']},
  {id:'06',name:'Revestimientos y terminaciones',color:'#3A7A30',ramos:['todos','civil','acabados']},
  {id:'07',name:'Carpintería y vidriería',color:'#8A3070',ramos:['todos','civil','acabados']},
  {id:'08',name:'Instalaciones sanitarias',color:'#1A7A5A',ramos:['todos','civil','sanitaria']},
  {id:'09',name:'Instalaciones eléctricas',color:'#5A4AAA',ramos:['todos','civil','electrica']},
  {id:'10',name:'Instalaciones HVAC y refrigeración',color:'#1A5A8B',ramos:['todos','civil','hvac']},
  {id:'11',name:'Pinturas e impermeabilizaciones',color:'#8A6A14',ramos:['todos','civil','acabados']},
  {id:'12',name:'Pavimentos y obras viales',color:'#6A6A6A',ramos:['todos','vial']},
  {id:'13',name:'Paisajismo y exteriores',color:'#2A7A55',ramos:['todos','civil']},
];
const RAMO_COLORS = {
  todos:'#5EC8FF',
  vial:'#E8A84B',
  civil:'#4AABEF',
  electrica:'#D4B820',
  sanitaria:'#46C2CF',
  hvac:'#89A8FF',
  acabados:'#C78BBE'
};

let DB = [], APU = {}, PRESUPUESTO = [];
let HISTORIAL = [], hayUnsaved = false;
let ramoActivo = 'todos', editPid = null, editInsCod = null, editInsIdx = null;
let logoDataURL = null, currentUser = null, isAdmin = false;
let EMPRESAS = {};
let empresaActivaId = null;
let PRESUPUESTOS_GUARDADOS = [];
let presupuestoActivoGuardadoId = null;
let appAbierta = false;
let SECC_STATE = {};
let _importData = [];
let dashCharts = {};
let _ignorarProximoSnapshotPres = 0; // timestamp - ignorar snapshots hasta este momento
let _initialLoadDone = false; // solo restaurar config en primer load
let _firestoreUnsub = null; // unsubscriber del listener de Firestore

// Helpers
const pu  = p => (p.mat||0)+(p.mo||0)+(p.eq||0)+(p.sub||0);
const fmt  = n => '₲ ' + Math.round(n).toLocaleString('es-PY');
const fmtN = n => Math.round(n).toLocaleString('es-PY');
const capOf = id => CAPS.find(c=>c.id===id) || {name:'Sin capítulo',color:'#888',ramos:['todos']};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// OFFLINE DETECTION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
window.addEventListener('online', () => {
  document.getElementById('offline-banner').classList.remove('visible');
  notif('Conexion restablecida');
  if(hayUnsaved) guardarFirebase();
});
window.addEventListener('offline', () => {
  document.getElementById('offline-banner').classList.add('visible');
  notif('Sin conexion. Los cambios se guardan localmente.', '#E89020');
});

// Cache offline con localStorage
function guardarCacheLocal(){
  try{
    if(typeof sanearEstadoApp === 'function') sanearEstadoApp();
    const data = {DB,APU,PRESUPUESTO,CAPS,EMPRESAS,empresaActivaId,PRESUPUESTOS_GUARDADOS,
      presupuesto_activo:{
        nombre:document.getElementById('p-nombre')?.value||'',
        cliente:document.getElementById('p-cliente')?.value||'',
        ubic:document.getElementById('p-ubic')?.value||'',
        resp:document.getElementById('p-resp')?.value||'',
        nro:document.getElementById('p-nro')?.value||'',
        fecha:document.getElementById('p-fecha')?.value||'',
        pctGi:document.getElementById('pct-gi')?.value||'13',
        pctBi:document.getElementById('pct-bi')?.value||'6',
        pctIva:document.getElementById('pct-iva')?.value||'10',
      },
      ts: Date.now()
    };
    localStorage.setItem('presupuestapp_cache', JSON.stringify(data));
  }catch(e){console.warn('Cache local no disponible:', e.message)}
}
function cargarCacheLocal(){
  try{
    const raw = localStorage.getItem('presupuestapp_cache');
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof sanitizeAppPayload === 'function' ? sanitizeAppPayload(parsed) : parsed;
  }catch(e){return null}
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUTO-LOGOUT POR INACTIVIDAD (20 minutos)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 min
const WARNING_BEFORE = 60 * 1000; // aviso 60s antes
let inactivityTimer = null;
let warningTimer = null;
let countdownInterval = null;

function resetInactivity(){
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);
  clearInterval(countdownInterval);
  document.getElementById('inactivity-warning').classList.remove('show');
  if(!appAbierta) return;
  warningTimer = setTimeout(mostrarWarningInactividad, INACTIVITY_TIMEOUT - WARNING_BEFORE);
  inactivityTimer = setTimeout(() => {
    if(appAbierta){ notif('Sesion cerrada por inactividad', '#E89020'); cerrarSesion(true); }
  }, INACTIVITY_TIMEOUT);
}
function mostrarWarningInactividad(){
  const warn = document.getElementById('inactivity-warning');
  warn.classList.add('show');
  let secs = 60;
  document.getElementById('inactivity-countdown').textContent = secs;
  countdownInterval = setInterval(() => {
    secs--;
    document.getElementById('inactivity-countdown').textContent = secs;
    if(secs <= 0){ clearInterval(countdownInterval); warn.classList.remove('show'); }
  }, 1000);
}
['mousemove','keydown','click','touchstart','scroll'].forEach(e =>
  document.addEventListener(e, resetInactivity, {passive:true})
);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUTOSAVE (cada 2 minutos si hay cambios sin guardar)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let autosaveTimer = null;
function iniciarAutosave(){
  clearInterval(autosaveTimer);
  autosaveTimer = setInterval(async () => {
    if(hayUnsaved && currentUser && navigator.onLine){
      const el = document.getElementById('autosave-info');
      const txt = document.getElementById('autosave-text');
      el.classList.add('saving');
      txt.textContent = 'Guardando automaticamente...';
      await guardarFirebase(true);
      el.classList.remove('saving');
      el.classList.add('saved');
      txt.textContent = 'Auto-guardado a las ' + new Date().toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'});
      setTimeout(() => { el.classList.remove('saved'); txt.textContent = 'Guardado automatico activo'; }, 3000);
    }
    guardarCacheLocal();
  }, 2 * 60 * 1000);
}

