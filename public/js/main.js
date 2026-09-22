(() => {
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  fetch('/api/product').then(r => r.ok ? r.json() : null).then(product => {
    if (!product) throw new Error('Produto indisponivel');
    const button = document.getElementById('submit-btn');
    button.disabled = !product.checkoutEnabled;
    if (!product.checkoutEnabled) button.textContent = 'Vendas em breve';
    const price = product.pricePromo || product.price;
    document.querySelectorAll('#price-display, #checkout-price, .mobile-buy strong').forEach(el => el.textContent = money(price));
    const video = document.getElementById('hero-video');
    if (video && product.video) video.src = product.video;
    const stock = document.getElementById('checkout-stock');
    if (stock && product.stockAvailable <= 0) { stock.textContent = 'Produto esgotado no momento.'; document.getElementById('submit-btn').disabled = true; }
  }).catch(() => { document.getElementById('submit-btn').disabled = true; document.getElementById('submit-btn').textContent = 'Compra temporariamente indisponivel'; });
  const video = document.getElementById('hero-video');
  document.querySelector('.sound-toggle')?.addEventListener('click', e => { video.muted = !video.muted; e.currentTarget.textContent = video.muted ? 'Ativar som' : 'Desativar som'; });
  document.querySelectorAll('a[href="#comprar"]').forEach(el => el.addEventListener('click', () => fetch('/api/analytics/track', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'buy_click'})}).catch(() => {})));
  document.getElementById('year').textContent = new Date().getFullYear();
})();
