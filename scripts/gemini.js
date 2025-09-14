let mainMutationObserver = null;
let mainResizeObserver = null;


const elementVisibility = new Map();
const components = {
    scrollButton: null,
    topBarQuestion: null,
    topBarTextSpan: null
}
const observers = {
    resize: null,
    intersection: null,
    mutation: null
}
let cachedQueries = [];
let cachedResponses = [];
let isInitialized = false;
let isScrollingViaButton = false;

function disconnectObservers() {
    if (observers.resize) observers.mutation.disconnect();
    if (observers.intersection) observers.mutation.disconnect();
    if (observers.mutation) observers.mutation.disconnect();
    observers.resize = null;
    observers.intersection = null;
    observers.mutation = null;
}


function createAndPlaceScrollButton() {
    if (components.scrollButton) return;
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
        const visibleResponses = cachedResponses.filter(resp => {
            const rect = resp.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom >= 0;
        });

        if (visibleResponses.length > 0) {
            visibleResponses.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            const topMostVisibleAnswer = visibleResponses[0];
            const index = cachedResponses.indexOf(topMostVisibleAnswer);

            if (index > -1 && cachedQueries[index]) {
                isScrollingViaButton = true;
                cachedQueries[index].scrollIntoView({ behavior: 'smooth', block: 'start' });

                setTimeout(() => {
                    isScrollingViaButton = false;
                    updateTopBarVisibility();
                }, 500);
            }
        }
    };
    targetContainer.appendChild(button);
    components.scrollButton = button;
}

function createTopBarDisplay() {
    if (components.topBarQuestion) return;
    const topBar = document.querySelector('.desktop-ogb-buffer');
    if (!topBar) return;
    const display = document.createElement('div');
    display.id = 'top-bar-question-display';
    const textSpan = document.createElement('span');
    textSpan.className = 'text-span';
    display.appendChild(textSpan);

    topBar.prepend(display);
    components.topBarQuestion = display;
    components.topBarTextSpan = textSpan;
}

function syncTopBarPosition() {
    const referenceElement = document.querySelector('.response-container-content');
    if (components.topBarQuestion && referenceElement) {
        const rect = referenceElement.getBoundingClientRect();
        components.topBarQuestion.style.width = `${rect.width}px`;
        components.topBarQuestion.style.left = `${rect.left}px`;
    }
}

function updateTopBarVisibility() {
    if (!components.topBarQuestion) return;
    if (isScrollingViaButton) {
        components.topBarQuestion.classList.remove('visible');
        return;
    }
    let textToShow = null;
    for (let i = cachedQueries.length - 1; i >= 0; i--) {
        const question = cachedQueries[i];
        const answer = cachedResponses[i];
        if (question && answer) {
            const isQuestionVisible = elementVisibility.get(question);
            const isAnswerVisible = elementVisibility.get(answer);

            // 조건 1: 질문은 보이지 않고, 답변은 보일 때
            if (isQuestionVisible === false && isAnswerVisible === true) {
                const answerRect = answer.getBoundingClientRect();

                // 답변의 보이는 아랫부분 높이가 50px 미만이면 건너뛰기
                const footerHeight = 32;
                const topBarHeight = 48;
                const bufferHeight = 20;
                const threshold = footerHeight + topBarHeight + bufferHeight;

                const isAnswerBarelyVisible = answerRect.bottom < threshold;
                if (isAnswerBarelyVisible) {
                    continue;
                }

                const originalText = question.querySelector('.query-text')?.innerText || '';
                textToShow = originalText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                break;
            }
        }
    }
    if (textToShow) {
        if (components.topBarTextSpan) {
            components.topBarTextSpan.innerText = textToShow;
        }
        components.topBarQuestion.classList.add('visible');
    } else {
        components.topBarQuestion.classList.remove('visible');
    }
}


function initializeFeatures() {
    cachedQueries = Array.from(document.querySelectorAll('user-query'));
    cachedResponses = Array.from(document.querySelectorAll('model-response'));

    createAndPlaceScrollButton();
    createTopBarDisplay();

    disconnectObservers();

    observers.resize = new ResizeObserver(syncTopBarPosition);
    const chatHistory = document.getElementById('chat-history');
    if (chatHistory) {
        observers.resize.observe(chatHistory);
    }

    observers.intersection = new IntersectionObserver((entries) => {
        entries.forEach(entry => elementVisibility.set(entry.target, entry.isIntersecting));
        updateTopBarVisibility();
    }, { root: document.querySelector('main'), threshold: 0 });

    [...cachedQueries, ...cachedResponses].forEach(el => observers.intersection.observe(el));

    observers.mutation = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.matches && node.matches('.conversation-container')) {
                    const query = node.querySelector('user-query');
                    const response = node.querySelector('model-response');
                    if (query) {
                        cachedQueries.push(query);
                        observers.intersection.observe(query)
                    }
                    if (response) {
                        cachedResponses.push(response);
                        observers.intersection.observe(response);
                    }
                }
            });
        });
    });
    observers.mutation.observe(document.querySelector('#chat-history'), { childList: true });
}


function hasMandatoryElements(selectors) {
    return selectors.every(selector => document.querySelector(selector));
}

async function startExtension() {
    if (isInitialized) return;

    const CHAT_CONTAINER_SELECTOR = ['.desktop-ogb-buffer', '#chat-history user-query', '.input-area-container'];
    if (hasMandatoryElements(CHAT_CONTAINER_SELECTOR)) {
        initializeFeatures();
    } else {
        const observer = new MutationObserver((mutations, obs) => {
            if (hasMandatoryElements(CHAT_CONTAINER_SELECTOR)) {
                initializeFeatures();
                obs.disconnect();
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    isInitialized = true;
}

function disableExtension() {
    components.topBarQuestion?.remove();
    components.scrollButton?.remove();
    components.topBarQuestion = null;
    components.scrollButton = null;

    disconnectObservers();

    isInitialized = false;
}

function handleNavigation() {
    chrome.storage.sync.get('extensionEnabled', (data) => {
        if (data.extensionEnabled !== false) {
            disableExtension();
            startExtension();
        }
    });
}

async function main() {

    window.addEventListener('popstate', handleNavigation); // 브라우저 뒤로가기/앞으로가기 버튼
    //window.addEventListener('pushstate', handleNavigation); // Gemini 내부 링크 클릭

    window.navigation.addEventListener("navigate", (event) => {
        handleNavigation();
    });

    chrome.storage.sync.get('extensionEnabled', (data) => {
        if (data.extensionEnabled !== false) {
            startExtension();
        }
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.extensionEnabled) {
            if (changes.extensionEnabled.newValue === true) {
                startExtension();
            } else {
                disableExtension();
            }
        }
    });

    const data = await chrome.storage.sync.get('extensionEnabled');
    if (data.extensionEnabled === false) return;
}

main();