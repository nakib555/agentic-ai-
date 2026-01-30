/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { App } from './components/App/index';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logCollector } from './utils/logCollector';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import './styles/main.css';
import './i18n'; // Initialize i18n

// Start logging immediately to capture startup events
logCollector.start();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent aggressive refetching
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />}>
               <Route path="chat/:chatId" element={<App />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
