(function () {
  'use strict';
  HaloAdmin.requireAuth();

  const { apiFetch } = HaloAdmin;
  const toastEl = document.getElementById('toast');

  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;
    setTimeout(() => { toastEl.className = 'toast'; }, 3000);
  }

  document.getElementById('logout-btn').addEventListener('click', HaloAdmin.logout);

  // ---------------- Navegação de painéis ----------------
  const navButtons = document.querySelectorAll('.sidebar-nav button');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      navButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      document.getElementById(`panel-${btn.dataset.panel}`).classList.add('active');
      if (btn.dataset.panel === 'coupons') loadCoupons();
    });
  });

  const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  // ---------------- VISÃO GERAL ----------------
  let chartVisitsSales, chartRevenue, chartDevices;

  async function loadOverview() {
    try {
      const summary = await apiFetch('/api/analytics/summary?days=30');
      const t = summary.totals;

      const cards = document.querySelectorAll('#metric-grid .metric-value');
      const values = [
        t.visits, t.uniqueVisitors, t.buyClicks, t.checkoutStarted,
        t.paymentApproved, t.paymentRefused, `${t.conversionRate}%`, formatBRL(t.revenue),
      ];
      cards.forEach((el, i) => {
        el.classList.remove('skeleton');
        el.textContent = values[i];
      });

      const days = Object.keys(summary.byDay).sort();
      const visits = days.map((d) => summary.byDay[d].visits);
      const sales = days.map((d) => summary.byDay[d].sales);
      const revenue = days.map((d) => summary.byDay[d].revenue);

      if (chartVisitsSales) chartVisitsSales.destroy();
      chartVisitsSales = new Chart(document.getElementById('chart-visits-sales'), {
        type: 'line',
        data: {
          labels: days,
          datasets: [
            { label: 'Visitas', data: visits, borderColor: '#9FC3EA', backgroundColor: 'transparent', tension: 0.35 },
            { label: 'Vendas', data: sales, borderColor: '#E8A94A', backgroundColor: 'transparent', tension: 0.35 },
          ],
        },
        options: chartOptions(),
      });

      if (chartRevenue) chartRevenue.destroy();
      chartRevenue = new Chart(document.getElementById('chart-revenue'), {
        type: 'bar',
        data: { labels: days, datasets: [{ label: 'Faturamento', data: revenue, backgroundColor: '#E8A94A' }] },
        options: chartOptions(),
      });

      const deviceLabels = Object.keys(summary.devices);
      const deviceValues = deviceLabels.map((k) => summary.devices[k]);
      if (chartDevices) chartDevices.destroy();
      chartDevices = new Chart(document.getElementById('chart-devices'), {
        type: 'doughnut',
        data: {
          labels: deviceLabels.length ? deviceLabels : ['Sem dados'],
          datasets: [{ data: deviceValues.length ? deviceValues : [1], backgroundColor: ['#E8A94A', '#9FC3EA', '#6FCF97', '#E8746A'] }],
        },
        options: { plugins: { legend: { labels: { color: '#9AA0AC' } } } },
      });

      const orders = await apiFetch('/api/analytics/recent-orders');
      const tbody = document.querySelector('#recent-orders-table tbody');
      tbody.innerHTML = orders.map((o) => `
        <tr>
          <td>${escapeHtml(o.customer?.name || '—')}</td>
          <td>${escapeHtml(o.quantity)}</td>
          <td>${formatBRL(o.total)}</td>
          <td><span class="badge ${o.status === 'paid' ? 'paid' : o.status === 'refused' ? 'refused' : 'pending'}">${statusLabel(o.status)}</span></td>
          <td>${formatDate(o.createdAt)}</td>
        </tr>
      `).join('') || `<tr><td colspan="5" class="empty-state">Nenhuma venda ainda.</td></tr>`;
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  }

  function chartOptions() {
    return {
      scales: {
        x: { ticks: { color: '#5B6270' }, grid: { color: '#2A2E37' } },
        y: { ticks: { color: '#5B6270' }, grid: { color: '#2A2E37' } },
      },
      plugins: { legend: { labels: { color: '#9AA0AC' } } },
    };
  }
  function statusLabel(s) { return s === 'paid' ? 'Pago' : s === 'refused' ? 'Recusado' : 'Pendente'; }
  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('pt-BR');
  }
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // ---------------- PRODUTO ----------------
  let currentProduct = {};

  function listEditor(containerId, items, fields, rowTemplate) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach((item, idx) => container.appendChild(rowTemplate(item, idx)));
    return container;
  }

  function benefitRow(item = { title: '', text: '' }) {
    const row = document.createElement('div');
    row.className = 'list-editor-row';
    row.innerHTML = `
      <input placeholder="Título" class="b-title" value="${escapeAttr(item.title)}">
      <input placeholder="Texto" class="b-text" value="${escapeAttr(item.text)}">
      <button type="button" class="icon-btn" title="Remover">✕</button>
    `;
    row.querySelector('.icon-btn').addEventListener('click', () => row.remove());
    return row;
  }
  function specRow(item = { label: '', value: '' }) {
    const row = document.createElement('div');
    row.className = 'list-editor-row';
    row.innerHTML = `
      <input placeholder="Especificação" class="s-label" value="${escapeAttr(item.label)}">
      <input placeholder="Valor" class="s-value" value="${escapeAttr(item.value)}">
      <button type="button" class="icon-btn" title="Remover">✕</button>
    `;
    row.querySelector('.icon-btn').addEventListener('click', () => row.remove());
    return row;
  }
  function faqRow(item = { q: '', a: '' }) {
    const row = document.createElement('div');
    row.className = 'list-editor-row';
    row.innerHTML = `
      <input placeholder="Pergunta" class="f-q" value="${escapeAttr(item.q)}">
      <input placeholder="Resposta" class="f-a" value="${escapeAttr(item.a)}">
      <button type="button" class="icon-btn" title="Remover">✕</button>
    `;
    row.querySelector('.icon-btn').addEventListener('click', () => row.remove());
    return row;
  }
  function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  document.getElementById('add-benefit-btn').addEventListener('click', () => {
    document.getElementById('benefits-editor').appendChild(benefitRow());
  });
  document.getElementById('add-spec-btn').addEventListener('click', () => {
    document.getElementById('specs-editor').appendChild(specRow());
  });
  document.getElementById('add-faq-btn').addEventListener('click', () => {
    document.getElementById('faq-editor').appendChild(faqRow());
  });

  async function loadProduct() {
    try {
      currentProduct = await apiFetch('/api/product');
      document.getElementById('p-name').value = currentProduct.name || '';
      document.getElementById('p-subtitle').value = currentProduct.subtitle || '';
      document.getElementById('p-price').value = currentProduct.price || '';
      document.getElementById('p-price-promo').value = currentProduct.pricePromo || '';
      document.getElementById('p-description').value = currentProduct.description || '';
      document.getElementById('p-gallery').value = (currentProduct.gallery || []).join('\n');
      document.getElementById('p-video').value = currentProduct.video || '';
      document.getElementById('p-warranty').value = currentProduct.warranty || '';
      document.getElementById('p-delivery').value = currentProduct.delivery || '';
      document.getElementById('p-seo-title').value = currentProduct.seo?.title || '';
      document.getElementById('p-seo-slug').value = currentProduct.seo?.slug || '';
      document.getElementById('p-seo-desc').value = currentProduct.seo?.metaDescription || '';
      document.getElementById('p-seo-og').value = currentProduct.seo?.ogImage || '';

      listEditor('benefits-editor', currentProduct.benefits || [], null, benefitRow);
      listEditor('specs-editor', currentProduct.specs || [], null, specRow);
      listEditor('faq-editor', currentProduct.faq || [], null, faqRow);

      document.getElementById('s-available').value = currentProduct.stockAvailable ?? 0;
      document.getElementById('s-sold').value = currentProduct.stockSold ?? 0;
      updateStockAlert();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('save-product-btn').addEventListener('click', async () => {
    const benefits = Array.from(document.querySelectorAll('#benefits-editor .list-editor-row')).map((row) => ({
      title: row.querySelector('.b-title').value.trim(),
      text: row.querySelector('.b-text').value.trim(),
    })).filter((b) => b.title || b.text);

    const specs = Array.from(document.querySelectorAll('#specs-editor .list-editor-row')).map((row) => ({
      label: row.querySelector('.s-label').value.trim(),
      value: row.querySelector('.s-value').value.trim(),
    })).filter((s) => s.label || s.value);

    const faq = Array.from(document.querySelectorAll('#faq-editor .list-editor-row')).map((row) => ({
      q: row.querySelector('.f-q').value.trim(),
      a: row.querySelector('.f-a').value.trim(),
    })).filter((f) => f.q || f.a);

    const payload = {
      name: document.getElementById('p-name').value.trim(),
      subtitle: document.getElementById('p-subtitle').value.trim(),
      price: Number(document.getElementById('p-price').value) || 0,
      pricePromo: Number(document.getElementById('p-price-promo').value) || null,
      description: document.getElementById('p-description').value.trim(),
      gallery: document.getElementById('p-gallery').value.split('\n').map((s) => s.trim()).filter(Boolean),
      video: document.getElementById('p-video').value.trim() || null,
      benefits, specs, faq,
      warranty: document.getElementById('p-warranty').value.trim(),
      delivery: document.getElementById('p-delivery').value.trim(),
      seo: {
        title: document.getElementById('p-seo-title').value.trim(),
        slug: document.getElementById('p-seo-slug').value.trim(),
        metaDescription: document.getElementById('p-seo-desc').value.trim(),
        ogImage: document.getElementById('p-seo-og').value.trim(),
      },
    };

    try {
      await apiFetch('/api/product', { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Produto salvo com sucesso.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------------- ESTOQUE ----------------
  function updateStockAlert() {
    const available = Number(document.getElementById('s-available').value) || 0;
    const alertEl = document.getElementById('stock-alert');
    alertEl.textContent = available <= 0
      ? '⚠ Produto esgotado — a compra ficará indisponível na loja.'
      : available <= 15
        ? `Atenção: restam apenas ${available} unidades.`
        : '';
  }
  document.getElementById('s-available').addEventListener('input', updateStockAlert);

  document.getElementById('save-stock-btn').addEventListener('click', async () => {
    try {
      await apiFetch('/api/product/stock', {
        method: 'PATCH',
        body: JSON.stringify({
          available: Number(document.getElementById('s-available').value) || 0,
          sold: Number(document.getElementById('s-sold').value) || 0,
        }),
      });
      showToast('Estoque atualizado.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------------- CUPONS ----------------
  async function loadCoupons() {
    try {
      const coupons = await apiFetch('/api/coupons');
      const tbody = document.querySelector('#coupons-table tbody');
      tbody.innerHTML = coupons.map((c) => `
        <tr>
          <td><strong>${escapeHtml(c.code)}</strong></td>
          <td>${c.type === 'percent' ? 'Percentual' : 'Fixo'}</td>
          <td>${c.type === 'percent' ? escapeHtml(c.value) + '%' : formatBRL(c.value)}</td>
          <td>${escapeHtml(c.usedCount || 0)}${c.maxUses ? ' / ' + escapeHtml(c.maxUses) : ''}</td>
          <td>${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('pt-BR') : 'Sem validade'}</td>
          <td><span class="badge ${c.active ? 'paid' : 'refused'}">${c.active ? 'Ativo' : 'Inativo'}</span></td>
          <td><button class="icon-btn" data-code="${escapeAttr(c.code)}" title="Excluir">✕</button></td>
        </tr>
      `).join('') || `<tr><td colspan="7" class="empty-state">Nenhum cupom criado ainda.</td></tr>`;

      tbody.querySelectorAll('.icon-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await apiFetch(`/api/coupons/${btn.dataset.code}`, { method: 'DELETE' });
            showToast('Cupom excluído.');
            loadCoupons();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('save-coupon-btn').addEventListener('click', async () => {
    const payload = {
      code: document.getElementById('c-code').value.trim(),
      type: document.getElementById('c-type').value,
      value: Number(document.getElementById('c-value').value),
      maxUses: document.getElementById('c-max-uses').value ? Number(document.getElementById('c-max-uses').value) : null,
      expiresAt: document.getElementById('c-expires').value || null,
      active: true,
    };
    if (!payload.code || !payload.value) return showToast('Preencha código e valor do cupom.', 'error');
    try {
      await apiFetch('/api/coupons', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Cupom criado.');
      document.getElementById('c-code').value = '';
      document.getElementById('c-value').value = '';
      document.getElementById('c-max-uses').value = '';
      document.getElementById('c-expires').value = '';
      loadCoupons();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------------- CONFIGURAÇÕES ----------------
  async function loadSettings() {
    try {
      const s = await apiFetch('/api/settings');
      document.getElementById('set-store-name').value = s.storeName || '';
      document.getElementById('set-color-primary').value = s.colors?.primary || '';
      document.getElementById('set-logo').value = s.logo || '';
      document.getElementById('set-favicon').value = s.favicon || '';
      document.getElementById('set-whatsapp').value = s.whatsapp || '';
      document.getElementById('set-instagram').value = s.instagram || '';
      document.getElementById('set-email').value = s.email || '';
      document.getElementById('set-phone').value = s.phone || '';
      document.getElementById('set-meta-pixel').value = s.pixels?.metaPixelId || '';
      document.getElementById('set-ga').value = s.pixels?.googleAnalyticsId || '';
      document.getElementById('set-gtm').value = s.pixels?.googleTagManagerId || '';
      document.getElementById('set-tiktok').value = s.pixels?.tiktokPixelId || '';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const payload = {
      storeName: document.getElementById('set-store-name').value.trim(),
      colors: { primary: document.getElementById('set-color-primary').value.trim() || '#E8A94A' },
      logo: document.getElementById('set-logo').value.trim(),
      favicon: document.getElementById('set-favicon').value.trim(),
      whatsapp: document.getElementById('set-whatsapp').value.trim(),
      instagram: document.getElementById('set-instagram').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      phone: document.getElementById('set-phone').value.trim(),
      pixels: {
        metaPixelId: document.getElementById('set-meta-pixel').value.trim(),
        googleAnalyticsId: document.getElementById('set-ga').value.trim(),
        googleTagManagerId: document.getElementById('set-gtm').value.trim(),
        tiktokPixelId: document.getElementById('set-tiktok').value.trim(),
      },
    };
    try {
      await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Configurações salvas.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------------- Inicialização ----------------
  loadOverview();
  loadProduct();
  loadSettings();
})();
