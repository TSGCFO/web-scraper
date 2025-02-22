import { BrowserConfig } from '../interfaces';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as genericPool from 'generic-pool';

export interface RenderOptions {
    waitForSelector?: string;
    waitForFunction?: string;
    timeout?: number;
    viewport?: { width: number; height: number };
    userAgent?: string;
    cookies?: Record<string, string>;
}

export interface RenderedContent {
    html: string;
    screenshot?: Buffer;
    metrics: {
        loadTime: number;
        jsHeapSize: number;
        domNodes: number;
    };
}

export class JavaScriptRenderer {
    private browserPool: genericPool.Pool<Browser>;
    private config: BrowserConfig;

    constructor(config: BrowserConfig) {
        this.config = config;
        this.browserPool = this.createBrowserPool();
    }

    async renderPage(url: string, options: RenderOptions = {}): Promise<RenderedContent> {
        const browser = await this.browserPool.acquire();
        const page = await browser.newPage();

        try {
            await this.configurePage(page, options);

            const startTime = Date.now();
            const response = await page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: options.timeout || this.config.timeout
            });

            if (!response) {
                throw new Error('Failed to load page');
            }

            // Wait for specific conditions if specified
            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector);
            }
            if (options.waitForFunction) {
                await page.waitForFunction(options.waitForFunction);
            }

            // Get page metrics
            const metrics = await this.getPageMetrics(page);

            // Get rendered content
            const html = await page.content();
            const screenshot = (await page.screenshot({ fullPage: true })) as Buffer;

            return {
                html,
                screenshot,
                metrics: {
                    loadTime: Date.now() - startTime,
                    ...metrics
                }
            };
        } finally {
            await page.close();
            await this.browserPool.release(browser);
        }
    }

    async executeScript(page: Page, script: string): Promise<any> {
        return page.evaluate(script);
    }

    async close(): Promise<void> {
        await this.browserPool.drain();
        await this.browserPool.clear();
    }

    private createBrowserPool(): genericPool.Pool<Browser> {
        const factory = {
            create: async () => {
                return puppeteer.launch({
                    headless: this.config.headless,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1920x1080'
                    ]
                });
            },
            destroy: async (browser: Browser) => {
                await browser.close();
            }
        };

        return genericPool.createPool(factory, {
            min: 1,
            max: 10,
            acquireTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
            evictionRunIntervalMillis: 1000
        });
    }

    private async configurePage(page: Page, options: RenderOptions): Promise<void> {
        // Set viewport
        const viewport = options.viewport || {
            width: this.config.viewport.width,
            height: this.config.viewport.height
        };
        await page.setViewport(viewport);

        // Set user agent
        const userAgent = options.userAgent || this.config.userAgent;
        await page.setUserAgent(userAgent);

        // Set cookies
        if (options.cookies) {
            const cookies = Object.entries(options.cookies).map(([name, value]) => ({
                name,
                value,
                domain: new URL(page.url()).hostname
            }));
            await page.setCookie(...cookies);
        }

        // Set request interception
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (
                request.resourceType() === 'image' ||
                request.resourceType() === 'font' ||
                request.resourceType() === 'media'
            ) {
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    private async getPageMetrics(page: Page): Promise<{ jsHeapSize: number; domNodes: number }> {
        const metrics = await page.metrics();
        return {
            jsHeapSize: metrics.JSHeapUsedSize || 0,
            domNodes: metrics.Nodes || 0
        };
    }
}