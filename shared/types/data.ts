export interface ScrapedData {
    url: string;
    content: string;
    metadata: {
        timestamp: string;
        contentType: string;
        statusCode: number;
        headers: Record<string, string>;
    };
    extractedData: Record<string, any>;
}

export interface MLPrediction {
    predictions: Array<{
        label: string;
        confidence: number;
        category?: string;
    }>;
    features: Record<string, any>;
    metadata: {
        modelName: string;
        timestamp: string;
        processingTime: number;
        anomalyScore?: number;
    };
}

export interface ProcessingResult {
    taskId: string;
    status: 'completed' | 'failed';
    data?: MLPrediction;
    error?: string;
    metadata: {
        startTime: string;
        endTime: string;
        processingTime: number;
        modelVersion: string;
    };
}

export interface MLServiceRequest {
    taskId: string;
    data: ScrapedData;
    config?: {
        modelName?: string;
        threshold?: number;
        features?: string[];
    };
}

export interface MLServiceResponse {
    taskId: string;
    status: 'success' | 'error';
    result?: MLPrediction;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

export interface TrainingData {
    samples: ScrapedData[];
    labels: Array<{
        id: string;
        value: string | number;
        category?: string;
    }>;
    metadata: {
        timestamp: string;
        source: string;
        version: string;
    };
}

export interface ModelMetrics {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    confusionMatrix: number[][];
    timestamp: string;
    modelVersion: string;
}

export interface FeatureExtraction {
    input: {
        text?: string;
        html?: string;
        images?: string[];
    };
    config: {
        textFeatures?: boolean;
        imageFeatures?: boolean;
        customFeatures?: string[];
    };
    output: Record<string, any>;
}