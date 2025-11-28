let elementVisibility = new Map();
let isPanelCollapsed = false;
const components = {
    scrollButton: null,
    topBarQuestion: null,
    sideQuestionDisplay: null,
    sideQuestionTextSpan: null,
    topBarTextSpan: null,
    countDisplay: null
};
const observers = {
    intersection: null,
    mutation: null
};
let cachedQueries = [];
let cachedResponses = [];
let isInitialized = false;
let isScrollingViaButton = false;
const topBarHeight = 48;

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

const chatState = {
    queries: [],
    responses: [],
    currentVisibleResponseIndex: -1,
    isCurrentQueryVisible: false
};

function disconnectObservers() {
    if (observers.intersection) observers.intersection.disconnect();
    if (observers.mutation) observers.mutation.disconnect();
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

        const targetIndex = chatState.currentVisibleResponseIndex - (chatState.isCurrentQueryVisible ? 1 : 0);
        if (targetIndex >= 0) {
            chatState.queries[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            return;
        }
        setSideDisplayVisibility(false);
        setTimeout(() => {
            updateSideDisplay();
        }, 1100);
    });

    const downButton = createScrollButton('arrow_downward', 'scroll to the next question', () => {
        const actualFirstQuery = document.querySelector('article[data-turn="user"]');
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
        setSideDisplayVisibility(false);
        setTimeout(() => {
            updateSideDisplay();
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
        updateSideDisplay();
    });
    buttonContainer.prepend(refreshButton);
}

function createSideDisplay() {
    let display = document.getElementById('side-question-display');
    if (display) return;

    display = document.createElement('div');
    display.id = 'side-question-display';
    const textSpan = document.createElement('span');
    textSpan.className = 'question-text';
    display.appendChild(textSpan);
    let footer = document.createElement('div')
    footer.className = 'side-panel-footer'
    const toggleButton = document.createElement('button');
    toggleButton.className = 'panel-toggle-btn';
    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'material-symbols-outlined';
    toggleIcon.innerText = 'expand_less';
    toggleButton.appendChild(toggleIcon);
    footer.appendChild(toggleButton);
    display.appendChild(footer);

    toggleButton.onclick = () => {
        isPanelCollapsed = !isPanelCollapsed;

        if (isPanelCollapsed) {
            display.classList.add('collapsed');
            toggleIcon.innerText = 'expand_more';
            toggleButton.title = "expand";
        } else {
            display.classList.remove('collapsed');
            toggleIcon.innerText = 'expand_less';
            toggleButton.title = "collapse";
        }
    };

    document.body.appendChild(display);
    components.sideQuestionDisplay = display;
    components.sideQuestionTextSpan = textSpan;
}

function setSideDisplayVisibility(isVisible) {
    if (isVisible) {
        components.sideQuestionDisplay?.classList.add('visible');
    } else {
        components.sideQuestionDisplay?.classList.remove('visible');
    }
}

function updateSideDisplay() {
    if (!components.sideQuestionDisplay) return;

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
        setSideDisplayVisibility(false);
        return;
    }

    const currentQuestion = chatState.queries[topMostVisibleResponseIndex];
    const isQuestionVisible = elementVisibility.get(currentQuestion);
    chatState.isCurrentQueryVisible = isQuestionVisible;
    if (!isQuestionVisible) {
        const originalText = currentQuestion?.innerText || '';
        let clippedText = originalText;
        if (clippedText.includes('\n')) {
            clippedText = clippedText.split('\n')[1];
        }
        const textToShow = clippedText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        components.sideQuestionTextSpan.innerText = textToShow;
    }
    setSideDisplayVisibility(!isQuestionVisible);
    if (components.countDisplay) {
        components.countDisplay.innerText = `${topMostVisibleResponseIndex + 1} / ${chatState.responses.length}`;
    }
}

const throttledUpdateSideDisplay = throttle(updateSideDisplay, 100);

function initializeFeatures() {
    cachedQueries = Array.from(document.querySelectorAll('article[data-turn="user"]'));
    cachedResponses = Array.from(document.querySelectorAll('article[data-turn="assistant"]'));

    createAndPlaceScrollButton();
    createSideDisplay();

    disconnectObservers();

    observers.intersection = new IntersectionObserver((entries) => {
        entries.forEach(entry => elementVisibility.set(entry.target, entry.isIntersecting));
        throttledUpdateSideDisplay();
    }, { root: document.querySelector('main'), threshold: 0 });

    reloadChatState();

    observers.mutation = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            for (const node of mutation.addedNodes) {
                if (node.matches && node.matches('article')) {
                    if (node.getAttribute('data-turn') === 'user') {
                        cachedQueries.push(node);
                        if (!chatState.queries.includes(node)) {
                            chatState.queries.push(node);
                            observers.intersection.observe(node);
                        }
                    }
                    if (node.getAttribute('data-turn') === 'assistant') {
                        cachedResponses.push(node);
                        if (!chatState.responses.includes(node)) {
                            chatState.responses.push(node);
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
    components.sideQuestionDisplay?.remove();
    components.scrollButton?.remove();
    components.countDisplay?.remove();
    components.sideQuestionDisplay = null;
    components.scrollButton = null;
    components.countDisplay = null;
    components.topBarQuestion = null;
    components.sideQuestionTextSpan = null;
    components.topBarTextSpan = null;

    disconnectObservers();
    initializeChatState();

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