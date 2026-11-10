/* links from config.js */
const C = window.DELTIX_CONFIG || {};
const API = (C.apiBase || 'http://localhost:8080').replace(/\/$/, '');
const FREE_MAIL = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|proton|protonmail|aol|gmx)\./i;

// The gateway needs a tenant_id to start Google sign-in and creates the tenant on callback.
// Colleagues on the same company domain share a workspace; everyone else gets a saved random one.
function tenantId(email){
  const domain = (email || '').split('@')[1];
  if (domain && !FREE_MAIL.test(domain)) return 'ws_' + domain.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let id = null;
  try { id = localStorage.getItem('deltix_tenant'); } catch (e) {}
  if (!id){
    id = 'ws_' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('deltix_tenant', id); } catch (e) {}
  }
  return id;
}
const loginUrl = email => `${API}/v1/auth/google/login?tenant_id=${encodeURIComponent(tenantId(email))}&redirect=true`;

document.querySelectorAll('[data-link]').forEach(el => {
  const k = el.dataset.link;
  if (k === 'auth' && el.tagName === 'A') el.href = loginUrl();
  else if (k.startsWith('docs:') && C.docsBase) el.href = C.docsBase.replace(/\/$/, '') + '/' + k.slice(5);
  else if (k === 'demo' && C.demoEmail) el.href = 'mailto:' + C.demoEmail + '?subject=DelTix%20demo';
  else if (k === 'contact' && C.contactEmail) el.href = 'mailto:' + C.contactEmail;
});
const signup = document.querySelector('form.signup');
signup.addEventListener('submit', e => {
  e.preventDefault();
  const email = signup.querySelector('input[type=email]');
  if (!email.checkValidity()){ email.reportValidity(); return; }
  location.href = loginUrl(email.value.trim());
});

/* load-in */
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('loaded')));
setTimeout(() => document.documentElement.classList.add('loaded'), 300);

/* nav border on scroll */
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), {passive:true});

/* dropdowns */
document.querySelectorAll('.has-dd').forEach(li => {
  const b = li.querySelector('button');
  let t;
  const open = v => { li.classList.toggle('open', v); b.setAttribute('aria-expanded', v); };
  li.addEventListener('mouseenter', () => { clearTimeout(t); open(true); });
  li.addEventListener('mouseleave', () => { t = setTimeout(() => open(false), 120); });
  b.addEventListener('click', () => open(!li.classList.contains('open')));
  li.querySelectorAll('.dd a').forEach(a => a.addEventListener('click', () => open(false)));
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.has-dd.open').forEach(li => { li.classList.remove('open'); li.querySelector('button').setAttribute('aria-expanded', false); }); });

/* mobile menu */
const burger = document.getElementById('burger'), mobile = document.getElementById('mobile');
burger.addEventListener('click', () => {
  const o = !mobile.classList.contains('open');
  mobile.style.top = nav.getBoundingClientRect().bottom + 'px'; // sit below the nav even when the announcement bar is showing
  mobile.classList.toggle('open', o); burger.setAttribute('aria-expanded', o);
});
mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { mobile.classList.remove('open'); burger.setAttribute('aria-expanded', false); }));

/* chart */
const vals = [32,40,36,48,44,52,47,58,50,62,55,60,66,58,70,64,72,68,78,74,82,76,88,80,92,85,96,90,100,94];
document.getElementById('chart').innerHTML = vals.map((v,i) => `<i style="height:${v}%" class="${i>=vals.length-7?'hi':''}"></i>`).join('');

/* scale fixed-size app mockups to their container */
const scalers = [...document.querySelectorAll('.scaler')];
function fit(){
  scalers.forEach(s => {
    const w = +s.dataset.w, h = +s.dataset.h;
    s.style.width = '100%';
    const avail = s.getBoundingClientRect().width;
    const scale = Math.min(1, avail / w);
    s.style.width = (w * scale) + 'px';
    s.style.height = (h * scale) + 'px';
    s.firstElementChild.style.transform = `scale(${scale})`;
  });
}
fit(); addEventListener('resize', fit);

/* product tour */
const items = [...document.querySelectorAll('.acc-i')], screens = [...document.querySelectorAll('.screen')];
items.forEach(it => it.querySelector('button').addEventListener('click', () => {
  const i = it.dataset.i;
  items.forEach(x => { const on = x === it; x.classList.toggle('on', on); x.querySelector('button').setAttribute('aria-expanded', on); });
  screens.forEach(s => s.classList.toggle('on', s.dataset.i === i));
}));

/* code tabs */
const tabs = [...document.querySelectorAll('.code-tabs button')];
tabs.forEach(b => b.addEventListener('click', () => {
  tabs.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
  document.querySelectorAll('.code pre').forEach(p => p.hidden = p.dataset.c !== b.dataset.c);
}));
