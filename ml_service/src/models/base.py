from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import numpy as np
from pydantic import BaseModel

class ModelConfig(BaseModel):
    model_type: str
    confidence_threshold: float = 0.85
    training_interval: int = 3600  # seconds
    min_samples: int = 100
    feature_config: Dict[str, Any] = {}

class BaseModel(ABC):
    def __init__(self, config: ModelConfig):
        self.config = config
        self.is_trained = False
        self._initialize_model()

    @abstractmethod
    def _initialize_model(self) -> None:
        """Initialize the underlying ML model"""
        pass

    @abstractmethod
    async def predict(self, features: np.ndarray) -> Dict[str, Any]:
        """Make predictions using the model"""
        pass

    @abstractmethod
    async def train(self, features: np.ndarray, labels: np.ndarray) -> None:
        """Train the model with new data"""
        pass

    @abstractmethod
    async def validate(self, features: np.ndarray, labels: np.ndarray) -> Dict[str, float]:
        """Validate model performance"""
        pass

    @property
    @abstractmethod
    def metadata(self) -> Dict[str, Any]:
        """Get model metadata"""
        pass

class ModelRegistry:
    _instance = None
    _models: Dict[str, BaseModel] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelRegistry, cls).__new__(cls)
        return cls._instance

    @classmethod
    def register_model(cls, name: str, model: BaseModel) -> None:
        cls._models[name] = model

    @classmethod
    def get_model(cls, name: str) -> Optional[BaseModel]:
        return cls._models.get(name)

    @classmethod
    def list_models(cls) -> List[str]:
        return list(cls._models.keys())

    @classmethod
    def get_model_metadata(cls, name: str) -> Optional[Dict[str, Any]]:
        model = cls.get_model(name)
        return model.metadata if model else None