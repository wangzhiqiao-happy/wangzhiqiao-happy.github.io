// Apply local changes since the last confirmed snapshot to the latest server copy.
function mergeShiciRows(base, local, remote, field) {
  const sameRow = (one,two) => one && two && Object.keys(one).length === Object.keys(two).length && Object.keys(one).every(key => one[key] === two[key]);
  const original = new Map(base.map(item => [item.id, item]));
  const current = new Map(local.map(item => [item.id, item]));
  const result = new Map(remote.map(item => [item.id, item]));
  for (const before of base) {
    if (!current.has(before.id) && sameRow(result.get(before.id),before)) result.delete(before.id);
  }
  for (const item of local) {
    const before = original.get(item.id);
    if (!before && !result.has(item.id)) {
      const match = Array.from(result.values()).find(other => other[field].trim().toLowerCase() === item[field].trim().toLowerCase());
      if (match) continue;
    }
    if (before && !result.has(item.id) && sameRow(before,item)) continue;
    const merged = {...(result.get(item.id) || item)};
    for (const key of Object.keys(item)) {
      if ((!before && !result.has(item.id)) || (before && item[key] !== before[key])) merged[key] = item[key];
    }
    result.set(item.id, merged);
  }
  return Array.from(result.values());
}

function startShiciCloud({read, apply}) {
  const callback = new URLSearchParams(location.hash.slice(1));
  let recovering = callback.get('type') === 'recovery';
  const callbackFailed = callback.has('error') || callback.has('error_code');
  let showCallbackError = callbackFailed;
  function openCloudSettings() {
    document.getElementById('openSettings').click();
    document.getElementById('cloudStatus').scrollIntoView({block:'nearest'});
  }
  const client = window.supabase.createClient('https://jyqvqrvmniuhbupeyati.supabase.co','sb_publishable_uicWI8gT1qfXn010wh8XOA__9zq1jqK');
  const el = id => document.getElementById(id);
  const status = message => { el('cloudStatus').textContent = message; };
  for(const toggle of document.querySelectorAll('[data-password]')){
    const input=el(toggle.dataset.password);
    const setVisible=visible=>{
      input.type=visible?'text':'password';
      toggle.setAttribute('aria-pressed',String(visible));
      toggle.setAttribute('aria-label',visible?'隐藏密码':'显示密码');
    };
    toggle.onclick=()=>setVisible(input.type==='password');
    input.form.addEventListener('submit',()=>setVisible(false));
  }
  const binding = 'shici.cloud.owner';
  let account = null, busy = false, pending = false, timer;
  function controls(){
    el('cloudAuth').hidden = !!account;
    el('cloudAccount').hidden = !account || recovering;
    el('cloudRecovery').hidden = !account || !recovering;
    el('cloudForgot').hidden = !!account;
    el('cloudAddress').textContent = account?.email || '';
    el('cloudSignout').disabled = busy;
    el('cloudMerge').disabled = busy;
  }
  function schedule(){
    if(!account || localStorage.getItem(binding)!==account.id)return;
    status('待同步');clearTimeout(timer);timer=setTimeout(sync,450);
  }
  async function sync(){
    const uid=account?.id;
    if(!uid || localStorage.getItem(binding)!==uid)return;
    if(busy){pending=true;return}
    busy=true;controls();status('同步中…');
    try{
      const key='shici.cloud.base.'+uid;
      const base=JSON.parse(localStorage.getItem(key)||'{"words":[],"sentences":[]}');
      for(let attempt=0;attempt<4;attempt++){
        const {data:remote,error}=await client.from('shici_library').select('*').eq('user_id',uid).maybeSingle();
        if(error)throw error;
        if(account?.id!==uid)return;
        const local=read();
        const next={words:mergeShiciRows(base.words,local.words,remote?.words||[],'word'),sentences:mergeShiciRows(base.sentences,local.sentences,remote?.sentences||[],'english')};
        let time=remote?.updated_at;
        if(!remote || JSON.stringify(next)!==JSON.stringify({words:remote.words,sentences:remote.sentences})){
          time=new Date().toISOString();
          const payload={...next,updated_at:time,revision:crypto.randomUUID(),user_id:uid};
          const table=client.from('shici_library');
          const query=remote?table.update(payload).eq('user_id',uid).eq('revision',remote.revision):table.insert(payload);
          const saved=await query.select('revision');
          if(saved.error?.code==='23505')continue;
          if(saved.error)throw saved.error;
          if(!saved.data?.length)continue;
        }
        if(account?.id!==uid)return;
        const latest=read();
        const final={words:mergeShiciRows(local.words,latest.words,next.words,'word'),sentences:mergeShiciRows(local.sentences,latest.sentences,next.sentences,'english')};
        if(JSON.stringify(latest)!==JSON.stringify(final))apply(final);
        localStorage.setItem(key,JSON.stringify(next));
        pending=JSON.stringify(final)!==JSON.stringify(next);
        status('已同步 · '+new Date(time).toLocaleString('zh-CN'));return;
      }
      throw Error('云端词库正在更新，请重试');
    }catch{status('待同步 · 请检查网络，点「立即同步」重试')}
    finally{busy=false;controls();if(pending){pending=false;schedule()}}
  }
  client.auth.onAuthStateChange((_event,session)=>{
    const changed=account?.id!==session?.user?.id;
    account=session?.user||null;controls();
    if(showCallbackError || (recovering && !account && _event==='INITIAL_SESSION')){
      showCallbackError=false;recovering=false;controls();openCloudSettings();
      status('邮件链接已失效或未能打开，请用「忘记密码」发送新邮件。');
      return;
    }
    if(!account){status('登录后可同步这台设备的词和句子');return}
    if(_event==='PASSWORD_RECOVERY' || recovering){
      recovering=true;controls();status('请设置新的拾词密码');openCloudSettings();return;
    }
    if(changed && localStorage.getItem(binding)!==account.id)status('首次登录，请确认合并本机词库');
    if(changed) schedule();
  });
  function authMessage(error){
    if(error.code==='invalid_credentials')return '邮箱或拾词密码未通过。已有账号可点「忘记密码」。';
    if(error.code==='email_not_confirmed')return '邮箱尚未验证，请打开最新确认邮件。';
    if(error.status===429)return '邮件或登录请求过于频繁，请稍后再试。';
    return error.message || '请检查网络后重试';
  }
  el('cloudForgot').onclick=async()=>{
    const email=el('cloudEmail');
    const feedback=el('cloudResetStatus'),button=el('cloudForgot');
    email.value=email.value.trim();
    if(!email.checkValidity()){
      feedback.textContent='请先在上方填写注册拾词时用的邮箱。';
      email.focus();
      return;
    }
    button.disabled=true;
    button.textContent='正在请求重置邮件…';
    feedback.textContent='';
    try{
      const result=await client.auth.resetPasswordForEmail(email.value,{redirectTo: new URL('./reset-password.html',location.href).href});
      if(result.error)throw result.error;
      feedback.textContent='重置请求已提交。打开最新的重置邮件，设置并保存新密码。';
    }catch(error){
      feedback.textContent=error.name==='AuthRetryableFetchError'?'暂时连不上登录服务，请检查网络后再试。':authMessage(error);
    }finally{
      button.disabled=false;
      button.textContent='忘记密码';
    }
  };
  el('cloudRecovery').onsubmit=async event=>{
    event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
    status('正在保存新密码…');
    try{
      const result=await client.auth.updateUser({password:el('cloudNewPass').value});
      if(result.error)throw result.error;
      el('cloudNewPass').value='';recovering=false;controls();status('密码已更新。请回到有词库的手机图标，用新密码登录。');
    }catch(error){status(authMessage(error))}finally{button.disabled=false}
  };
  el('cloudAuth').onsubmit=async event=>{
    event.preventDefault();
    const email=el('cloudEmail').value.trim(),password=el('cloudPass').value;
    const buttons=el('cloudAuth').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try{
      const signup=event.submitter?.id==='cloudRegister';
      const result=signup?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      el('cloudPass').value='';
      if(!result.data.session)status('请到邮箱确认注册，再回到拾词登录。');
    }catch(error){status(authMessage(error))}
    finally{buttons.forEach(b=>b.disabled=false)}
  };
  el('cloudMerge').onclick=()=>{
    if(!account)return;
    const owner=localStorage.getItem(binding);
    if(owner && owner!==account.id){status('此入口已绑定另一个词库，请使用原账号，或在独立浏览器入口登录。');return}
    if(!owner){
      const deck=read();
      if(!confirm('把本机 '+deck.words.length+' 个词、'+deck.sentences.length+' 个句子与 '+account.email+' 的私人词库合并，并开启自动同步？'))return;
      localStorage.setItem(binding,account.id);
    }
    sync();
  };
  el('cloudSignout').onclick=async()=>{await client.auth.signOut({scope:'local'})};
  window.addEventListener('online',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  window.addEventListener('shici-library-saved',schedule);
}
