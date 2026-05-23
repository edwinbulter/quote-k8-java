interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: Infinity, // Keep retrying indefinitely for 500 errors
  initialDelay: 1000, // Start with 1 second
  maxDelay: 60000, // Max 60 seconds between retries
  onRetry: () => {},
};

export class BackendRetryError extends Error {
  constructor(message: string, public originalError: Error) {
    super(message);
    this.name = 'BackendRetryError';
  }
}

/**
 * Wraps a fetch function with retry logic for 500 errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let attempt = 0;
  let delay = opts.initialDelay;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      // Only retry on 500 errors or network errors
      if (error instanceof Error) {
        const isServerError = error.message.includes('500') || 
                            error.message.includes('Internal Server Error') ||
                            (error.message.includes('Failed to fetch') && !error.message.includes('400') && !error.message.includes('403') && !error.message.includes('404')) ||
                            error.message.includes('Network request failed') ||
                            error.message.includes('CORS') ||
                            error.message.includes('blocked by CORS policy') ||
                            error.message.includes('ERR_FAILED') ||
                            error.message.includes('ERR_CONNECTION_REFUSED') ||
                            error.message.includes('ERR_NETWORK') ||
                            error.message.includes('ERR_INTERNET_DISCONNECTED') ||
                            error.message.includes('ERR_NAME_NOT_RESOLVED') ||
                            error.message.includes('ERR_TIMED_OUT') ||
                            error.message.includes('timeout') ||
                            error.message.includes('NetworkError') ||
                            error.message.includes('fetch failed');
        
        if (!isServerError || (opts.maxRetries !== Infinity && attempt > opts.maxRetries)) {
          throw error;
        }
      }

      // Notify about retry
      opts.onRetry(attempt, error as Error);

      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Calculate next delay (exponential backoff with jitter)
      delay = Math.min(delay * 2, opts.maxDelay);
      // Add some jitter to avoid thundering herd
      delay = delay * (0.5 + Math.random() * 0.5);
    }
  }
}
