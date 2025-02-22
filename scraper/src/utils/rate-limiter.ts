interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

export class RateLimiter {
    private buckets: Map<string, TokenBucket>;
    private readonly limits: Record<string, number>;
    private readonly defaultLimit: number;

    constructor(limits: Record<string, number>, defaultLimit: number = 1) {
        this.buckets = new Map();
        this.limits = limits;
        this.defaultLimit = defaultLimit;
    }

    async acquire(domain: string): Promise<void> {
        const bucket = this.getBucket(domain);
        const now = Date.now();
        const limit = this.limits[domain] || this.defaultLimit;
        const refillRate = 1000 / limit; // milliseconds per token

        // Refill tokens based on time elapsed
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(timePassed / refillRate);
        bucket.tokens = Math.min(limit, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now - (timePassed % refillRate);

        if (bucket.tokens < 1) {
            // Wait until next token is available
            const waitTime = refillRate - (now - bucket.lastRefill);
            await this.sleep(waitTime);
            return this.acquire(domain);
        }

        bucket.tokens--;
    }

    updateLimit(domain: string, limit: number): void {
        this.limits[domain] = limit;
        // Reset bucket for this domain
        if (this.buckets.has(domain)) {
            this.buckets.delete(domain);
        }
    }

    private getBucket(domain: string): TokenBucket {
        if (!this.buckets.has(domain)) {
            this.buckets.set(domain, {
                tokens: this.limits[domain] || this.defaultLimit,
                lastRefill: Date.now()
            });
        }
        return this.buckets.get(domain)!;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}