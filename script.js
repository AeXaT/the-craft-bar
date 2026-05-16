/* ============================================================
   The Craft Bar — Main Script (Firebase Edition)
   ============================================================ */

const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

/* ── Firebase config ──────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyD7SDvMk_S2hxLLtIIyIkigTqv3Jz4frCg",
  authDomain:        "the-craft-bar.firebaseapp.com",
  projectId:         "the-craft-bar",
  storageBucket:     "the-craft-bar.firebasestorage.app",
  messagingSenderId: "207254099624",
  appId:             "1:207254099624:web:54c6940899d51fdc94d49d"
};

firebase.initializeApp(firebaseConfig);
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

/* ── Password eye toggle ──────────────────────────────────── */
function toggleEye(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.style.opacity = isHidden ? '1' : '0.4';
}

/* ── Auth helpers ─────────────────────────────────────────── */
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('craftbar_user') || 'null');
}
function isLoggedIn() { return !!getCurrentUser(); }

function updateNavAuth() {
  const user     = getCurrentUser();
  const authLink = document.getElementById('authNavLink');
  const favBtn   = document.getElementById('favNavBtn');
  if (!authLink) return;
  if (user) {
    authLink.textContent = 'Profile';
    authLink.href = './profile.html';
  } else {
    authLink.textContent = 'Login';
    authLink.href = './auth.html';
  }
  if (favBtn) favBtn.style.display = user ? 'flex' : 'none';
}

/* ── Firebase Auth calls ──────────────────────────────────── */
async function fbRegister(email, password, profileData) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  const uid  = cred.user.uid;
  await db.collection('users').doc(uid).set({
    ...profileData,
    email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, uid };
}

async function fbLogin(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const uid  = cred.user.uid;
  const doc  = await db.collection('users').doc(uid).get();
  const data = doc.exists ? doc.data() : {};
  return { ok: true, uid, data: { ...data, email } };
}

async function fbLogout() {
  await auth.signOut();
  localStorage.removeItem('craftbar_user');
  showToast('Logged out. See you soon!');
  setTimeout(() => window.location.href = './index.html', 900);
}

async function fbUpdateProfile(uid, data) {
  await db.collection('users').doc(uid).update(data);
  return { ok: true };
}

async function fbChangePassword(newPassword) {
  await auth.currentUser.updatePassword(newPassword);
  return { ok: true };
}

async function fbSendPasswordReset(email) {
  await auth.sendPasswordResetEmail(email);
  return { ok: true };
}

async function fbUploadAvatar(uid, file) {
  const ref      = storage.ref('avatars/' + uid);
  const snapshot = await ref.put(file);
  const url      = await snapshot.ref.getDownloadURL();
  return url;
}

function doLogout() { fbLogout(); }

/* ── Favourites ───────────────────────────────────────────── */
function getFavKey() {
  const u = getCurrentUser();
  return u ? 'craftbar_favs_' + (u.uid || u.email || 'guest') : 'craftbar_favs_guest';
}
function getFavourites()   { return JSON.parse(localStorage.getItem(getFavKey()) || '[]'); }
function saveFavourites(f) { localStorage.setItem(getFavKey(), JSON.stringify(f)); }
function isFavourite(id)   { return getFavourites().some(f => f.idDrink === id); }

async function syncFavsToFirestore() {
  const user = getCurrentUser();
  if (!user || !user.uid) return;
  try { await db.collection('users').doc(user.uid).update({ favourites: getFavourites() }); } catch(e) {}
}

async function loadFavsFromFirestore() {
  const user = getCurrentUser();
  if (!user || !user.uid) return;
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().favourites) saveFavourites(doc.data().favourites);
  } catch(e) {}
}

