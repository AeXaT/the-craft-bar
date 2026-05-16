/* ============================================================
   The Craft Bar — Main Script
   ============================================================ */

const API_BASE  = 'https://www.thecocktaildb.com/api/json/v1/1';
const AUTH_BASE = 'https://api.everrest.educata.dev/auth';

/* ── Auth helpers ─────────────────────────────────────────── */
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('craftbar_user') || 'null');
}
function getToken() {
  return getCurrentUser()?.access_token || null;
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
    authLink.onclick = null;
  } else {
    authLink.textContent = 'Login';
    authLink.href = './auth.html';
    authLink.onclick = null;
  }
  if (favBtn) favBtn.style.display = user ? 'flex' : 'none';
}

/* ── API Auth calls ───────────────────────────────────────── */
async function apiRegister(data) {
  const res = await fetch(`${AUTH_BASE}/sign_up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

async function apiLogin(email, password) {
  const res = await fetch(`${AUTH_BASE}/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

async function apiLogout() {
  try {
    await fetch(`${AUTH_BASE}/sign_out`, {
      method: 'POST',
      headers: { 'accept': '*/*' },
      credentials: 'include'
    });
  } catch (e) {}
  localStorage.removeItem('craftbar_user');
  showToast('Logged out. See you soon!');
  setTimeout(() => window.location.href = './index.html', 900);
}

async function apiUpdateProfile(data) {
  const token = getToken();
  const res = await fetch(`${AUTH_BASE}/update`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, data: json };
}

async function apiChangePassword(currentPassword, newPassword) {
  const token = getToken();
  const res = await fetch(`${AUTH_BASE}/change_password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, data: json };
}

function formatAuthError(json) {
  if (!json) return 'Something went wrong. Please try again.';
  if (json.errorKeys && json.errorKeys.length) {
    return json.errorKeys.map(k =>
      k.replace('errors.', '').replace(/_/g, ' ')
       .replace(/\b\w/g, c => c.toUpperCase())
    ).join('<br>');
  }
  if (json.error) return json.error;
  return 'Something went wrong. Please try again.';
}


/* ── Welcome email via EmailJS ────────────────────────────── */
function sendWelcomeEmail(firstName, lastName, email) {
  if (typeof emailjs === 'undefined') return;
  emailjs.send('craft_bar', 'template_ebktx7v', {
    user_name:  firstName + ' ' + lastName,
    user_email: email
  }).catch(() => {});
}

/* ── Favourites ───────────────────────────────────────────── */
function getFavourites() { return JSON.parse(localStorage.getItem('craftbar_favourites') || '[]'); }
function saveFavourites(f) { localStorage.setItem('craftbar_favourites', JSON.stringify(f)); }
function isFavourite(id) { return getFavourites().some(f => f.idDrink === id); }

function toggleFavourite(e, drink) {
  e.stopPropagation();
  if (!isLoggedIn()) { showToast('Please login to save favourites!', 'warning'); return; }
  let favs = getFavourites();
  const idx = favs.findIndex(f => f.idDrink === drink.idDrink);
  if (idx === -1) { favs.push(drink); showToast(drink.strDrink + ' added to favourites!'); }
  else            { favs.splice(idx, 1); showToast(drink.strDrink + ' removed from favourites'); }
  saveFavourites(favs);
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
  list.innerHTML = favs.map(f => `
    <div class="fav-item" style="cursor:pointer;" onclick="toggleFavDrawer();openDetailModal('${f.idDrink}')">
      <img src="${f.strDrinkThumb ? f.strDrinkThumb + '/preview' : ''}" alt="${f.strDrink}" />
      <div class="fav-item-info">
        <span>${f.strDrink}</span>
        <small>${f.strCategory || ''}</small>
      </div>
      <button class="fav-remove" onclick="event.stopPropagation();removeFav('${f.idDrink}')">✕</button>
    </div>`).join('');
}

function removeFav(id) {
  saveFavourites(getFavourites().filter(f => f.idDrink !== id));
  renderFavDrawer();
  refreshHearts();
  // also re-render profile favourites if on profile page
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
  document.getElementById('favDrawer')?.classList.toggle('open');
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
    letters.map(l =>
      fetch(`${API_BASE}/search.php?s=${l}`)
        .then(r => r.json())
        .catch(() => ({ drinks: [] }))
    )
  );
  const seen = new Set(), drinks = [];
  for (const data of results)
    for (const d of (data.drinks || []))
      if (!seen.has(d.idDrink)) { seen.add(d.idDrink); drinks.push(d); }
  return drinks;
}

async function fetchCategories() {
  const res  = await fetch(`${API_BASE}/list.php?c=list`);
  const data = await res.json();
  return (data.drinks || []).map(d => d.strCategory);
}

async function fetchDrinkById(id) {
  const res  = await fetch(`${API_BASE}/lookup.php?i=${id}`);
  const data = await res.json();
  return data.drinks ? data.drinks[0] : null;
}

/* ── Detail popup ─────────────────────────────────────────── */
async function openDetailModal(id) {
  const overlay = document.getElementById('detailOverlay');
  const body    = document.getElementById('detailBody');
  if (!overlay || !body) return;

  overlay.style.display = 'flex';
  body.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;
                padding:80px;gap:16px;flex-direction:column;opacity:0.7;width:100%;">
      <div class="loader-spinner"></div><p>Loading recipe...</p>
    </div>`;

  const drink = await fetchDrinkById(id);
  if (!drink) {
    body.innerHTML = '<p style="padding:40px;opacity:0.5;text-align:center;width:100%;">Could not load recipe.</p>';
    return;
  }

  const ings = getIngredients(drink);
  const img  = drink.strDrinkThumb || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500';

  body.innerHTML = `
    <div class="detail-img-wrap">
      <img src="${img}" alt="${drink.strDrink}" />
      <div class="detail-img-gradient"></div>
      <div class="detail-badges">
        ${drink.strCategory  ? `<span class="card-tag">${drink.strCategory}</span>`  : ''}
        ${drink.strAlcoholic ? `<span class="card-tag">${drink.strAlcoholic}</span>` : ''}
        ${drink.strGlass     ? `<span class="card-tag">🥃 ${drink.strGlass}</span>`  : ''}
      </div>
    </div>
    <div class="detail-info">
      <h2 class="detail-title">${drink.strDrink}</h2>
      ${ings.length ? `
        <div class="detail-section">
          <h4>Ingredients</h4>
          <div class="detail-ingredients">
            ${ings.map(i => `
              <div class="detail-ingredient">
                <span class="detail-ing-name">${i.name}</span>
                ${i.measure ? `<span class="detail-ing-measure">${i.measure}</span>` : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}
      ${drink.strInstructions ? `
        <div class="detail-section">
          <h4>Instructions</h4>
          <p class="detail-instructions">${drink.strInstructions}</p>
        </div>` : ''}
    </div>`;
}

function closeDetailModal() {
  const overlay = document.getElementById('detailOverlay');
  if (overlay) overlay.style.display = 'none';
  if (overlay) overlay.classList.remove('open');
}

/* ── Build card ───────────────────────────────────────────── */
function buildCard(drink) {
  const fav  = isFavourite(drink.idDrink);
  const img  = drink.strDrinkThumb || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400';
  const ings = getIngredients(drink);

  const ingTags = ings.length ? `
    <div class="card-ingredients">
      ${ings.slice(0, 5).map(i => `<span class="card-ing-tag">${i.name}</span>`).join('')}
      ${ings.length > 5 ? `<span class="card-ing-tag card-ing-more">+${ings.length - 5}</span>` : ''}
    </div>` : '';

  const minDrink = JSON.stringify({
    idDrink: drink.idDrink, strDrink: drink.strDrink,
    strDrinkThumb: drink.strDrinkThumb, strCategory: drink.strCategory
  }).replace(/"/g, '&quot;');

  return `
    <div class="card" onclick="openDetailModal('${drink.idDrink}')">
      <div class="card-img-wrap">
        <img src="${img}" alt="${drink.strDrink}" loading="lazy" />
        <button class="heart-btn ${fav ? 'active' : ''}"
          data-id="${drink.idDrink}" data-drink="${minDrink}"
          onclick="toggleFavourite(event, JSON.parse(this.dataset.drink))">
          ${fav ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="card-body">
        <h3>${drink.strDrink}</h3>
        ${ingTags}
        <span class="card-tag">${drink.strCategory || drink.strAlcoholic || ''}</span>
      </div>
    </div>`;
}

/* ── Toast ────────────────────────────────────────────────── */
function showToast(msg, type) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'show' + (type === 'warning' ? ' warning' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3000);
}

/* ── Cocktails page ───────────────────────────────────────── */
let allDrinks      = [];
let activeCategory   = '';
let activeIngredient = '';

async function initCocktailsPage() {
  updateNavAuth();
  renderFavDrawer();

  const grid   = document.getElementById('cocktailGrid');
  const loader = document.getElementById('loader');
  if (!grid) return;

  const catSelect = document.getElementById('categoryFilter');
  if (catSelect) {
    const cats = await fetchCategories();
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      catSelect.appendChild(o);
    });
    catSelect.addEventListener('change', () => {
      activeCategory = catSelect.value;
      applyFilters();
    });
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
          if (!ingMap.has(key)) {
            const display = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
            ingMap.set(key, display);
          }
        }
      }
    });
    const sortedIngs = Array.from(ingMap.values()).sort((a, b) => a.localeCompare(b));
    ingSelect.innerHTML = '<option value="">All Ingredients</option>';
    sortedIngs.forEach(ing => {
      const o = document.createElement('option');
      o.value = ing; o.textContent = ing;
      ingSelect.appendChild(o);
    });
    ingSelect.addEventListener('change', () => {
      activeIngredient = ingSelect.value;
      applyFilters();
    });
  }

  renderGrid(allDrinks);
}

