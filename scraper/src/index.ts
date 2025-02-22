import { UrlManager } from './core/url-manager';
import { Crawler } from './core/crawler';
import { Parser } from './core/parser';
import { FileStorage, DatabaseStorage } from './core/storage';
import { JobManager } from './core/job-manager';
import { SystemConfig } from './interfaces';

export class WebScraper {
    private jobManager: JobManager;

    constructor(config: SystemConfig) {
        // Initialize components
        const urlManager = new UrlManager(config.queue);
        const crawler = new Crawler(config.crawler, config.policy, config.proxy);
        const parser = new Parser(config.parser);
        
        // Initialize storage based on configuration
        const storage = config.storage.type === 'file' 
            ? new FileStorage(config.storage)
            : new DatabaseStorage(config.storage);

        // Initialize job manager
        this.jobManager = new JobManager(
            urlManager,
            crawler,
            parser,
            storage
        );

        // Set up event listeners
        this.setupEventListeners();
    }

    async startScraping(urls: string[], priority: number = 1): Promise<string> {
        return this.jobManager.startJob(urls, priority);
    }

    async pauseJob(jobId: string): Promise<void> {
        return this.jobManager.pauseJob(jobId);
    }

    async resumeJob(jobId: string): Promise<void> {
        return this.jobManager.resumeJob(jobId);
    }

    async cancelJob(jobId: string): Promise<void> {
        return this.jobManager.cancelJob(jobId);
    }

    getJobStatus(jobId: string) {
        return this.jobManager.getJobStatus(jobId);
    }

    private setupEventListeners(): void {
        this.jobManager
            .on('jobCompleted', (jobStatus) => {
                console.log(`Job ${jobStatus.id} completed. Success rate: ${
                    ((jobStatus.completedTasks / jobStatus.tasks.length) * 100).toFixed(2)
                }%`);
            })
            .on('jobPaused', (jobId) => {
                console.log(`Job ${jobId} paused`);
            })
            .on('jobResumed', (jobId) => {
                console.log(`Job ${jobId} resumed`);
            })
            .on('jobCancelled', (jobId) => {
                console.log(`Job ${jobId} cancelled`);
            })
            .on('taskUpdated', (task) => {
                console.log(`Task ${task.id} status updated to ${task.status}`);
            });
    }
}

// Export types
export * from './types';
export * from './interfaces';