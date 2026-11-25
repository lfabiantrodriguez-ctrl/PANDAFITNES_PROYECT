export const DashboardService = {
  async getMetrics(token, params = {}) {
    const qs = new URLSearchParams();
    if (params.month) qs.set('month', params.month);
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    const response = await fetch(`/api/admin/dashboard/metricas${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'No se pudieron cargar las métricas reales del dashboard');
    }
    return response.json();
  },
};
