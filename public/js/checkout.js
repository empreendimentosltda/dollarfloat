(function () {
  'use strict';

  const form = document.getElementById('checkout-form');
  const errorEl = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  let purchaseKey;
  try { purchaseKey = sessionStorage.getItem('purchase_key'); } catch {}
  purchaseKey ||= crypto.randomUUID();
  try { sessionStorage.setItem('purchase_key', purchaseKey); } catch {}

  function maskZip(value) {
    return value.replace(/\D/g, '').slice(0, 8);
  }
  function maskCpf(value) {
    return value.replace(/\D/g, '').slice(0, 11);
  }

  document.getElementById('zipCode').addEventListener('input', (e) => {
    e.target.value = maskZip(e.target.value);
  });
  document.getElementById('cpf').addEventListener('input', (e) => {
    e.target.value = maskCpf(e.target.value);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      cpf: form.cpf.value.trim(),
      zipCode: form.zipCode.value.trim(),
      address: form.address.value.trim(),
      quantity: Number(form.quantity.value) || 1,
      couponCode: form.couponCode.value.trim(),
    };

    if (!payload.name || payload.name.length < 3) return showError('Informe seu nome completo.');
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) return showError('Informe um e-mail válido.');
    if (payload.phone.replace(/\D/g, '').length < 10) return showError('Informe um telefone válido com DDD.');
    if (payload.zipCode.length !== 8) return showError('Informe um CEP válido (8 dígitos).');
    if (!payload.address) return showError('Informe o endereço completo.');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processando...';

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': purchaseKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Não foi possível iniciar o checkout.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Finalizar compra';
        return;
      }

      try { sessionStorage.setItem(`order_token_${data.orderId}`, data.statusToken); } catch {}
      const url = new URL(data.checkoutUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'app.abacatepay.com') throw new Error('Destino invalido.');
      window.location.href = url.href;
    } catch (err) {
      showError('Erro de conexão. Verifique sua internet e tente novamente.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Finalizar compra';
    }
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
