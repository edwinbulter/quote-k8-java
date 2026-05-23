import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp as amplifyConfirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  AuthUser
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    userGroups: string[];
    needsUsernameSetup: boolean;
    setNeedsUsernameSetup: (needs: boolean) => void;
    signIn: (username: string, password: string) => Promise<void>;
    signUp: (username: string, password: string, email: string) => Promise<void>;
    signOut: () => Promise<void>;
    confirmSignUp: (username: string, code: string) => Promise<void>;
    hasRole: (role: string) => boolean;
    refreshUserAttributes: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userGroups, setUserGroups] = useState<string[]>([]);
    const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);

    // Check if user is already authenticated on mount
    useEffect(() => {
        checkAuthState();

        // Listen for auth events
        const hubListener = Hub.listen('auth', ({ payload }) => {
            console.log('Auth event:', payload);
            switch (payload.event) {
                case 'signedIn':
                    console.log('User signed in');
                    checkAuthState();
                    break;
                case 'signedOut':
                    console.log('User signed out');
                    setUser(null);
                    setIsAuthenticated(false);
                    setUserGroups([]);
                    break;
                case 'tokenRefresh':
                    console.log('Token refreshed');
                    checkAuthState();
                    break;
                case 'tokenRefresh_failure':
                    console.log('Token refresh failed');
                    setUser(null);
                    setIsAuthenticated(false);
                    setUserGroups([]);
                    break;
            }
        });

        return () => hubListener();
    }, []);

    const checkAuthState = async () => {
        try {
            console.log('Checking auth state...');
            const currentUser = await getCurrentUser();
            console.log('Current user:', currentUser);
            setUser(currentUser);
            setIsAuthenticated(true);

            // Extract groups from JWT token
            const session = await fetchAuthSession();
            console.log('Session:', session);
            const idToken = session.tokens?.idToken;
            const groups = (idToken?.payload['cognito:groups'] as string[]) || [];
            console.log('User groups:', groups);
            setUserGroups(groups);

            // Check if this is a Google OAuth user without a custom username
            const username = currentUser.username || '';
            const isGoogleUser = username.startsWith('Google_');
            
            if (isGoogleUser) {
                // For Google users, check the actual user attributes (not just the token)
                try {
                    const { fetchUserAttributes } = await import('aws-amplify/auth');
                    const attributes = await fetchUserAttributes();
                    const preferredUsername = attributes.preferred_username;
                    const email = attributes.email;
                    
                    console.log('Google user attributes check:', {
                        preferredUsername,
                        email,
                        isEqual: preferredUsername === email
                    });
                    
                    // Show username setup if:
                    // 1. No preferred_username OR
                    // 2. preferred_username equals email (default from Cognito)
                    const needsSetup = !preferredUsername || preferredUsername === email;
                    
                    if (needsSetup) {
                        console.log('Google user without custom username - showing setup modal');
                        setNeedsUsernameSetup(true);
                    } else {
                        console.log('Google user has custom username:', preferredUsername);
                        setNeedsUsernameSetup(false);
                    }
                } catch (error) {
                    console.error('Failed to fetch user attributes for username check:', error);
                    setNeedsUsernameSetup(false);
                }
            } else {
                setNeedsUsernameSetup(false);
            }
        } catch (error: any) {
            // This is expected when user is not authenticated - not an error
            if (error.name === 'UserUnAuthenticatedException') {
                console.log('User not authenticated (expected on initial load)');
            } else {
                console.error('Auth state check error:', error);
            }
            setUser(null);
            setIsAuthenticated(false);
            setUserGroups([]);
            setNeedsUsernameSetup(false);
        } finally {
            setIsLoading(false);
        }
    };

    const signIn = async (username: string, password: string) => {
        try {
            await amplifySignIn({ username, password });
            await checkAuthState(); // Refresh user state and groups
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    };

    const signUp = async (username: string, password: string, email: string) => {
        try {
            await amplifySignUp({
                username,
                password,
                options: {
                    userAttributes: {
                        email
                    }
                }
            });
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    };

    const confirmSignUp = async (username: string, code: string) => {
        try {
            await amplifyConfirmSignUp({ username, confirmationCode: code });
        } catch (error) {
            console.error('Confirm sign up error:', error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await amplifySignOut({
                global: true
            });
            // Clear local state
            setUser(null);
            setIsAuthenticated(false);
            setUserGroups([]);
            // Force a full page reload to ensure clean state
            window.location.href = window.location.origin;
        } catch (error) {
            console.error('Sign out error:', error);
            // Even if there's an error, redirect to home
            window.location.href = window.location.origin;
        }
    };

    const hasRole = (role: string): boolean => {
        return userGroups.includes(role);
    };

    const refreshUserAttributes = async () => {
        // Force a re-check of the auth state to refresh user attributes
        await checkAuthState();
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated,
                isLoading,
                userGroups,
                needsUsernameSetup,
                setNeedsUsernameSetup,
                signIn,
                signUp,
                signOut,
                confirmSignUp,
                hasRole,
                refreshUserAttributes
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};