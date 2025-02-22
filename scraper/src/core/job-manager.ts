import { EventEmitter } from 'events';
import { CrawlTask, JobStatus } from '../types';
import { UrlManager } from './url-manager';
import { Crawler } from './crawler';
import { Parser } from './parser';
import { DataStorage } from './storage';

export class JobManager extends EventEmitter {
    private urlManager: UrlManager;
    private crawler: Crawler;
    private parser: Parser;
    private storage: DataStorage;
    private activeJobs: Map<string, JobStatus>;
    private isRunning: boolean;

    constructor(
        urlManager: UrlManager,
        crawler: Crawler,
        parser: Parser,
        storage: DataStorage
    ) {
        super();
        this.urlManager = urlManager;
        this.crawler = crawler;
        this.parser = parser;
        this.storage = storage;
        this.activeJobs = new Map();
        this.isRunning = false;
    }

    async startJob(urls: string[], priority: number = 1): Promise<string> {
        const jobId = this.generateJobId();
        const tasks: CrawlTask[] = urls.map(url => ({
            id: this.generateTaskId(),
            url,
            priority,
            retryCount: 0,
            maxRetries: 3,
            status: 'pending',
            timestamp: new Date().toISOString()
        }));

        const jobStatus: JobStatus = {
            id: jobId,
            tasks,
            completedTasks: 0,
            failedTasks: 0,
            startTime: new Date().toISOString(),
            status: 'running'
        };

        this.activeJobs.set(jobId, jobStatus);
        
        // Add URLs to queue
        await Promise.all(
            tasks.map(task => this.urlManager.enqueue(task.url, task.priority))
        );

        if (!this.isRunning) {
            this.startProcessing();
        }

        return jobId;
    }

    async pauseJob(jobId: string): Promise<void> {
        const job = this.activeJobs.get(jobId);
        if (job && job.status === 'running') {
            job.status = 'paused';
            this.activeJobs.set(jobId, job);
            this.emit('jobPaused', jobId);
        }
    }

    async resumeJob(jobId: string): Promise<void> {
        const job = this.activeJobs.get(jobId);
        if (job && job.status === 'paused') {
            job.status = 'running';
            this.activeJobs.set(jobId, job);
            if (!this.isRunning) {
                this.startProcessing();
            }
            this.emit('jobResumed', jobId);
        }
    }

    async cancelJob(jobId: string): Promise<void> {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.status = 'failed';
            job.endTime = new Date().toISOString();
            this.activeJobs.set(jobId, job);
            this.emit('jobCancelled', jobId);
        }
    }

    getJobStatus(jobId: string): JobStatus | undefined {
        return this.activeJobs.get(jobId);
    }

    private async startProcessing(): Promise<void> {
        this.isRunning = true;

        while (this.hasActiveTasks()) {
            try {
                const url = await this.urlManager.dequeue();
                if (!url) {
                    await this.sleep(1000);
                    continue;
                }

                const task = this.findTaskByUrl(url);
                if (!task || this.isJobPaused(task)) {
                    continue;
                }

                await this.processTask(task);
            } catch (error) {
                console.error('Error in processing loop:', error);
                await this.sleep(1000);
            }
        }

        this.isRunning = false;
    }

    private async processTask(task: CrawlTask): Promise<void> {
        try {
            task.status = 'processing';
            this.updateTask(task);

            // Crawl
            const crawlResult = await this.crawler.crawl(task.url);
            
            // Parse
            const parseResult = await this.parser.parse(crawlResult.content);
            
            // Store
            await this.storage.store({
                ...crawlResult,
                ...parseResult,
                taskId: task.id
            });

            task.status = 'completed';
            this.updateTaskCompletion(task, true);
        } catch (error) {
            if (task.retryCount < task.maxRetries) {
                task.retryCount++;
                task.status = 'pending';
                await this.urlManager.enqueue(task.url, task.priority);
            } else {
                task.status = 'failed';
                this.updateTaskCompletion(task, false);
            }
        }

        this.updateTask(task);
    }

    private updateTaskCompletion(task: CrawlTask, success: boolean): void {
        const job = this.findJobByTask(task);
        if (job) {
            if (success) {
                job.completedTasks++;
            } else {
                job.failedTasks++;
            }

            if (job.completedTasks + job.failedTasks === job.tasks.length) {
                job.status = job.failedTasks === 0 ? 'completed' : 'failed';
                job.endTime = new Date().toISOString();
                this.emit('jobCompleted', job);
            }

            this.activeJobs.set(job.id, job);
        }
    }

    private updateTask(task: CrawlTask): void {
        const job = this.findJobByTask(task);
        if (job) {
            const taskIndex = job.tasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
                job.tasks[taskIndex] = task;
                this.activeJobs.set(job.id, job);
                this.emit('taskUpdated', task);
            }
        }
    }

    private hasActiveTasks(): boolean {
        return Array.from(this.activeJobs.values()).some(
            job => job.status === 'running' && job.completedTasks + job.failedTasks < job.tasks.length
        );
    }

    private isJobPaused(task: CrawlTask): boolean {
        const job = this.findJobByTask(task);
        return job?.status === 'paused';
    }

    private findTaskByUrl(url: string): CrawlTask | undefined {
        for (const job of this.activeJobs.values()) {
            const task = job.tasks.find(t => t.url === url && t.status === 'pending');
            if (task) return task;
        }
        return undefined;
    }

    private findJobByTask(task: CrawlTask): JobStatus | undefined {
        for (const job of this.activeJobs.values()) {
            if (job.tasks.some(t => t.id === task.id)) {
                return job;
            }
        }
        return undefined;
    }

    private generateJobId(): string {
        return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateTaskId(): string {
        return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}