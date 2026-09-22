(async () => {
  const id = new URLSearchParams(location.search).get('orderId');
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return;
  document.getElementById('order-id').textContent = 'Pedido #' + id.slice(0, 12);
  let token;
  try { token = sessionStorage.getItem(`order_token_${id}`); } catch {}
  if (!token) return;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const res = await fetch(`/api/checkout/${id}/status`, { headers: { 'X-Order-Token': token } });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'paid') {
        document.querySelector('.status-title').textContent = data.testMode ? 'Pagamento de teste confirmado' : 'Pagamento confirmado';
        document.querySelector('.status-text').textContent = data.testMode ? 'Esta compra foi simulada no ambiente de testes. Nenhum envio sera realizado.' : 'Seu pagamento foi confirmado. Seu pedido seguira para preparacao e envio.';
        sessionStorage.removeItem('purchase_key');
        return;
      }
      if (['refunded', 'disputed', 'refused'].includes(data.status)) {
        document.querySelector('.status-title').textContent = 'Pedido em revisao';
        document.querySelector('.status-text').textContent = 'Entre em contato com a loja para acompanhar este pedido.';
        return;
      }
    } catch { return; }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
})();
