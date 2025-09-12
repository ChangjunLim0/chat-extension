function createAndPlaceScrollButton() {
    if (document.getElementById('scroll-to-question-btn')) return;

    const targetContainer = document.querySelector('.input-area-container');
    if (!targetContainer) return;

    targetContainer.style.position = 'relative';

    const button = document.createElement('button');
    button.id = 'scroll-to-question-btn';
    button.className = 'scroll-to-question-outer-btn'; // CSS 클래스 이름 복원
    button.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
    button.title = '현재 보이는 답변의 질문으로 스크롤';

    button.onclick = () => {
        // 클릭하는 순간, 화면에 보이는 모든 답변을 찾습니다.
        const allResponses = Array.from(document.querySelectorAll('model-response'));
        const visibleResponses = allResponses.filter(resp => {
            const rect = resp.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom >= 0;
        });

        if (visibleResponses.length > 0) {
            // 보이는 답변 중 가장 위에 있는 것을 찾습니다.
            visibleResponses.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            const topMostVisibleAnswer = visibleResponses[0];

            // 해당 답변의 질문으로 스크롤합니다.
            const allQueries = document.querySelectorAll('user-query');
            const index = allResponses.indexOf(topMostVisibleAnswer);

            if (index > -1 && allQueries[index]) {
                allQueries[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    targetContainer.appendChild(button);
}

// 각 질문과 답변의 화면 노출 상태를 저장할 Map
const elementVisibility = new Map();

/**
 * 상단 바 질문 표시 영역의 너비를 실제 대화창 너비와 동기화합니다.
 */
function syncTopBarWidth() {
    const display = document.getElementById('top-bar-question-display');
    const responseContainer = document.querySelector('.response-container-content');

    if (display && responseContainer) {
        const rect = responseContainer.getBoundingClientRect();
        display.style.width = `${rect.width}px`;
        display.style.left = `${rect.left}px`;
    }
}

/**
 * 상단 바에 질문을 표시할 전용 요소를 생성하고 추가합니다.
 * @returns {HTMLElement} 생성된 표시판 요소
 */
function createTopBarDisplay() {
    let display = document.getElementById('top-bar-question-display');
    if (display) return display;

    const topBar = document.querySelector('.desktop-ogb-buffer');
    if (!topBar) return null;

    display = document.createElement('div');
    display.id = 'top-bar-question-display';
    topBar.prepend(display);
    syncTopBarWidth();
    return display;
}

/**
 * 현재 상태에 맞게 상단 바의 내용을 업데이트하고 표시/숨김을 결정합니다.
 */
function updateTopBarVisibility() {
    const display = createTopBarDisplay();
    if (!display) return;

    const conversationContainers = document.querySelectorAll('.conversation-container');
    let textToShow = null;

    // 대화 목록을 역순(최신순)으로 순회하여 조건에 맞는 첫 번째 질문을 찾습니다.
    for (let i = conversationContainers.length - 1; i >= 0; i--) {
        const container = conversationContainers[i];
        const question = container.querySelector('user-query');
        const answer = container.querySelector('model-response');

        if (question && answer) {
            const isQuestionVisible = elementVisibility.get(question);
            const isAnswerVisible = elementVisibility.get(answer);

            // 조건: 질문은 보이지 않고(false), 답변은 보일 때(true)
            if (isQuestionVisible === false && isAnswerVisible === true) {
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

/**
 * 모든 질문과 답변을 감시하는 IntersectionObserver를 설정합니다.
 */
function initializeObservers() {
    const elementsToObserve = document.querySelectorAll('.conversation-container user-query, .conversation-container model-response');
    if (elementsToObserve.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        // Observer가 감지한 모든 요소의 노출 상태를 Map에 업데이트합니다.
        entries.forEach(entry => {
            elementVisibility.set(entry.target, entry.isIntersecting);
        });
        // 상태가 업데이트될 때마다 상단 바 표시 여부를 다시 계산합니다.
        updateTopBarVisibility();
    }, {
        root: document.querySelector('main'),
        threshold: 0
    });

    elementsToObserve.forEach(el => observer.observe(el));
}


// --- 메인 실행 로직 ---
const mutationObserver = new MutationObserver(() => {
    createAndPlaceScrollButton();
});

const chatHistoryObserver = new MutationObserver(() => {
    initializeObservers();
    syncTopBarWidth();
});

const mainContent = document.querySelector('main');
if (mainContent) {
    mutationObserver.observe(mainContent, { childList: true, subtree: true });
}

const chatHistory = document.getElementById('chat-history');
if (chatHistory) {
    chatHistoryObserver.observe(chatHistory, { childList: true, subtree: true });
}

window.addEventListener('resize', syncTopBarWidth);

setTimeout(() => {
    createAndPlaceScrollButton();
    initializeObservers();
    syncTopBarWidth();
}, 1000);