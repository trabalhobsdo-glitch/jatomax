// ===== Configurações do checkout =====
const UNIT_PRICE = 8990;       // preço unitário em centavos
const OLD_PRICE = 24990;       // preço "de" em centavos
// Opções de frete (centavos). Se mudar aqui, mude também SHIPPING em api/_shared.ts e o texto no checkout.html.
const SHIPPING_OPTIONS = {gratis: 0, pago: 1599};

const money = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
const $ = selector => document.querySelector(selector);
const form = $('#checkout-form');
const qtyInput = $('#co-qty');
function shippingId() { return form.elements.frete.value in SHIPPING_OPTIONS ? form.elements.frete.value : 'gratis'; }
function shippingCents() { return SHIPPING_OPTIONS[shippingId()]; }

// ===== Quantidade (vem da loja via ?qtd=) =====
function clampQty(value) {
  return Math.min(99, Math.max(1, Math.floor(Number(value)) || 1));
}
qtyInput.value = clampQty(new URLSearchParams(location.search).get('qtd'));
function qty() { return clampQty(qtyInput.value); }

function render() {
  const n = qty();
  const subtotal = n * UNIT_PRICE;
  const saving = n * (OLD_PRICE - UNIT_PRICE);
  const ship = shippingCents();
  $('#co-line').textContent = money.format(subtotal / 100);
  $('#co-subtotal').textContent = money.format(subtotal / 100);
  $('#co-save').textContent = '− ' + money.format(saving / 100);
  $('#co-ship').textContent = ship === 0 ? 'Grátis' : money.format(ship / 100);
  $('#co-total').textContent = money.format((subtotal + ship) / 100);
  $('#co-minus').disabled = n === 1;
  $('#co-plus').disabled = n === 99;
  const url = new URL(location.href);
  url.searchParams.set('qtd', n);
  history.replaceState(null, '', url);
}
qtyInput.addEventListener('input', render);
qtyInput.addEventListener('change', () => { qtyInput.value = qty(); render(); });
$('#co-minus').addEventListener('click', () => { qtyInput.value = qty() - 1; render(); });
$('#co-plus').addEventListener('click', () => { qtyInput.value = qty() + 1; render(); });
render();

// ===== Máscaras =====
const digits = value => value.replace(/\D/g, '');
const masks = {
  cpf: v => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
  telefone: v => digits(v).slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2'),
  cep: v => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
  uf: v => v.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
};
for (const [name, fn] of Object.entries(masks)) {
  form.elements[name].addEventListener('input', event => { event.target.value = fn(event.target.value); });
}

// ===== Validação =====
function validCPF(raw) {
  const c = digits(raw);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(c[i]) * (size + 1 - i);
    if ((sum * 10) % 11 % 10 !== Number(c[size])) return false;
  }
  return true;
}
const rules = {
  nome: v => v.trim().split(/\s+/).length >= 2 || 'Digite nome e sobrenome.',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Digite um e-mail válido.',
  cpf: v => validCPF(v) || 'CPF inválido.',
  telefone: v => [10, 11].includes(digits(v).length) || 'Digite o celular com DDD.',
  cep: v => digits(v).length === 8 || 'CEP deve ter 8 números.',
  uf: v => /^[A-Z]{2}$/.test(v) || 'Informe a UF.',
  rua: v => v.trim().length >= 3 || 'Informe a rua.',
  numero: v => v.trim().length >= 1 || 'Informe o número.',
  bairro: v => v.trim().length >= 2 || 'Informe o bairro.',
  cidade: v => v.trim().length >= 2 || 'Informe a cidade.'
};
function check(name) {
  const input = form.elements[name];
  const result = rules[name](input.value);
  const field = input.closest('.field');
  field.classList.toggle('bad', result !== true);
  field.querySelector('.err').textContent = result === true ? '' : result;
  input.setAttribute('aria-invalid', String(result !== true));
  return result === true;
}
for (const name of Object.keys(rules)) {
  form.elements[name].addEventListener('blur', () => check(name));
  form.elements[name].addEventListener('input', () => { if (form.elements[name].closest('.field').classList.contains('bad')) check(name); });
}

// ===== CEP automático (ViaCEP) =====
const cepStatus = $('#cep-status');
form.elements.cep.addEventListener('input', async event => {
  const cep = digits(event.target.value);
  if (cep.length !== 8) { cepStatus.textContent = ''; return; }
  cepStatus.textContent = 'Buscando endereço…';
  try {
    const response = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
    const data = await response.json();
    if (data.erro) { cepStatus.textContent = 'CEP não encontrado. Preencha o endereço manualmente.'; return; }
    const fill = (name, value) => { if (value) { form.elements[name].value = value; check(name); } };
    fill('rua', data.logradouro); fill('bairro', data.bairro); fill('cidade', data.localidade); fill('uf', data.uf);
    cepStatus.textContent = '';
    (data.logradouro ? form.elements.numero : form.elements.rua).focus();
  } catch {
    cepStatus.textContent = 'Não foi possível buscar o CEP. Preencha manualmente.';
  }
});

