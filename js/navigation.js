const tabs = [...document.querySelectorAll("[data-tab]")];
const panels = {
  eventos: document.querySelector("#panel-eventos"),
  somos: document.querySelector("#panel-somos"),
};

function showTab(name, scroll = true) {
  if (!panels[name]) {
    return;
  }

  for (const tab of tabs) {
    const selected = tab.dataset.tab === name;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const [panelName, panel] of Object.entries(panels)) {
    panel.hidden = panelName !== name;
  }

  if (location.protocol !== "file:") {
    history.replaceState(null, "", name === "eventos" ? "#eventos" : "#somos");
  }
  if (scroll) {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextTab = tabs[(tabs.indexOf(tab) + direction + tabs.length) % tabs.length];
      nextTab.focus();
      showTab(nextTab.dataset.tab);
    }
  });
}

for (const button of document.querySelectorAll("[data-open-tab]")) {
  button.addEventListener("click", () => {
    showTab(button.dataset.openTab);
    document.querySelector(`#tab-${button.dataset.openTab}`).focus();
  });
}

for (const link of document.querySelectorAll(".brand, .footer-brand")) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showTab("eventos");
  });
}

for (const detail of document.querySelectorAll(".statute-item")) {
  detail.addEventListener("toggle", () => {
    if (detail.open) {
      for (const otherDetail of document.querySelectorAll(".statute-item")) {
        if (otherDetail !== detail) {
          otherDetail.open = false;
        }
      }
    }
  });
}

showTab(location.hash === "#somos" ? "somos" : "eventos", false);
window.addEventListener("hashchange", () => {
  showTab(location.hash === "#somos" ? "somos" : "eventos", false);
});