function toggleFavourite(e, drink) {
  e.stopPropagation();
  if (!isLoggedIn()) { showToast('Please login to save favourites!', 'warning'); return; }
  let favs = getFavourites();
  const idx = favs.findIndex(f => f.idDrink === drink.idDrink);
  if (idx === -1) { favs.push(drink); showToast(drink.strDrink + ' added to favourites!'); }
  else            { favs.splice(idx, 1); showToast(drink.strDrink + ' removed from favourites'); }
  saveFavourites(favs);
  syncFavsToFirestore();
  renderFavDrawer();
  refreshHearts();
}

function renderFavDrawer() {
  const list  = document.getElementById('favList');
  const count = document.getElementById('favCount');
  if (!list) return;
  const favs = getFavourites();
  if (count) count.textContent = favs.length || '';
  if (!favs.length) {
    list.innerHTML = '<p class="fav-empty">No favourites yet.<br>Click the heart on any cocktail!</p>';
    return;
  }
  list.innerHTML = favs.map(f =>
    '<div class="fav-item" style="cursor:pointer;" onclick="toggleFavDrawer();openDetailModal(\'' + f.idDrink + '\')">' +
    '<img src="' + (f.strDrinkThumb ? f.strDrinkThumb + '/preview' : '') + '" alt="' + f.strDrink + '" />' +
    '<div class="fav-item-info"><span>' + f.strDrink + '</span><small>' + (f.strCategory || '') + '</small></div>' +
    '<button class="fav-remove" onclick="event.stopPropagation();removeFav(\'' + f.idDrink + '\')">✕</button>' +
    '</div>'
  ).join('');
}

function removeFav(id) {
  saveFavourites(getFavourites().filter(f => f.idDrink !== id));
  syncFavsToFirestore();
  renderFavDrawer();
  refreshHearts();
  if (document.getElementById('profileFavGrid')) renderProfileFavourites();
}

function refreshHearts() {
  document.querySelectorAll('.heart-btn').forEach(btn => {
    const active = isFavourite(btn.dataset.id);
    btn.classList.toggle('active', active);
    btn.textContent = active ? '❤️' : '🤍';
  });
}

function toggleFavDrawer() {
  document.getElementById('favDrawer') && document.getElementById('favDrawer').classList.toggle('open');
}

/* ── Welcome email ────────────────────────────────────────── */
function sendWelcomeEmail(firstName, lastName, email) {
  const doSend = function() {
    if (typeof emailjs === 'undefined') { setTimeout(doSend, 500); return; }
    emailjs.send('craft_bar', 'template_ebktx7v', {
      user_name: firstName + ' ' + lastName,
      user_email: email,
      to_email: email,
      name: firstName + ' ' + lastName
    }).then(function() { console.log('Welcome email sent'); })
      .catch(function(err) { console.warn('EmailJS error:', err); });
  };
  setTimeout(doSend, 300);
}

/* ── Ingredients helper ───────────────────────────────────── */
function getIngredients(drink) {
  const list = [];
  for (let i = 1; i <= 15; i++) {
    const name    = drink['strIngredient' + i];
    const measure = drink['strMeasure'    + i];
    if (name && name.trim()) list.push({ name: name.trim(), measure: measure ? measure.trim() : '' });
  }
  return list;
}

/* ── Cocktail API ─────────────────────────────────────────── */
async function fetchAllDrinks() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const results = await Promise.all(
    letters.map(l => fetch(API_BASE + '/search.php?s=' + l).then(r => r.json()).catch(() => ({ drinks: [] })))
  );
  const seen = new Set(), drinks = [];
  for (const data of results)
    for (const d of (data.drinks || []))
      if (!seen.has(d.idDrink)) { seen.add(d.idDrink); drinks.push(d); }
  return drinks;
}

async function fetchCategories() {
  const res  = await fetch(API_BASE + '/list.php?c=list');
  const data = await res.json();
  return (data.drinks || []).map(d => d.strCategory);
}

async function fetchDrinkById(id) {
  const res  = await fetch(API_BASE + '/lookup.php?i=' + id);
  const data = await res.json();
  return data.drinks ? data.drinks[0] : null;
}

