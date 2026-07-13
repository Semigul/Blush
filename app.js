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
  ulv: { name: 'Trendtjuv', icon: '🖤', text: 'Du vill undvika att bli utpekad. Under samtalet ska du få minst två personer att säga ordet “glow” utan att avslöja varför. Lyckas du, har du ett hemligt ess i ärmen vid omröstningen.' },
  siare: { name: 'Moodboardaren', icon: '🎨', text: 'Välj i hemlighet en färg. När diskussionen börjar beskriver du gruppen med tre beauty- eller modeord som antyder färgen. Ingen får fråga dig rakt ut vilken färg du valde.' },
  bråkmakare: { name: 'Catwalk-kaptenen', icon: '👠', text: 'En gång under diskussionen får du ropa “catwalk!” och välja vem som måste prata näst i 20 sekunder. Du får inte förklara varför du valde just den personen.' },
  sömnig: { name: 'Nagelpoeten', icon: '💅', text: 'Välj en känsla: matt, glittrig eller krom. Inled morgonen med en kort dikt på en mening som förmedlar känslan, men säg aldrig ordet du valde.' },
  bybo: { name: 'Lookbook-detektiven', icon: '🕵️‍♀️', text: 'Du får ställa en enda stilfråga till valfri spelare, till exempel “Vilken era är du i dag?”. Använd svaret och kroppsspråket för att avgöra vem som bluffar.' }
};

let hostUid = null;
let hostedGameId = localStorage.getItem(hostGameKey);

function shell(content) { app.innerHTML = `<div class="shell">${content}</div>`; }
function randomId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function normalizeName(name) { return name.trim().toLocaleLowerCase('sv-SE'); }
function gameRef(gameId) { return doc(db, 'games', gameId); }
function playersRef(gameId) { return collection(db, 'games', gameId, 'players'); }
function playerRef(gameId, playerId) { return doc(db, 'games', gameId, 'players', playerId); }
function roleSet(count) { const set = ['ulv', 'siare', 'bråkmakare']; while (set.length < count) set.push(set.length < 5 ? 'sömnig' : 'bybo'); return set.slice(0, count).sort(() => Math.random() - .5); }
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
  const roleCards = Object.values(roles).map(role => `<article class="role-guide-card"><span>${role.icon}</span><div><h3>${role.name}</h3><p>${role.text}</p></div></article>`).join('');
  shell(`<div class="brand"><span class="brand-mark">💋</span> Blush &amp; Bluff</div><section class="hero"><div class="eyebrow">Ett spel för sena kvällar</div><h1>Vem är <em>inte</em><br>som den säger?</h1><p>Ett snabbspolat bluffspel för kompisgänget. Dela ut de hemliga länkarna, spela en natt och rösta ut någon före frukost.</p></section><section class="card setup"><h2 class="section-title">Starta en omgång</h2><p class="muted">Skriv deltagarnas namn. Var och en får en egen, hemlig länk som fungerar i alla kommande rundor.</p><div id="names"></div><button class="add-link" id="add">＋ lägg till spelare</button><div class="rules"><strong>Så här funkar det:</strong> Du skickar varje länk privat till rätt person. Alla läser sin roll, följer nattfasen tillsammans och diskuterar sedan i grupp innan ni röstar.</div><button class="button pink" id="start">Starta runda ${nextRound} →</button></section><section class="game-guide" aria-labelledby="guide-title"><div class="guide-heading"><div><div class="eyebrow">Snabbguide</div><h2 id="guide-title">Så spelar ni</h2></div><span>5–15 min</span></div><ol class="steps"><li><b>1</b><div><strong>Arrangören startar</strong><p>Fyll i namnen och skicka varje hemlig länk privat.</p></div></li><li><b>2</b><div><strong>Alla läser sin roll</strong><p>Var och en öppnar sin länk i enrum och håller uppdraget hemligt.</p></div></li><li><b>3</b><div><strong>Prata fashion &amp; beauty</strong><p>Följ era hemliga uppdrag och lyssna efter andras ledtrådar.</p></div></li><li><b>4</b><div><strong>Rösta tillsammans</strong><p>Bestäm vem ni tror bluffar bäst – och avslöja sedan rollerna.</p></div></li></ol><div class="roles-heading"><div class="eyebrow">Rollerna</div><h2>Vilken look får du?</h2><p>Alla vet vilka roller som kan vara med, men bara du känner till din egen.</p></div><div class="role-guide-grid">${roleCards}</div></section>`);
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
  const role = roles[data.role] || roles.bybo;
  app.innerHTML = `<main class="role-page"><section class="role-card"><div class="tag">RUNDA ${data.round} · ${data.name.toUpperCase()}</div><div class="role-icon" id="role-icon">✨</div><div class="eyebrow">Din hemliga roll</div><h1 id="role-name">Är du redo?</h1><p class="intro">Se till att du är ensam innan du tittar. Inga tjuvkikare, okej? 💗</p><button class="button pink reveal" id="reveal">Visa min roll</button><div class="secret" id="secret">${role.text}</div><p class="tiny">Länken är din även i nästa runda. Ladda om sidan för att se din nya roll.</p></section></main>`;
  const secret = document.querySelector('#secret'); const name = document.querySelector('#role-name'); const icon = document.querySelector('#role-icon');
  document.querySelector('#reveal').onclick = event => { const showing = secret.classList.toggle('show'); name.textContent = showing ? role.name : 'Är du redo?'; icon.textContent = showing ? role.icon : '✨'; event.currentTarget.textContent = showing ? 'Dölj min roll' : 'Visa min roll'; };
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
