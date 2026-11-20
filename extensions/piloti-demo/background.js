chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "1" });
  chrome.action.setBadgeBackgroundColor({ color: "#3584e4" });
});

