import { BASE_URL } from "../constants/constants";
import { withRetry } from '../utils/apiRetry';
import { notifyBackendRestart } from '../components/BackendRestartNotification';

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

export interface UserInfo {
    username: string;
    email: string;
    roles: string[];
    enabled: boolean;
    userStatus: string;
    userCreateDate?: string;
    userLastModifiedDate?: string;
}

export interface QuoteWithLikeCount {
    quoteId: number;
    quoteText: string;
    author: string;
    likeCount: number;
    createdAt?: string;
    source?: string;
}

export interface QuotePageResponse {
    quotes: QuoteWithLikeCount[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface QuoteAddResponse {
    quotesAdded: number;
    totalQuotes: number;
    message: string;
}

async function listUsers(): Promise<UserInfo[]> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${BASE_URL}/manage/users`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying listUsers (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function addUserToGroup(username: string, groupName: string): Promise<void> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${BASE_URL}/manage/users/role`, {
                method: "PUT",
                headers: {
                    ...authHeaders,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    role: groupName,
                }),
            });
            
            if (!response.ok) {
                throw new Error(`Failed to add user to group: ${response.status} ${response.statusText}`);
            }
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying addUserToGroup (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function removeUserFromGroup(username: string, groupName: string): Promise<void> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${BASE_URL}/manage/users/role`, {
                method: "DELETE",
                headers: {
                    ...authHeaders,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    role: groupName,
                }),
            });
            
            if (!response.ok) {
                throw new Error(`Failed to remove user from group: ${response.status} ${response.statusText}`);
            }
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying removeUserFromGroup (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function deleteUser(username: string): Promise<void> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${BASE_URL}/manage/users/account`, {
                method: "DELETE",
                headers: {
                    ...authHeaders,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                }),
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Delete user failed:', response.status, errorText);
                throw new Error(`Failed to delete user: ${response.status} - ${errorText}`);
            }
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying deleteUser (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function getQuotes(
    page: number = 1,
    pageSize: number = 50,
    quoteText?: string,
    author?: string,
    sortBy?: string,
    sortOrder?: string
): Promise<QuotePageResponse> {
    const authHeaders = await getAuthHeaders();
    
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (quoteText) params.append('quoteText', quoteText);
    if (author) params.append('author', author);
    if (sortBy) params.append('sortBy', sortBy);
    if (sortOrder) params.append('sortOrder', sortOrder);

    return withRetry(
        async () => {
            const response = await fetch(`${BASE_URL}/manage/quotes?${params.toString()}`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Get quotes failed:', response.status, errorText);
                throw new Error(`Failed to fetch quotes: ${response.status} - ${errorText}`);
            }
            
            return await response.json();
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getQuotes (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function fetchAndAddNewQuotes(): Promise<QuoteAddResponse> {
    const authHeaders = await getAuthHeaders();
    
    return withRetry(
        async () => {
            const response = await fetch(`${BASE_URL}/manage/quotes/fetch`, {
                method: "POST",
                headers: {
                    ...authHeaders,
                },
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Fetch quotes failed:', response.status, errorText);
                throw new Error(`Failed to add quotes: ${response.status} - ${errorText}`);
            }
            
            return await response.json();
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying fetchAndAddNewQuotes (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

async function getTotalLikes(): Promise<{ totalLikes: number; timestamp: string }> {
    const authHeaders = await getAuthHeaders();

    return withRetry(
        async () => {
            const response = await fetch(`${BASE_URL}/manage/stats`, {
                method: "GET",
                headers: {
                    ...authHeaders,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Get total likes failed:', response.status, errorText);
                throw new Error(`Failed to fetch total likes: ${response.status} - ${errorText}`);
            }

            return await response.json();
        },
        {
            onRetry: (attempt, error) => {
                console.log(`Retrying getTotalLikes (attempt ${attempt})...`, error);
                notifyBackendRestart(true, attempt);
            }
        }
    ).finally(() => {
        notifyBackendRestart(false);
    });
}

export default {
    listUsers,
    addUserToGroup,
    removeUserFromGroup,
    deleteUser,
    getQuotes,
    fetchAndAddNewQuotes,
    getTotalLikes,
};
