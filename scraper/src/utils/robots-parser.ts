import axios from 'axios';

interface RobotsRule {
    pattern: string;
    allow: boolean;
}

interface RobotsCache {
    rules: RobotsRule[];
    crawlDelay: number;
    fetchTime: number;
    expires: number;
}

export class RobotsParser {
    private cache: Map<string, RobotsCache>;
    private readonly userAgent: string;
    private readonly cacheExpiration: number = 3600000; // 1 hour in milliseconds

    constructor(userAgent: string) {
        this.cache = new Map();
        this.userAgent = userAgent;
    }

    async isAllowed(url: string): Promise<boolean> {
        const { origin, pathname } = new URL(url);
        const rules = await this.getRules(origin);
        
        // If no rules found, default to allowed
        if (!rules || rules.length === 0) {
            return true;
        }

        // Find the most specific matching rule
        const matchingRule = rules
            .filter(rule => this.matchesPattern(pathname, rule.pattern))
            .sort((a, b) => b.pattern.length - a.pattern.length)[0];

        return matchingRule ? matchingRule.allow : true;
    }

    async getCrawlDelay(domain: string): Promise<number> {
        const cached = this.cache.get(domain);
        if (cached) {
            return cached.crawlDelay;
        }
        await this.fetchRobotsTxt(domain);
        return this.cache.get(domain)?.crawlDelay || 0;
    }

    private async getRules(domain: string): Promise<RobotsRule[]> {
        const cached = this.cache.get(domain);
        if (cached && Date.now() < cached.expires) {
            return cached.rules;
        }
        return (await this.fetchRobotsTxt(domain)).rules;
    }

    private async fetchRobotsTxt(domain: string): Promise<RobotsCache> {
        try {
            const response = await axios.get(`${domain}/robots.txt`, {
                timeout: 5000,
                headers: { 'User-Agent': this.userAgent }
            });

            const rules: RobotsRule[] = [];
            let crawlDelay = 0;
            let currentUserAgent: string | null = null;

            const lines = response.data.split('\n');
            for (const line of lines) {
                const [field, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();

                if (!field || !value) continue;

                const fieldLower = field.toLowerCase().trim();
                
                if (fieldLower === 'user-agent') {
                    currentUserAgent = value;
                } else if (currentUserAgent === '*' || currentUserAgent === this.userAgent) {
                    if (fieldLower === 'allow') {
                        rules.push({ pattern: value, allow: true });
                    } else if (fieldLower === 'disallow') {
                        rules.push({ pattern: value, allow: false });
                    } else if (fieldLower === 'crawl-delay') {
                        crawlDelay = parseInt(value, 10) * 1000; // Convert to milliseconds
                    }
                }
            }

            const cache: RobotsCache = {
                rules,
                crawlDelay,
                fetchTime: Date.now(),
                expires: Date.now() + this.cacheExpiration
            };

            this.cache.set(domain, cache);
            return cache;
        } catch (error) {
            // If robots.txt cannot be fetched, assume everything is allowed
            const cache: RobotsCache = {
                rules: [],
                crawlDelay: 0,
                fetchTime: Date.now(),
                expires: Date.now() + this.cacheExpiration
            };
            this.cache.set(domain, cache);
            return cache;
        }
    }

    private matchesPattern(path: string, pattern: string): boolean {
        // Convert robots.txt pattern to regex
        const regex = new RegExp(
            '^' + pattern
                .replace(/\*/g, '.*')
                .replace(/\?/g, '\\?')
                .replace(/\$/g, '\\$')
                .replace(/\./g, '\\.')
                + '.*$'
        );
        return regex.test(path);
    }

    clearCache(): void {
        this.cache.clear();
    }
}