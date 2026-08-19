const API = '/api';

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
    ...opts,
  });
  let data;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) throw new Error((data && data.error) || 'Something went wrong.');
  return data;
}

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function fmtPrice(p) {
  return '₹' + Number(p).toLocaleString('en-IN');
}

function timeAgo(dateStr) {
  const d = new Date(dateStr + 'Z');
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

let CURRENT_USER = null;
async function loadCurrentUser() {
  try {
    CURRENT_USER = await apiFetch('/auth/me');
  } catch (e) {
    CURRENT_USER = null;
  }
  return CURRENT_USER;
}

function requireLogin() {
  if (!CURRENT_USER) {
    toast('Please log in first.');
    setTimeout(() => location.href = 'login.html', 800);
    return false;
  }
  return true;
}

const CATEGORIES = ['electronics', 'furniture', 'clothing', 'books', 'vehicles', 'appliances', 'sports', 'toys', 'other'];
const CONDITIONS = ['like new', 'good', 'fair', 'needs repair'];
