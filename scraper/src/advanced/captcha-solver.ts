import { CaptchaConfig, CaptchaProvider, CaptchaType } from '../interfaces';
import axios from 'axios';
import { LRUCache } from 'lru-cache';

export interface CaptchaData {
    type: CaptchaType;
    siteKey?: string;
    url?: string;
    data?: string | Buffer;
    minScore?: number;  // For reCAPTCHA v3
    proxy?: string;
}

export class CaptchaSolver {
    private solverProviders: Map<string, CaptchaProvider>;
    private cache: LRUCache<string, string>;
    private config: CaptchaConfig;

    constructor(config: CaptchaConfig) {
        this.config = config;
        this.solverProviders = new Map();
        this.cache = new LRUCache({
            max: 1000,
            ttl: 1000 * 60 * 30  // 30 minutes
        });

        // Initialize providers
        this.config.providers.forEach(provider => {
            this.solverProviders.set(provider.name, provider);
        });
    }

    async solveCaptcha(type: CaptchaType, data: CaptchaData): Promise<string> {
        // Check cache first
        const cacheKey = this.getCacheKey(type, data);
        const cachedSolution = this.cache.get(cacheKey);
        if (cachedSolution) {
            return cachedSolution;
        }

        // Get suitable provider
        const provider = this.getProvider(type);
        if (!provider) {
            throw new Error(`No provider available for CAPTCHA type: ${type}`);
        }

        let solution: string;
        let retryCount = 0;

        while (retryCount < this.config.retryAttempts) {
            try {
                solution = await this.solveWithProvider(provider, data);
                
                // Validate solution
                if (await this.validateSolution(solution, data)) {
                    // Cache successful solution
                    this.cache.set(cacheKey, solution);
                    return solution;
                }
                
                throw new Error('Invalid solution');
            } catch (error: unknown) {
                retryCount++;
                if (retryCount >= this.config.retryAttempts) {
                    throw new Error(`Failed to solve CAPTCHA after ${retryCount} attempts`);
                }
                await this.sleep(this.config.timeout);
            }
        }

        throw new Error('Failed to solve CAPTCHA');
    }

    private async solveWithProvider(provider: CaptchaProvider, data: CaptchaData): Promise<string> {
        switch (data.type) {
            case 'recaptcha-v2':
            case 'recaptcha-v3':
                return this.solveRecaptcha(provider, data);
            case 'hcaptcha':
                return this.solveHcaptcha(provider, data);
            case 'text':
            case 'image':
                return this.solveImageOrText(provider, data);
            case 'audio':
                return this.solveAudio(provider, data);
            default:
                throw new Error(`Unsupported CAPTCHA type: ${data.type}`);
        }
    }

    private async solveRecaptcha(provider: CaptchaProvider, data: CaptchaData): Promise<string> {
        const response = await axios.post(`${provider.baseUrl}/recaptcha`, {
            apiKey: provider.apiKey,
            siteKey: data.siteKey,
            url: data.url,
            version: data.type === 'recaptcha-v3' ? 'v3' : 'v2',
            minScore: data.minScore,
            proxy: data.proxy
        });

        return response.data.solution;
    }

    private async solveHcaptcha(provider: CaptchaProvider, data: CaptchaData): Promise<string> {
        const response = await axios.post(`${provider.baseUrl}/hcaptcha`, {
            apiKey: provider.apiKey,
            siteKey: data.siteKey,
            url: data.url,
            proxy: data.proxy
        });

        return response.data.solution;
    }

    private async solveImageOrText(provider: CaptchaProvider, data: CaptchaData): Promise<string> {
        const response = await axios.post(`${provider.baseUrl}/image`, {
            apiKey: provider.apiKey,
            data: data.data?.toString('base64'),
            type: data.type
        });

        return response.data.solution;
    }

    private async solveAudio(provider: CaptchaProvider, data: CaptchaData): Promise<string> {
        const response = await axios.post(`${provider.baseUrl}/audio`, {
            apiKey: provider.apiKey,
            data: data.data?.toString('base64')
        });

        return response.data.solution;
    }

    private async validateSolution(solution: string, data: CaptchaData): Promise<boolean> {
        // Implement validation logic based on CAPTCHA type
        switch (data.type) {
            case 'recaptcha-v3':
                return this.validateRecaptchaV3Score(solution, data.minScore || 0.5);
            case 'text':
            case 'image':
                return solution.length > 0;
            default:
                return true;
        }
    }

    private async validateRecaptchaV3Score(token: string, minScore: number): Promise<boolean> {
        try {
            const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', {
                secret: this.config.providers[0].apiKey,
                response: token
            });

            return response.data.score >= minScore;
        } catch {
            return false;
        }
    }

    private getProvider(type: CaptchaType): CaptchaProvider | undefined {
        // Find provider that supports the CAPTCHA type
        for (const provider of this.solverProviders.values()) {
            if (provider.supportedTypes.includes(type)) {
                return provider;
            }
        }
        return undefined;
    }

    private getCacheKey(type: CaptchaType, data: CaptchaData): string {
        return `${type}:${data.siteKey || ''}:${data.url || ''}`;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}