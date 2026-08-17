/**
 * CANTINE KITCHEN HUB - UNIFIED APPLICATION LOGIC
 * Manages State, Auth, Real-Time In-App Manager Suite, Prep KDS, Orders, & Recipes
 */

const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzwC97-8v1ZvaTU7l0JapGtSj7r-b54fcH-kR7Rvu6QKmnnMcbIXUU1SsillriD91YeEA/exec';

// Application State
const state = {
  currentUser: null,
  activeModule: 'dashboard',
  activeCategory: 'All',
  activeStation: 'All',
  activeWorkflow: 'All',
  showLegacyRecipes: false,
  eightySixList: [],
  vipNotes: [],
  data: null,
  builderSelections: {},
  syncTimer: null,
  backendUrl: localStorage.getItem('cantine_backend_url') || DEFAULT_BACKEND_URL,
  isScheduleEditMode: false,
  selectedScheduleWeek: null
};

// -------------------------------------------------------------
// FIREBASE REALTIME DATABASE CONFIG & SYNC ENGINE
// -------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDOCJzAuu-_QgvROModrGZzyFPpbiYs_Ec",
  authDomain: "cantine-kitchen.firebaseapp.com",
  databaseURL: "https://cantine-kitchen-default-rtdb.firebaseio.com",
  projectId: "cantine-kitchen",
  storageBucket: "cantine-kitchen.firebasestorage.app",
  messagingSenderId: "340074333551",
  appId: "1:340074333551:web:1df37a3103c9f3c6d6d49a",
  measurementId: "G-ZQD01HRPGC"
};

let firebaseDb = null;
let firebaseInitialized = false;

function initFirebaseRealtimeSync() {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      firebaseDb = firebase.database();
      firebaseInitialized = true;
      console.log('⚡ Firebase Realtime Database connected successfully!');

      // Instant WebSocket Listener: Live Prep Items
      firebaseDb.ref('livePrepItems').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && Array.isArray(val) && state.data) {
          const cloudStr = JSON.stringify(val);
          const currentStr = JSON.stringify(state.data.prepItems || []);
          if (cloudStr !== currentStr) {
            state.data.prepItems = val;
            localStorage.setItem('cantine_live_prep', cloudStr);
            saveMasterData();
            if (state.activeModule === 'prep') renderPrepBoard();
          }
        }
      });

      // Instant WebSocket Listener: Multi-Week Schedules
      firebaseDb.ref('liveSchedules').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object' && state.data) {
          const cloudStr = JSON.stringify(val);
          const currentStr = JSON.stringify(state.data.schedules || {});
          if (cloudStr !== currentStr) {
            state.data.schedules = val;
            localStorage.setItem('cantine_live_schedules', cloudStr);
            syncActiveWeekToSchedule();
            saveMasterData();
            if (state.activeModule === 'schedule') renderScheduleMatrix();
          }
        }
      });

      // Instant WebSocket Listener: Active Week Schedule
      firebaseDb.ref('liveSchedule').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && Array.isArray(val) && state.data) {
          const cloudStr = JSON.stringify(val);
          const currentStr = JSON.stringify(state.data.schedule || []);
          if (cloudStr !== currentStr) {
            state.data.schedule = val;
            localStorage.setItem('cantine_live_schedule', cloudStr);
            saveMasterData();
            if (state.activeModule === 'schedule') renderScheduleMatrix();
          }
        }
      });

      // Instant WebSocket Listener: Cleaning Tracker
      firebaseDb.ref('liveCleaning').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object' && state.data) {
          const cloudStr = JSON.stringify(val);
          const currentStr = JSON.stringify(state.data.cleaning || {});
          if (cloudStr !== currentStr) {
            state.data.cleaning = val;
            localStorage.setItem('cantine_live_cleaning', cloudStr);
            saveMasterData();
            if (state.activeModule === 'cleaning') renderCleaningTracker();
          }
        }
      });

    } catch (e) {
      console.warn('Firebase Realtime Sync Init Warning:', e);
    }
  }
}

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  checkSavedSession();
  await loadInitialData();
});

// Event Listeners Setup
function setupEventListeners() {
  const pinInput = document.getElementById('pin-input');
  if (pinInput) {
    pinInput.addEventListener('input', (e) => {
      if (e.target.value.length === 3) {
        handlePinSubmit(e.target.value);
      }
    });
  }

  // Handle Browser Back / Forward Button Navigation
  window.addEventListener('popstate', (e) => {
    if (!state.currentUser) return;
    if (e.state && e.state.module) {
      switchModule(e.state.module, e.state.title, false);
    } else if (window.location.hash) {
      const modFromHash = window.location.hash.replace('#', '');
      if (modFromHash) {
        switchModule(modFromHash, null, false);
      }
    } else {
      switchModule('dashboard', 'Command Center', false);
    }
  });
}

// Session Check
function checkSavedSession() {
  const savedUser = localStorage.getItem('cantine_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
      showAppShell();
    } catch (e) {
      localStorage.removeItem('cantine_user');
    }
  }
}

// Master Data Persistence
function saveMasterData() {
  if (state.data) {
    localStorage.setItem('cantine_master_data', JSON.stringify(state.data));
    if (state.data.prepItems) {
      localStorage.setItem('cantine_live_prep', JSON.stringify(state.data.prepItems));
    }
    if (state.data.schedule) {
      localStorage.setItem('cantine_live_schedule', JSON.stringify(state.data.schedule));
    }
    if (state.data.schedules) {
      localStorage.setItem('cantine_live_schedules', JSON.stringify(state.data.schedules));
    }
    if (state.data.cleaning) {
      localStorage.setItem('cantine_live_cleaning', JSON.stringify(state.data.cleaning));
    }
    localStorage.setItem('cantine_eightysix', JSON.stringify(state.eightySixList));
    localStorage.setItem('cantine_vip_notes', JSON.stringify(state.vipNotes));
  }
}

// Load Initial Data (Reads from in-app storage with data.js seed fallback)
async function loadInitialData() {
  const savedData = localStorage.getItem('cantine_master_data');
  if (savedData) {
    try {
      state.data = JSON.parse(savedData);
    } catch (e) {
      console.warn('Error reading saved master data, loading seed data...', e);
    }
  }

  const saved86 = localStorage.getItem('cantine_eightysix');
  if (saved86) {
    try { state.eightySixList = JSON.parse(saved86); } catch (e) {}
  }

  const savedVip = localStorage.getItem('cantine_vip_notes');
  if (savedVip) {
    try { state.vipNotes = JSON.parse(savedVip); } catch (e) {}
  }

  // Ensure state.data is valid and has all required arrays
  if (!state.data || typeof state.data !== 'object') {
    state.data = window.CANTINE_SEED_DATA ? JSON.parse(JSON.stringify(window.CANTINE_SEED_DATA)) : {};
    saveMasterData();
  } else if (window.CANTINE_SEED_DATA) {
    ['staff', 'suppliers', 'inventory', 'prepInventory', 'prepItems', 'recipes', 'schedule', 'passdownNotes', 'cleaning'].forEach(key => {
      if (!state.data[key]) {
        if (key === 'cleaning') {
          state.data[key] = JSON.parse(JSON.stringify(defaultCleaningData));
        } else {
          state.data[key] = JSON.parse(JSON.stringify(window.CANTINE_SEED_DATA[key] || []));
        }
      }
    });
  }

  // Initialize multi-week schedules structure
  ensureSchedulesStructure();

  // Initialize Firebase Realtime Database Sync
  initFirebaseRealtimeSync();

  // Initial Module Render
  renderCurrentModule();

  // Initialize Global Clock & Kitchen Timers
  loadSavedKitchenTimers();
  updateGlobalHeaderClock();
  setInterval(updateGlobalHeaderClock, 1000);

  // Start Background Sync Polling (Every 15 seconds to prevent rate limits)
  if (!state.syncTimer) {
    state.syncTimer = setInterval(pollLiveUpdates, 15000);
  }
}

// PIN Auth Submission
async function handlePinSubmit(pin) {
  const pinInput = document.getElementById('pin-input');
  const errorMsg = document.getElementById('auth-error');

  pinInput.disabled = true;

  const staff = (state.data && state.data.staff) ? state.data.staff : [];
  const foundStaff = staff.find(s => String(s.pin).trim() === String(pin).trim() && s.active);

  if (foundStaff) {
    state.currentUser = foundStaff;
    localStorage.setItem('cantine_user', JSON.stringify(foundStaff));
    errorMsg.classList.add('hidden');
    showAppShell();
  } else {
    errorMsg.classList.remove('hidden');
    pinInput.value = '';
    pinInput.disabled = false;
    pinInput.focus();
  }
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('cantine_user');
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-input').disabled = false;
  document.getElementById('pin-input').focus();
}

const MODULE_TITLES = {
  dashboard: 'Command Center',
  prep: 'Prep Board',
  order: 'Inventory & Orders',
  recipe: 'Recipe Vault',
  schedule: 'Shift Schedule',
  menu: 'Menus',
  cleaning: 'Cleaning Tracker'
};

function showAppShell() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  const nameDisplay = document.getElementById('user-name-display');
  if (nameDisplay && state.currentUser) {
    nameDisplay.innerText = state.currentUser.name;
  }

  let initialMod = 'dashboard';
  if (window.location.hash) {
    const hashMod = window.location.hash.replace('#', '');
    if (MODULE_TITLES[hashMod]) {
      initialMod = hashMod;
    }
  }

  const initialTitle = MODULE_TITLES[initialMod] || 'Command Center';
  state.activeModule = initialMod;
  if (window.history && history.replaceState) {
    history.replaceState({ module: initialMod, title: initialTitle }, initialTitle, `#${initialMod}`);
  }

  switchModule(initialMod, initialTitle, false);
}

// Navigation & View Switching
function toggleNav(open) {
  const nav = document.getElementById('side-nav');
  if (open) nav.classList.add('open');
  else nav.classList.remove('open');
}

function switchModule(modName, modTitle, updateHistory = true) {
  if (!modTitle) {
    modTitle = MODULE_TITLES[modName] || 'Cantine Hub';
  }

  state.activeModule = modName;
  const titleEl = document.getElementById('module-title');
  if (titleEl) titleEl.innerText = modTitle;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${modName}`);
  if (activeNav) activeNav.classList.add('active');

  toggleNav(false);
  renderCurrentModule();

  if (updateHistory && window.history && window.history.pushState) {
    const targetHash = `#${modName}`;
    if (window.location.hash !== targetHash) {
      history.pushState({ module: modName, title: modTitle }, modTitle, targetHash);
    }
  }
}

function renderCurrentModule() {
  if (!state.data) return;

  const dashSec = document.getElementById('module-dashboard-sec');
  const prepSec = document.getElementById('module-prep-sec');
  const orderSec = document.getElementById('module-order-sec');
  const recipeSec = document.getElementById('module-recipe-sec');
  const schedSec = document.getElementById('module-schedule-sec');
  const menuSec = document.getElementById('module-menu-sec');
  const cleanSec = document.getElementById('module-cleaning-sec');

  if (dashSec) dashSec.classList.add('hidden');
  if (prepSec) prepSec.classList.add('hidden');
  if (orderSec) orderSec.classList.add('hidden');
  if (recipeSec) recipeSec.classList.add('hidden');
  if (schedSec) schedSec.classList.add('hidden');
  if (menuSec) menuSec.classList.add('hidden');
  if (cleanSec) cleanSec.classList.add('hidden');

  if (state.activeModule === 'dashboard') {
    if (dashSec) dashSec.classList.remove('hidden');
    renderDashboard();
  } else if (state.activeModule === 'prep') {
    if (prepSec) prepSec.classList.remove('hidden');
    renderPrepBoard();
  } else if (state.activeModule === 'order') {
    if (orderSec) orderSec.classList.remove('hidden');
    renderInventoryOrderSheet();
  } else if (state.activeModule === 'recipe') {
    if (recipeSec) recipeSec.classList.remove('hidden');
    renderRecipeVault();
  } else if (state.activeModule === 'schedule') {
    if (schedSec) schedSec.classList.remove('hidden');
    renderScheduleMatrix();
  } else if (state.activeModule === 'menu') {
    if (menuSec) menuSec.classList.remove('hidden');
    renderMenuGenerator();
  } else if (state.activeModule === 'cleaning') {
    if (cleanSec) cleanSec.classList.remove('hidden');
    renderCleaningTracker();
  }
}

// -------------------------------------------------------------
// MODULE 0: COMMAND CENTER DASHBOARD & KITCHEN WIDGETS
// -------------------------------------------------------------
function renderDashboard() {
  updateDashboardHero();
  renderSubappLaunchers();
  renderSpecialsShowcase();
  renderCleaningWidget();
  render86Widget();
  renderBulletinBoard();
  renderVIPWidget();
  renderScheduleWidget();
}

function updateDashboardHero() {
  const greetingEl = document.getElementById('dash-greeting-text');
  const dateEl = document.getElementById('dash-date-text');
  const user = state.currentUser ? state.currentUser.name : 'Chef';
  
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const dateStr = `${dayName}, ${monthName} ${now.getDate()}, ${now.getFullYear()}`;

  const hour = now.getHours();
  let shiftName = 'Morning Shift ☀️';
  if (hour >= 15 && hour < 22) shiftName = 'Evening Service 🌙';
  else if (hour >= 22 || hour < 5) shiftName = 'Late Night / Close 🌌';

  if (greetingEl) greetingEl.innerText = `Chef ${user} - Cantine Hub`;
  if (dateEl) dateEl.innerText = `📅 ${dateStr} • ${shiftName}`;
}

function renderSubappLaunchers() {
  const prepItems = state.data?.prepItems || [];
  const pendingPrepCount = prepItems.filter(i => !i.isDone).length;
  const prepBadge = document.getElementById('tile-prep-badge');
  if (prepBadge) prepBadge.innerText = `${pendingPrepCount} Pending Items`;

  const invItems = state.data?.inventory || [];
  const invBadge = document.getElementById('tile-order-badge');
  if (invBadge) invBadge.innerText = `${invItems.length} Master Items`;

  const recipes = state.data?.recipes || [];
  const activeRecipesCount = recipes.filter(r => (r.status || 'Active').toLowerCase() !== 'legacy' && (r.status || 'Active').toLowerCase() !== 'archived').length;
  const recipeBadge = document.getElementById('tile-recipe-badge');
  if (recipeBadge) recipeBadge.innerText = `${activeRecipesCount} Active Specs`;

  const schedule = state.data?.schedule || [];
  const schedBadge = document.getElementById('tile-sched-badge');
  if (schedBadge) schedBadge.innerText = `${schedule.length} Staff Rota`;

  const menuBadge = document.getElementById('tile-menu-badge');
  if (menuBadge) menuBadge.innerText = `Active Specials`;

  const cleanBadge = document.getElementById('tile-clean-badge');
  if (cleanBadge) cleanBadge.innerText = `Checklists Ready`;
}

function renderSpecialsShowcase() {
  const container = document.getElementById('dash-specials-container');
  if (!container) return;

  const dsAll = (typeof getFiveDailySpecials === 'function') ? getFiveDailySpecials() : {};
  const now = new Date();
  const dayNum = now.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let dayKey = 'weekend';
  if (dayNum === 1) dayKey = 'mon';
  else if (dayNum === 2) dayKey = 'tue';
  else if (dayNum === 3) dayKey = 'wed';
  else if (dayNum === 4) dayKey = 'thu';
  else dayKey = 'weekend';

  const daySpecials = dsAll[dayKey] || dsAll.weekend || {};
  const dayName = dayNames[dayNum];

  let itemsToRender = [];

  if (dayKey === 'thu') {
    itemsToRender.push({
      title: `Thursday Tapas Feature`,
      desc: daySpecials.tapas ? `${daySpecials.tapas}` : (daySpecials.wines || []).map(w => `${w.num}. ${w.name}`).join(' | '),
      price: '$20',
      img: 'cantine top logo.png'
    });
  } else if (daySpecials && daySpecials.items && Array.isArray(daySpecials.items)) {
    itemsToRender = daySpecials.items.map(item => {
      let img = 'cantine logo bottom.png';
      if (state.data && state.data.recipes) {
        const match = state.data.recipes.find(r => r.name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(r.name.toLowerCase()));
        if (match && match.photoUrl) img = match.photoUrl;
      }
      return {
        title: item.name,
        desc: item.desc || `${daySpecials.title || 'Daily Special'} ${daySpecials.subtitle ? '(' + daySpecials.subtitle + ')' : ''}`,
        price: item.price ? `$${item.price}` : '',
        img: img
      };
    });
  }

  const specialTitle = daySpecials.title ? `${dayName}'s Special: ${daySpecials.title}` : `${dayName}'s Specials`;

  let html = `
    <div style="width:100%; grid-column: 1 / -1; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-weight:bold; color:var(--accent-gold); font-size:1.05rem;">🌟 ${escapeHTML(specialTitle)}</div>
      <button class="btn btn-secondary btn-sm" style="font-size:0.8rem; padding:3px 8px;" onclick="switchModule('menu', 'Menus'); switchMenuSubTab('${dayKey}');">View Full Menu ➔</button>
    </div>
  `;

  if (itemsToRender.length === 0) {
    html += '<div style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding:15px; grid-column: 1 / -1;">No specials listed for today.</div>';
  } else {
    html += itemsToRender.map(s => `
      <div class="dash-special-item" onclick="switchModule('menu', 'Menus'); switchMenuSubTab('${dayKey}');" style="cursor:pointer;">
        <img src="${s.img}" class="dash-special-img" alt="${escapeHTML(s.title)}" onerror="this.src='cantine logo bottom.png'">
        <div class="dash-special-content">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;">
            <div class="dash-special-title">${escapeHTML(s.title)}</div>
            ${s.price ? `<span style="background:var(--accent-gold); color:#000; font-weight:800; font-size:0.75rem; padding:2px 6px; border-radius:4px; white-space:nowrap;">${escapeHTML(s.price)}</span>` : ''}
          </div>
          <div class="dash-special-desc">${escapeHTML(s.desc)}</div>
        </div>
      </div>
    `).join('');
  }

  container.innerHTML = html;
}

function render86Widget() {
  const container = document.getElementById('eightysix-list-container');
  const countBadge = document.getElementById('eightysix-count-badge');
  if (!container) return;

  const list = state.eightySixList || [];
  if (countBadge) countBadge.innerText = `${list.length} Items`;

  if (list.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding:15px;">All items in stock! No 86 items logged.</div>';
    return;
  }

  container.innerHTML = list.map((item, idx) => `
    <div class="eightysix-item">
      <div>
        <div class="eightysix-name">🚫 ${escapeHTML(item.name)}</div>
        <div class="eightysix-time">Logged by ${escapeHTML(item.by || 'Chef')} at ${escapeHTML(item.time || '')}</div>
      </div>
      <button class="eightysix-un86-btn" onclick="removeEightySixItem(${idx})">In Stock ✓</button>
    </div>
  `).join('');
}

