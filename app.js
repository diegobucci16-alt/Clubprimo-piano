/* ================================================
   CLUB 1 PIANO — APP JS
   ================================================
   CONFIGURAZIONE SUPABASE:
   Sostituisci SUPABASE_URL e SUPABASE_ANON_KEY
   con i valori del tuo progetto Supabase.
   ================================================ */

const SUPABASE_URL  = 'https://TUO-PROGETTO.supabase.co';
const SUPABASE_ANON = 'TUA-ANON-KEY';

// Inizializza Supabase (se le credenziali sono settate)
let sb = null;
try {
  if (SUPABASE_URL.includes('TUO-PROGETTO')) {
    console.warn('⚠️ Inserisci SUPABASE_URL e SUPABASE_ANON in app.js');
  } else {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
} catch(e) { console.warn('Supabase non disponibile:', e); }

// ===== STATO UTENTE =====
let currentUser = null;   // oggetto Supabase auth user
let userProfile = null;   // riga dalla tabella profiles

// ===== DATI OFFERTE (in futuro da Supabase) =====
const OFFERS = [
  {
    id: 1, category: 'drink', tag: '-30%',
    name: 'Mojito Classico',
    desc: 'Ogni giovedì sera per i soci Club. Mostra il QR prima di ordinare.',
    price: '€6,30', orig: '€9,00',
    expiry: 'Scade giovedì 19 giugno', active: true,
  },
  {
    id: 2, category: 'food', tag: '2x1',
    name: 'Smash Burger',
    desc: 'Venerdì sera: ordina un burger e il secondo è gratis. Valido 19:00–21:00.',
    price: '€8,00', orig: '€16,00',
    expiry: 'Scade venerdì 20 giugno', active: true,
  },
  {
    id: 3, category: 'evento', tag: 'Free',
    name: 'DJ Set Sabato',
    desc: 'I soci entrano gratis al DJ Set del sabato. Mostra il QR all\'ingresso.',
    price: 'Gratis', orig: '€10,00',
    expiry: 'Scade sabato 21 giugno', active: true,
  },
  {
    id: 4, category: 'drink', tag: '-20%',
    name: 'Spritz Aperitivo',
    desc: 'Domenica aperitivo dalle 18:30. Accumula punti extra.',
    price: '€5,60', orig: '€7,00',
    expiry: 'Disponibile da domenica 22', active: false,
  },
  {
    id: 5, category: 'food', tag: '-15%',
    name: 'Pizza della Settimana',
    desc: 'Una pizza a scelta tra le speciali del giorno con sconto soci.',
    price: '€8,50', orig: '€10,00',
    expiry: 'Disponibile da mercoledì 25', active: false,
  },
];

// ===== LIVELLI =====
const LEVELS = [
  { name: 'Silver',   min: 0,    max: 300,  next: 'Gold' },
  { name: 'Gold',     min: 300,  max: 1000, next: 'Platinum' },
  { name: 'Platinum', min: 1000, max: 9999, next: null },
];

function getLevel(pts) {
  return LEVELS.find(l => pts >= l.min && pts < l.max) || LEVELS[LEVELS.length - 1];
}

// ===== NAVIGAZIONE =====
let currentScreen = 'screen-home';
let screenHistory = [];

function goTo(screenId) {
  if (screenId === currentScreen) return;
  screenHistory.push(currentScreen);
  _activateScreen(screenId);
}

function goBack() {
  const prev = screenHistory.pop();
  if (prev) _activateScreen(prev);
}

function _activateScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  currentScreen = screenId;
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.screen === screenId);
  });
  if (screenId === 'screen-qr') startQRTimer();
  window.scrollTo(0, 0);
}

// ===== AUTH =====
function switchTab(tab) {
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');

  errEl.classList.add('hidden');
  if (!email || !pass) { showAuthError(errEl, 'Compila tutti i campi'); return; }

  btn.disabled = true; btn.textContent = 'Accesso…';

  if (!sb) {
    // DEMO: login senza Supabase
    demoLogin(email);
    btn.disabled = false; btn.textContent = 'Entra';
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false; btn.textContent = 'Entra';
  if (error) { showAuthError(errEl, tradErr(error.message)); return; }
  await loadProfile(data.user);
  enterApp();
}

async function handleRegister() {
  const name    = document.getElementById('reg-name').value.trim();
  const surname = document.getElementById('reg-surname').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const pass    = document.getElementById('reg-password').value;
  const errEl   = document.getElementById('reg-error');
  const btn     = document.getElementById('register-btn');

  errEl.classList.add('hidden');
  if (!name || !surname || !email || !pass) { showAuthError(errEl, 'Compila tutti i campi'); return; }
  if (pass.length < 8) { showAuthError(errEl, 'Password min. 8 caratteri'); return; }

  btn.disabled = true; btn.textContent = 'Creazione…';

  if (!sb) {
    demoLogin(email, name, surname);
    btn.disabled = false; btn.textContent = 'Crea account';
    return;
  }

  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { nome: name, cognome: surname } }
  });
  btn.disabled = false; btn.textContent = 'Crea account';
  if (error) { showAuthError(errEl, tradErr(error.message)); return; }

  // Crea riga profilo
  if (data.user) {
    await sb.from('profiles').upsert({
      id: data.user.id, nome: name, cognome: surname,
      email, punti: 0, visite: 0, offerte_usate: 0
    });
    await loadProfile(data.user);
  }
  enterApp();
}

