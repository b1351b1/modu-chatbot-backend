// 전역 변수
let currentSessionId = null;
let currentWord = null;

// DOM 요소들
const usernameElement = document.getElementById('username');
const wordTitle = document.getElementById('wordTitle');
const advancedResult = document.getElementById('advancedResult');
const backBtn = document.getElementById('backBtn');
const historyBtn = document.getElementById('historyBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('심화분석 페이지가 로드되었습니다.');
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

    // 현재 분석할 단어 확인
    currentWord = localStorage.getItem('current_word');
    console.log('저장된 현재 단어:', currentWord);
    
    if (!currentWord) {
        alert('분석할 단어가 없습니다. 기본 분석부터 진행해주세요.');
        window.location.href = '/chat';
        return;
    }

    // 사용자 정보 로드
    await loadUserInfo();
    
    // 단어 표시
    if (wordTitle) {
        wordTitle.textContent = currentWord;
    }
    
    // 심화 분석 실행
    await performAdvancedAnalysis();
}

// 사용자 정보 로드
async function loadUserInfo() {
    try {
        const response = await fetch(`/api/user-info?session_id=${currentSessionId}`);
        
        if (response.ok) {
            const userData = await response.json();
            console.log('사용자 정보:', userData);
            // 사용자 ID를 표시 (예: "user123님")
            if (usernameElement) {
                usernameElement.textContent = `${userData.username}님`;
            }
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
    
    // 이전 단계 버튼 클릭
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            console.log('이전 단계 버튼 클릭됨');
            e.preventDefault();
            goBackToBasic();
        });
    } else {
        console.error('이전 단계 버튼을 찾을 수 없습니다.');
    }
    
    // 히스토리 버튼 클릭
    if (historyBtn) {
        historyBtn.addEventListener('click', function(e) {
            console.log('히스토리 버튼 클릭됨');
            e.preventDefault();
            goToHistory();
        });
    } else {
        console.error('히스토리 버튼을 찾을 수 없습니다.');
    }
    
    // 로그아웃 버튼 클릭
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            console.log('로그아웃 버튼 클릭됨');
            e.preventDefault();
            logout();
        });
    } else {
        console.error('로그아웃 버튼을 찾을 수 없습니다.');
    }
    
    console.log('모든 이벤트 리스너가 설정되었습니다.');
}

// 심화 분석 실행
async function performAdvancedAnalysis() {
    console.log('심화 분석을 시작합니다. 단어:', currentWord);
    showLoading(true);
    
    try {
        const response = await fetch('/api/analyze-advanced', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                word: currentWord,
                session_id: currentSessionId
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('심화 분석 결과:', result);
            displayAdvancedResult(result.analysis);
        } else {
            const error = await response.json();
            throw new Error(error.detail || '심화 분석 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('심화 분석 실패:', error);
        alert(`심화 분석 실패: ${error.message}`);
        if (advancedResult) {
            advancedResult.innerHTML = '심화 분석 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
    } finally {
        showLoading(false);
    }
}

// 심화 분석 결과 표시
function displayAdvancedResult(analysisText) {
    console.log('심화 분석 결과 표시:', analysisText.substring(0, 100) + '...');
    
    if (!advancedResult) {
        console.error('심화 분석 결과 표시 영역을 찾을 수 없습니다.');
        return;
    }
    
    // 텍스트를 HTML로 변환 (마크다운 스타일 변환)
    let formattedText = analysisText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **텍스트** -> <strong>텍스트</strong>
        .replace(/\n/g, '<br>')  // 줄바꿈 변환
        .replace(/(\d+\.)/g, '<br><strong>$1</strong>')  // 숫자. -> 강조
        .replace(/- (.*?):/g, '<br>&nbsp;&nbsp;• <strong>$1:</strong>');  // - 텍스트: -> 리스트
    
    advancedResult.innerHTML = formattedText;
}

// 로딩 상태 표시/숨김
function showLoading(show) {
    if (!loadingOverlay) {
        console.error('로딩 오버레이를 찾을 수 없습니다.');
        return;
    }
    
    if (show) {
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
}

// 기본 분석 페이지로 돌아가기
function goBackToBasic() {
    console.log('기본 분석 페이지로 돌아갑니다.');
    window.location.href = '/chat';
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

// 에러 처리
window.addEventListener('error', function(event) {
    console.error('JavaScript 오류:', event.error);
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    console.log('심화분석 페이지를 떠납니다.');
});