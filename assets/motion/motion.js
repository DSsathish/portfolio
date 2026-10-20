/*
 * Motion layer — LottieFiles animations + scroll/pointer motion layered on top of
 * the prebuilt React bundle (assets/index-*.js). It only adds nodes and classes
 * next to what React renders, so the bundle can be rebuilt without touching this.
 */

const LOTTIE_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
const lottieUrl = (name) => new URL(`../lottie/${name}.json`, import.meta.url).href;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// Section header icon per section id (files live in assets/lottie/).
const SECTION_ICONS = {
  about: 'circuit-brain',
  projects: 'cloud-server',
  experience: 'rocket-launch',
  skills: 'gear',
  contact: 'paper-plane',
};

/* ---------------- Lottie ---------------- */

let lottieLib;
function loadLottieLib() {
  lottieLib ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LOTTIE_LIB;
    s.async = true;
    s.onload = () => resolve(window.lottie);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return lottieLib;
}

// Animations load when they come near the viewport and pause when they leave it.
const lottieObserver = new IntersectionObserver(
  (entries) => {
    for (const { target, isIntersecting } of entries) {
      target._mxVisible = isIntersecting;
      if (isIntersecting && !target._mxLoading) createAnimation(target);
      else if (target._mxAnim && !reduceMotion) isIntersecting ? target._mxAnim.play() : target._mxAnim.pause();
    }
  },
  { rootMargin: '150px 0px' }
);

async function createAnimation(host) {
  host._mxLoading = true; // claim before awaiting so we only build once
  try {
    const lottie = await loadLottieLib();
    const anim = lottie.loadAnimation({
      container: host,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      path: lottieUrl(host.dataset.lottie),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true },
    });
    host._mxAnim = anim;
    anim.setSpeed(Number(host.dataset.speed || 1));
    anim.addEventListener('DOMLoaded', () => {
      host.classList.add('is-loaded');
      if (reduceMotion) anim.goToAndStop(Math.floor(anim.totalFrames * 0.6), true);
      else if (host._mxVisible) anim.play();
    });
  } catch {
    host.remove(); // CDN unreachable: drop the empty slot rather than leave a gap
  }
}

function lottieHost(name, className, { speed = 1, label } = {}) {
  const el = document.createElement('span');
  el.className = `mx-lottie ${className}`;
  el.dataset.lottie = name;
  el.dataset.speed = speed;
  if (label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  } else {
    el.setAttribute('aria-hidden', 'true');
  }
  lottieObserver.observe(el);
  return el;
}

function mountLotties() {
  // Hero centerpiece with pointer parallax.
  const heroInner = document.querySelector('#hero > .max-w-7xl');
  if (heroInner && !heroInner.querySelector('.mx-hero-art')) {
    const art = document.createElement('div');
    art.className = 'mx-hero-art';
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = '<span class="mx-ring"></span><span class="mx-ring"></span>';
    art.appendChild(lottieHost('hero-brain-network', '', { speed: 0.8 }));
    heroInner.prepend(art);

    if (finePointer && !reduceMotion) {
      const hero = document.getElementById('hero');
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        art.style.setProperty('--mx-px', `${((e.clientX - r.left) / r.width - 0.5) * -28}px`);
        art.style.setProperty('--mx-py', `${((e.clientY - r.top) / r.height - 0.5) * -20}px`);
      });
      hero.addEventListener('pointerleave', () => {
        art.style.setProperty('--mx-px', '0px');
        art.style.setProperty('--mx-py', '0px');
      });
    }
  }

  // Scroll cue.
  const cue = document.querySelector('#hero > .animate-bounce');
  const cueLink = cue?.querySelector('a');
  if (cueLink && !cueLink.querySelector('.mx-lottie')) {
    cue.classList.add('mx-has-cue');
    cueLink.appendChild(lottieHost('scroll-down', 'mx-scroll-cue'));
  }

  // Section header icons, appended after the divider line.
  for (const [id, name] of Object.entries(SECTION_ICONS)) {
    const header = document.querySelector(`#${id} > .flex.items-center.mb-10`);
    if (header && !header.querySelector('.mx-section-icon')) header.appendChild(lottieHost(name, 'mx-section-icon'));
  }

  // Contact card art.
  const contactCard = document.querySelector('#contact .rounded-3xl');
  if (contactCard && !contactCard.querySelector('.mx-contact-art')) {
    contactCard.appendChild(lottieHost('send-mail', 'mx-contact-art', { speed: 0.7 }));
  }
}

