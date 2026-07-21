import os
import re
import time
import math
import asyncio
import hashlib
import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse



# .env 파일 로드 (override=True를 설정하여 파일이 변경되었을 때 환경변수를 강제 덮어씁니다.)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path, override=True)

app = FastAPI()

from analyzer import MusicEmotionAnalyzer
emotion_analyzer = MusicEmotionAnalyzer(use_api_fallback=True)

from music_analysis.emotion_engine_v2 import EmotionEngineV2
emotion_engine_v2 = EmotionEngineV2()

ALGO_VERSION = "3.2"



# CORS 설정
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://mmmhak.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 메모리 캐시 저장소
lyrics_cache = {}
analyze_cache = {}

class AudioFeaturesInput(BaseModel):
    bpm: float
    energy: float
    spectral_centroid: float
    dynamic_range: Optional[float] = 0.5
    vocal_range_energy: Optional[float] = 0.4

class AnalyzeRequest(BaseModel):
    lyrics: str
    title: str = "Unknown Title"
    artist: str = "Unknown Artist"
    bpm: float = 100.0
    audio_features: Optional[AudioFeaturesInput] = None



@app.get("/")
def read_root():
    return {"status": "ok", "message": "MMMHAK 주방 오픈!"}

@app.get("/log")
def log_frontend(msg: str):
    print("FRONTEND ERROR:", msg)
    return {"status": "logged"}

# 1. 라벨별 맞춤 hypothesis template (Valence 및 감정)
valence_hypotheses = [
    "This song has a positive and upbeat vibe.",
    "This song has a negative, heavy, or dark vibe."
]

emotion_hypotheses = {
    "Uplifting": "This song expresses uplifting joy, hopeful emotion, or romantic warmth.",
    "Energetic": "This song expresses high energy, powerful rhythm, and exciting vibes.",
    "Aggressive": "This song expresses intense anger, heavy distortion, or raw frustration.",
    "Melancholic": "This song expresses deep sadness, heartbreak, or melancholic sorrow.",
    "Desolation": "This song expresses lonely isolation, quiet emptiness, or desolate mood.",
    "Serenity": "This song expresses peaceful calm, relaxing serenity, or soothing melody."
}

# 3. 라벨별 threshold (초기값, 검증 데이터로 보정 예정)
thresholds = {
    "Serenity": 0.35,
    "Aggressive": 0.35,
    "Desolation": 0.30,
    "Uplifting": 0.20,
    "Melancholic": 0.20,
    "Energetic": 0.30
}

