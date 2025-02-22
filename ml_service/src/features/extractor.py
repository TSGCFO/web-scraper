from typing import Dict, List, Any, Optional
import numpy as np
import spacy
from PIL import Image
import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModel
from dataclasses import dataclass

@dataclass
class FeatureConfig:
    use_nlp: bool = True
    use_vision: bool = True
    text_model: str = "en_core_web_sm"
    vision_model: str = "resnet18"
    max_text_length: int = 512
    image_size: tuple = (224, 224)

class FeatureExtractor:
    def __init__(self, config: FeatureConfig):
        self.config = config
        self._initialize_extractors()

    def _initialize_extractors(self) -> None:
        # Initialize NLP components
        if self.config.use_nlp:
            self.nlp = spacy.load(self.config.text_model)
            self.tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
            self.text_model = AutoModel.from_pretrained("bert-base-uncased")

        # Initialize Vision components
        if self.config.use_vision:
            self.vision_model = torch.hub.load('pytorch/vision', 
                                            self.config.vision_model, 
                                            pretrained=True)
            self.vision_model.eval()

    async def extract_features(self, content: Dict[str, Any]) -> Dict[str, np.ndarray]:
        features = {}
        
        # Extract text features
        if self.config.use_nlp and 'text' in content:
            text_features = await self._extract_text_features(content['text'])
            features.update(text_features)

        # Extract image features
        if self.config.use_vision and 'images' in content:
            image_features = await self._extract_image_features(content['images'])
            features.update(image_features)

        return features

    async def _extract_text_features(self, text: str) -> Dict[str, np.ndarray]:
        # Truncate text if needed
        text = text[:self.config.max_text_length]

        # SpaCy features
        doc = self.nlp(text)
        spacy_features = {
            'pos_tags': self._get_pos_distribution(doc),
            'entities': self._get_entity_distribution(doc),
            'text_stats': self._get_text_statistics(doc)
        }

        # BERT embeddings
        inputs = self.tokenizer(text, return_tensors="pt", 
                              max_length=self.config.max_text_length,
                              truncation=True, padding=True)
        with torch.no_grad():
            outputs = self.text_model(**inputs)
            embeddings = outputs.last_hidden_state.mean(dim=1).numpy()

        return {
            'spacy_features': spacy_features,
            'bert_embeddings': embeddings
        }

    async def _extract_image_features(self, images: List[str]) -> Dict[str, np.ndarray]:
        if not images:
            return {'image_features': np.array([])}

        all_features = []
        for image_path in images:
            try:
                # Load and preprocess image
                image = Image.open(image_path).convert('RGB')
                image = image.resize(self.config.image_size)
                image_tensor = torch.FloatTensor(np.array(image)).permute(2, 0, 1).unsqueeze(0)
                
                # Extract features
                with torch.no_grad():
                    features = self.vision_model(image_tensor)
                    features = features.numpy()
                
                all_features.append(features)
            except Exception as e:
                print(f"Error processing image {image_path}: {e}")
                continue

        return {
            'image_features': np.mean(all_features, axis=0) if all_features else np.array([])
        }

    def _get_pos_distribution(self, doc) -> np.ndarray:
        pos_counts = {}
        for token in doc:
            pos_counts[token.pos_] = pos_counts.get(token.pos_, 0) + 1
        total = len(doc)
        return np.array([pos_counts.get(pos, 0) / total for pos in self.nlp.pipe_labels['tagger']])

    def _get_entity_distribution(self, doc) -> np.ndarray:
        ent_counts = {}
        for ent in doc.ents:
            ent_counts[ent.label_] = ent_counts.get(ent.label_, 0) + 1
        total = len(doc.ents) or 1
        return np.array([ent_counts.get(ent, 0) / total for ent in self.nlp.pipe_labels['ner']])

    def _get_text_statistics(self, doc) -> np.ndarray:
        return np.array([
            len(doc),  # Document length
            len([t for t in doc if not t.is_punct]),  # Word count
            len([t for t in doc if t.is_stop]),  # Stop word count
            len(doc.ents),  # Named entity count
            len(set([t.lemma_ for t in doc])) / (len(doc) or 1),  # Lexical diversity
            sum(t.is_oov for t in doc) / (len(doc) or 1)  # Out-of-vocabulary ratio
        ])