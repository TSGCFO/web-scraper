import { JobManager } from '../../src/core/job-manager';
import { UrlManager } from '../../src/core/url-manager';
import { Crawler } from '../../src/core/crawler';
import { Parser } from '../../src/core/parser';
import { DataStorage } from '../../src/core/storage';
import { CrawlTask, JobStatus } from '../../src/types';

// Mock dependencies
jest.mock('../../src/core/url-manager');
jest.mock('../../src/core/crawler');
jest.mock('../../src/core/parser');
jest.mock('../../src/core/storage');

describe('JobManager', () => {
    let jobManager: JobManager;
    let mockUrlManager: jest.Mocked<UrlManager>;
    let mockCrawler: jest.Mocked<Crawler>;
    let mockParser: jest.Mocked<Parser>;
    let mockStorage: jest.Mocked<DataStorage>;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Initialize mocked dependencies
        mockUrlManager = new UrlManager({ maxSize: 100, priorityLevels: 3, deduplicationWindow: 1000 }) as jest.Mocked<UrlManager>;
        mockCrawler = new Crawler({} as any, {} as any) as jest.Mocked<Crawler>;
        mockParser = new Parser({} as any) as jest.Mocked<Parser>;
        mockStorage = new (DataStorage as any)({}) as jest.Mocked<DataStorage>;

        // Setup default mock implementations
        mockUrlManager.enqueue = jest.fn().mockResolvedValue(undefined);
        mockUrlManager.dequeue = jest.fn().mockResolvedValue(null);
        mockCrawler.crawl = jest.fn().mockResolvedValue({ content: 'test content' });
        mockParser.parse = jest.fn().mockResolvedValue({ data: {} });
        mockStorage.store = jest.fn().mockResolvedValue({ success: true, id: 'test-id' });

        jobManager = new JobManager(
            mockUrlManager,
            mockCrawler,
            mockParser,
            mockStorage
        );
    });

    describe('startJob', () => {
        const testUrls = ['https://example1.com', 'https://example2.com'];

        it('should create a new job and return job ID', async () => {
            const jobId = await jobManager.startJob(testUrls);

            expect(jobId).toBeDefined();
            expect(mockUrlManager.enqueue).toHaveBeenCalledTimes(testUrls.length);
            
            const status = jobManager.getJobStatus(jobId);
            expect(status).toBeDefined();
            expect(status?.tasks).toHaveLength(testUrls.length);
            expect(status?.status).toBe('running');
        });

        it('should respect priority when enqueueing URLs', async () => {
            const priority = 2;
            await jobManager.startJob(testUrls, priority);

            expect(mockUrlManager.enqueue).toHaveBeenCalledWith(
                expect.any(String),
                priority
            );
        });
    });

    describe('job control', () => {
        let jobId: string;

        beforeEach(async () => {
            jobId = await jobManager.startJob(['https://example.com']);
        });

        it('should pause a running job', async () => {
            await jobManager.pauseJob(jobId);
            const status = jobManager.getJobStatus(jobId);
            expect(status?.status).toBe('paused');
        });

        it('should resume a paused job', async () => {
            await jobManager.pauseJob(jobId);
            await jobManager.resumeJob(jobId);
            const status = jobManager.getJobStatus(jobId);
            expect(status?.status).toBe('running');
        });

        it('should cancel a job', async () => {
            await jobManager.cancelJob(jobId);
            const status = jobManager.getJobStatus(jobId);
            expect(status?.status).toBe('failed');
            expect(status?.endTime).toBeDefined();
        });
    });

    describe('task processing', () => {
        const testUrl = 'https://example.com';
        let jobId: string;

        beforeEach(async () => {
            mockUrlManager.dequeue
                .mockResolvedValueOnce(testUrl)
                .mockResolvedValue(null);
            jobId = await jobManager.startJob([testUrl]);
        });

        it('should process tasks successfully', async () => {
            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            const status = jobManager.getJobStatus(jobId);
            expect(status?.completedTasks).toBe(1);
            expect(status?.failedTasks).toBe(0);
            expect(mockCrawler.crawl).toHaveBeenCalledWith(testUrl);
            expect(mockParser.parse).toHaveBeenCalled();
            expect(mockStorage.store).toHaveBeenCalled();
        });

        it('should handle task failures and retry', async () => {
            mockCrawler.crawl.mockRejectedValueOnce(new Error('Crawl failed'));
            
            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockUrlManager.enqueue).toHaveBeenCalledTimes(2); // Initial + retry
        });

        it('should mark task as failed after max retries', async () => {
            mockCrawler.crawl.mockRejectedValue(new Error('Crawl failed'));
            
            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            const status = jobManager.getJobStatus(jobId);
            expect(status?.failedTasks).toBe(1);
        });
    });

    describe('event emission', () => {
        it('should emit events for job lifecycle', async () => {
            const events: Record<string, jest.Mock> = {
                jobCompleted: jest.fn(),
                jobPaused: jest.fn(),
                jobResumed: jest.fn(),
                jobCancelled: jest.fn(),
                taskUpdated: jest.fn(),
            };

            // Register event listeners
            Object.entries(events).forEach(([event, handler]) => {
                jobManager.on(event, handler);
            });

            const jobId = await jobManager.startJob(['https://example.com']);
            await jobManager.pauseJob(jobId);
            await jobManager.resumeJob(jobId);
            await jobManager.cancelJob(jobId);

            expect(events.jobPaused).toHaveBeenCalledWith(jobId);
            expect(events.jobResumed).toHaveBeenCalledWith(jobId);
            expect(events.jobCancelled).toHaveBeenCalledWith(jobId);
            expect(events.taskUpdated).toHaveBeenCalled();
        });
    });

    describe('concurrent jobs', () => {
        it('should handle multiple jobs simultaneously', async () => {
            const job1 = await jobManager.startJob(['https://example1.com']);
            const job2 = await jobManager.startJob(['https://example2.com']);

            expect(jobManager.getJobStatus(job1)).toBeDefined();
            expect(jobManager.getJobStatus(job2)).toBeDefined();
        });

        it('should process tasks from different jobs', async () => {
            mockUrlManager.dequeue
                .mockResolvedValueOnce('https://example1.com')
                .mockResolvedValueOnce('https://example2.com')
                .mockResolvedValue(null);

            await jobManager.startJob(['https://example1.com']);
            await jobManager.startJob(['https://example2.com']);

            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockCrawler.crawl).toHaveBeenCalledTimes(2);
        });
    });
});