async def call_hf_zero_shot(client, api_url, headers, text, candidate_hypotheses, multi_label=False):
    payload = {
        "inputs": text,
        "parameters": {
            "candidate_labels": candidate_hypotheses,
            "hypothesis_template": "{}",
            "multi_label": multi_label
        }
    }
    max_retries = 3
    retry_delay = 2
    for attempt in range(max_retries):
        try:
            response = await client.post(api_url, headers=headers, json=payload, timeout=15.0)
            if response.status_code == 503:
                print(f"DEBUG: Model loading (503). Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                continue
            if response.status_code != 200:
                print(f"HuggingFace API Error (Attempt {attempt+1}): {response.status_code} - {response.text}")
                if attempt == max_retries - 1:
                    raise HTTPException(status_code=500, detail=f"HuggingFace API Error: {response.text}")
                await asyncio.sleep(retry_delay)
                continue
            data = response.json()
            
            if not isinstance(data, list):
                if isinstance(data, dict) and "labels" in data and "scores" in data:
                    return {label: score for label, score in zip(data["labels"], data["scores"])}
                raise HTTPException(status_code=500, detail="Invalid response format from HuggingFace API")
                
            return {item["label"]: item["score"] for item in data}
        except (httpx.RequestError, httpx.HTTPStatusError) as exc:
            print(f"DEBUG: HTTP request failed on attempt {attempt+1}: {exc}")
            if attempt == max_retries - 1:
                raise HTTPException(status_code=500, detail=f"HuggingFace API Connection Failed: {exc}")
            await asyncio.sleep(retry_delay)
    return {}

def apply_temperature(score: float, temperature: float = 2.0) -> float:
    if score == 0.0:
        return 0.0
    # Clamp to avoid math domain errors in log
    score = min(max(score, 1e-6), 1.0 - 1e-6)
    logit = math.log(score / (1.0 - score))
    scaled_logit = logit / temperature
    return round(1.0 / (1.0 + math.exp(-scaled_logit)), 3)

def extract_and_duplicate_chorus(lyrics: str) -> str:
    if not lyrics:
        return ""
    # Split paragraphs by empty lines
    paragraphs = re.split(r'\n\s*\n', lyrics.strip())
    processed_paragraphs = []
    
    # Match headers like [Chorus], [후렴], Chorus 1, 후렴구:, (Chorus) etc.
    chorus_pattern = re.compile(r'\[?(?:chorus|후렴).*?\]?', re.IGNORECASE)
    
    for para in paragraphs:
        lines = para.strip().split('\n')
        is_chorus = False
        if lines:
            first_line = lines[0].strip()
            if chorus_pattern.search(first_line):
                is_chorus = True
            elif len(lines) > 1 and chorus_pattern.search(lines[1].strip()):
                is_chorus = True
        
        # Check if the paragraph starts with chorus/후렴 identifier
        if not is_chorus:
            if re.match(r'^(?:chorus|후렴)\b', para.strip(), re.IGNORECASE):
                is_chorus = True
                
        if is_chorus:
            # Repeat chorus paragraph twice to double its weight
            processed_paragraphs.append(para)
            processed_paragraphs.append(para)
        else:
            processed_paragraphs.append(para)
            
    return "\n\n".join(processed_paragraphs)

def validate_lyrics(lyrics: str) -> bool:
    if not lyrics:
        return False
    text = lyrics.strip()
    if len(text) < 50:
        return False
    
    # Check for meaningless repetition
    cleaned = re.sub(r'[^\w\s]', '', text.lower())
    words = cleaned.split()
    if not words:
        return False
        
    unique_words = set(words)
    meaningless_words = {
        "la", "lala", "lalala", "lalalala", "lalalalala",
        "na", "nana", "nanana", "nananana", "nanananana",
        "oh", "ooh", "oooh", "ooooh", "oohh",
        "ah", "ahh", "ahhh", "ahhhh",
        "uh", "uhh", "uhhh",
        "yeah", "yea", "yeh", "yee",
        "baby", "babe",
        "dum", "da", "dada", "dadada",
        "woo", "wooo", "wow",
        "hey", "heyy", "yo", "yoo",
        "shulala", "shalala", "shalalalala",
        "sha", "shoo"
    }
    
    def is_meaningless_word(w):
        if w in meaningless_words:
            return True
        for syl in ["la", "na", "da", "dum", "ba", "ha", "hey", "yo", "woo", "oh", "ah", "uh", "yeah"]:
            if re.match(rf'^({syl}){{2,}}$', w):
                return True
        return False

    meaningful_words = [w for w in words if not is_meaningless_word(w)]
    
    if len(words) > 0 and (len(meaningful_words) / len(words)) < 0.25:
        return False
        
    if len(meaningful_words) < 5 or len(unique_words) < 5:
        return False
        
    return True

async def classify_lyrics(lyrics: str, threshold_override: dict = None):
    """
    가사에서 6대 감정(Uplifting, Energetic, Aggressive, Melancholic, Desolation, Serenity)을 1회의 Zero-Shot Classification 호출로 동시 분류하여
    성능을 2배 단축하고, 감정 배제(0점 처리) 없이 더욱 정확하게 혼합 감정(mixed vibe)을 잡아냅니다.
    """
    th = threshold_override or thresholds
    
    hf_key = os.getenv("HUGGINGFACE_API_KEY")
    if not hf_key:
        print("ERROR: HUGGINGFACE_API_KEY가 환경변수(.env)에 설정되어 있지 않습니다.")
        raise HTTPException(status_code=500, detail="HUGGINGFACE_API_KEY가 누락되었습니다.")
        
    api_url = "https://router.huggingface.co/hf-inference/models/joeddav/xlm-roberta-large-xnli"
    headers = {"Authorization": f"Bearer {hf_key}"}
    weighted_lyrics = extract_and_duplicate_chorus(lyrics)
    safe_lyrics = weighted_lyrics[:1024]
 
    all_emotions = ["Uplifting", "Energetic", "Aggressive", "Melancholic", "Desolation", "Serenity"]
    candidate_hyps = [emotion_hypotheses[emo] for emo in all_emotions]
 
    async with httpx.AsyncClient(timeout=15.0) as client:
        emo_res = await call_hf_zero_shot(client, api_url, headers, safe_lyrics, candidate_hyps, multi_label=True)
 
    # 점수 매핑
    scores = {}
    for emo in all_emotions:
        hyp = emotion_hypotheses[emo]
        scores[emo] = round(emo_res.get(hyp, 0.0), 3)
 
    # Valence 및 polarity 계산에 근거한 동적 valence_group 판별
    pos_score = scores["Serenity"] * 0.4 + scores["Uplifting"] * 0.3 + scores["Energetic"] * 0.3
    neg_score = scores["Melancholic"] * 0.4 + scores["Desolation"] * 0.3 + scores["Aggressive"] * 0.3
    valence_group = "positive" if pos_score >= neg_score else "negative"
 
    # 전체 6대 감정 중 최고 점수를 대표 감정으로 결정
    primary_emotion = max(all_emotions, key=scores.get)
    
    uplifting_theme_score = scores["Uplifting"]
    is_uplifting_themed = uplifting_theme_score >= th.get("Uplifting", 0.20)
    
    # 가사에서 기준치(threshold)를 넘긴 감정 라벨들의 목록
    matched_labels = [emo for emo in ["Serenity", "Energetic", "Aggressive", "Melancholic", "Desolation"] if scores[emo] >= th.get(emo, 0.30)]
    if is_uplifting_themed:
        matched_labels.append("Uplifting")
 
    # Temperature Scaling 적용 (보정 및 극단값 완화)
    scaled_scores = {}
    for emo, val in scores.items():
        scaled_scores[emo] = apply_temperature(val, temperature=2.0)
 
    return {
        "scores": scaled_scores,
        "raw_scores": scores,
        "primary_emotion": primary_emotion,
        "valence_group": valence_group,
        "love_theme_score": scaled_scores["love"],
        "is_love_themed": is_love_themed,
        "matched_labels": matched_labels,
        "top_label": primary_emotion,
    }

async def calibrate_thresholds(lyrics_list, ground_truth_labels):
    """
    검증셋(50곡 정도)으로 라벨별 점수 분포를 확인하고
    threshold를 보정하기 위한 함수.
    """
    import pandas as pd
    records = []
    for lyrics, true_label in zip(lyrics_list, ground_truth_labels):
        result = await classify_lyrics(lyrics, threshold_override={k: 0 for k in thresholds})
        record = {"true_label": true_label, **result["scores"]}
        records.append(record)

    df = pd.DataFrame(records)

    # 라벨별로 정답일 때의 점수 분포 vs 정답이 아닐 때의 점수 분포 비교
    for label in emotion_hypotheses.keys():
        true_scores = df[df["true_label"] == label][label]
        false_scores = df[df["true_label"] != label][label]
        print(f"\n[{label}]")
        print(f"  정답일 때 평균 점수: {true_scores.mean():.3f}")
        print(f"  오답일 때 평균 점수: {false_scores.mean():.3f}")
        # 이 두 분포 사이의 적절한 지점을 threshold로 설정

    return df

@app.post("/api/analyze")
async def analyze_lyrics(request: AnalyzeRequest):
    start_time = time.time()
    
    # AI 분석 API 호출 전 가사 텍스트 유효성 검사 수행
    if not request.lyrics or not validate_lyrics(request.lyrics):
        print(f"[DEBUG] Lyrics validation failed or empty for {request.artist} - {request.title}")
        neutral_scores = {
            "happy": 0.5,
            "sad": 0.5,
            "angry": 0.5,
            "love": 0.5,
            "lonely": 0.5,
            "confident": 0.5,
            "Serenity": 0.5,
            "Melancholic": 0.5,
            "Aggressive": 0.5,
            "Uplifting": 0.5,
            "Desolation": 0.5,
            "Energetic": 0.5
        }
        result = {
            "scores": {k: v for k, v in neutral_scores.items() if k in ["Serenity", "Melancholic", "Aggressive", "Uplifting", "Desolation", "Energetic"]},
            "matched_labels": [],
            "top_label": "none",
            "primary_emotion": "none",
            "valence_group": "neutral",
            "love_theme_score": 0.5,
            "is_love_themed": False,
            "uplifting_theme_score": 0.5,
            "is_uplifting_themed": False,
            "raw_scores": neutral_scores,
            "insufficient_data": True,
            "no_info": True,
            "is_cached": True
        }
        for label, score in neutral_scores.items():
            result[label] = score
        return result

    # 1. 로컬 캐시 확인
    cache_string = f"{request.lyrics}_{ALGO_VERSION}"
    lyrics_hash = hashlib.md5(cache_string.encode('utf-8')).hexdigest()
    if lyrics_hash in analyze_cache:
        cached_res = analyze_cache[lyrics_hash]
        cached_res["is_cached"] = True
        print(f"[DEBUG] [CACHE HIT] {request.artist} - {request.title}")
        return cached_res

    try:
        audio_feat_dict = None
        if request.audio_features:
            audio_feat_dict = {
                "bpm": request.audio_features.bpm,
                "energy": request.audio_features.energy,
                "spectral_centroid": request.audio_features.spectral_centroid,
                "dynamic_range": request.audio_features.dynamic_range,
                "vocal_range_energy": request.audio_features.vocal_range_energy
            }

        # 2. analyze 호출 (오디오 피처 인자 추가 전달)
        result = await emotion_engine_v2.analyze_track(
            lyrics=request.lyrics,
            title=request.title,
            artist=request.artist,
            bpm=request.bpm,
            audio_features=audio_feat_dict
        )
        
        # 캐싱 완료 상태 반영
        if result.get("is_cached", True):
            analyze_cache[lyrics_hash] = result
            result["is_cached"] = True
        else:
            result["is_cached"] = False

        total_duration = time.time() - start_time
        print(f"PROFILING: Total /api/analyze execution took {total_duration:.3f} seconds")
        return result

    except Exception as e:
        import traceback
        print(f"[Internal Analysis Error] {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Internal Engine Error: {str(e)}"
        )

@app.post("/api/analyze/merge")
async def analyze_merge(request: AnalyzeRequest):
    start_time = time.time()
    
    # Validate lyrics first
    if not request.lyrics or not validate_lyrics(request.lyrics):
        print(f"[DEBUG] [Merge] Lyrics validation failed or empty for {request.artist} - {request.title}")
        raise HTTPException(
            status_code=400,
            detail="Lyrics validation failed. Cannot perform merge analysis."
        )

    if not request.audio_features:
        raise HTTPException(
            status_code=400,
            detail="Missing audio_features payload for merge endpoint."
        )

    try:
        audio_feat_dict = {
            "bpm": request.audio_features.bpm,
            "energy": request.audio_features.energy,
            "spectral_centroid": request.audio_features.spectral_centroid,
            "dynamic_range": request.audio_features.dynamic_range,
            "vocal_range_energy": request.audio_features.vocal_range_energy
        }

        # Execute Phase 2: concurrency-locked fusion and cache save (30 days TTL)
        result = await emotion_engine_v2.analyze_track(
            lyrics=request.lyrics,
            title=request.title,
            artist=request.artist,
            bpm=request.bpm,
            audio_features=audio_feat_dict
        )
        
        total_duration = time.time() - start_time
        print(f"PROFILING: Total /api/analyze/merge execution took {total_duration:.3f} seconds")
        return result

    except Exception as e:
        import traceback
        print(f"[Internal Merge Error] {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Internal Engine Error during merge: {str(e)}"
        )

@app.get("/api/lyrics")
async def get_lyrics(title: str = "", artist: str = ""):
    start_time = time.time()
    
    # 1. 안전하게 캐시 키 생성 및 확인 (None 방지)
    title_str = (title or "").lower().strip()
    artist_str = (artist or "").lower().strip()
    cache_key = f"{title_str}_{artist_str}"
    
    if cache_key in lyrics_cache:
        print("PROFILING: [CACHE HIT] /api/lyrics returned from memory cache")
        print(f"PROFILING: Total /api/lyrics execution took {time.time() - start_time:.3f} seconds")
        cached_val = lyrics_cache[cache_key]
        if cached_val is None:
            return {"lyrics": None, "is_lyrics_available": False}
        return {"lyrics": cached_val, "is_lyrics_available": True}

    try:
        def clean_text(text):
            if not text: return ""
            cleaned = re.sub(r'\[\d{2}:\d{2}\.\d{2,3}\]', '', text)
            return cleaned.strip()

        # 1차 시도 (get)
        api_start = time.time()
        url = "https://lrclib.net/api/get"
        params = {"artist_name": artist_str, "track_name": title_str}
        headers = {"User-Agent": "MMMHAK-LyricsFinder/1.0 (https://mmmhak.vercel.app)"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, params=params, headers=headers)
            
        print(f"PROFILING: Lyrics 1st try (get) API took {time.time() - api_start:.3f} seconds")
        if response.status_code == 200:
            data = response.json()
            lyrics = None
            if data.get("plainLyrics"):
                lyrics = data["plainLyrics"]
            elif data.get("syncedLyrics"):
                lyrics = clean_text(data["syncedLyrics"])
                
            if lyrics:
                lyrics_cache[cache_key] = lyrics
                total_duration = time.time() - start_time
                print(f"PROFILING: Total /api/lyrics execution (1st try hit) took {total_duration:.3f} seconds")
                return {"lyrics": lyrics, "is_lyrics_available": True}
        
        # 2차 시도 (search)
        api_start2 = time.time()
        search_url = "https://lrclib.net/api/search"
        params = {"q": f"{artist_str} {title_str}".strip()}
        async with httpx.AsyncClient(timeout=20.0) as client:
            search_response = await client.get(search_url, params=params, headers=headers)
            
        print(f"PROFILING: Lyrics 2nd try (search) API took {time.time() - api_start2:.3f} seconds")
        if search_response.status_code == 200:
            search_data = search_response.json()
            if len(search_data) > 0:
                first_result = search_data[0]
                found_artist = first_result.get("artistName", "").lower()
                
                if artist_str not in found_artist and found_artist not in artist_str:
                    lyrics_cache[cache_key] = None
                    return {"lyrics": None, "is_lyrics_available": False, "reason": "정확한 가사를 찾을 수 없습니다."}

                lyrics = None
                if first_result.get("plainLyrics"):
                    lyrics = first_result["plainLyrics"]
                elif first_result.get("syncedLyrics"):
                    lyrics = clean_text(first_result["syncedLyrics"])

                if lyrics:
                    lyrics_cache[cache_key] = lyrics
                    total_duration = time.time() - start_time
                    print(f"PROFILING: Total /api/lyrics execution (2nd try hit) took {total_duration:.3f} seconds")
                    return {"lyrics": lyrics, "is_lyrics_available": True}
        
        total_duration = time.time() - start_time
        print(f"PROFILING: Total /api/lyrics execution (fail) took {total_duration:.3f} seconds")
        lyrics_cache[cache_key] = None
        return {"lyrics": None, "is_lyrics_available": False, "reason": "가사를 찾을 수 없습니다."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        lyrics_cache[cache_key] = None
        return {"lyrics": None, "is_lyrics_available": False, "reason": f"Lyrics service error: {type(e).__name__} - {str(e)}"}
        
@app.get("/api/itunes")
async def search_itunes(term: str = "", limit: int = 1, country: str = None):
    try:
        url = f"https://itunes.apple.com/search?term={term}&entity=song&limit={limit}"
        if country:
            url += f"&country={country}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url)
        return response.json()
    except Exception as e:
        print(f"iTunes Fetch Error: {e}")
        # 500 에러를 반환하지 않고 빈 결과를 200 OK로 안전하게 반환합니다.
        return {"resultCount": 0, "results": []}

from fastapi.responses import StreamingResponse

@app.get("/api/audio-proxy")
async def audio_proxy(url: str = Query(..., description="CORS bypass URL for iTunes assets")):
    # SSRF verification: Extract hostname and perform whitelist matching
    try:
        parsed_url = urlparse(url)
        hostname = parsed_url.hostname
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid target URL for proxying.")

    if not hostname:
        raise HTTPException(status_code=403, detail="Forbidden: Missing hostname.")

    # Suffix comparison: only audio-ssl.itunes.apple.com or *.itunes.apple.com
    is_valid = (
        hostname == "audio-ssl.itunes.apple.com" or 
        hostname.endswith(".itunes.apple.com")
    )
    if not is_valid:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Requested URL is not whitelisted for proxying."
        )

    try:
        client = httpx.AsyncClient(timeout=15.0)
        
        async def stream_generator():
            try:
                async with client.stream("GET", url) as response:
                    if response.status_code != 200:
                        yield b"Failed to retrieve stream"
                        return
                    async for chunk in response.iter_bytes(chunk_size=8192):
                        yield chunk
            except Exception as stream_err:
                print(f"[Proxy Stream Error] {stream_err}")
            finally:
                await client.aclose()

        headers = {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "audio/x-m4a"
        }
        return StreamingResponse(stream_generator(), headers=headers)
    except Exception as e:
        print(f"[Proxy Exception] {e}")
        raise HTTPException(status_code=500, detail=f"Proxy processing error: {str(e)}")