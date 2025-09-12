document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enabled-toggle');

    // 팝업이 열릴 때, 저장된 상태를 불러와 토글에 반영
    chrome.storage.sync.get('extensionEnabled', (data) => {
        // 저장된 값이 없으면 기본적으로 활성화(true) 상태
        toggle.checked = typeof data.extensionEnabled === 'undefined' ? true : data.extensionEnabled;
    });

    // 토글 상태가 변경될 때마다 상태를 저장
    toggle.addEventListener('change', () => {
        chrome.storage.sync.set({ extensionEnabled: toggle.checked });
    });
});