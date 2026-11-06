const unitPrice = 8990;
const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const thumbs = [...document.querySelectorAll('[data-image]')];
const photo = document.querySelector('#main-image');
const quantity = document.querySelector('#quantity');
let index = thumbs.findIndex(item => item.getAttribute('aria-pressed') === 'true');
function showPhoto(position) {
  index = (position + thumbs.length) % thumbs.length;
  photo.src = 'media/' + thumbs[index].dataset.image + '.webp';
  photo.alt = thumbs[index].getAttribute('aria-label') + ' · SEESE Pro';
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    photo.animate([{opacity: .42}, {opacity: 1}], {duration: 280});
  }
  thumbs.forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)));
}
thumbs.forEach((item, i) => item.addEventListener('click', () => showPhoto(i)));
document.querySelector('#prev').addEventListener('click', () => showPhoto(index - 1));
document.querySelector('#next').addEventListener('click', () => showPhoto(index + 1));
function count() {
  return Math.min(99, Math.max(1, Math.floor(quantity.valueAsNumber) || 1));
}
function update() {
  document.querySelector('#total').textContent = money.format(count() * unitPrice / 100);
  document.querySelector('#minus').disabled = count() === 1;
  document.querySelector('#plus').disabled = count() === 99;
}
quantity.addEventListener('input', () => update());
quantity.addEventListener('change', () => {quantity.value = count(); update();});
for (const [id, step] of [['minus', -1], ['plus', 1]]) {
  document.querySelector('#' + id).addEventListener('click', () => {
    quantity.value = count() + step;
    update();
  });
}
update();


const reviewZoom = document.querySelector('#review-zoom');
for (const button of document.querySelectorAll('.review-photo')) {
  button.addEventListener('click', () => {
    const photo = button.querySelector('img');
    const enlarged = reviewZoom.querySelector('img');
    enlarged.src = photo.src;
    enlarged.alt = photo.alt;
    reviewZoom.showModal();
  });
}

const checkoutLinks = ['#buy-order', '#floating-buy-link'].map(id => document.querySelector(id));
function updateCheckoutLinks() {
  for (const link of checkoutLinks) link.href = 'checkout.html?qtd=' + count();
}
updateCheckoutLinks();
quantity.addEventListener('input', updateCheckoutLinks);
quantity.addEventListener('change', updateCheckoutLinks);
document.querySelector('#minus').addEventListener('click', updateCheckoutLinks);
document.querySelector('#plus').addEventListener('click', updateCheckoutLinks);

const scratchDialog = document.querySelector('#scratch-dialog');
const scratchCanvas = document.querySelector('#scratch-canvas');
const scratchContext = scratchCanvas.getContext('2d');
const scratchKey = 'jatomax-desconto-revelado';
const scratchReward = document.querySelector('#scratch-reward');
const revealButton = document.querySelector('#scratch-reveal');
const enterButton = document.querySelector('#scratch-enter');
function alreadyEntered() {
  try {
    return sessionStorage.getItem(scratchKey) === 'yes';
  } catch {
    return false;
  }
}
function revealDiscount() {
  scratchCanvas.hidden = true;
  scratchReward.hidden = false;
  scratchReward.removeAttribute('aria-hidden');
  revealButton.hidden = true;
  enterButton.hidden = false;
  document.querySelector('#scratch-skip').hidden = true;
  enterButton.focus();
}
if (scratchContext) {
  const gradient = scratchContext.createLinearGradient(0, 0, 600, 240);
  gradient.addColorStop(0, '#536746');
  gradient.addColorStop(.5, '#34462a');
  gradient.addColorStop(1, '#26351e');
  scratchContext.fillStyle = gradient;
  scratchContext.fillRect(0, 0, 600, 240);
  scratchContext.fillStyle = '#e4ff94';
  scratchContext.font = 'bold 36px system-ui';
  scratchContext.textAlign = 'center';
  scratchContext.fillText('RASPE AQUI', 300, 130);
  scratchContext.globalCompositeOperation = 'destination-out';

  let point;
  let pointer;
  const touched = new Set();
  function scratch(event) {
    if (event.pointerId !== pointer) return;
    const bounds = scratchCanvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * 600 / bounds.width;
    const y = (event.clientY - bounds.top) * 240 / bounds.height;
    if (x < 0 || x > 600 || y < 0 || y > 240) { point = undefined; return; }
    scratchContext.lineWidth = 66;
    scratchContext.lineCap = 'round';
    scratchContext.beginPath();
    scratchContext.moveTo(point?.x ?? x - .1, point?.y ?? y);
    scratchContext.lineTo(x, y);
    scratchContext.stroke();
    point = {x, y};
    touched.add(Math.floor(x / 50) + ':' + Math.floor(y / 48));
    if (touched.size >= 13) revealDiscount();
  }
  scratchReward.hidden = false;
  scratchReward.setAttribute('aria-hidden', 'true');
  scratchCanvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary) return;
    pointer = event.pointerId;
    point = undefined;
    scratchCanvas.setPointerCapture(pointer);
    scratch(event);
  });
  scratchCanvas.addEventListener('pointermove', scratch);
  scratchCanvas.addEventListener('lostpointercapture', () => { pointer = undefined; });
}
revealButton.addEventListener('click', revealDiscount);
scratchDialog.addEventListener('close', () => {
  try { sessionStorage.setItem(scratchKey, 'yes'); } catch {}
});

if (!alreadyEntered()) scratchDialog.showModal();

if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('entered');
      reveal.unobserve(entry.target);
    }
  }, {threshold: .12});
  document.querySelectorAll('.gallery,.description .copy,.detail-block,.detail-feature,.clip,.review-head,.review-card').forEach(element => reveal.observe(element));
}

const scrollMeter = document.querySelector('.scroll-meter');
function updateScrollMeter() {
  const root = document.documentElement;
  const distance = root.scrollHeight - root.clientHeight;
  scrollMeter.style.setProperty('--scroll', distance > 0 ? root.scrollTop / distance : 0);
}
window.addEventListener('scroll', updateScrollMeter, {passive: true});
window.addEventListener('resize', updateScrollMeter);
updateScrollMeter();