async function handleLogout() {
  if (sb) await sb.auth.signOut();
  currentUser = null; userProfile = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
}

// DEMO login (senza Supabase configurato)
function demoLogin(email, name, surname) {
  const parts = email.split('@')[0].split('.');
  currentUser = { id: 'demo-' + Date.now(), email };
  userProfile = {
    nome: name || (parts[0] ? capitalize(parts[0]) : 'Utente'),
    cognome: surname || (parts[1] ? capitalize(parts[1]) : ''),
    email,
    punti: 0, visite: 0, offerte_usate: 0
  };
  enterApp();
}

async function loadProfile(user) {
  currentUser = user;
  if (!sb) return;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  userProfile = data || {
    nome: user.user_metadata?.nome || 'Utente',
    cognome: user.user_metadata?.cognome || '',
    email: user.email,
    punti: 0, visite: 0, offerte_usate: 0
  };
}

function enterApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateUI();
  renderHomeOffers();
  renderOfferList('all');
  initFilters();
  setGreeting();
  scheduleLocalPush();
  checkPushStatus();
}

function showAuthError(el, msg) {
  el.textContent = msg; el.classList.remove('hidden');
}

function tradErr(msg) {
  if (msg.includes('Invalid login')) return 'Email o password errati';
  if (msg.includes('already registered')) return 'Email già registrata';
  if (msg.includes('Password')) return 'Password troppo corta (min. 8 caratteri)';
  return msg;
}

// ===== AGGIORNA UI CON DATI UTENTE =====
function updateUI() {
  if (!userProfile) return;
  const nome = userProfile.nome || 'Utente';
  const cognome = userProfile.cognome || '';
  const fullname = nome + (cognome ? ' ' + cognome : '');
  const initials = (nome[0] || '') + (cognome[0] || '');
  const pts = userProfile.punti || 0;
  const lv  = getLevel(pts);
  const pct = lv.max < 9999 ? Math.round(((pts - lv.min) / (lv.max - lv.min)) * 100) : 100;
  const nextLabel = lv.next ? `${lv.max - pts} pt → ${lv.next}` : 'Livello massimo 🏆';

  // Hero
  setText('hero-points', pts);
  setText('hero-level', lv.name);
  setStyle('hero-progress-fill', 'width', pct + '%');
  setText('hero-progress-label', lv.next ? `${lv.max - pts} pt al livello ${lv.next}` : 'Livello massimo 🏆');

  // QR screen
  setText('qr-fullname', fullname);
  setText('qr-avatar', initials || '?');
  setText('qr-level-badge', '✦ Membro ' + lv.name);
  setText('qr-points', pts);
  setText('qr-level-label', lv.name);
  setText('qr-next-label', nextLabel);
  setStyle('qr-progress-fill', 'width', pct + '%');

  // Account
  setText('acc-avatar', initials || '?');
  setText('acc-name', fullname);
  setText('acc-email', userProfile.email || '');
  setText('acc-badge', '✦ Membro ' + lv.name);
  setText('stat-pts', pts);
  setText('stat-visits', userProfile.visite || 0);
  setText('stat-used', userProfile.offerte_usate || 0);

  // Greeting
  setGreeting();

  // Genera QR
  generateQR();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}

// ===== QR GENERATOR =====
// Genera un QR reale con la libreria QRCode.js
// Il payload è: club1piano:{userId}:{timestamp rotante}
function getQRPayload() {
  const uid = currentUser ? currentUser.id : 'demo';
  // Slot di 5 minuti per la rotazione
  const slot = Math.floor(Date.now() / (5 * 60 * 1000));
  return `club1piano:${uid}:${slot}`;
}

