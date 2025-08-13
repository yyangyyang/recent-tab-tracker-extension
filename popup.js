

// ===== DOM Elements =====
const tabInfo = document.getElementById("tab-info");
const clearHistoryBtn = document.getElementById("clear-history");
const maxCycleInput = document.getElementById("max-cycle");
const saveMaxCycleBtn = document.getElementById("save-max-cycle");
const maxTabsInput = document.getElementById("max-tabs");
const saveMaxTabsBtn = document.getElementById("save-max-tabs");

// ===== Main Tab Display Logic =====
async function loadClickedTabs() {
  try {
    const result = await chrome.storage.local.get("clickedTabs");
    const clickedTabs = result.clickedTabs || [];

    if (clickedTabs.length === 0) {
      tabInfo.innerHTML = renderNoTabMessage();
      return;
    }

    tabInfo.innerHTML = clickedTabs.map(renderTabEntry).join("");

    // Attach click event listeners
    document.querySelectorAll(".clickable-tab").forEach((entry) => {
      entry.addEventListener("click", async () => {
        const tabId = parseInt(entry.getAttribute("data-tab-id"));
        const windowId = parseInt(entry.getAttribute("data-window-id"));

        try {
          await chrome.tabs.update(tabId, { active: true });
          await chrome.windows.update(windowId, { focused: true });
          window.close();
        } catch (error) {
          console.error("Error switching to tab:", error);
          loadClickedTabs(); // Refresh UI if tab was closed
        }
      });
    });
  } catch (error) {
    console.error("Error loading clicked tabs:", error);
    tabInfo.innerHTML = renderNoTabMessage();
  }
}

// ===== Render Tab Item =====
function renderTabEntry(tab) {
  const timeAgo = formatTimeAgo(tab.time);
  const icon = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(tab.url);
  const safeTitle = escapeHtml(tab.title || "Untitled Tab");

  return `
    <div class="tab-info-entry clickable-tab" data-tab-id="${tab.id}" data-window-id="${tab.windowId}">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div><img class="favicon" src="${icon}" width="16" height="16" style="flex-shrink: 0;"/></div>
        <div class="tab-title" title="${safeTitle}">${safeTitle}</div>
      </div>
      <div class="tab-time">${timeAgo}</div>
    </div>
  `;
}

document.querySelectorAll('.favicon').forEach(img => {
  img.addEventListener('error', () => {
    img.style.display = 'none';
  });
});

// ===== Render Empty State =====
function renderNoTabMessage() {
  return `
    <div class="no-tab">No recent tab activity.</div>
    <div class="get-started">Click on a tab to get started!</div>
  `;
}

// ===== Utility: Time Ago Formatter =====
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}

// ===== Utility: Escape HTML =====
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== Event Handlers =====
clearHistoryBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("clickedTabs");
  tabInfo.innerHTML = renderNoTabMessage();
});

saveMaxCycleBtn.addEventListener("click", async () => {
  const limit = parseInt(maxCycleInput.value);
  if (limit > 0) {
    await chrome.storage.local.set({ tabCycleLimit: limit });
    await chrome.storage.local.set({ clickedTabIndex: 1 }); // reset index
    alert("Tab cycle limit saved.");
  }
});

saveMaxTabsBtn.addEventListener("click", async () => {
  const max = parseInt(maxTabsInput.value);
  if (max >= 5 && max <= 50) {
    await chrome.storage.local.set({ maxTrackedTabs: max });
    alert("Max tracked tabs saved.");
  }
});

// ===== Init =====
document.addEventListener("DOMContentLoaded", async () => {
  loadClickedTabs();
  setInterval(loadClickedTabs, 30000);

  // Load stored settings
  const { tabCycleLimit, maxTrackedTabs } = await chrome.storage.local.get(["tabCycleLimit", "maxTrackedTabs"]);
  if (tabCycleLimit) maxCycleInput.value = tabCycleLimit;
  if (maxTrackedTabs) maxTabsInput.value = maxTrackedTabs;
});
