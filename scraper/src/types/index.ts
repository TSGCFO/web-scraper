export interface CrawlResult {
    url: string;
    content: string;
    statusCode: number;
    headers: Record<string, string>;
    timestamp: string;
    metadata: Record<string, any>;
}

export interface ParseResult {
    data: Record<string, any>;
    selectors: Record<string, string>;
    timestamp: string;
    metadata: {
        processingTime: number;
        encoding: string;
        contentLength: number;
    };
}

export interface StorageResult {
    id: string;
    success: boolean;
    timestamp: string;
    error?: string;
}

export interface CrawlTask {
    id: string;
    url: string;
    priority: number;
    retryCount: number;
    maxRetries: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    timestamp: string;
}

export interface JobStatus {
    id: string;
    tasks: CrawlTask[];
    completedTasks: number;
    failedTasks: number;
    startTime: string;
    endTime?: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
}

export interface MetricsData {
    requestCount: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
    queueSize: number;
    timestamp: string;
}