/* ── Detail popup ─────────────────────────────────────────── */
async function openDetailModal(id) {
  const overlay = document.getElementById('detailOverlay');
  const body    = document.getElementById('detailBody');
  if (!overlay || !body) return;
  overlay.style.display = 'flex';
  body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;padding:80px;gap:16px;flex-direction:column;opacity:0.7;width:100%;"><div class="loader-spinner"></div><p>Loading recipe...</p></div>';

  const drink = await fetchDrinkById(id);
  if (!drink) {
    body.innerHTML = '<p style="padding:40px;opacity:0.5;text-align:center;width:100%;">Could not load recipe.</p>';
    return;
  }

  const ings = getIngredients(drink);
  const img  = drink.strDrinkThumb || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500';

  let badgesHtml = '';
  if (drink.strCategory)  badgesHtml += '<span class="card-tag">' + drink.strCategory + '</span>';
  if (drink.strAlcoholic) badgesHtml += '<span class="card-tag">' + drink.strAlcoholic + '</span>';
  if (drink.strGlass)     badgesHtml += '<span class="card-tag">🥃 ' + drink.strGlass + '</span>';

  let ingsHtml = '';
  if (ings.length) {
    ingsHtml = '<div class="detail-section"><h4>Ingredients</h4><div class="detail-ingredients">' +
      ings.map(i => '<div class="detail-ingredient"><span class="detail-ing-name">' + i.name + '</span>' +
        (i.measure ? '<span class="detail-ing-measure">' + i.measure + '</span>' : '') + '</div>').join('') +
      '</div></div>';
  }

  let instrHtml = '';
  if (drink.strInstructions) {
    instrHtml = '<div class="detail-section"><h4>Instructions</h4><p class="detail-instructions">' + drink.strInstructions + '</p></div>';
  }

  body.innerHTML =
    '<div class="detail-img-wrap"><img src="' + img + '" alt="' + drink.strDrink + '" />' +
    '<div class="detail-img-gradient"></div><div class="detail-badges">' + badgesHtml + '</div></div>' +
    '<div class="detail-info"><h2 class="detail-title">' + drink.strDrink + '</h2>' + ingsHtml + instrHtml + '</div>';
}

function closeDetailModal() {
  const overlay = document.getElementById('detailOverlay');
  if (overlay) { overlay.style.display = 'none'; overlay.classList.remove('open'); }
}

/* ── Build card ───────────────────────────────────────────── */
function buildCard(drink) {
  const fav  = isFavourite(drink.idDrink);
  const img  = drink.strDrinkThumb || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400';
  const ings = getIngredients(drink);

  let ingTagsHtml = '';
  if (ings.length) {
    ingTagsHtml = '<div class="card-ingredients">' +
      ings.slice(0, 5).map(i => '<span class="card-ing-tag">' + i.name + '</span>').join('') +
      (ings.length > 5 ? '<span class="card-ing-tag card-ing-more">+' + (ings.length - 5) + '</span>' : '') +
      '</div>';
  }

  const minDrink = JSON.stringify({
    idDrink: drink.idDrink, strDrink: drink.strDrink,
    strDrinkThumb: drink.strDrinkThumb, strCategory: drink.strCategory
  }).replace(/"/g, '&quot;');

  return '<div class="card" onclick="openDetailModal(\'' + drink.idDrink + '\')">' +
    '<div class="card-img-wrap"><img src="' + img + '" alt="' + drink.strDrink + '" loading="lazy" />' +
    '<button class="heart-btn ' + (fav ? 'active' : '') + '" data-id="' + drink.idDrink + '" data-drink="' + minDrink + '" onclick="toggleFavourite(event, JSON.parse(this.dataset.drink))">' +
    (fav ? '❤️' : '🤍') + '</button></div>' +
    '<div class="card-body"><h3>' + drink.strDrink + '</h3>' + ingTagsHtml +
    '<span class="card-tag">' + (drink.strCategory || drink.strAlcoholic || '') + '</span></div></div>';
}

/* ── Toast ────────────────────────────────────────────────── */
function showToast(msg, type) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'show' + (type === 'warning' ? ' warning' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.className = ''; }, 3000);
}

