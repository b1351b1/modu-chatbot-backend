// 전역 변수
let currentSessionId = null;
let currentWord = null;

// DOM 요소들
const usernameElement = document.getElementById('username');
const wordInput = document.getElementById('wordInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const analysisResult = document.getElementById('analysisResult');
const advancedBtn = document.getElementById('advancedBtn');
const historyBtn = document.getElementById('historyBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('기본분석 페이지가 로드되었습니다.');
    initializePage();
    setupEventListeners();
});

// 페이지 초기화
async function initializePage() {
    // 세션 ID 확인
    currentSessionId = localStorage.getItem('session_id');
    console.log('저장된 세션 ID:', currentSessionId);
    
    if (!currentSessionId) {
        alert('로그인이 필요합니다.');
        window.location.href = '/';
        return;
    }

    // 사용자 정보 로드
    await loadUserInfo();
}

// 사용자 정보 로드
async function loadUserInfo() {
    try {
        const response = await fetch(`/api/user-info?session_id=${currentSessionId}`);
        
        if (response.ok) {
            const userData = await response.json();
            console.log('사용자 정보:', userData);
            // 사용자 ID를 표시 (예: "user123님")
            usernameElement.textContent = `${userData.username}님`;
        } else {
            throw new Error('사용자 정보를 불러올 수 없습니다.');
        }
    } catch (error) {
        console.error('사용자 정보 로드 실패:', error);
        alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
        localStorage.removeItem('session_id');
        window.location.href = '/';
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    console.log('이벤트 리스너를 설정합니다.');
    
    // 분석하기 버튼 클릭
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', function(e) {
            console.log('분석하기 버튼 클릭됨');
            e.preventDefault();
            analyzeWord();
        });
    }
    
    // Enter 키 입력
    if (wordInput) {
        wordInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                console.log('Enter 키 입력됨');
                event.preventDefault();
                analyzeWord();
            }
        });
    }
    
    // 심화 분석 버튼 클릭
    if (advancedBtn) {
        advancedBtn.addEventListener('click', function(e) {
            console.log('심화 분석 버튼 클릭됨');
            e.preventDefault();
            goToAdvancedAnalysis();
        });
    }
    
    // 히스토리 버튼 클릭
    if (historyBtn) {
        historyBtn.addEventListener('click', function(e) {
            console.log('히스토리 버튼 클릭됨');
            e.preventDefault();
            goToHistory();
        });
    }
    
    // 로그아웃 버튼 클릭
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            console.log('로그아웃 버튼 클릭됨');
            e.preventDefault();
            logout();
        });
    }
    
    // 입력창 포커스
    if (wordInput) {
        wordInput.focus();
    }
    
    console.log('모든 이벤트 리스너가 설정되었습니다.');
}

// 영단어 분석 함수
async function analyzeWord() {
    console.log('영단어 분석 시작');
    
    const word = wordInput.value.trim();
    
    if (!word) {
        alert('분석할 영단어를 입력해주세요.');
        wordInput.focus();
        return;
    }
    
    // 영어 단어 검증 (기본적인 검증)
    if (!/^[a-zA-Z]+$/.test(word)) {
        alert('영어 단어만 입력해주세요.');
        wordInput.focus();
        return;
    }
    
    currentWord = word;
    console.log('분석할 단어:', currentWord);
    showLoading(true);
    
    try {
        const response = await fetch('/api/analyze-basic', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                word: word,
                session_id: currentSessionId
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('분석 결과:', result);
            displayAnalysisResult(result.analysis);
            
            // 심화 분석 버튼 활성화
            if (advancedBtn) {
                advancedBtn.disabled = false;
                advancedBtn.style.opacity = '1';
                console.log('심화 분석 버튼이 활성화되었습니다.');
            }
        } else {
            const error = await response.json();
            throw new Error(error.detail || '분석 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('분석 실패:', error);
        alert(`분석 실패: ${error.message}`);
        if (analysisResult) {
            analysisResult.innerHTML = '분석 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
    } finally {
        showLoading(false);
    }
}

// 분석 결과 표시
function displayAnalysisResult(analysisText) {
    console.log('분석 결과 표시:', analysisText.substring(0, 100) + '...');
    
    if (!analysisResult) {
        console.error('분석 결과 표시 영역을 찾을 수 없습니다.');
        return;
    }
    
    // 텍스트를 HTML로 변환 (마크다운 스타일 변환)
    let formattedText = analysisText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **텍스트** -> <strong>텍스트</strong>
        .replace(/\n/g, '<br>')  // 줄바꿈 변환
        .replace(/(\d+\.)/g, '<br><strong>$1</strong>')  // 숫자. -> 강조
        .replace(/- (.*?):/g, '<br>&nbsp;&nbsp;• <strong>$1:</strong>');  // - 텍스트: -> 리스트
    
    analysisResult.innerHTML = formattedText;
}

// 로딩 상태 표시/숨김
function showLoading(show) {
    if (!loadingOverlay) {
        console.error('로딩 오버레이를 찾을 수 없습니다.');
        return;
    }
    
    if (show) {
        loadingOverlay.style.display = 'flex';
        if (analyzeBtn) analyzeBtn.disabled = true;
    } else {
        loadingOverlay.style.display = 'none';
        if (analyzeBtn) analyzeBtn.disabled = false;
    }
}

// 심화 분석 페이지로 이동
function goToAdvancedAnalysis() {
    console.log('심화 분석 페이지로 이동 시도');
    
    if (!currentWord) {
        alert('먼저 기본 분석을 진행해주세요.');
        return;
    }
    
    // 현재 단어를 로컬 스토리지에 저장
    localStorage.setItem('current_word', currentWord);
    console.log('현재 단어 저장됨:', currentWord);
    
    console.log('심화 분석 페이지로 이동합니다.');
    window.location.href = '/advanced';
}

// 히스토리 페이지로 이동
function goToHistory() {
    console.log('히스토리 페이지로 이동합니다.');
    window.location.href = '/history';
}

// 로그아웃
async function logout() {
    console.log('로그아웃 시도');
    
    if (!confirm('로그아웃 하시겠습니까?')) {
        return;
    }
    
    try {
        await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentSessionId)
        });
        console.log('로그아웃 API 호출 완료');
    } catch (error) {
        console.error('로그아웃 요청 실패:', error);
    } finally {
        // 로컬 스토리지 정리
        localStorage.removeItem('session_id');
        localStorage.removeItem('current_word');
        console.log('로컬 스토리지 정리 완료');
        
        // 로그인 페이지로 이동
        console.log('로그인 페이지로 이동합니다.');
        window.location.href = '/';
    }
}

// 유틸리티 함수들
function clearInput() {
    if (wordInput) {
        wordInput.value = '';
    }
}

function focusInput() {
    if (wordInput) {
        wordInput.focus();
    }
}

// 에러 처리
window.addEventListener('error', function(event) {
    console.error('JavaScript 오류:', event.error);
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    console.log('페이지를 떠납니다.');
});