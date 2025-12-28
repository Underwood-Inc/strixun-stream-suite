import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { App } from './App';
import { GlobalStyle } from './theme';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Data is immediately stale - always refetch
      gcTime: 0, // Don't keep data in cache
      refetchOnWindowFocus: true, // Refetch when window regains focus
      refetchOnMount: 'always', // Always refetch when component mounts
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <GlobalStyle />
        <App />
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);