function generateQR() {
  const payload = getQRPayload();
  // Canvas principale (schermata QR)
  const mainCanvas = document.getElementById('qr-canvas');
  if (mainCanvas && typeof QRCode !== 'undefined') {
    QRCode.toCanvas(mainCanvas, payload, {
      width: 176, margin: 1,
      color: { dark: '#0D0D0D', light: '#FFFFFF' }
    });
  }
  // Canvas mini (hero card)
  const miniCanvas = document.getElementById('mini-qr-canvas');
  if (miniCanvas && typeof QRCode !== 'undefined') {
    QRCode.toCanvas(miniCanvas, payload, {
      width: 80, margin: 1,
      color: { dark: '#0D0D0D', light: '#FFFFFF' }
    });
  }
}

// ===== TIMER QR (5 minuti) =====
let qrTimerInterval = null;
let qrSecondsLeft = 300;

function startQRTimer() {
  if (qrTimerInterval) clearInterval(qrTimerInterval);
  // Calcola i secondi rimanenti nello slot corrente
  const slotMs = 5 * 60 * 1000;
  qrSecondsLeft = Math.ceil((slotMs - (Date.now() % slotMs)) / 1000);
  updateTimerDisplay();
  qrTimerInterval = setInterval(() => {
    qrSecondsLeft--;
    if (qrSecondsLeft <= 0) {
      // Nuovo slot: rigenera QR
      generateQR();
      const slotMs2 = 5 * 60 * 1000;
      qrSecondsLeft = Math.ceil((slotMs2 - (Date.now() % slotMs2)) / 1000);
    }
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(qrSecondsLeft / 60);
  const s = qrSecondsLeft % 60;
  const el = document.getElementById('qr-timer');
  if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const val = document.getElementById('qr-validity');
  if (val) val.innerHTML = `Codice valido · si rinnova tra <span id="qr-timer">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>`;
}

function refreshQR() {
  const box = document.getElementById('qr-box');
  const btn = document.getElementById('refresh-qr');
  box.style.opacity = '0.2';
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-refresh"></i> Aggiornamento…';
  setTimeout(() => {
    generateQR();
    box.style.opacity = '1';
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-refresh"></i> Aggiorna codice';
    startQRTimer();
    showToast('Codice QR aggiornato ✓');
  }, 900);
}

// ===== RENDER OFFERTE =====
function renderHomeOffers() {
  const scroll = document.getElementById('offer-scroll');
  scroll.innerHTML = OFFERS.filter(o => o.active).map(o => `
    <div class="offer-snap-card" onclick="openModal(${o.id})">
      <div class="offer-snap-tag">${o.tag}</div>
      <div class="offer-snap-badge">${capitalize(o.category)}</div>
      <div class="offer-snap-name">${o.name}</div>
      <div class="offer-snap-desc">${o.desc.split('.')[0]}.</div>
      <div>
        <span class="offer-snap-price">${o.price}</span>
        ${o.orig && o.price !== 'Gratis' ? `<span class="offer-snap-orig">${o.orig}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderOfferList(filter = 'all') {
  const list = document.getElementById('offer-list');
  const items = filter === 'all' ? OFFERS : OFFERS.filter(o => o.category === filter);
  list.innerHTML = items.map(o => `
    <div class="offer-full-card${o.active ? '' : ' dimmed'}"${o.active ? ` onclick="openModal(${o.id})"` : ''}>
      <div class="offer-full-top">
        <div class="offer-full-name">${o.name}</div>
        <div class="offer-full-chip">${capitalize(o.category)}</div>
      </div>
      <div class="offer-full-desc">${o.desc}</div>
      <div class="offer-full-footer">
        <div>
          <span class="offer-full-price">${o.price}</span>
          ${o.orig && o.price !== 'Gratis' ? `<span class="offer-full-orig">${o.orig}</span>` : ''}
        </div>
        ${o.active
          ? `<button class="offer-use-btn" onclick="event.stopPropagation();openModal(${o.id})">Usa QR</button>`
          : `<span class="offer-coming-lbl">In arrivo</span>`}
      </div>
      <div class="offer-expiry">⏱ ${o.expiry}</div>
    </div>
  `).join('');
}

function initFilters() {
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOfferList(btn.dataset.filter);
    });
  });
}

