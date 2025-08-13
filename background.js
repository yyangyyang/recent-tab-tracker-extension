

// ===== In-Memory Lock =====
let isUpdating = false;

async function waitForUnlock() {
  while (isUpdating) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// ===== Utilities =====
async function getClickedTabs() {
  const result = await chrome.storage.local.get("clickedTabs");
  return result.clickedTabs || [];
}

async function setClickedTabs(tabs) {
  await chrome.storage.local.set({ clickedTabs: tabs });
}

function logTime(message) {
  console.log(`${message} at ${new Date().toLocaleTimeString()}`);
}

// ===== Tab Activation =====
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await waitForUnlock();
  isUpdating = true;

  try {
    const tab = await chrome.tabs.get(tabId);
    const newEntry = {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      time: Date.now(),
      windowId: tab.windowId,
    };

    let clickedTabs = await getClickedTabs();
    clickedTabs = clickedTabs.filter(t => t.id !== newEntry.id);
    clickedTabs.unshift(newEntry);

    const { maxTrackedTabs = 20 } = await chrome.storage.local.get("maxTrackedTabs");
    if (clickedTabs.length > maxTrackedTabs) clickedTabs.length = maxTrackedTabs;

    await setClickedTabs(clickedTabs);
    logTime(`Tab ${newEntry.id} activated`);
  } catch (err) {
    console.error("Error tracking activated tab:", err);
  } finally {
    isUpdating = false;
  }
});

// ===== Tab Update (title, URL) =====
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;

  await waitForUnlock();
  isUpdating = true;

  try {
    const clickedTabs = await getClickedTabs();
    const index = clickedTabs.findIndex(t => t.id === tabId);

    if (index !== -1) {
      clickedTabs[index] = {
        ...clickedTabs[index],
        title: tab.title,
        url: tab.url,
        time: Date.now(),
      };
      await setClickedTabs(clickedTabs);
      logTime(`Tab ${tabId} updated`);
    }
  } catch (err) {
    console.error("Error updating tab info:", err);
  } finally {
    isUpdating = false;
  }
});

// ===== Tab Removal =====
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await waitForUnlock();
  isUpdating = true;

  try {
    const clickedTabs = await getClickedTabs();
    const updatedTabs = clickedTabs.filter(t => t.id !== tabId);
    await setClickedTabs(updatedTabs);
    logTime(`Tab ${tabId} removed`);
  } catch (err) {
    console.error("Error removing tab:", err);
  } finally {
    isUpdating = false;
  }
});

// ===== Command: Cycle Tabs =====
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "cycle-clicked-tabs") return;

  try {
    const {
      clickedTabs = [],
      clickedTabIndex = 0,
      tabCycleLimit = 5,
    } = await chrome.storage.local.get(["clickedTabs", "clickedTabIndex", "tabCycleLimit"]);

    if (clickedTabs.length === 0) return;

    const tab = clickedTabs[clickedTabIndex];

    try {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch (err) {
      console.warn(`Tab ${tab.id} no longer exists, removing...`);
      clickedTabs.splice(clickedTabIndex, 1);
      await setClickedTabs(clickedTabs);
      await chrome.storage.local.set({ clickedTabIndex: 0 });
      return;
    }

    // Cycle to next index (skip 0)
    let nextIndex = (clickedTabIndex + 1) % tabCycleLimit;
    if (nextIndex === 0) nextIndex = 1;

    await chrome.storage.local.set({ clickedTabIndex: nextIndex });
  } catch (error) {
    console.error("Failed to cycle tabs:", error);
  }
});
