// Core component interfaces based on component-design.md

export interface CrawlerConfig {
    maxConcurrentRequests: number;
    requestTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    userAgent: string;
}

export interface ParserConfig {
    selectors: Record<string, string>;
    timeout: number;
    encoding: string;
    validateOutput: boolean;
}

export interface StorageConfig {
    type: 'sql' | 'nosql' | 'file';
    connection: ConnectionConfig;
    batchSize: number;
    compression: boolean;
}

export interface QueueConfig {
    maxSize: number;
    priorityLevels: number;
    deduplicationWindow: number;
}

export interface PolicyConfig {
    rateLimits: Record<string, number>;
    robotsTxtEnforcement: boolean;
    crawlDelay: number;
}

export interface ErrorConfig {
    retryableErrors: string[];
    maxRetries: number;
    notificationThreshold: number;
}

export interface MonitoringConfig {
    metrics: string[];
    alertThresholds: Record<string, number>;
    logLevel: string;
}

export interface ConnectionConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
    database?: string;
    ssl?: boolean;
    timeout?: number;
    path?: string;  // For file system storage
}

export interface ProxyConfig {
    address: string;
    port: number;
    protocol: 'http' | 'https' | 'socks4' | 'socks5';
    username?: string;
    password?: string;
    location?: string;
    lastUsed?: Date;
    successRate?: number;
}

export interface BrowserConfig {
    headless: boolean;
    timeout: number;
    viewport: { width: number; height: number };
    userAgent: string;
    cookies?: Record<string, string>;
}

export type CaptchaType = 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha' | 'text' | 'image' | 'audio';

export interface CaptchaProvider {
    name: string;
    supportedTypes: CaptchaType[];
    apiKey: string;
    baseUrl: string;
}

export interface CaptchaConfig {
    providers: CaptchaProvider[];
    timeout: number;
    retryAttempts: number;
}

export interface SystemConfig {
    crawler: CrawlerConfig;
    proxy: ProxyConfig;
    parser: ParserConfig;
    storage: StorageConfig;
    queue: QueueConfig;
    policy: PolicyConfig;
    error: ErrorConfig;
    monitoring: MonitoringConfig;
}