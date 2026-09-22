import { expect, afterEach, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactElement } from 'react';

// Mock Vite environment variables
vi.stubEnv('VITE_REACT_APP_API_BASE_URL', 'http://localhost:7071');

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Create a test QueryClient
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Custom render function that includes providers
export const renderWithProviders = (ui: ReactElement, options: { queryClient?: QueryClient } = {}) => {
  const { queryClient = createTestQueryClient() } = options;
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      ui
    )
  );
};
