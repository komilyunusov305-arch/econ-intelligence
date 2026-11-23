(function () {
    "use strict";

    const dictionaries = {
        uz: {
            "Global Overview": "Global ko‘rinish",
            "Economic Intelligence": "Iqtisodiy razvedka",
            "Political Intelligence": "Siyosiy razvedka",
            "Demographic Intelligence": "Demografik razvedka",
            "Global Trade & Finance": "Global savdo va moliya",
            "Financial Intelligence": "Moliyaviy razvedka",
            "Country Comparison": "Mamlakatlarni taqqoslash",
            "Interactive Globe": "Interaktiv globus",
            "Data Explorer": "Maʼlumotlar markazi",
            "Research Hub": "Tadqiqotlar markazi",
            "Economic Forecasting": "Iqtisodiy prognoz",
            "Global Economic News": "Global iqtisodiy yangiliklar",
            "Government Systems": "Boshqaruv tizimlari",
            "Global Organizations": "Global tashkilotlar",
            "AI Economic Analyst": "AI iqtisodiy tahlilchi",
            "Overview": "Umumiy ko‘rinish",
            "Global economic monitor": "Global iqtisodiy monitoring",
            "ECON INTELLIGENCE": "ECON INTELLIGENCE",
            "YEAR": "YIL",
            "LAST 10 YEARS": "OXIRGI 10 YIL",
            "GLOBAL GDP GROWTH": "GLOBAL YAIM O‘SISHI",
            "GLOBAL INFLATION": "GLOBAL INFLYATSiya",
            "GLOBAL UNEMPLOYMENT": "GLOBAL ISHSIZLIK",
            "Global overview": "Global ko‘rinish",
            "GLOBAL ECONOMIC MONITOR": "GLOBAL IQTISODIY MONITORING",
            "A source-led view of the forces shaping economies around the world.": "Jahon iqtisodiyotini shakllantirayotgan kuchlarga asosiy manbalar asosida yondashuv.",
            "Presidents": "Prezidentlar",
            "President": "Prezident",
            "Political Leadership": "Siyosiy rahbarlik",
            "Source-attributed presidents for sovereign states. Missing records are shown as unavailable, not inferred.": "Suveren davlatlar prezidentlari manbalar asosida ko‘rsatiladi. Yetishmayotgan maʼlumotlar taxmin qilinmasdan mavjud emas deb ko‘rsatiladi.",
            "LEADER DIRECTORY": "RAHBARLAR RO‘YXATI",
            "Search and filter officeholders": "Lavozim egalarini qidirish va saralash",
            "Country or leader": "Mamlakat yoki rahbar",
            "Search countries or names…": "Mamlakat yoki ismni izlash…",
            "Continent": "Qitʼa",
            "All continents": "Barcha qitʼalar",
            "Position": "Lavozim",
            "All positions": "Barcha lavozimlar",
            "Head of Government": "Hukumat boshlig‘i",
            "Foreign Affairs Minister": "Tashqi ishlar vaziri",
            "Ministers of Foreign Affairs": "Tashqi ishlar vazirlari",
            "Heads of Government": "Hukumat boshliqlari",
            "Presidents": "Prezidentlar",
            "FOREIGN AFFAIRS": "TASHQI ISHLAR",
            "PRESIDENTS": "PREZIDENTLAR",
            "HEADS OF GOVERNMENT": "HUKUMAT BOSHLIQLARI",
            "Loading leadership records…": "Rahbarlar maʼlumotlari yuklanmoqda…",
            "Loading records…": "Maʼlumotlar yuklanmoqda…",
            "Term start": "Lavozimga kirish",
            "Political party": "Siyosiy partiya",
            "Not recorded": "Ko‘rsatilmagan",
            "Wikidata record": "Wikidata yozuvi",
            "Official website listed in Wikidata": "Wikidata’da ko‘rsatilgan rasmiy sayt",
            "Government source not recorded": "Hukumat manbasi ko‘rsatilmagan",
            "Government systems": "Boshqaruv tizimlari",
            "Population": "Aholi",
            "Country directory": "Mamlakatlar ro‘yxati",
            "Search": "Izlash",
            "Refresh source data": "Manba maʼlumotlarini yangilash",
            "Switch to light theme": "Yorug‘ mavzuga o‘tish",
            "Switch to dark theme": "Qorong‘i mavzuga o‘tish",
            "Language": "Til"
        },
        ru: {
            "Global Overview": "Общий обзор",
            "Economic Intelligence": "Экономическая аналитика",
            "Political Intelligence": "Политическая аналитика",
            "Demographic Intelligence": "Демографическая аналитика",
            "Global Trade & Finance": "Мировая торговля и финансы",
            "Financial Intelligence": "Финансовая аналитика",
            "Country Comparison": "Сравнение стран",
            "Interactive Globe": "Интерактивный глобус",
            "Data Explorer": "Обзор данных",
            "Research Hub": "Исследовательский центр",
            "Economic Forecasting": "Экономическое прогнозирование",
            "Global Economic News": "Мировые экономические новости",
            "Government Systems": "Системы управления",
            "Global Organizations": "Международные организации",
            "AI Economic Analyst": "ИИ-экономист",
            "Overview": "Обзор",
            "Global economic monitor": "Глобальный экономический монитор",
            "YEAR": "ГОД",
            "LAST 10 YEARS": "ПОСЛЕДНИЕ 10 ЛЕТ",
            "GLOBAL GDP GROWTH": "РОСТ МИРОВОГО ВВП",
            "GLOBAL INFLATION": "МИРОВАЯ ИНФЛЯЦИЯ",
            "GLOBAL UNEMPLOYMENT": "МИРОВАЯ БЕЗРАБОТИЦА",
            "Global overview": "Общий обзор",
            "GLOBAL ECONOMIC MONITOR": "ГЛОБАЛЬНЫЙ ЭКОНОМИЧЕСКИЙ МОНИТОР",
            "A source-led view of the forces shaping economies around the world.": "Анализ факторов, формирующих экономики мира, на основе первичных источников.",
            "Presidents": "Президенты",
            "President": "Президент",
            "Political Leadership": "Политическое руководство",
            "Source-attributed presidents for sovereign states. Missing records are shown as unavailable, not inferred.": "Президенты суверенных государств по источникам. Отсутствующие записи обозначены как недоступные, а не предположенные.",
            "LEADER DIRECTORY": "СПРАВОЧНИК РУКОВОДИТЕЛЕЙ",
            "Search and filter officeholders": "Поиск и фильтр должностных лиц",
            "Country or leader": "Страна или руководитель",
            "Search countries or names…": "Поиск страны или имени…",
            "Continent": "Континент",
            "All continents": "Все континенты",
            "Position": "Должность",
            "All positions": "Все должности",
            "Head of Government": "Глава правительства",
            "Foreign Affairs Minister": "Министр иностранных дел",
            "Ministers of Foreign Affairs": "Министры иностранных дел",
            "Heads of Government": "Главы правительства",
            "FOREIGN AFFAIRS": "МИД",
            "PRESIDENTS": "ПРЕЗИДЕНТЫ",
            "HEADS OF GOVERNMENT": "ГЛАВЫ ПРАВИТЕЛЬСТВ",
            "Loading leadership records…": "Загрузка данных о руководителях…",
            "Loading records…": "Загрузка данных…",
            "Term start": "Начало срока",
            "Political party": "Политическая партия",
            "Not recorded": "Не указано",
            "Wikidata record": "Запись Wikidata",
            "Official website listed in Wikidata": "Официальный сайт, указанный в Wikidata",
            "Government source not recorded": "Правительственный источник не указан",
            "Government systems": "Системы управления",
            "Population": "Население",
            "Country directory": "Справочник стран",
            "Search": "Поиск",
            "Refresh source data": "Обновить данные",
            "Switch to light theme": "Переключить на светлую тему",
            "Switch to dark theme": "Переключить на тёмную тему",
            "Language": "Язык"
        },
        en: {}
    };

    let language = localStorage.getItem("econ-intelligence-language") || "uz";
    if (!dictionaries[language]) language = "uz";

    function translateText(text) {
        if (language === "en") return text;
        return dictionaries[language][text] || text;
    }

    function translateElement(element) {
        if (!element || element.closest && element.closest(".chart-canvas, canvas, svg")) return;
        if (element.childNodes && element.childNodes.length) {
            element.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const original = node.textContent;
                    const trimmed = original.trim();
                    if (trimmed) node.textContent = original.replace(trimmed, translateText(trimmed));
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    translateElement(node);
                }
            });
        }
    }

    function translatePlaceholders(root) {
        root.querySelectorAll("[placeholder]").forEach(element => {
            element.placeholder = translateText(element.placeholder);
        });
        root.querySelectorAll("[aria-label]").forEach(element => {
            element.setAttribute("aria-label", translateText(element.getAttribute("aria-label")));
        });
        root.querySelectorAll("[title]").forEach(element => {
            element.setAttribute("title", translateText(element.getAttribute("title")));
        });
    }

    function apply() {
        document.documentElement.lang = language;
        translateElement(document.body);
        translatePlaceholders(document);
        const select = document.getElementById("languageSelect");
        if (select) select.value = language;
    }

    function setLanguage(nextLanguage) {
        if (!dictionaries[nextLanguage]) return;
        language = nextLanguage;
        localStorage.setItem("econ-intelligence-language", language);
        window.location.reload();
    }

    window.EconIntel = window.EconIntel || {};
    window.EconIntel.I18n = { apply, setLanguage, t: translateText, language: () => language };

    document.addEventListener("DOMContentLoaded", () => {
        apply();
        const select = document.getElementById("languageSelect");
        if (select) select.addEventListener("change", () => setLanguage(select.value));
        const observer = new MutationObserver(() => apply());
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    });
})();
