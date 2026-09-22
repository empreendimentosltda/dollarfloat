(() => {
  'use strict';
  const form = document.getElementById('checkout-form');
  const error = document.getElementById('form-error');
  const button = document.getElementById('submit-btn');
  const field = name => form.elements.namedItem(name);
  const value = name => field(name).value.trim();
  let busy = false, purchaseKey;
  try { purchaseKey = sessionStorage.getItem('purchase_key'); } catch {}
  function newKey() {
    purchaseKey = crypto.randomUUID();
    try { sessionStorage.setItem('purchase_key', purchaseKey); } catch {}
  }
  if (!purchaseKey) newKey();
  field('zipCode').addEventListener('input', e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
  });
  form.addEventListener('input', e => e.target.removeAttribute('aria-invalid'));
  function showError(message, target) {
    error.textContent = message;
    if (target) { target.setAttribute('aria-invalid', 'true'); target.focus(); }
    else error.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    error.textContent = '';
    if (!window.storeCheckout?.available) return showError('As compras ainda não estão disponíveis.');
    for (const name of ['name', 'email', 'phone', 'zipCode', 'address', 'district', 'city', 'state']) {
      const item = field(name);
      if (!value(name) || !item.checkValidity()) return showError('Confira o campo ' + document.querySelector(`label[for="${name}"]`).textContent.toLowerCase() + '.', item);
    }
    const phone = value('phone');
    if (!/^[+\d ()-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) return showError('Informe um celular válido com DDD.', field('phone'));
    const zipCode = value('zipCode').replace(/\D/g, '');
    if (zipCode.length !== 8) return showError('Informe um CEP com 8 dígitos.', field('zipCode'));
    const payload = {
      name: value('name'), email: value('email'), phone, zipCode,
      address: `${value('address')} — ${value('district')}, ${value('city')}/${value('state')}`,
      quantity: 1,
    };
    busy = true; button.disabled = true; button.textContent = 'Abrindo o pagamento…'; form.setAttribute('aria-busy', 'true');
    let redirecting = false;
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': purchaseKey }, body: JSON.stringify(payload), signal: AbortSignal.timeout(35000) });
      const data = await res.json();
      if (!res.ok) {
        if (data.retryable === true) newKey();
        showError(data.error || 'Não foi possível abrir o pagamento. Tente novamente em instantes.');
        return;
      }
      const url = new URL(data.checkoutUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'app.abacatepay.com' || url.username || url.password || url.port) throw new Error('Destino inválido');
      try { sessionStorage.setItem(`order_token_${data.orderId}`, data.statusToken); } catch {}
      redirecting = true;
      location.assign(url.href);
    } catch {
      showError('Não foi possível confirmar a conexão. Se você já abriu o pagamento, verifique o pedido antes de tentar novamente.');
    } finally {
      if (!redirecting) { busy = false; button.disabled = !window.storeCheckout?.available; button.textContent = 'Continuar para o pagamento →'; form.removeAttribute('aria-busy'); }
    }
  });
})();
