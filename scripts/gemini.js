// 1. 새로운 콘텐츠를 감지할 감시자(Observer)를 설정합니다.
const observer = new MutationObserver(() => {
    // 2. 페이지에 변화가 생길 때마다 버튼을 추가하는 함수를 실행합니다.
    addButtonsToConversations();
});

// 3. 메인 대화 영역을 감시 대상으로 설정하고 감시를 시작합니다.
const mainContent = document.querySelector('main');
if (mainContent) {
    observer.observe(mainContent, { childList: true, subtree: true });
}

// 4. 질문-답변 쌍을 찾아 버튼을 추가하는 메인 함수입니다.
function addButtonsToConversations() {
    // 페이지에 있는 모든 질문과 답변 요소를 각각 찾습니다.
    const allQueries = document.querySelectorAll('user-query');
    const allResponses = document.querySelectorAll('model-response');

    // 처리할 쌍의 개수는 둘 중 적은 쪽을 따릅니다.
    const numPairs = Math.min(allQueries.length, allResponses.length);

    for (let i = 0; i < numPairs; i++) {
        const question = allQueries[i];
        const answer = allResponses[i];

        // 답변에 이미 버튼이 있다면 중복 추가하지 않고 건너뜁니다.
        if (answer.querySelector('.custom-button-wrapper')) {
            continue;
        }

        // --- 여기부터는 이전 코드와 거의 동일합니다 ---

        // 버튼들을 담을 컨테이너를 만듭니다.
        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'custom-button-wrapper';
        buttonWrapper.style.position = 'absolute';
        buttonWrapper.style.right = '10px';
        buttonWrapper.style.top = '10px';
        buttonWrapper.style.zIndex = '100';
        buttonWrapper.style.display = 'flex';
        buttonWrapper.style.gap = '8px';

        // 5번 기능: 답변 접기(Collapse) 버튼
        const collapseButton = document.createElement('button');
        collapseButton.innerText = '숨기기';
        collapseButton.onclick = () => {
            const contentsToHide = Array.from(answer.children).filter(child => !child.classList.contains('custom-button-wrapper'));
            const isHidden = contentsToHide.length > 0 && contentsToHide[0].style.display === 'none';

            contentsToHide.forEach(content => {
                content.style.display = isHidden ? '' : 'none';
            });
            collapseButton.innerText = isHidden ? '숨기기' : '보이기';
        };

        // 4번 기능: 위로 이동(Scroll to Question) 버튼
        const scrollToTopButton = document.createElement('button');
        scrollToTopButton.innerText = '질문으로';
        scrollToTopButton.onclick = () => {
            // 현재 답변과 짝이 되는 질문(question)으로 스크롤합니다.
            question.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        // 버튼 스타일을 적용합니다.
        [collapseButton, scrollToTopButton].forEach(button => {
            button.style.padding = '4px 8px';
            button.style.border = '1px solid #ccc';
            button.style.borderRadius = '4px';
            button.style.backgroundColor = 'white';
            button.style.cursor = 'pointer';
        });

        // 컨테이너에 버튼들을 추가하고, 답변 영역에 최종적으로 컨테이너를 추가합니다.
        buttonWrapper.appendChild(collapseButton);
        buttonWrapper.appendChild(scrollToTopButton);
        answer.style.position = 'relative';
        answer.appendChild(buttonWrapper);
    }
}

// 페이지가 처음 로드되었을 때도 한번 실행해 줍니다.
setTimeout(addButtonsToConversations, 500); // 페이지 로딩을 위해 약간의 지연