import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';

// Mock AzureAuthContext
vi.mock('./contexts/AzureAuthContext', () => ({
  useAzureAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    isAdmin: false,
    logout: vi.fn(),
    login: vi.fn(),
  }),
}));

// Mock the useQuote hooks
vi.mock('./hooks/useQuote', () => ({
  useQuote: () => ({
    quote: null,
    displayQuote: null,
    loading: false,
    error: null,
    fetchNewQuote: vi.fn(),
    likeQuote: vi.fn(),
    navigatePrevious: vi.fn(),
    navigateNext: vi.fn(),
    navigateFirst: vi.fn(),
    navigateLast: vi.fn(),
    canNavigatePrevious: false,
    canNavigateNext: false,
    currentQuoteId: null,
    receivedQuotes: [],
  }),
  useUserProgress: () => ({
    data: { lastQuoteId: 0, username: 'testuser', updatedAt: Date.now() },
    isLoading: false,
    error: null,
  }),
  useAuthenticatedQuote: () => ({
    quote: null,
    displayQuote: null,
    loading: false,
    error: null,
    fetchNewQuote: vi.fn(),
    likeQuote: vi.fn(),
    navigatePrevious: vi.fn(),
    navigateNext: vi.fn(),
    navigateFirst: vi.fn(),
    navigateLast: vi.fn(),
    canNavigatePrevious: false,
    canNavigateNext: false,
    currentQuoteId: null,
    receivedQuotes: [],
  }),
}));

// Mock components
vi.mock('./components/FavouritesComponent.tsx', () => ({
  default: () => <div data-testid="favourites-component">Favourites</div>,
}));

vi.mock('./components/AzureLogin.tsx', () => ({
  AzureLogin: () => <div data-testid="login-component">Login</div>,
}));

describe('App Component', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByText('CODE-BULTER')).toBeInTheDocument();
    expect(screen.getByText('Quote')).toBeInTheDocument();
  });

  it('should display the loading state initially', () => {
    render(<App />);
    expect(screen.getByText('"Loading..."')).toBeInTheDocument();
  });

  it('should render the FavouritesComponent', () => {
    render(<App />);
    expect(screen.getByTestId('favourites-component')).toBeInTheDocument();
  });

  it('should render navigation buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /first/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /last/i })).toBeInTheDocument();
  });

  it('should render the login button when not authenticated', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
