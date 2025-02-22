import axios, { AxiosInstance } from 'axios';
import { ScrapedData, MLPrediction, ProcessingResult } from '@shared/types/data';
import { EventEmitter } from 'events';
import amqp from 'amqplib';

export interface MLServiceConfig {
    apiEndpoint: string;
    queueConfig: {
        url: string;
        taskQueue: string;
        resultQueue: string;
    };
    retryAttempts: number;
    timeout: number;
}

export class MLService extends EventEmitter {
    private client: AxiosInstance;
    private config: MLServiceConfig;
    private queueConnection?: amqp.Connection;
    private queueChannel?: amqp.Channel;

    constructor(config: MLServiceConfig) {
        super();
        this.config = config;
        this.client = axios.create({
            baseURL: config.apiEndpoint,
            timeout: config.timeout
        });
    }

    async initialize(): Promise<void> {
        await this.setupMessageQueue();
    }

    async predict(data: ScrapedData): Promise<MLPrediction> {
        try {
            const response = await this.client.post('/api/v1/predict', {
                content: data,
                model_name: 'default'
            });
            return response.data;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`ML prediction failed: ${message}`);
        }
    }

    async extractFeatures(content: Record<string, any>): Promise<Record<string, any>> {
        try {
            const response = await this.client.post('/api/v1/extract-features', {
                content,
                config: {}
            });
            return response.data.features;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Feature extraction failed: ${message}`);
        }
    }

    async submitTrainingData(data: ScrapedData[], labels: number[]): Promise<void> {
        try {
            await this.client.post('/api/v1/train', {
                features: data,
                labels,
                model_name: 'default'
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Training submission failed: ${message}`);
        }
    }

    async processDataAsync(data: ScrapedData): Promise<string> {
        if (!this.queueChannel) {
            throw new Error('Message queue not initialized');
        }

        // Generate task ID
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Publish task to queue
        await this.queueChannel.assertQueue(this.config.queueConfig.taskQueue, { durable: true });
        this.queueChannel.sendToQueue(
            this.config.queueConfig.taskQueue,
            Buffer.from(JSON.stringify({ taskId, data })),
            { persistent: true }
        );

        return taskId;
    }

    async getProcessingResult(taskId: string, timeout: number = 30000): Promise<ProcessingResult> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Processing timeout'));
            }, timeout);

            this.once(`result:${taskId}`, (result: ProcessingResult) => {
                clearTimeout(timer);
                resolve(result);
            });
        });
    }

    private async setupMessageQueue(): Promise<void> {
        try {
            // Connect to RabbitMQ
            this.queueConnection = await amqp.connect(this.config.queueConfig.url);
            this.queueChannel = await this.queueConnection.createChannel();

            // Setup result queue and consumer
            await this.queueChannel.assertQueue(this.config.queueConfig.resultQueue, { durable: true });
            await this.queueChannel.consume(
                this.config.queueConfig.resultQueue,
                (msg: amqp.ConsumeMessage | null) => {
                    if (msg) {
                        const result = JSON.parse(msg.content.toString());
                        this.emit(`result:${result.taskId}`, result.data);
                        this.queueChannel?.ack(msg);
                    }
                },
                { noAck: false }
            );

            // Handle connection events
            this.queueConnection.on('error', this.handleQueueError.bind(this));
            this.queueConnection.on('close', this.handleQueueClose.bind(this));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to setup message queue: ${message}`);
        }
    }

    private async handleQueueError(error: Error): Promise<void> {
        console.error('Message queue error:', error);
        await this.reconnectQueue();
    }

    private async handleQueueClose(): Promise<void> {
        console.warn('Message queue connection closed');
        await this.reconnectQueue();
    }

    private async reconnectQueue(): Promise<void> {
        try {
            await this.setupMessageQueue();
        } catch (error) {
            console.error('Failed to reconnect to message queue:', error);
            // Retry with exponential backoff
            setTimeout(() => this.reconnectQueue(), 5000);
        }
    }

    async close(): Promise<void> {
        if (this.queueChannel) {
            await this.queueChannel.close();
        }
        if (this.queueConnection) {
            await this.queueConnection.close();
        }
    }
}