(async () => {
  const id = new URLSearchParams(location.search).get('orderId');
  const message = document.querySelector('.status-text');
  if (!id || !/^[a-f0-9]{64}$/.test(id)) {
    message.textContent = 'Abra o link do pedido na mesma aba em que iniciou a compra. Se já pagou, consulte o atendimento antes de tentar novamente.';
    return;
  }
  document.getElementById('order-id').textContent = 'Pedido #' + id.slice(0, 12);
  let token;
  try { token = sessionStorage.getItem(`order_token_${id}`); } catch {}
  if (!token) {
    message.textContent = 'Não foi possível consultar este pedido. Abra esta página na mesma aba da compra ou consulte o atendimento.';
    return;
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const res = await fetch(`/api/checkout/${id}/status`, { headers: { 'X-Order-Token': token }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('Consulta indisponível');
      const data = await res.json();
      if (data.status === 'paid') {
        document.querySelector('.status-title').textContent = data.testMode ? 'Pagamento de teste confirmado' : 'Pagamento confirmado';
        message.textContent = data.testMode ? 'Esta compra foi simulada. Nenhum envio será realizado.' : 'Seu pedido seguirá para preparação e envio. A entrega é grátis, em até 7 dias após a confirmação do pagamento.';
        try { sessionStorage.removeItem('purchase_key'); } catch {}
        return;
      }
      if (['refunded', 'disputed', 'refused'].includes(data.status)) {
        document.querySelector('.status-title').textContent = { refunded: 'Pagamento reembolsado', disputed: 'Pagamento em análise', refused: 'Pagamento não aprovado' }[data.status];
        document.querySelector('.status-text').textContent = 'Entre em contato com a loja para acompanhar este pedido.';
        return;
      }
    } catch { /* Retry transient failures without creating another payment. */ }
    if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  document.querySelector('.status-title').textContent = 'Confirmação ainda não recebida';
  message.textContent = 'Se já pagou, não faça um novo pagamento. Atualize esta página em alguns instantes ou consulte o atendimento informando o número do pedido.';
})();
