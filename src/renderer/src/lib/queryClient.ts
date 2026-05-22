import { QueryClient } from '@tanstack/react-query'

/**
 * Shared query client. Tuned for an unattended signage app: data stays fresh
 * for 30s and there is no window-focus refetch (the app runs fullscreen).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 3,
      refetchOnWindowFocus: false
    }
  }
})
