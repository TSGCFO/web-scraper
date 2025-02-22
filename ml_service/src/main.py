from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
from pydantic import BaseModel

from config import settings
from models.base import ModelRegistry
from models.pipeline import MLPipeline
from features.extractor import FeatureExtractor, FeatureConfig

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class PredictionRequest(BaseModel):
    content: Dict[str, Any]
    model_name: str = "default"

class TrainingRequest(BaseModel):
    features: List[Dict[str, Any]]
    labels: List[int]
    model_name: str = "default"

class FeatureExtractionRequest(BaseModel):
    content: Dict[str, Any]
    config: Dict[str, Any] = {}

@app.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check endpoint"""
    return {"status": "healthy"}

@app.get(f"{settings.API_V1_PREFIX}/info")
async def service_info() -> Dict[str, Any]:
    """Get service information"""
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "available_models": ModelRegistry.list_models(),
        "ml_components": {
            "nlp": "spacy",
            "vision": "pytorch",
            "classification": "scikit-learn"
        }
    }

@app.post(f"{settings.API_V1_PREFIX}/predict")
async def predict(request: PredictionRequest) -> Dict[str, Any]:
    """Make predictions using the specified model"""
    try:
        model = ModelRegistry.get_model(request.model_name)
        if not model:
            raise HTTPException(status_code=404, detail=f"Model {request.model_name} not found")

        # Extract features
        features = await model.feature_extractor.extract_features(request.content)
        
        # Make prediction
        result = await model.predict(features)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(f"{settings.API_V1_PREFIX}/train")
async def train(request: TrainingRequest, background_tasks: BackgroundTasks) -> Dict[str, str]:
    """Train or update the specified model"""
    try:
        model = ModelRegistry.get_model(request.model_name)
        if not model:
            raise HTTPException(status_code=404, detail=f"Model {request.model_name} not found")

        # Schedule training in background
        background_tasks.add_task(model.train, request.features, request.labels)
        return {"status": "Training scheduled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(f"{settings.API_V1_PREFIX}/extract-features")
async def extract_features(request: FeatureExtractionRequest) -> Dict[str, Any]:
    """Extract features from content"""
    try:
        extractor = FeatureExtractor(FeatureConfig(**request.config))
        features = await extractor.extract_features(request.content)
        return {"features": features}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get(f"{settings.API_V1_PREFIX}/models/{{model_name}}/metadata")
async def get_model_metadata(model_name: str) -> Dict[str, Any]:
    """Get metadata for the specified model"""
    metadata = ModelRegistry.get_model_metadata(model_name)
    if not metadata:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    return metadata

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )