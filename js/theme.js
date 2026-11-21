(function () {
    "use strict";

    const root = document.documentElement;
    const button = document.getElementById("themeToggle");
    const icon = document.getElementById("themeIcon");
    const themeColor = document.querySelector('meta[name="theme-color"]');

    function applyTheme(theme) {
        const isLight = theme === "light";
        root.dataset.theme = isLight ? "light" : "dark";
        button.setAttribute("aria-pressed", String(isLight));
        button.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} theme`);
        button.title = `Switch to ${isLight ? "dark" : "light"} theme`;
        icon.textContent = isLight ? "☾" : "☼";
        themeColor.setAttribute("content", isLight ? "#f0f4f8" : "#0b1017");
        window.dispatchEvent(new Event("econintel:themechange"));
    }

    applyTheme(root.dataset.theme === "light" ? "light" : "dark");
    button.addEventListener("click", () => {
        applyTheme(root.dataset.theme === "light" ? "dark" : "light");
    });
}());