function renderGrid(drinks) {
  const grid = document.getElementById('cocktailGrid');
  if (!grid) return;
  grid.innerHTML = drinks.length
    ? drinks.map(buildCard).join('')
    : '<p class="no-results">No cocktails found.</p>';
}

function applyFilters() {
  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  let drinks = [...allDrinks];

  if (activeCategory)
    drinks = drinks.filter(d => d.strCategory === activeCategory);

  if (activeIngredient) {
    const ing = activeIngredient.toLowerCase();
    drinks = drinks.filter(d => {
      for (let i = 1; i <= 15; i++) {
        const name = d['strIngredient' + i];
        if (name && name.trim().toLowerCase() === ing) return true;
      }
      return false;
    });
  }

  if (searchVal)
    drinks = drinks.filter(d => (d.strDrink || '').toLowerCase().includes(searchVal));

  renderGrid(drinks);
}

function searchCocktails() { applyFilters(); }

/* ── Featured cocktails (homepage) ───────────────────────── */
async function initFeaturedCocktails() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column:1/-1;display:flex;justify-content:center;align-items:center;
                gap:16px;padding:40px;opacity:0.7;flex-direction:column;">
      <div class="loader-spinner"></div><p>Loading...</p>
    </div>`;

  const names  = ['Old Fashioned', 'Negroni', 'Margarita'];
  const drinks = (await Promise.all(
    names.map(n =>
      fetch(`${API_BASE}/search.php?s=${encodeURIComponent(n)}`)
        .then(r => r.json()).then(d => d.drinks ? d.drinks[0] : null)
    )
  )).filter(Boolean);

  grid.innerHTML = drinks.map(drink => {
    const ings    = getIngredients(drink);
    const ingTags = ings.slice(0, 4).map(i => `<span class="card-ing-tag">${i.name}</span>`).join('');
    return `
      <div class="card" onclick="openDetailModal('${drink.idDrink}')">
        <div class="card-img-wrap">
          <img src="${drink.strDrinkThumb}" alt="${drink.strDrink}" loading="lazy" />
        </div>
        <div class="card-body">
          <h3>${drink.strDrink}</h3>
          <div class="card-ingredients">${ingTags}</div>
          <span class="card-tag">${drink.strCategory || ''}</span>
        </div>
      </div>`;
  }).join('');
}

/* ── Profile page ─────────────────────────────────────────── */
function doLogout() { apiLogout(); }

function previewAvatar(url) {
  const img = document.getElementById('avatarPreview');
  if (!img) return;
  if (url && url.startsWith('http')) {
    img.src = url;
    img.onerror = () => { img.src = 'https://ui-avatars.com/api/?background=d4a043&color=1a1008&name=User'; };
  }
}

function renderProfileFavourites() {
  const grid = document.getElementById('profileFavGrid');
  if (!grid) return;
  const favs = getFavourites();
  if (!favs.length) {
    grid.innerHTML = `<div class="fav-empty">
      No favourites yet.<br>
      Browse <a href="./cocktails.html" style="color:#d4a043;">cocktails</a> and click ❤️
    </div>`;
    return;
  }
  grid.innerHTML = favs.map(f => `
    <div class="fav-card">
      <div class="fav-thumb" onclick="openDetailModal('${f.idDrink}')">
        <img src="${f.strDrinkThumb || ''}" alt="${f.strDrink}" />
      </div>
      <div class="fav-body">
        <h4>${f.strDrink}</h4>
        <small>${f.strCategory || ''}</small>
        <button class="fav-rm" onclick="removeFav('${f.idDrink}')">
          🗑 Remove from favourites
        </button>
      </div>
    </div>`).join('');
}

async function initProfilePage() {
  if (!isLoggedIn()) { window.location.href = './auth.html'; return; }

  const user = getCurrentUser();

  // Populate sidebar
  document.getElementById('sidebarName').textContent  = (user.firstName || '') + ' ' + (user.lastName || '');
  document.getElementById('sidebarEmail').textContent = user.email || '';
  if (user.avatar) {
    document.getElementById('sidebarAvatar').src = user.avatar;
  } else {
    document.getElementById('sidebarAvatar').src =
      'https://ui-avatars.com/api/?background=d4a043&color=1a1008&name=' +
      encodeURIComponent((user.firstName || 'U') + '+' + (user.lastName || ''));
  }

  // Populate info form
  document.getElementById('infoFirstName').value = user.firstName || '';
  document.getElementById('infoLastName').value  = user.lastName  || '';
  document.getElementById('infoAge').value       = user.age       || '';
  document.getElementById('infoGender').value    = user.gender    || 'MALE';
  document.getElementById('infoEmail').value     = user.email     || '';
  document.getElementById('infoAddress').value   = user.address   || '';
  document.getElementById('infoPhone').value     = user.phone     || '';
  document.getElementById('infoZipcode').value   = user.zipcode   || '';
  document.getElementById('infoAvatar').value    = user.avatar    || '';
  if (user.avatar) {
    document.getElementById('avatarPreview').src = user.avatar;
  }

  // Panel switching
  document.querySelectorAll('.snav[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.snav').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      document.querySelectorAll('.pnl').forEach(p => p.classList.remove('on'));
      document.getElementById(btn.dataset.panel).classList.add('on');
      if (btn.dataset.panel === 'panelFavourites') renderProfileFavourites();
    });
  });

  // Render favourites immediately if that's the active panel
  renderProfileFavourites();

  /* ── Update info form ─────────────────────────────────── */
  document.getElementById('infoForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('infoMsg');
    const btn = document.getElementById('infoBtn');
    msg.className = 'msg';
    btn.disabled = true; btn.textContent = 'Saving...';

    const avatarVal  = document.getElementById('infoAvatar').value.trim();
    const firstName  = document.getElementById('infoFirstName').value.trim();
    const lastName   = document.getElementById('infoLastName').value.trim();
    const updateData = {
      firstName,
      lastName,
      age:     parseInt(document.getElementById('infoAge').value),
      gender:  document.getElementById('infoGender').value,
      email:   document.getElementById('infoEmail').value.trim(),
      address: document.getElementById('infoAddress').value.trim(),
      phone:   document.getElementById('infoPhone').value.trim(),
      zipcode: document.getElementById('infoZipcode').value.trim(),
      avatar:  avatarVal || 'https://ui-avatars.com/api/?name=' +
               encodeURIComponent(firstName + '+' + lastName) + '&background=d4a043&color=1a1008',
    };

    const result = await apiUpdateProfile(updateData);
    btn.disabled = false; btn.textContent = 'Save Changes';

    if (result.ok) {
      // Update stored user, preserving the token
      const stored = { ...getCurrentUser(), ...updateData };
      localStorage.setItem('craftbar_user', JSON.stringify(stored));
      // Refresh sidebar
      document.getElementById('sidebarName').textContent = firstName + ' ' + lastName;
      document.getElementById('sidebarAvatar').src = updateData.avatar;
      if (updateData.avatar) document.getElementById('avatarPreview').src = updateData.avatar;
      msg.textContent = 'Profile updated successfully!';
      msg.className = 'msg ok';
    } else {
      msg.innerHTML = formatAuthError(result.data);
      msg.className = 'msg err';
    }
  });

  /* ── Change password form ─────────────────────────────── */
  document.getElementById('passForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg  = document.getElementById('passMsg');
    const btn  = document.getElementById('passBtn');
    const np   = document.getElementById('newPass').value;
    const cp   = document.getElementById('confirmPass').value;
    msg.className = 'msg';

    if (np !== cp) {
      msg.textContent = 'New passwords do not match.';
      msg.className = 'msg err';
      return;
    }

    btn.disabled = true; btn.textContent = 'Updating...';
    const result = await apiChangePassword(
      document.getElementById('currentPass').value,
      np
    );
    btn.disabled = false; btn.textContent = 'Update Password';

    if (result.ok) {
      document.getElementById('passForm').reset();
      msg.textContent = 'Password changed successfully!';
      msg.className = 'msg ok';
    } else {
      msg.innerHTML = formatAuthError(result.data);
      msg.className = 'msg err';
    }
  });
}

/* ── Auth page ────────────────────────────────────────────── */
function initAuthPage() {
  if (isLoggedIn()) { window.location.href = './profile.html'; return; }

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(tab.dataset.panel).classList.add('active');
    });
  });

  /* Register */
  document.getElementById('registerForm')?.addEventListener('submit', async e => {
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
    const avatar    = avatarVal ||
      'https://ui-avatars.com/api/?name=' + encodeURIComponent(firstName + '+' + lastName) +
      '&background=d4a043&color=1a1008';

    const result = await apiRegister({ firstName, lastName, age, email, password, address, phone, zipcode, avatar, gender });

    btn.disabled = false; btn.textContent = 'Create Account';

    if (result.ok) {
      const loginResult = await apiLogin(email, password);
      if (loginResult.ok) {
        localStorage.setItem('craftbar_user', JSON.stringify({
          firstName, lastName, email, age, gender, address, phone, zipcode, avatar,
          access_token: loginResult.data.access_token || loginResult.data.token || ''
        }));
        sendWelcomeEmail(firstName, lastName, email);
        showToast('Welcome to The Craft Bar, ' + firstName + '!');
        setTimeout(() => window.location.href = './index.html', 1000);
      } else {
        showToast('Account created! Please log in.');
        document.querySelector('[data-panel="loginPanel"]').click();
        document.getElementById('loginEmail').value = email;
      }
    } else {
      errBox.innerHTML = formatAuthError(result.data);
      errBox.classList.add('visible');
    }
  });

  /* Login */
  document.getElementById('loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errBox = document.getElementById('loginError');
    const btn    = document.getElementById('loginBtn');
    errBox.classList.remove('visible');
    btn.disabled = true; btn.textContent = 'Logging in...';

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;
    const result   = await apiLogin(email, password);

    btn.disabled = false; btn.textContent = 'Login';

    if (result.ok) {
      const namePart  = email.split('@')[0];
      const firstName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      localStorage.setItem('craftbar_user', JSON.stringify({
        firstName,
        email,
        access_token: result.data.access_token || result.data.token || ''
      }));
      showToast('Welcome back, ' + firstName + '!');
      setTimeout(() => window.location.href = './index.html', 1000);
    } else {
      errBox.innerHTML = formatAuthError(result.data);
      errBox.classList.add('visible');
    }
  });
}

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
  renderFavDrawer();

  if (document.getElementById('cocktailGrid'))  initCocktailsPage();
  if (document.getElementById('featuredGrid'))  initFeaturedCocktails();
  if (document.getElementById('profileFavGrid') || document.getElementById('infoForm')) initProfilePage();
  if (document.getElementById('loginForm') || document.getElementById('registerForm'))  initAuthPage();

  document.getElementById('detailOverlay')?.addEventListener('click', function (e) {
    if (e.target === this) closeDetailModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDetailModal();
  });
});
