async function init() {
  const tabInfoEl = document.getElementById("tab-info");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tabInfoEl) {
      tabInfoEl.textContent = `${tab.title || "Untitled"}\n${tab.url || ""}`;
    } else if (tabInfoEl) {
      tabInfoEl.textContent = "No active tab info";
    }
  } catch {
    if (tabInfoEl) tabInfoEl.textContent = "Active tab ready";
  }

  document.getElementById("inc-badge")?.addEventListener("click", async () => {
    const current = await chrome.action.getBadgeText({});
    const next = String((Number.parseInt(current || "0", 10) || 0) + 1);
    await chrome.action.setBadgeText({ text: next });
    await chrome.action.setBadgeBackgroundColor({ color: "#3584e4" });
  });

  document.getElementById("clear-badge")?.addEventListener("click", async () => {
    await chrome.action.setBadgeText({ text: "" });
  });
}

init();

