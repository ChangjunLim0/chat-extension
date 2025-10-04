const elementVisibility = new Map();
const components = {
    scrollButton: null,
    topBarQuestion: null,
    topBarTextSpan: null
};
const observers = {
    resize: null,
    intersection: null,
    mutation: null
};
let cachedQueries = [];
let cachedResponses = [];
let isInitialized = false;
let isScrollingViaButton = false;
const topBarHeight = 48;

const chatState = {
    queries: [],
    responses: [],
    currentVisibleResponseIndex: -1,
    isCurrentQueryVisible: false
};

function disconnectObservers() {
    if (observers.resize) observers.resize.disconnect();
    if (observers.intersection) observers.intersection.disconnect();
    if (observers.mutation) observers.mutation.disconnect();
    observers.resize = null;
    observers.intersection = null;
    observers.mutation = null;
}

function initializeChatState() {
    chatState.queries?.forEach(query => observers.intersection?.unobserve(query));
    chatState.responses?.forEach(response => observers.intersection?.unobserve(response));

    chatState.queries = [];
    chatState.responses = [];
    chatState.currentVisibleResponseIndex = -1;
    chatState.isCurrentQueryVisible = false;
    elementVisibility.clear();
}

function reloadChatState() {
    initializeChatState()

    chatState.queries = Array.from(document.querySelectorAll('article[data-turn="user"]'));
    chatState.responses = Array.from(document.querySelectorAll('article[data-turn="assistant"]'));
    chatState.queries.forEach(query => observers.intersection.observe(query));
    chatState.responses.forEach(response => observers.intersection.observe(response));
}

function createScrollButton(iconName, titleText, onClickHandler) {
    const button = document.createElement('button');
    button.className = 'chat-scroll-btn';
    button.innerHTML = `<span class="material-symbols-outlined">${iconName}</span>`;
    button.title = titleText;
    button.draggable = false;
    button.onclick = onClickHandler;
    return button;
}

function createAndPlaceScrollButton() {
    if (components.scrollButton) return;
    const targetContainer = document.querySelector('#thread-bottom');
    if (!targetContainer) return;
    targetContainer.style.position = 'relative';

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'scroll-button-container';
    buttonContainer.className = 'scroll-button-container';

    const upButton = createScrollButton('arrow_upward', 'scroll to the previous question', () => {
        const actualFirstQuery = document.querySelector('article[data-turn="user"]');
        if (!actualFirstQuery) return;
        if (actualFirstQuery && actualFirstQuery !== chatState.queries?.at(0)) {
            reloadChatState();
        }

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
            }
            setTimeout(() => {
                isScrollingViaButton = false;
                updateTopBarVisibility();
            }, 500);
        }
    });

    const downButton = createScrollButton('arrow_downward', 'scroll to the next question', () => {
        const actualFirstQuery = document.querySelector('article[data-turn="user"]');
        if (!actualFirstQuery) return;
        if (actualFirstQuery && actualFirstQuery !== chatState.queries?.at(0)) {
            reloadChatState();
        }

        const currentAnswer = [...cachedResponses].find(q => q.getBoundingClientRect().bottom > topBarHeight);
        const currentIndex = currentAnswer ? cachedResponses.indexOf(currentAnswer) : -1;
        const nextIndex = currentIndex + 1;
        if (nextIndex < cachedQueries.length) {
            isScrollingViaButton = true;
            cachedQueries[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => {
                isScrollingViaButton = false;
                updateTopBarVisibility();
            }, 500);
        } else {
            cachedResponses.at(-1).scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    });

    buttonContainer.appendChild(upButton);
    buttonContainer.appendChild(downButton);
    targetContainer.appendChild(buttonContainer);
    components.scrollButton = buttonContainer;
}

function createTopBarDisplay() {
    if (components.topBarQuestion) return;
    const topBar = document.querySelector('header#page-header');
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
    const referenceElement = document.querySelector('article[data-turn="assistant"]');
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

            if (isQuestionVisible === false && isAnswerVisible === true) {
                const answerRect = answer.getBoundingClientRect();
                const footerHeight = 32;
                const threshold = footerHeight + topBarHeight;
                const isAnswerBarelyVisible = answerRect.bottom < threshold;
                if (isAnswerBarelyVisible) continue;

                const originalText = question.innerText || '';
                textToShow = originalText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                break;
            }
        }
    }
    if (textToShow) {
        if (components.topBarTextSpan) {
            components.topBarTextSpan.innerText = textToShow;
            components.title = textToShow;
        }
        components.topBarQuestion.classList.add('visible');
    } else {
        components.topBarQuestion.classList.remove('visible');
    }
}

function initializeFeatures() {
    cachedQueries = Array.from(document.querySelectorAll('article[data-turn="user"]'));
    cachedResponses = Array.from(document.querySelectorAll('article[data-turn="assistant"]'));

    createAndPlaceScrollButton();
    createTopBarDisplay();

    disconnectObservers();

    observers.resize = new ResizeObserver(syncTopBarPosition);
    const chatHistory = document.querySelector('main');
    if (chatHistory) {
        observers.resize.observe(chatHistory);
    }

    observers.intersection = new IntersectionObserver((entries) => {
        entries.forEach(entry => elementVisibility.set(entry.target, entry.isIntersecting));
        updateTopBarVisibility();
    }, { root: document.querySelector('main'), threshold: 0 });

    // 새로운 상태 시스템 사용
    reloadChatState();

    observers.mutation = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.matches && node.matches('article')) {
                        if (node.getAttribute('data-turn') === 'user') {
                            cachedQueries.push(node);
                            observers.intersection.observe(node);
                        }
                        if (node.getAttribute('data-turn') === 'assistant') {
                            cachedResponses.push(node);
                            observers.intersection.observe(node);
                        }
                    }
                }
            }
        });
    });
    const chatMain = document.querySelector('main');
    if (chatMain) {
        observers.mutation.observe(chatMain, { childList: true, subtree: true });
    }
}

function hasMandatoryElements(selectors) {
    return selectors.every(selector => document.querySelector(selector));
}

async function startExtension() {
    if (isInitialized) return;

    const CHAT_CONTAINER_SELECTOR = ['header#page-header', 'article[data-turn="user"]', '#thread-bottom'];
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
    window.addEventListener('popstate', handleNavigation);

    window.navigation?.addEventListener?.("navigate", (event) => {
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