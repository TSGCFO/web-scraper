import { QueueConfig } from '../interfaces';
import { PriorityQueue } from '../utils/priority-queue';

export class UrlManager {
    private queue: PriorityQueue<string>;
    private visited: Set<string>;
    private config: QueueConfig;

    constructor(config: QueueConfig) {
        this.queue = new PriorityQueue(config.maxSize);
        this.visited = new Set();
        this.config = config;
    }

    async enqueue(url: string, priority: number = 1): Promise<void> {
        if (this.shouldEnqueue(url)) {
            await this.queue.enqueue(url, priority);
            this.visited.add(this.normalizeUrl(url));
        }
    }

    async dequeue(): Promise<string | null> {
        return this.queue.dequeue();
    }

    async clear(): Promise<void> {
        this.queue.clear();
        this.visited.clear();
    }

    getQueueSize(): number {
        return this.queue.size();
    }

    isVisited(url: string): boolean {
        return this.visited.has(this.normalizeUrl(url));
    }

    private shouldEnqueue(url: string): boolean {
        const normalizedUrl = this.normalizeUrl(url);
        return !this.visited.has(normalizedUrl) && 
               this.queue.size() < this.config.maxSize;
    }

    private normalizeUrl(url: string): string {
        try {
            const parsed = new URL(url);
            return parsed.origin + parsed.pathname.replace(/\/$/, '');
        } catch (error) {
            return url;
        }
    }
}