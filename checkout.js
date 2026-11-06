// ===== Configurações do checkout =====
const UNIT_PRICE = 8990;       // preço unitário em centavos
const OLD_PRICE = 24990;       // preço "de" em centavos
const SHIPPING = null;         // frete em centavos; null = "A confirmar", 0 = "Grátis"

const money = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
const $ = selector => document.querySelector(selector);
const form = $('#checkout-form');
const qtyInput = $('#co-qty');

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
  const ship = SHIPPING ?? 0;
  $('#co-line').textContent = money.format(subtotal / 100);
  $('#co-subtotal').textContent = money.format(subtotal / 100);
  $('#co-save').textContent = '− ' + money.format(saving / 100);
  $('#co-ship').textContent = SHIPPING === null ? 'A confirmar' : (SHIPPING === 0 ? 'Grátis' : money.format(SHIPPING / 100));
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

// ===== Envio =====
form.addEventListener('submit', event => {
  event.preventDefault();
  const results = Object.keys(rules).map(check);
  if (results.includes(false)) {
    form.querySelector('.field.bad input').focus();
    return;
  }
  const order = Object.fromEntries(new FormData(form).entries());
  order.quantidade = qty();
  order.total = qty() * UNIT_PRICE;
  try { sessionStorage.setItem('jatomax-pedido', JSON.stringify(order)); } catch {}
  // >>> Quando os métodos de pagamento forem adicionados, a cobrança entra aqui. <<<
  $('#done-detail').textContent = order.quantidade + (order.quantidade === 1 ? ' unidade' : ' unidades') + ' · ' + $('#co-total').textContent + ' · entrega em ' + order.cidade + '/' + order.uf + '.';
  $('#co-done').showModal();
});