// ===== MODAL =====
function openModal(offerId) {
  const o = OFFERS.find(x => x.id === offerId);
  if (!o) return;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-eyebrow">${capitalize(o.category)} · ${o.tag}</div>
    <div class="modal-title">${o.name}</div>
    <div class="modal-desc">${o.desc}</div>
    <div class="modal-price-row">
      <span class="modal-price">${o.price}</span>
      ${o.orig && o.price !== 'Gratis' ? `<span class="modal-orig">${o.orig}</span>` : ''}
    </div>
    <button class="modal-cta" onclick="useOffer(${o.id})">Apri QR e usa l'offerta</button>
    <div class="modal-expiry">⏱ ${o.expiry}</div>
  `;
  document.getElementById('offer-modal').classList.remove('hidden');
}

function closeModal(event) {
  if (!event) { document.getElementById('offer-modal').classList.add('hidden'); return; }
  if (event.target === document.getElementById('offer-modal') || event.target.closest('.modal-close')) {
    document.getElementById('offer-modal').classList.add('hidden');
  }
}

function useOffer(id) {
  document.getElementById('offer-modal').classList.add('hidden');
  goTo('screen-qr');
  showToast('QR pronto — mostralo al personale! ✓');
}

// ===== NOTIFICHE PUSH REALI =====
// Usa la Web Push API nativa del browser (funziona su Android Chrome e Safari iOS 16.4+)
// Le notifiche locali pianificate funzionano senza server.
// Per notifiche server-side usa Supabase Edge Functions + VAPID.

let pushGranted = false;

function checkPushStatus() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    pushGranted = true;
    updatePushUI(true);
    scheduleLocalPush();
  } else {
    updatePushUI(false);
  }
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = Notification.permission !== 'granted' ? 'block' : 'none';
}

async function requestPushPermission() {
  if (!('Notification' in window)) {
    showToast('Notifiche non supportate su questo browser');
    return;
  }
  if (Notification.permission === 'granted') {
    showToast('Notifiche già attive ✓');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    pushGranted = true;
    updatePushUI(true);
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = 'none';
    // Notifica immediata di benvenuto
    new Notification('Club 1 Piano 🥂', {
      body: 'Notifiche attive! Ti avviseremo ogni giorno alle 15:00.',
      icon: 'https://www.portagalliana-clubprimopiano.com/assets/logo.png',
      badge: 'https://www.portagalliana-clubprimopiano.com/assets/logo.png',
    });
    scheduleLocalPush();
    showToast('Notifiche attivate ✓');
  } else {
    showToast('Permesso notifiche negato');
  }
}

function updatePushUI(active) {
  const btn  = document.getElementById('notif-toggle-btn');
  const sub  = document.getElementById('notif-status-text');
  if (btn) {
    btn.textContent = active ? 'Attive ✓' : 'Attiva';
    btn.classList.toggle('active', active);
  }
  if (sub) sub.textContent = active ? 'Ricevi offerte ogni giorno alle 15:00' : 'Attiva per non perdere le offerte';
}

function scheduleLocalPush() {
  // Pianifica una notifica locale per oggi alle 15:00 (o domani se già passate)
  if (!pushGranted && Notification.permission !== 'granted') return;

  const now = new Date();
  const target = new Date();
  target.setHours(15, 0, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);

  const msUntil = target.getTime() - now.getTime();

  // Cancella timer precedente
  if (window._pushTimer) clearTimeout(window._pushTimer);

  window._pushTimer = setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('Club 1 Piano ti aspetta! 🍹', {
        body: 'Vieni a scoprire le offerte di Club Primo Piano. Ti aspettiamo stasera!',
        icon: 'https://www.portagalliana-clubprimopiano.com/assets/logo.png',
        badge: 'https://www.portagalliana-clubprimopiano.com/assets/logo.png',
        tag: 'daily-offer',
        renotify: true,
      });
    }
    // Ripianifica per il giorno dopo
    setTimeout(scheduleLocalPush, 60 * 1000);
  }, msUntil);
}

// ===== TOAST =====
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2600);
}

// ===== GREETING =====
function setGreeting() {
  const h = new Date().getHours();
  const saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const nome = userProfile?.nome || 'Benvenuto';
  const el = document.getElementById('greeting-text');
  if (el) el.textContent = `${saluto}, ${nome} 👋`;
}

// ===== UTILS =====
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== SPLASH + INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  // Nascondi splash dopo 1.9s
  setTimeout(async () => {
    const splash = document.getElementById('splash');
    splash.style.opacity = '0';
    splash.style.transition = 'opacity 0.5s';
    setTimeout(() => splash.style.display = 'none', 500);

    // Controlla sessione Supabase esistente
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        await loadProfile(session.user);
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        updateUI();
        renderHomeOffers();
        renderOfferList('all');
        initFilters();
        setGreeting();
        scheduleLocalPush();
        checkPushStatus();
        return;
      }
    }

    // Mostra auth
    document.getElementById('auth-screen').classList.remove('hidden');
  }, 1900);
});