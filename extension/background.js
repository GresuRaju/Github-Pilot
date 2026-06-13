chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_POPUP') {
    chrome.action.openPopup?.().catch(() => {});
  }

  if (msg.type === 'GET_TOKEN') {
    chrome.storage.sync.get(['gh_token', 'gh_username'], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (msg.type === 'SET_LAST_USED') {
    chrome.storage.sync.set({ last_used: new Date().toISOString() });
  }

  if (msg.type === 'SAVE_AUDIT_LOG') {
    chrome.storage.local.get(['audit_logs'], ({ audit_logs = [] }) => {
      audit_logs.unshift(msg.log);
      if (audit_logs.length > 20) audit_logs = audit_logs.slice(0, 20);
      chrome.storage.local.set({ audit_logs });
    });
  }
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'https://github.com' });
  }
});
