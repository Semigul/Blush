const app = document.querySelector('#app');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
const emojis = ['🦊','🦇','🐈‍⬛','🦉','🐺','🪩','🦄','🍒','💿','🛼','🧃','🌙'];
const roundKey = 'midnattsganget:round';
const newRoundButton = document.querySelector('#new-round');

const roles = {
  ulv: { name: 'Stilsabotör', icon: '🖤', text: 'Du är en Stilsabotör. Hitta de andra sabotörerna under natten och bluffa er till seger.' },
  siare: { name: 'Trendorakel', icon: '💄', text: 'Du är Trendoraklet. Under natten får du kika på en annan spelares stilroll — eller två kort i mitten.' },
  bråkmakare: { name: 'Makeupartist', icon: '💋', text: 'Du får byta stilroller mellan två andra spelare under natten. Skapa lite beauty-kaos!' },
  sömnig: { name: 'Nagelmodell', icon: '💅', text: 'Du gör ingenting i natt. På morgonen: läs rummet och försök lista ut vem som saboterar stilen.' },
  bybo: { name: 'Modeikon', icon: '👠', text: 'Du är en Modeikon. Håll ögonen öppna och hjälp laget att hitta Stilsabotören.' }
};

function shell(content) { app.innerHTML = `<div class="shell">${content}</div>`; }
function currentRound() { return Number(localStorage.getItem(roundKey)) || 1; }
function roundLabel() { return `RUNDA ${currentRound()}`; }
function showNewRoundButton(show=true) { newRoundButton.classList.toggle('hidden', !show); }
function setup() {
  showNewRoundButton(); shell(`<div class="brand"><span class="brand-mark">✦</span> Midnattsgänget <span class="round-label">${roundLabel()}</span></div><section class="hero"><div class="eyebrow">Ett spel för sena kvällar</div><h1>Vem är <em>inte</em><br>som den säger?</h1><p>Ett snabbspolat bluffspel för kompisgänget. Dela ut de hemliga länkarna, spela en natt och rösta ut någon före frukost.</p></section><section class="card setup"><h2 class="section-title">Starta en omgång</h2><p class="muted">Skriv deltagarnas namn. Var och en får en egen, hemlig länk som återanvänds i kommande omgångar.</p><div id="names"></div><button class="add-link" id="add">＋ lägg till spelare</button><div class="rules"><strong>Så här funkar det:</strong> Du skickar varje länk privat till rätt person. Alla läser sin roll, följer nattfasen tillsammans och diskuterar sedan i grupp innan ni röstar.</div><button class="button pink" id="start">Skapa privata rollänkar →</button></section>`);
  const names = document.querySelector('#names');
  const add = (value='') => { const row = document.createElement('div'); row.className='player-entry'; row.innerHTML=`<input class="name" maxlength="24" placeholder="Spelarens namn" value="${value}"><button class="icon-btn" aria-label="Ta bort spelare">×</button>`; row.querySelector('button').onclick=()=> { if(names.children.length>3) row.remove(); }; names.append(row); };
  ['Maja','Noah','Sam','Alex'].forEach(add); document.querySelector('#add').onclick=()=>add();
  document.querySelector('#start').onclick=()=> { const players=[...document.querySelectorAll('.name')].map(x=>x.value.trim()).filter(Boolean); if(players.length<3) return alert('Bjud in minst tre spelare!'); lobby(players); };
}
function roleSet(n) { const set=['ulv','siare','bråkmakare']; while(set.length<n) set.push(set.length < 5 ? 'sömnig':'bybo'); return set.slice(0,n).sort(()=>Math.random()-.5); }
function encode(data) { return btoa(unescape(encodeURIComponent(JSON.stringify(data)))); }
function decode(value) { try{return JSON.parse(decodeURIComponent(escape(atob(value))));}catch{return null;} }
function participantKey(name) { return `midnattsganget:participant:${name.trim().toLocaleLowerCase('sv-SE')}`; }
function participantLink(name, role) { const key=participantKey(name); let hash=localStorage.getItem(key); if(!hash) { const id=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`; hash=encode({n:name,id,r:role}); localStorage.setItem(key,hash); } return hash; }
function lobby(players) { const assigned=roleSet(players.length); const base=location.href.split('#')[0]; const cards=players.map((name,i)=>{const hash=participantLink(name,assigned[i]); const url=`${base}#roll=${hash}`; return `<article class="player-card"><div class="avatar">${emojis[i%emojis.length]}</div><h3>${name}</h3><p>Hemlig länk redo</p><div class="card-actions"><button class="button secondary copy" data-url="${url}">Kopiera</button><button class="button open" data-url="${url}">Visa</button></div></article>`}).join(''); showNewRoundButton(); shell(`<div class="brand"><span class="brand-mark">✦</span> Midnattsgänget <span class="round-label">${roundLabel()}</span></div><div class="game-top"><div><div class="eyebrow">Omgången är klar</div><h1>Dela ut rollerna</h1></div><span class="count">${players.length} SPELARE</span></div><div class="link-grid">${cards}</div><section class="instructions"><span>🤫</span><div><strong>Skicka länkarna en och en</strong><p>Tryck på Kopiera och klistra in i er gruppchatt eller skicka privat. Rollen visas bara i den spelarens länk.</p></div></section><div class="footer-action"><button class="button secondary" id="again">← Börja om</button></div>`); document.querySelectorAll('.copy').forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.url); const old=b.textContent;b.textContent='Kopierad!';setTimeout(()=>b.textContent=old,1400)});document.querySelectorAll('.open').forEach(b=>b.onclick=()=>window.open(b.dataset.url,'_blank'));document.querySelector('#again').onclick=setup; }
function rolePage(data) { showNewRoundButton(false); const role=roles[data.r]||roles.bybo; app.innerHTML=`<main class="role-page"><section class="role-card"><div class="tag">HEMLIG ROLL · ${data.n.toUpperCase()}</div><div class="role-icon" id="role-icon">✨</div><div class="eyebrow">Din hemliga roll</div><h1 id="role-name">Är du redo?</h1><p class="intro">Se till att du är ensam innan du tittar. Inga tjuvkikare, okej? 💗</p><button class="button pink reveal" id="reveal">Visa min roll</button><div class="secret" id="secret">${role.text}</div><p class="tiny">Stäng sidan när du har läst. Lycka till i natt.</p></section></main>`; const secret=document.querySelector('#secret'); const name=document.querySelector('#role-name'); const icon=document.querySelector('#role-icon'); document.querySelector('#reveal').onclick=e=>{const showing=secret.classList.toggle('show'); name.textContent=showing?role.name:'Är du redo?'; icon.textContent=showing?role.icon:'✨'; e.currentTarget.textContent=showing?'Dölj min roll':'Visa min roll';}; }
newRoundButton.onclick=()=>{localStorage.setItem(roundKey,currentRound()+1); location.hash=''; setup();};
const params=new URLSearchParams(location.hash.slice(1)); const data=params.get('roll')&&decode(params.get('roll')); data&&data.n&&data.r?rolePage(data):setup();