/* ── Cocktails page ───────────────────────────────────────── */
let allDrinks = [], activeCategory = '', activeIngredient = '';

async function initCocktailsPage() {
  updateNavAuth();
  renderFavDrawer();
  const grid   = document.getElementById('cocktailGrid');
  const loader = document.getElementById('loader');
  if (!grid) return;

  const catSelect = document.getElementById('categoryFilter');
  if (catSelect) {
    const cats = await fetchCategories();
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; catSelect.appendChild(o); });
    catSelect.addEventListener('change', function() { activeCategory = catSelect.value; applyFilters(); });
  }

  if (loader) loader.style.display = 'flex';
  allDrinks = await fetchAllDrinks();
  if (loader) loader.style.display = 'none';

  const ingSelect = document.getElementById('ingredientFilter');
  if (ingSelect) {
    const ingMap = new Map();
    allDrinks.forEach(d => {
      for (let i = 1; i <= 15; i++) {
        const name = d['strIngredient' + i];
        if (name && name.trim()) {
          const key = name.trim().toLowerCase();
          if (!ingMap.has(key)) ingMap.set(key, name.trim().charAt(0).toUpperCase() + name.trim().slice(1));
        }
      }
    });
    ingSelect.innerHTML = '<option value="">All Ingredients</option>';
    Array.from(ingMap.values()).sort(function(a,b){ return a.localeCompare(b); }).forEach(function(ing) {
      const o = document.createElement('option'); o.value = ing; o.textContent = ing; ingSelect.appendChild(o);
    });
    ingSelect.addEventListener('change', function() { activeIngredient = ingSelect.value; applyFilters(); });
  }
  renderGrid(allDrinks);
}

function renderGrid(drinks) {
  const grid = document.getElementById('cocktailGrid');
  if (!grid) return;
  grid.innerHTML = drinks.length ? drinks.map(buildCard).join('') : '<p class="no-results">No cocktails found.</p>';
}

function applyFilters() {
  const searchVal = ((document.getElementById('searchInput') && document.getElementById('searchInput').value) || '').toLowerCase().trim();
  let drinks = allDrinks.slice();
  if (activeCategory)   drinks = drinks.filter(function(d) { return d.strCategory === activeCategory; });
  if (activeIngredient) {
    const ing = activeIngredient.toLowerCase();
    drinks = drinks.filter(function(d) {
      for (let i = 1; i <= 15; i++) { const n = d['strIngredient'+i]; if (n && n.trim().toLowerCase() === ing) return true; }
      return false;
    });
  }
  if (searchVal) drinks = drinks.filter(function(d) { return (d.strDrink||'').toLowerCase().includes(searchVal); });
  renderGrid(drinks);
}

function searchCocktails() { applyFilters(); }

/* ── Featured cocktails ───────────────────────────────────── */
async function initFeaturedCocktails() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;display:flex;justify-content:center;align-items:center;gap:16px;padding:40px;opacity:0.7;flex-direction:column;"><div class="loader-spinner"></div><p>Loading...</p></div>';
  const names  = ['Old Fashioned', 'Negroni', 'Margarita'];
  const drinks = (await Promise.all(
    names.map(n => fetch(API_BASE + '/search.php?s=' + encodeURIComponent(n)).then(r => r.json()).then(d => d.drinks ? d.drinks[0] : null))
  )).filter(Boolean);
  grid.innerHTML = drinks.map(function(drink) {
    const ings    = getIngredients(drink);
    const ingTags = ings.slice(0, 4).map(i => '<span class="card-ing-tag">' + i.name + '</span>').join('');
    return '<div class="card" onclick="openDetailModal(\'' + drink.idDrink + '\')">' +
      '<div class="card-img-wrap"><img src="' + drink.strDrinkThumb + '" alt="' + drink.strDrink + '" loading="lazy" /></div>' +
      '<div class="card-body"><h3>' + drink.strDrink + '</h3><div class="card-ingredients">' + ingTags + '</div>' +
      '<span class="card-tag">' + (drink.strCategory || '') + '</span></div></div>';
  }).join('');
}

