// DOM 요소들
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const messageArea = document.getElementById('messageArea');
const loadingOverlay = document.getElementById('loadingOverlay');

// 입력 필드들 - 회원가입
const regUsername = document.getElementById('regUsername');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');

// 입력 필드들 - 로그인
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('인증 페이지가 로드되었습니다.');
    
    // 이미 로그인된 사용자인지 확인
    checkExistingSession();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 첫 번째 입력 필드에 포커스
    regUsername.focus();
});

// 기존 세션 확인
function checkExistingSession() {
    const sessionId = localStorage.getItem('session_id');
    if (sessionId) {
        console.log('기존 세션 발견:', sessionId);
        // 세션이 유효한지 서버에 확인
        verifySession(sessionId);
    }
}

// 세션 검증
async function verifySession(sessionId) {
    try {
        const response = await fetch(`/api/user-info?session_id=${sessionId}`);
        if (response.ok) {
            console.log('유효한 세션 확인됨. 기본분석 화면으로 이동합니다.');
            // 유효한 세션이면 기본분석 화면으로 이동
            window.location.href = '/chat';
        } else {
            console.log('세션이 유효하지 않음. localStorage에서 제거합니다.');
            // 유효하지 않은 세션이면 localStorage에서 제거
            localStorage.removeItem('session_id');
        }
    } catch (error) {
        console.error('세션 검증 실패:', error);
        // 에러 시에도 localStorage에서 제거
        localStorage.removeItem('session_id');
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 회원가입 폼 제출
    registerForm.addEventListener('submit', handleRegister);
    
    // 로그인 폼 제출
    loginForm.addEventListener('submit', handleLogin);
    
    // Enter 키 이벤트 처리
    document.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            // 현재 포커스된 필드에 따라 적절한 폼 제출
            const activeElement = document.activeElement;
            
            if ([regUsername, regEmail, regPassword].includes(activeElement)) {
                event.preventDefault();
                handleRegister(event);
            } else if ([loginUsername, loginPassword].includes(activeElement)) {
                event.preventDefault();
                handleLogin(event);
            }
        }
    });
}

// 회원가입 처리
async function handleRegister(event) {
    event.preventDefault();
    
    const username = regUsername.value.trim();
    const email = regEmail.value.trim();
    const password = regPassword.value.trim();
    
    console.log('회원가입 시도:', { username, email });
    
    // 입력 검증
    if (!validateRegisterInput(username, email, password)) {
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password,
                name: username, // ID를 이름으로 사용
                email: email
            })
        });
        
        const result = await response.json();
        console.log('회원가입 응답:', result);
        
        if (response.ok) {
            showMessage('회원가입이 완료되었습니다! 로그인해주세요.', 'success');
            
            // 회원가입 폼 초기화
            registerForm.reset();
            
            // 로그인 폼에 ID 자동 입력
            loginUsername.value = username;
            loginPassword.focus();
            
        } else {
            showMessage(result.detail || '회원가입 중 오류가 발생했습니다.', 'error');
        }
    } catch (error) {
        console.error('회원가입 오류:', error);
        showMessage('네트워크 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
        showLoading(false);
    }
}

// 로그인 처리
async function handleLogin(event) {
    event.preventDefault();
    
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    
    console.log('로그인 시도:', { username });
    
    // 입력 검증
    if (!validateLoginInput(username, password)) {
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const result = await response.json();
        console.log('로그인 응답:', result);
        
        if (response.ok) {
            // 세션 ID 저장
            localStorage.setItem('session_id', result.session_id);
            console.log('세션 ID 저장됨:', result.session_id);
            
            showMessage('로그인 성공! 영단어 분석기로 이동합니다.', 'success');
            
            // 즉시 기본분석 화면으로 이동 (setTimeout 제거)
            console.log('기본분석 화면으로 이동 중...');
            window.location.href = '/chat';
            
        } else {
            showMessage(result.detail || '로그인에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        showMessage('네트워크 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
        showLoading(false);
    }
}

// 회원가입 입력 검증
function validateRegisterInput(username, email, password) {
    if (!username) {
        showMessage('ID를 입력해주세요.', 'error');
        regUsername.focus();
        return false;
    }
    
    if (username.length < 3) {
        showMessage('ID는 3자 이상 입력해주세요.', 'error');
        regUsername.focus();
        return false;
    }
    
    if (!email) {
        showMessage('이메일을 입력해주세요.', 'error');
        regEmail.focus();
        return false;
    }
    
    // 간단한 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('올바른 이메일 형식을 입력해주세요.', 'error');
        regEmail.focus();
        return false;
    }
    
    if (!password) {
        showMessage('비밀번호를 입력해주세요.', 'error');
        regPassword.focus();
        return false;
    }
    
    if (password.length < 4) {
        showMessage('비밀번호는 4자 이상 입력해주세요.', 'error');
        regPassword.focus();
        return false;
    }
    
    return true;
}

// 로그인 입력 검증
function validateLoginInput(username, password) {
    if (!username) {
        showMessage('ID를 입력해주세요.', 'error');
        loginUsername.focus();
        return false;
    }
    
    if (!password) {
        showMessage('비밀번호를 입력해주세요.', 'error');
        loginPassword.focus();
        return false;
    }
    
    return true;
}

// 메시지 표시
function showMessage(message, type = 'info') {
    messageArea.innerHTML = `<div class="message ${type}">${message}</div>`;
    
    // 3초 후 메시지 자동 제거
    setTimeout(() => {
        messageArea.innerHTML = '';
    }, 3000);
}

// 로딩 상태 표시/숨김
function showLoading(show) {
    if (show) {
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
}

// 폼 초기화 함수
function clearForms() {
    registerForm.reset();
    loginForm.reset();
    messageArea.innerHTML = '';
}

// 에러 처리
window.addEventListener('error', function(event) {
    console.error('JavaScript 오류:', event.error);
    showMessage('예상치 못한 오류가 발생했습니다.', 'error');
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    // 필요시 정리 작업
});