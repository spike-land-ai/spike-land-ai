function createFetchWithRetry(
  retries: number,
  retryDelay: number,
  retryOn: number[],
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(input, init);
        if (retryOn.includes(response.status) && attempt < retries) {
          await new Promise((r) => setTimeout(r, retryDelay));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, retryDelay));
        }
      }
    }
    throw lastError;
  };
}

export class QueuedFetch {
  private queue: Array<() => Promise<void>> = [];
  private ongoingRequests = 0;
  private maxConcurrent: number;
  private limitedNumberOfRequests = false;
  private maxNumberOfRequests: number;
  private fetchWithRetry: typeof fetch;

  constructor(maxConcurrent = 5, maxNumberOfRequests = 0, _retries = 3, _retryDelay = 300) {
    this.maxNumberOfRequests = maxNumberOfRequests;
    this.maxConcurrent = maxConcurrent;
    this.fetchWithRetry = createFetchWithRetry(
      _retries,
      _retryDelay,
      [429, 500, 503, 504, 408, 413, 431, 451, 502],
    );
    if (maxNumberOfRequests > 0) {
      this.limitedNumberOfRequests = true;
    }
  }

  async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      if (this.limitedNumberOfRequests) {
        if (this.maxNumberOfRequests-- < 0) {
          return reject(new Error("Too many requests"));
        }
      }

      const request = async () => {
        try {
          const response = await this.fetchWithRetry(input, init);
          resolve(response);
        } catch (error) {
          reject(error);
        } finally {
          this.ongoingRequests--;
          this.processQueue();
        }
      };

      this.queue.push(request);
      this.processQueue();
    });
  }

  private processQueue() {
    while (this.ongoingRequests < this.maxConcurrent && this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        this.ongoingRequests++;
        request();
      }
    }
  }
}
