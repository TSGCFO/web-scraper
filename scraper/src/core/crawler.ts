import { CrawlerConfig, PolicyConfig } from '../interfaces';
import axios, { AxiosInstance } from 'axios';
import { RateLimiter } from '../utils/rate-limiter';
import { RobotsParser } from '../utils/robots-parser';

export class Crawler {
    private httpClient: AxiosInstance;
    private rateLimiter: RateLimiter;
    private robotsParser: RobotsParser;
    private config: CrawlerConfig;
    private policyConfig: PolicyConfig;

    constructor(config: CrawlerConfig, policyConfig: PolicyConfig) {
        this.config = config;
        this.policyConfig = policyConfig;
        
        this.httpClient = axios.create({
            timeout: config.requestTimeout,
            headers: {
                'User-Agent': config.userAgent
            },
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        });

        this.rateLimiter = new RateLimiter(policyConfig.rateLimits);
        this.robotsParser = new RobotsParser(config.userAgent);
    }

    async crawl(url: string): Promise<CrawlResult> {
        try {
            // Check robots.txt compliance
            if (this.policyConfig.robotsTxtEnforcement) {
                const allowed = await this.robotsParser.isAllowed(url);
                if (!allowed) {
                    throw new Error('URL not allowed by robots.txt');
                }
            }

            // Apply rate limiting
            const domain = new URL(url).hostname;
            await this.rateLimiter.acquire(domain);

            // Make the request
            const response = await this.httpClient.get(url);

            return {
                url,
                content: response.data,
                statusCode: response.status,
                headers: response.headers as Record<string, string>,
                timestamp: new Date().toISOString(),
                metadata: {
                    contentType: response.headers['content-type'],
                    contentLength: response.headers['content-length'],
                    lastModified: response.headers['last-modified']
                }
            };
        } catch (error) {
            if (this.isRetryableError(error)) {
                return this.handleRetry(url, error);
            }
            throw this.normalizeError(error);
        }
    }

    private async handleRetry(url: string, error: any): Promise<CrawlResult> {
        let retryCount = 0;
        let lastError = error;

        while (retryCount < this.config.retryAttempts) {
            try {
                await this.sleep(this.getRetryDelay(retryCount));
                return await this.crawl(url);
            } catch (err) {
                lastError = err;
                retryCount++;
            }
        }

        throw this.normalizeError(lastError);
    }

    private isRetryableError(error: any): boolean {
        return (
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNREFUSED' ||
            (error.response && error.response.status >= 500)
        );
    }

    private normalizeError(error: any): Error {
        if (error.response) {
            return new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        }
        return error;
    }

    private getRetryDelay(retryCount: number): number {
        return Math.min(
            this.config.retryDelay * Math.pow(2, retryCount),
            30000 // Max 30 seconds
        );
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export interface CrawlResult {
    url: string;
    content: string;
    statusCode: number;
    headers: Record<string, string>;
    timestamp: string;
    metadata: Record<string, any>;
}