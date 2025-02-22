# Technical Stack and Configuration

## TypeScript Core Service
1. Runtime Environment
   - Node.js v20+
   - TypeScript 5.x
   - ES2020 target

2. Dependencies
   - axios: HTTP client
   - cheerio: HTML parsing
   - puppeteer: JavaScript rendering
   - amqplib: RabbitMQ client
   - generic-pool: Resource pooling

3. Configuration
   - tsconfig.json: TypeScript configuration
   - Strict type checking enabled
   - Path aliases for imports
   - Source maps for debugging

## Python ML Service
1. Runtime Environment
   - Python 3.13+
   - Conda environment
   - FastAPI framework

2. Dependencies
   - scikit-learn: ML algorithms
   - PyTorch: Deep learning
   - spaCy: NLP processing
   - NLTK: Text processing
   - numpy/pandas: Data processing

3. Configuration
   - FastAPI settings
   - Model configurations
   - Feature extraction settings

## Shared Components
1. Type Definitions
   - Shared TypeScript interfaces
   - Data transfer objects
   - API contracts

2. Message Queue
   - RabbitMQ
   - Durable queues
   - Dead letter exchanges

## Development Setup
1. TypeScript Service
   ```bash
   npm install
   npm run build
   npm run dev
   ```

2. Python Service
   ```bash
   conda create -n web-scraper-ml python=3.13
   conda activate web-scraper-ml
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

## Environment Variables
1. TypeScript Service
   ```env
   NODE_ENV=development
   PORT=3000
   API_VERSION=v1
   RABBITMQ_URL=amqp://localhost
   ```

2. Python Service
   ```env
   PYTHON_ENV=development
   ML_SERVICE_PORT=8000
   MODEL_PATH=./models
   LOG_LEVEL=debug
   ```

## API Endpoints
1. ML Service
   - POST /api/v1/predict
   - POST /api/v1/train
   - POST /api/v1/extract-features
   - GET /api/v1/models/{model_name}/metadata

2. Health Checks
   - GET /health
   - GET /api/v1/info

## Resource Requirements
1. Development
   - 4+ CPU cores
   - 8GB+ RAM
   - 20GB+ storage

2. Production (Recommended)
   - 8+ CPU cores
   - 16GB+ RAM
   - 50GB+ SSD storage
   - Dedicated GPU (optional)

## Security Configuration
1. Rate Limiting
   - Per-IP limits
   - Per-endpoint limits
   - Global rate limits

2. CORS Settings
   - Allowed origins
   - Allowed methods
   - Credential handling

## Monitoring Setup
1. Metrics
   - Request rates
   - Response times
   - Error rates
   - Resource usage

2. Logging
   - Structured JSON logs
   - Log levels
   - Rotation policy