// ===== Botão e mensagens =====
const submitButton = $('#co-submit');
const msg = $('#co-msg');
const state = {loading: false, pix: null, timer: null};
function totalCents() { return qty() * UNIT_PRICE + shippingCents(); }
function updateButton() {
  submitButton.textContent = state.loading ? 'Gerando Pix…' : 'Pagar com Pix · ' + money.format(totalCents() / 100);
  submitButton.disabled = state.loading;
}
function show(text, isError) { msg.className = 'co-msg' + (isError ? ' err' : ''); msg.textContent = text; msg.hidden = !text; }
qtyInput.addEventListener('input', updateButton);
form.addEventListener('change', event => { if (event.target.name === 'frete') { render(); updateButton(); } });
qtyInput.addEventListener('change', updateButton);
$('#co-minus').addEventListener('click', updateButton);
$('#co-plus').addEventListener('click', updateButton);
updateButton();

// ===== Telas depois de confirmar =====
function showScreen(name) {
  $('#co-main').hidden = name !== 'form';
  $('#co-screen').hidden = name === 'form';
  document.querySelectorAll('[data-screen]').forEach(el => { el.hidden = el.dataset.screen !== name; });
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function drawQR(canvas, text) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text); qr.make();
    const n = qr.getModuleCount(), margin = 2, cell = Math.max(2, Math.floor(280 / (n + margin * 2)));
    const px = cell * (n + margin * 2);
    canvas.width = canvas.height = px;
    const c = canvas.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, px, px);
    c.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) c.fillRect((x + margin) * cell, (y + margin) * cell, cell, cell);
  } catch { canvas.hidden = true; }
}
function showPix(pix) {
  $('#pix-amount').textContent = money.format(pix.amount / 100);
  $('#pix-code').value = pix.qrcode;
  $('#pix-qr').hidden = false; drawQR($('#pix-qr'), pix.qrcode);
  $('#pix-exp').textContent = pix.expirationDate ? 'Válido até ' + new Date(pix.expirationDate).toLocaleString('pt-BR') : '';
  showScreen('pix');
}
$('#pix-code').addEventListener('focus', event => event.currentTarget.select());
$('#pix-copy').addEventListener('click', async () => {
  const button = $('#pix-copy');
  try { await navigator.clipboard.writeText(state.pix.qrcode); }
  catch { $('#pix-code').select(); document.execCommand('copy'); }
  button.textContent = '✓ Código copiado!';
  setTimeout(() => { button.textContent = 'Copiar código Pix'; }, 2500);
});
function showPaid() {
  clearInterval(state.timer);
  $('#paid-amount').textContent = money.format((state.pix?.amount ?? totalCents()) / 100);
  $('#paid-email').textContent = form.elements.email.value;
  showScreen('paid');
}
function showFailed() { clearInterval(state.timer); showScreen('failed'); }
$('#fail-retry').addEventListener('click', () => { state.pix = null; showScreen('form'); });

// ===== Confirmação do pagamento (consulta a cada 5 segundos) =====
function startPolling(id) {
  clearInterval(state.timer);
  state.timer = setInterval(async () => {
    let status = '';
    try {
      const response = await fetch('/api/pix-status?id=' + encodeURIComponent(id));
      status = String((await response.json()).status || '');
    } catch { return; }
    if (status === 'paid' || status === 'authorized') showPaid();
    else if (['refused', 'canceled', 'cancelled', 'expired'].includes(status)) showFailed();
  }, 5000);
}

// ===== Envio do pedido (Pix via Unipay) =====
form.addEventListener('submit', async event => {
  event.preventDefault();
  const results = Object.keys(rules).map(check);
  if (results.includes(false)) { form.querySelector('.field.bad input').focus(); return; }
  const f = new FormData(form);
  // O servidor recalcula o valor: aqui só vão a oferta, a quantidade e os dados do cliente.
  const order = {
    offerId: 'jatomax', quantity: qty(), shippingId: shippingId(),
    customer: {name: f.get('nome').trim(), email: f.get('email').trim(), cpf: digits(f.get('cpf')), phone: digits(f.get('telefone'))},
    address: {cep: digits(f.get('cep')), street: f.get('rua').trim(), number: f.get('numero').trim(), complement: f.get('complemento').trim(), neighborhood: f.get('bairro').trim(), city: f.get('cidade').trim(), state: f.get('uf')},
    sourceUrl: location.href
  };
  state.loading = true; show('', false); updateButton();
  try {
    const response = await fetch('/api/create-pix', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(order)});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { show(data.error || 'Não foi possível gerar o Pix.', true); return; }
    state.pix = data;
    showPix(data);
    startPolling(data.id);
  } catch {
    show('Falha de conexão. Tente novamente em instantes.', true);
  } finally {
    state.loading = false; updateButton();
  }
});
