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
            "AI Presentation Studio": "AI taqdimot studiyasi",
            "RESEARCH-LED PRESENTATION BUILDER": "TADQIQOTGA ASOSLANGAN TAQDIMOT YARATUVCHI",
            "Turn academic requirements into a researched, source-cited PowerPoint presentation.": "Akademik talablarni manbalarga tayangan PowerPoint taqdimotiga aylantiring.",
            "Add your requirements": "Topshiriq talablarini kiriting",
            "Assignment requirements": "Topshiriq talablari",
            "Upload PDF or DOCX": "PDF yoki DOCX yuklash",
            "Country selection": "Mamlakat tanlash",
            "Choose the best-fit country automatically": "Eng mos mamlakatni avtomatik tanlash",
            "I will choose a country": "Mamlakatni o‘zim tanlayman",
            "Manual country": "Mamlakat",
            "Presentation language": "Taqdimot tili",
            "Use the assignment language": "Topshiriq tilidan foydalanish",
            "Slide count": "Slaydlar soni",
            "Infer from assignment": "Topshiriqdan aniqlash",
            "Analyze assignment": "Topshiriqni tahlil qilish",
            "From brief to slides": "Topshiriqdan slaydlargacha",
            "Analyze requirements": "Talablarni tahlil qilish",
            "Research & select country": "Tadqiqot va mamlakat tanlash",
            "Build your presentation": "Taqdimot yaratish",
            "Review the plan": "Rejani ko‘rib chiqish",
            "Assignment analysis": "Topshiriq tahlili",
            "Selected country": "Tanlangan mamlakat",
            "Required sections": "Talab qilingan bo‘limlar",
            "Formatting": "Formatlash",
            "PROPOSED OUTLINE": "TAKLIF ETILGAN REJA",
            "Regenerate analysis": "Tahlilni yangilash",
            "Research & generate slides": "Tadqiqot va slaydlar yaratish",
            "Presentation draft": "Taqdimot loyihasi",
            "Verified research sources": "Tekshirilgan tadqiqot manbalari",
            "Download PowerPoint (.pptx)": "PowerPoint yuklab olish (.pptx)",
            "Regenerate content": "Kontentni qayta yaratish",
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
            "AI Presentation Studio": "Студия презентаций ИИ",
            "RESEARCH-LED PRESENTATION BUILDER": "СОЗДАНИЕ ПРЕЗЕНТАЦИЙ НА ОСНОВЕ ИССЛЕДОВАНИЙ",
            "Turn academic requirements into a researched, source-cited PowerPoint presentation.": "Преобразуйте требования задания в исследованную презентацию PowerPoint со ссылками на источники.",
            "Add your requirements": "Добавьте требования задания",
            "Assignment requirements": "Требования задания",
            "Upload PDF or DOCX": "Загрузить PDF или DOCX",
            "Country selection": "Выбор страны",
            "Choose the best-fit country automatically": "Автоматически выбрать наиболее подходящую страну",
            "I will choose a country": "Я выберу страну",
            "Manual country": "Страна",
            "Presentation language": "Язык презентации",
            "Use the assignment language": "Использовать язык задания",
            "Slide count": "Количество слайдов",
            "Infer from assignment": "Определить по заданию",
            "Analyze assignment": "Анализировать задание",
            "From brief to slides": "От задания к слайдам",
            "Analyze requirements": "Анализ требований",
            "Research & select country": "Исследование и выбор страны",
            "Build your presentation": "Создание презентации",
            "Review the plan": "Проверьте план",
            "Assignment analysis": "Анализ задания",
            "Selected country": "Выбранная страна",
            "Required sections": "Обязательные разделы",
            "Formatting": "Форматирование",
            "PROPOSED OUTLINE": "ПРЕДЛОЖЕННЫЙ ПЛАН",
            "Regenerate analysis": "Повторить анализ",
            "Research & generate slides": "Исследовать и создать слайды",
            "Presentation draft": "Черновик презентации",
            "Verified research sources": "Проверенные источники",
            "Download PowerPoint (.pptx)": "Скачать PowerPoint (.pptx)",
            "Regenerate content": "Создать заново",
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

    let language = localStorage.getItem("econ-intelligence-language") || "en";
    if (!dictionaries[language]) language = "en";

    function translateText(text) {
        if (language === "en") return text;
        return dictionaries[language][text] || text;
    }

    function translateElement(element) {
        if (!element) return;
        if (element.nodeType === Node.TEXT_NODE) {
            const original = element.textContent;
            const trimmed = original.trim();
            if (!trimmed) return;
            const translated = translateText(trimmed);
            if (translated !== trimmed) element.textContent = original.replace(trimmed, translated);
            return;
        }
        if (element.nodeType !== Node.ELEMENT_NODE
            || element.closest(".chart-canvas, canvas, svg")) return;
        if (element.childNodes && element.childNodes.length) {
            element.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                    translateElement(node);
                }
            });
        }
    }

    function translatePlaceholders(root) {
        const selectors = "[placeholder], [aria-label], [title]";
        const elements = root.nodeType === Node.ELEMENT_NODE
            ? [root, ...root.querySelectorAll(selectors)]
            : Array.from(root.querySelectorAll(selectors));
        elements.forEach(element => {
            if (element.closest(".chart-canvas, canvas, svg")) return;
            ["placeholder", "aria-label", "title"].forEach(attribute => {
                if (!element.hasAttribute(attribute)) return;
                const original = element.getAttribute(attribute);
                const translated = translateText(original);
                if (translated !== original) element.setAttribute(attribute, translated);
            });
        });
    }

    function apply() {
        document.documentElement.lang = language;
        translateElement(document.body);
        translatePlaceholders(document);
        const select = document.getElementById("languageSelect");
        if (select) select.value = language;
    }

    function translateMutations(mutations) {
        mutations.forEach(mutation => {
            if (mutation.type === "attributes") {
                const original = mutation.target.getAttribute(mutation.attributeName);
                const translated = translateText(original);
                if (translated !== original) mutation.target.setAttribute(mutation.attributeName, translated);
                return;
            }
            if (mutation.type === "characterData") {
                translateElement(mutation.target);
                return;
            }
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    translateElement(node);
                    translatePlaceholders(node);
                } else if (node.nodeType === Node.TEXT_NODE) {
                    translateElement(node);
                }
            });
        });
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
        const observer = new MutationObserver(translateMutations);
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["placeholder", "aria-label", "title"]
        });
    });
})();
