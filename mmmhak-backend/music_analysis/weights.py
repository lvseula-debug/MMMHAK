# mmmhak-backend/music_analysis/weights.py
"""
Configuration module containing all weights, constants, anchors, and tables 
for Emotion Engine 2.0 calculations.
"""

# --- Normalization Anchors ---
TEMPO_MIN = 60.0
TEMPO_MAX = 200.0
LOUDNESS_MIN = -60.0
LOUDNESS_MAX = 0.0

# --- Audio Feature Formula Weights ---
# Weights must sum to 1.0
AUDIO_AROUSAL_WEIGHTS = {
    "tempo": 0.35,
    "energy": 0.30,
    "loudness": 0.20,
    "danceability": 0.15
}

AUDIO_VALENCE_WEIGHTS = {
    "valence": 0.60,
    "energy": 0.20,
    "acousticness": -0.20  # More acoustic usually dampens raw hyper-valence
}

# --- Genre Emotion Flat Modifiers ---
# Added directly to projected Valence / Arousal
GENRE_WEIGHTS = {
    "arousal": {
        "metal": 0.30,
        "rock": 0.15,
        "edm": 0.25,
        "electronic": 0.20,
        "dance": 0.20,
        "hip-hop": 0.10,
        "rap": 0.10,
        "lo-fi": -0.20,
        "classical": -0.30,
        "jazz": -0.15,
        "acoustic": -0.10,
        "ballad": -0.15
    },
    "valence": {
        "pop": 0.15,
        "happy": 0.20,
        "love": 0.15,
        "jazz": 0.10,
        "classical": 0.10,
        "metal": -0.15,
        "punk": -0.10,
        "sad": -0.25,
        "melancholy": -0.20,
        "lonely": -0.20
    }
}

# --- Instrument Emotion Flat Modifiers ---
# Added directly to projected Valence / Arousal
INSTRUMENT_WEIGHTS = {
    "arousal": {
        "drum": 0.25,
        "electric_guitar": 0.20,
        "brass": 0.15,
        "synth": 0.10,
        "bass": 0.10,
        "piano": -0.10,
        "strings": -0.15,
        "acoustic_guitar": -0.10
    },
    "valence": {
        "piano": 0.15,
        "acoustic_guitar": 0.15,
        "strings": 0.10,
        "vocal": 0.10,
        "electric_guitar": -0.10,
        "drum": 0.05
    }
}

# --- Modal Fusion / Projection Weights ---
# Defines the contribution of each modalities. Weights for each axis must sum to 1.0.
PROJECTION_WEIGHTS = {
    "arousal": {
        "tempo": 0.40,
        "energy": 0.60
    },
    "valence": {
        "lyrics": 1.00
    }
}

# --- Harmonic consonance tuning weights (Step 2) ---
W_h1 = 0.15
W_h2 = 0.15

# --- Confidence penalty parameters for low arousal (Step 3) ---
LOW_AROUSAL_PENALTY = 0.15
AROUSAL_THRESHOLD = 0.40

# --- External API Keys ---
LASTFM_API_KEY = "8031c3fd85fae84e3a1970b02e22a231"
LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/"