function addEightySixItem() {
  const input = document.getElementById('eightysix-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  if (!state.eightySixList) state.eightySixList = [];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const by = state.currentUser ? state.currentUser.name : 'Chef';

  state.eightySixList.push({ name: val, time: time, by: by });
  input.value = '';
  saveMasterData();
  pushLiveSync();
  render86Widget();
}

function removeEightySixItem(idx) {
  if (state.eightySixList && state.eightySixList[idx]) {
    state.eightySixList.splice(idx, 1);
    saveMasterData();
    pushLiveSync();
    render86Widget();
  }
}

function renderBulletinBoard() {
  const container = document.getElementById('bulletin-board-container');
  if (!container) return;

  const notes = state.data?.passdownNotes || [];
  if (notes.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding:15px;">No bulletin posts yet. Click + Post Note to leave a passdown!</div>';
    return;
  }

  container.innerHTML = notes.slice().reverse().map(note => `
    <div class="bulletin-card">
      <div class="bulletin-author">
        <span>👨‍🍳 Shift Passdown</span>
      </div>
      <div class="bulletin-text">${escapeHTML(note)}</div>
    </div>
  `).join('');
}

function renderVIPWidget() {
  const container = document.getElementById('vip-notes-container');
  if (!container) return;

  const vips = state.vipNotes || [];
  if (vips.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding:15px;">No VIP / Big Reservations logged for today.</div>';
    return;
  }

  container.innerHTML = vips.map((v, idx) => `
    <div class="vip-card">
      <div class="vip-card-header">
        <div class="vip-title">⭐ ${escapeHTML(v.name)}</div>
        ${v.time ? `<span class="vip-time-badge">${escapeHTML(v.time)}</span>` : ''}
      </div>
      ${v.size ? `<div class="vip-details">📍 Party: ${escapeHTML(v.size)}</div>` : ''}
      ${v.notes ? `<div class="vip-notes-text">📝 ${escapeHTML(v.notes)}</div>` : ''}
      <div style="text-align:right; margin-top:6px;">
        <button class="btn btn-danger btn-sm" style="padding:2px 8px; font-size:0.75rem;" onclick="removeVipNote(${idx})">Dismiss</button>
      </div>
    </div>
  `).join('');
}

function openVipNoteModal() {
  const modal = document.getElementById('modal-vip-reservation');
  if (modal) {
    document.getElementById('vip-name-input').value = '';
    document.getElementById('vip-time-input').value = '';
    document.getElementById('vip-size-input').value = '';
    document.getElementById('vip-notes-input').value = '';
    modal.style.display = 'block';
  }
}

function saveVipNote() {
  const name = document.getElementById('vip-name-input').value.trim();
  if (!name) { alert('Please enter a party or guest name (e.g., "30 top at 6pm")'); return; }

  const time = document.getElementById('vip-time-input').value.trim();
  const size = document.getElementById('vip-size-input').value.trim();
  const notes = document.getElementById('vip-notes-input').value.trim();

  if (!state.vipNotes) state.vipNotes = [];
  state.vipNotes.push({ name, time, size, notes });

  saveMasterData();
  pushLiveSync();
  closeModal('modal-vip-reservation');
  renderVIPWidget();
}

function removeVipNote(idx) {
  if (state.vipNotes && state.vipNotes[idx]) {
    state.vipNotes.splice(idx, 1);
    saveMasterData();
    pushLiveSync();
    renderVIPWidget();
  }
}

function renderCleaningWidget() {
  const container = document.getElementById('dash-cleaning-container');
  if (!container) return;

  const cd = (typeof getCleaningData === 'function') ? getCleaningData() : null;
  if (!cd) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.95rem;">Cleaning tracker loading...</div>';
    return;
  }

  const todayKey = (typeof getTodayKey === 'function') ? getTodayKey() : new Date().toISOString().slice(0,10);
  const completions = cd.dailyCompletions ? (cd.dailyCompletions[todayKey] || {}) : {};

  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayDayKey = dayKeys[new Date().getDay()];
  const matrix = cd.weeklyDeepCleanMatrix || {};
  const todayDeepInfo = matrix[todayDayKey] || { dayName: 'Today', zone: 'General Clean', tasks: 'Maintain station' };
  const deepTaskId = `deep_${todayDayKey}`;

  const downtimeTasks = cd.dailyDowntimeTasks || [];
  const totalTasks = downtimeTasks.length + 1;

  let doneCount = 0;
  if (completions[deepTaskId] && completions[deepTaskId].completed) doneCount++;
  downtimeTasks.forEach(t => {
    if (completions[t.id] && completions[t.id].completed) doneCount++;
  });

  const pct = Math.round((doneCount / totalTasks) * 100);

  const cleanBadge = document.getElementById('tile-clean-badge');
  if (cleanBadge) cleanBadge.innerText = `${doneCount}/${totalTasks} Done (${pct}%)`;

  const isDeepDone = completions[deepTaskId] && completions[deepTaskId].completed;
  const isDeepVerified = completions[deepTaskId] && completions[deepTaskId].chefVerified;

  let deepStatusBadge = '<span style="background:rgba(255,152,0,0.2); color:var(--accent-orange); padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">Pending</span>';
  if (isDeepVerified) {
    deepStatusBadge = `<span style="background:var(--accent-gold); color:#000; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">✓ Verified by ${escapeHTML(completions[deepTaskId].verifiedBy || 'Chef')}</span>`;
  } else if (isDeepDone) {
    deepStatusBadge = `<span style="background:rgba(76,175,80,0.2); color:var(--accent-green); padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">✓ Done by ${escapeHTML(completions[deepTaskId].by || 'Staff')}</span>`;
  }

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
      <div style="font-weight:bold; color:var(--accent-gold); font-size:1.05rem;">
        Shift Completion: <span style="color:#fff;">${doneCount} of ${totalTasks} Tasks Completed</span>
      </div>
      <div style="font-weight:800; color:var(--accent-green); font-size:1.1rem;">${pct}%</div>
    </div>
    
    <div class="clean-progress-bar" style="margin-bottom:18px;">
      <div class="clean-progress-fill" style="width:${pct}%;"></div>
    </div>

    <div style="background:#272733; border:1px solid #3d3d52; border-left:4px solid var(--accent-gold); padding:12px 16px; border-radius:8px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <div style="font-size:0.85rem; font-weight:800; color:var(--accent-gold); text-transform:uppercase; letter-spacing:0.5px;">Today's Deep Clean Focus</div>
        <div style="font-size:1.1rem; font-weight:800; color:#fff; margin-top:2px;">📍 ${escapeHTML(todayDeepInfo.zone)} - ${escapeHTML(todayDeepInfo.tasks)}</div>
      </div>
      <div>${deepStatusBadge}</div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:10px;">
  `;

  downtimeTasks.forEach(task => {
    const isDone = completions[task.id] && completions[task.id].completed;
    const completedBy = isDone ? completions[task.id].by : '';

    html += `
      <div style="background:${isDone ? 'rgba(76,175,80,0.1)' : '#252525'}; border:1px solid ${isDone ? 'rgba(76,175,80,0.3)' : '#333'}; padding:10px 12px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px; min-width:0;">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleWidgetCleaningTask('${task.id}')" style="width:18px; height:18px; accent-color:var(--accent-green); cursor:pointer;">
          <div style="font-size:0.95rem; font-weight:bold; color:${isDone ? 'var(--accent-green)' : '#fff'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(task.name)}</div>
        </div>
        ${isDone ? `<span style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">by ${escapeHTML(completedBy)}</span>` : '<span style="font-size:0.75rem; color:var(--text-dim);">Pending</span>'}
      </div>
    `;
  });

  html += `</div>`;

  container.innerHTML = html;
}

function toggleWidgetCleaningTask(taskId) {
  if (typeof openCleaningPinModal === 'function') {
    openCleaningPinModal('daily', taskId);
  } else {
    switchModule('cleaning', 'Cleaning Tracker');
  }
}

function renderScheduleWidget() {
  const container = document.getElementById('dash-schedule-container');
  if (!container) return;

  const rawSchedule = state.data?.schedule || [];
  const dayKeys = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];
  const todayKey = dayKeys[new Date().getDay()];

  const workingToday = [];
  rawSchedule.forEach(staff => {
    const name = staff.name;
    if (!name || name.toLowerCase().includes('legend')) return;
    const shift = staff.shifts ? staff.shifts[todayKey] : 'x';
    if (shift && shift.toLowerCase() !== 'x') {
      workingToday.push({ name: staff.name, shift: shift, avail: staff.availability || '' });
    }
  });

  let html = `
    <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <span>Shift Rota (${todayKey}): <strong style="color:var(--accent-gold);">${workingToday.length} Staff Working Today</strong></span>
    </div>
  `;

  if (workingToday.length === 0) {
    html += '<div style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding:15px;">No staff scheduled for today.</div>';
  } else {
    html += `<div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto;">`;
    workingToday.forEach(s => {
      const st = s.shift.toLowerCase();
      let badgeStyle = 'background:#332b00; color:var(--accent-gold); border:1px solid #555;';
      if (st.includes('cl')) badgeStyle = 'background:#451212; color:var(--accent-red); border:1px solid var(--accent-red);';
      else if (st.includes('prep')) badgeStyle = 'background:#1b5e20; color:#a5d6a7; border:1px solid var(--accent-green);';
      else if (st.includes('brunch')) badgeStyle = 'background:#2c1a4d; color:var(--accent-purple); border:1px solid var(--accent-purple);';

      html += `
        <div style="background:#252525; border:1px solid #333; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:bold; color:#fff; font-size:0.95rem;">👨‍🍳 ${escapeHTML(s.name)}</div>
            ${s.avail ? `<div style="font-size:0.75rem; color:var(--text-dim);">${escapeHTML(s.avail)}</div>` : ''}
          </div>
          <span style="${badgeStyle} padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">${escapeHTML(s.shift)}</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// MODULE 1: KITCHEN PREP BOARD & MANAGER LIST BUILDER
// -------------------------------------------------------------
function renderPrepBoard() {
  const loadingEl = document.getElementById('prep-loading');
  if (loadingEl) loadingEl.classList.add('hidden');

  const container = document.getElementById('prep-container') || document.getElementById('prep-board-container');
  if (!container) return;
  container.innerHTML = '';

  const items = (state.data && state.data.prepItems) ? state.data.prepItems : [];
  const groups = {};

  items.forEach(item => {
    const cat = item.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  const categories = Object.keys(groups).sort();
  renderCategoryPills('prep-cat-pills', categories, (selectedCat) => {
    state.activeCategory = selectedCat;
    renderPrepBoard();
  });

  const displayCats = (state.activeCategory === 'All') ? categories : [state.activeCategory];

  displayCats.forEach(cat => {
    if (!groups[cat]) return;

    const groupSection = document.createElement('div');
    groupSection.className = 'prep-group';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'prep-group-title';
    groupTitle.innerText = cat;
    groupSection.appendChild(groupTitle);

    const grid = document.createElement('div');
    grid.className = 'prep-grid';

    groups[cat].forEach(item => {
      const card = document.createElement('div');
      let statusClass = '';
      if (item.status === '86') statusClass = 'status-86 priority';
      else if (item.status === 'START') statusClass = 'status-start start';
      else if (item.status === 'CHECK') statusClass = 'status-check maybe';
      else if (item.status === 'BRUNCH') statusClass = 'status-brunch brunch';
      else if (item.status === 'CUSTOM') statusClass = 'status-custom custom';

      if (item.isDone) statusClass += ' is-done done';

      let badgeHtml = '';
      if (item.isDone) {
        badgeHtml = '<span class="status-badge">DONE</span>';
      } else if (item.status && item.status !== 'STANDARD') {
        badgeHtml = `<span class="status-badge">${escapeHTML(item.status)}</span>`;
      }

      card.className = `prep-card ${statusClass}`;
      card.innerHTML = `
        <div class="prep-card-inner">
          <span class="prep-item-name">${escapeHTML(item.name)}</span>
          ${badgeHtml}
        </div>
      `;

      card.addEventListener('click', () => handlePrepItemClick(item));
      grid.appendChild(card);
    });

    groupSection.appendChild(grid);
    container.appendChild(groupSection);
  });

  if (state.data && state.data.passdownNotes && state.data.passdownNotes.length > 0) {
    const inbox = document.getElementById('passdown-inbox');
    const list = document.getElementById('passdown-notes-list');
    if (inbox) inbox.classList.remove('hidden');
    if (list) list.innerHTML = state.data.passdownNotes.map(n => `<li>${escapeHTML(n)}</li>`).join('');
  } else {
    const inbox = document.getElementById('passdown-inbox');
    if (inbox) inbox.classList.add('hidden');
  }
}

function handlePrepItemClick(item) {
  if (item.status === 'CHECK' && !item.isDone) {
    item.status = 'STANDARD';
  } else if (!item.isDone) {
    item.isDone = true;
  } else {
    item.isDone = false;
  }
  saveMasterData();
  renderPrepBoard();
  pushLiveSync();
}

function toggleBuilderView(showBuilder) {
  const boardView = document.getElementById('board-view');
  const builderView = document.getElementById('builder-view');
  const prepActions = document.getElementById('prep-actions');

  if (showBuilder) {
    if (boardView) boardView.classList.add('hidden');
    if (builderView) builderView.classList.remove('hidden');
    
    // Reset selections to empty object so every item starts OFF by default
    state.builderSelections = {};
    renderListBuilder();
  } else {
    if (builderView) builderView.classList.add('hidden');
    if (boardView) boardView.classList.remove('hidden');
    if (prepActions) prepActions.classList.remove('hidden');
  }
}

function renderListBuilder() {
  const container = document.getElementById('builder-items-container') || document.getElementById('builder-list-container');
  if (!container) return;
  container.innerHTML = '';

  const inventory = (state.data && state.data.prepInventory && state.data.prepInventory.length > 0) 
    ? state.data.prepInventory 
    : (state.data && state.data.prepItems) ? state.data.prepItems : [];

  const groups = {};
  inventory.forEach(item => {
    const cat = item.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  Object.keys(groups).sort().forEach(cat => {
    const header = document.createElement('div');
    header.className = 'section-divider';
    header.style.textAlign = 'left';
    header.style.color = 'var(--accent-blue)';
    header.innerText = cat;
    container.appendChild(header);

    groups[cat].sort((a,b) => a.name.localeCompare(b.name)).forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row';

      let currentStatus = state.builderSelections[item.name] || 'OFF';

      const titleCol = document.createElement('div');
      titleCol.className = 'item-title-col';
      titleCol.innerHTML = `<div class="item-main-name">${escapeHTML(item.name)}</div>`;

      const btnGroup = document.createElement('div');
      btnGroup.className = 'btn-group';
      btnGroup.style.marginBottom = '0';

      const options = [
        { label: "86'D", status: '86', class: 'btn-danger' },
        { label: 'START', status: 'START', class: 'btn-warning' },
        { label: 'CHECK', status: 'CHECK', class: 'btn-warning' },
        { label: 'PREP', status: 'PREP', class: 'btn-success' },
        { label: 'OFF', status: 'OFF', class: 'btn-secondary' }
      ];

      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-status', opt.status);
        btn.className = `btn ${opt.class} btn-sm ${currentStatus === opt.status ? 'active' : ''}`;
        btn.innerText = opt.label;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          setBuilderStatus(item.name, opt.status, btnGroup);
        });
        btnGroup.appendChild(btn);
      });

      row.appendChild(titleCol);
      row.appendChild(btnGroup);
      container.appendChild(row);
    });
  });
}

function setBuilderStatus(itemName, status, rowGroupEl) {
  state.builderSelections[itemName] = status;
  if (rowGroupEl) {
    rowGroupEl.querySelectorAll('button').forEach(btn => {
      if (btn.getAttribute('data-status') === status) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  } else {
    renderListBuilder();
  }
}

function submitPrepListBuilder() {
  const newPrepItems = [];
  const inventory = (state.data && state.data.prepInventory && state.data.prepInventory.length > 0) 
    ? state.data.prepInventory 
    : (state.data && state.data.prepItems) ? state.data.prepItems : [];

  inventory.forEach(item => {
    const st = state.builderSelections[item.name] || 'OFF';
    if (st !== 'OFF') {
      newPrepItems.push({
        name: item.name,
        category: item.category || 'General',
        status: (st === 'PREP') ? 'STANDARD' : st,
        isDone: false
      });
    }
  });

  const customInputEl = document.getElementById('builder-custom-input');
  if (customInputEl && customInputEl.value.trim()) {
    const customLines = customInputEl.value.split(/[\n,]+/);
    customLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        newPrepItems.push({
          name: trimmed,
          category: 'Custom / On The Fly',
          status: 'CUSTOM',
          isDone: false
        });
      }
    });
    customInputEl.value = '';
  }

  state.data.prepItems = newPrepItems;
  saveMasterData();
  pushLiveSync();
  toggleBuilderView(false);
  renderPrepBoard();
  alert('SUCCESS! Kitchen prep board updated & published!');
}

function publishPrepList() {
  submitPrepListBuilder();
}

function clearCompletedPrep() {
  if (state.data && state.data.prepItems) {
    state.data.prepItems = state.data.prepItems.filter(i => !i.isDone);
    saveMasterData();
    renderPrepBoard();
    pushLiveSync();
  }
}

function clearBuilderSelections() {
  state.builderSelections = {};
  const customInputEl = document.getElementById('builder-custom-input');
  if (customInputEl) customInputEl.value = '';
  renderListBuilder();
}

function clearEntirePrepBoard() {
  if (confirm('Are you sure you want to clear all items from the active prep board?')) {
    if (state.data) state.data.prepItems = [];
    saveMasterData();
    pushLiveSync();
    renderPrepBoard();
  }
}

function promptAddCustomPrepItem() {
  openAddItemModal();
}

function openAddItemModal() {
  const modal = document.getElementById('modal-add-item');
  if (modal) {
    modal.style.display = 'block';
    const input = document.getElementById('new-item-input');
    if (input) input.value = '';
  }
}

function submitMidShiftItem() {
  const input = document.getElementById('new-item-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  if (!state.data.prepItems) state.data.prepItems = [];
  state.data.prepItems.push({
    name: val,
    category: 'Custom / On The Fly',
    status: 'CUSTOM',
    isDone: false
  });

  saveMasterData();
  pushLiveSync();
  closeModal('modal-add-item');
  input.value = '';
  renderPrepBoard();
}

function openNoteModal() {
  const modal = document.getElementById('modal-leave-note');
  if (modal) {
    modal.style.display = 'block';
    const input = document.getElementById('new-note-input') || document.getElementById('passdown-note-input');
    if (input) input.value = '';
  }
}

function openLeaveNoteModal() {
  openNoteModal();
}

function submitPassdownNote() {
  const input = document.getElementById('new-note-input') || document.getElementById('passdown-note-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  if (!state.data.passdownNotes) state.data.passdownNotes = [];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.data.passdownNotes.push(`[${time}] ${val}`);

  saveMasterData();
  pushLiveSync();
  closeModal('modal-leave-note');
  input.value = '';
  renderPrepBoard();
  alert('Passdown note saved!');
}

function savePassdownNote() {
  submitPassdownNote();
}

function clearPassdownNotes() {
  if (state.data) state.data.passdownNotes = [];
  saveMasterData();
  pushLiveSync();
  const inbox = document.getElementById('passdown-inbox');
  if (inbox) inbox.classList.add('hidden');
}

function manualRefreshData() {
  loadInitialData();
  alert('Prep Board & App Data refreshed!');
}

// -------------------------------------------------------------
// MODULE 2: INVENTORY & SUPPLIER MESSAGING ENGINE (WITH IN-APP EDITOR)
// -------------------------------------------------------------
function renderInventoryOrderSheet() {
  const container = document.getElementById('inventory-list-container');
  container.innerHTML = '';

  const items = state.data.inventory || [];
  const isChef = (state.currentUser?.role === 'head_chef' || state.currentUser?.pin === '217' || state.currentUser?.pin === '123');

  if (isChef) {
    const addBtnDiv = document.createElement('div');
    addBtnDiv.style.marginBottom = '20px';
    addBtnDiv.innerHTML = `
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn-success" style="flex:1; font-size:1.1rem; padding:12px;" onclick="openEditInventoryModal(-1)">+ Add Inventory Item</button>
        <button class="btn btn-warning" style="flex:1; font-size:1.1rem; padding:12px;" onclick="openBulkInventoryModal()">📋 Bulk Import Inventory</button>
      </div>
    `;
    container.appendChild(addBtnDiv);
  }

  const groups = {};
  items.forEach(i => {
    const cat = i.category || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(i);
  });

  let dropdownOpts = '<option value="0">-</option>';
  for (let q = 1; q <= 10; q++) dropdownOpts += `<option value="${q}">${q}</option>`;

  Object.keys(groups).sort().forEach(cat => {
    const catHeader = document.createElement('div');
    catHeader.className = 'section-divider';
    catHeader.style.textAlign = 'left';
    catHeader.style.color = 'var(--accent-blue)';
    catHeader.innerText = cat;
    container.appendChild(catHeader);

    groups[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      const masterIdx = items.indexOf(item);
      const parHtml = item.par ? `<span class="badge badge-par">Par: ${item.par} ${item.parSized || ''}</span>` : '';
      const orderSizeHtml = item.orderSize ? `<span style="font-size:0.85rem; color:#888;">| Order by: ${item.orderSize}</span>` : '';
      const notesHtml = item.notes ? `<div style="font-size:0.85rem; color:var(--accent-orange); margin-top:4px;">⚠️ ${escapeHTML(item.notes)}</div>` : '';

      const suppliersList = ['HILLCREST', 'HAZEROT', 'EURO', 'EUCLID FISH', 'MICHAELS MEATS', 'STONE OVEN', 'STONEY CREEK', 'CANTONESE'];
      let suppOpts = '';
      suppliersList.forEach(s => {
        const selected = (item.supplier.toUpperCase() === s) ? 'selected' : '';
        suppOpts += `<option value="${s}" ${selected}>${s}</option>`;
      });

      const card = document.createElement('div');
      card.className = 'item-row';
      card.innerHTML = `
        <div class="item-title-col">
          <div class="item-main-name">
            ${escapeHTML(item.name)} ${parHtml}
            ${isChef ? `<button class="btn btn-secondary btn-sm" style="margin-left:8px; padding:2px 6px;" onclick="openEditInventoryModal(${masterIdx})">✏️ Edit</button>` : ''}
          </div>
          <div style="margin-top:4px;">
            <label style="font-size:0.8rem; color:#888;">Purveyor:</label>
            <select class="supplier-inline-select" onchange="updateItemSupplier(${masterIdx}, this.value)" style="background:#2a2a2a; color:var(--accent-blue); border:1px solid #555; border-radius:4px; padding:3px 6px; font-weight:bold; font-size:0.85rem;">
              ${suppOpts}
            </select>
            ${orderSizeHtml}
          </div>
          ${notesHtml}
        </div>
        <select class="qty-select" id="qty-inv-${masterIdx}" data-name="${escapeHTML(item.name)}" data-supplier="${escapeHTML(item.supplier)}" data-size="${escapeHTML(item.orderSize || '')}">
          ${dropdownOpts}
        </select>
      `;
      container.appendChild(card);
    });
  });
}

function updateItemSupplier(masterIdx, newSupplier) {
  if (state.data.inventory && state.data.inventory[masterIdx]) {
    state.data.inventory[masterIdx].supplier = newSupplier;
    saveMasterData();
    renderInventoryOrderSheet();
  }
}

function openEditInventoryModal(idx) {
  const items = state.data.inventory || [];
  document.getElementById('inv-edit-index').value = idx;
  const deleteBtn = document.getElementById('btn-delete-inv-item');

  if (idx >= 0 && idx < items.length) {
    const item = items[idx];
    document.getElementById('inv-modal-header').innerText = 'Edit Inventory Item';
    document.getElementById('inv-edit-name').value = item.name || '';
    document.getElementById('inv-edit-category').value = item.category || 'General';
    document.getElementById('inv-edit-supplier').value = item.supplier || 'HILLCREST';
    document.getElementById('inv-edit-unit').value = item.orderSize || '';
    document.getElementById('inv-edit-par').value = item.par || '';
    document.getElementById('inv-edit-notes').value = item.notes || '';
    deleteBtn.style.display = 'block';
  } else {
    document.getElementById('inv-modal-header').innerText = 'Add New Inventory Item';
    document.getElementById('inv-edit-name').value = '';
    document.getElementById('inv-edit-category').value = 'General';
    document.getElementById('inv-edit-supplier').value = 'HILLCREST';
    document.getElementById('inv-edit-unit').value = '';
    document.getElementById('inv-edit-par').value = '';
    document.getElementById('inv-edit-notes').value = '';
    deleteBtn.style.display = 'none';
  }

  document.getElementById('modal-edit-inventory').style.display = 'block';
}

function saveInventoryItem() {
  const idx = parseInt(document.getElementById('inv-edit-index').value, 10);
  const name = document.getElementById('inv-edit-name').value.trim();
  if (!name) { alert('Please enter an item name'); return; }

  const itemData = {
    name: name,
    category: document.getElementById('inv-edit-category').value,
    supplier: document.getElementById('inv-edit-supplier').value,
    orderSize: document.getElementById('inv-edit-unit').value.trim(),
    par: document.getElementById('inv-edit-par').value.trim(),
    notes: document.getElementById('inv-edit-notes').value.trim(),
    count: '',
    parSized: ''
  };

  if (!state.data.inventory) state.data.inventory = [];

  if (idx >= 0 && idx < state.data.inventory.length) {
    state.data.inventory[idx] = Object.assign(state.data.inventory[idx], itemData);
  } else {
    state.data.inventory.push(itemData);
  }

  saveMasterData();
  closeModal('modal-edit-inventory');
  renderInventoryOrderSheet();
}

function deleteInventoryItem() {
  const idx = parseInt(document.getElementById('inv-edit-index').value, 10);
  if (idx >= 0 && idx < (state.data.inventory || []).length) {
    if (confirm('Are you sure you want to delete this inventory item?')) {
      state.data.inventory.splice(idx, 1);
      saveMasterData();
      closeModal('modal-edit-inventory');
      renderInventoryOrderSheet();
    }
  }
}

function generateSupplierOrders() {
  const submitterName = document.getElementById('cook-name-input').value.trim();
  const selectEls = document.querySelectorAll('.qty-select');
  const payload = [];

  selectEls.forEach(sel => {
    const qty = parseInt(sel.value);
    if (qty > 0) {
      payload.push({
        name: sel.getAttribute('data-name'),
        supplier: sel.getAttribute('data-supplier'),
        orderSize: sel.getAttribute('data-size'),
        qty: qty
      });
    }
  });

  if (payload.length === 0) {
    alert('Please select quantities for at least one inventory item before generating orders.');
    return;
  }

  const suppMap = {};
  payload.forEach(item => {
    const supp = item.supplier || 'HILLCREST';
    if (!suppMap[supp]) suppMap[supp] = [];
    suppMap[supp].push(item);
  });

  const container = document.getElementById('supplier-messages-container');
  container.innerHTML = '';

  const suppliersList = state.data.suppliers || [];

  Object.keys(suppMap).forEach(suppId => {
    const suppInfo = suppliersList.find(s => s.id === suppId) || { name: suppId, rep: '', phone: '', email: '' };
    const items = suppMap[suppId];

    let messageText = `ORDER FOR CANTINE:\n`;
    if (submitterName) messageText += `Submitted By: ${submitterName}\n`;
    messageText += `-------------------\n`;
    items.forEach(i => {
      messageText += `- ${i.qty} ${i.orderSize ? '(' + i.orderSize + ')' : ''} ${i.name}\n`;
    });
    messageText += `-------------------\nThank you!`;

    const smsUrl = suppInfo.phone ? `sms:${suppInfo.phone}?body=${encodeURIComponent(messageText)}` : '#';
    const mailUrl = suppInfo.email ? `mailto:${suppInfo.email}?subject=Cantine Order&body=${encodeURIComponent(messageText)}` : '#';

    const card = document.createElement('div');
    card.className = 'message-card';
    card.innerHTML = `
      <div style="font-size:1.4rem; font-weight:bold; color:var(--accent-gold); margin-bottom:6px;">${escapeHTML(suppInfo.name)}</div>
      <div style="font-size:1.1rem; color:var(--text-muted); margin-bottom:12px;">Rep: ${escapeHTML(suppInfo.rep)} | Ph: ${escapeHTML(suppInfo.phone)} ${suppInfo.email ? '| Email: ' + escapeHTML(suppInfo.email) : ''}</div>
      <textarea readonly class="search-input" style="width:100%; height:110px; font-family:monospace; font-size:1rem; margin-bottom:12px;">${escapeHTML(messageText)}</textarea>
      <div class="btn-group">
        ${suppInfo.phone ? `<a href="${smsUrl}" class="btn btn-success" style="text-decoration:none;">📱 Text Order (${escapeHTML(suppInfo.phone)})</a>` : ''}
        ${suppInfo.email ? `<a href="${mailUrl}" class="btn btn-primary" style="text-decoration:none;">📧 Email Order</a>` : ''}
        <button class="btn btn-secondary" onclick="navigator.clipboard.writeText(\`${escapeHTML(messageText).replace(/`/g, '\\`')}\`); alert('Copied to clipboard!');">📋 Copy</button>
      </div>
    `;
    container.appendChild(card);
  });

  const orderScreen = document.getElementById('order-screen');
  const readyScreen = document.getElementById('order-ready-screen');
  if (orderScreen) orderScreen.classList.add('hidden');
  if (readyScreen) readyScreen.classList.remove('hidden');
}

function resetOrderScreen() {
  const orderScreen = document.getElementById('order-screen');
  const readyScreen = document.getElementById('order-ready-screen');
  if (readyScreen) readyScreen.classList.add('hidden');
  if (orderScreen) orderScreen.classList.remove('hidden');

  const cookInput = document.getElementById('cook-name-input');
  if (cookInput) cookInput.value = '';

  const selectEls = document.querySelectorAll('.qty-select');
  selectEls.forEach(sel => sel.value = '0');
}

// -------------------------------------------------------------
// MODULE 3: RECIPE VAULT & SPECS (WITH IN-APP EDITOR & TAXONOMY)
// -------------------------------------------------------------
function renderRecipeVault() {
  const recipes = state.data.recipes || [];
  const isChef = (state.currentUser?.role === 'head_chef' || state.currentUser?.pin === '217' || state.currentUser?.pin === '123');

  // 1. Station Filter Pills
  const stations = ['All', 'Grill', 'Sauté', 'Pantry', 'Fry', 'Pastry', 'Prep'];
  renderCustomPills('station-pills-container', stations, state.activeStation, (selectedStation) => {
    state.activeStation = selectedStation;
    filterRecipeVault();
  });

  // 2. Workflow Type Filter Pills
  const workflows = ['All', 'Batch Prep', 'Plating Spec', 'Sub-recipe'];
  renderCustomPills('workflow-pills-container', workflows, state.activeWorkflow, (selectedWf) => {
    state.activeWorkflow = selectedWf;
    filterRecipeVault();
  });

  // 3. Category Filter Pills
  const categories = Array.from(new Set(recipes.map(r => r.category || 'General'))).sort();
  renderCategoryPills('category-pills-container', categories, (selectedCat) => {
    state.activeCategory = selectedCat;
    filterRecipeVault();
  });

  const topControls = document.getElementById('recipe-top-controls');
  if (topControls) {
    topControls.innerHTML = isChef ? `
      <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
        <button class="btn btn-success" style="font-size:1.1rem; padding:10px 16px;" onclick="openEditRecipeModal(-1)">+ Add Recipe</button>
        <button class="btn btn-warning" style="font-size:1.1rem; padding:10px 16px;" onclick="openBulkRecipeModal()">📋 Bulk Import Recipes</button>
      </div>
    ` : '';
  }

  filterRecipeVault();
}

function renderCustomPills(containerId, items, activeValue, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items.map(item => {
    const isActive = (item === activeValue) ? 'active' : '';
    return `<div class="filter-pill ${isActive}" onclick="this.parentNode.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active')); this.classList.add('active'); inlineCustomPillSelect('${containerId}', '${escapeHTML(item)}')">${escapeHTML(item)}</div>`;
  }).join('');

  window._pillCallbacks = window._pillCallbacks || {};
  window._pillCallbacks[containerId] = onSelect;
}

function inlineCustomPillSelect(containerId, item) {
  if (window._pillCallbacks && window._pillCallbacks[containerId]) {
    window._pillCallbacks[containerId](item);
  }
}

function toggleLegacyRecipes(show) {
  state.showLegacyRecipes = show;
  filterRecipeVault();
}

function filterRecipeVault() {
  const searchInput = document.getElementById('recipe-search');
  const term = searchInput ? searchInput.value.toLowerCase() : '';
  const recipes = state.data.recipes || [];
  const isChef = (state.currentUser?.role === 'head_chef' || state.currentUser?.pin === '217' || state.currentUser?.pin === '123');

  const filtered = recipes.filter(r => {
    const rName = (r.name || '').toLowerCase();
    const rIng = (r.ingredients || '').toLowerCase();
    const rNotes = (r.notes || '').toLowerCase();
    const rCat = (r.category || '').toLowerCase();
    const rSt = (r.station || '').toLowerCase();
    const rWf = (r.workflowType || '').toLowerCase();
    const rDiet = (r.dietary || '').toLowerCase();

    const matchSearch = !term || rName.includes(term) || rIng.includes(term) || rNotes.includes(term) || rCat.includes(term) || rSt.includes(term) || rWf.includes(term) || rDiet.includes(term);
    const matchCat = (state.activeCategory === 'All') || (r.category === state.activeCategory);
    const matchStation = (state.activeStation === 'All') || ((r.station || 'Prep').toLowerCase() === state.activeStation.toLowerCase());
    const matchWorkflow = (state.activeWorkflow === 'All') || ((r.workflowType || 'Batch Prep').toLowerCase() === state.activeWorkflow.toLowerCase());
    
    const isLegacy = (r.status || 'Active').toLowerCase() === 'legacy' || (r.status || 'Active').toLowerCase() === 'archived';
    const matchLegacy = state.showLegacyRecipes ? true : !isLegacy;

    return matchSearch && matchCat && matchStation && matchWorkflow && matchLegacy;
  });

  const grid = document.getElementById('recipe-grid-container');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="font-size:1.4rem; color:#888; text-align:center; padding:40px; grid-column: 1 / -1;">No matching recipes found for the selected filters.</div>';
    return;
  }

  grid.innerHTML = filtered.map(r => {
    const masterIdx = recipes.indexOf(r);
    const isLegacy = (r.status || 'Active').toLowerCase() === 'legacy' || (r.status || 'Active').toLowerCase() === 'archived';

    return `
      <div class="recipe-card" onclick="openRecipeReader('${escapeHTML(r.name)}')">
        ${r.photoUrl ? `<img src="${escapeHTML(r.photoUrl)}" class="recipe-card-header-img" alt="${escapeHTML(r.name)}" onerror="this.style.display='none'">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div class="recipe-name">${escapeHTML(r.name)}</div>
          ${isChef ? `<button class="btn btn-secondary btn-sm" style="padding:2px 6px;" onclick="event.stopPropagation(); openEditRecipeModal(${masterIdx})">✏️ Edit</button>` : ''}
        </div>
        
        <div class="taxonomy-tags-container">
          <span class="tag-badge tag-station">📍 ${escapeHTML(r.station || 'Prep')}</span>
          <span class="tag-badge tag-workflow">📋 ${escapeHTML(r.workflowType || 'Batch Prep')}</span>
          ${isLegacy ? '<span class="tag-badge tag-status-legacy">📦 Legacy</span>' : '<span class="tag-badge tag-status-active">✓ Active</span>'}
          ${r.dietary ? `<span class="tag-badge tag-dietary">🌱 ${escapeHTML(r.dietary)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openRecipeReader(recipeName) {
  const recipes = state.data.recipes || [];
  const recipe = recipes.find(r => r.name === recipeName);
  if (!recipe) return;

  document.getElementById('recipe-modal-title').innerText = recipe.name;
  
  const notesEl = document.getElementById('recipe-modal-notes');
  if (recipe.notes) {
    notesEl.classList.remove('hidden');
    notesEl.innerText = recipe.notes;
  } else {
    notesEl.classList.add('hidden');
  }

  document.getElementById('recipe-modal-ingredients').innerText = recipe.ingredients || 'No ingredients listed.';
  document.getElementById('recipe-modal-method').innerText = recipe.method || 'No instructions listed.';

  document.getElementById('modal-recipe-reader').style.display = 'block';
}

function openEditRecipeModal(idx) {
  const recipes = state.data.recipes || [];
  document.getElementById('recipe-edit-index').value = idx;
  const deleteBtn = document.getElementById('btn-delete-recipe-item');

  if (idx >= 0 && idx < recipes.length) {
    const r = recipes[idx];
    document.getElementById('recipe-edit-header').innerText = 'Edit Recipe Specs';
    document.getElementById('recipe-edit-name').value = r.name || '';
    document.getElementById('recipe-edit-category').value = r.category || 'General';
    document.getElementById('recipe-edit-notes').value = r.notes || '';
    document.getElementById('recipe-edit-ingredients').value = r.ingredients || '';
    document.getElementById('recipe-edit-method').value = r.method || '';
    deleteBtn.style.display = 'block';
  } else {
    document.getElementById('recipe-edit-header').innerText = 'Add New Recipe';
    document.getElementById('recipe-edit-name').value = '';
    document.getElementById('recipe-edit-category').value = 'General';
    document.getElementById('recipe-edit-notes').value = '';
    document.getElementById('recipe-edit-ingredients').value = '';
    document.getElementById('recipe-edit-method').value = '';
    deleteBtn.style.display = 'none';
  }

  document.getElementById('modal-edit-recipe').style.display = 'block';
}

function saveRecipeItem() {
  const idx = parseInt(document.getElementById('recipe-edit-index').value, 10);
  const name = document.getElementById('recipe-edit-name').value.trim();
  if (!name) { alert('Please enter a recipe name'); return; }

  const recipeData = {
    name: name,
    category: document.getElementById('recipe-edit-category').value.trim() || 'General',
    notes: document.getElementById('recipe-edit-notes').value.trim(),
    ingredients: document.getElementById('recipe-edit-ingredients').value,
    method: document.getElementById('recipe-edit-method').value
  };

  if (!state.data.recipes) state.data.recipes = [];

  if (idx >= 0 && idx < state.data.recipes.length) {
    state.data.recipes[idx] = Object.assign(state.data.recipes[idx], recipeData);
  } else {
    state.data.recipes.push(recipeData);
  }

  saveMasterData();
  closeModal('modal-edit-recipe');
  if (state.activeModule === 'recipe') renderRecipeVault();
}

function deleteRecipeItem() {
  const idx = parseInt(document.getElementById('recipe-edit-index').value, 10);
  if (idx >= 0 && idx < (state.data.recipes || []).length) {
    if (confirm('Are you sure you want to delete this recipe?')) {
      state.data.recipes.splice(idx, 1);
      saveMasterData();
      closeModal('modal-edit-recipe');
      if (state.activeModule === 'recipe') renderRecipeVault();
    }
  }
}

// -------------------------------------------------------------
// MODULE 4: SHIFT SCHEDULE & MULTI-WEEK ROTA
// -------------------------------------------------------------

function getMondayDateStr(inputDate) {
  let d;
  if (!inputDate) {
    d = new Date();
  } else if (typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    const parts = inputDate.split('-');
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    d = new Date(inputDate);
  }

  if (isNaN(d.getTime())) return getMondayDateStr(new Date());

  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), diff);

  const yyyy = mon.getFullYear();
  const mm = String(mon.getMonth() + 1).padStart(2, '0');
  const dd = String(mon.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekDates(mondayStr) {
  if (!mondayStr) mondayStr = getMondayDateStr();
  const parts = mondayStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  
  const days = ['MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT', 'SUN'];
  const res = {};
  days.forEach((dayKey, i) => {
    const dt = new Date(y, m - 1, d + i);
    res[dayKey] = `${dt.getMonth() + 1}/${dt.getDate()}`;
  });
  return res;
}

function getWeekRangeLabel(mondayStr) {
  if (!mondayStr) mondayStr = getMondayDateStr();
  const parts = mondayStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  
  const monObj = new Date(y, m - 1, d);
  const sunObj = new Date(y, m - 1, d + 6);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (monObj.getMonth() === sunObj.getMonth()) {
    return `${months[monObj.getMonth()]} ${monObj.getDate()} – ${sunObj.getDate()}, ${monObj.getFullYear()}`;
  }
  return `${months[monObj.getMonth()]} ${monObj.getDate()} – ${months[sunObj.getMonth()]} ${sunObj.getDate()}, ${monObj.getFullYear()}`;
}

function formatScheduleTimestamp(isoStr) {
  if (!isoStr) return 'Not available';
  try {
    const dt = new Date(isoStr);
    if (isNaN(dt.getTime())) return isoStr;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[dt.getDay()];
    const monthName = months[dt.getMonth()];
    const dayNum = dt.getDate();
    let hours = dt.getHours();
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${dayName}, ${monthName} ${dayNum} at ${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return isoStr;
  }
}

function ensureSchedulesStructure() {
  if (!state.data) return;
  if (!state.data.schedules || typeof state.data.schedules !== 'object' || Array.isArray(state.data.schedules)) {
    state.data.schedules = {};
  }

  const currentMonKey = getMondayDateStr();
  const existingKeys = Object.keys(state.data.schedules);

  if (existingKeys.length === 0) {
    const initialRows = Array.isArray(state.data.schedule) ? state.data.schedule : [];
    state.data.schedules[currentMonKey] = {
      weekOf: currentMonKey,
      updatedAt: state.data.scheduleUpdatedAt || new Date().toISOString(),
      updatedBy: state.data.scheduleUpdatedBy || 'Chef',
      rows: JSON.parse(JSON.stringify(initialRows))
    };
  }

  if (!state.selectedScheduleWeek || !state.data.schedules[state.selectedScheduleWeek]) {
    if (state.data.schedules[currentMonKey]) {
      state.selectedScheduleWeek = currentMonKey;
    } else {
      const sortedKeys = Object.keys(state.data.schedules).sort();
      state.selectedScheduleWeek = sortedKeys[sortedKeys.length - 1] || currentMonKey;
    }
  }

  syncActiveWeekToSchedule();
}

function syncActiveWeekToSchedule() {
  if (!state.data || !state.data.schedules) return;
  const activeObj = state.data.schedules[state.selectedScheduleWeek];
  if (activeObj && Array.isArray(activeObj.rows)) {
    state.data.schedule = JSON.parse(JSON.stringify(activeObj.rows));
    state.data.scheduleUpdatedAt = activeObj.updatedAt;
    state.data.scheduleUpdatedBy = activeObj.updatedBy;
  }
}

function switchScheduleWeek(weekKey) {
  if (!state.data) return;
  ensureSchedulesStructure();

  if (weekKey === 'new_custom') {
    promptCreateFutureWeek();
    return;
  }

  if (!state.data.schedules[weekKey]) {
    const baseWeekKey = state.selectedScheduleWeek || getMondayDateStr();
    const baseRows = state.data.schedules[baseWeekKey]?.rows || state.data.schedule || [];
    const clonedRows = baseRows.map(r => ({
      name: r.name,
      availability: r.availability || '',
      shifts: { MON: 'x', TUE: 'x', WED: 'x', THUR: 'x', FRI: 'x', SAT: 'x', SUN: 'x' }
    }));

    state.data.schedules[weekKey] = {
      weekOf: weekKey,
      updatedAt: new Date().toISOString(),
      updatedBy: state.currentUser?.name || 'Chef',
      rows: clonedRows
    };
    saveMasterData();
    pushLiveSync();
  }

  state.selectedScheduleWeek = weekKey;
  syncActiveWeekToSchedule();
  renderScheduleMatrix();
}

function stepScheduleWeek(offsetWeeks) {
  if (!state.selectedScheduleWeek) ensureSchedulesStructure();
  const parts = (state.selectedScheduleWeek || getMondayDateStr()).split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const dt = new Date(y, m - 1, d + (offsetWeeks * 7));
  const newWeekKey = getMondayDateStr(dt);
  switchScheduleWeek(newWeekKey);
}

function promptCreateFutureWeek() {
  const currentMon = getMondayDateStr();
  const parts = currentMon.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  const weekOptions = [1, 2, 3, 4].map(w => {
    const dt = new Date(y, m - 1, d + (w * 7));
    const key = getMondayDateStr(dt);
    const label = getWeekRangeLabel(key);
    return { key, label, num: w };
  });

  let msg = "Select or enter a Monday date for the new future schedule (YYYY-MM-DD):\n\n";
  weekOptions.forEach(o => {
    msg += `${o.num}) ${o.key} (${o.label})\n`;
  });

  const choice = prompt(msg, weekOptions[0].key);
  if (!choice) return;

  let targetKey = choice.trim();
  if (/^[1-4]$/.test(targetKey)) {
    targetKey = weekOptions[parseInt(targetKey) - 1].key;
  }

  targetKey = getMondayDateStr(targetKey);
  switchScheduleWeek(targetKey);
}

function renderScheduleMatrix() {
  const container = document.getElementById('schedule-matrix-container');
  if (!container) return;

  ensureSchedulesStructure();

  const isChef = (state.currentUser?.role === 'head_chef' || state.currentUser?.pin === '217' || state.currentUser?.pin === '123');
  const activeWeekKey = state.selectedScheduleWeek;
  const activeWeekObj = state.data.schedules[activeWeekKey] || { rows: [], updatedAt: '', updatedBy: '' };
  const rawSchedule = activeWeekObj.rows || [];

  // Filter out any legacy legend rows
  const schedule = rawSchedule.filter(row => {
    const name = (row.name || '').toLowerCase();
    return name && !name.includes('legend') && !name.includes('prep =') && !name.includes('cl =');
  });

  const dates = getWeekDates(activeWeekKey);
  const currentMonKey = getMondayDateStr();

  // Gather available week options for dropdown
  const weekKeysSet = new Set(Object.keys(state.data.schedules));
  weekKeysSet.add(currentMonKey);
  // Add upcoming 4 weeks options
  const parts = currentMonKey.split('-');
  const cy = parseInt(parts[0], 10);
  const cm = parseInt(parts[1], 10);
  const cd = parseInt(parts[2], 10);
  for (let w = 1; w <= 4; w++) {
    const dt = new Date(cy, cm - 1, cd + (w * 7));
    weekKeysSet.add(getMondayDateStr(dt));
  }
  const sortedWeekKeys = Array.from(weekKeysSet).sort();

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:12px; background:var(--card-bg); padding:16px; border-radius:12px; border:1px solid var(--border-color);">
      <div>
        <h2 style="margin:0; color:var(--accent-gold); font-size:1.4rem;">Weekly Shift Schedule</h2>
        <div style="font-size:0.9rem; color:var(--text-muted); margin-top:3px;">Week of ${getWeekRangeLabel(activeWeekKey)}</div>
      </div>

      <!-- Week Selector Navigation -->
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-secondary" style="padding:6px 12px; font-weight:bold;" onclick="stepScheduleWeek(-1)" title="Previous Week">◀ Prev Week</button>
        
        <select onchange="switchScheduleWeek(this.value)" class="search-input" style="padding:7px 12px; font-weight:bold; font-size:0.95rem; border-color:var(--accent-gold); background:#222; color:#fff; cursor:pointer;">
          ${sortedWeekKeys.map(k => {
            const label = getWeekRangeLabel(k);
            const isCurrent = k === currentMonKey ? ' (Current)' : '';
            const exists = state.data.schedules[k] ? '' : ' ➕ Create';
            return `<option value="${k}" ${k === activeWeekKey ? 'selected' : ''}>${label}${isCurrent}${exists}</option>`;
          }).join('')}
          <option value="new_custom">➕ Custom Future Date...</option>
        </select>

        <button class="btn btn-secondary" style="padding:6px 12px; font-weight:bold;" onclick="stepScheduleWeek(1)" title="Next Week">Next Week ▶</button>
      </div>

      <!-- Action Buttons -->
      ${isChef ? `
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${state.isScheduleEditMode ? `
            <button class="btn btn-success" onclick="saveScheduleEdits()">💾 Save Schedule</button>
            <button class="btn btn-primary" onclick="addScheduleRow()">+ Add Staff Row</button>
            <button class="btn btn-secondary" onclick="toggleScheduleEditMode(false)">Cancel</button>
          ` : `
            <button class="btn btn-warning" onclick="toggleScheduleEditMode(true)">✏️ Edit Schedule</button>
            <button class="btn btn-primary" onclick="promptCreateFutureWeek()">+ Add Future Week</button>
          `}
        </div>
      ` : ''}
    </div>

    <!-- Updated On Banner for Line Cooks -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; background:rgba(212, 175, 55, 0.08); border:1px solid rgba(212, 175, 55, 0.25); border-radius:8px; padding:10px 16px; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; align-items:center; gap:8px; color:var(--text-main); font-size:0.95rem;">
        <span style="font-size:1.1rem;">🕒</span>
        <span><strong>Schedule Updated:</strong> <span style="color:var(--accent-gold); font-weight:bold;">${formatScheduleTimestamp(activeWeekObj.updatedAt)}</span> ${activeWeekObj.updatedBy ? `<span style="color:var(--text-muted); font-size:0.85rem;">(by ${escapeHTML(activeWeekObj.updatedBy)})</span>` : ''}</span>
      </div>
      ${activeWeekKey === currentMonKey ? `
        <span style="background:var(--accent-green); color:#000; font-weight:bold; font-size:0.75rem; padding:3px 8px; border-radius:12px; text-transform:uppercase;">Live Active Schedule</span>
      ` : `
        <span style="background:var(--accent-purple); color:#fff; font-weight:bold; font-size:0.75rem; padding:3px 8px; border-radius:12px; text-transform:uppercase;">Future / Custom Week</span>
      `}
    </div>
  `;

  if (state.isScheduleEditMode) {
    html += `
      <div style="background:#262626; padding:12px 16px; border-radius:8px; margin-bottom:15px; border:1px solid #444; display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
        <label style="font-weight:bold; color:var(--accent-gold);">Week Starting Date (Monday):</label>
        <input type="date" id="sched-week-date" value="${activeWeekKey}" class="search-input" style="width:160px; font-weight:bold; padding:6px 10px;">
        <span style="font-size:0.85rem; color:#888;">Changing this date will relocate this schedule week.</span>
      </div>
    `;
  }

  if (schedule.length === 0) {
    html += `
      <div style="font-size:1.2rem; color:#888; text-align:center; padding:40px; background:var(--card-bg); border-radius:12px; border:1px dashed #444;">
        <div>No schedule entries created for <strong>${getWeekRangeLabel(activeWeekKey)}</strong> yet.</div>
        ${isChef ? `
          <div style="margin-top:15px; display:flex; gap:12px; justify-content:center;">
            <button class="btn btn-warning" onclick="toggleScheduleEditMode(true)">✏️ Edit & Create Schedule</button>
          </div>
        ` : ''}
      </div>
    `;
    container.innerHTML = html;
    return;
  }

  function formatShift(shiftVal) {
    if (shiftVal === undefined || shiftVal === null) return '<span style="background:#262626; color:#777; padding:4px 8px; border-radius:4px; font-weight:bold;">OFF</span>';
    const shiftText = String(shiftVal).trim();
    if (!shiftText || shiftText.toLowerCase() === 'x') {
      return '<span style="background:#262626; color:#777; padding:4px 8px; border-radius:4px; font-weight:bold;">OFF</span>';
    }
    const st = shiftText.toLowerCase();
    if (st.includes('cl')) {
      return `<span style="background:#451212; color:var(--accent-red); border:1px solid var(--accent-red); padding:4px 8px; border-radius:4px; font-weight:bold;">${escapeHTML(shiftText)}</span>`;
    }
    if (st.includes('prep')) {
      return `<span style="background:#1b5e20; color:#a5d6a7; border:1px solid var(--accent-green); padding:4px 8px; border-radius:4px; font-weight:bold;">${escapeHTML(shiftText)}</span>`;
    }
    if (st.includes('brunch')) {
      return `<span style="background:#2c1a4d; color:var(--accent-purple); border:1px solid var(--accent-purple); padding:4px 8px; border-radius:4px; font-weight:bold;">${escapeHTML(shiftText)}</span>`;
    }
    if (st.includes('first')) {
      return `<span style="background:#01304a; color:var(--accent-blue); border:1px solid var(--accent-blue); padding:4px 8px; border-radius:4px; font-weight:bold;">${escapeHTML(shiftText)}</span>`;
    }
    if (st.includes('r/o') || st.includes('vacation')) {
      return `<span style="background:#4a2c00; color:var(--accent-orange); border:1px solid var(--accent-orange); padding:4px 8px; border-radius:4px; font-weight:bold;">${escapeHTML(shiftText)}</span>`;
    }
    return `<span style="background:#332b00; color:var(--accent-gold); border:1px solid #555; padding:4px 8px; border-radius:4px; font-weight:bold;">${escapeHTML(shiftText)}</span>`;
  }

  html += `
    <table style="width:100%; border-collapse:collapse; background:var(--card-bg); border-radius:12px; overflow:hidden; border:1px solid var(--border-color);">
      <thead>
        <tr style="background:#262626; color:var(--accent-blue); font-size:1.05rem; text-transform:uppercase;">
          <th style="padding:14px 16px; text-align:left; border-bottom:2px solid #444; width:180px;">Staff Member</th>
          <th style="padding:12px 8px; text-align:center; border-bottom:2px solid #444; min-width:85px;">
            <div style="font-size:1rem; font-weight:bold; color:var(--accent-blue);">MON</div>
            <div style="font-size:0.85rem; color:#aaa; font-weight:normal; margin-top:2px;">${dates.MON}</div>
          </th>
          <th style="padding:12px 8px; text-align:center; border-bottom:2px solid #444; min-width:85px;">
            <div style="font-size:1rem; font-weight:bold; color:var(--accent-blue);">TUE</div>
            <div style="font-size:0.85rem; color:#aaa; font-weight:normal; margin-top:2px;">${dates.TUE}</div>
          </th>
          <th style="padding:12px 8px; text-align:center; border-bottom:2px solid #444; min-width:85px;">
            <div style="font-size:1rem; font-weight:bold; color:var(--accent-blue);">WED</div>
            <div style="font-size:0.85rem; color:#aaa; font-weight:normal; margin-top:2px;">${dates.WED}</div>
          </th>
          <th style="padding:12px 8px; text-align:center; border-bottom:2px solid #444; min-width:85px;">
            <div style="font-size:1rem; font-weight:bold; color:var(--accent-blue);">THUR</div>
            <div style="font-size:0.85rem; color:#aaa; font-weight:normal; margin-top:2px;">${dates.THUR}</div>
          </th>
          <th style="padding:12px 8px; text-align:center; border-bottom:2px solid #444; min-width:85px;">
            <div style="font-size:1rem; font-weight:bold; color:var(--accent-blue);">FRI</div>
            <div style="font-size:0.85rem; color:#aaa; font-weight:normal; margin-top:2px;">${dates.FRI}</div>
          </th>
          <th style="padding:12px 8px; text-align:center; border-bottom:2px solid #444; min-width:85px;">
            <div style="font-size:1rem; font-weight:bold; color:var(--accent-blue);">SAT</div>
            <div style="font-size:0.85rem; color:#aaa; font-weight:normal; margin-top:2px;">${dates.SAT}</div>
          </th>
          <th style="padding:12px 8px; text-align:center; border-bottom:2px solid #444; min-width:85px;">
            <div style="font-size:1rem; font-weight:bold; color:var(--accent-blue);">SUN</div>
            <div style="font-size:0.85rem; color:#aaa; font-weight:normal; margin-top:2px;">${dates.SUN}</div>
          </th>
          ${state.isScheduleEditMode ? '<th style="padding:12px; text-align:center; border-bottom:2px solid #444;">Action</th>' : ''}
        </tr>
      </thead>
      <tbody>
  `;

  schedule.forEach((row, idx) => {
    const s = row.shifts || {};

    if (state.isScheduleEditMode) {
      html += `
        <tr style="border-bottom:1px solid #333;">
          <td style="padding:8px;">
            <input type="text" id="sched-name-${idx}" value="${escapeHTML(row.name)}" class="search-input" style="width:100%; font-weight:bold; font-size:1.05rem; padding:6px;">
            <input type="text" id="sched-avail-${idx}" value="${escapeHTML(row.availability || '')}" class="search-input" style="width:100%; font-size:0.85rem; padding:4px; margin-top:4px;" placeholder="e.g. 5 days">
          </td>
          <td style="padding:6px; text-align:center;"><input type="text" id="sched-mon-${idx}" value="${escapeHTML(s.MON || '')}" class="search-input" style="width:90px; text-align:center; font-weight:bold; font-size:1rem; padding:8px 4px;"></td>
          <td style="padding:6px; text-align:center;"><input type="text" id="sched-tue-${idx}" value="${escapeHTML(s.TUE || '')}" class="search-input" style="width:90px; text-align:center; font-weight:bold; font-size:1rem; padding:8px 4px;"></td>
          <td style="padding:6px; text-align:center;"><input type="text" id="sched-wed-${idx}" value="${escapeHTML(s.WED || '')}" class="search-input" style="width:90px; text-align:center; font-weight:bold; font-size:1rem; padding:8px 4px;"></td>
          <td style="padding:6px; text-align:center;"><input type="text" id="sched-thu-${idx}" value="${escapeHTML(s.THUR || '')}" class="search-input" style="width:90px; text-align:center; font-weight:bold; font-size:1rem; padding:8px 4px;"></td>
          <td style="padding:6px; text-align:center;"><input type="text" id="sched-fri-${idx}" value="${escapeHTML(s.FRI || '')}" class="search-input" style="width:90px; text-align:center; font-weight:bold; font-size:1rem; padding:8px 4px;"></td>
          <td style="padding:6px; text-align:center;"><input type="text" id="sched-sat-${idx}" value="${escapeHTML(s.SAT || '')}" class="search-input" style="width:90px; text-align:center; font-weight:bold; font-size:1rem; padding:8px 4px;"></td>
          <td style="padding:6px; text-align:center;"><input type="text" id="sched-sun-${idx}" value="${escapeHTML(s.SUN || '')}" class="search-input" style="width:90px; text-align:center; font-weight:bold; font-size:1rem; padding:8px 4px;"></td>
          <td style="padding:8px; text-align:center;"><button class="btn btn-danger" style="padding:4px 8px;" onclick="deleteScheduleRow(${idx})">🗑️</button></td>
        </tr>
      `;
    } else {
      html += `
        <tr style="border-bottom:1px solid #333; font-size:1.05rem;">
          <td style="padding:14px; font-weight:bold; color:var(--accent-gold);">
            ${escapeHTML(row.name)}
            <div style="font-size:0.8rem; color:#888; font-weight:normal;">${escapeHTML(row.availability || '')}</div>
          </td>
          <td style="padding:14px; text-align:center;">${formatShift(s.MON)}</td>
          <td style="padding:14px; text-align:center;">${formatShift(s.TUE)}</td>
          <td style="padding:14px; text-align:center;">${formatShift(s.WED)}</td>
          <td style="padding:14px; text-align:center;">${formatShift(s.THUR)}</td>
          <td style="padding:14px; text-align:center;">${formatShift(s.FRI)}</td>
          <td style="padding:14px; text-align:center;">${formatShift(s.SAT)}</td>
          <td style="padding:14px; text-align:center;">${formatShift(s.SUN)}</td>
        </tr>
      `;
    }
  });

  html += `
      </tbody>
    </table>

    <div class="message-card" style="margin-top:25px;">
      <h3 style="margin-top:0; color:var(--accent-gold);">💡 Shift Legend & Hours Guide</h3>
      <div style="font-size:1.1rem; line-height:1.8; color:var(--text-muted);">
        <strong style="color:var(--accent-green);">PREP:</strong> 9:00 AM – 3:00 PMish &nbsp;|&nbsp;
        <strong style="color:var(--accent-red);">CL (Closing):</strong> 10:00 PM (Weekdays) / 11:00 PM (Weekends) &nbsp;|&nbsp;
        <strong style="color:var(--accent-purple);">BRUNCH:</strong> 9:00 AM – 3:00 PM &nbsp;|&nbsp;
        <strong style="color:var(--accent-blue);">FIRST OUT:</strong> 8:00 PM (Weekdays) / 9:00 PM (Weekends if slow) &nbsp;|&nbsp;
        <strong style="color:#777;">X:</strong> Off
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function toggleScheduleEditMode(enable) {
  state.isScheduleEditMode = enable;
  renderScheduleMatrix();
}

function addScheduleRow() {
  ensureSchedulesStructure();
  const activeWeekKey = state.selectedScheduleWeek;
  if (!state.data.schedules[activeWeekKey]) {
    state.data.schedules[activeWeekKey] = { weekOf: activeWeekKey, updatedAt: new Date().toISOString(), updatedBy: state.currentUser?.name || 'Chef', rows: [] };
  }
  state.data.schedules[activeWeekKey].rows.push({
    name: 'New Staff',
    availability: '5 days',
    shifts: { MON: 'x', TUE: 'x', WED: 'x', THUR: 'x', FRI: 'x', SAT: 'x', SUN: 'x' }
  });
  syncActiveWeekToSchedule();
  saveMasterData();
  renderScheduleMatrix();
  pushLiveSync();
}

function deleteScheduleRow(idx) {
  if (confirm('Are you sure you want to remove this staff row from the schedule?')) {
    ensureSchedulesStructure();
    const activeWeekKey = state.selectedScheduleWeek;
    if (state.data.schedules[activeWeekKey]?.rows) {
      state.data.schedules[activeWeekKey].rows.splice(idx, 1);
    }
    syncActiveWeekToSchedule();
    saveMasterData();
    renderScheduleMatrix();
    pushLiveSync();
  }
}

function saveScheduleEdits() {
  ensureSchedulesStructure();
  let activeWeekKey = state.selectedScheduleWeek;
  
  // Check if week start date input was modified
  const weekDateInput = document.getElementById('sched-week-date');
  if (weekDateInput && weekDateInput.value) {
    const newWeekKey = getMondayDateStr(weekDateInput.value);
    if (newWeekKey !== activeWeekKey) {
      // Move schedule object to new key
      if (state.data.schedules[activeWeekKey]) {
        state.data.schedules[newWeekKey] = state.data.schedules[activeWeekKey];
        state.data.schedules[newWeekKey].weekOf = newWeekKey;
        delete state.data.schedules[activeWeekKey];
      }
      activeWeekKey = newWeekKey;
      state.selectedScheduleWeek = newWeekKey;
    }
  }

  if (!state.data.schedules[activeWeekKey]) {
    state.data.schedules[activeWeekKey] = { weekOf: activeWeekKey, rows: [] };
  }

  const targetRows = state.data.schedules[activeWeekKey].rows || [];
  targetRows.forEach((row, idx) => {
    const nameEl = document.getElementById(`sched-name-${idx}`);
    if (nameEl) row.name = nameEl.value.trim();

    const availEl = document.getElementById(`sched-avail-${idx}`);
    if (availEl) row.availability = availEl.value.trim();

    row.shifts = {
      MON: document.getElementById(`sched-mon-${idx}`)?.value.trim() || 'x',
      TUE: document.getElementById(`sched-tue-${idx}`)?.value.trim() || 'x',
      WED: document.getElementById(`sched-wed-${idx}`)?.value.trim() || 'x',
      THUR: document.getElementById(`sched-thu-${idx}`)?.value.trim() || 'x',
      FRI: document.getElementById(`sched-fri-${idx}`)?.value.trim() || 'x',
      SAT: document.getElementById(`sched-sat-${idx}`)?.value.trim() || 'x',
      SUN: document.getElementById(`sched-sun-${idx}`)?.value.trim() || 'x'
    };
  });

  state.data.schedules[activeWeekKey].rows = targetRows;
  state.data.schedules[activeWeekKey].updatedAt = new Date().toISOString();
  state.data.schedules[activeWeekKey].updatedBy = state.currentUser?.name || 'Chef';

  syncActiveWeekToSchedule();
  saveMasterData();
  state.isScheduleEditMode = false;
  renderScheduleMatrix();
  pushLiveSync();
}

// -------------------------------------------------------------
// HELP MODAL, BACKUP & UTILITIES
// -------------------------------------------------------------
function showHelpModal() {
  document.getElementById('modal-help').style.display = 'block';
  toggleNav(false);
  updateSyncStatusUI();
}

function showGuideTab(tab) {
  document.getElementById('guide-prep-content').classList.add('hidden');
  document.getElementById('guide-order-content').classList.add('hidden');
  document.getElementById('guide-recipe-content').classList.add('hidden');

  if (tab === 'prep') document.getElementById('guide-prep-content').classList.remove('hidden');
  else if (tab === 'order') document.getElementById('guide-order-content').classList.remove('hidden');
  else if (tab === 'recipe') document.getElementById('guide-recipe-content').classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function exportDataBackup() {
  if (!state.data) return;
  const jsonStr = JSON.stringify(state.data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cantine_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importDataBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      if (imported && (imported.inventory || imported.recipes)) {
        state.data = imported;
        saveMasterData();
        renderCurrentModule();
        alert('SUCCESS! Database backup successfully restored!');
        closeModal('modal-help');
      } else {
        alert('Invalid backup file format.');
      }
    } catch (err) {
      alert('Error parsing backup file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function renderCategoryPills(containerId, categories, onSelectCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  const allPill = document.createElement('div');
  allPill.className = `cat-pill ${(state.activeCategory === 'All') ? 'active' : ''}`;
  allPill.innerText = 'All';
  allPill.addEventListener('click', () => onSelectCallback('All'));
  container.appendChild(allPill);

  categories.forEach(cat => {
    const pill = document.createElement('div');
    pill.className = `cat-pill ${(state.activeCategory === cat) ? 'active' : ''}`;
    pill.innerText = cat;
    pill.addEventListener('click', () => onSelectCallback(cat));
    container.appendChild(pill);
  });
}

function pollLiveUpdates() {
  // Local storage tab-to-tab sync for Prep Board
  const localPrep = localStorage.getItem('cantine_live_prep');
  if (localPrep && state.data) {
    try {
      const parsed = JSON.parse(localPrep);
      if (Array.isArray(parsed) && JSON.stringify(parsed) !== JSON.stringify(state.data.prepItems)) {
        state.data.prepItems = parsed;
        if (state.activeModule === 'prep') renderPrepBoard();
      }
    } catch (e) {}
  }

  // Local storage tab-to-tab sync for Shift Schedule
  const localSched = localStorage.getItem('cantine_live_schedule');
  if (localSched && state.data) {
    try {
      const parsed = JSON.parse(localSched);
      if (Array.isArray(parsed) && JSON.stringify(parsed) !== JSON.stringify(state.data.schedule)) {
        state.data.schedule = parsed;
        if (state.activeModule === 'schedule') renderScheduleMatrix();
      }
    } catch (e) {}
  }

  // Local storage tab-to-tab sync for Multi-Week Schedules
  const localSchedules = localStorage.getItem('cantine_live_schedules');
  if (localSchedules && state.data) {
    try {
      const parsed = JSON.parse(localSchedules);
      if (typeof parsed === 'object' && JSON.stringify(parsed) !== JSON.stringify(state.data.schedules)) {
        state.data.schedules = parsed;
        syncActiveWeekToSchedule();
        if (state.activeModule === 'schedule') renderScheduleMatrix();
      }
    } catch (e) {}
  }

  // Local storage tab-to-tab sync for Cleaning Tracker
  const localClean = localStorage.getItem('cantine_live_cleaning');
  if (localClean && state.data) {
    try {
      const parsed = JSON.parse(localClean);
      if (JSON.stringify(parsed) !== JSON.stringify(state.data.cleaning)) {
        state.data.cleaning = parsed;
        if (state.activeModule === 'cleaning') renderCleaningTracker();
      }
    } catch (e) {}
  }

  // Cloud Sync fallback (only if Firebase is NOT active and backendUrl is set)
  if (!firebaseInitialized && state.backendUrl && state.backendUrl.trim()) {
    fetchCloudLivePrep();
  }
}

let cloudSyncInFlight = false;
let cloudSyncCooldownUntil = 0;

function fetchCloudLivePrep() {
  if (!state.backendUrl || !state.backendUrl.trim()) return;
  if (cloudSyncInFlight) return;
  if (Date.now() < cloudSyncCooldownUntil) return;

  cloudSyncInFlight = true;
  const callbackName = 'cantine_jsonp_' + Date.now();

  const cleanup = () => {
    cloudSyncInFlight = false;
    delete window[callbackName];
    const scriptEl = document.getElementById(callbackName);
    if (scriptEl) scriptEl.remove();
  };

  window[callbackName] = function(response) {
    try {
      if (response) {
        let hasChanges = false;
        if (response.prepItems && Array.isArray(response.prepItems)) {
          const cloudPrepStr = JSON.stringify(response.prepItems);
          const currentPrepStr = JSON.stringify(state.data ? state.data.prepItems : []);
          if (cloudPrepStr !== currentPrepStr) {
            state.data.prepItems = response.prepItems;
            localStorage.setItem('cantine_live_prep', cloudPrepStr);
            hasChanges = true;
            if (state.activeModule === 'prep') renderPrepBoard();
          }
        }
        if (response.passdownNotes && Array.isArray(response.passdownNotes)) {
          const cloudNotesStr = JSON.stringify(response.passdownNotes);
          const currentNotesStr = JSON.stringify(state.data ? state.data.passdownNotes : []);
          if (cloudNotesStr !== currentNotesStr) {
            state.data.passdownNotes = response.passdownNotes;
            hasChanges = true;
            if (state.activeModule === 'prep') renderPrepBoard();
          }
        }
        if (response.schedules && typeof response.schedules === 'object') {
          const cloudSchedulesStr = JSON.stringify(response.schedules);
          const currentSchedulesStr = JSON.stringify(state.data ? state.data.schedules : {});
          if (cloudSchedulesStr !== currentSchedulesStr) {
            state.data.schedules = response.schedules;
            localStorage.setItem('cantine_live_schedules', cloudSchedulesStr);
            syncActiveWeekToSchedule();
            hasChanges = true;
            if (state.activeModule === 'schedule') renderScheduleMatrix();
          }
        }
        if (response.schedule && Array.isArray(response.schedule)) {
          const cloudSchedStr = JSON.stringify(response.schedule);
          const currentSchedStr = JSON.stringify(state.data ? state.data.schedule : []);
          if (cloudSchedStr !== currentSchedStr) {
            state.data.schedule = response.schedule;
            localStorage.setItem('cantine_live_schedule', cloudSchedStr);
            hasChanges = true;
            if (state.activeModule === 'schedule') renderScheduleMatrix();
          }
        }
        if (response.cleaning && typeof response.cleaning === 'object') {
          const cloudCleanStr = JSON.stringify(response.cleaning);
          const currentCleanStr = JSON.stringify(state.data ? state.data.cleaning : {});
          if (cloudCleanStr !== currentCleanStr) {
            state.data.cleaning = response.cleaning;
            localStorage.setItem('cantine_live_cleaning', cloudCleanStr);
            hasChanges = true;
            if (state.activeModule === 'cleaning') renderCleaningTracker();
          }
        }
        if (hasChanges) {
          saveMasterData();
        }
      }
    } catch (err) {}
    cleanup();
  };

  const script = document.createElement('script');
  script.id = callbackName;
  const sep = state.backendUrl.includes('?') ? '&' : '?';
  script.src = `${state.backendUrl}${sep}action=getLivePrep&callback=${callbackName}&_t=${Date.now()}`;
  script.onerror = function() {
    // On rate limit or network error, set a 60-second cooldown
    cloudSyncCooldownUntil = Date.now() + 60000;
    cleanup();
  };
  document.body.appendChild(script);
}

function pushLiveSync() {
  if (state.data) {
    if (state.data.prepItems) {
      localStorage.setItem('cantine_live_prep', JSON.stringify(state.data.prepItems));
    }
    if (state.data.schedule) {
      localStorage.setItem('cantine_live_schedule', JSON.stringify(state.data.schedule));
    }
    if (state.data.schedules) {
      localStorage.setItem('cantine_live_schedules', JSON.stringify(state.data.schedules));
    }
    if (state.data.cleaning) {
      localStorage.setItem('cantine_live_cleaning', JSON.stringify(state.data.cleaning));
    }
  }

  // Push instantly to Firebase Realtime Database
  if (firebaseInitialized && firebaseDb && state.data) {
    try {
      if (state.data.prepItems) firebaseDb.ref('livePrepItems').set(state.data.prepItems);
      if (state.data.schedule) firebaseDb.ref('liveSchedule').set(state.data.schedule);
      if (state.data.schedules) firebaseDb.ref('liveSchedules').set(state.data.schedules);
      if (state.data.cleaning) firebaseDb.ref('liveCleaning').set(state.data.cleaning);
    } catch (fbErr) {
      console.warn('Firebase push error:', fbErr);
    }
  }

  // Secondary push fallback (only if Firebase is NOT active)
  if (!firebaseInitialized && state.backendUrl && state.backendUrl.trim()) {
    try {
      fetch(state.backendUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'updatePrepItems',
          prepItems: state.data ? state.data.prepItems : [],
          passdownNotes: state.data ? state.data.passdownNotes : [],
          schedule: state.data ? state.data.schedule : [],
          schedules: state.data ? state.data.schedules : {},
          cleaning: state.data ? state.data.cleaning : {}
        })
      }).catch(e => console.warn('Cloud sync push error:', e));
    } catch (err) {}
  }
}

function saveBackendUrlFromUI() {
  const input = document.getElementById('backend-url-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    clearBackendUrlUI();
    return;
  }
  state.backendUrl = val;
  localStorage.setItem('cantine_backend_url', val);
  updateSyncStatusUI();
  alert('SUCCESS! Real-Time Cloud Sync Web App URL saved!');
  pollLiveUpdates();
}

function clearBackendUrlUI() {
  state.backendUrl = '';
  localStorage.removeItem('cantine_backend_url');
  const input = document.getElementById('backend-url-input');
  if (input) input.value = '';
  updateSyncStatusUI();
  alert('Cloud Sync cleared. Reverted to Local Device Storage.');
}

function updateSyncStatusUI() {
  const input = document.getElementById('backend-url-input');
  const statusEl = document.getElementById('cloud-sync-status');
  if (input) input.value = state.backendUrl || '';
  if (statusEl) {
    if (state.backendUrl) {
      statusEl.innerHTML = '<span style="color:var(--accent-green);">🟢 Real-Time Cloud Sync Active</span>';
    } else {
      statusEl.innerHTML = '<span style="color:var(--text-dim);">⚪ Storage Mode: Local Device Only</span>';
    }
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[match]));
}

// -------------------------------------------------------------
// BULK IMPORT PARSERS & HANDLERS
// -------------------------------------------------------------
function parseCSVRows(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === '\t') && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some(c => c !== '')) rows.push(currentRow);
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(c => c !== '')) rows.push(currentRow);
  }

  return rows;
}

// Bulk Inventory Import
function openBulkInventoryModal() {
  document.getElementById('bulk-inv-file').value = '';
  document.getElementById('bulk-inv-paste-input').value = '';
  document.getElementById('modal-bulk-inventory').style.display = 'block';
}

function handleBulkInventoryFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    document.getElementById('bulk-inv-paste-input').value = evt.target.result;
  };
  reader.readAsText(file);
}

