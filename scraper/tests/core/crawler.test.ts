import { Crawler, CrawlResult } from '../../src/core/crawler';
import { CrawlerConfig, PolicyConfig } from '../../src/interfaces';
import axios from 'axios';
import { RateLimiter } from '../../src/utils/rate-limiter';
import { RobotsParser } from '../../src/utils/robots-parser';

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/utils/rate-limiter');
jest.mock('../../src/utils/robots-parser');

describe('Crawler', () => {
    let crawler: Crawler;
    let mockAxios: jest.Mocked<typeof axios>;
    let mockRateLimiter: jest.Mocked<RateLimiter>;
    let mockRobotsParser: jest.Mocked<RobotsParser>;

    const defaultConfig: CrawlerConfig = {
        maxConcurrentRequests: 2,
        requestTimeout: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
        userAgent: 'TestBot/1.0'
    };

    const defaultPolicyConfig: PolicyConfig = {
        rateLimits: { '*': 1000 },
        robotsTxtEnforcement: true,
        crawlDelay: 1000
    };

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup axios mock
        mockAxios = axios as jest.Mocked<typeof axios>;
        mockAxios.create.mockReturnValue(mockAxios as any);

        // Setup RateLimiter mock
        mockRateLimiter = new RateLimiter({}) as jest.Mocked<RateLimiter>;
        jest.spyOn(RateLimiter.prototype, 'acquire').mockResolvedValue();

        // Setup RobotsParser mock
        mockRobotsParser = new RobotsParser('') as jest.Mocked<RobotsParser>;
        jest.spyOn(RobotsParser.prototype, 'isAllowed').mockResolvedValue(true);

        crawler = new Crawler(defaultConfig, defaultPolicyConfig);
    });

    describe('crawl', () => {
        const testUrl = 'https://example.com';
        const mockResponse = {
            data: '<html>Test content</html>',
            status: 200,
            headers: {
                'content-type': 'text/html',
                'content-length': '100',
                'last-modified': 'Wed, 21 Feb 2024 00:00:00 GMT'
            }
        };

        it('should successfully crawl a URL', async () => {
            mockAxios.get.mockResolvedValueOnce(mockResponse);

            const result = await crawler.crawl(testUrl);

            expect(result).toMatchObject({
                url: testUrl,
                content: mockResponse.data,
                statusCode: mockResponse.status,
                headers: mockResponse.headers,
                metadata: {
                    contentType: mockResponse.headers['content-type'],
                    contentLength: mockResponse.headers['content-length'],
                    lastModified: mockResponse.headers['last-modified']
                }
            });
            expect(result.timestamp).toBeDefined();
        });

        it('should respect robots.txt when enabled', async () => {
            jest.spyOn(RobotsParser.prototype, 'isAllowed').mockResolvedValueOnce(false);

            await expect(crawler.crawl(testUrl)).rejects.toThrow('URL not allowed by robots.txt');
        });

        it('should apply rate limiting', async () => {
            mockAxios.get.mockResolvedValueOnce(mockResponse);

            await crawler.crawl(testUrl);

            expect(RateLimiter.prototype.acquire).toHaveBeenCalledWith('example.com');
        });

        it('should handle retryable errors', async () => {
            const networkError = { code: 'ECONNRESET' };
            mockAxios.get
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(mockResponse);

            const result = await crawler.crawl(testUrl);

            expect(mockAxios.get).toHaveBeenCalledTimes(2);
            expect(result.statusCode).toBe(200);
        });

        it('should respect retry attempts limit', async () => {
            const networkError = { code: 'ECONNRESET' };
            mockAxios.get.mockRejectedValue(networkError);

            await expect(crawler.crawl(testUrl)).rejects.toThrow();
            expect(mockAxios.get).toHaveBeenCalledTimes(defaultConfig.retryAttempts + 1);
        });

        it('should handle non-retryable errors', async () => {
            const clientError = {
                response: {
                    status: 404,
                    statusText: 'Not Found'
                }
            };
            mockAxios.get.mockRejectedValueOnce(clientError);

            await expect(crawler.crawl(testUrl)).rejects.toThrow('HTTP 404: Not Found');
            expect(mockAxios.get).toHaveBeenCalledTimes(1);
        });

        it('should use configured timeout', async () => {
            await crawler.crawl(testUrl);

            expect(mockAxios.create).toHaveBeenCalledWith(expect.objectContaining({
                timeout: defaultConfig.requestTimeout
            }));
        });

        it('should use configured user agent', async () => {
            await crawler.crawl(testUrl);

            expect(mockAxios.create).toHaveBeenCalledWith(expect.objectContaining({
                headers: {
                    'User-Agent': defaultConfig.userAgent
                }
            }));
        });
    });
});