/* ── Profile page ─────────────────────────────────────────── */
function previewAvatar(url) {
  const img = document.getElementById('avatarPreview');
  if (!img || !url || !url.startsWith('http')) return;
  img.src = url;
  img.onerror = function() { img.src = 'https://ui-avatars.com/api/?background=d4a043&color=1a1008&name=User'; };
}

function renderProfileFavourites() {
  const grid = document.getElementById('profileFavGrid');
  if (!grid) return;
  const favs = getFavourites();
  if (!favs.length) {
    grid.innerHTML = '<div class="fav-empty">No favourites yet.<br>Browse <a href="./cocktails.html" style="color:#d4a043;">cocktails</a> and click ❤️</div>';
    return;
  }
  grid.innerHTML = favs.map(function(f) {
    return '<div class="fav-card">' +
      '<div class="fav-thumb" onclick="openDetailModal(\'' + f.idDrink + '\')">' +
      '<img src="' + (f.strDrinkThumb || '') + '" alt="' + f.strDrink + '" /></div>' +
      '<div class="fav-body"><h4>' + f.strDrink + '</h4><small>' + (f.strCategory || '') + '</small>' +
      '<button class="fav-rm" onclick="removeFav(\'' + f.idDrink + '\')">🗑 Remove from favourites</button></div></div>';
  }).join('');
}

