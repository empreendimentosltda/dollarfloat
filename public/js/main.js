(() => {
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const button = document.getElementById('submit-btn');
  const status = document.getElementById('store-status');
  const stock = document.getElementById('checkout-stock');
  const testRequested = new URLSearchParams(location.search).get('teste') === '1';
  window.storeCheckout = { available: false, busy: false };
  async function loadProduct() {
    try {
      const res = await fetch('/api/product', { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error('Produto indisponível');
      const product = await res.json();
      const price = product.pricePromo ?? product.price;
      if (!Number.isFinite(price) || price < 1) throw new Error('Preço indisponível');
      document.querySelectorAll('#price-display, #checkout-price, #item-price, .mobile-buy strong').forEach(el => { el.textContent = money(price); });
      let allowed = product.checkoutEnabled;
      if (testRequested && product.testMode && product.testCheckoutEnabled) {
        const auth = await fetch('/api/admin/me');
        allowed = auth.ok;
        if (allowed) status.textContent = 'Compra de teste: não há cobrança real nem envio de produto.';
        else status.textContent = 'Entre no painel administrativo para testar o pagamento.';
      } else {
        status.textContent = allowed ? 'Frete grátis. Total do pedido: ' + money(price) + '.' : 'Estamos preparando a loja. As compras serão liberadas em breve.';
      }
      const inStock = Number.isSafeInteger(product.stockAvailable) && product.stockAvailable > 0;
      stock.textContent = inStock ? 'Produto disponível em estoque' : 'Produto esgotado no momento';
      window.storeCheckout.available = Boolean(allowed && inStock);
      button.disabled = !window.storeCheckout.available;
      button.textContent = !inStock ? 'Produto esgotado' : allowed ? 'Continuar para o pagamento →' : 'Vendas em breve';
      const video = document.getElementById('hero-video');
      if (product.video && new URL(product.video, location.origin).href !== video.src) video.src = product.video;
    } catch {
      window.storeCheckout.available = false;
      button.disabled = true;
      button.textContent = 'Compra temporariamente indisponível';
      status.textContent = 'Não foi possível verificar a disponibilidade. Atualize a página em alguns instantes.';
      stock.textContent = 'Disponibilidade não confirmada';
    }
  }
  loadProduct();
  const video = document.getElementById('hero-video');
  const play = document.querySelector('.video-toggle');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { video.autoplay = false; video.pause(); }
  function updatePlay() { play.textContent = video.paused ? 'Reproduzir' : 'Pausar'; play.setAttribute('aria-label', video.paused ? 'Reproduzir vídeo' : 'Pausar vídeo'); }
  video.addEventListener('play', updatePlay); video.addEventListener('pause', updatePlay); updatePlay();
  play.addEventListener('click', () => { if (video.paused) video.play().catch(() => { play.textContent = 'Reproduzir'; }); else video.pause(); });
  document.querySelector('.sound-toggle').addEventListener('click', e => {
    video.muted = !video.muted;
    e.currentTarget.textContent = video.muted ? 'Ativar som' : 'Desativar som';
    e.currentTarget.setAttribute('aria-label', e.currentTarget.textContent + ' do vídeo');
    e.currentTarget.setAttribute('aria-pressed', String(!video.muted));
  });
  let tracked = false;
  document.querySelectorAll('a[href="#comprar"]').forEach(el => el.addEventListener('click', () => {
    if (tracked) return; tracked = true;
    fetch('/api/analytics/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'buy_click' }) }).catch(() => {});
  }));
  document.getElementById('year').textContent = new Date().getFullYear();
})();
