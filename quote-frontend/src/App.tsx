import './App.scss';
import React, { useEffect, useRef, useState, useCallback } from "react";
import quoteApi from "./api/quoteApi";
import FavouritesComponent, { FavouritesComponentHandle } from "./components/FavouritesComponent.tsx";
import { BackendRestartNotification, useBackendRestartNotification } from "./components/BackendRestartNotification";

// Import `Quote` interface from the appropriate file
import { Quote } from "./types/Quote"; // Adjust the path based on your project
import { useAzureAuth } from './contexts/AzureAuthContext';
import { AzureLogin } from './components/AzureLogin';
import { ManagementScreen } from './components/ManagementScreen';
import { ManageFavouritesScreen } from './components/ManageFavouritesScreen';
import { ViewedQuotesScreen } from './components/ViewedQuotesScreen';
import { UserManagementScreen } from './components/UserManagementScreen';
import { QuoteManagementScreen } from './components/QuoteManagementScreen';
// import { useQuote, useUserProgress, useAuthenticatedQuote } from './hooks/useQuote';

const App: React.FC = () => {
    const { isAuthenticated, isLoading, logout, user, isAdmin } = useAzureAuth();
    const [quote, setQuote] = useState<Quote | null>(null); // Keep for unauthenticated users
    const [receivedQuotes, setReceivedQuotes] = useState<Quote[]>([]); // Array of `Quote` objects (for unauthenticated users)
    const [currentQuoteId, setCurrentQuoteId] = useState<number | null>(null); // Current quote ID for sequential navigation
    const [lastQuoteId, setLastQuoteId] = useState<number>(0); // User's last viewed quote ID
    const [loading, setLoading] = useState<boolean>(true); // Loading state
    const [liking, setLiking] = useState<boolean>(false); // Liking state
    const [signingIn, setSigningIn] = useState<boolean>(false);
    const [showProfile, setShowProfile] = useState<boolean>(false);
    const [showManagement, setShowManagement] = useState<boolean>(false);
    const [managementView, setManagementView] = useState<'main' | 'favourites' | 'viewed' | 'users' | 'quotes'>('main');
    const [userEmail, setUserEmail] = useState<string>('');
    const [displayUsername, setDisplayUsername] = useState<string>('');
    const favouritesRef = useRef<FavouritesComponentHandle>(null);
    
    // Backend restart notification
    const { isOpen: isBackendRestarting, retryCount } = useBackendRestartNotification();

    // Temporarily disable hooks to fix loading issues - use local state only
    // const { quote: optimizedQuote, isLoading: quoteLoading, updateQuote } = 
    //     useQuote(isAuthenticated && currentQuoteId ? currentQuoteId : null, { enableOptimisticUpdates: isAuthenticated });
    // useUserProgress(); // Keep for potential future use
    // useAuthenticatedQuote(); // Keep for potential future use

    // Use local quote state for all users
    const displayQuote = quote;
    const effectiveLoading = loading;

    useEffect(() => {
        fetchFirstQuote(); // Called twice in StrictMode (only in development)
    }, []);

    // Load user progress when user authenticates
    useEffect(() => {
        const loadUserProgress = async () => {
            if (isAuthenticated && user) {
                try {
                    console.log('Loading user progress for authenticated user...');
                    setLoading(true); // Start loading
                    const progress = await quoteApi.getUserProgress();
                    setLastQuoteId(progress.lastQuoteId);
                    console.log(`Loaded user progress: lastQuoteId=${progress.lastQuoteId}`);
                    // Fetch next quote for authenticated users
                    console.log('📍 CALL SITE: loadUserProgress - fetching next quote');
                    await fetchNextQuote();
                } catch (error) {
                    console.error('Failed to load user progress:', error);
                    // Fallback to getting next quote
                    console.log('📍 CALL SITE: loadUserProgress - error fallback');
                    fetchNextQuote();
                } finally {
                    setLoading(false); // End loading
                }
            } else {
                // Clear progress when user signs out and fetch random quote
                setCurrentQuoteId(null);
                setLastQuoteId(0);
                // Fetch a random quote for unauthenticated user
                fetchFirstQuote();
            }
        };
        loadUserProgress();
    }, [isAuthenticated, user]);

    // Set document title based on environment
    useEffect(() => {
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isDevCloudFront = hostname === 'd1fzgis91zws1k.cloudfront.net';
        
        if (isLocalhost) {
            document.title = 'Quote (local)';
        } else if (isDevCloudFront) {
            document.title = 'Quote (dev)';
        } else {
            document.title = 'Quote';
        }
    }, []);

    // Close login screen when user becomes authenticated
    useEffect(() => {
        if (isAuthenticated && signingIn) {
            setSigningIn(false);
        }
    }, [isAuthenticated, signingIn]);

    // Log user when authenticated and set email and username
    useEffect(() => {
        if (isAuthenticated && user) {
            console.log('User authenticated:', user);
            // Set user email and username from Azure auth context
            setUserEmail(user.email);
            setDisplayUsername(user.username);
        } else {
            setUserEmail('');
            setDisplayUsername('');
        }
    }, [isAuthenticated, user]);

    const fetchFirstQuote = async (): Promise<void> => {
        try {
            setLoading(true);
            // Check authentication state at call time, not cached state
            const isAuth = !!localStorage.getItem('jwt_token');
            if (isAuth) {
                // For authenticated users, get next sequential quote
                await fetchNextQuote();
            } else {
                // For unauthenticated users, use random quote
                const firstQuote = await quoteApi.getQuote();
                setQuote(firstQuote);
                setReceivedQuotes([firstQuote]);
            }
        } catch (error) {
            console.error('Failed to fetch first quote:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchNextQuote = async (): Promise<void> => {
        console.log('🔄 fetchNextQuote called - timestamp:', Date.now());
        console.log('📍 CALL SITE: Manual fetchNextQuote() call');

        try {
            setLoading(true);
            // Check authentication state at call time, not cached state
            const isAuth = !!localStorage.getItem('jwt_token');
            if (isAuth) {
                // For authenticated users, get next sequential quote
                console.log('📈 Calling getAuthenticatedQuote for user');
                const nextQuote = await quoteApi.getAuthenticatedQuote();
                console.log('📈 Received quote:', nextQuote.id, nextQuote.quoteText.substring(0, 50));
                setQuote(nextQuote);
                setCurrentQuoteId(nextQuote.id);
                setLastQuoteId(nextQuote.id);
            } else {
                // For unauthenticated users, use random quote
                const uniqueQuote = await quoteApi.getUniqueQuote(receivedQuotes);
                setQuote(uniqueQuote);
                setReceivedQuotes((prevQuotes) => [...prevQuotes, uniqueQuote]);
            }
        } catch (error) {
            console.error('Failed to fetch next quote:', error);
        } finally {
            setLoading(false);
        }
    };

    const newQuote = async (): Promise<void> => {
        console.log('📍 CALL SITE: newQuote function');
        console.trace('🔍 Full call stack for newQuote() call:');
        
        // Prevent automatic calls - only allow if not loading
        if (effectiveLoading) {
            console.log('🚫 newQuote blocked - effectiveLoading is true');
            return;
        }
        
        await fetchNextQuote();
    };

    const like = async (): Promise<void> => {
        try {
            if (displayQuote && !displayQuote.liked) {
                setLiking(true);
                const updatedQuote = await quoteApi.likeQuote(displayQuote);
                if (updatedQuote && updatedQuote.id === displayQuote.id) {
                    // Update the `liked` property in local state
                    if (!isAuthenticated) {
                        setReceivedQuotes((prevQuotes: Quote[]) =>
                            prevQuotes.map((item: Quote) =>
                                item.id === displayQuote.id ? { ...item, liked: true } : item
                            )
                        );
                        setQuote({ ...displayQuote, liked: true });
                    }
                    
                    // Use the updateQuote callback to update both cache and React Query
                    // if (isAuthenticated) {
                    //     updateQuote({ ...displayQuote, liked: true });
                    //     
                    //     // Refresh the favourites component to show the newly liked quote
                    //     if (favouritesRef.current) {
                    //         favouritesRef.current.reloadFavouriteQuotes();
                    //     }
                    // }
                    
                    // Refresh the favourites component to show the newly liked quote
                    if (isAuthenticated && favouritesRef.current) {
                        favouritesRef.current.reloadFavouriteQuotes();
                    }
                } else {
                    console.log("Failed to like quote for some reason, id=" + displayQuote.id);
                }
            }
        } catch (error) {
            console.error('Failed to like quote:', error);
        } finally {
            setLiking(false);
        }
    };

    const previous = useCallback(async (): Promise<void> => {
        if (isAuthenticated && currentQuoteId && currentQuoteId > 1) {
            const prevId = currentQuoteId - 1;
            try {
                setLoading(true);
                const prevQuote = await quoteApi.getQuoteById(prevId);
                setQuote(prevQuote);
                setCurrentQuoteId(prevQuote.id);
            } catch (error) {
                console.error('Failed to fetch previous quote:', error);
            } finally {
                setLoading(false);
            }
        } else if (!isAuthenticated) {
            // For unauthenticated users, use old array-based navigation
            if (receivedQuotes.length > 0) {
                const currentIndex = receivedQuotes.findIndex(q => q.id === displayQuote?.id);
                if (currentIndex > 0) {
                    setQuote(receivedQuotes[currentIndex - 1]);
                }
            }
        }
    }, [isAuthenticated, currentQuoteId, displayQuote?.id, receivedQuotes]);

    const next = useCallback(async (): Promise<void> => {
        console.log('➡️ next() called - currentQuoteId:', currentQuoteId, 'lastQuoteId:', lastQuoteId);
        if (isAuthenticated && currentQuoteId && currentQuoteId < lastQuoteId) {
            const nextId = currentQuoteId + 1;
            console.log('➡️ Setting currentQuoteId to:', nextId);
            try {
                setLoading(true);
                const nextQuote = await quoteApi.getQuoteById(nextId);
                setQuote(nextQuote);
                setCurrentQuoteId(nextQuote.id);
            } catch (error) {
                console.error('Failed to fetch next quote:', error);
            } finally {
                setLoading(false);
            }
        } else if (!isAuthenticated) {
            // For unauthenticated users, use old array-based navigation
            const currentIndex = receivedQuotes.findIndex(q => q.id === displayQuote?.id);
            if (currentIndex >= 0 && currentIndex < receivedQuotes.length - 1) {
                setQuote(receivedQuotes[currentIndex + 1]);
            }
        } else {
            console.log('➡️ Calling fetchNextQuote() - currentQuoteId >= lastQuoteId');
            console.log('📍 CALL SITE: next function - else branch');
            await fetchNextQuote();
        }
    }, [isAuthenticated, currentQuoteId, lastQuoteId, displayQuote?.id, receivedQuotes]);

    const jumpToFirst = async (): Promise<void> => {
        if (isAuthenticated) {
            try {
                setLoading(true);
                const firstQuote = await quoteApi.getQuoteById(1);
                setQuote(firstQuote);
                setCurrentQuoteId(firstQuote.id);
            } catch (error) {
                console.error('Failed to fetch first quote:', error);
            } finally {
                setLoading(false);
            }
        } else if (receivedQuotes.length > 0) {
            setQuote(receivedQuotes[0]);
        }
    };

    const jumpToLast = async (): Promise<void> => {
        if (isAuthenticated && lastQuoteId > 0) {
            try {
                setLoading(true);
                const lastQuote = await quoteApi.getQuoteById(lastQuoteId);
                setQuote(lastQuote);
                setCurrentQuoteId(lastQuote.id);
            } catch (error) {
                console.error('Failed to fetch last quote:', error);
            } finally {
                setLoading(false);
            }
        } else if (receivedQuotes.length > 0) {
            setQuote(receivedQuotes[receivedQuotes.length - 1]);
        }
    };

    const signIn = (): void => {
        setSigningIn(!signingIn);
    };

    const toggleProfile = (): void => {
        setShowProfile(!showProfile);
    };

    const handleSignOut = async (): Promise<void> => {
        logout();
        setShowProfile(false);
        setShowManagement(false);
        setManagementView('main');
        setSigningIn(false);
        // Reset quote state - the useEffect on isAuthenticated change will trigger fetchFirstQuote
        setQuote(null);
        setCurrentQuoteId(null);
        setLastQuoteId(0);
        setReceivedQuotes([]);
        setLoading(false);
    };

    const closeProfile = (): void => {
        setShowProfile(false);
    };

    const openManagement = (): void => {
        setShowManagement(true);
        setManagementView('main');
    };

    const closeManagement = (): void => {
        setShowManagement(false);
        setManagementView('main');
        if (favouritesRef.current) {
            favouritesRef.current.reloadFavouriteQuotes();
        }
    };

    return (
        <>
        <div className="app">
            <div className={`quoteView ${(signingIn || showProfile || showManagement) ? 'fullHeight fullWidth' : ''}`}>
                {showManagement ? (
                    managementView === 'main' ? (
                        <ManagementScreen
                            onBack={closeManagement}
                            onNavigateToFavourites={() => setManagementView('favourites')}
                            onNavigateToViewedQuotes={() => setManagementView('viewed')}
                            onNavigateToUserManagement={() => setManagementView('users')}
                            onNavigateToQuoteManagement={() => setManagementView('quotes')}
                            hasUserRole={isAuthenticated}
                            hasAdminRole={isAdmin}
                        />
                    ) : managementView === 'favourites' ? (
                        <ManageFavouritesScreen
                            onBack={() => setManagementView('main')}
                        />
                    ) : managementView === 'viewed' ? (
                        <ViewedQuotesScreen
                            onBack={() => setManagementView('main')}
                            onDeleteAll={() => {
                                // Reset user state to start from beginning
                                setCurrentQuoteId(null);
                                setLastQuoteId(0);
                                setQuote(null);
                                // Trigger fetch of first quote
                                setTimeout(() => {
                                    fetchNextQuote();
                                }, 100);
                            }}
                        />
                    ) : managementView === 'users' ? (
                        <UserManagementScreen
                            onBack={() => setManagementView('main')}
                        />
                    ) : (
                        <QuoteManagementScreen
                            onBack={() => setManagementView('main')}
                        />
                    )
                ) : showProfile && isAuthenticated && user ? (
                    <div className="profile">
                        <h2>User Profile</h2>
                        <div className="profile-info">
                            <p><strong>Username:</strong> {displayUsername || user.username}</p>
                            <p><strong>Email:</strong> {userEmail || 'Loading...'}</p>
                            <p><strong>Roles:</strong> {user?.roles && Array.isArray(user.roles) && user.roles.length > 0 ? user.roles.join(', ') : 'No roles assigned'}</p>
                        </div>
                        <div className="profile-actions">
                            <button className="signOutButton" onClick={handleSignOut}>
                                Sign Out
                            </button>
                            <button className="cancelButton" onClick={closeProfile}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : signingIn && !isAuthenticated ? (
                    <AzureLogin onCancel={() => setSigningIn(false)} />
                ) : showManagement ? null : (
                    <>
                        <p>
                            "{effectiveLoading ? "Loading..." : displayQuote?.quoteText || ""}"
                        </p>
                        <p className="author">
                            {effectiveLoading ? "" : displayQuote?.author || ""}
                        </p>
                    </>
                )}
            </div>
            <div className={`buttonBar ${(signingIn || showProfile) ? 'hideOnNarrow' : ''}`}>
                <div className="logo">
                    <div className="logo-header">CODE-BULTER</div>
                    <div className="logo-main">Quote</div>
                </div>
                {isAuthenticated && user && (
                    <div className="userInitial" title={displayUsername || user.username} onClick={toggleProfile} style={{ cursor: 'pointer' }}>
                        {(displayUsername || user.username || 'U').charAt(0).toUpperCase()}
                    </div>
                )}
                <button className="newQuoteButton" disabled={effectiveLoading || signingIn || showProfile || showManagement} onClick={newQuote}>
                    {effectiveLoading ? "Loading..." : "New Quote"}
                </button>
                <button 
                    className="likeButton" 
                    disabled={!isAuthenticated || liking || !!displayQuote?.liked || signingIn || showProfile || showManagement} 
                    onClick={like}
                    title={!isAuthenticated ? "Sign in to like quotes" : ""}
                >
                    {liking ? "Liking..." : "Like"}
                </button>
                <button 
                    className="previousButton" 
                    disabled={(isAuthenticated ? (currentQuoteId === null || currentQuoteId <= 1) : receivedQuotes.findIndex(q => q.id === displayQuote?.id) <= 0) || signingIn || showProfile || showManagement || effectiveLoading} 
                    onClick={previous}
                >
                    Previous
                </button>
                <button
                    className="nextButton"
                    disabled={(isAuthenticated ? (currentQuoteId === null || currentQuoteId >= lastQuoteId) : receivedQuotes.findIndex(q => q.id === displayQuote?.id) >= receivedQuotes.length - 1) || signingIn || showProfile || showManagement || effectiveLoading}
                    onClick={next}
                >
                    Next
                </button>
                <button className="firstButton" disabled={signingIn || showProfile || showManagement} onClick={jumpToFirst}>
                    First
                </button>
                <button className="lastButton" disabled={signingIn || showProfile || showManagement} onClick={jumpToLast}>
                    Last
                </button>
                {isAuthenticated && (
                    <button 
                        className="manageButton" 
                        disabled={signingIn || showProfile || showManagement}
                        onClick={openManagement}
                    >
                        Manage
                    </button>
                )}
                {!isAuthenticated ? (
                    <button className="signinButton" disabled={isLoading || signingIn || showProfile} onClick={signIn}>
                        {isLoading ? "Loading..." : "Sign In"}
                    </button>
                ) : (
                    <button className="signinButton" disabled={isLoading || signingIn || showProfile} onClick={handleSignOut}>
                        Sign Out
                    </button>
                )}
            </div>
            {!signingIn && !showProfile && !showManagement && (
                <FavouritesComponent ref={favouritesRef}/>
            )}
        </div>
        <BackendRestartNotification isOpen={isBackendRestarting} retryCount={retryCount} />
        </>
    );
};

export default App;