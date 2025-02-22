import { Parser, ParseResult } from '../../src/core/parser';
import { ParserConfig } from '../../src/interfaces';
import * as cheerio from 'cheerio';

jest.mock('cheerio');

describe('Parser', () => {
    let parser: Parser;
    const defaultConfig: ParserConfig = {
        selectors: {
            title: 'h1',
            description: 'meta[name="description"]@content',
            paragraphs: 'p[]',
            link: 'a@href'
        },
        timeout: 5000,
        encoding: 'utf-8',
        validateOutput: true
    };

    beforeEach(() => {
        jest.clearAllMocks();
        parser = new Parser(defaultConfig);
    });

    describe('parse', () => {
        const sampleHtml = `
            <html>
                <head>
                    <meta name="description" content="Test description">
                </head>
                <body>
                    <h1>Test Title</h1>
                    <p>Paragraph 1</p>
                    <p>Paragraph 2</p>
                    <a href="https://example.com">Link</a>
                </body>
            </html>
        `;

        it('should parse HTML and extract data based on selectors', async () => {
            const mockCheerio = {
                text: jest.fn().mockReturnValue('Test Title'),
                attr: jest.fn().mockReturnValue('Test description'),
                map: jest.fn().mockReturnValue({
                    get: () => ['Paragraph 1', 'Paragraph 2']
                }),
                length: 1
            };

            (cheerio.load as jest.Mock).mockReturnValue((selector: string) => {
                switch (selector) {
                    case 'h1':
                        return { ...mockCheerio, text: () => 'Test Title' };
                    case 'meta[name="description"]':
                        return { ...mockCheerio, attr: () => 'Test description' };
                    case 'p':
                        return {
                            ...mockCheerio,
                            map: (callback: any) => ({
                                get: () => ['Paragraph 1', 'Paragraph 2']
                            })
                        };
                    case 'a':
                        return { ...mockCheerio, attr: () => 'https://example.com' };
                    default:
                        return { length: 0 };
                }
            });

            const result = await parser.parse(sampleHtml);

            expect(result).toMatchObject({
                data: {
                    title: 'Test Title',
                    description: 'Test description',
                    paragraphs: ['Paragraph 1', 'Paragraph 2'],
                    link: 'https://example.com'
                },
                selectors: defaultConfig.selectors,
                metadata: {
                    encoding: defaultConfig.encoding,
                    contentLength: sampleHtml.length
                }
            });
            expect(result.timestamp).toBeDefined();
            expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
        });

        it('should handle empty or invalid selectors gracefully', async () => {
            const mockCheerio = {
                text: jest.fn().mockReturnValue(''),
                attr: jest.fn().mockReturnValue(null),
                length: 0
            };

            (cheerio.load as jest.Mock).mockReturnValue(() => mockCheerio);

            const result = await parser.parse(sampleHtml);

            expect(result.data).toEqual({
                title: null,
                description: null,
                paragraphs: [],
                link: null
            });
        });

        it('should validate output when enabled', async () => {
            const mockCheerio = {
                text: jest.fn().mockReturnValue(''),
                attr: jest.fn().mockReturnValue(null),
                length: 0
            };

            (cheerio.load as jest.Mock).mockReturnValue(() => mockCheerio);

            const emptyParser = new Parser({
                ...defaultConfig,
                validateOutput: true
            });

            await expect(emptyParser.parse(sampleHtml)).rejects.toThrow('Validation failed: Empty data');
        });

        it('should handle malformed HTML gracefully', async () => {
            const malformedHtml = '<invalid>';
            (cheerio.load as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid HTML');
            });

            await expect(parser.parse(malformedHtml)).rejects.toThrow('Parsing error: Invalid HTML');
        });

        describe('selector types', () => {
            beforeEach(() => {
                const mockCheerio = {
                    text: jest.fn().mockReturnValue('Test content'),
                    attr: jest.fn().mockReturnValue('Test attribute'),
                    map: jest.fn().mockReturnValue({
                        get: () => ['Item 1', 'Item 2']
                    }),
                    length: 1
                };

                (cheerio.load as jest.Mock).mockReturnValue(() => mockCheerio);
            });

            it('should handle text selectors', async () => {
                const textParser = new Parser({
                    ...defaultConfig,
                    selectors: { content: '.text-content' }
                });

                const result = await textParser.parse(sampleHtml);
                expect(result.data.content).toBe('Test content');
            });

            it('should handle attribute selectors', async () => {
                const attrParser = new Parser({
                    ...defaultConfig,
                    selectors: { link: 'a@href' }
                });

                const result = await attrParser.parse(sampleHtml);
                expect(result.data.link).toBe('Test attribute');
            });

            it('should handle array selectors', async () => {
                const arrayParser = new Parser({
                    ...defaultConfig,
                    selectors: { items: '.item[]' }
                });

                const result = await arrayParser.parse(sampleHtml);
                expect(result.data.items).toEqual(['Item 1', 'Item 2']);
            });
        });
    });
});