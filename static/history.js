// 전역 변수
let currentSessionId = null;
let historyData = [];

// DOM 요소들
const usernameElement = document.getElementById('username');
const historyContent = document.getElementById('historyContent');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const chatBtn = document.getElementById('chatBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('히스토리 페이지가 로드되었습니다.');
    initializePage();
    setupEventListeners();
});

// 페이지 초기화
async function initializePage() {
    currentSessionId = localStorage.getItem('session_id');
    console.log('저장된 세션 ID:', currentSessionId);
    
    if (!currentSessionId) {
        alert('로그인이 필요합니다.');
        window.location.href = '/';
        return;
    }

    await loadUserInfo();
    await loadHistoryData();
}

// 사용자 정보 로드
async function loadUserInfo() {
    try {
        const response = await fetch(`/api/user-info?session_id=${currentSessionId}`);
        
        if (response.ok) {
            const userData = await response.json();
            console.log('사용자 정보:', userData);
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
    
    // PDF 내보내기 버튼 클릭
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', function(e) {
            console.log('PDF 내보내기 버튼 클릭됨');
            e.preventDefault();
            exportToPrintablePage();
        });
    }
    
    // 기본분석 버튼 클릭
    if (chatBtn) {
        chatBtn.addEventListener('click', function(e) {
            console.log('기본분석 버튼 클릭됨');
            e.preventDefault();
            goToChat();
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
}

// 히스토리 데이터 로드
async function loadHistoryData() {
    console.log('히스토리 데이터를 로드합니다.');
    showLoading(true);
    
    try {
        const response = await fetch(`/api/chat-history?session_id=${currentSessionId}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('히스토리 데이터:', result);
            historyData = result.history;
            displayHistory(historyData);
        } else {
            const error = await response.json();
            throw new Error(error.detail || '히스토리를 불러올 수 없습니다.');
        }
    } catch (error) {
        console.error('히스토리 로드 실패:', error);
        if (historyContent) {
            historyContent.innerHTML = '<div class="error-message">히스토리를 불러오는 중 오류가 발생했습니다.</div>';
        }
    } finally {
        showLoading(false);
    }
}

// 히스토리 표시
function displayHistory(history) {
    console.log('히스토리를 표시합니다. 항목 수:', history ? history.length : 0);
    
    if (!historyContent) {
        console.error('히스토리 내용 표시 영역을 찾을 수 없습니다.');
        return;
    }
    
    if (!history || history.length === 0) {
        historyContent.innerHTML = '<div class="no-history">아직 분석한 단어가 없습니다.</div>';
        if (exportPdfBtn) {
            exportPdfBtn.disabled = true;
            exportPdfBtn.style.opacity = '0.5';
        }
        return;
    }
    
    let historyHtml = '';
    
    history.forEach((record, index) => {
        historyHtml += `
            <div class="history-item" data-index="${index}">
                <div class="history-header">
                    <h3 class="word-title">${record.word}</h3>
                    <span class="timestamp">${record.timestamp}</span>
                </div>
                
                ${record.basic_analysis ? `
                    <div class="analysis-section">
                        <h4>기본 분석</h4>
                        <div class="analysis-content">${formatAnalysisText(record.basic_analysis)}</div>
                    </div>
                ` : ''}
                
                ${record.advanced_analysis ? `
                    <div class="analysis-section">
                        <h4>심화 분석</h4>
                        <div class="analysis-content">${formatAnalysisText(record.advanced_analysis)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    historyContent.innerHTML = historyHtml;
    
    // PDF 내보내기 버튼 활성화
    if (exportPdfBtn) {
        exportPdfBtn.disabled = false;
        exportPdfBtn.style.opacity = '1';
    }
}

// 분석 텍스트 포맷팅
function formatAnalysisText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/(\d+\.)/g, '<br><strong>$1</strong>')
        .replace(/- (.*?):/g, '<br>&nbsp;&nbsp;• <strong>$1:</strong>');
}

// 인쇄 가능한 페이지로 내보내기
function exportToPrintablePage() {
    console.log('인쇄 가능한 페이지 생성 시작');
    
    if (!historyData || historyData.length === 0) {
        alert('내보낼 히스토리가 없습니다.');
        return;
    }
    
    try {
        // 새 창 열기
        const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        
        if (!printWindow) {
            alert('팝업이 차단되었습니다. 팝업을 허용하고 다시 시도해주세요.');
            return;
        }
        
        // 인쇄용 HTML 생성
        const printHTML = generatePrintHTML();
        
        // HTML 작성
        printWindow.document.write(printHTML);
        printWindow.document.close();
        
        // 페이지 로드 완료 후 인쇄 대화상자 표시
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                
                // 인쇄 완료 후 창 닫기 (선택사항)
                printWindow.onafterprint = function() {
                    if (confirm('인쇄가 완료되었습니다. 창을 닫으시겠습니까?')) {
                        printWindow.close();
                    }
                };
            }, 1000);
        };
        
        console.log('인쇄 페이지 생성 완료');
        
    } catch (error) {
        console.error('PDF 생성 실패:', error);
        alert('인쇄 페이지 생성 중 오류가 발생했습니다: ' + error.message);
    }
}

// 헤더 완전 제거된 인쇄용 HTML 생성
function generatePrintHTML() {
    const username = usernameElement ? usernameElement.textContent : '사용자';
    
    let contentHTML = '';
    
    historyData.forEach((record, index) => {
        contentHTML += `
            <div class="word-item">
                <div class="word-header">
                    <h2>${index + 1}. ${record.word}</h2>
                    <span class="date">분석일: ${record.timestamp}</span>
                </div>
                
                ${record.basic_analysis ? `
                    <div class="analysis-section">
                        <h3>🔹 기본 분석</h3>
                        <div class="content">${formatAnalysisForPrint(record.basic_analysis)}</div>
                    </div>
                ` : ''}
                
                ${record.advanced_analysis ? `
                    <div class="analysis-section">
                        <h3>🔸 심화 분석</h3>
                        <div class="content">${formatAnalysisForPrint(record.advanced_analysis)}</div>
                    </div>
                ` : ''}
                
                ${index < historyData.length - 1 ? '<div class="divider"></div>' : ''}
            </div>
        `;
    });
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>영단어 분석 히스토리 - ${username}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Noto Sans KR', Arial, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            color: #333;
            background: white;
            padding: 10px;
        }
        
        .word-item {
            margin-bottom: 20px;
        }
        
        .word-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e1e5e9;
        }
        
        .word-header h2 {
            font-size: 16px;
            color: #2c3e50;
            margin: 0;
        }
        
        .date {
            font-size: 11px;
            color: #666;
        }
        
        .analysis-section {
            margin-bottom: 15px;
        }
        
        .analysis-section h3 {
            font-size: 13px;
            color: #3498db;
            margin-bottom: 8px;
            padding: 3px 0;
            border-left: 3px solid #3498db;
            padding-left: 8px;
        }
        
        .content {
            background: #fafbfc;
            padding: 10px;
            border-radius: 4px;
            border-left: 2px solid #ecf0f1;
            font-size: 12px;
            line-height: 1.5;
        }
        
        .content strong {
            color: #2c3e50;
            font-weight: 600;
        }
        
        .divider {
            border-top: 2px dashed #ccc;
            margin: 20px 0;
        }
        
        @media print {
            body { 
                padding: 8px;
                font-size: 12px;
            }
            
            .content {
                font-size: 11px;
                padding: 8px;
            }
            
            .word-header h2 {
                font-size: 14px;
            }
            
            .analysis-section h3 {
                font-size: 12px;
            }
            
            .date {
                font-size: 10px;
            }
        }
    </style>
</head>
<body>
    ${contentHTML}
</body>
</html>`;
}

// 인쇄용 텍스트 포맷팅
function formatAnalysisForPrint(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/🟢/g, '●')
        .replace(/(\d+\.)/g, '<br><strong>$1</strong>')
        .replace(/- (.*?):/g, '<br>&nbsp;&nbsp;• <strong>$1:</strong>');
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

// 기본분석 페이지로 이동
function goToChat() {
    console.log('기본분석 페이지로 이동합니다.');
    window.location.href = '/chat';
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