function submitBulkInventoryImport(replaceMode) {
  const text = document.getElementById('bulk-inv-paste-input').value.trim();
  if (!text) { alert('Please paste spreadsheet rows or select a .CSV file'); return; }

  const rows = parseCSVRows(text);
  if (rows.length === 0) { alert('No valid data rows found'); return; }

  const newItems = [];
  let startIdx = 0;
  if (rows[0][0] && (rows[0][0].toLowerCase().includes('item') || rows[0][0].toLowerCase().includes('name'))) {
    startIdx = 1;
  }

  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (r[0] && r[0].trim()) {
      newItems.push({
        name: r[0].trim(),
        orderSize: r[1] ? r[1].trim() : '',
        count: r[2] ? r[2].trim() : '',
        parSized: r[3] ? r[3].trim() : '',
        par: r[4] ? r[4].trim() : '',
        notes: r[5] ? r[5].trim() : '',
        category: r[6] ? r[6].trim() : 'General',
        supplier: r[7] ? r[7].trim().toUpperCase() : 'HILLCREST'
      });
    }
  }

  if (newItems.length === 0) { alert('No items were parsed from input.'); return; }

  if (replaceMode) {
    if (confirm(`Are you sure you want to REPLACE your entire inventory list with these ${newItems.length} items?`)) {
      state.data.inventory = newItems;
    } else return;
  } else {
    if (!state.data.inventory) state.data.inventory = [];
    state.data.inventory = state.data.inventory.concat(newItems);
  }

  saveMasterData();
  closeModal('modal-bulk-inventory');
  alert(`SUCCESS! Successfully imported ${newItems.length} inventory items!`);
  if (state.activeModule === 'order') renderInventoryOrderSheet();
}

