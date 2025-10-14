let elementVisibility = new WeakMap();
const components = {
    scrollButton: null,
    topBarQuestion: null,
    topBarTextSpan: null,
    countDisplay: null
}
const observers = {
    resize: null,
    intersection: null,
    mutation: null,
}
const chatState = {
    queries: [],
    responses: [],
    currentVisibleResponseIndex: -1,
    isCurrentQueryVisible: false
};

let isInitialized = false;
let isScrollingViaButton = false;
const topBarHeight = 70; // 48 + margin 22

function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

function initializeChatState() {
    chatState.queries?.forEach(query => observers.intersection?.unobserve(query));
    chatState.responses?.forEach(response => observers.intersection?.unobserve(response));

    chatState.queries = [];
    chatState.responses = [];
    chatState.currentVisibleResponseIndex = -1;
    chatState.isCurrentQueryVisible = false;
    elementVisibility = new WeakMap();
}

function reloadChatState() {
    initializeChatState();

    chatState.queries = Array.from(document.querySelectorAll('user-query'));
    chatState.responses = Array.from(document.querySelectorAll('model-response'));
    chatState.queries.forEach(query => observers.intersection.observe(query));
    chatState.responses.forEach(response => observers.intersection.observe(response));
}

function processConversationNode(node) {
    if (node.nodeType !== 1 || !node.matches('.conversation-container')) return;

    const query = node.querySelector('user-query');
    const response = node.querySelector('model-response');
    if (query && response) {
        if (!chatState.queries.includes(query)) {
            chatState.queries.push(query);
            chatState.responses.push(response);
            observers.intersection.observe(query);
            observers.intersection.observe(response);
        }
    }
}

function disconnectObservers() {
    observers.resize?.disconnect();
    observers.resize = null;

    observers.intersection?.disconnect();
    observers.intersection = null;

    observers.mutation?.disconnect();
    observers.mutation = null;
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
    const targetContainer = document.querySelector('.input-area-container');
    if (!targetContainer) return;
    targetContainer.style.position = 'relative';

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'scroll-button-container';
    buttonContainer.className = 'scroll-button-container';

    const upButton = createScrollButton('arrow_upward', 'scroll to the previous question', () => {
        const actualFirstQuery = document.querySelector('.conversation-container user-query');
        if (!actualFirstQuery) return;
        if (actualFirstQuery && actualFirstQuery !== chatState.queries?.at(0)) {
            reloadChatState();
        }

        const targetIndex = chatState.currentVisibleResponseIndex - (chatState.isCurrentQueryVisible ? 1 : 0);
        if (targetIndex >= 0) {
            chatState.queries[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            return;
        }
        setTopBarVisibility(false);
        setTimeout(() => {
            updateTopBar();
        }, 1100);
    });

    const downButton = createScrollButton('arrow_downward', 'scroll to the next question', () => {
        const actualFirstQuery = document.querySelector('.conversation-container user-query');
        if (!actualFirstQuery) return;
        if (actualFirstQuery && actualFirstQuery !== chatState.queries?.at(0)) {
            reloadChatState();
        }

        const targetIndex = chatState.currentVisibleResponseIndex + 1;
        if (targetIndex < chatState.queries.length) {
            chatState.queries[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        else {
            chatState.responses.at(-1).scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        setTopBarVisibility(false);
        setTimeout(() => {
            updateTopBar();
        }, 1100);
    });

    buttonContainer.appendChild(upButton);
    buttonContainer.appendChild(downButton);
    targetContainer.appendChild(buttonContainer);
    components.scrollButton = buttonContainer;

    if (!components.countDisplay) {
        const countDisplay = document.createElement('div');
        countDisplay.id = 'count-display';

        targetContainer.appendChild(countDisplay);
        components.countDisplay = countDisplay;
    }

    const refreshButton = createScrollButton('refresh', 'refresh', () => {
        updateTopBar();
    });
    buttonContainer.prepend(refreshButton);
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

function setTopBarVisibility(isVisible) {
    if (isVisible) {
        components.topBarQuestion?.classList.add('visible');
    } else {
        components.topBarQuestion?.classList.remove('visible');
    }
}

function updateTopBar() {
    if (!components.topBarQuestion) return;

    let topMostVisibleResponseIndex = -1;
    for (let i = 0; i < chatState.responses.length; i++) {
        const rect = chatState.responses[i].getBoundingClientRect();
        if (rect.bottom > topBarHeight) {
            topMostVisibleResponseIndex = i;
            break;
        }
    }

    if (topMostVisibleResponseIndex === -1 && chatState.responses.length > 0) {
        topMostVisibleResponseIndex = chatState.responses.length - 1;
    }

    chatState.currentVisibleResponseIndex = topMostVisibleResponseIndex;
    if (topMostVisibleResponseIndex === -1) {
        setTopBarVisibility(false);
        return;
    }

    const currentQuestion = chatState.queries[topMostVisibleResponseIndex];
    const isQuestionVisible = elementVisibility.get(currentQuestion);
    chatState.isCurrentQueryVisible = isQuestionVisible;
    if (!isQuestionVisible) {
        const originalText = currentQuestion.querySelector('.query-text')?.innerText || '';
        const textToShow = originalText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        if (components.topBarTextSpan) {
            components.topBarTextSpan.innerText = textToShow;
            components.topBarQuestion.title = textToShow;
        }
    }
    setTopBarVisibility(!isQuestionVisible);
    if (components.countDisplay) {
        components.countDisplay.innerText = `${topMostVisibleResponseIndex + 1} / ${chatState.responses.length}`;
    }
}

const throttledUpdateTopBar = throttle(updateTopBar, 100);

function initializeFeatures() {
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
        throttledUpdateTopBar();
    }, { root: document.querySelector('main'), threshold: 0 });

    observers.mutation = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    processConversationNode(node);
                }
            }
        });
    });
    if (chatHistory) {
        const conversationList = chatHistory.querySelector('infinite-scroller')
        Array.from(conversationList.children).forEach(node => processConversationNode(node));
        observers.mutation.observe(conversationList, { childList: true });
    }
}


function hasMandatoryElements(selectors) {
    return selectors.every(selector => document.querySelector(selector));
}

async function launchExtension() {
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
    if (isInitialized) {
        components.topBarQuestion?.remove();
        components.scrollButton?.remove();
        components.topBarQuestion = null;
        components.scrollButton = null;

        disconnectObservers();

        chatState.queries = [];
        chatState.responses = [];
        chatState.currentVisibleResponseIndex = -1;
        chatState.isCurrentQueryVisible = false;

        isInitialized = false;
    }
}

async function initializeExtension() {
    chrome.storage.sync.get('extensionEnabled', (data) => {
        if (data.extensionEnabled !== false) {
            disableExtension();
            launchExtension();
        }
    });
}

async function main() {
    initializeExtension();

    window.addEventListener('popstate', initializeExtension); // 브라우저 뒤로가기/앞으로가기 버튼
    window.navigation.addEventListener("navigate", (event) => {
        initializeExtension();
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.extensionEnabled) {
            if (changes.extensionEnabled.newValue === true) {
                launchExtension();
            } else {
                disableExtension();
            }
        }
    });
}

main();