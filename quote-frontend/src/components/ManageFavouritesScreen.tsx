import { useEffect, useState } from 'react';
import './ManageFavouritesScreen.css';
import quoteApi from '../api/quoteApi';
import { Quote } from '../types/Quote';
import { Toast } from './Toast';
import { BackendRestartNotification, useBackendRestartNotification } from './BackendRestartNotification';
import { useAzureAuth } from '../contexts/AzureAuthContext';

interface ManageFavouritesScreenProps {
    onBack: () => void;
}

export function ManageFavouritesScreen({ onBack }: ManageFavouritesScreenProps) {
    const [favourites, setFavourites] = useState<Quote[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const { isOpen, retryCount } = useBackendRestartNotification();
    const { isAuthenticated } = useAzureAuth();

    useEffect(() => {
        if (isAuthenticated) {
            loadFavourites();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated]);

    const loadFavourites = async () => {
        if (!isAuthenticated) {
            console.log('User not authenticated, skipping favourites load');
            return;
        }
        
        try {
            setLoading(true);
            const quotes = await quoteApi.getLikedQuotes();
            setFavourites(quotes);
        } catch (error) {
            console.error('Failed to load favourites:', error);
            showToast('Failed to load favourites', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    const handleDelete = async (quoteId: number) => {
        const previousFavourites = [...favourites];
        setFavourites(favourites.filter(f => f.id !== quoteId));

        try {
            await quoteApi.unlikeQuote(quoteId);
            showToast('Favourite deleted', 'success');
        } catch (error) {
            console.error('Failed to delete favourite:', error);
            setFavourites(previousFavourites);
            showToast('Failed to delete favourite', 'error');
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;

        const previousFavourites = [...favourites];
        const newFavourites = [...favourites];
        [newFavourites[index - 1], newFavourites[index]] = [newFavourites[index], newFavourites[index - 1]];
        setFavourites(newFavourites);

        try {
            const movedItem = newFavourites[index - 1];
            await quoteApi.reorderLikedQuote(movedItem.id, index);
            showToast('Favourite reordered', 'success');
        } catch (error) {
            console.error('Failed to reorder favourite:', error);
            setFavourites(previousFavourites);
            showToast('Failed to reorder favourite', 'error');
        }
    };

    const handleMoveDown = async (index: number) => {
        if (index === favourites.length - 1) return;

        const previousFavourites = [...favourites];
        const newFavourites = [...favourites];
        [newFavourites[index], newFavourites[index + 1]] = [newFavourites[index + 1], newFavourites[index]];
        setFavourites(newFavourites);

        try {
            const movedItem = newFavourites[index + 1];
            await quoteApi.reorderLikedQuote(movedItem.id, index + 2);
            showToast('Favourite reordered', 'success');
        } catch (error) {
            console.error('Failed to reorder favourite:', error);
            setFavourites(previousFavourites);
            showToast('Failed to reorder favourite', 'error');
        }
    };

    return (
        <div className="manage-favourites-screen">
            <BackendRestartNotification isOpen={isOpen} retryCount={retryCount} />
            <div className="manage-favourites-header">
                <button className="back-button" onClick={onBack}>
                    ← Back
                </button>
                <h2>My Favourites</h2>
            </div>

            {loading ? (
                <div className="loading">Loading favourites...</div>
            ) : favourites.length === 0 ? (
                <div className="empty-state">
                    No favourites yet. Like quotes to add them here.
                </div>
            ) : (
                <div className="favourites-table-container">
                    <table className="favourites-table">
                        <thead>
                            <tr>
                                <th>Quote</th>
                                <th>Author</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {favourites.map((fav, index) => (
                                <tr key={fav.id}>
                                    <td className="quote-cell">{fav.quoteText}</td>
                                    <td className="author-cell">{fav.author}</td>
                                    <td className="actions-cell">
                                        <div className="actions">
                                            <button
                                                onClick={() => handleMoveUp(index)}
                                                disabled={index === 0}
                                                title="Move up"
                                                aria-label="Move up"
                                            >
                                                ⬆️ Up
                                            </button>
                                            <button
                                                onClick={() => handleMoveDown(index)}
                                                disabled={index === favourites.length - 1}
                                                title="Move down"
                                                aria-label="Move down"
                                            >
                                                ⬇️ Down
                                            </button>
                                            <button
                                                onClick={() => handleDelete(fav.id)}
                                                className="delete-button"
                                                title="Delete"
                                                aria-label="Delete"
                                            >
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
