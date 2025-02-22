import { ParserConfig } from '../interfaces';
import * as cheerio from 'cheerio';

export class Parser {
    private config: ParserConfig;
    private validator: DataValidator;

    constructor(config: ParserConfig) {
        this.config = config;
        this.validator = new DataValidator();
    }

    async parse(html: string): Promise<ParseResult> {
        const startTime = Date.now();

        try {
            // Load HTML content
            const $ = cheerio.load(html, {
                xml: {
                    decodeEntities: true
                }
            });

            // Extract data based on selectors
            const data = await this.extractData($, this.config.selectors);

            // Validate output if required
            if (this.config.validateOutput) {
                await this.validator.validate(data);
            }

            return {
                data,
                selectors: this.config.selectors,
                timestamp: new Date().toISOString(),
                metadata: {
                    processingTime: Date.now() - startTime,
                    encoding: this.config.encoding,
                    contentLength: html.length
                }
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    private async extractData($: cheerio.CheerioAPI, selectors: Record<string, string>): Promise<Record<string, any>> {
        const result: Record<string, any> = {};

        for (const [key, selector] of Object.entries(selectors)) {
            try {
                if (this.isArraySelector(selector)) {
                    result[key] = this.extractArray($, selector);
                } else if (this.isAttributeSelector(selector)) {
                    result[key] = this.extractAttribute($, selector);
                } else {
                    result[key] = this.extractText($, selector);
                }
            } catch (error) {
                console.warn(`Failed to extract ${key} with selector ${selector}:`, error);
                result[key] = null;
            }
        }

        return result;
    }

    private extractArray($: cheerio.CheerioAPI, selector: string): string[] {
        const arraySelector = selector.replace(/\[\]$/, '');
        return $(arraySelector)
            .map((_, el) => $(el).text().trim())
            .get()
            .filter(text => text.length > 0);
    }

    private extractAttribute($: cheerio.CheerioAPI, selector: string): string | null {
        const [elementSelector, attribute] = selector.split('@');
        const element = $(elementSelector);
        return element.attr(attribute) || null;
    }

    private extractText($: cheerio.CheerioAPI, selector: string): string | null {
        const element = $(selector);
        return element.length > 0 ? element.text().trim() : null;
    }

    private isArraySelector(selector: string): boolean {
        return selector.endsWith('[]');
    }

    private isAttributeSelector(selector: string): boolean {
        return selector.includes('@');
    }

    private handleError(error: any): Error {
        if (error instanceof Error) {
            return error;
        }
        return new Error(`Parsing error: ${error.message || 'Unknown error'}`);
    }
}

class DataValidator {
    async validate(data: Record<string, any>): Promise<void> {
        // Implement validation logic here
        // For now, just check if data is not empty
        if (!data || Object.keys(data).length === 0) {
            throw new Error('Validation failed: Empty data');
        }
    }
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