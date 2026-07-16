import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAStWos0oB0ALxcunlde_VAoB3RV7rVuNQ',
  authDomain: 'blush-bluff.firebaseapp.com',
  projectId: 'blush-bluff',
  storageBucket: 'blush-bluff.firebasestorage.app',
  messagingSenderId: '277588745148',
  appId: '1:277588745148:web:3902e8ebd01fbe0b69e9b9'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const app = document.querySelector('#app');
const newRoundButton = document.querySelector('#new-round');
const resetGameButton = document.querySelector('#reset-game-global');
const hostGameKey = 'blush-bluff:host-game';
const emojis = ['🦊', '🦇', '🐈‍⬛', '🦉', '🐺', '🪩', '🦄', '🍒', '💿', '🛼', '🧃', '🌙'];

const roles = {
  smudgeWolf: { name: 'Smudge Wolf', icon: '🐺', alignment: 'Bluffare', image: './assets/roles/smudge-wolf.png', text: 'Du är den dolda Smudge Wolf. Plantera en misstanke mot någon utan att säga deras namn första gången. Få gruppen att rösta på fel person — blir du inte avslöjad vinner du.' },
  shadeReader: { name: 'Shade Reader', icon: '🔮', alignment: 'Sökare', image: './assets/roles/shade-reader.png', text: 'En gång per runda får du säga “skuggprov” och välja en spelare. Ställ en fråga; personen måste svara med endast “ljus”, “mellan” eller “mörk”. Använd reaktionen som din ledtråd.' },
  topcoatGuardian: { name: 'Topcoat Guardian', icon: '🛡️', alignment: 'Sökare', image: './assets/roles/topcoat-guardian.png', text: 'Precis före omröstningen får du skydda en annan spelare med ett topcoat. Den första rösten mot den personen räknas inte. Du får inte skydda dig själv.' },
  precisionLiner: { name: 'Precision Liner', icon: '🎯', alignment: 'Sökare', image: './assets/roles/precision-liner.png', text: 'En gång under diskussionen får du kräva ett exakt svar av valfri spelare: de måste svara på din fråga med precis fem ord. Inga fler, inga färre.' },
  browStylist: { name: 'Brow Stylist', icon: '✂️', alignment: 'Sökare', image: './assets/roles/brow-stylist.png', text: 'En gång får du utse en spelare till din modell. Säg “brow check” och ställ en fråga. Modellen måste hålla kvar ögonkontakt medan svaret ges.' },
  glossMute: { name: 'Gloss Mute', icon: '🤐', alignment: 'Sökare', image: './assets/roles/gloss-mute.png', text: 'Du börjar rundan i tystnad. Vänta tills två andra spelare har sagt varsin full mening. Ditt första inlägg måste innehålla ordet “glans”.' },
  dramaQueen: { name: 'Drama Queen', icon: '🎭', alignment: 'Sökare', image: './assets/roles/drama-queen.png', text: 'En gång får du ropa “dramatiskt avbrott!”. Välj två spelare: de ska försvara varsin annan spelare i 20 sekunder. Du väljer vem de försvarar.' },
  lookalikeArtist: { name: 'Lookalike Artist', icon: '🎨', alignment: 'Sökare', image: './assets/roles/lookalike-artist.png', text: 'Välj i hemlighet en spelare. Spegla deras kroppsspråk eller ett uttryck två gånger under samtalet. Avslöja sedan vem din musa var och varför.' }
};

let hostUid = null;
let hostedGameId = localStorage.getItem(hostGameKey);