// Bulk Recipe Import
function openBulkRecipeModal() {
  document.getElementById('bulk-recipe-file').value = '';
  document.getElementById('bulk-recipe-paste-input').value = '';
  document.getElementById('modal-bulk-recipes').style.display = 'block';
}

function handleBulkRecipeFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    document.getElementById('bulk-recipe-paste-input').value = evt.target.result;
  };
  reader.readAsText(file);
}

function submitBulkRecipeImport(replaceMode) {
  const text = document.getElementById('bulk-recipe-paste-input').value.trim();
  if (!text) { alert('Please paste recipe rows or upload a .CSV file'); return; }

  const rows = parseCSVRows(text);
  if (rows.length === 0) { alert('No valid recipe rows found'); return; }

  const newRecipes = [];
  let startIdx = 0;
  if (rows[0][0] && (rows[0][0].toLowerCase().includes('recipe') || rows[0][0].toLowerCase().includes('name'))) {
    startIdx = 1;
  }

  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (r[0] && r[0].trim()) {
      newRecipes.push({
        name: r[0].trim(),
        category: r[1] ? r[1].trim() : 'General',
        ingredients: r[2] ? r[2].trim() : '',
        method: r[3] ? r[3].trim() : '',
        notes: r[4] ? r[4].trim() : ''
      });
    }
  }

  if (newRecipes.length === 0) { alert('No recipes were parsed from input.'); return; }

  if (replaceMode) {
    if (confirm(`Are you sure you want to REPLACE your entire recipe vault with these ${newRecipes.length} recipes?`)) {
      state.data.recipes = newRecipes;
    } else return;
  } else {
    if (!state.data.recipes) state.data.recipes = [];
    state.data.recipes = state.data.recipes.concat(newRecipes);
  }

  saveMasterData();
  closeModal('modal-bulk-recipes');
  alert(`SUCCESS! Successfully imported ${newRecipes.length} recipes!`);
  if (state.activeModule === 'recipe') renderRecipeVault();
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// MODULE 5: CANTINE MENU GENERATOR (8.5x14 LEGAL + 3-COLUMN FOH CUTOUTS)
// -------------------------------------------------------------

