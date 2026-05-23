import './FavouritesComponent.css';
import {forwardRef, useEffect, useImperativeHandle, useState} from "react";
import quoteApi from "../api/quoteApi";
import {Quote} from "../types/Quote.ts";
import { useAzureAuth } from "../contexts/AzureAuthContext";

export type FavouritesComponentHandle = {
    reloadFavouriteQuotes: () => void;
};

const FavouritesComponent = forwardRef<FavouritesComponentHandle>((_, ref) => {
    const [messages, setMessages] = useState<string[]>([]); // List of messages as strings
    const [loading, setLoading] = useState<boolean>(false); // Loading state as a boolean
    const { isAuthenticated } = useAzureAuth();

    useEffect(() => {
        if (isAuthenticated) {
            loadFavouriteQuotes();
        } else {
            // Clear favourite quotes when user signs out
            setMessages([]);
        }
    }, [isAuthenticated]);

    useImperativeHandle(ref, () => ({
        reloadFavouriteQuotes() {
            if (isAuthenticated) {
                loadFavouriteQuotes();
            }
        }
    }));

    const loadFavouriteQuotes = async (): Promise<void> => {
        if (!isAuthenticated) {
            console.log('User not authenticated, skipping favourite quotes load');
            return;
        }
        
        try {
            setLoading(true);
            const quotes: Quote[] = await quoteApi.getLikedQuotes();
            setMessages(quotes.map((quote) => `${quote.quoteText} - ${quote.author}`));
        } catch (error) {
            console.error('Failed to load favourite quotes:', error);
            setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="eventBox">
            <button
                className="favouritesButton"
                disabled={loading}
                onClick={loadFavouriteQuotes}
            >
                {loading ? "Loading Favourite Quotes..." : "Favourite Quotes (Click to refresh)"}
            </button>
            <div className="messageBox">
                {messages.map((message, index) => (
                    <div
                        className={index % 2 === 0 ? "messageEven" : "messageOdd"}
                        key={index}
                    >
                        {message}
                    </div>
                ))}
            </div>
        </div>
    );
});

export default FavouritesComponent;