async function initProfilePage() {
  if (!isLoggedIn()) { window.location.href = './auth.html'; return; }

  await loadFavsFromFirestore();

  const user = getCurrentUser();
  const defaultAvatar = 'https://ui-avatars.com/api/?background=d4a043&color=1a1008&name=' +
    encodeURIComponent((user.firstName || 'U') + '+' + (user.lastName || ''));

  document.getElementById('sidebarName').textContent  = (user.firstName || '') + ' ' + (user.lastName || '');
  document.getElementById('sidebarEmail').textContent = user.email || '';
  document.getElementById('sidebarAvatar').src        = user.avatar || defaultAvatar;
  document.getElementById('infoFirstName').value = user.firstName || '';
  document.getElementById('infoLastName').value  = user.lastName  || '';
  document.getElementById('infoAge').value       = user.age       || '';
  document.getElementById('infoGender').value    = user.gender    || 'MALE';
  document.getElementById('infoEmail').value     = user.email     || '';
  document.getElementById('infoAddress').value   = user.address   || '';
  document.getElementById('infoPhone').value     = user.phone     || '';
  document.getElementById('infoZipcode').value   = user.zipcode   || '';
  document.getElementById('infoAvatar').value    = user.avatar    || '';
  if (user.avatar) document.getElementById('avatarPreview').src = user.avatar;

  document.querySelectorAll('.snav[data-panel]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.snav').forEach(function(b) { b.classList.remove('on'); });
      btn.classList.add('on');
      document.querySelectorAll('.pnl').forEach(function(p) { p.classList.remove('on'); });
      document.getElementById(btn.dataset.panel).classList.add('on');
      if (btn.dataset.panel === 'panelFavourites') renderProfileFavourites();
    });
  });

  renderProfileFavourites();

  /* Avatar file upload */
  const avatarFileInput = document.getElementById('avatarFileInput');
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', function() {
      if (!this.files || !this.files[0]) return;
      const file = this.files[0];
      document.getElementById('avatarPreview').src = URL.createObjectURL(file);
      avatarFileInput._pendingFile = file;
      document.getElementById('infoAvatar').value = '';
      document.getElementById('infoAvatar').placeholder = file.name + ' selected';
    });
  }

  /* Update info form */
  document.getElementById('infoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const msg = document.getElementById('infoMsg');
    const btn = document.getElementById('infoBtn');
    msg.className = 'msg';
    btn.disabled = true; btn.textContent = 'Saving...';

    const firstName = document.getElementById('infoFirstName').value.trim();
    const lastName  = document.getElementById('infoLastName').value.trim();
    const user      = getCurrentUser();

    try {
      let avatarUrl = user.avatar || '';
      const pendingFile = document.getElementById('avatarFileInput') && document.getElementById('avatarFileInput')._pendingFile;
      if (pendingFile) {
        btn.textContent = 'Uploading photo...';
        avatarUrl = await fbUploadAvatar(user.uid, pendingFile);
        document.getElementById('avatarFileInput')._pendingFile = null;
      } else {
        const urlVal = document.getElementById('infoAvatar').value.trim();
        if (urlVal && urlVal.startsWith('http')) avatarUrl = urlVal;
      }

      const updateData = {
        firstName, lastName,
        age:     parseInt(document.getElementById('infoAge').value) || 0,
        gender:  document.getElementById('infoGender').value,
        email:   document.getElementById('infoEmail').value.trim(),
        address: document.getElementById('infoAddress').value.trim(),
        phone:   document.getElementById('infoPhone').value.trim(),
        zipcode: document.getElementById('infoZipcode').value.trim(),
        avatar:  avatarUrl || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(firstName + '+' + lastName) + '&background=d4a043&color=1a1008'),
      };

      await fbUpdateProfile(user.uid, updateData);
      const stored = Object.assign({}, user, updateData);
      localStorage.setItem('craftbar_user', JSON.stringify(stored));

      document.getElementById('sidebarName').textContent = firstName + ' ' + lastName;
      document.getElementById('sidebarAvatar').src       = updateData.avatar;
      document.getElementById('avatarPreview').src       = updateData.avatar;

      btn.disabled = false; btn.textContent = 'Save Changes';
      msg.textContent = 'Profile updated successfully!';
      msg.className = 'msg ok';
    } catch(err) {
      btn.disabled = false; btn.textContent = 'Save Changes';
      msg.textContent = 'Error: ' + (err.message || 'Please try again.');
      msg.className = 'msg err';
    }
  });

  /* Change password */
  document.getElementById('passForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const msg = document.getElementById('passMsg');
    const btn = document.getElementById('passBtn');
    const np  = document.getElementById('newPass').value;
    const cp  = document.getElementById('confirmPass').value;
    msg.className = 'msg';

    if (np !== cp) { msg.textContent = 'New passwords do not match.'; msg.className = 'msg err'; return; }

    btn.disabled = true; btn.textContent = 'Updating...';
    try {
      const user = getCurrentUser();
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, document.getElementById('currentPass').value);
      await auth.currentUser.reauthenticateWithCredential(cred);
      await fbChangePassword(np);
      document.getElementById('passForm').reset();
      msg.textContent = 'Password changed successfully!';
      msg.className = 'msg ok';
    } catch(err) {
      msg.textContent = err.code === 'auth/wrong-password' ? 'Current password is incorrect.' : 'Error: ' + (err.message || 'Please try again.');
      msg.className = 'msg err';
    }
    btn.disabled = false; btn.textContent = 'Update Password';
  });
}

