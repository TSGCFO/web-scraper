import { ProxyConfig } from '../interfaces';
import axios, { AxiosInstance } from 'axios';

export class ProxyManager {
    private proxyPool: ProxyConfig[];
    private proxyRotationStrategy: 'round-robin' | 'random' | 'performance-based';
    private currentIndex: number;
    private performanceMetrics: Map<string, { successRate: number; lastUsed: Date }>;

    constructor(
        proxyPool: ProxyConfig[],
        strategy: 'round-robin' | 'random' | 'performance-based' = 'performance-based'
    ) {
        this.proxyPool = proxyPool;
        this.proxyRotationStrategy = strategy;
        this.currentIndex = 0;
        this.performanceMetrics = new Map();

        // Initialize performance metrics
        this.proxyPool.forEach(proxy => {
            this.performanceMetrics.set(this.getProxyKey(proxy), {
                successRate: 1.0,
                lastUsed: new Date(0)
            });
        });
    }

    async getNextProxy(): Promise<ProxyConfig> {
        if (this.proxyPool.length === 0) {
            throw new Error('No proxies available');
        }

        let proxy: ProxyConfig;

        switch (this.proxyRotationStrategy) {
            case 'round-robin':
                proxy = this.getRoundRobinProxy();
                break;
            case 'random':
                proxy = this.getRandomProxy();
                break;
            case 'performance-based':
                proxy = await this.getPerformanceBasedProxy();
                break;
            default:
                proxy = this.getRoundRobinProxy();
        }

        // Update last used timestamp
        const metrics = this.performanceMetrics.get(this.getProxyKey(proxy))!;
        metrics.lastUsed = new Date();
        this.performanceMetrics.set(this.getProxyKey(proxy), metrics);

        return proxy;
    }

    async updateProxyStatus(proxy: ProxyConfig, success: boolean): Promise<void> {
        const key = this.getProxyKey(proxy);
        const metrics = this.performanceMetrics.get(key)!;
        
        // Update success rate with exponential moving average
        const alpha = 0.1; // Weight for new data
        metrics.successRate = (alpha * (success ? 1 : 0)) + ((1 - alpha) * metrics.successRate);
        
        this.performanceMetrics.set(key, metrics);

        // Remove proxy if success rate is too low
        if (metrics.successRate < 0.2) {
            this.removeProxy(proxy);
        }
    }

    async addProxy(proxy: ProxyConfig): Promise<void> {
        // Validate proxy before adding
        try {
            await this.testProxy(proxy);
            this.proxyPool.push(proxy);
            this.performanceMetrics.set(this.getProxyKey(proxy), {
                successRate: 1.0,
                lastUsed: new Date()
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Invalid proxy: ${message}`);
        }
    }

    getProxyCount(): number {
        return this.proxyPool.length;
    }

    getProxyMetrics(): Map<string, { successRate: number; lastUsed: Date }> {
        return new Map(this.performanceMetrics);
    }

    private getRoundRobinProxy(): ProxyConfig {
        const proxy = this.proxyPool[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxyPool.length;
        return proxy;
    }

    private getRandomProxy(): ProxyConfig {
        const index = Math.floor(Math.random() * this.proxyPool.length);
        return this.proxyPool[index];
    }

    private async getPerformanceBasedProxy(): Promise<ProxyConfig> {
        // Sort proxies by success rate and last used time
        const sortedProxies = [...this.proxyPool].sort((a, b) => {
            const metricsA = this.performanceMetrics.get(this.getProxyKey(a))!;
            const metricsB = this.performanceMetrics.get(this.getProxyKey(b))!;

            // Combine success rate and time since last use
            const scoreA = metricsA.successRate * (1 + (Date.now() - metricsA.lastUsed.getTime()) / 60000);
            const scoreB = metricsB.successRate * (1 + (Date.now() - metricsB.lastUsed.getTime()) / 60000);

            return scoreB - scoreA;
        });

        return sortedProxies[0];
    }

    private async testProxy(proxy: ProxyConfig): Promise<void> {
        const client = this.createProxyClient(proxy);
        try {
            await client.get('http://example.com', { timeout: 5000 });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Proxy test failed: ${message}`);
        }
    }

    private createProxyClient(proxy: ProxyConfig): AxiosInstance {
        const auth = proxy.username && proxy.password
            ? { username: proxy.username, password: proxy.password }
            : undefined;

        return axios.create({
            proxy: {
                host: proxy.address,
                port: proxy.port,
                auth,
                protocol: proxy.protocol
            },
            timeout: 5000
        });
    }

    private removeProxy(proxy: ProxyConfig): void {
        const key = this.getProxyKey(proxy);
        this.proxyPool = this.proxyPool.filter(p => this.getProxyKey(p) !== key);
        this.performanceMetrics.delete(key);
    }

    private getProxyKey(proxy: ProxyConfig): string {
        return `${proxy.protocol}://${proxy.address}:${proxy.port}`;
    }
}