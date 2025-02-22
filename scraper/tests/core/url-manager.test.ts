import { UrlManager } from '../../src/core/url-manager';
import { QueueConfig } from '../../src/interfaces';

describe('UrlManager', () => {
    let urlManager: UrlManager;
    const config: QueueConfig = {
        maxSize: 5,
        priorityLevels: 3,
        deduplicationWindow: 1000
    };

    beforeEach(() => {
        urlManager = new UrlManager(config);
    });

    describe('enqueue', () => {
        it('should enqueue new URLs', async () => {
            await urlManager.enqueue('https://example.com');
            expect(urlManager.getQueueSize()).toBe(1);
        });

        it('should not enqueue duplicate URLs', async () => {
            await urlManager.enqueue('https://example.com');
            await urlManager.enqueue('https://example.com');
            expect(urlManager.getQueueSize()).toBe(1);
        });

        it('should normalize URLs before enqueuing', async () => {
            await urlManager.enqueue('https://example.com/path/');
            await urlManager.enqueue('https://example.com/path');
            expect(urlManager.getQueueSize()).toBe(1);
        });

        it('should respect maxSize limit', async () => {
            for (let i = 0; i < config.maxSize + 1; i++) {
                await urlManager.enqueue(`https://example.com/path${i}`);
            }
            expect(urlManager.getQueueSize()).toBe(config.maxSize);
        });

        it('should handle URLs with different priorities', async () => {
            await urlManager.enqueue('https://example.com/low', 3);
            await urlManager.enqueue('https://example.com/high', 1);
            await urlManager.enqueue('https://example.com/medium', 2);

            const first = await urlManager.dequeue();
            const second = await urlManager.dequeue();
            const third = await urlManager.dequeue();

            expect(first).toBe('https://example.com/high');
            expect(second).toBe('https://example.com/medium');
            expect(third).toBe('https://example.com/low');
        });
    });

    describe('dequeue', () => {
        it('should return null when queue is empty', async () => {
            expect(await urlManager.dequeue()).toBeNull();
        });

        it('should return URLs in priority order', async () => {
            await urlManager.enqueue('https://example.com/1', 2);
            await urlManager.enqueue('https://example.com/2', 1);

            expect(await urlManager.dequeue()).toBe('https://example.com/2');
            expect(await urlManager.dequeue()).toBe('https://example.com/1');
        });
    });

    describe('isVisited', () => {
        it('should correctly track visited URLs', async () => {
            const url = 'https://example.com';
            await urlManager.enqueue(url);
            expect(urlManager.isVisited(url)).toBe(true);
        });

        it('should normalize URLs when checking visited status', async () => {
            await urlManager.enqueue('https://example.com/path');
            expect(urlManager.isVisited('https://example.com/path/')).toBe(true);
        });
    });

    describe('clear', () => {
        it('should remove all URLs and reset visited tracking', async () => {
            await urlManager.enqueue('https://example.com/1');
            await urlManager.enqueue('https://example.com/2');

            await urlManager.clear();

            expect(urlManager.getQueueSize()).toBe(0);
            expect(urlManager.isVisited('https://example.com/1')).toBe(false);
            expect(urlManager.isVisited('https://example.com/2')).toBe(false);
        });
    });

    describe('URL normalization', () => {
        it('should handle invalid URLs gracefully', async () => {
            const invalidUrl = 'not-a-url';
            await urlManager.enqueue(invalidUrl);
            expect(urlManager.isVisited(invalidUrl)).toBe(true);
        });

        it('should normalize URLs with different protocols', async () => {
            await urlManager.enqueue('http://example.com');
            expect(urlManager.isVisited('https://example.com')).toBe(false);
        });

        it('should normalize URLs with query parameters', async () => {
            await urlManager.enqueue('https://example.com/path?param=1');
            expect(urlManager.isVisited('https://example.com/path')).toBe(true);
        });

        it('should normalize URLs with fragments', async () => {
            await urlManager.enqueue('https://example.com/path#section');
            expect(urlManager.isVisited('https://example.com/path')).toBe(true);
        });
    });
});