from typing import Dict, List, Any, Optional
import numpy as np
from sklearn.base import BaseEstimator
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from .base import BaseModel, ModelConfig, ModelRegistry
from ..features.extractor import FeatureExtractor, FeatureConfig

class MLPipeline(BaseModel):
    def __init__(self, config: ModelConfig):
        super().__init__(config)
        self.feature_extractor = FeatureExtractor(
            FeatureConfig(**config.feature_config)
        )

    def _initialize_model(self) -> None:
        # Initialize scikit-learn pipeline
        self.pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', RandomForestClassifier(
                n_estimators=100,
                max_depth=None,
                min_samples_split=2,
                random_state=42
            ))
        ])

        # Initialize anomaly detector
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42
        )

    async def predict(self, features: np.ndarray) -> Dict[str, Any]:
        # Check if model is trained
        if not self.is_trained:
            raise RuntimeError("Model must be trained before prediction")

        try:
            # Detect anomalies
            anomaly_scores = self.anomaly_detector.score_samples(features)
            is_anomaly = anomaly_scores < self.config.confidence_threshold

            # Make predictions
            predictions = self.pipeline.predict(features)
            probabilities = self.pipeline.predict_proba(features)

            # Get confidence scores
            confidence_scores = np.max(probabilities, axis=1)

            return {
                'predictions': predictions.tolist(),
                'confidence_scores': confidence_scores.tolist(),
                'anomaly_scores': anomaly_scores.tolist(),
                'is_anomaly': is_anomaly.tolist()
            }
        except Exception as e:
            raise RuntimeError(f"Prediction error: {str(e)}")

    async def train(self, features: np.ndarray, labels: np.ndarray) -> None:
        try:
            # Train anomaly detector
            self.anomaly_detector.fit(features)

            # Train classifier
            self.pipeline.fit(features, labels)

            self.is_trained = True
        except Exception as e:
            raise RuntimeError(f"Training error: {str(e)}")

    async def validate(self, features: np.ndarray, labels: np.ndarray) -> Dict[str, float]:
        if not self.is_trained:
            raise RuntimeError("Model must be trained before validation")

        try:
            # Calculate metrics
            predictions = self.pipeline.predict(features)
            probabilities = self.pipeline.predict_proba(features)
            anomaly_scores = self.anomaly_detector.score_samples(features)

            # Accuracy
            accuracy = np.mean(predictions == labels)

            # Confidence metrics
            mean_confidence = np.mean(np.max(probabilities, axis=1))
            min_confidence = np.min(np.max(probabilities, axis=1))

            # Anomaly metrics
            anomaly_ratio = np.mean(anomaly_scores < self.config.confidence_threshold)

            return {
                'accuracy': float(accuracy),
                'mean_confidence': float(mean_confidence),
                'min_confidence': float(min_confidence),
                'anomaly_ratio': float(anomaly_ratio)
            }
        except Exception as e:
            raise RuntimeError(f"Validation error: {str(e)}")

    @property
    def metadata(self) -> Dict[str, Any]:
        return {
            'model_type': self.config.model_type,
            'is_trained': self.is_trained,
            'feature_config': self.config.feature_config,
            'pipeline_steps': [
                (name, type(step).__name__)
                for name, step in self.pipeline.named_steps.items()
            ],
            'classifier_params': self.pipeline.named_steps['classifier'].get_params(),
            'anomaly_detector_params': self.anomaly_detector.get_params()
        }

# Register the pipeline model
ModelRegistry.register_model('default', MLPipeline(ModelConfig(
    model_type='default',
    confidence_threshold=0.85,
    feature_config={
        'use_nlp': True,
        'use_vision': True
    }
)))