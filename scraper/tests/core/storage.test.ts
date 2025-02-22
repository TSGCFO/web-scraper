import { FileStorage, DatabaseStorage } from '../../src/core/storage';
import { StorageConfig, ConnectionConfig } from '../../src/interfaces';
import { StorageResult } from '../../src/types';

// Mock fs/promises module
const mockFs = {
    writeFile: jest.fn(),
    mkdir: jest.fn(),
};

jest.mock('fs/promises', () => mockFs);

describe('Storage', () => {
    describe('FileStorage', () => {
        let storage: FileStorage;
        const defaultConfig: StorageConfig = {
            type: 'file',
            connection: {
                host: 'localhost', // Required by ConnectionConfig
                port: 0, // Required by ConnectionConfig
                path: '/test/storage'
            },
            batchSize: 2,
            compression: false
        };

        beforeEach(() => {
            jest.clearAllMocks();
            storage = new FileStorage(defaultConfig);
            // Force initialize fs
            (storage as any).fs = mockFs;
        });

        describe('store', () => {
            const testData = { key: 'value' };

            it('should store data successfully', async () => {
                mockFs.writeFile.mockResolvedValueOnce(undefined);

                const result = await storage.store(testData);

                expect(result.success).toBe(true);
                expect(result.id).toBeDefined();
                expect(result.timestamp).toBeDefined();
                expect(mockFs.writeFile).toHaveBeenCalledWith(
                    `${defaultConfig.connection.path}/${result.id}.json`,
                    JSON.stringify(testData, null, 2)
                );
            });

            it('should handle write errors', async () => {
                const error = new Error('Write failed');
                mockFs.writeFile.mockRejectedValueOnce(error);

                const result = await storage.store(testData);

                expect(result.success).toBe(false);
                expect(result.error).toBe('Write failed');
                expect(result.timestamp).toBeDefined();
            });

            it('should use compression when enabled', async () => {
                const compressedStorage = new FileStorage({
                    ...defaultConfig,
                    compression: true
                });
                (compressedStorage as any).fs = mockFs;

                await compressedStorage.store(testData);

                expect(mockFs.writeFile).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.any(String)
                );
            });
        });

        describe('batchStore', () => {
            const testBatch = [
                { id: 1, data: 'test1' },
                { id: 2, data: 'test2' },
                { id: 3, data: 'test3' }
            ];

            it('should store batch data respecting batch size', async () => {
                mockFs.writeFile.mockResolvedValue(undefined);

                const results = await storage.batchStore(testBatch);

                expect(results).toHaveLength(testBatch.length);
                expect(results.every(r => r.success)).toBe(true);
                expect(mockFs.writeFile).toHaveBeenCalledTimes(testBatch.length);
            });

            it('should handle partial batch failures', async () => {
                mockFs.writeFile
                    .mockResolvedValueOnce(undefined)
                    .mockRejectedValueOnce(new Error('Write failed'))
                    .mockResolvedValueOnce(undefined);

                const results = await storage.batchStore(testBatch);

                expect(results).toHaveLength(testBatch.length);
                expect(results.filter(r => r.success)).toHaveLength(2);
                expect(results.filter(r => !r.success)).toHaveLength(1);
            });
        });

        describe('validateSchema', () => {
            it('should validate data schema', async () => {
                const result = await storage.validateSchema({ test: 'data' });
                expect(result).toBe(true);
            });
        });
    });

    describe('DatabaseStorage', () => {
        let storage: DatabaseStorage;
        const defaultConfig: StorageConfig = {
            type: 'sql',
            connection: {
                host: 'localhost',
                port: 5432,
                username: 'test',
                password: 'test',
                database: 'test'
            },
            batchSize: 2,
            compression: false
        };

        beforeEach(() => {
            storage = new DatabaseStorage(defaultConfig);
        });

        describe('store', () => {
            const testData = { key: 'value' };

            it('should store data successfully', async () => {
                const result = await storage.store(testData);

                expect(result.success).toBe(true);
                expect(result.id).toBeDefined();
                expect(result.timestamp).toBeDefined();
            });

            it('should handle storage errors', async () => {
                // Mock internal insertData method to throw error
                jest.spyOn(storage as any, 'insertData').mockRejectedValueOnce(new Error('Insert failed'));

                const result = await storage.store(testData);

                expect(result.success).toBe(false);
                expect(result.error).toBe('Insert failed');
                expect(result.timestamp).toBeDefined();
            });
        });

        describe('batchStore', () => {
            const testBatch = [
                { id: 1, data: 'test1' },
                { id: 2, data: 'test2' },
                { id: 3, data: 'test3' }
            ];

            it('should store batch data respecting batch size', async () => {
                const results = await storage.batchStore(testBatch);

                expect(results).toHaveLength(testBatch.length);
                expect(results.every(r => r.success)).toBe(true);
            });

            it('should handle batch insertion errors', async () => {
                // Mock internal insertBatch method to throw error
                jest.spyOn(storage as any, 'insertBatch').mockRejectedValueOnce(new Error('Batch insert failed'));

                const results = await storage.batchStore(testBatch.slice(0, 2));

                expect(results).toHaveLength(2);
                expect(results.every(r => !r.success)).toBe(true);
                expect(results.every(r => r.error === 'Batch insert failed')).toBe(true);
            });
        });

        describe('validateSchema', () => {
            it('should validate data schema', async () => {
                const result = await storage.validateSchema({ test: 'data' });
                expect(result).toBe(true);
            });
        });

        describe('initialization', () => {
            it('should throw error for unsupported database type', () => {
                expect(() => new DatabaseStorage({
                    ...defaultConfig,
                    type: 'invalid' as any
                })).toThrow('Unsupported database type: invalid');
            });
        });
    });
});