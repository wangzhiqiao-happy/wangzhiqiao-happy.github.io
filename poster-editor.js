(() => {
  const byId = id => document.getElementById(id);
  const home = document.querySelector('.home');
  const dialog = byId('posterEditor'), preview = byId('posterPreview');
  const file = byId('posterFile'), zoom = byId('posterZoom'), status = byId('posterStatus');
  const key = 'melfy.home.poster.v1';
  const original = {image:'', ratio:1148/1530, zoom:441/402, x:5/39, y:1};
  const clamp = n => Math.max(0, Math.min(1, n));
  let saved = original, draft, drag, job = 0;
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (value && (value.image === '' || /^data:image\/jpeg;base64,/.test(value.image)) &&
        ['ratio','zoom','x','y'].every(k=>Number.isFinite(value[k])) && value.ratio>0) saved=value;
  } catch {}
  function dimensions(p) {
    const frameRatio = 402/509;
    return {w:Math.max(1,p.ratio/frameRatio)*p.zoom,h:Math.max(1,frameRatio/p.ratio)*p.zoom};
  }
  function paint(el,p) {
    const {w,h}=dimensions(p);
    el.style.setProperty('--poster-image',p.image?'url("'+p.image+'")':"url('./melfy-today.jpg')");
    el.style.setProperty('--poster-width',100*w+'%');
    el.style.setProperty('--poster-height',100*h+'%');
    el.style.setProperty('--poster-x',100*p.x+'%');
    el.style.setProperty('--poster-y',100*p.y+'%');
  }
  const refresh=()=>{paint(preview,draft);zoom.value=draft.zoom};
  paint(home,saved);
  byId('editPoster').onclick=()=>{
    draft={...saved};status.textContent='';file.value='';refresh();dialog.showModal();
  };
  dialog.onclose=()=>{job++;drag=null;byId('posterSave').disabled=false};
  file.onchange=async()=>{
    const picked=file.files[0];if(!picked)return;
    const ticket=++job,url=URL.createObjectURL(picked);
    byId('posterSave').disabled=true;status.textContent='正在载入图片…';
    try {
      const img=new Image();img.src=url;await img.decode();
      if(ticket!==job)return;
      const scale=Math.min(1,1100/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      draft={image:canvas.toDataURL('image/jpeg',.82),ratio:canvas.width/canvas.height,zoom:1,x:.5,y:.5};refresh();status.textContent='';
    } catch {if(ticket===job)status.textContent='无法打开这张图片，请选择 JPG 或 PNG。'}
    finally {URL.revokeObjectURL(url);if(ticket===job)byId('posterSave').disabled=false}
  };
  zoom.oninput=()=>{draft.zoom=Number(zoom.value);refresh()};
  preview.onpointerdown=e=>{preview.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:draft.x,py:draft.y}};
  preview.onpointermove=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const {w,h}=dimensions(draft), rect=preview.getBoundingClientRect();
    if(w>1.0001)draft.x=clamp(drag.px-(e.clientX-drag.x)/(rect.width*(w-1)));
    if(h>1.0001)draft.y=clamp(drag.py-(e.clientY-drag.y)/(rect.height*(h-1)));
    refresh();
  };
  preview.onlostpointercapture=()=>{drag=null};
  byId('posterReset').onclick=()=>{job++;byId('posterSave').disabled=false;draft={...original};file.value='';status.textContent='';refresh()};
  byId('posterSave').onclick=()=>{
    try{localStorage.setItem(key,JSON.stringify(draft));saved={...draft};paint(home,saved);dialog.close()}
    catch{status.textContent='本机空间不足，海报未保存。请选一张较小的图片。'}
  };
})();