const defaultSummer2026Menu = {
  sharePlates: [
    { name: "Baked brie (vg)", price: "22", desc: "Puff pastry, fresh fruit, brandy glaze, raincoast crisp" },
    { name: "Wings", price: "11", desc: "House buffalo, whipped gorgonzola, crudite 11 | Gochujang glaze, kimchi, oi muchim 12 | Confit garlic butter, piave, house giardinera 10" },
    { name: "Hummus (vg)", price: "13", desc: "Castelvetrano olive, roast chickpea, EVOO, pita, crudite" },
    { name: "Crispy eggplant (vg)", price: "15", desc: "Eggplant cutlets, spicy pomodoro, burrata, balsamic\n-add pappardelle pasta 7" },
    { name: "Chorizo tacos", price: "13", desc: "Crispy corn shells, chorizo, cilantro lime crema, corn salsa, cheddar jack" },
    { name: "Fried calamari", price: "16", desc: "Buttermilk brined, pickled lemon aioli, spicy pomodoro" },
    { name: "Green Tomatoes (vg)", price: "14", desc: "Cornmeal breaded fried green tomatoes, jalapeno buttermilk dressing, pickled shallots" }
  ],
  sandwiches: [
    { name: "Lit burger", price: "15", desc: "2 Bonner Farms beef smash patty, Stone Oven challah, Coopers American cheese, pickles, dijonaise" },
    { name: "Grilled cheese (vg)", price: "15", desc: "Stone Oven pugliese, Port Salut, Comte, arugula, pear tarragon mostarda" },
    { name: "KFC", price: "14", desc: "Stone Oven challah, Korean fried chicken, garlic gochujang glaze, sesame, oi muchim" },
    { name: "BLT", price: "14", desc: "Stone Oven pugliese, hot honey candied bacon, fried green tomatoes, baby romaine, smoky apple bacon aioli" }
  ],
  mains: [
    { name: "Ricotta Meatballs", price: "17", desc: "Mini dry aged beef meatballs, spicy pomodoro, whipped ricotta, Piave, Stone Oven pugliese\n-add pappardelle pasta 7" },
    { name: "Tartine (vg)", price: "17", desc: "Stoney Creek's Oyster & Shimeji shrooms, herb whipped ricotta, gigante bean, Stone Oven pugliese" },
    { name: "Lasagna (vg)", price: "19", desc: "Fresh OCP pasta, sweet corn vermouth pudding, piave, goat cheese cubanelle fonduta" },
    { name: "Pulpo", price: "34", desc: "Grilled octopus, warm eggplant caponata, fried capers, romesco" },
    { name: "Prawns", price: "38", desc: "Pan roasted tiger prawns, calabrian corn butter, blistered heirloom tomato, Stone Oven pugliese" },
    { name: "Chicken Milan", price: "18", desc: "Parmesan crusted chicken cutlet, arugula, roasted tomato, piave, pickled lemon" },
    { name: "Steak frites", price: "40*", desc: "10 oz Bonner Farms strip steak, truffle fries, green peppercorn demi, arugula" }
  ],
  salads: [
    { name: "Caesar salad", price: "14*", desc: "Baby romaine, piave, roasted garlic crouton, kalamata caesar" },
    { name: "Beet salad (vg)", price: "16", desc: "Golden beets, arugula, goat cheese, marcona almonds, tamarind vinaigrette" },
    { name: "Panzanella (vg)", price: "17", desc: "Heirloom tomato, watermelon, crispy capers, roasted garlic crouton, burrata cheese, tarragon mustard vinaigrette" }
  ],
  sides: [
    { name: "Truffle fries, Romano, sriracha aioli, ketchup (v/vg)", price: "8", desc: "" },
    { name: "Grilled Pugiliese bread, confit garlic, piave (vg)", price: "8", desc: "" },
    { name: "Fried brussel, pancetta, jalapeno honey, pepita (v/vg)", price: "14", desc: "" },
    { name: "Arugula, tomato and piave salad (v/vg)", price: "10", desc: "" }
  ],
  cocktails: [
    { name: "Cantine", price: "14", desc: "Vodka, yellow chartreuse, passionfruit liquor, lemon juice, aloe vera, strawberry puree" },
    { name: "Sanguine", price: "13", desc: "Rye whiskey, malbec, orgeat, lemon juice, blood orange puree, ginger beer" },
    { name: "Pink lotus", price: "13", desc: "Gin, peach, lychee, cinnamon, lemon, cherrybark" },
    { name: "Whiskey! at the beach", price: "13", desc: "Rye whiskey, orgeat, pineapple juice, lemon juice, bitters" },
    { name: "Midnight nectar", price: "12", desc: "Bourbon, dolin rouge, amaro averna, nocino liqueur" },
    { name: "Tried & true", price: "14", desc: "Reposado, amaro di angostura, orgeat, lime juice, grapefruit juice" },
    { name: "Queen of chaos", price: "15", desc: "Muddled strawberry, blanco tequila, orange liquor, lime juice, prosecco" },
    { name: "Blueberry basil lemonade", price: "13", desc: "Muddled blueberries, lemon and basil, watershed vodka, lemon juice, simple syrup" },
    { name: "Chocolate covered pretzel", price: "14", desc: "Frangelico, baileys, pinnacle whipped, chocolate pretzel rim" },
    { name: "Espresso martini", price: "15", desc: "Van gogh espresso vodka, kahlua, baileys, shot of espresso, espresso powder" },
    { name: "El Jefe", price: "15", desc: "Espresso, King & Dane coffee liquor, agave syrup, reposado" },
    { name: "Ginger Refresher", price: "7", desc: "Fresh pressed ginger, lime & pomegranate juice, soda\n-add vodka or tequila 14" }
  ],
  redWine: [
    { name: "Giapoza cabernet", price: "11/44", desc: "California 2022" },
    { name: "Decoy Limited merlot", price: "15/55", desc: "Sonoma 2022" },
    { name: "Quilt cabernet", price: "18/60", desc: "Napa 2022" },
    { name: "St. Innocent Pinot Noir", price: "15/58", desc: "Oregon 2020" },
    { name: "Klinker Brick zinfandel", price: "12/48", desc: "Lodi 2021" },
    { name: "Regio dark wine red blend", price: "10/40", desc: "Lodi 2022" },
    { name: "Zolo malbec", price: "10/40", desc: "Argentina 2023" },
    { name: "Daou Pessimist red blend", price: "16/56", desc: "Paso Robles 2023" },
    { name: "Veneto Rosso Red Blend", price: "13/52", desc: "Organic Italy 2022" },
    { name: "E. Guigal Cotes du Rhone", price: "13/52", desc: "France 2020" }
  ],
  whiteWine: [
    { name: "Frisk riesling", price: "9/34", desc: "Australia 2024" },
    { name: "William Kavney chardonnay", price: "10/40", desc: "Sonoma 2021" },
    { name: "Black Stallion chardonnay", price: "14/52", desc: "Napa 2022" },
    { name: "Alverdi pinot grigio", price: "10/40", desc: "Organic Italy 2024" },
    { name: "Massey Dacta sauvignon blanc", price: "11/44", desc: "New Zealand 2023" },
    { name: "Roquesante rose", price: "12/46", desc: "France 2023" }
  ],
  bubbles: [
    { name: "Chandon brut rose split", price: "18", desc: "Napa Valley" },
    { name: "LaLuca prosecco", price: "10/40", desc: "Italy" },
    { name: "Mia moscato split", price: "10", desc: "Australia" }
  ],
  classics: [
    { name: "Old fashioned", price: "12", desc: "" },
    { name: "Manhattan", price: "12", desc: "" },
    { name: "Paloma", price: "13", desc: "" },
    { name: "Moscow mule", price: "12", desc: "" },
    { name: "Cosmopolitan", price: "13", desc: "" },
    { name: "Aperol spritz", price: "13", desc: "" },
    { name: "Mojito", price: "14", desc: "" },
    { name: "Bloody mary", price: "12", desc: "" },
    { name: "Hot & dirty", price: "13", desc: "" },
    { name: "Negroni", price: "13", desc: "" }
  ]
};

const defaultFiveDailySpecials = {
  mon: {
    title: "1 LB WINGS",
    subtitle: "",
    items: [
      { name: "Buffalo", price: "9", desc: "House buffalo, whipped gorgonzola, crudite" },
      { name: "Korean", price: "9", desc: "Gochujang glaze, kimchi, oi muchim" },
      { name: "Garlic Parm", price: "9", desc: "Confit garlic butter, piave, house giardinera" },
      { name: "Bacon", price: "9", desc: "Peppercorn bacon aioli, bacon bits, apple fennel slaw" }
    ]
  },
  tue: {
    title: "TACOS",
    subtitle: "$3 Tacos - $7 Margaritas - $3.50 Mexican Beer",
    items: [
      { name: "Chorizo", price: "3", desc: "Cilantro lime crema, corn salsa, cheddar jack, hard shell" },
      { name: "Chicken", price: "3", desc: "Green chile chicken, salsa verde, cotija, cilantro & onions" },
      { name: "Pastrami", price: "3 for 12", desc: "Shaved pastrami, pickled onion, brown mustard crema, havarti" },
      { name: "Queso or guac with chips", price: "6", desc: "" },
      { name: "Lime margaritas", price: "8", desc: "" },
      { name: "Specialty margaritas", price: "10", desc: "Blood orange pomegranate, almond, strawberry" },
      { name: "Modelo especial & negra", price: "3.5", desc: "" }
    ]
  },
  wed: {
    title: "BURGER DAY",
    subtitle: "Add thick cut bacon 3 - Add egg 2",
    items: [
      { name: "Classic", price: "15", desc: "Lettuce, tomato, red onion, american cheese" },
      { name: "Hipster", price: "14", desc: "Housemade veggie patty, pesto mayo, fresh mozzarella, arugula" },
      { name: "Lit Burger", price: "15", desc: "Two 4oz smash patties, sharp American cheese, dijonnaise, pickles" },
      { name: "Utah", price: "16", desc: "8 oz patty, shaved pastrami, griddled onion, spicy 1000, creamy coleslaw Coopers American cheese" }
    ]
  },
  thu: {
    wines: [
      { num: "1", name: "RIESLING" },
      { num: "2", name: "PINOT NOIR" },
      { num: "3", name: "PINOT NOIR" },
      { num: "4", name: "VINTNER" }
    ],
    tapas: "SMOKED GOUDA MAC BITES WITH POMODORO"
  },
  weekend: {
    title: "WEEKEND FEATURE",
    subtitle: "Sunday Brunch 11am-3pm",
    items: [
      { name: "Little Lit Sampler", price: "18", desc: "Jumbo Chicken Tenders, Black Garlic Honey Mustard, 3 Cheese Mac, Apple Fennel Slaw" }
    ]
  }
};

const defaultWeeklyPromos = [
  "sunday: brunch 11-3pm",
  "monday: no corking fee; $9 wings",
  "tuesday: $3 taco margerita specials",
  "wednesday: burger night",
  "thursday: $20 wine tasting/tapas"
];

const defaultDrinkSpecials = {
  title: "DRINK SPECIALS",
  subtitle: "",
  items: [
    { name: "Crisp Martini", price: "15", desc: "Beefeater gin, St. Germaine, Lemon, Sauvignon Blanc" },
    { name: "Yes Daddy!!! (Spicy Mango Margherita)", price: "15", desc: "Tanteo jalapeno tequila, lime juce, mango puree, triple sec, agave" },
    { name: "Kiwi Caipirinha", price: "15", desc: "Fresh lime, muddled kiwi, Cachaca, simple syrup" },
    { name: "Pineapple Affair (Pineapple Campari Daiquiri)", price: "15", desc: "Smith & Cross rum, pineapple puree, lime, simple syrup, campari" },
    { name: "Lychee Mami", price: "15", desc: "Vodka, Lime, Lychee Liqueur, Lychee Juice" },
    { name: "Skinny Dipped Spritz", price: "15", desc: "Cucumber Gin, lime, watermelon mint oleo, prosecco & soda" }
  ]
};

if (!state.activeMenuSubTab) state.activeMenuSubTab = 'food';

