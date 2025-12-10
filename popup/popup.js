document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enabled-toggle');

    chrome.storage.sync.get('extensionEnabled', (data) => {
        toggle.checked = typeof data.extensionEnabled === 'undefined' ? true : data.extensionEnabled;
    });

    toggle.addEventListener('change', () => {
        chrome.storage.sync.set({ extensionEnabled: toggle.checked });
    });
});