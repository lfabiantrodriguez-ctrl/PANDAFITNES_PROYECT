export const DashboardService = {
  async getMetrics(token) {
    const response = await fetch('/api/admin/dashboard/metricas', {
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