/* ---------------- Scroll reveal ---------------- */

const REVEAL_TARGETS = [
  '#hero .max-w-3xl > *',
  '#hero > .max-w-7xl > .pt-2',
  'section > .flex.items-center.mb-10',
  'section .grid > *',
  '#experience .border-l-2 > *',
  '#contact .rounded-3xl',
];

const revealObserver = new IntersectionObserver(
  (entries) => {
    const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    entering.forEach((el, i) => {
      revealObserver.unobserve(el);
      el.style.setProperty('--mx-delay', `${Math.min(i, 8) * 80}ms`);
      el.classList.add('mx-in');
      // Hand the element back to its own Tailwind transitions once revealed.
      setTimeout(() => {
        el.classList.remove('mx-reveal', 'mx-in');
        el.style.removeProperty('--mx-delay');
      }, 1000 + Math.min(i, 8) * 80);
    });
  },
  // threshold 0: tall blocks (e.g. the simulator on phones) reveal as soon as their top edge enters.
  { rootMargin: '0px 0px -6% 0px', threshold: 0 }
);

function setupReveal() {
  if (reduceMotion) return;
  // Document order puts ancestors first, so nested matches can be skipped and a
  // card and its grid children don't double-animate.
  for (const el of document.querySelectorAll(REVEAL_TARGETS.join(','))) {
    if (el.parentElement.closest('.mx-reveal')) continue;
    el.classList.add('mx-reveal');
    revealObserver.observe(el);
  }
}

/* ---------------- Stat counters ---------------- */

function setupCounters() {
  if (reduceMotion) return;
  const values = document.querySelectorAll('#hero + section .grid .text-3xl');
  const io = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      io.unobserve(target);
      countUp(target);
    }
  }, { threshold: 0.6 });
  values.forEach((el) => io.observe(el));
}

function countUp(el) {
  const node = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && /\d/.test(n.data));
  const match = node?.data.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return;
  const [, prefix, num, suffix] = match;
  const original = node.data;
  const target = parseFloat(num);
  const decimals = num.includes('.') ? num.split('.')[1].length : 0;
  const start = performance.now();
  const duration = 1600;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    node.data = t < 1 ? `${prefix}${(target * eased).toFixed(decimals)}${suffix}` : original;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------------- Scroll progress + pointer glow ---------------- */

function setupProgress() {
  const bar = document.createElement('div');
  bar.className = 'mx-progress';
  document.body.appendChild(bar);
  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--mx-progress', max > 0 ? (scrollY / max).toFixed(4) : 0);
  };
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

function setupPointer() {
  if (!finePointer || reduceMotion) return;
  const glow = document.createElement('div');
  glow.className = 'mx-glow';
  document.body.appendChild(glow);

  let x = innerWidth / 2, y = innerHeight / 2, gx = x, gy = y, running = false;
  const follow = () => {
    gx += (x - gx) * 0.12;
    gy += (y - gy) * 0.12;
    glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    running = Math.abs(x - gx) + Math.abs(y - gy) > 0.5;
    if (running) requestAnimationFrame(follow);
  };

  let lastCard;
  addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    glow.classList.add('is-active');
    if (!running) { running = true; requestAnimationFrame(follow); }

    // Spotlight inside the card under the pointer (styled via ::after in motion.css).
    const card = e.target.closest?.('.relative.border[class*="rounded-2xl"], .relative.border[class*="rounded-3xl"]');
    if (card !== lastCard) {
      lastCard?.style.setProperty('--mx-spot-o', '0');
      lastCard = card;
    }
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx-x', `${e.clientX - r.left}px`);
      card.style.setProperty('--mx-y', `${e.clientY - r.top}px`);
      card.style.setProperty('--mx-spot-o', '1');
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => glow.classList.remove('is-active'));
}

/* ---------------- Boot ---------------- */

function init() {
  mountLotties();
  setupReveal();
  setupCounters();
  setupProgress();
  setupPointer();
}

// React renders asynchronously after its bundle runs; wait for the last section.
const ready = () => document.getElementById('contact');
if (ready()) {
  init();
} else {
  const mo = new MutationObserver(() => {
    if (ready()) { mo.disconnect(); init(); }
  });
  mo.observe(document.getElementById('root'), { childList: true, subtree: true });
}
