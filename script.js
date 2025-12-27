(function () {
  const tabsContainer = document.querySelector(".tabs");
  if (!tabsContainer) return;
  const tabList = tabsContainer.querySelector(':scope > [role="tablist"]');
  const tabs = Array.from(tabList.querySelectorAll(':scope > [role="tab"]'));
  const tabPanelsContainer = tabsContainer.querySelector(":scope > .tab-panels");
  const tabPanels = Array.from(tabPanelsContainer.querySelectorAll(':scope > [role="tabpanel"]'));
  tabList.addEventListener("keydown", (e) => {
    const currentTab = e.target;
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex === -1) return; // Exit if the focused element is not a tab
    let newIndex = 0;

    switch (e.key) {
      case "ArrowRight":
        newIndex = (currentIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
        newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        newIndex = 0;
        break;
      case "End":
        newIndex = tabs.length - 1;
        break;
      default:
        return; // Exit if the key is not recognized
    }

    e.preventDefault();
    e.stopPropagation();
    tabs[newIndex].focus();
  });
  function showTab(targetTab) {
    // Unselect other tabs and set this tab as selected
    for (const tab of tabs) {
      if (tab === targetTab) continue;
      tab.setAttribute("aria-selected", false);
      tab.tabIndex = -1;
    }
    targetTab.setAttribute("aria-selected", true);
    targetTab.tabIndex = 0;

    // Hide other tab panels and show the selected panel
    const targetTabPanel = document.getElementById(targetTab.getAttribute("aria-controls"));
    for (const panel of tabPanels) {
      if (panel === targetTabPanel) continue;
      panel.hidden = true;
    }
    targetTabPanel.hidden = false;
  }
  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      showTab(e.target);
    });
    tab.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        showTab(e.target);
      }
    });
  });
})();
