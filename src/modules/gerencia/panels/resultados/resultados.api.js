/** Gerencia › Resultados (0152): la API. Solo superadmin. */
import { httpClient } from '@core/services/httpClient.js';

export const resultadosApi = {
  /** `foco`: desde qué mes valen los avisos (lo de antes se pide solo para comparar). */
  estado: (desde, hasta, foco) => httpClient.get(`/resultados?desde=${desde}&hasta=${hasta}${foco ? `&foco=${foco}` : ''}`),
  configuracion: () => httpClient.get('/resultados/configuracion'),
  guardarTasa: (data) => httpClient.post('/resultados/tasas', data),
  borrarTasa: (id) => httpClient.delete(`/resultados/tasas/${id}`),
  editarRubro: (id, data) => httpClient.patch(`/resultados/rubros/${id}`, data),
  guardarConfig: (data) => httpClient.put('/resultados/configuracion', data),
  guardarEscala: (anio, data) => httpClient.put(`/resultados/escalas/${anio}`, data),
  objetivos: (anio, sucursalId) => httpClient.get(`/resultados/objetivos?anio=${anio}${sucursalId ? `&sucursalId=${sucursalId}` : ''}`),
  guardarObjetivos: (data) => httpClient.put('/resultados/objetivos', data),
};