function shell(content) { app.innerHTML = `<div class="shell">${content}</div>`; }
function randomId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function normalizeName(name) { return name.trim().toLocaleLowerCase('sv-SE'); }
function gameRef(gameId) { return doc(db, 'games', gameId); }
function playersRef(gameId) { return collection(db, 'games', gameId, 'players'); }
function playerRef(gameId, playerId) { return doc(db, 'games', gameId, 'players', playerId); }
function roleSet(count) { const set = ['smudgeWolf']; if (count >= 7) set.push('smudgeWolf'); const seekers = ['shadeReader', 'topcoatGuardian', 'precisionLiner', 'browStylist', 'glossMute', 'dramaQueen', 'lookalikeArtist']; while (set.length < count) set.push(seekers[(set.length - (count >= 7 ? 2 : 1)) % seekers.length]); return set.slice(0, count).sort(() => Math.random() - .5); }
function nextRoleSet(count, previousRoles = []) { if (previousRoles.length !== count) return roleSet(count); let best = roleSet(count); let mostChanges = best.filter((role, index) => role !== previousRoles[index]).length; for (let attempt = 0; attempt < 200 && mostChanges < count; attempt += 1) { const candidate = roleSet(count); const changes = candidate.filter((role, index) => role !== previousRoles[index]).length; if (changes > mostChanges) { best = candidate; mostChanges = changes; } } return best; }
function showNewRoundButton(show = true) { newRoundButton.classList.toggle('hidden', !show); }
function showResetGameButton(show = true) { resetGameButton.classList.toggle('hidden', !show); }
function hostedPlayerKey(name) { return `blush-bluff:player:${hostedGameId}:${normalizeName(name)}`; }
function hostedPlayerId(name) { const key = hostedPlayerKey(name); let id = localStorage.getItem(key); if (!id) { id = randomId(); localStorage.setItem(key, id); } return id; }
function playerUrl(gameId, playerId) { return `${location.href.split('#')[0]}#spelare=${gameId}.${playerId}`; }

