document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey){
    if(['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    e.preventDefault();
    deshacerUltima();
  }

  if((e.ctrlKey || e.metaKey) && e.key === 's'){
    e.preventDefault();
    guardarFirebase();
  }

  if(e.key === 'Escape'){
    document.querySelectorAll('.modal-bg.open').forEach(modal => cerrarModal(modal.id));
    ocultarResultadosGlobal();
  }
});

document.querySelectorAll('.modal-bg').forEach(modal => {
  modal.addEventListener('click', e => {
    if(e.target === modal) cerrarModal(modal.id);
  });
});

window.addEventListener('beforeunload', e => {
  if(hayUnsaved){
    e.preventDefault();
    e.returnValue = '';
  }
});

document.addEventListener('click', e => {
  if(!document.querySelector('.global-search-wrap')?.contains(e.target)){
    ocultarResultadosGlobal();
  }
});
