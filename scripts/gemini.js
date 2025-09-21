let mainMutationObserver = null;
let mainResizeObserver = null;


const elementVisibility = new Map();
const components = {
    scrollButton: null,
    topBarQuestion: null,
    topBarTextSpan: null,
    debugDisplay: null
}
const observers = {
    resize: null,
    intersection: null,
    mutation: null
}
const chatState = {
    queries: [],
    responses: [],
    currentVisibleQueryIndex: -1,
    currentVisibleResponseIndex: -1
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

function processConversationNode(node) {
    console.log("====process node ", node.nodeType);
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
        const targetIndex = chatState.currentVisibleResponseIndex - 1;
        if (targetIndex >= 0) {
            chatState.queries[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            return;
        }
        setTopBarVisibility(false);
        setTimeout(() => {
            setTopBarVisibility(true);
        }, 500);
    });

    const downButton = createScrollButton('arrow_downward', 'scroll to the next question', () => {
        if (chatState.queries.length == 0) return;
        const targetIndex = chatState.currentVisibleResponseIndex + 1;
        if (targetIndex < chatState.queries.length) {
            chatState.queries[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        else {
            chatState.responses.at(-1).scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        setTopBarVisibility(false);
        setTimeout(() => {
            setTopBarVisibility(true);
        }, 500);
    });

    buttonContainer.appendChild(upButton);
    buttonContainer.appendChild(downButton);
    targetContainer.appendChild(buttonContainer);

    if (!document.getElementById('debug-display')) {
        const debugDisplay = document.createElement('div');
        debugDisplay.id = 'debug-display';
        debugDisplay.style.position = 'absolute';
        debugDisplay.style.right = '50px'; // 버튼 옆에 위치
        debugDisplay.style.bottom = '12px';
        debugDisplay.style.fontSize = '12px';
        debugDisplay.style.color = '#888';
        debugDisplay.style.fontFamily = 'monospace';

        targetContainer.appendChild(debugDisplay);
        components.debugDisplay = debugDisplay;
    }
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

    chatState.currentVisibleResponseIndex = topMostVisibleResponseIndex; // 현재 인덱스 업데이트

    console.log(" update top bar current index ", chatState.currentVisibleQueryIndex)

    if (topMostVisibleResponseIndex === -1) {
        setTopBarVisibility(false);
        return;
    }

    const currentQuestion = chatState.queries[topMostVisibleResponseIndex];
    const isQuestionVisible = elementVisibility.get(currentQuestion);
    console.log(" question visible", isQuestionVisible)
    if (!isQuestionVisible) {
        const originalText = currentQuestion.querySelector('.query-text')?.innerText || '';
        const textToShow = originalText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        if (components.topBarTextSpan) {
            components.topBarTextSpan.innerText = textToShow;
            components.title = textToShow;
        }
    }
    setTopBarVisibility(!isQuestionVisible);
    if (components.debugDisplay) {
        components.debugDisplay.innerText = `Index: ${topMostVisibleResponseIndex} / Total: ${chatState.responses.length}`;
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