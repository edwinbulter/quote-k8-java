import { BASE_URL } from "../constants/constants";
import {Quote} from "../types/Quote.ts";
import { withRetry } from '../utils/apiRetry';
import { notifyBackendRestart } from '../components/BackendRestartNotification';

// Base API URL without /quote suffix
const API_BASE_URL = BASE_URL;

// Helper function to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
    try {
        // Get JWT token from localStorage for Azure authentication
        const token = localStorage.getItem('jwt_token');
        if (token) {
            return {
                'Authorization': `Bearer ${token}`,
            };
        }
    } catch (error) {
        console.error('Failed to get auth token:', error);
    }
    return {};
}

// Helper function to transform backend response to frontend format
function transformQuote(backendQuote: any): Quote {
    return {
        id: backendQuote.quoteId || backendQuote.id || backendQuote.Id,
        quoteText: backendQuote.quoteText || backendQuote.QuoteText,
        author: backendQuote.author || backendQuote.Author,
        liked: backendQuote.liked || backendQuote.Liked || false
    };
}

// Define the functions with explicit parameter and return types
async function getQuote(): Promise<Quote> {
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quotes/random`, {
                method: "GET",
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch quote: ${response.status} ${response.statusText}`);
            }
            
            const backendQuote = await response.json();
            return transformQuote(backendQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getQuote (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function getUniqueQuote(receivedQuotes: Quote[]): Promise<Quote> {
    // Filter out quotes without IDs and map to valid IDs
    const quoteIds = receivedQuotes 
        ? receivedQuotes
            .filter(quote => quote && quote.id !== undefined && quote.id !== null)
            .map(quote => quote.id)
        : [];
    
    const body = JSON.stringify(quoteIds);
    console.log('Sending quoteIds to backend:', quoteIds);
    console.log('Request body:', body);
    
    return withRetry(
        async () => {
            const authHeaders = await getAuthHeaders();
            const headers = {
                'Content-Type': 'application/json',
                ...(authHeaders && Object.keys(authHeaders).length > 0 ? authHeaders : {}),
            };
            console.log('Request headers:', headers);
            
            const response = await fetch(`${API_BASE_URL}/quote`, {
                method: "POST",
                headers,
                body,
            });
            
            if (!response.ok) {
                console.error('Response status:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Error response body:', errorText);
                throw new Error(`Failed to fetch quote: ${response.status} ${response.statusText}`);
            }
            
            const backendQuote = await response.json();
            return transformQuote(backendQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getUniqueQuote (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function likeQuote(quote: Quote): Promise<Quote> {
    return withRetry(
        async () => {
            // Check if user is authenticated (re-evaluated on each retry)
            const authHeaders = await getAuthHeaders();
            if (!authHeaders || !('Authorization' in authHeaders)) {
                throw new Error('User not authenticated');
            }
            
            const response = await fetch(`${API_BASE_URL}/quote/${quote.id}/like`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to like quote: ${response.status} ${response.statusText}`);
            }
            
            const backendQuote = await response.json();
            return transformQuote(backendQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying likeQuote (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function getLikedQuotes(): Promise<Quote[]> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            // Check if user is authenticated (re-evaluated on each retry)
            if (!authHeaders || !('Authorization' in authHeaders)) {
                console.log('User not authenticated, returning empty liked quotes');
                return [];
            }
            
            const response = await fetch(`${API_BASE_URL}/quote/liked`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch liked quotes: ${response.status} ${response.statusText}`);
            }
            
            const quotes = await response.json();
            return quotes.map(transformQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getLikedQuotes (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

/**
 * Get a quote for authenticated users
 * Backend automatically records view and excludes already viewed quotes
 */
async function getAuthenticatedQuote(): Promise<Quote> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quote`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch quote: ${response.status} ${response.statusText}`);
            }
            
            const backendQuote = await response.json();
            return transformQuote(backendQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getAuthenticatedQuote (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function unlikeQuote(quoteId: number): Promise<void> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quote/${quoteId}/unlike`, {
                method: "DELETE",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to unlike quote: ${response.status} ${response.statusText}`);
            }
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying unlikeQuote (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function reorderLikedQuote(quoteId: number, order: number): Promise<void> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quote/${quoteId}/reorder`, {
                method: "PUT",
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                },
                body: JSON.stringify({ newPosition: order }),
            });
            
            if (!response.ok) {
                throw new Error(`Failed to reorder quote: ${response.status} ${response.statusText}`);
            }
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying reorderLikedQuote (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

// New sequential navigation API functions

/**
 * Get a specific quote by ID
 */
async function getQuoteById(quoteId: number): Promise<Quote> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quotes/${quoteId}`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch quote: ${response.status} ${response.statusText}`);
            }
            
            const backendQuote = await response.json();
            return transformQuote(backendQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getQuoteById (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

/**
 * Get previous quote for sequential navigation
 */
async function getPreviousQuote(currentQuoteId: number): Promise<Quote> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quote/${currentQuoteId}/previous`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch previous quote: ${response.status} ${response.statusText}`);
            }
            
            const backendQuote = await response.json();
            return transformQuote(backendQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getPreviousQuote (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

/**
 * Get next quote for sequential navigation (authenticated users)
 */
async function getNextAuthenticatedQuote(currentQuoteId: number): Promise<Quote> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quote/${currentQuoteId}/next`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch next quote: ${response.status} ${response.statusText}`);
            }
            
            const backendQuote = await response.json();
            return transformQuote(backendQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getNextAuthenticatedQuote (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

/**
 * Get user's current progress (lastQuoteId)
 */
async function getUserProgress(): Promise<{ lastQuoteId: number; username: string; updatedAt: number }> {
    return withRetry(
        async () => {
            // Check if user is authenticated (re-evaluated on each retry)
            const authHeaders = await getAuthHeaders();
            if (!authHeaders || !('Authorization' in authHeaders)) {
                console.log('User not authenticated, returning default progress');
                return { lastQuoteId: 0, username: '', updatedAt: 0 };
            }
            
            const response = await fetch(`${API_BASE_URL}/quote/progress`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch user progress: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getUserProgress (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

/**
 * Get all viewed quotes (1 to lastQuoteId)
 */
async function getViewedQuotes(): Promise<Quote[]> {
    const authHeaders = await getAuthHeaders();
    
    if (!authHeaders || !('Authorization' in authHeaders)) {
        console.log('User not authenticated, returning empty viewed quotes');
        return [];
    }
    
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quote/viewed`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch viewed quotes: ${response.status} ${response.statusText}`);
            }
            const quotes = await response.json();
            return quotes.map(transformQuote);
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getViewedQuotes (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function deleteAllViewedQuotes(): Promise<void> {
    const authHeaders = await getAuthHeaders();
    
    if (!authHeaders || !('Authorization' in authHeaders)) {
        throw new Error('User not authenticated');
    }
    
    return withRetry(
        async () => {
            const response = await fetch(`${API_BASE_URL}/quote/viewed`, {
                method: "DELETE",
                headers: {
                    ...authHeaders,
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to delete all viewed quotes: ${response.status} ${response.statusText}`);
            }
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying deleteAllViewedQuotes (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

export default {
    getQuote,
    getUniqueQuote,
    getAuthenticatedQuote,
    likeQuote,
    unlikeQuote,
    getLikedQuotes,
    reorderLikedQuote,
    // Sequential navigation functions
    getQuoteById,
    getPreviousQuote,
    getNextAuthenticatedQuote,
    getUserProgress,
    getViewedQuotes,
    deleteAllViewedQuotes,
};