window.HaloAdmin = (() => {
  sessionStorage.removeItem('halo_admin_token');
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } });
    if (res.status === 401) window.location.href = '/admin/index.html';
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisicao.');
    return data;
  }
  async function requireAuth() { try { await apiFetch('/api/admin/me'); } catch { window.location.href = '/admin/index.html'; } }
  async function logout() { await apiFetch('/api/admin/logout', { method: 'POST', body: '{}' }); window.location.href = '/admin/index.html'; }
  return { apiFetch, requireAuth, logout };
})();
