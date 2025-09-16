from fastapi import FastAPI, HTTPException, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel  # Pydantic 모델 사용
from typing import Optional, List, Dict
import httpx  # 부트캠프 방식: httpx 사용
import uuid
from datetime import datetime

app = FastAPI(title="nrv 영단어 분석기", description="ChatGPT 기반 스마트 영단어 학습")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 및 템플릿 설정
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# 부트캠프 API 엔드포인트 URL (API 키 불필요!)
BOOTCAMP_API_URL = "https://dev.wenivops.co.kr/services/openai-api"

# 메모리 기반 데이터 저장소
users_db = {}  # {username: {password, name, email, created_at}}
sessions_db = {}  # {session_id: {username, created_at}}
chat_history_db = {}  # {username: [chat_records]}

# Pydantic 모델들
class UserRegister(BaseModel):
    username: str
    password: str
    name: str
    email: str

class UserLogin(BaseModel):
    username: str
    password: str

class WordAnalysisRequest(BaseModel):
    word: str
    session_id: str

class ChatRecord(BaseModel):
    id: str
    word: str
    basic_analysis: Optional[str] = None
    advanced_analysis: Optional[str] = None
    timestamp: datetime

# 유틸리티 함수들
def get_current_user(session_id: str) -> Optional[str]:
    """세션 ID로 현재 사용자 확인"""
    session = sessions_db.get(session_id)
    if session:
        return session["username"]
    return None

async def call_chatgpt_api(prompt: str) -> str:
    """부트캠프 API를 통한 ChatGPT 호출"""
    try:
        print(f"🤖 부트캠프 ChatGPT API 호출 시작: {prompt[:50]}...")
        
        # 부트캠프 API 형식에 맞는 메시지 배열 생성
        messages = [
            {"role": "system", "content": "당신은 전문적인 영어 교육자입니다. 영단어를 정확하고 자세히 분석해주세요."},
            {"role": "user", "content": prompt}
        ]
        
        # 비동기 HTTP 클라이언트로 API 호출
        async with httpx.AsyncClient() as client:
            response = await client.post(
                BOOTCAMP_API_URL,
                json=messages,  # 메시지 배열을 JSON으로 전송
                timeout=30.0  # 30초 타임아웃 설정
            )
            
            # HTTP 상태 코드 확인
            response.raise_for_status()
            
            # 응답을 JSON으로 파싱
            response_data = response.json()
            
            # 응답에서 AI 메시지 추출
            ai_message = response_data["choices"][0]["message"]["content"]
            
            print(f"✅ 부트캠프 API 응답 성공: {len(ai_message)}자")
            return ai_message
            
    except httpx.TimeoutException:
        error_msg = "API 요청 시간이 초과되었습니다"
        print(f"❌ API 타임아웃: {error_msg}")
        return f"분석 중 오류가 발생했습니다: {error_msg}"
    except httpx.HTTPStatusError as e:
        error_msg = f"API 오류: {e.response.status_code}"
        print(f"❌ API HTTP 오류: {error_msg}")
        return f"분석 중 오류가 발생했습니다: {error_msg}"
    except Exception as e:
        error_msg = f"서버 오류: {str(e)}"
        print(f"❌ API 일반 오류: {error_msg}")
        return f"분석 중 오류가 발생했습니다: {error_msg}"

# 프롬프트 템플릿들
BASIC_ANALYSIS_PROMPT = """
다음 영단어에 대해 한국어로 분석해주세요: "{word}"

반드시 아래 형식을 정확히 따라주세요:

🟢 발음 (미국식 기준)
**발음기호**: [정확한 IPA 발음기호] 
**발음**: [한국어 발음] 
**강세**: [강세 표시된 한국어 발음과 길이 설명]

🟢 대표 뜻 2~3가지
* [한국어 의미1]
* [한국어 의미2]  
* [한국어 의미3]

🟢 예문 (3개)
1. 
예문: [영어 예문1]
해석: [한국어 번역1]
해당 문장에서 단어 뜻: [한국어 의미]

2.
예문: [영어 예문2]
해석: [한국어 번역2]
해당 문장에서 단어 뜻: [한국어 의미]

3.
예문: [영어 예문3]
해석: [한국어 번역3]
해당 문장에서 단어 뜻: [한국어 의미]

중요 규칙:
1. 예문 3개는 대표 뜻에 나온 단어를 활용해서 작성
2. [한국어 의미1]은 주요 뜻, [한국어 의미2]는 부가 뜻, [한국어 의미3]은 다른 품사 뜻
3. 대표 뜻 2~3가지에서 품사만 다른 같은 의미 제시 금지 (예: 달리기, 달리다 사용 금지)
4. 예문에서 사용되는 단어는 대표 뜻에서 언급된 단어를 반드시 사용
5. 모든 내용은 간단히! (문자 외에 불필요한 기호 생략)
"""

