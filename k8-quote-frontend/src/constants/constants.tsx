export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071').replace(/\/$/, '');
export const SSE_URL = BASE_URL + "/quote/stream";
