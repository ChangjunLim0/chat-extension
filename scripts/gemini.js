// --- 1. 전역 변수 및 상태 관리 ---

// 질문/답변의 화면 노출 상태를 저장
const elementVisibility = new Map();
// 초기화가 완료되었는지 확인
let isInitialized = false;
// DOM 조회 결과를 저장해둘 변수 (최적화)
let cachedQueries = [];
let cachedResponses = [];


// --- 2. 핵심 기능 함수들 ---

/**
 * [스크롤 버튼] 생성 및 배치
 */
function createAndPlaceScrollButton() {
    if (document.getElementById('scroll-to-question-btn')) return;
    const targetContainer = document.querySelector('.input-area-container');
    if (!targetContainer) return;
    targetContainer.style.position = 'relative';

    const button = document.createElement('button');
    button.id = 'scroll-to-question-btn';
    button.className = 'scroll-to-question-outer-btn';
    button.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
    button.title = '현재 보이는 답변의 질문으로 스크롤';
    button.draggable = false;

    button.onclick = () => {
        // 매번 DOM을 검색하는 대신, 저장해 둔(캐시된) 결과를 사용합니다.
        const visibleResponses = cachedResponses.filter(resp => {
            const rect = resp.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom >= 0;
        });

        if (visibleResponses.length > 0) {
            visibleResponses.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            const topMostVisibleAnswer = visibleResponses[0];
            const index = cachedResponses.indexOf(topMostVisibleAnswer);

            if (index > -1 && cachedQueries[index]) {
                cachedQueries[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };
    targetContainer.appendChild(button);
}

/**
 * [상단 바] 너비 및 위치 동기화
 */
function syncTopBarPosition() {
    const display = document.getElementById('top-bar-question-display');
    const referenceElement = document.querySelector('.response-container-content');
    if (display && referenceElement) {
        const rect = referenceElement.getBoundingClientRect();
        display.style.width = `${rect.width}px`;
        display.style.left = `${rect.left}px`;
    }
}

/**
 * [상단 바] 요소 생성
 */
function createTopBarDisplay() {
    if (document.getElementById('top-bar-question-display')) return;
    const topBar = document.querySelector('.desktop-ogb-buffer');
    if (!topBar) return;
    const display = document.createElement('div');
    display.id = 'top-bar-question-display';
    topBar.prepend(display);
}

/**
 * [상단 바] 내용 업데이트 (보이기/숨기기)
 */
function updateTopBarVisibility() {
    const display = document.getElementById('top-bar-question-display');
    if (!display) return;
    let textToShow = null;
    for (let i = cachedQueries.length - 1; i >= 0; i--) {
        const question = cachedQueries[i];
        const answer = cachedResponses[i];
        if (question && answer) {
            if (elementVisibility.get(question) === false && elementVisibility.get(answer) === true) {
                const originalText = question.querySelector('.query-text')?.innerText || '';
                textToShow = originalText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                break;
            }
        }
    }
    if (textToShow) {
        display.innerText = textToShow;
        display.classList.add('visible');
    } else {
        display.classList.remove('visible');
    }
}


// --- 3. 옵저버 및 이벤트 핸들러 ---

/**
 * 모든 업데이트를 실행하는 통합 함수
 */
function runUpdates() {
    // DOM 조회 최적화를 위해 결과를 캐싱
    cachedQueries = Array.from(document.querySelectorAll('user-query'));
    cachedResponses = Array.from(document.querySelectorAll('model-response'));

    // 기능 실행
    createAndPlaceScrollButton();
    createTopBarDisplay();
    syncTopBarPosition();

    // IntersectionObserver 설정
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => elementVisibility.set(entry.target, entry.isIntersecting));
        updateTopBarVisibility();
    }, { root: document.querySelector('main'), threshold: 0 });

    // 캐시된 결과를 사용해 감시 설정
    [...cachedQueries, ...cachedResponses].forEach(el => observer.observe(el));
}


// --- 4. 메인 실행 로직 ---

// 페이지가 준비될 때까지 250ms마다 확인하는 타이머
const readyCheckInterval = setInterval(() => {
    // 제미나이의 핵심 요소들이 모두 로드되었는지 확인
    const topBar = document.querySelector('.desktop-ogb-buffer');
    const chatHistory = document.getElementById('chat-history');
    const inputArea = document.querySelector('.input-area-container');

    if (topBar && chatHistory && inputArea && !isInitialized) {
        // 모든 준비가 완료되었으므로, 타이머를 멈추고 메인 로직을 실행
        clearInterval(readyCheckInterval);
        isInitialized = true;

        // 최초 실행
        runUpdates();

        // 창 크기 변경 시 너비/위치 재동기화
        window.addEventListener('resize', syncTopBarPosition);

        // 채팅 내용 변경 감지를 위한 단일 MutationObserver
        const mutationObserver = new MutationObserver(runUpdates);
        mutationObserver.observe(chatHistory, { childList: true, subtree: true });
    }
}, 250);