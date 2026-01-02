import React, { useEffect } from 'react';
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

