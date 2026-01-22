/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    shouldRetry?: (result: T) => boolean;
  }
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, shouldRetry } = options;
  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // If shouldRetry is provided and returns true, treat as failure
      if (shouldRetry && shouldRetry(result)) {
        throw new Error('Retry condition not met');
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        // Exponential backoff: double the delay, but cap at maxDelay
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}
