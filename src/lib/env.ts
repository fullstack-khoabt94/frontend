/**
 * Central place for every environment flag the app reads.
 * Keeping it in one module means wiring a real backend is a one-file change.
 */
export const env = {
  /** Base URL of the REST API, e.g. https://api.example.com/v1 */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  /**
   * While true, axios is served by the in-browser mock adapter
   * (src/lib/api/mock-adapter.ts) instead of the network.
   * Set VITE_USE_MOCK_API=false once the real backend is available.
   */
  useMockApi: import.meta.env.VITE_USE_MOCK_API !== 'false',
} as const
