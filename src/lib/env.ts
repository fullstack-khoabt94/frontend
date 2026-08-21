/**
 * Central place for every environment flag the app reads.
 * Keeping it in one module means repointing the API is a one-file change.
 */
export const env = {
  /** Base URL of the REST API, e.g. https://api.example.com/v1 */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
} as const
