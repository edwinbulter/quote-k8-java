import { useEffect, useState } from 'react';
import './QuoteManagementScreen.css';
import adminApi, { QuoteWithLikeCount } from '../api/adminApi';
import { Toast } from './Toast';
import { BackendRestartNotification, useBackendRestartNotification } from './BackendRestartNotification';

interface QuoteManagementScreenProps {
    onBack: () => void;
}

export function QuoteManagementScreen({ onBack }: QuoteManagementScreenProps) {
    const [quotes, setQuotes] = useState<QuoteWithLikeCount[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalLikes, setTotalLikes] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(50);
    const [totalPages, setTotalPages] = useState<number>(0);
    
    const [quoteTextSearch, setQuoteTextSearch] = useState<string>("");
    const [authorSearch, setAuthorSearch] = useState<string>("");
    const [debouncedQuoteText, setDebouncedQuoteText] = useState<string>("");
    const [debouncedAuthor, setDebouncedAuthor] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [searching, setSearching] = useState<boolean>(false);
    const [addingQuotes, setAddingQuotes] = useState<boolean>(false);
    const [paginationLoading, setPaginationLoading] = useState<boolean>(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [sortBy, setSortBy] = useState<'id' | 'quotetext' | 'author' | 'likes'>('id');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const { isOpen, retryCount } = useBackendRestartNotification();

    // Debounce search inputs
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuoteText(quoteTextSearch);
        }, 500);
        return () => clearTimeout(timer);
    }, [quoteTextSearch]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedAuthor(authorSearch);
        }, 500);
        return () => clearTimeout(timer);
    }, [authorSearch]);

    useEffect(() => {
        loadQuotes();
    }, [page, pageSize, debouncedQuoteText, debouncedAuthor, sortBy, sortOrder]);

    const loadQuotes = async () => {
        try {
            // Only show loading spinner on initial load
            if (page === 1 && !searching && !paginationLoading) {
                setLoading(true);
            }
            const response = await adminApi.getQuotes(page, pageSize, debouncedQuoteText, debouncedAuthor, sortBy, sortOrder);

            setQuotes(response?.quotes || []);
            setTotalCount(response?.totalCount || 0);
            setTotalPages(response?.totalPages || 0);

            // Get total likes from the new endpoint
            try {
                const totalLikesResponse = await adminApi.getTotalLikes();
                setTotalLikes(totalLikesResponse?.totalLikes || 0);
            } catch (likesError) {
                console.error('Failed to get total likes:', likesError);
                setTotalLikes(0); // Set to 0 on error
            }
        } catch (error) {
            console.error('Failed to load quotes:', error);
            setQuotes([]); // Reset to empty array on error
            showToast('Failed to load quotes', 'error');
        } finally {
            setLoading(false);
            setSearching(false);
            setPaginationLoading(false);
        }
    };

    const handleAddQuotes = async () => {
        try {
            setAddingQuotes(true);
            const response = await adminApi.fetchAndAddNewQuotes();
            if (response) {
                setTotalCount(response?.totalQuotes || totalCount); // Keep current count if undefined
                showToast(`Successfully added ${response.quotesAdded || 0} new quotes`, 'success');
            }
            setPage(1); // Reset to first page
            await loadQuotes();
        } catch (error) {
            console.error('Failed to add quotes:', error);
            showToast('Failed to add quotes', 'error');
        } finally {
            setAddingQuotes(false);
        }
    };

    const handlePageSizeChange = (newPageSize: number) => {
        setPageSize(newPageSize);
        setPage(1);
    };

    const handleSort = (column: 'id' | 'quotetext' | 'author' | 'likes') => {
        if (sortBy === column) {
            // For likes, only allow descending sort
            if (column === 'likes') {
                setSortOrder('desc');
            } else {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            }
        } else {
            setSortBy(column);
            // For likes, default to descending sort
            setSortOrder(column === 'likes' ? 'desc' : 'asc');
        }
        setPage(1);
    };

    const handleClearSearch = () => {
        setQuoteTextSearch("");
        setAuthorSearch("");
        setDebouncedQuoteText("");
        setDebouncedAuthor("");
        setPage(1);
    };

    const handlePageJump = (newPage: number) => {
        const validPage = Math.max(1, Math.min(totalPages, newPage));
        if (validPage !== page) {
            setPaginationLoading(true);
            setPage(validPage);
        }
    };

    const handlePreviousPage = () => {
        if (page > 1) {
            setPaginationLoading(true);
            setPage(page - 1);
        }
    };

    const handleNextPage = () => {
        if (page < totalPages) {
            setPaginationLoading(true);
            setPage(page + 1);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    return (
        <div className="quote-management-screen">
            <BackendRestartNotification isOpen={isOpen} retryCount={retryCount} />
            <div className="quote-management-header">
                <button className="back-button" onClick={onBack}>
                    ← Back
                </button>
                <h2>Manage Quotes</h2>
            </div>

            <div className="quote-count-section">
                <div className="quote-stats">
                    <span className="quote-count">Total Quotes: {(totalCount || 0).toLocaleString()}</span>
                    <span className="quote-count">Total Likes: {(totalLikes || 0).toLocaleString()}</span>
                </div>
                <button 
                    className="add-quotes-button" 
                    onClick={handleAddQuotes}
                    disabled={addingQuotes}
                >
                    {addingQuotes ? 'Adding Quotes...' : 'Add Quotes from ZEN'}
                </button>
            </div>

            <div className="search-section">
                <input
                    type="text"
                    placeholder="Search by quote text..."
                    value={quoteTextSearch}
                    onChange={(e) => {
                        setQuoteTextSearch(e.target.value);
                        setPage(1);
                    }}
                    className="search-input"
                />
                <input
                    type="text"
                    placeholder="Search by author..."
                    value={authorSearch}
                    onChange={(e) => {
                        setAuthorSearch(e.target.value);
                        setPage(1);
                    }}
                    className="search-input"
                />
                <button 
                    className="clear-search-button"
                    onClick={handleClearSearch}
                >
                    Clear
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading quotes...</div>
            ) : (
                <>
                    <div className={`quotes-table-container ${searching ? 'searching' : ''} ${paginationLoading ? 'pagination-loading' : ''}`}>
                        {paginationLoading ? (
                            <div className="pagination-loading-overlay">
                                <div className="loading">Loading page...</div>
                            </div>
                        ) : null}
                        {(!quotes || quotes.length === 0) ? (
                            <div className="empty-state-inline">No quotes found.</div>
                        ) : (
                            <table className="quotes-table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('id')} className="sortable">
                                            ID {sortBy === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('quotetext')} className="sortable">
                                            Quote Text {sortBy === 'quotetext' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('author')} className="sortable">
                                            Author {sortBy === 'author' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('likes')} className="sortable">
                                            Likes {sortBy === 'likes' ? '↓' : ''}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotes?.map((quote) => (
                                        <tr key={quote.quoteId}>
                                            <td className="id-cell">{quote.quoteId}</td>
                                            <td className="quote-text-cell">{quote.quoteText}</td>
                                            <td className="author-cell">{quote.author}</td>
                                            <td className="like-count-cell">{quote.likeCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="pagination-section">
                        <div className="page-size-selector">
                            <label>Quotes per page:</label>
                            <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={250}>250</option>
                            </select>
                        </div>

                        <div className="pagination-controls">
                            <button 
                                onClick={handlePreviousPage}
                                disabled={page === 1 || paginationLoading}
                            >
                                {paginationLoading && page > 1 ? 'Loading...' : 'Previous'}
                            </button>
                            
                            <span className="page-info">
                                Page {page} of {totalPages}
                            </span>
                            
                            <input
                                type="number"
                                min="1"
                                max={totalPages}
                                value={page}
                                onChange={(e) => handlePageJump(Number(e.target.value))}
                                className="page-input"
                                disabled={paginationLoading}
                            />
                            
                            <button 
                                onClick={handleNextPage}
                                disabled={page === totalPages || paginationLoading}
                            >
                                {paginationLoading && page < totalPages ? 'Loading...' : 'Next'}
                            </button>
                        </div>
                    </div>
                </>
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