/* ── Forgot Password ──────────────────────────────────────── */
function showForgotPassword() {
  document.querySelectorAll('.auth-panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('forgotPanel').classList.add('active');
  document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
}

function hideForgotPassword() {
  document.querySelectorAll('.auth-panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('loginPanel').classList.add('active');
  document.querySelector('[data-panel="loginPanel"]').classList.add('active');
}

/* ── Auth page ────────────────────────────────────────────── */
function initAuthPage() {
  if (isLoggedIn()) { window.location.href = './profile.html'; return; }

  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      document.querySelectorAll('.auth-panel').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById(tab.dataset.panel).classList.add('active');
    });
  });

  /* Register */
  var regForm = document.getElementById('registerForm');
  if (regForm) regForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const errBox = document.getElementById('registerError');
    const btn    = document.getElementById('registerBtn');
    errBox.classList.remove('visible');
    btn.disabled = true; btn.textContent = 'Creating account...';

    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName  = document.getElementById('regLastName').value.trim();
    const age       = parseInt(document.getElementById('regAge').value);
    const gender    = document.getElementById('regGender').value;
    const email     = document.getElementById('regEmail').value.trim();
    const password  = document.getElementById('regPass').value;
    const address   = document.getElementById('regAddress').value.trim();
    const phone     = document.getElementById('regPhone').value.trim();
    const zipcode   = document.getElementById('regZipcode').value.trim();
    const avatarVal = document.getElementById('regAvatar').value.trim();
    const avatar    = avatarVal || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(firstName + '+' + lastName) + '&background=d4a043&color=1a1008';

    try {
      const result = await fbRegister(email, password, { firstName, lastName, age, gender, address, phone, zipcode, avatar });
      localStorage.setItem('craftbar_user', JSON.stringify({ uid: result.uid, firstName, lastName, email, age, gender, address, phone, zipcode, avatar }));
      sendWelcomeEmail(firstName, lastName, email);
      showToast('Welcome to The Craft Bar, ' + firstName + '!');
      setTimeout(function() { window.location.href = './index.html'; }, 1000);
    } catch(err) {
      btn.disabled = false; btn.textContent = 'Create Account';
      var msg = 'Something went wrong. Please try again.';
      if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered. Please login.';
      if (err.code === 'auth/weak-password')         msg = 'Password too weak. Use at least 6 characters.';
      if (err.code === 'auth/invalid-email')          msg = 'Invalid email address.';
      errBox.innerHTML = msg;
      errBox.classList.add('visible');
    }
  });

  /* Forgot password */
  var forgotForm = document.getElementById('forgotForm');
  if (forgotForm) forgotForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const btn   = document.getElementById('forgotBtn');
    const msg   = document.getElementById('forgotMsg');
    const succ  = document.getElementById('forgotSuccess');
    msg.style.display = 'none'; succ.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      await fbSendPasswordReset(email);
      succ.textContent = 'Password reset link sent! Check your inbox.';
      succ.style.display = 'block';
      forgotForm.reset();
    } catch(err) {
      msg.textContent = err.code === 'auth/user-not-found' ? 'No account found with this email.' : 'Something went wrong. Please try again.';
      msg.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = 'Send Recovery Email';
  });

  /* Login */
  var loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const errBox = document.getElementById('loginError');
    const btn    = document.getElementById('loginBtn');
    errBox.classList.remove('visible');
    btn.disabled = true; btn.textContent = 'Logging in...';

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;

    try {
      const result = await fbLogin(email, password);
      localStorage.setItem('craftbar_user', JSON.stringify(Object.assign({ uid: result.uid, email: email }, result.data)));
      if (result.data.favourites) {
        localStorage.setItem('craftbar_favs_' + result.uid, JSON.stringify(result.data.favourites));
      }
      showToast('Welcome back, ' + (result.data.firstName || email.split('@')[0]) + '!');
      setTimeout(function() { window.location.href = './index.html'; }, 1000);
    } catch(err) {
      btn.disabled = false; btn.textContent = 'Login';
      var msg = 'Something went wrong. Please try again.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Incorrect email or password.';
      if (err.code === 'auth/invalid-email')     msg = 'Invalid email address.';
      if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Please try again later.';
      errBox.innerHTML = msg;
      errBox.classList.add('visible');
    }
  });
}

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  updateNavAuth();
  renderFavDrawer();

  if (document.getElementById('cocktailGrid'))  initCocktailsPage();
  if (document.getElementById('featuredGrid'))  initFeaturedCocktails();
  if (document.getElementById('profileFavGrid') || document.getElementById('infoForm')) initProfilePage();
  if (document.getElementById('loginForm') || document.getElementById('registerForm'))  initAuthPage();

  var detailOverlay = document.getElementById('detailOverlay');
  if (detailOverlay) detailOverlay.addEventListener('click', function(e) { if (e.target === this) closeDetailModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeDetailModal(); });
});