function switchMenuSubTab(tab) {
  state.activeMenuSubTab = tab;
  document.querySelectorAll('#module-menu-sec .filter-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-menu-tab-${tab}`);
  if (activeBtn) activeBtn.classList.add('active');
  renderMenuGenerator();
}

function getMenuData() {
  if (!state.data.summerMenu) {
    state.data.summerMenu = JSON.parse(JSON.stringify(defaultSummer2026Menu));
  }
  return state.data.summerMenu;
}

function getFiveDailySpecials() {
  if (!state.data.fiveDailySpecials) {
    state.data.fiveDailySpecials = JSON.parse(JSON.stringify(defaultFiveDailySpecials));
  }
  if (!state.data.fiveDailySpecials.drinks || !state.data.fiveDailySpecials.drinks.items || state.data.fiveDailySpecials.drinks.items.length === 0) {
    state.data.fiveDailySpecials.drinks = JSON.parse(JSON.stringify(defaultDrinkSpecials));
  }
  return state.data.fiveDailySpecials;
}

function isChefUser() {
  if (!state.currentUser) return false;
  const role = (state.currentUser.role || '').toLowerCase();
  const name = (state.currentUser.name || '').toLowerCase();
  const pin = String(state.currentUser.pin || '').trim();
  return (
    role === 'head_chef' ||
    role === 'manager' ||
    role === 'chef' ||
    pin === '217' ||
    pin === '123' ||
    name.includes('chef')
  );
}

function toggleMenuEditMode(enable) {
  state.menuEditMode = enable;
  renderMenuGenerator();
}

function renderMenuGenerator() {
  const container = document.getElementById('menu-editor-container');
  const headerActions = document.getElementById('menu-header-actions');
  if (!container) return;

  const tab = state.activeMenuSubTab || 'food';
  const isChef = isChefUser();

  // Render Header Action Controls
  if (headerActions) {
    let actionsHtml = '';
    if (isChef) {
      if (state.menuEditMode) {
        actionsHtml += `<button class="btn btn-primary" style="font-size:1.1rem; padding:10px 18px;" onclick="toggleMenuEditMode(false)">👁️ View Formatted Menu</button>`;
        actionsHtml += `<button class="btn btn-secondary" style="font-size:1.1rem; padding:10px 18px;" onclick="openLogoUploadModal()">🖼️ Custom Logos</button>`;
      } else {
        actionsHtml += `<button class="btn btn-warning" style="font-size:1.1rem; padding:10px 18px;" onclick="toggleMenuEditMode(true)">✏️ Edit Menu</button>`;
      }
    }
    actionsHtml += `<button class="btn btn-success" style="font-size:1.1rem; padding:10px 18px;" onclick="generateLegalMainMenuPrint()">🖨️ Print Main Menu</button>`;
    actionsHtml += `<button class="btn btn-primary" style="font-size:1.1rem; padding:10px 18px;" onclick="downloadLegalMainMenuPDF()">📥 Download PDF</button>`;
    actionsHtml += `<button class="btn btn-warning" style="font-size:1.1rem; padding:10px 18px;" onclick="generateDailySpecialsCutoutPrint()">✂️ Print Special Slips</button>`;
    headerActions.innerHTML = actionsHtml;
  }

  // If in Viewer Mode (default for cooks & chef when viewing):
  if (!state.menuEditMode) {
    renderMenuView(container, tab);
    return;
  }

  // If in Edit Mode (Chef clicked "Edit Menu"):
  if (tab === 'mon' || tab === 'tue' || tab === 'wed' || tab === 'weekend' || tab === 'cutoutdrinks') {
    renderDaily3ColumnEditor(container, (tab === 'cutoutdrinks') ? 'drinks' : tab);
    return;
  } else if (tab === 'thu') {
    renderThursdayFlightMatEditor(container);
    return;
  } else {
    renderMainMenuEditor(container, tab);
    return;
  }
}

function renderMenuView(container, tab) {
  const mm = getMenuData();
  const dsAll = getFiveDailySpecials();
  const customHeaderLogo = (state.data && state.data.customHeaderLogoUrl) ? state.data.customHeaderLogoUrl : encodeURI("4k logo.png");

  let html = '';

  if (tab === 'food' || tab === 'drinks') {
    const categoryMap = {
      food: [
        { key: 'sharePlates', label: 'Share Plates' },
        { key: 'sandwiches', label: 'Sandwiches' },
        { key: 'mains', label: 'Mains' },
        { key: 'salads', label: 'Salads' },
        { key: 'sides', label: 'Sides' }
      ],
      drinks: [
        { key: 'cocktails', label: 'Signature Cocktails' },
        { key: 'whiteWine', label: 'White Wine & Rosé' },
        { key: 'redWine', label: 'Red Wine' },
        { key: 'bubbles', label: 'Bubbles' },
        { key: 'classics', label: 'Classics' }
      ]
    };

    const catsToRender = categoryMap[tab] || categoryMap.food;
    const mainTitle = (tab === 'food') ? 'CANTINE MAIN MENU (FOOD)' : 'BEVERAGES & WINE LIST';

    html += `
      <div style="background:#1e1e1e; padding:30px; border-radius:16px; border:1px solid var(--border-color); max-width:900px; margin:0 auto; box-shadow:0 10px 30px rgba(0,0,0,0.4);">
        <div style="text-align:center; margin-bottom:25px; border-bottom:2px solid var(--border-color); padding-bottom:20px;">
          <img src="${customHeaderLogo}" style="max-height:80px; width:auto; object-fit:contain; margin-bottom:10px;">
          <h2 style="font-family:'Jadeite', sans-serif; font-size:1.8rem; color:var(--accent-orange); letter-spacing:4px; margin:5px 0 0 0; text-transform:uppercase;">${mainTitle}</h2>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:25px;">
    `;

    catsToRender.forEach(catInfo => {
      const items = mm[catInfo.key] || [];
      if (items.length === 0) return;

      html += `
        <div style="background:#262626; padding:18px; border-radius:12px; border:1px solid #3d3d3d;">
          <h3 style="color:var(--accent-gold); border-bottom:1px solid #444; padding-bottom:6px; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:1px; font-size:1.2rem;">${catInfo.label}</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
      `;

      items.forEach(item => {
        let rawName = item.name || '';
        let titleName = rawName;
        let tagStr = '';
        const matchParen = rawName.match(/^(.*?)\s*(\((?:v|vg|v\/vg)\))\s*$/i);
        if (matchParen) {
          titleName = matchParen[1];
          tagStr = matchParen[2];
        }

        html += `
          <div>
            <div style="display:flex; justify-content:space-between; align-items:baseline;">
              <span style="font-weight:bold; color:#fff; font-size:1.05rem;">
                ${escapeHTML(titleName)}
                ${tagStr ? `<span style="color:var(--accent-green); font-size:0.85rem; margin-left:4px;">${escapeHTML(tagStr)}</span>` : ''}
              </span>
              <span style="color:var(--accent-gold); font-weight:bold; font-size:1.05rem;">${escapeHTML(item.price || '')}</span>
            </div>
            ${item.desc ? `<div style="color:var(--text-muted); font-size:0.92rem; margin-top:3px; line-height:1.35;">${escapeHTML(item.desc)}</div>` : ''}
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

  } else if (tab === 'mon' || tab === 'tue' || tab === 'wed' || tab === 'weekend' || tab === 'cutoutdrinks') {
    const dayKey = (tab === 'cutoutdrinks') ? 'drinks' : tab;
    const ds = dsAll[dayKey] || defaultFiveDailySpecials.mon;

    const dayTitles = {
      mon: '🍗 MONDAY 1 LB WINGS SPECIALS',
      tue: '🌮 TUESDAY TACOS & MARGARITAS',
      wed: '🍔 WEDNESDAY BURGER DAY',
      weekend: '🥂 FRIDAY - SUNDAY WEEKEND FEATURE',
      drinks: '🍹 DRINK SPECIALS (BACK SLIPS)'
    };

    let promosHtml = defaultWeeklyPromos.map(p => `<div style="font-size:0.95rem; color:#ddd; margin-bottom:2px;">${escapeHTML(p)}</div>`).join('');

    html += `
      <div style="background:#1e1e1e; padding:30px; border-radius:16px; border:1px solid var(--border-color); max-width:650px; margin:0 auto; box-shadow:0 10px 30px rgba(0,0,0,0.4);">
        <div style="text-align:center; margin-bottom:20px;">
          <img src="${customHeaderLogo}" style="max-height:75px; width:auto; object-fit:contain; margin-bottom:8px;">
          <h2 style="font-family:'Jadeite', sans-serif; font-size:1.6rem; color:var(--accent-orange); letter-spacing:2px; margin:0; text-transform:uppercase;">${ds.title || dayTitles[tab] || 'SPECIALS'}</h2>
          ${ds.subtitle ? `<div style="color:var(--accent-gold); font-size:1.1rem; font-weight:bold; margin-top:4px;">${escapeHTML(ds.subtitle)}</div>` : ''}
        </div>

        <div style="background:#262626; padding:20px; border-radius:12px; border:1px solid #3d3d3d; margin-bottom:20px;">
          <h3 style="color:var(--accent-blue); margin:0 0 15px 0; font-size:1.1rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #444; padding-bottom:6px;">Featured Items & Pricing</h3>
          <div style="display:flex; flex-direction:column; gap:14px;">
    `;

    (ds.items || []).forEach(item => {
      let titleName = item.name || '';
      let subLabel = '';
      const matchParen = titleName.match(/^(.*?)\s*\((.*?)\)$/);
      if (matchParen) {
        titleName = matchParen[1];
        subLabel = matchParen[2];
      }

      html += `
        <div style="border-bottom:1px solid #333; padding-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <span style="font-weight:bold; color:#fff; font-size:1.1rem;">
              ${escapeHTML(titleName)}
              ${subLabel ? `<span style="color:var(--accent-blue); font-size:0.9rem; font-weight:normal; margin-left:4px;">(${escapeHTML(subLabel)})</span>` : ''}
            </span>
            <span style="color:var(--accent-gold); font-weight:bold; font-size:1.1rem;">$${escapeHTML(item.price || '')}</span>
          </div>
          ${item.desc ? `<div style="color:var(--text-muted); font-size:0.95rem; margin-top:4px; line-height:1.4;">${escapeHTML(item.desc)}</div>` : ''}
        </div>
      `;
    });

    html += `
          </div>
        </div>

        <div style="background:#2a2015; padding:15px; border-radius:10px; border:1px solid #5a3a1e; text-align:center;">
          <div style="font-family:'Jadeite', sans-serif; font-size:0.9rem; font-weight:bold; color:var(--accent-orange); letter-spacing:1px; margin-bottom:6px; text-transform:uppercase;">CANTINE WEEKLY PROMOS</div>
          ${promosHtml}
        </div>
      </div>
    `;

  } else if (tab === 'thu') {
    const thu = dsAll.thu || defaultFiveDailySpecials.thu;

    html += `
      <div style="background:#1e1e1e; padding:30px; border-radius:16px; border:1px solid var(--border-color); max-width:650px; margin:0 auto; box-shadow:0 10px 30px rgba(0,0,0,0.4);">
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="font-family:'Jadeite', sans-serif; font-size:1.6rem; color:var(--accent-gold); letter-spacing:2px; margin:0; text-transform:uppercase;">🍷 THURSDAY WINE TASTING & TAPAS FLIGHT MAT</h2>
          <div style="color:var(--text-muted); font-size:1rem; margin-top:4px;">$20 Wine Tasting / Tapas Flight Feature</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px;">
    `;

    (thu.wines || []).forEach(w => {
      html += `
        <div style="background:#262626; padding:16px; border-radius:12px; border:1px solid #3d3d3d; text-align:center;">
          <div style="width:40px; height:40px; border-radius:50%; background:var(--accent-orange); color:#fff; font-weight:bold; font-size:1.2rem; display:flex; align-items:center; justify-content:center; margin:0 auto 10px auto;">${w.num}</div>
          <div style="font-weight:bold; color:#fff; font-size:1.05rem;">${escapeHTML(w.name)}</div>
        </div>
      `;
    });

    html += `
        </div>

        <div style="background:#2a2015; padding:16px; border-radius:10px; border:1px solid #5a3a1e; text-align:center;">
          <div style="font-size:0.85rem; font-weight:bold; color:var(--accent-gold); letter-spacing:1px; margin-bottom:4px; text-transform:uppercase;">TAPAS PAIRING BANNER</div>
          <div style="font-size:1.1rem; font-weight:bold; color:#fff;">${escapeHTML(thu.tapas || 'SMOKED GOUDA MAC BITES WITH POMODORO')}</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderMainMenuEditor(container, tab) {
  const menu = getMenuData();
  let html = '';

  const categoryMap = {
    food: [
      { key: 'sharePlates', label: 'Share Plates' },
      { key: 'sandwiches', label: 'Sandwiches' },
      { key: 'mains', label: 'Mains' },
      { key: 'salads', label: 'Salads' },
      { key: 'sides', label: 'Sides' }
    ],
    drinks: [
      { key: 'cocktails', label: 'Signature Cocktails' },
      { key: 'whiteWine', label: 'White Wine & Rosé' },
      { key: 'redWine', label: 'Red Wine' },
      { key: 'bubbles', label: 'Bubbles' },
      { key: 'classics', label: 'Classics' }
    ]
  };

  const catsToRender = categoryMap[tab] || categoryMap.food;

  catsToRender.forEach(catInfo => {
    const key = catInfo.key;
    const label = catInfo.label;
    const items = menu[key] || [];

    html += `
      <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border-color); margin-bottom:25px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h3 style="margin:0; color:var(--accent-gold); text-transform:uppercase; letter-spacing:1px;">${label}</h3>
          <button class="btn btn-primary btn-sm" onclick="addMenuItem('${key}')">+ Add Item</button>
        </div>
        <div id="items-group-${key}">
    `;

    items.forEach((item, idx) => {
      html += `
        <div style="background:#262626; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #444;">
          <div style="display:grid; grid-template-columns:3fr 1fr auto; gap:10px; margin-bottom:8px;">
            <input type="text" id="menu-${key}-${idx}-name" value="${escapeHTML(item.name)}" class="form-control" style="font-weight:bold;" placeholder="Item Name">
            <input type="text" id="menu-${key}-${idx}-price" value="${escapeHTML(item.price || '')}" class="form-control" style="font-weight:bold; color:var(--accent-gold); text-align:center;" placeholder="Price (e.g. 15)">
            <button class="btn btn-danger btn-sm" style="padding:4px 10px; height:48px; margin-top:6px;" onclick="deleteMenuItem('${key}', ${idx})">🗑️</button>
          </div>
          <textarea id="menu-${key}-${idx}-desc" class="form-control" style="height:54px; font-size:0.95rem;" placeholder="Description & Add-ons...">${escapeHTML(item.desc || '')}</textarea>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
    <div style="margin-top:20px; text-align:right;">
      <button class="btn btn-success" style="font-size:1.3rem; padding:14px 28px;" onclick="saveSummerMenuChanges()">💾 Save Summer Menu Changes</button>
    </div>
  `;

  container.innerHTML = html;
}

function renderDaily3ColumnEditor(container, dayKey) {
  const dsAll = getFiveDailySpecials();
  const ds = dsAll[dayKey] || { title: 'DAILY SPECIAL', subtitle: '', items: [] };

  const dayLabels = {
    mon: 'Monday (1 LB Wings)',
    tue: 'Tuesday (Tacos & Margaritas)',
    wed: 'Wednesday (Burger Day)',
    weekend: 'Friday - Sunday (Weekend Feature)',
    drinks: 'Back Slips (Drink Specials Cutout)'
  };

  let html = `
    <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border-color); margin-bottom:25px;">
      <h3 style="margin:0 0 15px 0; color:var(--accent-gold); text-transform:uppercase;">✂️ ${dayLabels[dayKey]} 3-Column Editor</h3>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px;">
        <div>
          <label style="color:var(--text-muted); font-weight:bold;">Special Header / Day Title:</label>
          <input type="text" id="daily-title-${dayKey}" value="${escapeHTML(ds.title)}" class="form-control" style="font-size:1.2rem; font-weight:bold; color:var(--accent-orange);" placeholder="e.g. 1 LB WINGS or BURGER DAY">
        </div>
        <div>
          <label style="color:var(--text-muted); font-weight:bold;">Subtitle / Add-ons Line:</label>
          <input type="text" id="daily-subtitle-${dayKey}" value="${escapeHTML(ds.subtitle || '')}" class="form-control" style="font-size:1.1rem;" placeholder="e.g. Add thick cut bacon 3 - Add egg 2">
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h4 style="margin:0; color:var(--accent-blue);">Specials List</h4>
        <button class="btn btn-primary btn-sm" onclick="addDaily3ColumnItem('${dayKey}')">+ Add Special Dish/Drink</button>
      </div>

      <div id="daily-items-container-${dayKey}">
  `;

  (ds.items || []).forEach((item, idx) => {
    html += `
      <div style="background:#262626; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #444;">
        <div style="display:grid; grid-template-columns:3fr 1fr auto; gap:10px; margin-bottom:8px;">
          <input type="text" id="daily-item-${dayKey}-${idx}-name" value="${escapeHTML(item.name)}" class="form-control" style="font-weight:bold;" placeholder="Item Title">
          <input type="text" id="daily-item-${dayKey}-${idx}-price" value="${escapeHTML(item.price || '')}" class="form-control" style="font-weight:bold; color:var(--accent-gold); text-align:center;" placeholder="Price (e.g. 15)">
          <button class="btn btn-danger btn-sm" style="padding:4px 10px; height:48px; margin-top:6px;" onclick="deleteDaily3ColumnItem('${dayKey}', ${idx})">🗑️</button>
        </div>
        <textarea id="daily-item-${dayKey}-${idx}-desc" class="form-control" style="height:50px;" placeholder="Description...">${escapeHTML(item.desc || '')}</textarea>
      </div>
    `;
  });

  html += `
      </div>

      <div style="margin-top:25px; text-align:right; display:flex; gap:15px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="btn btn-success" style="font-size:1.2rem; padding:12px 24px;" onclick="saveDaily3ColumnChanges('${dayKey}')">💾 Save ${dayLabels[dayKey]}</button>
        <button class="btn btn-warning" style="font-size:1.2rem; padding:12px 24px;" onclick="generateDailySpecialsCutoutPrint('${dayKey}')">🖨️ Print 3-Column Slips</button>
        <button class="btn btn-primary" style="font-size:1.2rem; padding:12px 24px;" onclick="downloadDailySpecialsPDF('${dayKey}')">📥 Download Clean PDF File</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderThursdayFlightMatEditor(container) {
  const dsAll = getFiveDailySpecials();
  const thu = dsAll.thu || defaultFiveDailySpecials.thu;

  let html = `
    <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border-color); margin-bottom:25px;">
      <h3 style="margin:0 0 15px 0; color:var(--accent-gold); text-transform:uppercase;">🍷 Thursday Wine Tasting & Tapas Flight Mat Editor</h3>
      <p style="color:var(--text-muted); font-size:1.1rem; line-height:1.5;">
        Matches your <strong>shared wine flight.pdf</strong>! Customizes the 4 numbered wine flight circles (1, 2, 3, 4) and the Tapas Pairing banner text.
      </p>

      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:15px; margin-bottom:20px;">
  `;

  (thu.wines || []).forEach((w, idx) => {
    html += `
      <div style="background:#262626; padding:15px; border-radius:8px; border:1px solid #444; text-align:center;">
        <div style="width:50px; height:50px; border-radius:50%; background:#5b82b5; color:#000; font-size:28px; font-weight:bold; display:flex; align-items:center; justify-content:center; margin:0 auto 10px auto;">${w.num}</div>
        <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Wine #${w.num} Name:</label>
        <input type="text" id="thu-wine-${idx}" value="${escapeHTML(w.name)}" class="form-control" style="text-align:center; font-weight:bold;" placeholder="Wine Name">
      </div>
    `;
  });

  html += `
      </div>

      <div style="margin-bottom:20px;">
        <label style="color:var(--text-muted); font-weight:bold;">Tapas Pairing Text Line:</label>
        <input type="text" id="thu-tapas" value="${escapeHTML(thu.tapas || '')}" class="form-control" style="font-size:1.1rem; font-weight:bold;" placeholder="e.g. SMOKED GOUDA MAC BITES WITH POMODORO">
      </div>

      <div style="margin-top:25px; text-align:right; display:flex; gap:15px; justify-content:flex-end;">
        <button class="btn btn-success" style="font-size:1.2rem; padding:12px 24px;" onclick="saveThursdayFlightMatChanges()">💾 Save Thursday Flight Mat</button>
        <button class="btn btn-warning" style="font-size:1.2rem; padding:12px 24px;" onclick="generateThursdayWineFlightPrint()">🍷 Print Wine Flight Mat (2-Up)</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function addMenuItem(catKey) {
  const menu = getMenuData();
  if (!menu[catKey]) menu[catKey] = [];
  menu[catKey].push({ name: 'New Item', price: '15', desc: 'Item description...' });
  renderMenuGenerator();
}

function deleteMenuItem(catKey, idx) {
  const menu = getMenuData();
  if (menu[catKey] && menu[catKey][idx]) {
    menu[catKey].splice(idx, 1);
    renderMenuGenerator();
  }
}

function addDaily3ColumnItem(dayKey) {
  const dsAll = getFiveDailySpecials();
  if (!dsAll[dayKey]) dsAll[dayKey] = { title: '', subtitle: '', items: [] };
  if (!dsAll[dayKey].items) dsAll[dayKey].items = [];
  dsAll[dayKey].items.push({ name: 'Special Item', price: '15', desc: 'Special description...' });
  renderDaily3ColumnEditor(document.getElementById('menu-editor-container'), dayKey);
}

function deleteDaily3ColumnItem(dayKey, idx) {
  const dsAll = getFiveDailySpecials();
  if (dsAll[dayKey] && dsAll[dayKey].items && dsAll[dayKey].items[idx]) {
    dsAll[dayKey].items.splice(idx, 1);
    renderDaily3ColumnEditor(document.getElementById('menu-editor-container'), dayKey);
  }
}

function saveSummerMenuChanges(showAlert = true) {
  const menu = getMenuData();
  const tab = state.activeMenuSubTab || 'food';

  const categoryMap = {
    food: ['sharePlates', 'sandwiches', 'mains', 'salads', 'sides'],
    drinks: ['cocktails', 'whiteWine', 'redWine', 'bubbles', 'classics']
  };

  const keys = categoryMap[tab] || [];
  keys.forEach(key => {
    const items = menu[key] || [];
    items.forEach((item, idx) => {
      const nameEl = document.getElementById(`menu-${key}-${idx}-name`);
      const priceEl = document.getElementById(`menu-${key}-${idx}-price`);
      const descEl = document.getElementById(`menu-${key}-${idx}-desc`);
      if (nameEl) item.name = nameEl.value.trim();
      if (priceEl) item.price = priceEl.value.trim();
      if (descEl) item.desc = descEl.value.trim();
    });
  });

  saveMasterData();
  if (showAlert) {
    alert('SUCCESS! Summer menu changes saved!');
    renderMenuGenerator();
  }
}

function saveDaily3ColumnChanges(dayKey, showAlert = true) {
  const dsAll = getFiveDailySpecials();
  const ds = dsAll[dayKey] || { title: '', subtitle: '', items: [] };

  const titleEl = document.getElementById(`daily-title-${dayKey}`);
  const subEl = document.getElementById(`daily-subtitle-${dayKey}`);

  if (titleEl) ds.title = titleEl.value.trim();
  if (subEl) ds.subtitle = subEl.value.trim();

  (ds.items || []).forEach((item, idx) => {
    const nameEl = document.getElementById(`daily-item-${dayKey}-${idx}-name`);
    const priceEl = document.getElementById(`daily-item-${dayKey}-${idx}-price`);
    const descEl = document.getElementById(`daily-item-${dayKey}-${idx}-desc`);
    if (nameEl) item.name = nameEl.value.trim();
    if (priceEl) item.price = priceEl.value.trim();
    if (descEl) item.desc = descEl.value.trim();
  });

  saveMasterData();
  if (showAlert) {
    alert('SUCCESS! Daily Specials updated!');
  }
}

function saveThursdayFlightMatChanges() {
  const dsAll = getFiveDailySpecials();
  if (!dsAll.thu) dsAll.thu = JSON.parse(JSON.stringify(defaultFiveDailySpecials.thu));

  (dsAll.thu.wines || []).forEach((w, idx) => {
  const wEl = document.getElementById(`thu-wine-${idx}`);
    if (wEl) w.name = wEl.value.trim();
  });

  const tapasEl = document.getElementById('thu-tapas');
  if (tapasEl) dsAll.thu.tapas = tapasEl.value.trim();

  saveMasterData();
  alert('SUCCESS! Thursday Wine Flight Mat saved!');
}

function setDynamicPrintPageStyle(sizeRule) {
  let styleEl = document.getElementById('dynamic-print-page-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-page-style';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `@page { size: ${sizeRule}; margin: 0.2in !important; }`;
}

function renderLegalMainMenuDOM() {
  saveSummerMenuChanges(false);
  const mm = getMenuData();
  const printArea = document.getElementById('print-area');
  if (!printArea) return;

  const badgeLogoUrl = (state.data && state.data.customBadgeLogoUrl) ? state.data.customBadgeLogoUrl : encodeURI("cantine logo bottom.png");
  const topLogoUrl = (state.data && state.data.customHeaderLogoUrl) ? state.data.customHeaderLogoUrl : encodeURI("4k logo.png");

  const fbIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`;
  const igIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;

  const renderItemBox = (item) => {
    let rawName = item.name || '';
    let titleName = rawName;
    let tagStr = '';
    const matchParen = rawName.match(/^(.*?)\s*(\((?:v|vg|v\/vg)\))\s*$/i);
    if (matchParen) {
      titleName = matchParen[1];
      tagStr = matchParen[2];
    }

    return `
      <div class="legal-item-box">
        <div>
          <span class="legal-item-title">${escapeHTML(titleName)}</span>
          ${tagStr ? `<span class="legal-item-tag">${escapeHTML(tagStr)}</span>` : ''}
          <span class="legal-item-price">${escapeHTML(item.price || '')}</span>
        </div>
        ${item.desc ? `<div class="legal-item-desc">${escapeHTML(item.desc)}</div>` : ''}
      </div>
    `;
  };

  const renderSection = (title, items, subtitle = '') => {
    if (!items || items.length === 0) return '';
    return `
      <div class="legal-section-block">
        <div class="legal-section-header">
          <h3 class="legal-section-title">${title}</h3>
          ${subtitle ? `<div class="legal-section-sub">${subtitle}</div>` : ''}
        </div>
        <div class="legal-section-items">
          ${items.map(renderItemBox).join('')}
        </div>
      </div>
    `;
  };

  const renderClassicsSection = (title, items) => {
    if (!items || items.length === 0) return '';
    const mid = Math.ceil(items.length / 2);
    const col1 = items.slice(0, mid);
    const col2 = items.slice(mid);

    return `
      <div class="legal-section-block">
        <div class="legal-section-header">
          <h3 class="legal-section-title">${title}</h3>
        </div>
        <div class="legal-classics-2col">
          <div class="legal-section-items">${col1.map(renderItemBox).join('')}</div>
          <div class="legal-section-items">${col2.map(renderItemBox).join('')}</div>
        </div>
      </div>
    `;
  };

  printArea.innerHTML = `
    <!-- PAGE 1: FOOD -->
    <div class="legal-menu-page">
      <div class="legal-top-header">
        <img src="${topLogoUrl}" style="max-height:65px; width:auto; margin-bottom:4px;">
      </div>
      <div class="legal-grid-2col">
        <div class="legal-col">
          ${renderSection("SHARE PLATES", mm.sharePlates)}
          ${renderSection("SANDWICHES", mm.sandwiches, "Add thick cut bacon 3 Add egg 2*")}
          ${renderSection("SIDES", mm.sides)}
        </div>
        <div class="legal-col">
          ${renderSection("MAINS", mm.mains)}
          ${renderSection("SALADS", mm.salads, "Add 5 oz strip steak 16* Add chicken 7 Add salmon* 12 Add shrimp 12")}
          
          <div style="margin-top:auto; padding-top:4px; border-top:1px solid #eee;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <img src="${badgeLogoUrl}" style="width:50px; height:50px; object-fit:contain;">
              <div style="text-align:right;">
                <div style="font-size:9px; font-weight:bold; display:flex; gap:6px; justify-content:flex-end; align-items:center; font-family:'Outfit', 'Cinzel', sans-serif;">
                  ${fbIcon} cantinebar &nbsp; ${igIcon} cantine_bar
                </div>
                <div style="font-size:9px; font-weight:bold; color:#c85c33; margin-top:1px; font-family:'Outfit', 'Cinzel', sans-serif;">
                  Summer 2026 &nbsp;|&nbsp; Executive Chef - Michael Booth &nbsp;|&nbsp; General Manager - Jessica Kerlin
                </div>
              </div>
            </div>
            <div style="font-size:7.5px; color:#444; line-height:1.15; text-align:center; margin-top:3px; font-family:'Playfair Display', 'Cormorant Garamond', Georgia, serif;">
              **Our kitchen uses, milk, eggs, dairy, wheat, soy, tree nuts, fish, shellfish and sesame. Please inform your server of any allergies.<br>
              *Consuming raw or undercooked meats, poultry, seafood, shellfish or eggs may increase your risk of foodborne illness.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PAGE 2: DRINKS -->
    <div class="legal-menu-page">
      <div class="legal-top-header">
        <h1 class="legal-main-title">DRINKS</h1>
      </div>
      <div class="legal-grid-2col">
        <div class="legal-col">
          ${renderSection("COCKTAILS", mm.cocktails)}
          ${renderSection("CLASSICS", mm.classics)}
        </div>
        <div class="legal-col">
          ${renderSection("RED WINE", mm.redWine, "Glass/Bottle")}
          ${renderSection("WHITE WINE", mm.whiteWine, "Glass/Bottle")}
          ${renderSection("BUBBLES", mm.bubbles)}

          <div style="margin-top:auto; border:2px solid #000; padding:6px; text-align:center; background:#fafafa;">
            <h4 style="margin:0 0 3px 0; color:#c85c33; font-family:'Outfit', 'Cinzel', sans-serif; font-size:12px; letter-spacing:2px;">CANTINE DAILY</h4>
            <div style="font-family:'Playfair Display', 'Cormorant Garamond', Georgia, serif; font-size:9px; line-height:1.3; color:#111; font-weight:bold;">
              sunday: brunch 11-3pm<br>
              monday: no corking fee; $9 wings<br>
              tuesday: $3 taco; margarita and beer specials<br>
              wednesday: burger night<br>
              thursday: $20 wine tasting with tapas
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateLegalMainMenuPrint() {
  setDynamicPrintPageStyle('8.5in 14in portrait');
  renderLegalMainMenuDOM();
  const printArea = document.getElementById('print-area');
  waitForImagesToLoad(printArea, () => {
    window.print();
  });
}

function downloadLegalMainMenuPDF() {
  setDynamicPrintPageStyle('8.5in 14in portrait');
  renderLegalMainMenuDOM();

  const printArea = document.getElementById('print-area');
  if (!printArea) return;

  waitForImagesToLoad(printArea, () => {
    const opt = {
      margin: 0,
      filename: `Cantine_Main_Menu_Legal.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: [8.5, 14], orientation: 'portrait' }
    };

    if (window.html2pdf) {
      window.html2pdf().set(opt).from(printArea).save();
    } else {
      window.print();
    }
  });
}

function renderCutoutPrintDOM(foodData, drinkData = defaultDrinkSpecials) {
  const printArea = document.getElementById('print-area');
  if (!printArea) return;

  const fbIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`;
  const igIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;

  const customHeaderLogo = (state.data && state.data.customHeaderLogoUrl) ? state.data.customHeaderLogoUrl : encodeURI("4k logo.png");
  const customBadgeLogo = (state.data && state.data.customBadgeLogoUrl) ? state.data.customBadgeLogoUrl : encodeURI("cantine logo bottom.png");

  const renderSingleCutoutColumn = (dataObj, isPage1 = true) => {
    let itemsHtml = '';
    (dataObj.items || []).forEach(item => {
      let titleName = item.name || '';
      let subLabel = '';
      const matchParen = titleName.match(/^(.*?)\s*\((.*?)\)$/);
      if (matchParen) {
        titleName = matchParen[1];
        subLabel = matchParen[2];
      }

      itemsHtml += `
        <div class="cutout-item">
          <div class="cutout-item-header">
            <span class="cutout-item-name">${escapeHTML(titleName)}</span>
            <span class="cutout-item-price">${escapeHTML(item.price || '')}</span>
          </div>
          ${subLabel ? `<div class="cutout-item-sublabel">(${escapeHTML(subLabel)})</div>` : ''}
          ${item.desc ? `<div class="cutout-item-desc">${escapeHTML(item.desc)}</div>` : ''}
        </div>
      `;
    });

    let promosHtml = defaultWeeklyPromos.map(p => `<div>${escapeHTML(p)}</div>`).join('');

    // PAGE 1 HEADER (With Large Top Logo) vs PAGE 2 HEADER (No Logo)
    const headerHtml = isPage1
      ? `
        <div class="cutout-header-brand">
          <img src="${customHeaderLogo}" class="cutout-top-logo-img">
        </div>
        <div class="cutout-section-header">
          <h2 class="cutout-section-title">${escapeHTML(dataObj.title || 'DAILY SPECIALS')}</h2>
          ${dataObj.subtitle ? `<div class="cutout-section-subtitle">${escapeHTML(dataObj.subtitle)}</div>` : ''}
        </div>
      `
      : `
        <div class="cutout-section-header" style="margin-top:0.25in; margin-bottom:0.1in;">
          <h2 class="cutout-section-title" style="font-size:28px; color:#c85a32;">${escapeHTML(dataObj.title || 'DRINK SPECIALS')}</h2>
          ${dataObj.subtitle ? `<div class="cutout-section-subtitle">${escapeHTML(dataObj.subtitle)}</div>` : ''}
        </div>
      `;

    // PROMO BOX ONLY ON PAGE 1
    const promoBoxHtml = isPage1
      ? `
        <div class="cutout-promo-box">
          <div style="font-family:'Outfit', 'Cinzel', sans-serif; font-size:10.5px; font-weight:900; color:#c85a32; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase; text-align:center;">CANTINE DAILY</div>
          ${promosHtml}
        </div>
      `
      : '';

    // PAGE 1 FOOTER (With Large Bottom Badge Logo) vs PAGE 2 FOOTER (No Logos)
    const footerHtml = isPage1
      ? `
        <div class="cutout-footer">
          <img src="${customBadgeLogo}" class="cutout-bottom-logo-img">
          <div class="cutout-footer-info">
            <div class="cutout-socials">
              ${fbIcon} cantinebar &nbsp; ${igIcon} cantine_bar
            </div>
            <div class="cutout-credits">
              Summer 2026<br>
              Executive Chef - Michael Booth<br>
              General Manager - Jessica Kerlin
            </div>
          </div>
        </div>
      `
      : `
        <div class="cutout-footer" style="justify-content:center;">
          <div class="cutout-footer-info" style="text-align:center; width:100%;">
            <div class="cutout-socials" style="justify-content:center; margin-bottom:2px;">
              ${fbIcon} cantinebar &nbsp; ${igIcon} cantine_bar
            </div>
            <div class="cutout-credits" style="text-align:center;">
              Summer 2026 &nbsp;|&nbsp; Executive Chef - Michael Booth &nbsp;|&nbsp; General Manager - Jessica Kerlin
            </div>
          </div>
        </div>
      `;

    return `
      <div class="cutout-column">
        ${headerHtml}

        <div class="cutout-items-list">
          ${itemsHtml}
        </div>

        ${promoBoxHtml}

        ${footerHtml}
      </div>
    `;
  };

  const renderPage = (dataObj, isPage1 = true) => `
    <div class="cutout-page">
      ${renderSingleCutoutColumn(dataObj, isPage1)}
      ${renderSingleCutoutColumn(dataObj, isPage1)}
      ${renderSingleCutoutColumn(dataObj, isPage1)}
    </div>
  `;

  printArea.innerHTML = `
    <!-- PAGE 1: FOOD SPECIALS (FRONT WITH LOGOS + PROMOS) -->
    ${renderPage(foodData, true)}

    <!-- PAGE 2: DRINK SPECIALS (BACK WITHOUT LOGOS OR PROMO BOX) -->
    ${renderPage(drinkData, false)}
  `;
}

function waitForImagesToLoad(container, callback) {
  if (!container) {
    callback();
    return;
  }
  const images = Array.from(container.querySelectorAll('img'));
  if (images.length === 0) {
    callback();
    return;
  }

  let loadedCount = 0;
  const total = images.length;
  let doneCalled = false;

  const checkDone = () => {
    if (doneCalled) return;
    loadedCount++;
    if (loadedCount >= total) {
      doneCalled = true;
      setTimeout(callback, 100);
    }
  };

  const timeoutId = setTimeout(() => {
    if (!doneCalled) {
      doneCalled = true;
      callback();
    }
  }, 400);

  images.forEach(img => {
    if (img.complete && img.naturalWidth !== 0) {
      checkDone();
    } else {
      img.onload = () => { clearTimeout(timeoutId); checkDone(); };
      img.onerror = () => { clearTimeout(timeoutId); checkDone(); };
    }
  });
}

function generateDailySpecialsCutoutPrint(targetDayKey = null) {
  setDynamicPrintPageStyle('11in 8.5in landscape');
  const activeTab = targetDayKey || state.activeMenuSubTab || 'mon';
  if (activeTab === 'thu') {
    generateThursdayWineFlightPrint();
    return;
  }
  const dayKey = (activeTab === 'mon' || activeTab === 'tue' || activeTab === 'wed' || activeTab === 'weekend') ? activeTab : 'mon';
  saveDaily3ColumnChanges(dayKey, false);
  if (state.activeMenuSubTab === 'cutoutdrinks') {
    saveDaily3ColumnChanges('drinks', false);
  }

  const dsAll = getFiveDailySpecials();
  const foodDs = dsAll[dayKey] || defaultFiveDailySpecials.mon;
  const drinkDs = dsAll.drinks || defaultDrinkSpecials;
  
  renderCutoutPrintDOM(foodDs, drinkDs);

  const printArea = document.getElementById('print-area');
  waitForImagesToLoad(printArea, () => {
    window.print();
  });
}

function downloadDailySpecialsPDF(targetDayKey = null) {
  const activeTab = targetDayKey || state.activeMenuSubTab || 'mon';
  const dayKey = (activeTab === 'mon' || activeTab === 'tue' || activeTab === 'wed' || activeTab === 'weekend') ? activeTab : 'mon';
  saveDaily3ColumnChanges(dayKey, false);

  const dsAll = getFiveDailySpecials();
  const ds = dsAll[dayKey] || defaultFiveDailySpecials.mon;

  renderCutoutPrintDOM(ds);

  const printArea = document.getElementById('print-area');
  waitForImagesToLoad(printArea, () => {
    const opt = {
      margin: 0,
      filename: `Cantine_Specials_${dayKey}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: [11, 8.5], orientation: 'landscape' }
    };

    if (window.html2pdf) {
      window.html2pdf().set(opt).from(printArea).save();
    } else {
      window.print();
    }
  });
}



function openLogoUploadModal() {
  const modal = document.getElementById('modal-custom-logos');
  if (!modal) return;
  modal.style.display = 'block';

  const hPreview = document.getElementById('logo-header-preview');
  const bPreview = document.getElementById('logo-badge-preview');

  if (hPreview) {
    hPreview.innerHTML = (state.data && state.data.customHeaderLogoUrl)
      ? `<img src="${state.data.customHeaderLogoUrl}" style="max-height:60px; max-width:200px;">`
      : `<span style="color:#888; font-style:italic;">Default Text Logo Active</span>`;
  }
  if (bPreview) {
    bPreview.innerHTML = (state.data && state.data.customBadgeLogoUrl)
      ? `<img src="${state.data.customBadgeLogoUrl}" style="max-height:60px; max-width:200px;">`
      : `<span style="color:#888; font-style:italic;">Default Red Circle Badge Active</span>`;
  }
}

function uploadCustomLogo(type, event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    if (!state.data) state.data = {};

    if (type === 'header') {
      state.data.customHeaderLogoUrl = dataUrl;
    } else {
      state.data.customBadgeLogoUrl = dataUrl;
    }

    saveMasterData();
    openLogoUploadModal();
    alert('SUCCESS! Custom logo saved!');
  };
  reader.readAsDataURL(file);
}

function resetCustomLogos() {
  if (confirm('Reset custom logos to default vector logos?')) {
    if (state.data) {
      delete state.data.customHeaderLogoUrl;
      delete state.data.customBadgeLogoUrl;
    }
    saveMasterData();
    openLogoUploadModal();
    alert('Logos reset to default vector logos!');
  }
}

function generateThursdayWineFlightPrint() {
  saveThursdayFlightMatChanges();
  const dsAll = getFiveDailySpecials();
  const thu = dsAll.thu || defaultFiveDailySpecials.thu;
  const printArea = document.getElementById('print-area');
  if (!printArea) return;

  const renderSingleFlightHalf = () => {
    let circlesHtml = '';
    (thu.wines || []).forEach(w => {
      circlesHtml += `
        <div class="flight-circle-box">
          <div class="flight-circle">${w.num}</div>
          <div class="flight-wine-name">${escapeHTML(w.name)}</div>
        </div>
      `;
    });

    return `
      <div class="flight-mat-half">
        <div class="flight-circles-grid">
          ${circlesHtml}
        </div>
        <div class="flight-tapas-banner">
          ${escapeHTML(thu.tapas || 'SMOKED GOUDA MAC BITES WITH POMODORO')}
        </div>
      </div>
    `;
  };

  printArea.innerHTML = `
    <div class="flight-mat-page">
      ${renderSingleFlightHalf()}
      ${renderSingleFlightHalf()}
    </div>
  `;

  window.print();
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// MODULE 6: KITCHEN CLEANING TRACKER (WEEKLY MAINTENANCE LOG)
// -------------------------------------------------------------
const defaultCleaningData = {
  dailyDowntimeTasks: [
    { id: 'd1', name: 'Condense Cambros', desc: 'Combine half-empty cambros into smaller, clean containers. Re-label with current dates (FIFO).' },
    { id: 'd2', name: 'Flip & Consolidate', desc: 'Organize line lowboys and the walk-in. Flip pans, consolidate product, keep it tight.' },
    { id: 'd3', name: 'Gaskets & Handles', desc: 'Sani-wipe rubber gaskets, cooler/reach-in handles, and oven door handles.' },
    { id: 'd4', name: 'Dry Storage Wipe', desc: 'Dust/wipe bins on the rack, organize spice containers so labels face forward.' },
    { id: 'd5', name: 'Cutting Boards', desc: 'Scrub all poly boards (bleach solution or lemon/salt) to remove stains.' },
    { id: 'd6', name: 'Floors & Drains', desc: 'Sweep under lowboys and the main line. Scrub the floor drains.' },
    { id: 'd7', name: 'Stainless Polish', desc: 'Polish prep tables, pass-throughs, and hood exteriors.' }
  ],
  weeklyDeepCleanMatrix: {
    mon: { dayName: 'Monday', zone: 'Walk-in Cooler', tasks: 'Scrub floors, wipe down all wire shelving, toss expired product, organize produce/meat zones.' },
    tue: { dayName: 'Tuesday', zone: 'Dry Storage Rack', tasks: 'Pull everything off the main kitchen dry storage rack. Wipe shelves down. Sweep and mop thoroughly underneath.' },
    wed: { dayName: 'Wednesday', zone: 'Fryers & Fryer Rack', tasks: 'Boil out fryers, scrub baskets and exterior. Empty speed rack next to fryer, clean railings, replace sheet trays.' },
    thu: { dayName: 'Thursday', zone: 'Lowboys/Reach-ins', tasks: 'Empty all line coolers. Sanitize interior walls, bottoms, and tracks. Vacuum condenser coils.' },
    fri: { dayName: 'Friday', zone: 'Hot Wells & Gear', tasks: 'Empty, descale, and scrub hot wells and their racks. Deep detail meat slicer and food processors.' },
    sat: { dayName: 'Saturday', zone: 'Hoods & 2nd Fryer Boil', tasks: 'Boil out fryers. Run hood filters through the dish machine. Scrub interior hood canopy, empty grease traps.' },
    sun: { dayName: 'Sunday', zone: 'Station Shelves/Walls', tasks: 'Remove all items off line shelves. Clean shelf surfaces and railings. Scrub tile walls behind the hot line.' }
  },
  dailyCompletions: {},
  historyLog: []
};

function getCleaningData() {
  if (!state.data) state.data = {};
  if (!state.data.cleaning || typeof state.data.cleaning !== 'object') {
    state.data.cleaning = JSON.parse(JSON.stringify(defaultCleaningData));
  }
  if (!state.data.cleaning.dailyDowntimeTasks) {
    state.data.cleaning.dailyDowntimeTasks = JSON.parse(JSON.stringify(defaultCleaningData.dailyDowntimeTasks));
  }
  if (!state.data.cleaning.weeklyDeepCleanMatrix) {
    state.data.cleaning.weeklyDeepCleanMatrix = JSON.parse(JSON.stringify(defaultCleaningData.weeklyDeepCleanMatrix));
  }
  if (!state.data.cleaning.dailyCompletions) {
    state.data.cleaning.dailyCompletions = {};
  }
  if (!state.data.cleaning.historyLog) {
    state.data.cleaning.historyLog = [];
  }
  return state.data.cleaning;
}

function getTodayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayOfWeekKey() {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[new Date().getDay()];
}

function switchCleaningSubTab(tabName) {
  state.activeCleaningSubTab = tabName;
  document.querySelectorAll('#module-cleaning-sec .filter-pill').forEach(el => el.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-clean-tab-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  renderCleaningTracker();
}

function renderCleaningProgressHeader() {
  const progressContainer = document.getElementById('cleaning-progress-container');
  if (!progressContainer) return;

  const cd = getCleaningData();
  const todayKey = getTodayKey();
  const dayOfWeek = getDayOfWeekKey();
  const todayRecords = cd.dailyCompletions[todayKey] || {};

  const totalDaily = cd.dailyDowntimeTasks.length;
  let doneDaily = 0;
  cd.dailyDowntimeTasks.forEach(task => {
    if (todayRecords[task.id] && todayRecords[task.id].completed) doneDaily++;
  });

  const deepKey = `deep_${dayOfWeek}`;
  const deepDone = (todayRecords[deepKey] && todayRecords[deepKey].completed) ? 1 : 0;
  const totalTasks = totalDaily + 1;
  const doneTasks = doneDaily + deepDone;
  const pct = Math.round((doneTasks / totalTasks) * 100);

  const todayZoneName = cd.weeklyDeepCleanMatrix[dayOfWeek] ? cd.weeklyDeepCleanMatrix[dayOfWeek].zone : '';

  progressContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h3 style="margin:0; color:var(--accent-gold);">📅 Today's Shift Progress: <span style="color:#fff;">${doneTasks} of ${totalTasks} Tasks Completed (${pct}%)</span></h3>
        <div style="font-size:0.95rem; color:var(--text-muted); margin-top:4px;">
          Daily Busy Work: <strong style="color:var(--accent-green);">${doneDaily}/${totalDaily}</strong> | Today's Zone (${escapeHTML(todayZoneName)}): <strong style="color:${deepDone ? 'var(--accent-green)' : 'var(--accent-red)'}">${deepDone ? '✅ DONE' : '❌ PENDING'}</strong>
        </div>
      </div>
      <div style="text-align:right;">
        <span style="font-size:1.4rem; font-weight:bold; color:${pct === 100 ? 'var(--accent-green)' : 'var(--accent-orange)'};">${pct === 100 ? '🎉 Shift Clean Complete!' : pct + '% Ready'}</span>
      </div>
    </div>
    <div class="clean-progress-bar">
      <div class="clean-progress-fill" style="width: ${pct}%;"></div>
    </div>
  `;
}

function renderCleaningTracker() {
  const container = document.getElementById('cleaning-container');
  if (!container) return;

  renderCleaningProgressHeader();

  const activeTab = state.activeCleaningSubTab || 'today';

  if (activeTab === 'today') {
    renderTodayCleaning(container);
  } else if (activeTab === 'daily') {
    renderDailyDowntimeMatrix(container);
  } else if (activeTab === 'deep') {
    renderWeeklyDeepCleanMatrix(container);
  } else if (activeTab === 'history') {
    renderCleaningAuditLog(container);
  }
}

function renderTodayCleaning(container) {
  const cd = getCleaningData();
  const todayKey = getTodayKey();
  const dayOfWeek = getDayOfWeekKey();
  const todayRecords = cd.dailyCompletions[todayKey] || {};
  const deepInfo = cd.weeklyDeepCleanMatrix[dayOfWeek];

  let html = `
    <div style="margin-bottom:25px;">
      <h3 style="color:var(--accent-gold); border-bottom:2px solid var(--accent-gold); padding-bottom:8px; margin-top:0;">⭐ TODAY'S ASSIGNED DEEP CLEAN ZONE (${deepInfo.dayName.toUpperCase()})</h3>
  `;

  const deepTaskId = `deep_${dayOfWeek}`;
  const deepRecord = todayRecords[deepTaskId] || {};
  const isDeepDone = !!deepRecord.completed;
  const isChefVerified = !!deepRecord.chefVerified;

  html += `
    <div class="cleaning-card ${isDeepDone ? 'completed' : 'overdue'}">
      <div class="cleaning-header-row">
        <div>
          <div class="cleaning-task-name ${isDeepDone ? 'done' : ''}">
            <span>${isDeepDone ? '✅' : '🔴'} ${escapeHTML(deepInfo.zone)}</span>
            <span class="badge ${isDeepDone ? 'badge-in-stock' : 'badge-low'}">${isDeepDone ? 'COMPLETED' : 'DUE TODAY'}</span>
          </div>
          <div class="cleaning-desc">${escapeHTML(deepInfo.tasks)}</div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="btn ${isDeepDone ? 'btn-secondary' : 'btn-success'}" style="font-size:1.1rem; padding:10px 18px;" onclick="toggleCleaningTask('${deepTaskId}')">
            ${isDeepDone ? '↩️ Re-open Task' : '✓ Mark Complete'}
          </button>
          ${isDeepDone ? `
            <button class="chef-verify-btn ${isChefVerified ? 'verified' : ''}" onclick="verifyDeepCleanTask('${deepTaskId}')">
              ${isChefVerified ? '👨‍🍳 Chef Verified' : '👨‍🍳 Verify as Chef'}
            </button>
          ` : ''}
        </div>
      </div>
      ${isDeepDone ? `
        <div class="cleaning-meta-bar">
          <span class="staff-attribution-tag completed">Completed by ${escapeHTML(deepRecord.by || 'Staff')} on ${escapeHTML(deepRecord.time || '')}</span>
          ${isChefVerified ? `<span style="color:var(--accent-gold); font-weight:bold;">👨‍🍳 Verified ${deepRecord.verifiedBy ? 'by ' + escapeHTML(deepRecord.verifiedBy) : 'by Chef'}</span>` : '<span style="color:#888;">Pending Chef Verification</span>'}
        </div>
      ` : ''}
    </div>
  </div>

  <div>
    <h3 style="color:var(--accent-blue); border-bottom:2px solid var(--accent-blue); padding-bottom:8px;">📋 DAILY DOWNTIME "BUSY WORK" CHECKLIST (7 TASKS)</h3>
    <p style="color:var(--text-muted); font-size:1rem; margin-bottom:15px;">When your prep/line board is clear, complete these tasks and check them off.</p>
  `;

  cd.dailyDowntimeTasks.forEach((task, idx) => {
    const rec = todayRecords[task.id] || {};
    const isDone = !!rec.completed;

    html += `
      <div class="cleaning-card ${isDone ? 'completed' : ''}">
        <div class="cleaning-header-row">
          <div>
            <div class="cleaning-task-name ${isDone ? 'done' : ''}">
              <span>${isDone ? '✅' : '⚪'} ${idx + 1}. ${escapeHTML(task.name)}</span>
            </div>
            <div class="cleaning-desc">${escapeHTML(task.desc)}</div>
          </div>
          <div>
            <button class="btn ${isDone ? 'btn-secondary' : 'btn-success'}" style="padding:8px 16px; font-size:1rem;" onclick="toggleCleaningTask('${task.id}')">
              ${isDone ? '↩️ Undo' : '✓ Check Off'}
            </button>
          </div>
        </div>
        ${isDone ? `
          <div class="cleaning-meta-bar">
            <span class="staff-attribution-tag completed">Checked off by ${escapeHTML(rec.by || 'Staff')} at ${escapeHTML(rec.time || '')}</span>
          </div>
        ` : ''}
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderDailyDowntimeMatrix(container) {
  const cd = getCleaningData();
  let html = `
    <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border-color);">
      <h3 style="margin-top:0; color:var(--accent-gold);">📋 Daily Downtime "Busy Work" Tasks</h3>
      <p style="color:var(--text-muted); font-size:1.05rem; line-height:1.5;">
        Instructions for prep/line cooks: When your board is clear, complete these tasks and mark completed under the current day.
      </p>

      <div style="overflow-x:auto;">
        <table class="audit-table">
          <thead>
            <tr>
              <th style="width:30%;">Daily Downtime Task</th>
              <th style="width:50%;">Task Instructions</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
  `;

  const todayKey = getTodayKey();
  const todayRecords = cd.dailyCompletions[todayKey] || {};

  cd.dailyDowntimeTasks.forEach(task => {
    const rec = todayRecords[task.id] || {};
    const isDone = !!rec.completed;

    html += `
      <tr>
        <td style="font-weight:bold; color:var(--accent-blue);">
          ${isDone ? '✅' : '⚪'} ${escapeHTML(task.name)}
        </td>
        <td style="color:var(--text-muted);">${escapeHTML(task.desc)}</td>
        <td style="text-align:center;">
          <button class="btn ${isDone ? 'btn-secondary btn-sm' : 'btn-success btn-sm'}" onclick="toggleCleaningTask('${task.id}')">
            ${isDone ? `Done (${escapeHTML(rec.by || '')})` : 'Check Off'}
          </button>
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderWeeklyDeepCleanMatrix(container) {
  const cd = getCleaningData();
  const todayKey = getTodayKey();
  const todayRecords = cd.dailyCompletions[todayKey] || {};
  const currentDayOfWeek = getDayOfWeekKey();
  const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  let html = `
    <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border-color);">
      <h3 style="margin-top:0; color:var(--accent-gold);">🧼 Weekly Deep Clean Matrix (By Day of Week)</h3>
      <p style="color:var(--text-muted); font-size:1.05rem; line-height:1.5;">
        Instructions: The assigned zone must be completed by the end of the shift. Initial when finished. Chef will verify.
      </p>

      <div style="display:flex; flex-direction:column; gap:16px;">
  `;

  daysOrder.forEach(dayKey => {
    const info = cd.weeklyDeepCleanMatrix[dayKey];
    if (!info) return;

    const isToday = (dayKey === currentDayOfWeek);
    const deepTaskId = `deep_${dayKey}`;
    const rec = todayRecords[deepTaskId] || {};
    const isDone = !!rec.completed;
    const isVerified = !!rec.chefVerified;

    html += `
      <div class="cleaning-card ${isToday ? (isDone ? 'completed' : 'overdue') : (isDone ? 'completed' : '')}" style="${isToday ? 'border-width:3px;' : ''}">
        <div class="cleaning-header-row">
          <div>
            <div class="cleaning-task-name ${isDone ? 'done' : ''}">
              <span>${isDone ? '✅' : (isToday ? '🔴' : '📅')} ${info.dayName}: ${escapeHTML(info.zone)}</span>
              ${isToday ? '<span class="badge" style="background:#c85c33; color:#fff;">TODAY\'S ASSIGNED ZONE</span>' : ''}
            </div>
            <div class="cleaning-desc">${escapeHTML(info.tasks)}</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
            <button class="btn ${isDone ? 'btn-secondary' : 'btn-success'}" style="font-size:1rem; padding:8px 16px;" onclick="toggleCleaningTask('${deepTaskId}')">
              ${isDone ? '↩️ Re-open' : '✓ Complete Zone'}
            </button>
            ${isDone ? `
              <button class="chef-verify-btn ${isVerified ? 'verified' : ''}" onclick="verifyDeepCleanTask('${deepTaskId}')">
                ${isVerified ? '👨‍🍳 Verified' : '👨‍🍳 Verify as Chef'}
              </button>
            ` : ''}
          </div>
        </div>
        ${isDone ? `
          <div class="cleaning-meta-bar">
            <span class="staff-attribution-tag completed">Completed by ${escapeHTML(rec.by || 'Staff')} on ${escapeHTML(rec.time || '')}</span>
            ${isVerified ? `<span style="color:var(--accent-gold); font-weight:bold;">👨‍🍳 Verified ${rec.verifiedBy ? 'by ' + escapeHTML(rec.verifiedBy) : 'by Chef'}</span>` : '<span style="color:#888;">Pending Chef Verification</span>'}
          </div>
        ` : ''}
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderCleaningAuditLog(container) {
  const cd = getCleaningData();
  const history = cd.historyLog || [];

  let html = `
    <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border-color);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
        <h3 style="margin:0; color:var(--accent-gold);">📜 Cleaning Audit & Shift History Log</h3>
        <button class="btn btn-secondary btn-sm" onclick="exportCleaningLogCSV()">📥 Export Cleaning Log CSV</button>
      </div>
      <p style="color:var(--text-muted); font-size:1rem;">Real-time timestamped audit trail of completed downtime tasks and deep clean zones.</p>
  `;

  if (history.length === 0) {
    html += `<div style="text-align:center; color:#888; padding:30px; font-size:1.2rem;">No cleaning tasks recorded in log yet. Check off tasks under "Today's Shift Focus" to build log history!</div>`;
  } else {
    html += `
      <div style="overflow-x:auto;">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Task / Zone</th>
              <th>Type</th>
              <th>Completed By</th>
              <th>Chef Verification</th>
            </tr>
          </thead>
          <tbody>
    `;

    history.slice().reverse().forEach(log => {
      html += `
        <tr>
          <td style="color:var(--accent-blue); font-weight:bold;">${escapeHTML(log.time || log.date)}</td>
          <td style="font-weight:bold; color:#fff;">${escapeHTML(log.taskName)}</td>
          <td><span class="badge ${log.type === 'Deep Clean' ? 'badge-priority' : 'badge-par'}">${escapeHTML(log.type)}</span></td>
          <td style="color:var(--accent-green); font-weight:bold;">${escapeHTML(log.by)}</td>
          <td>${log.chefVerified ? `<span style="color:var(--accent-gold); font-weight:bold;">👨‍🍳 Verified ${log.verifiedBy ? 'by ' + escapeHTML(log.verifiedBy) : ''}</span>` : '<span style="color:#777;">-</span>'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// -------------------------------------------------------------
// CLEANING PIN MODAL & VERIFICATION LOGIC
// -------------------------------------------------------------
let cleaningPinContext = null;

function openCleaningPinModal(action, taskId) {
  cleaningPinContext = { action: action, taskId: taskId };
  
  const modal = document.getElementById('modal-cleaning-pin');
  const icon = document.getElementById('cleaning-pin-icon');
  const title = document.getElementById('cleaning-pin-title');
  const subtitle = document.getElementById('cleaning-pin-subtitle');
  const input = document.getElementById('cleaning-pin-input');
  const err = document.getElementById('cleaning-pin-error');

  if (!modal) return;

  input.value = '';
  if (err) err.textContent = '';

  if (action === 'chef_verify') {
    if (icon) icon.textContent = '👨‍🍳';
    if (title) title.textContent = 'Chef Authorization PIN';
    if (subtitle) subtitle.textContent = 'Enter a Chef or Manager PIN (e.g. 217 or 123) to verify task';
  } else {
    if (icon) icon.textContent = '🔑';
    if (title) title.textContent = 'Enter Staff PIN';
    if (subtitle) subtitle.textContent = 'Enter your staff PIN to log task completion under your name';
  }

  modal.style.display = 'block';
  setTimeout(() => { if (input) input.focus(); }, 100);
}

function cleaningPinAppend(digit) {
  const input = document.getElementById('cleaning-pin-input');
  const err = document.getElementById('cleaning-pin-error');
  if (err) err.textContent = '';
  if (input && input.value.length < 6) {
    input.value += digit;
  }
}

function cleaningPinClear() {
  const input = document.getElementById('cleaning-pin-input');
  const err = document.getElementById('cleaning-pin-error');
  if (err) err.textContent = '';
  if (input) {
    input.value = input.value.slice(0, -1);
  }
}

function handleCleaningPinKeyDown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitCleaningPin();
  }
}

function submitCleaningPin() {
  const input = document.getElementById('cleaning-pin-input');
  const err = document.getElementById('cleaning-pin-error');
  if (!input) return;

  const pin = input.value.trim();
  if (!pin) {
    if (err) err.textContent = 'Please enter your PIN.';
    return;
  }

  const staffList = (state.data && state.data.staff) ? state.data.staff : [];
  const foundStaff = staffList.find(s => String(s.pin).trim() === String(pin).trim() && s.active);

  if (!foundStaff) {
    if (err) err.textContent = '⚠️ Invalid PIN. Please try again.';
    input.value = '';
    input.focus();
    return;
  }

  if (!cleaningPinContext) return;

  const { action, taskId } = cleaningPinContext;

  if (action === 'complete_task') {
    executeToggleCleaningTask(taskId, foundStaff.name);
    closeModal('modal-cleaning-pin');
  } else if (action === 'chef_verify') {
    const isChefOrMgr = (
      foundStaff.role === 'head_chef' ||
      foundStaff.role === 'manager' ||
      foundStaff.role === 'chef' ||
      (foundStaff.name && foundStaff.name.toLowerCase().includes('chef'))
    );

    if (!isChefOrMgr) {
      if (err) err.textContent = `⚠️ Access Denied: PIN valid for ${foundStaff.name}, but Chef authorization is required!`;
      input.value = '';
      input.focus();
      return;
    }

    executeVerifyDeepCleanTask(taskId, foundStaff.name);
    closeModal('modal-cleaning-pin');
  }
}

function toggleCleaningTask(taskId) {
  const cd = getCleaningData();
  const todayKey = getTodayKey();
  const currentRec = (cd.dailyCompletions[todayKey]) ? cd.dailyCompletions[todayKey][taskId] : null;

  if (currentRec && currentRec.completed) {
    if (!cd.dailyCompletions[todayKey]) cd.dailyCompletions[todayKey] = {};
    delete cd.dailyCompletions[todayKey][taskId];
    saveMasterData();
    pushLiveSync();
    renderCleaningTracker();
  } else {
    openCleaningPinModal('complete_task', taskId);
  }
}

function executeToggleCleaningTask(taskId, staffName) {
  const cd = getCleaningData();
  const todayKey = getTodayKey();
  if (!cd.dailyCompletions[todayKey]) cd.dailyCompletions[todayKey] = {};

  let taskName = taskId;
  let type = 'Daily Downtime';

  if (taskId.startsWith('deep_')) {
    const dayKey = taskId.replace('deep_', '');
    const deepInfo = cd.weeklyDeepCleanMatrix[dayKey];
    taskName = deepInfo ? `${deepInfo.dayName} Deep Clean: ${deepInfo.zone}` : 'Weekly Deep Clean';
    type = 'Deep Clean';
  } else {
    const foundTask = cd.dailyDowntimeTasks.find(t => t.id === taskId);
    if (foundTask) taskName = foundTask.name;
  }

  const nowStr = new Date().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  cd.dailyCompletions[todayKey][taskId] = {
    completed: true,
    by: staffName,
    time: nowStr,
    chefVerified: false
  };

  cd.historyLog.push({
    date: todayKey,
    time: nowStr,
    taskName: taskName,
    type: type,
    by: staffName,
    chefVerified: false
  });

  saveMasterData();
  pushLiveSync();
  renderCleaningTracker();
}

function verifyDeepCleanTask(taskId) {
  const cd = getCleaningData();
  const todayKey = getTodayKey();
  if (!cd.dailyCompletions[todayKey] || !cd.dailyCompletions[todayKey][taskId]) return;

  openCleaningPinModal('chef_verify', taskId);
}

function executeVerifyDeepCleanTask(taskId, chefName) {
  const cd = getCleaningData();
  const todayKey = getTodayKey();
  if (!cd.dailyCompletions[todayKey] || !cd.dailyCompletions[todayKey][taskId]) return;

  const rec = cd.dailyCompletions[todayKey][taskId];
  rec.chefVerified = !rec.chefVerified;
  if (rec.chefVerified) {
    rec.verifiedBy = chefName;
  } else {
    delete rec.verifiedBy;
  }

  if (cd.historyLog && cd.historyLog.length > 0) {
    const lastLog = cd.historyLog.slice().reverse().find(l => l.taskName.includes('Deep Clean') && l.date === todayKey);
    if (lastLog) {
      lastLog.chefVerified = rec.chefVerified;
      if (rec.chefVerified) lastLog.verifiedBy = chefName;
      else delete lastLog.verifiedBy;
    }
  }

  saveMasterData();
  pushLiveSync();
  renderCleaningTracker();
}

function resetShiftCleaning() {
  if (confirm('Are you sure you want to reset today\'s shift cleaning checklist? Completed tasks for today will be cleared for a new shift.')) {
    const cd = getCleaningData();
    const todayKey = getTodayKey();
    delete cd.dailyCompletions[todayKey];
    saveMasterData();
    pushLiveSync();
    renderCleaningTracker();
    alert('Today\'s shift cleaning checklist reset!');
  }
}

function exportCleaningLogCSV() {
  const cd = getCleaningData();
  const history = cd.historyLog || [];
  if (history.length === 0) { alert('No cleaning history available to export.'); return; }

  let csvContent = 'Timestamp,Task Name,Type,Completed By,Chef Verified\n';
  history.forEach(l => {
    csvContent += `"${l.time || l.date}","${l.taskName}","${l.type}","${l.by}","${l.chefVerified ? 'YES' : 'NO'}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cantine_cleaning_log_${getTodayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// GLOBAL CLOCK & KITCHEN MULTI-TIMER SUITE (WITH AUDIO ALARM)
// -------------------------------------------------------------

let kitchenAudioCtx = null;
let activeKitchenAlarmInterval = null;
let kitchenTimers = [];

function loadSavedKitchenTimers() {
  const saved = localStorage.getItem('cantine_kitchen_timers');
  if (saved) {
    try {
      kitchenTimers = JSON.parse(saved);
    } catch (e) {}
  }
}

function saveSavedKitchenTimers() {
  localStorage.setItem('cantine_kitchen_timers', JSON.stringify(kitchenTimers));
}

function getKitchenAudioContext() {
  if (!kitchenAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      kitchenAudioCtx = new AudioContextClass();
    }
  }
  if (kitchenAudioCtx && kitchenAudioCtx.state === 'suspended') {
    kitchenAudioCtx.resume();
  }
  return kitchenAudioCtx;
}

function playKitchenAlarmTone() {
  try {
    const ctx = getKitchenAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Tone 1: 880Hz (A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: 1046.5Hz (C6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1046.5, now + 0.15);
    gain2.gain.setValueAtTime(0.5, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);

    // Tone 3: 1318.5Hz (E6 loud ping)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1318.5, now + 0.3);
    gain3.gain.setValueAtTime(0.5, now + 0.3);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.3);
    osc3.stop(now + 0.7);

  } catch (e) {
    console.warn('Web Audio alarm tone play warning:', e);
  }
}

function testKitchenAlarmSound() {
  getKitchenAudioContext();
  playKitchenAlarmTone();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function triggerKitchenAlarm(timerLabel) {
  const modal = document.getElementById('modal-timer-alarm');
  const labelEl = document.getElementById('alarm-timer-label');
  if (labelEl) labelEl.innerText = timerLabel || 'Kitchen Timer';
  if (modal) modal.style.display = 'block';

  testKitchenAlarmSound();
  if (activeKitchenAlarmInterval) clearInterval(activeKitchenAlarmInterval);
  activeKitchenAlarmInterval = setInterval(() => {
    playKitchenAlarmTone();
    if (navigator.vibrate) navigator.vibrate([400, 150, 400]);
  }, 1200);
}

function dismissKitchenAlarm() {
  if (activeKitchenAlarmInterval) {
    clearInterval(activeKitchenAlarmInterval);
    activeKitchenAlarmInterval = null;
  }
  const modal = document.getElementById('modal-timer-alarm');
  if (modal) modal.style.display = 'none';
}

function updateGlobalHeaderClock() {
  const clockEl = document.getElementById('header-clock-date-text');
  const badgeEl = document.getElementById('header-timer-badge');
  const dashDateEl = document.getElementById('dash-date-text');
  const now = new Date();

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const dayNum = now.getDate();
  
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const clockText = `${dayName}, ${monthName} ${dayNum} | ${hours}:${minutes}:${seconds} ${ampm}`;
  if (clockEl) clockEl.innerText = clockText;
  if (dashDateEl) dashDateEl.innerText = `Shift Overview for ${dayName}, ${monthName} ${dayNum}, ${now.getFullYear()}`;

  // Update active countdowns
  updateTimerCountdowns();
}

function updateTimerCountdowns() {
  if (!kitchenTimers || kitchenTimers.length === 0) {
    const badgeEl = document.getElementById('header-timer-badge');
    if (badgeEl) badgeEl.classList.add('hidden');
    return;
  }

  let runningCount = 0;
  let hasChanges = false;
  const nowMs = Date.now();

  kitchenTimers.forEach(t => {
    if (t.status === 'running') {
      runningCount++;
      const rem = Math.max(0, Math.round((t.endTime - nowMs) / 1000));
      if (rem !== t.remSec) {
        t.remSec = rem;
        hasChanges = true;
      }
      if (t.remSec <= 0) {
        t.status = 'expired';
        hasChanges = true;
        triggerKitchenAlarm(t.label);
      }
    }
  });

  const badgeEl = document.getElementById('header-timer-badge');
  if (badgeEl) {
    if (runningCount > 0) {
      badgeEl.innerText = `${runningCount} ⏱️`;
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }
  }

  const modal = document.getElementById('modal-kitchen-timers');
  if (modal && modal.style.display === 'block') {
    renderActiveTimersList();
  }

  if (hasChanges) {
    saveSavedKitchenTimers();
  }
}

function openKitchenTimersModal() {
  getKitchenAudioContext();
  loadSavedKitchenTimers();
  renderActiveTimersList();
  const modal = document.getElementById('modal-kitchen-timers');
  if (modal) modal.style.display = 'block';
}

function formatTimerDigits(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderActiveTimersList() {
  const container = document.getElementById('active-timers-container');
  if (!container) return;

  if (kitchenTimers.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#888; padding:20px; font-size:1rem;">No timers currently running. Tap a quick preset above to start one!</div>`;
    return;
  }

  let html = '';
  kitchenTimers.forEach(t => {
    const isRunning = t.status === 'running';
    const isExpired = t.status === 'expired';
    const pct = t.totalSec > 0 ? Math.min(100, Math.max(0, (t.remSec / t.totalSec) * 100)) : 0;

    let borderCol = '#444';
    if (isExpired) borderCol = 'var(--accent-red)';
    else if (isRunning) borderCol = 'var(--accent-gold)';

    html += `
      <div style="background:#222; border:2px solid ${borderCol}; border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:bold; font-size:1.1rem; color:${isExpired ? 'var(--accent-red)' : 'var(--accent-gold)'};">
            ${isExpired ? '🚨 ALARM: ' : ''}${escapeHTML(t.label)}
          </span>
          <span style="font-size:1.8rem; font-weight:900; font-family:monospace; color:${isExpired ? 'var(--accent-red)' : '#fff'};">
            ${formatTimerDigits(t.remSec)}
          </span>
        </div>

        <!-- PROGRESS BAR -->
        <div style="background:#333; height:8px; border-radius:4px; overflow:hidden; width:100%;">
          <div style="background:${isExpired ? 'var(--accent-red)' : 'var(--accent-gold)'}; height:100%; width:${pct}%; transition:width 1s linear;"></div>
        </div>

        <!-- CONTROLS -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <div style="display:flex; gap:6px;">
            ${isRunning ? `
              <button class="btn btn-secondary btn-sm" onclick="pauseKitchenTimer('${t.id}')">⏸️ Pause</button>
            ` : `
              <button class="btn btn-success btn-sm" onclick="resumeKitchenTimer('${t.id}')">▶️ Start</button>
            `}
            <button class="btn btn-secondary btn-sm" onclick="addMinutesToKitchenTimer('${t.id}', 1)">+1 Min</button>
            <button class="btn btn-secondary btn-sm" onclick="addMinutesToKitchenTimer('${t.id}', 5)">+5 Min</button>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteKitchenTimer('${t.id}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function addQuickKitchenTimer(label, minutes) {
  getKitchenAudioContext();
  loadSavedKitchenTimers();
  const sec = minutes * 60;
  const newTimer = {
    id: 'timer_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    label: label,
    totalSec: sec,
    remSec: sec,
    endTime: Date.now() + (sec * 1000),
    status: 'running'
  };
  kitchenTimers.push(newTimer);
  saveSavedKitchenTimers();
  renderActiveTimersList();
  updateGlobalHeaderClock();
}

function createCustomKitchenTimer() {
  getKitchenAudioContext();
  const nameEl = document.getElementById('custom-timer-name');
  const minEl = document.getElementById('custom-timer-min');
  const secEl = document.getElementById('custom-timer-sec');

  const label = (nameEl?.value.trim()) || 'Custom Kitchen Timer';
  const mins = parseInt(minEl?.value || '0', 10) || 0;
  const secs = parseInt(secEl?.value || '0', 10) || 0;

  const totalSec = (mins * 60) + secs;
  if (totalSec <= 0) {
    alert('Please enter a valid time (minutes or seconds).');
    return;
  }

  loadSavedKitchenTimers();
  const newTimer = {
    id: 'timer_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    label: label,
    totalSec: totalSec,
    remSec: totalSec,
    endTime: Date.now() + (totalSec * 1000),
    status: 'running'
  };

  kitchenTimers.push(newTimer);
  saveSavedKitchenTimers();

  if (nameEl) nameEl.value = '';
  if (minEl) minEl.value = '';
  if (secEl) secEl.value = '';

  renderActiveTimersList();
  updateGlobalHeaderClock();
}

function pauseKitchenTimer(id) {
  loadSavedKitchenTimers();
  const t = kitchenTimers.find(x => x.id === id);
  if (t && t.status === 'running') {
    t.status = 'paused';
    saveSavedKitchenTimers();
    renderActiveTimersList();
  }
}

function resumeKitchenTimer(id) {
  getKitchenAudioContext();
  loadSavedKitchenTimers();
  const t = kitchenTimers.find(x => x.id === id);
  if (t) {
    t.endTime = Date.now() + (t.remSec * 1000);
    t.status = 'running';
    saveSavedKitchenTimers();
    renderActiveTimersList();
  }
}

function addMinutesToKitchenTimer(id, mins) {
  loadSavedKitchenTimers();
  const t = kitchenTimers.find(x => x.id === id);
  if (t) {
    const addSec = mins * 60;
    t.totalSec += addSec;
    t.remSec += addSec;
    if (t.status === 'running') {
      t.endTime += (addSec * 1000);
    }
    if (t.status === 'expired') {
      t.status = 'running';
      t.endTime = Date.now() + (t.remSec * 1000);
    }
    saveSavedKitchenTimers();
    renderActiveTimersList();
  }
}

function deleteKitchenTimer(id) {
  loadSavedKitchenTimers();
  kitchenTimers = kitchenTimers.filter(x => x.id !== id);
  saveSavedKitchenTimers();
  renderActiveTimersList();
  updateGlobalHeaderClock();
}

function clearAllKitchenTimers() {
  if (confirm('Clear all kitchen timers?')) {
    kitchenTimers = [];
    saveSavedKitchenTimers();
    renderActiveTimersList();
    updateGlobalHeaderClock();
  }
}

