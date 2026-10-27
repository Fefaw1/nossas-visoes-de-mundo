/* NOSSAS VISÕES DE MUNDO — HTML/CSS/JS puro + Supabase.
   Edite textos, cores e funcionalidades livremente. Nenhuma chave secreta aqui. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const state = {
    db: null, user: null, room: null, members: [], debates: [], messages: [], points: [],
    avatarUrls: {}, nav: 'home', debateId: null, replyTo: null,
    authTab: 'login', setupMode: 'create', demo: false
  };
  const app = $('#app-view'), auth = $('#auth-view'), setup = $('#setup-view'), loading = $('#loading');
  let toastTimer;

  function showView(which) {
    [app, auth, setup, loading].forEach((node) => node.classList.add('hidden'));
    ({app, auth, setup, loading})[which].classList.remove('hidden');
  }
  function toast(message, error = false) {
    const box = $('#toast'); box.textContent = message;
    box.className = (error ? 'error ' : '') + 'visible';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { box.className = ''; }, 4500);
  }
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shortText = (v, len = 130) => String(v || '').length > len ? String(v).slice(0, len - 1) + '…' : String(v || '');
  const datePt = (value) => new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
  const timePt = (value) => new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  const getPerson = (id) => state.members.find(m => m.user_id === id) || {user_id:id,display_name:'Participante'};
  const isPartner = (id) => state.members.findIndex(m=>m.user_id === id) === 1;
  const currentMember = () => state.members.find(m=>m.user_id === state.user?.id);
  const getDebate = (id) => state.debates.find(d => d.id === id);
  const confirmedPoints = () => state.points.filter(p => !!p.confirmed_by);
  const countMessages = (id) => state.messages.filter(m => m.debate_id === id).length;
  function avatar(userId, size='') {
    const member = getPerson(userId);
    const cls = `avatar ${isPartner(userId) ? 'person-b' : 'person-a'} ${size}`;
    const img = state.avatarUrls[userId];
    return img ? `<img class="${cls}" src="${esc(img)}" alt="Foto de ${esc(member.display_name)}" loading="lazy">`
               : `<span class="${cls}" aria-label="${esc(member.display_name)}">${esc(member.display_name.slice(0,1).toUpperCase())}</span>`;
  }
  function avatarsGroup(ids) {
    return `<span class="avatar-stack">${[...new Set(ids)].slice(0,2).map(id=>avatar(id,'small')).join('')}</span>`;
  }
  function userIsMember() { return Boolean(state.user && state.room && !state.demo); }
  function writable() { if (state.demo) { toast('Este é só um exemplo. Configure o Supabase para salvar seus próprios debates.'); return false; } return true; }
  function friendlyError(e) {
    const msg = String(e?.message || e || 'Ocorreu um erro.');
    if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.';
    if (/User already registered/i.test(msg)) return 'Este e-mail já foi cadastrado. Tente entrar.';
    if (/Failed to fetch|NetworkError/i.test(msg)) return 'Erro de conexão. Verifique sua internet e a configuração.';
    return msg;
  }
  function busy(form, yes) {
    const submit = form?.querySelector('[type="submit"]');
    if (submit) submit.disabled = yes;
  }

  async function init() {
    const config = window.APP_CONFIG || {};
    const properlyConfigured = /^https:\/\/.+\.supabase\.co\/?$/.test(config.SUPABASE_URL || '') &&
      config.SUPABASE_PUBLISHABLE_KEY && !config.SUPABASE_PUBLISHABLE_KEY.startsWith('COLE_');
    if (!properlyConfigured || !window.supabase?.createClient) {
      showView('auth');
      $('#auth-help').textContent = properlyConfigured
        ? 'Falha ao carregar a biblioteca Supabase. Confira sua internet.'
        : 'Primeira utilização? Configure config.js e schema.sql para salvar dados. Você pode abrir a demonstração abaixo.';
      $('#auth-submit').disabled = true;
      return;
    }
    state.db = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    try {
      const {data,error} = await state.db.auth.getUser();
      if (error && !/Auth session missing/i.test(error.message)) console.warn(error);
      if (data?.user) { state.user = data.user; await loadEverything(); }
      else showView('auth');
    } catch(e) { showView('auth'); toast(friendlyError(e),true); }
  }

  async function loadEverything() {
    showView('loading');
    try {
      const {data: member, error: memberError} = await state.db.from('members').select('*').eq('user_id',state.user.id).maybeSingle();
      if (memberError) throw memberError;
      if (!member) { showView('setup'); return; }
      const roomResult = await state.db.from('rooms').select('*').eq('id',member.room_id).single();
      if (roomResult.error) throw roomResult.error;
      state.room = roomResult.data;
      const [membersResult, debatesResult] = await Promise.all([
        state.db.from('members').select('*').eq('room_id',state.room.id).order('joined_at',{ascending:true}),
        state.db.from('debates').select('*').eq('room_id',state.room.id).order('created_at',{ascending:false})
      ]);
      if (membersResult.error) throw membersResult.error;
      if (debatesResult.error) throw debatesResult.error;
      state.members = membersResult.data; state.debates = debatesResult.data;
      const ids = state.debates.map(d=>d.id);
      if (ids.length) {
        const [ms, ps] = await Promise.all([
          state.db.from('messages').select('*').in('debate_id',ids).order('created_at',{ascending:true}),
          state.db.from('common_points').select('*').in('debate_id',ids).order('created_at',{ascending:true})
        ]);
        if (ms.error) throw ms.error; if (ps.error) throw ps.error;
        state.messages = ms.data; state.points = ps.data;
      } else { state.messages = []; state.points = []; }
      state.avatarUrls = {};
      await Promise.all(state.members.filter(m=>m.avatar_path).map(async m => {
        const {data, error} = await state.db.storage.from('couple-avatars').createSignedUrl(m.avatar_path,3600);
        if (!error && data?.signedUrl) state.avatarUrls[m.user_id] = data.signedUrl;
      }));
      showView('app'); navigate(state.nav === 'debate' && !getDebate(state.debateId) ? 'home' : state.nav);
    } catch(e) { console.error(e); showView('app'); toast('Não foi possível carregar os dados: '+friendlyError(e),true); }
  }

  function demo() {
    state.demo = true;
    state.user = {id:'a',email:'exemplo@site.com'};
    state.room = {id:'sala',invite_code:'exemplo'};
    state.members = [
      {user_id:'a',display_name:'Você',joined_at:'2026-10-01T10:00:00Z'},
      {user_id:'b',display_name:'Sua pessoa',joined_at:'2026-10-02T10:00:00Z'}
    ];
    state.debates = [
      {id:'d1',room_id:'sala',author_id:'a',title:'Como tornar a educação mais acessível?',category:'Educação',description:'O que deveríamos priorizar para melhorar a qualidade do ensino?',status:'open',created_at:'2026-10-24T15:00:00Z'},
      {id:'d2',room_id:'sala',author_id:'b',title:'O que torna uma cidade mais segura?',category:'Segurança',description:'Quais medidas realmente fazem diferença no cotidiano?',status:'open',created_at:'2026-10-22T15:00:00Z'},
      {id:'d3',room_id:'sala',author_id:'a',title:'Como equilibrar economia e meio ambiente?',category:'Meio ambiente',description:'Onde podemos encontrar um equilíbrio?',status:'closed',created_at:'2026-10-18T15:00:00Z'}
    ];
    state.messages = [
      {id:'m1',debate_id:'d1',author_id:'a',body:'Acho importante começar pelo acesso e pela permanência dos estudantes na escola.',created_at:'2026-10-24T16:00:00Z'},
      {id:'m2',debate_id:'d1',author_id:'b',body:'Concordo sobre o acesso. Também gostaria de discutir como medir os resultados das políticas.',reply_to:'m1',created_at:'2026-10-24T17:30:00Z'},
      {id:'m3',debate_id:'d2',author_id:'b',body:'Para mim, melhorar a iluminação e os espaços públicos pode ajudar bastante.',created_at:'2026-10-23T10:00:00Z'},
      {id:'m4',debate_id:'d3',author_id:'a',body:'Acredito que precisamos medir impactos e planejar a longo prazo.',created_at:'2026-10-19T14:00:00Z'}
    ];
    state.points = [
      {id:'p1',debate_id:'d1',author_id:'a',confirmed_by:'b',body:'Queremos escolas públicas de qualidade para todas as crianças.',created_at:'2026-10-25T10:00:00Z'},
      {id:'p2',debate_id:'d3',author_id:'b',confirmed_by:'a',body:'Devemos buscar soluções sustentáveis com resultados verificáveis.',created_at:'2026-10-21T10:00:00Z'}
    ];
    state.avatarUrls={};
    state.nav = 'home'; showView('app'); navigate('home');
    toast('Modo demonstração: explore os blocos e debates!');
  }

  function renderCard(d) {
    const ids = state.messages.filter(m=>m.debate_id === d.id).map(m=>m.author_id).concat(d.author_id);
    return `<button class="debate-card" type="button" data-debate-id="${esc(d.id)}">
      <div class="card-meta"><span class="chip ${d.status==='closed'?'closed':''}">${d.status==='open'?'◌ EM ABERTO':'✓ ENCERRADO'}</span><span class="card-date">${esc(datePt(d.created_at))}</span></div>
      <h3>${esc(d.title)}</h3><p>${esc(shortText(d.description || 'Uma conversa para compartilhar perspectivas.',110))}</p>
      <div class="card-footer"><span class="card-footer-people">${avatarsGroup(ids)} ${countMessages(d.id)} ${countMessages(d.id)===1?'resposta':'respostas'}</span><span class="card-arrow">↗</span></div>
    </button>`;
  }
  function emptyState(title, description, button = true) {
    return `<div class="empty-state"><div class="empty-icon">✳</div><h3>${esc(title)}</h3><p>${esc(description)}</p>${button?'<button class="btn btn-primary" type="button" data-action="new-debate">＋ Propor um debate</button>':''}</div>`;
  }
  function renderDashboard() {
    const open = state.debates.filter(d=>d.status==='open');
    $('#count-open').textContent = open.length;
    $('#count-closed').textContent = state.debates.length-open.length;
    $('#count-common').textContent = confirmedPoints().length;
    const people = state.members;
    $('#hero-people').innerHTML = `${avatarsGroup(people.map(p=>p.user_id))}<span>${people.map(p=>esc(p.display_name)).join(' & ')}</span>`;
    $('#self-side-avatar').outerHTML = avatar(state.user.id).replace('class="avatar','id="self-side-avatar" class="avatar');
    $('#self-side-name').textContent = getPerson(state.user.id).display_name;
    $('#featured-debates').innerHTML = open.length
      ? open.slice(0,4).map(renderCard).join('')
      : emptyState('Por onde começamos?','Que tal escolher um assunto sobre o qual vocês gostariam de conversar?');
  }
  function renderList(nav) {
    const closed = nav === 'closed', list=state.debates.filter(d=>d.status===(closed?'closed':'open'));
    $('#list-kicker').textContent=closed?'NOSSO HISTÓRICO':'CONVERSAS EM ANDAMENTO';
    $('#list-title').textContent=closed?'Debates encerrados':'Debates abertos';
    $('#list-description').textContent=closed?'Conversas que podemos revisitar sem pressa.':'Assuntos para explorarmos quando os dois estiverem disponíveis.';
    $('#list-count').textContent=`${list.length} ${list.length===1?'debate':'debates'}`;
    $('#list-debates').innerHTML=list.length?list.map(renderCard).join(''):emptyState(closed?'Nenhum debate encerrado por enquanto.':'Ainda não há debates em aberto.',closed?'Os debates concluídos aparecerão aqui.':'Vocês podem começar com uma pergunta simples.',!closed);
  }
  function renderCommon() {
    const points=confirmedPoints().slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    $('#common-list').innerHTML = points.length ? points.map(p=> {
      const d=getDebate(p.debate_id);
      return `<article class="common-item"><span>♡</span><div><h3>${esc(p.body)}</h3><small>Confirmado pelos dois · Debate: ${esc(d?.title||'Assunto')}</small><div><button type="button" class="linklike" data-debate-id="${esc(p.debate_id)}">Revisitar conversa →</button></div></div></article>`;
    }).join('') : emptyState('Pontes são construídas aos poucos','Quando um sugerir algo que ambos compartilham e o outro confirmar, aparecerá aqui.',false);
  }
  function renderDebate() {
    const d=getDebate(state.debateId); if(!d){navigate('home');return;}
    const messages=state.messages.filter(m=>m.debate_id===d.id), points=state.points.filter(p=>p.debate_id===d.id);
    const messageMap=new Map(messages.map(m=>[m.id,m]));
    $('#debate-content').innerHTML = `<article class="debate-banner">
      <span class="chip ${d.status==='closed'?'closed':''}">${d.status==='closed'?'✓ ENCERRADO':'◌ EM ABERTO'}</span>
      <h1>${esc(d.title)}</h1><p>${esc(d.description||'Uma conversa aberta para compartilhar perspectivas.')}</p>
      <div class="debate-actions"><span class="debate-person">${avatar(d.author_id,'small')} Criado por <b>${esc(getPerson(d.author_id).display_name)}</b> · ${esc(datePt(d.created_at))}</span><button class="btn btn-outline" type="button" data-action="toggle-status">${d.status==='open'?'✓ Encerrar debate':'↺ Reabrir debate'}</button></div>
    </article>
    <div class="debate-main-grid"><div class="panel"><h2>Nossa conversa</h2><p class="panel-subtext">${messages.length} ${messages.length===1?'mensagem':'mensagens'} · Sem pressa para responder</p>
      <div class="messages-list">${messages.length ? messages.map(m=>{
        const parent=messageMap.get(m.reply_to);
        return `<article class="message ${isPartner(m.author_id)?'by-b':''}"><div class="message-head">${avatar(m.author_id,'small')}<div class="person-meta"><b>${esc(getPerson(m.author_id).display_name)}${m.author_id===state.user.id?' · você':''}</b><small>${esc(timePt(m.created_at))}</small></div></div>
          ${parent?`<div class="reply-reference">↳ Em resposta a ${esc(getPerson(parent.author_id).display_name)}: “${esc(shortText(parent.body,105))}”</div>`:''}
          <div class="message-body">${esc(m.body)}</div>${d.status==='open'?`<button type="button" data-reply-id="${esc(m.id)}">↳ Responder a esta mensagem</button>`:''}</article>`;
      }).join('') : '<p class="panel-subtext">Ainda não há mensagens. Quem vai começar a conversa?</p>'}</div>
      ${d.status==='open'?`<form id="message-form" class="reply-form"><label for="message-body">Compartilhe sua perspectiva</label><div id="reply-target-container"></div><textarea id="message-body" maxlength="6000" required placeholder="Escreva sua ideia, argumento ou pergunta..." rows="4"></textarea><div class="reply-form-footer"><p>Argumentos sim. Ataques pessoais não. ♡</p><button class="btn btn-primary" type="submit">Publicar →</button></div></form>`:'<div class="paused-hint">♡ Este debate foi encerrado. Vocês podem reabri-lo quando quiserem.</div>'}
    </div><aside class="panel side-panel"><span class="eyebrow">CONSTRUINDO PONTES</span><h2>Pontos em comum</h2><p>Perceberam algo que compartilham? Proponha aqui. O outro confirma para virar um ponto em comum de verdade.</p>
      ${d.status==='open'?`<form id="point-form"><textarea id="point-body" maxlength="600" minlength="3" required placeholder="Ex.: Acreditamos que toda criança merece educação de qualidade..."></textarea><button class="btn btn-outline" type="submit">＋ Sugerir ponto</button></form>`:''}
      <div class="compact-common">${points.length ? points.map(p=>`<div><span>${p.confirmed_by?'♡':'◌'} ${esc(p.body)}</span><br><small>${p.confirmed_by?'✓ Confirmado pelos dois':p.author_id===state.user.id?'Aguardando a outra pessoa':'Aguardando sua confirmação'}</small>${!p.confirmed_by && p.author_id!==state.user.id?`<br><button type="button" class="linklike" data-confirm-point="${esc(p.id)}">♡ Confirmar ponto em comum</button>`:''}</div>`).join('') : '<p>Nenhum ponto registrado ainda.</p>'}</div>
    </aside></div>`;
    state.replyTo=null;
  }
  function navigate(nav, debateId) {
    if(nav==='debate' && debateId) state.debateId=debateId;
    state.nav=nav;
    $$('.page').forEach(el=>el.classList.add('hidden'));
    $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.nav===nav));
    const names={home:'Visão geral',open:'Debates abertos',closed:'Debates encerrados',common:'Pontos em comum',debate:'Debate'};
    $('#breadcrumb').innerHTML=`Início <span> / </span> ${esc(names[nav]||'Visão geral')}`;
    if(nav==='home'){$('#dashboard-page').classList.remove('hidden');renderDashboard();}
    else if(nav==='open'||nav==='closed'){$('#list-page').classList.remove('hidden');renderList(nav);}
    else if(nav==='common'){$('#common-page').classList.remove('hidden');renderCommon();}
    else if(nav==='debate'){$('#debate-page').classList.remove('hidden');renderDebate();}
    window.scrollTo({top:0,behavior:'auto'});
  }
  function setAuthTab(mode) {
    state.authTab=mode;
    $$('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===mode));
    $('#auth-submit').textContent=mode==='login'?'Entrar no nosso espaço →':'Criar minha conta →';
    $('#auth-password').autocomplete=mode==='signup'?'new-password':'current-password';
  }
  function setSetupMode(mode) {
    state.setupMode=mode;
    $$('[data-setup-mode]').forEach(b=>b.classList.toggle('active',b.dataset.setupMode===mode));
    $('#code-field').classList.toggle('hidden',mode!=='join');
    $('#invite-input').required=mode==='join';
    $('#setup-submit').textContent=mode==='join'?'Entrar na sala →':'Criar nossa sala →';
  }
  function openModal(which) {
    if(!writable())return;
    $(which==='profile'?'#profile-backdrop':'#modal-backdrop').classList.remove('hidden');
    if(which==='profile')$('#profile-name').value=currentMember()?.display_name||'';
  }
  function closeModals() { $('#modal-backdrop').classList.add('hidden'); $('#profile-backdrop').classList.add('hidden'); }

  async function handleAuth(e) {
    e.preventDefault(); if(!state.db)return;
    const form=e.currentTarget, email=$('#auth-email').value.trim(), password=$('#auth-password').value;
    busy(form,true);
    try {
      if(state.authTab==='signup') {
        const {data,error}=await state.db.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
        if(error)throw error;
        if(data.session && data.user){state.user=data.user;await loadEverything();}
        else toast('Conta criada! Confirme o e-mail recebido e depois entre.');
      } else {
        const {data,error}=await state.db.auth.signInWithPassword({email,password});
        if(error)throw error;
        state.user=data.user;await loadEverything();
      }
    } catch(err) { toast(friendlyError(err),true); }
    finally {busy(form,false);}
  }
  async function handleSetup(e) {
    e.preventDefault(); const form=e.currentTarget; busy(form,true);
    const name=$('#setup-name').value.trim();
    try {
      const {error}=await state.db.rpc(state.setupMode==='create'?'create_couple_room':'join_couple_room',state.setupMode==='create'?{p_name:name}:{p_code:$('#invite-input').value.trim(),p_name:name});
      if(error)throw error;
      state.nav='home'; await loadEverything();
      toast(state.setupMode==='create'?'Sala criada! Compartilhe o convite pelo seu perfil.':'Bem-vinda(o) à sala compartilhada!');
    } catch(err) {toast(friendlyError(err),true);} finally {busy(form,false);}
  }
  async function handleNewDebate(e) {
    e.preventDefault();if(!writable())return;
    const form=e.currentTarget;busy(form,true);
    try {
      const {data,error}=await state.db.from('debates').insert({room_id:state.room.id,author_id:state.user.id,title:$('#debate-title').value.trim(),category:$('#debate-category').value,description:$('#debate-description').value.trim()}).select('id').single();
      if(error)throw error;
      closeModals();form.reset();state.nav='debate';state.debateId=data.id;await loadEverything();toast('Novo debate criado!');
    }catch(err){toast(friendlyError(err),true);}finally{busy(form,false);}
  }
  async function handleMessage(e) {
    e.preventDefault();if(!writable())return;
    const form=e.currentTarget; busy(form,true);
    try {
      const {error}=await state.db.from('messages').insert({debate_id:state.debateId,author_id:state.user.id,body:$('#message-body').value.trim(),reply_to:state.replyTo||null});
      if(error)throw error;
      await loadEverything();toast('Mensagem publicada ♡');
    }catch(err){toast(friendlyError(err),true);}finally{busy(form,false);}
  }
  async function handlePoint(e) {
    e.preventDefault();if(!writable())return;
    const form=e.currentTarget;busy(form,true);
    try {
      const {error}=await state.db.from('common_points').insert({debate_id:state.debateId,author_id:state.user.id,body:$('#point-body').value.trim()});
      if(error)throw error;
      await loadEverything();toast('Ponto sugerido! Falta a outra pessoa confirmar.');
    }catch(err){toast(friendlyError(err),true);}finally{busy(form,false);}
  }
  async function toggleStatus() {
    if(!writable())return;
    const debate=getDebate(state.debateId);if(!debate)return;
    try {
      const {error}=await state.db.from('debates').update({status:debate.status==='open'?'closed':'open'}).eq('id',debate.id);
      if(error)throw error;
      await loadEverything();toast(debate.status==='open'?'Debate encerrado.':'Debate reaberto.');
    }catch(err){toast(friendlyError(err),true);}
  }
  async function confirmPoint(id) {
    if(!writable())return;
    try {
      const {data,error}=await state.db.from('common_points').update({confirmed_by:state.user.id}).eq('id',id).is('confirmed_by',null).select('id');
      if(error)throw error;
      if(!data?.length)throw new Error('Este ponto já foi confirmado ou não pode ser confirmado por você.');
      await loadEverything();toast('Agora é um ponto em comum de vocês! ♡');
    }catch(err){toast(friendlyError(err),true);}
  }
  async function saveProfile(e) {
    e.preventDefault();if(!writable())return;
    const form=e.currentTarget;busy(form,true);
    try {
      const fields={display_name:$('#profile-name').value.trim()},file=$('#avatar-file').files[0];
      if(file){
        if(file.size>3*1024*1024)throw new Error('A foto precisa ter no máximo 3 MB.');
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma foto JPG, PNG ou WebP.');
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
        const path=`${state.user.id}/avatar-${Date.now()}.${ext}`;
        const {error:uploadError}=await state.db.storage.from('couple-avatars').upload(path,file,{contentType:file.type,upsert:false});
        if(uploadError)throw uploadError;
        fields.avatar_path=path;
      }
      const {error}=await state.db.from('members').update(fields).eq('user_id',state.user.id);
      if(error)throw error;
      closeModals();form.reset();await loadEverything();toast('Perfil atualizado!');
    }catch(err){toast(friendlyError(err),true);}finally{busy(form,false);}
  }
  async function copyInvite() {
    if(!writable())return;
    try {
      await navigator.clipboard.writeText(state.room.invite_code);
      toast('Convite copiado! Envie o código à outra pessoa em particular.');
    }catch(e){window.prompt('Copie o código da sala:',state.room.invite_code);}
  }
  async function logout() {
    if(state.demo){state.demo=false;window.location.href=window.location.pathname;return;}
    if(!state.db)return;
    await state.db.auth.signOut();state.user=null;state.room=null;state.nav='home';closeModals();showView('auth');
  }
  function replyToMessage(id) {
    state.replyTo=id;
    const msg=state.messages.find(m=>m.id===id);
    if(!msg)return;
    $('#reply-target-container').innerHTML=`<div class="reply-target"><span>↳ Respondendo a ${esc(getPerson(msg.author_id).display_name)}</span><button type="button" data-action="cancel-reply">Cancelar ×</button></div>`;
    $('#message-body')?.focus();
  }
  document.addEventListener('click',(e)=>{
    const target=e.target.closest('button');if(!target)return;
    if(target.dataset.authTab){setAuthTab(target.dataset.authTab);return;}
    if(target.dataset.setupMode){setSetupMode(target.dataset.setupMode);return;}
    if(target.dataset.nav){navigate(target.dataset.nav);return;}
    if(target.dataset.debateId){navigate('debate',target.dataset.debateId);return;}
    if(target.dataset.replyId){replyToMessage(target.dataset.replyId);return;}
    if(target.dataset.confirmPoint){confirmPoint(target.dataset.confirmPoint);return;}
    if(target.dataset.action==='new-debate'){openModal('debate');return;}
    if(target.dataset.action==='close-modal'||target.dataset.action==='close-profile'){closeModals();return;}
    if(target.dataset.action==='toggle-status'){toggleStatus();return;}
    if(target.dataset.action==='cancel-reply'){state.replyTo=null;$('#reply-target-container').innerHTML='';return;}
    if(target.dataset.action==='logout'){logout();return;}
  });
  $('#auth-form').addEventListener('submit',handleAuth);
  $('#setup-form').addEventListener('submit',handleSetup);
  $('#new-debate-form').addEventListener('submit',handleNewDebate);
  $('#profile-form').addEventListener('submit',saveProfile);
  document.addEventListener('submit',e=>{if(e.target.id==='message-form')handleMessage(e);if(e.target.id==='point-form')handlePoint(e);});
  $('#new-debate-button').addEventListener('click',()=>openModal('debate'));
  $('#list-create').addEventListener('click',()=>openModal('debate'));
  $('#profile-trigger').addEventListener('click',()=>openModal('profile'));
  $('#copy-invite').addEventListener('click',copyInvite);
  $('#refresh-btn').addEventListener('click',()=>state.demo?toast('Você está vendo a demonstração.'):loadEverything());
  $('#back-to-list').addEventListener('click',()=>navigate('open'));
  $('#demo-button').addEventListener('click',demo);
  $$('.modal-backdrop').forEach(backdrop=>backdrop.addEventListener('mousedown',e=>{if(e.target===backdrop)closeModals();}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModals();});
  init();
})();