ADVANCED_ANALYSIS_PROMPT = """
다음 영단어에 대해 심화 분석을 해주세요: "{word}"

반드시 아래 형식을 정확히 따라주세요:

🟢 주요 숙어
1. [숙어1]
• [한국어 의미]

2. [숙어2]  
• [한국어 의미]

🟢 상세 의미
**비유적 설명**: "{word}"는 마치 **[적절한 비유]**와 같습니다. [비유적 설명을 2-3문장으로]

**어원 및 의미확장**
* (어원 의미)**에서 유래 → [의미 변화 과정]
* [의미 확장 과정 설명]
* [현대적 의미 확장 설명]

🟢 유의어
1. [유의어1] - [한국어 뜻]
2. [유의어2] - [한국어 뜻]
3. [유의어3] - [한국어 뜻]

중요 규칙:
1. 주요 숙어는 간단한 한국어 의미만, 불필요한 표기 제거
2. 비유적 설명은 추상적인 내용은 없이 구체적으로 쉽게 이야기식으로 
3. 비유적 설명에서 단어의 뜻을 바로 직접적으로 연결해서 쓰지 않기 (안 좋은 예: run은 개가 달리는 모습과 같습니다.)
4. 유의어는 한 단어 뜻만, 차이점 설명 제거
5. 유의어는 분석 단어의 다의어적 성격을 표현할 수 있어야 함 (예: run의 유의어 - flow, manage, operate)
6. 모든 설명은 간단명료하게 (문자 외에 불필요한 기호 생략)
"""

