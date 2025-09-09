// 1. 페이지에 새로운 콘텐츠가 생기는 것을 감지할 감시자(Observer)를 설정합니다.
const observer = new MutationObserver(() => {
    addButtonsToConversations();
});

// 2. 제미나이의 메인 대화 영역 전체를 감시 대상으로 설정하고, 감시를 시작합니다.
const mainContent = document.querySelector('main');
if (mainContent) {
    observer.observe(mainContent, { childList: true, subtree: true });
}

/**
 * 3. 페이지의 모든 질문-답변 쌍을 찾아 버튼을 추가하는 메인 함수입니다.
 */
function addButtonsToConversations() {
    const allQueries = document.querySelectorAll('user-query');
    const allResponses = document.querySelectorAll('model-response');
    const numPairs = Math.min(allQueries.length, allResponses.length);

    for (let i = 0; i < numPairs; i++) {
        const question = allQueries[i];
        const answer = allResponses[i];

        if (answer.querySelector('.custom-button-wrapper')) {
            continue;
        }

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'custom-button-wrapper';
        buttonWrapper.style.position = 'absolute';
        buttonWrapper.style.right = '10px';
        
        // ▼▼▼ 이 부분이 변경되었습니다 ▼▼▼
        buttonWrapper.style.bottom = '10px'; // 'top' 대신 'bottom' 사용
        // ▲▲▲ 여기까지 변경 ▲▲▲

        buttonWrapper.style.zIndex = '100';
        buttonWrapper.style.display = 'flex';
        buttonWrapper.style.gap = '8px';

        // 5번 기능: 답변 접기/펼치기(Collapse) 버튼
        const collapseButton = document.createElement('button');
        collapseButton.innerHTML = '<span class="material-symbols-outlined">unfold_less</span>';
        collapseButton.onclick = () => {
            const contentsToHide = Array.from(answer.children).filter(child => !child.classList.contains('custom-button-wrapper'));
            const isHidden = contentsToHide.length > 0 && contentsToHide[0].style.display === 'none';

            contentsToHide.forEach(content => {
                content.style.display = isHidden ? '' : 'none';
            });

            if (isHidden) {
                collapseButton.innerHTML = '<span class="material-symbols-outlined">unfold_less</span>';
                answer.style.minHeight = '';
            } else {
                collapseButton.innerHTML = '<span class="material-symbols-outlined">unfold_more</span>';
                answer.style.minHeight = '52px'; // 하단 여백을 고려해 최소 높이 조정
            }
        };

        // 4번 기능: 질문으로 이동(Scroll to Question) 버튼
        const scrollToTopButton = document.createElement('button');
        scrollToTopButton.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
        scrollToTopButton.onclick = () => {
            question.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        buttonWrapper.appendChild(collapseButton);
        buttonWrapper.appendChild(scrollToTopButton);
        answer.style.position = 'relative';
        answer.appendChild(buttonWrapper);
    }
}

// 페이지가 처음 로드되었을 때 함수를 한 번 실행해 줍니다.
setTimeout(addButtonsToConversations, 500);