async function ensureHostedGame() {
  if (!hostedGameId) { hostedGameId = randomId(); localStorage.setItem(hostGameKey, hostedGameId); }
  const reference = gameRef(hostedGameId);
  try {
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) return hostedGameId;
  } catch {}
  await setDoc(reference, { hostUid, round: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  return hostedGameId;
}

function setup(players = ['Maja', 'Noah', 'Sam', 'Alex'], nextRound = 1) {
  showNewRoundButton(false);
  showResetGameButton(Boolean(hostedGameId));
  const roleCards = Object.values(roles).map(role => `<article class="role-guide-card ${role.alignment === 'Bluffare' ? 'wolf-card' : ''}"><img src="${role.image}" alt="Illustration för ${role.name}" loading="lazy"><div class="role-guide-copy"><span class="role-alignment">${role.icon} ${role.alignment}</span><h3>${role.name}</h3><p>${role.text}</p></div></article>`).join('');
  shell(`<div class="brand"><span class="brand-mark">✦</span> Blush &amp; Bluff</div><section class="hero"><div class="eyebrow">The gilded beauty game</div><h1>Vem döljer<br><em>smudgen?</em></h1><p>Ett socialt mysteriespel med hemliga roller, skarpa frågor och en enda Smudge Wolf i rummet.</p></section><section class="card setup"><h2 class="section-title">Starta en ny runda</h2><p class="muted">Skriv deltagarnas namn. Var och en får en egen hemlig länk som fungerar i alla kommande rundor.</p><div id="names"></div><button class="add-link" id="add">＋ lägg till spelare</button><div class="rules"><strong>Arrangörens uppgift:</strong> Skicka varje länk privat. När alla har tittat på sitt kort lägger ni undan telefonerna och börjar samtalet.</div><button class="button pink" id="start">Försegla runda ${nextRound} →</button></section><section class="game-guide" aria-labelledby="guide-title"><div class="guide-heading"><div><div class="eyebrow">Spelregler</div><h2 id="guide-title">Hitta vargen innan finalen</h2></div><span>5–10 min</span></div><ol class="steps"><li><b>01</b><div><strong>Försegla rollerna</strong><p>Alla öppnar sin länk ensamma och läser uppdraget tyst.</p></div></li><li><b>02</b><div><strong>Beauty briefing</strong><p>Prata i fem minuter. Använd din roll en gång, men håll motivet hemligt.</p></div></li><li><b>03</b><div><strong>Väg ledtrådarna</strong><p>Diskutera vem som styr samtalet mot fel spår och använd era specialförmågor.</p></div></li><li><b>04</b><div><strong>Final vote</strong><p>Rösta samtidigt på vem ni tror är Smudge Wolf. Träffar ni rätt vinner sökarna, annars vinner vargen.</p></div></li></ol><div class="roles-heading"><div class="eyebrow">Rollkabinettet</div><h2>Åtta sätt att spela</h2><p>Alla roller kan förekomma. Vid 7 eller fler spelare smyger en andra Smudge Wolf in i spelet.</p></div><div class="role-guide-grid">${roleCards}</div></section>`);
  const names = document.querySelector('#names');
  const add = (value = '') => { const row = document.createElement('div'); row.className = 'player-entry'; row.innerHTML = `<input class="name" maxlength="24" placeholder="Spelarens namn" value="${value}"><button class="icon-btn" aria-label="Ta bort spelare">×</button>`; row.querySelector('button').onclick = () => { if (names.children.length > 3) row.remove(); }; names.append(row); };
  players.forEach(add);
  document.querySelector('#add').onclick = () => add();
  document.querySelector('#start').onclick = async () => {
    const enteredPlayers = [...document.querySelectorAll('.name')].map(input => input.value.trim()).filter(Boolean);
    if (enteredPlayers.length < 3) return alert('Bjud in minst tre spelare!');
    await startRound(enteredPlayers);
  };
}

async function startRound(names, previousRoles = []) {
  try {
    const gameId = await ensureHostedGame();
    const gameSnapshot = await getDoc(gameRef(gameId));
    const round = (gameSnapshot.data()?.round || 0) + 1;
    const assigned = nextRoleSet(names.length, previousRoles);
    const batch = writeBatch(db);
    batch.set(gameRef(gameId), { hostUid, round, updatedAt: serverTimestamp() }, { merge: true });
    const players = names.map((name, index) => ({ id: hostedPlayerId(name), name, role: assigned[index], round }));
    players.forEach(player => batch.set(playerRef(gameId, player.id), { ...player, updatedAt: serverTimestamp() }, { merge: true }));
    await batch.commit();
    lobby(gameId, players, round);
  } catch (error) {
    console.error(error);
    alert('Kunde inte starta rundan. Kontrollera Firebase-reglerna och försök igen.');
  }
}

async function nextRound() {
  try {
    const gameId = await ensureHostedGame();
    const snapshots = await getDocs(playersRef(gameId));
    const players = snapshots.docs.map(snapshot => ({ id: snapshot.id, name: snapshot.data().name, role: snapshot.data().role }));
    if (players.length < 3) return setup();
    await startRound(players.map(player => player.name), players.map(player => player.role));
  } catch (error) {
    console.error(error);
    alert('Kunde inte starta nästa runda. Kontrollera Firebase-reglerna och försök igen.');
  }
}

async function resetGame() {
  if (!confirm('Återställ spelet till runda 1? Deltagarna behåller sina länkar.')) return;
  try {
    const gameId = await ensureHostedGame();
    const snapshots = await getDocs(playersRef(gameId));
    const players = snapshots.docs.map(snapshot => snapshot.data().name);
    if (players.length < 3) return setup();
    await setDoc(gameRef(gameId), { hostUid, round: 0, updatedAt: serverTimestamp() }, { merge: true });
    await startRound(players);
  } catch (error) {
    console.error(error);
    alert('Kunde inte återställa spelet. Försök igen.');
  }
}

function lobby(gameId, players, round) {
  const cards = players.map((player, index) => { const url = playerUrl(gameId, player.id); return `<article class="player-card"><div class="avatar">${emojis[index % emojis.length]}</div><h3>${player.name}</h3><p>RUNDA ${round} · Hemlig länk redo</p><div class="card-actions"><button class="button secondary copy" data-url="${url}">Kopiera</button><button class="button open" data-url="${url}">Visa</button></div></article>`; }).join('');
  showNewRoundButton(true);
  showResetGameButton(true);
  newRoundButton.textContent = `Starta runda ${round + 1}`;
  shell(`<div class="brand"><span class="brand-mark">💋</span> Blush &amp; Bluff <span class="round-label">RUNDA ${round}</span></div><div class="game-top"><div><div class="eyebrow">Omgången är klar</div><h1>Dela ut rollerna</h1></div><span class="count">${players.length} SPELARE</span></div><div class="link-grid">${cards}</div><section class="instructions"><span>🤫</span><div><strong>Skicka länkarna en och en</strong><p>Varje deltagarlänk är permanent. När du startar nästa runda får deltagaren automatiskt sin nya roll när länken öppnas eller laddas om.</p></div></section><div class="footer-action"><button class="button secondary" id="again">← Ändra deltagare</button></div>`);
  document.querySelectorAll('.copy').forEach(button => button.onclick = async () => { try { await navigator.clipboard.writeText(button.dataset.url); const old = button.textContent; button.textContent = 'Kopierad!'; setTimeout(() => button.textContent = old, 1400); } catch { prompt('Kopiera länken:', button.dataset.url); } });
  document.querySelectorAll('.open').forEach(button => button.onclick = () => window.open(button.dataset.url, '_blank'));
  document.querySelector('#again').onclick = () => setup(players.map(player => player.name), round + 1);
}

function renderRoleCard(data) {
  const role = roles[data.role] || roles.smudgeWolf;
  app.innerHTML = `<main class="role-page"><section class="role-card"><div class="tag">RUNDA ${data.round} · ${data.name.toUpperCase()}</div><h1 id="role-name">Är du redo?</h1><div class="secret" id="secret"><img class="private-role-art" src="${role.image}" alt="${role.name}"><div class="role-secret-copy"><span class="role-alignment">${role.icon} ${role.alignment}</span><h2>${role.name}</h2><p>${role.text}</p></div></div><button class="button pink reveal" id="reveal">Bryt sigillet</button></section></main>`;
  const secret = document.querySelector('#secret'); const name = document.querySelector('#role-name');
  document.querySelector('#reveal').onclick = event => { const showing = secret.classList.toggle('show'); name.classList.toggle('hidden', showing); event.currentTarget.textContent = showing ? 'Försegla igen' : 'Bryt sigillet'; };
}

function playerPage(gameId, playerId) {
  showNewRoundButton(false);
  showResetGameButton(false);
  app.innerHTML = `<main class="role-page"><section class="role-card"><div class="role-icon">✨</div><h1>Hämtar din roll…</h1><p class="intro">Ett ögonblick bara.</p></section></main>`;
  onSnapshot(playerRef(gameId, playerId), snapshot => { if (!snapshot.exists()) { app.innerHTML = `<main class="role-page"><section class="role-card"><div class="role-icon">💌</div><h1>Ingen runda ännu</h1><p class="intro">Be arrangören att starta en runda och öppna sedan länken igen.</p></section></main>`; return; } renderRoleCard(snapshot.data()); }, error => { console.error(error); app.innerHTML = `<main class="role-page"><section class="role-card"><div class="role-icon">⚠️</div><h1>Kunde inte hämta rollen</h1><p class="intro">Kontrollera internetanslutningen och försök ladda om sidan.</p></section></main>`; });
}

function legacyRolePage(data) { showNewRoundButton(false); showResetGameButton(false); renderRoleCard({ name: data.n, role: data.r, round: 1 }); }

newRoundButton.onclick = nextRound;
resetGameButton.onclick = resetGame;
const params = new URLSearchParams(location.hash.slice(1));
const playerToken = params.get('spelare');
if (playerToken && playerToken.includes('.')) { const [gameId, playerId] = playerToken.split('.'); playerPage(gameId, playerId); }
else { const legacy = params.get('roll'); let legacyData = null; try { legacyData = legacy && JSON.parse(decodeURIComponent(escape(atob(legacy)))); } catch {} if (legacyData?.n && legacyData?.r) legacyRolePage(legacyData); else onAuthStateChanged(auth, user => { if (user) { hostUid = user.uid; restoreHostSetup(); } else signInAnonymously(auth).catch(error => { console.error(error); shell('<div class="shell"><p>Kunde inte ansluta till Firebase. Kontrollera att anonym inloggning är aktiverad.</p></div>'); }); }); }

async function restoreHostSetup() {
  if (!hostedGameId) return setup();
  try {
    const gameSnapshot = await getDoc(gameRef(hostedGameId));
    if (!gameSnapshot.exists()) return setup();
    const playerSnapshots = await getDocs(playersRef(hostedGameId));
    const players = playerSnapshots.docs.map(snapshot => snapshot.data().name).filter(Boolean);
    setup(players.length >= 3 ? players : undefined, (gameSnapshot.data().round || 0) + 1);
  } catch (error) {
    console.error(error);
    setup();
  }
}