# 페이지 라우트들
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """로그인/회원가입 화면"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/chat", response_class=HTMLResponse)
async def chat_page(request: Request):
    """기본분석 화면"""
    return templates.TemplateResponse("chat.html", {"request": request})

@app.get("/advanced", response_class=HTMLResponse)
async def advanced_page(request: Request):
    """심화분석 화면"""
    return templates.TemplateResponse("advanced_chat.html", {"request": request})

@app.get("/history", response_class=HTMLResponse)
async def history_page(request: Request):
    """히스토리 화면"""
    return templates.TemplateResponse("history.html", {"request": request})

# 인증 관련 API
@app.post("/api/register")
async def register(user: UserRegister):
    """회원가입"""
    if user.username in users_db:
        raise HTTPException(status_code=400, detail="이미 존재하는 사용자명입니다")
    
    # 입력 검증
    if len(user.username) < 3:
        raise HTTPException(status_code=400, detail="사용자명은 3자 이상이어야 합니다")
    
    if len(user.password) < 4:
        raise HTTPException(status_code=400, detail="비밀번호는 4자 이상이어야 합니다")
    
    if not user.email or "@" not in user.email:
        raise HTTPException(status_code=400, detail="올바른 이메일 주소를 입력해주세요")
    
    # 사용자 데이터 저장
    users_db[user.username] = {
        "password": user.password,
        "name": user.name,
        "email": user.email,
        "created_at": datetime.now()
    }
    
    # 사용자별 채팅 히스토리 초기화
    chat_history_db[user.username] = []
    
    print(f"✅ 새 사용자 등록: {user.username}")
    return {"message": "회원가입이 완료되었습니다"}

@app.post("/api/login")
async def login(user: UserLogin):
    """로그인"""
    if user.username not in users_db:
        raise HTTPException(status_code=401, detail="존재하지 않는 사용자입니다")
    
    if users_db[user.username]["password"] != user.password:
        raise HTTPException(status_code=401, detail="비밀번호가 틀렸습니다")
    
    # 세션 생성
    session_id = str(uuid.uuid4())
    sessions_db[session_id] = {
        "username": user.username,
        "created_at": datetime.now()
    }
    
    print(f"✅ 사용자 로그인: {user.username}")
    return {"session_id": session_id, "message": "로그인 성공"}

@app.post("/api/logout")
async def logout(session_id: str):
    """로그아웃"""
    username = get_current_user(session_id)
    if session_id in sessions_db:
        del sessions_db[session_id]
    
    print(f"✅ 사용자 로그아웃: {username}")
    return {"message": "로그아웃 되었습니다"}

@app.get("/api/user-info")
async def get_user_info(session_id: str):
    """사용자 정보 조회"""
    username = get_current_user(session_id)
    if not username:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    user_data = users_db[username]
    return {
        "username": username,
        "name": username,  # ID를 이름으로 사용
        "email": user_data["email"]
    }

@app.post("/api/analyze-basic")
async def analyze_basic(request: WordAnalysisRequest):
    """기본 영단어 분석 - 완전한 중복 방지 버전"""
    username = get_current_user(request.session_id)
    if not username:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    # 입력 검증
    if not request.word or not request.word.strip():
        raise HTTPException(status_code=400, detail="분석할 단어를 입력해주세요")
    
    word = request.word.strip().lower()  # 소문자로 통일
    
    # 영어 단어 검증
    if not word.isalpha():
        raise HTTPException(status_code=400, detail="영어 단어만 입력 가능합니다")
    
    print(f"🔍 기본 분석 요청: {word} (사용자: {username})")
    
    # 사용자 히스토리 확인 및 초기화
    if username not in chat_history_db:
        chat_history_db[username] = []
    
    user_history = chat_history_db[username]
    
    # 기존 기록에서 같은 단어 찾기 (대소문자 무시)
    existing_record = None
    existing_index = -1
    for i, record in enumerate(user_history):
        if record["word"].lower() == word:
            existing_record = record
            existing_index = i
            break
    
    # ChatGPT API 호출
    prompt = BASIC_ANALYSIS_PROMPT.format(word=word)
    analysis_result = await call_chatgpt_api(prompt)
    
    if existing_record:
        # 기존 기록 업데이트 (기본 분석만 교체)
        existing_record["basic_analysis"] = analysis_result
        existing_record["timestamp"] = datetime.now()
        # 기존 기록을 맨 앞으로 이동 (최신 순서 유지)
        user_history.pop(existing_index)
        user_history.insert(0, existing_record)
        print(f"✅ 기존 기록 업데이트 및 최상단 이동: {word}")
        record_id = existing_record["id"]
    else:
        # 새로운 기록 생성 (맨 앞에 추가)
        chat_record = {
            "id": str(uuid.uuid4()),
            "word": word,
            "basic_analysis": analysis_result,
            "advanced_analysis": None,
            "timestamp": datetime.now()
        }
        user_history.insert(0, chat_record)  # 맨 앞에 추가
        print(f"✅ 새로운 기본 분석 기록 생성: {word}")
        record_id = chat_record["id"]
    
    return {
        "word": word,
        "analysis": analysis_result,
        "record_id": record_id
    }

@app.post("/api/analyze-advanced")
async def analyze_advanced(request: WordAnalysisRequest):
    """심화 영단어 분석 - 완전한 중복 방지 버전"""
    username = get_current_user(request.session_id)
    if not username:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    # 입력 검증
    if not request.word or not request.word.strip():
        raise HTTPException(status_code=400, detail="분석할 단어를 입력해주세요")
    
    word = request.word.strip().lower()  # 소문자로 통일
    
    print(f"🔍 심화 분석 요청: {word} (사용자: {username})")
    
    # 사용자 히스토리 확인 및 초기화
    if username not in chat_history_db:
        chat_history_db[username] = []
    
    user_history = chat_history_db[username]
    
    # 기존 기록에서 같은 단어 찾기 (대소문자 무시)
    existing_record = None
    existing_index = -1
    for i, record in enumerate(user_history):
        if record["word"].lower() == word:
            existing_record = record
            existing_index = i
            break
    
    # ChatGPT API 호출
    prompt = ADVANCED_ANALYSIS_PROMPT.format(word=word)
    analysis_result = await call_chatgpt_api(prompt)
    
    if existing_record:
        # 기존 기록에 심화 분석 추가/업데이트
        existing_record["advanced_analysis"] = analysis_result
        existing_record["timestamp"] = datetime.now()
        # 기존 기록을 맨 앞으로 이동 (최신 순서 유지)
        user_history.pop(existing_index)
        user_history.insert(0, existing_record)
        print(f"✅ 기존 기록에 심화 분석 추가 및 최상단 이동: {word}")
    else:
        # 새로운 기록 생성 (심화 분석만, 맨 앞에 추가)
        chat_record = {
            "id": str(uuid.uuid4()),
            "word": word,
            "basic_analysis": None,
            "advanced_analysis": analysis_result,
            "timestamp": datetime.now()
        }
        user_history.insert(0, chat_record)  # 맨 앞에 추가
        print(f"✅ 새로운 심화 분석 기록 생성: {word}")
    
    return {
        "word": word,
        "analysis": analysis_result
    }

@app.get("/api/chat-history")
async def get_chat_history(session_id: str):
    """채팅 히스토리 조회 - 오류 해결 버전"""
    try:
        username = get_current_user(session_id)
        if not username:
            raise HTTPException(status_code=401, detail="인증이 필요합니다")
        
        user_history = chat_history_db.get(username, [])
        print(f"📊 히스토리 조회 시작: {username} ({len(user_history)}개 원본 기록)")
        
        # 히스토리 데이터 검증 및 정리
        valid_history = []
        for i, record in enumerate(user_history):
            try:
                # 각 기록이 필수 필드를 가지고 있는지 확인
                if not isinstance(record, dict):
                    print(f"⚠️ 기록 {i}: dict가 아님 - {type(record)}")
                    continue
                
                if "word" not in record or "timestamp" not in record:
                    print(f"⚠️ 기록 {i}: 필수 필드 누락 - {record.keys()}")
                    continue
                
                # timestamp 처리
                timestamp = record["timestamp"]
                if isinstance(timestamp, datetime):
                    # datetime 객체인 경우 문자열로 변환
                    timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
                elif isinstance(timestamp, str):
                    # 이미 문자열인 경우 그대로 사용
                    timestamp_str = timestamp
                else:
                    # 기타 타입인 경우 현재 시간으로 대체
                    print(f"⚠️ 기록 {i}: timestamp 타입 오류 - {type(timestamp)}")
                    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                # 정리된 기록 생성
                clean_record = {
                    "id": record.get("id", f"auto_{i}"),
                    "word": record["word"],
                    "basic_analysis": record.get("basic_analysis"),
                    "advanced_analysis": record.get("advanced_analysis"),
                    "timestamp": timestamp_str
                }
                
                valid_history.append(clean_record)
                print(f"✅ 기록 {i} 처리 완료: {record['word']}")
                
            except Exception as record_error:
                print(f"❌ 기록 {i} 처리 중 오류: {record_error}")
                continue
        
        # 최신 순으로 정렬
        try:
            sorted_history = sorted(valid_history, key=lambda x: x["timestamp"], reverse=True)
        except Exception as sort_error:
            print(f"❌ 정렬 중 오류: {sort_error}")
            # 정렬 실패 시 원본 순서 유지
            sorted_history = valid_history
        
        print(f"✅ 히스토리 조회 완료: {username} ({len(sorted_history)}개 유효 기록)")
        return {"history": sorted_history}
        
    except HTTPException:
        # HTTPException은 그대로 전달
        raise
    except Exception as e:
        print(f"❌ 히스토리 조회 중 예상치 못한 오류: {e}")
        print(f"❌ 오류 상세: {type(e).__name__}: {str(e)}")
        
        # 개발용: 상세 오류 정보 반환
        raise HTTPException(
            status_code=500, 
            detail=f"히스토리 조회 중 오류가 발생했습니다: {str(e)}"
        )

# 디버깅용 히스토리 상태 확인 API
@app.get("/api/debug-history")
async def debug_history(session_id: str):
    """디버깅용: 히스토리 원본 데이터 확인"""
    username = get_current_user(session_id)
    if not username:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    user_history = chat_history_db.get(username, [])
    
    debug_info = {
        "username": username,
        "total_records": len(user_history),
        "records": []
    }
    
    for i, record in enumerate(user_history):
        record_info = {
            "index": i,
            "type": type(record).__name__,
            "keys": list(record.keys()) if isinstance(record, dict) else "NOT_DICT",
            "word": record.get("word", "NO_WORD") if isinstance(record, dict) else "NO_WORD",
            "timestamp_type": type(record.get("timestamp")).__name__ if isinstance(record, dict) else "NO_TIMESTAMP",
            "timestamp_value": str(record.get("timestamp")) if isinstance(record, dict) else "NO_TIMESTAMP"
        }
        debug_info["records"].append(record_info)
    
    return debug_info

# API 테스트 엔드포인트
@app.get("/api/test-chatgpt")
async def test_chatgpt():
    """부트캠프 ChatGPT API 연결 테스트"""
    try:
        test_prompt = "안녕하세요! API 테스트입니다."
        result = await call_chatgpt_api(test_prompt)
        return {
            "status": "success",
            "message": "부트캠프 ChatGPT API 연결 성공!",
            "api_url": BOOTCAMP_API_URL,
            "response": result[:100] + "..." if len(result) > 100 else result
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"부트캠프 ChatGPT API 연결 실패: {str(e)}"
        }

# 헬스체크
@app.get("/health")
async def health_check():
    """서버 상태 확인"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "users_count": len(users_db),
        "active_sessions": len(sessions_db),
        "api_url": BOOTCAMP_API_URL,
        "api_type": "부트캠프 프록시 서버"
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 nrv 영단어 분석기 서버를 시작합니다...")
    print("🎓 부트캠프 ChatGPT API 사용 (API 키 불필요!)")
    print("📝 로그인 화면: http://localhost:8000")
    print("🧪 API 테스트: http://localhost:8000/api/test-chatgpt")
    print("📚 API 문서: http://localhost:8000/docs")
    print("❤️ 서버 상태: http://localhost:8000/health")
    print("🔍 히스토리 디버그: http://localhost:8000/api/debug-history?session_id=YOUR_SESSION")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)