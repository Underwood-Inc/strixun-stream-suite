import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { App } from './App';
import { GlobalStyle } from './theme';

// Create a query client with sane defaults to prevent infinite refetch loops
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // Data stays fresh for 30 seconds
      gcTime: 300000, // Keep data in cache for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on window focus (prevents spam)
      refetchOnMount: false, // Don't refetch on mount if data is fresh
      retry: 1, // Only retry once on failure (prevents infinite retries)
      retryDelay: 1000, // Wait 1 second before retry
    },
  },
});

// Global click ripple effect - subtle pointer feedback
function setupGlobalClickRipple() {
  const handleClick = (e: MouseEvent) => {
    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    
    const x = e.clientX;
    const y = e.clientY;
    
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    document.body.appendChild(ripple);
    
    // Remove after animation completes
    setTimeout(() => {
      ripple.remove();
    }, 400);
  };

  document.addEventListener('click', handleClick);
  
  return () => {
    document.removeEventListener('click', handleClick);
  };
}

function AppWithRipple() {
  useEffect(() => {
    const cleanup = setupGlobalClickRipple();
    return cleanup;
  }, []);

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <GlobalStyle />
        <AppWithRipple />
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);

