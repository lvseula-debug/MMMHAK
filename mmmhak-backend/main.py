import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai

# .env 파일 로드 (부모 폴더인 music-virus/.env)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

# Gemini API Key 설정
api_key = os.getenv("GEMINI_API_KEY")
if api_key and api_key != "여기에_키_입력":
    genai.configure(api_key=api_key)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    lyrics: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "MMMHAK 주방 오픈!"}

@app.post("/api/analyze")
def analyze_lyrics(request: AnalyzeRequest):
    if not api_key or api_key == "여기에_키_입력":
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 올바르게 설정되지 않았습니다.")
    
    prompt = f"""이 가사의 감정을 분석해서 joy, depression, anger, anxiety, stability 5가지 항목을 0.0부터 1.0 사이의 수치(float)로 평가해 줘. 다른 말은 절대 하지 말고 오직 JSON 객체로만 반환해.

가사:
{request.lyrics}"""
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
