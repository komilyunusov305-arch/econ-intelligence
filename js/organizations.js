(function () {
    "use strict";

    const organizations = [
        { name: "United Nations", acronym: "UN", category: "International organizations", region: "Global", founded: 1945, headquarters: "New York, United States", members: "193 Member States", url: "https://www.un.org/", description: "International organization for peace, international cooperation, and sustainable development." },
        { name: "World Bank Group", acronym: "WBG", category: "Development finance", region: "Global", founded: 1944, headquarters: "Washington, D.C., United States", members: "189 Member States", url: "https://www.worldbank.org/", description: "Development finance institutions providing financing and expertise to developing economies." },
        { name: "International Monetary Fund", acronym: "IMF", category: "Financial institutions", region: "Global", founded: 1944, headquarters: "Washington, D.C., United States", members: "191 Member States", url: "https://www.imf.org/", description: "Promotes global monetary cooperation, financial stability, and international trade." },
        { name: "World Trade Organization", acronym: "WTO", category: "Trade organizations", region: "Global", founded: 1995, headquarters: "Geneva, Switzerland", members: "166 Members", url: "https://www.wto.org/", description: "Sets rules for international trade and provides a forum for trade negotiations and dispute resolution." },
        { name: "World Health Organization", acronym: "WHO", category: "UN specialized agencies", region: "Global", founded: 1948, headquarters: "Geneva, Switzerland", members: "194 Member States", url: "https://www.who.int/", description: "United Nations agency coordinating international public health." },
        { name: "UNESCO", acronym: "UNESCO", category: "UN specialized agencies", region: "Global", founded: 1945, headquarters: "Paris, France", members: "194 Member States", url: "https://www.unesco.org/", description: "Promotes education, science, culture, and freedom of expression." },
        { name: "World Food Programme", acronym: "WFP", category: "UN agencies", region: "Global", founded: 1961, headquarters: "Rome, Italy", members: "UN agency", url: "https://www.wfp.org/", description: "United Nations humanitarian agency focused on food assistance and emergency response." },
        { name: "UNICEF", acronym: "UNICEF", category: "UN agencies", region: "Global", founded: 1946, headquarters: "New York, United States", members: "UN agency", url: "https://www.unicef.org/", description: "United Nations agency advancing children's rights and welfare." },
        { name: "United Nations Development Programme", acronym: "UNDP", category: "UN agencies", region: "Global", founded: 1965, headquarters: "New York, United States", members: "UN agency", url: "https://www.undp.org/", description: "Supports sustainable development and institutional capacity." },
        { name: "UN High Commissioner for Refugees", acronym: "UNHCR", category: "UN agencies", region: "Global", founded: 1950, headquarters: "Geneva, Switzerland", members: "UN agency", url: "https://www.unhcr.org/", description: "United Nations agency protecting refugees and displaced people." },
        { name: "UN Conference on Trade and Development", acronym: "UNCTAD", category: "UN agencies", region: "Global", founded: 1964, headquarters: "Geneva, Switzerland", members: "195 Members", url: "https://unctad.org/", description: "Supports developing countries in trade and development policy." },
        { name: "UN Industrial Development Organization", acronym: "UNIDO", category: "UN specialized agencies", region: "Global", founded: 1966, headquarters: "Vienna, Austria", members: "173 Member States", url: "https://www.unido.org/", description: "Promotes inclusive and sustainable industrial development." },
        { name: "Food and Agriculture Organization", acronym: "FAO", category: "UN specialized agencies", region: "Global", founded: 1945, headquarters: "Rome, Italy", members: "195 Members", url: "https://www.fao.org/", description: "Leads international efforts to defeat hunger and improve agriculture." },
        { name: "International Civil Aviation Organization", acronym: "ICAO", category: "UN specialized agencies", region: "Global", founded: 1944, headquarters: "Montreal, Canada", members: "193 Member States", url: "https://www.icao.int/", description: "Sets global standards and policies for civil aviation." },
        { name: "International Maritime Organization", acronym: "IMO", category: "UN specialized agencies", region: "Global", founded: 1948, headquarters: "London, United Kingdom", members: "176 Member States", url: "https://www.imo.org/", description: "Regulates international shipping and maritime safety." },
        { name: "International Labour Organization", acronym: "ILO", category: "UN specialized agencies", region: "Global", founded: 1919, headquarters: "Geneva, Switzerland", members: "187 Member States", url: "https://www.ilo.org/", description: "Sets labor standards and promotes decent work and social justice." },
        { name: "International Telecommunication Union", acronym: "ITU", category: "UN specialized agencies", region: "Global", founded: 1865, headquarters: "Geneva, Switzerland", members: "194 Member States", url: "https://www.itu.int/", description: "United Nations agency for information and communication technologies." },
        { name: "World Meteorological Organization", acronym: "WMO", category: "UN specialized agencies", region: "Global", founded: 1950, headquarters: "Geneva, Switzerland", members: "193 Member States", url: "https://wmo.int/", description: "Coordinates meteorology, climate, hydrology, and atmospheric services." },
        { name: "World Intellectual Property Organization", acronym: "WIPO", category: "UN specialized agencies", region: "Global", founded: 1967, headquarters: "Geneva, Switzerland", members: "193 Member States", url: "https://www.wipo.int/", description: "Global forum for intellectual property policy and services." },
        { name: "International Atomic Energy Agency", acronym: "IAEA", category: "UN-related organizations", region: "Global", founded: 1957, headquarters: "Vienna, Austria", members: "181 Member States", url: "https://www.iaea.org/", description: "Promotes peaceful uses of nuclear energy and verifies safeguards." },
        { name: "Organisation for Economic Co-operation and Development", acronym: "OECD", category: "Economic organizations", region: "Global", founded: 1961, headquarters: "Paris, France", members: "38 Members", url: "https://www.oecd.org/", description: "Forum for coordinating public policy, economic analysis, and standards among member economies." },
        { name: "G20", acronym: "G20", category: "Political-economic forums", region: "Global", founded: 1999, headquarters: "Rotating presidency", members: "19 Countries, EU and African Union", url: "https://g20.org/", description: "Forum of major economies coordinating global economic and financial policy." },
        { name: "G7", acronym: "G7", category: "Political-economic forums", region: "Global", founded: 1975, headquarters: "Rotating presidency", members: "7 Members", url: "https://www.g7ukraine.info/", description: "Forum of major advanced economies on global political and economic issues." },
        { name: "BRICS", acronym: "BRICS", category: "Political-economic forums", region: "Global", founded: 2009, headquarters: "Rotating chairmanship", members: "11 Members", url: "https://infobrics.org/", description: "Political and economic forum for major emerging-market and developing countries." },
        { name: "New Development Bank", acronym: "NDB", category: "Development finance", region: "Global", founded: 2014, headquarters: "Shanghai, China", members: "BRICS-aligned member states", url: "https://www.ndb.int/", description: "Multilateral development bank supporting infrastructure and sustainable development." },
        { name: "Bank for International Settlements", acronym: "BIS", category: "Financial institutions", region: "Global", founded: 1930, headquarters: "Basel, Switzerland", members: "63 Member central banks", url: "https://www.bis.org/", description: "International organization for central banks and financial stability cooperation." },
        { name: "Financial Stability Board", acronym: "FSB", category: "Financial institutions", region: "Global", founded: 2009, headquarters: "Basel, Switzerland", members: "24 Jurisdictions", url: "https://www.fsb.org/", description: "Monitors and makes recommendations to strengthen global financial stability." },
        { name: "International Association of Insurance Supervisors", acronym: "IAIS", category: "Financial institutions", region: "Global", founded: 1994, headquarters: "Basel, Switzerland", members: "Insurance supervisors and regulators", url: "https://www.iaisweb.org/", description: "Global standard-setting body for insurance supervision." },
        { name: "Financial Action Task Force", acronym: "FATF", category: "Financial institutions", region: "Global", founded: 1989, headquarters: "Paris, France", members: "40 Members", url: "https://www.fatf-gafi.org/", description: "Intergovernmental body setting standards for anti-money-laundering and counter-terrorist financing." },
        { name: "Basel Committee on Banking Supervision", acronym: "BCBS", category: "Financial institutions", region: "Global", founded: 1974, headquarters: "Basel, Switzerland", members: "Central banks and regulators", url: "https://www.bis.org/bcbs/", description: "Global standard-setting body for prudential regulation and banking supervision." },
        { name: "European Union", acronym: "EU", category: "Regional political-economic unions", region: "Europe", founded: 1993, headquarters: "Brussels, Belgium", members: "27 Member States", url: "https://european-union.europa.eu/", description: "Political and economic union of European states with a shared internal market." },
        { name: "Council of Europe", acronym: "CoE", category: "Regional organizations", region: "Europe", founded: 1949, headquarters: "Strasbourg, France", members: "46 Member States", url: "https://www.coe.int/", description: "Organization promoting human rights, democracy, and the rule of law." },
        { name: "European Council", acronym: "EUCO", category: "Regional political institutions", region: "Europe", founded: 1961, headquarters: "Brussels, Belgium", members: "EU heads of state or government", url: "https://www.consilium.europa.eu/", description: "Defines the European Union's general political direction and priorities." },
        { name: "European Free Trade Association", acronym: "EFTA", category: "Trade organizations", region: "Europe", founded: 1960, headquarters: "Geneva, Switzerland", members: "4 Members", url: "https://www.efta.int/", description: "Intergovernmental trade organization for European free trade cooperation." },
        { name: "Council of the Baltic Sea States", acronym: "CBSS", category: "Regional organizations", region: "Europe", founded: 1992, headquarters: "Stockholm, Sweden", members: "10 Members", url: "https://cbss.org/", description: "Regional forum for cooperation in the Baltic Sea region." },
        { name: "Organization for Security and Co-operation in Europe", acronym: "OSCE", category: "Security organizations", region: "Europe", founded: 1975, headquarters: "Vienna, Austria", members: "57 Participating States", url: "https://www.osce.org/", description: "Security organization covering arms control, elections, rule of law, and human rights." },
        { name: "North Atlantic Treaty Organization", acronym: "NATO", category: "Security organizations", region: "Europe / North America", founded: 1949, headquarters: "Brussels, Belgium", members: "32 Member States", url: "https://www.nato.int/", description: "Political and military alliance based on collective defense." },
        { name: "Nordic Council", acronym: "NC", category: "Regional organizations", region: "Europe", founded: 1952, headquarters: "Copenhagen, Denmark", members: "Nordic countries and autonomous areas", url: "https://www.norden.org/", description: "Inter-parliamentary forum for Nordic cooperation." },
        { name: "Benelux Union", acronym: "Benelux", category: "Regional economic unions", region: "Europe", founded: 1944, headquarters: "Brussels, Belgium", members: "Belgium, Netherlands, Luxembourg", url: "https://www.benelux.int/", description: "Political, economic, and customs cooperation among Belgium, the Netherlands, and Luxembourg." },
        { name: "Commonwealth of Independent States", acronym: "CIS", category: "Regional organizations", region: "Eurasia", founded: 1991, headquarters: "Minsk, Belarus", members: "9 Member States", url: "https://cis.minsk.by/", description: "Regional organization of post-Soviet states." },
        { name: "Eurasian Economic Union", acronym: "EAEU", category: "Regional economic unions", region: "Eurasia", founded: 2014, headquarters: "Moscow, Russia", members: "5 Member States", url: "https://eec.eaeunion.org/", description: "Economic union with a common market and customs policy." },
        { name: "Shanghai Cooperation Organisation", acronym: "SCO", category: "Security organizations", region: "Eurasia", founded: 2001, headquarters: "Beijing, China", members: "10 Member States", url: "https://sectsco.org/", description: "Political, security, and economic cooperation organization in Eurasia." },
        { name: "Collective Security Treaty Organization", acronym: "CSTO", category: "Security organizations", region: "Eurasia", founded: 1992, headquarters: "Moscow, Russia", members: "6 Member States", url: "https://en.odkb-csto.org/", description: "Military alliance for collective security among participating post-Soviet states." },
        { name: "GUAM Organization for Democracy and Economic Development", acronym: "GUAM", category: "Regional organizations", region: "Eurasia", founded: 1997, headquarters: "Kyiv, Ukraine", members: "4 Member States", url: "https://guam-organization.org/", description: "Regional forum for cooperation among Georgia, Ukraine, Azerbaijan, and Moldova." },
        { name: "African Union", acronym: "AU", category: "Regional political unions", region: "Africa", founded: 2002, headquarters: "Addis Ababa, Ethiopia", members: "55 Member States", url: "https://au.int/", description: "Continental union coordinating integration, peace, development, and governance in Africa." },
        { name: "East African Community", acronym: "EAC", category: "Regional economic unions", region: "Africa", founded: 1999, headquarters: "Arusha, Tanzania", members: "8 Member States", url: "https://www.eac.int/", description: "Regional economic community in East Africa." },
        { name: "Economic Community of West African States", acronym: "ECOWAS", category: "Regional economic unions", region: "Africa", founded: 1975, headquarters: "Abuja, Nigeria", members: "12 Member States", url: "https://ecowas.int/", description: "West African regional organization promoting economic integration and security." },
        { name: "Southern African Development Community", acronym: "SADC", category: "Regional economic unions", region: "Africa", founded: 1992, headquarters: "Gaborone, Botswana", members: "16 Member States", url: "https://www.sadc.int/", description: "Regional community promoting economic integration and development in Southern Africa." },
        { name: "Common Market for Eastern and Southern Africa", acronym: "COMESA", category: "Regional economic unions", region: "Africa", founded: 1994, headquarters: "Lusaka, Zambia", members: "21 Member States", url: "https://www.comesa.int/", description: "Preferential trade area and economic community in Eastern and Southern Africa." },
        { name: "Economic Community of Central African States", acronym: "ECCAS", category: "Regional organizations", region: "Africa", founded: 1983, headquarters: "Libreville, Gabon", members: "11 Member States", url: "https://ceeac-eccas.org/", description: "Regional organization promoting economic integration and peace in Central Africa." },
        { name: "Arab Maghreb Union", acronym: "UMA", category: "Regional economic unions", region: "Africa", founded: 1989, headquarters: "Rabat, Morocco", members: "5 Member States", url: "https://maghrebarabe.org/", description: "Regional organization for economic integration among North African states." },
        { name: "Intergovernmental Authority on Development", acronym: "IGAD", category: "Regional organizations", region: "Africa", founded: 1996, headquarters: "Djibouti City, Djibouti", members: "8 Member States", url: "https://igad.int/", description: "Regional bloc promoting development and resilience in the Horn of Africa." },
        { name: "Arab League", acronym: "LAS", category: "Regional political unions", region: "Middle East / Africa", founded: 1945, headquarters: "Cairo, Egypt", members: "22 Member States", url: "https://www.leagueofarabstates.net/", description: "Regional forum for political, economic, cultural, and social cooperation among Arab states." },
        { name: "Gulf Cooperation Council", acronym: "GCC", category: "Regional political-economic unions", region: "Middle East", founded: 1981, headquarters: "Riyadh, Saudi Arabia", members: "6 Member States", url: "https://gcc-sg.org/", description: "Political and economic alliance of Gulf states." },
        { name: "Organization of Islamic Cooperation", acronym: "OIC", category: "International organizations", region: "Global / Muslim-majority states", founded: 1969, headquarters: "Jeddah, Saudi Arabia", members: "57 Member States", url: "https://www.oic-oci.org/", description: "Political forum representing cooperation among member states with large Muslim populations." },
        { name: "Organization of Petroleum Exporting Countries", acronym: "OPEC", category: "Energy organizations", region: "Global", founded: 1960, headquarters: "Vienna, Austria", members: "12 Member Countries", url: "https://www.opec.org/", description: "Coordinates petroleum policies and stabilizes oil markets among member countries." },
        { name: "Association of Southeast Asian Nations", acronym: "ASEAN", category: "Regional political-economic unions", region: "Asia-Pacific", founded: 1967, headquarters: "Jakarta, Indonesia", members: "10 Member States", url: "https://asean.org/", description: "Regional organization promoting economic, political, security, and cultural cooperation." },
        { name: "Asia-Pacific Economic Cooperation", acronym: "APEC", category: "Economic organizations", region: "Asia-Pacific", founded: 1989, headquarters: "Singapore secretariat", members: "21 Economies", url: "https://www.apec.org/", description: "Forum for trade and investment cooperation across the Asia-Pacific." },
        { name: "South Asian Association for Regional Cooperation", acronym: "SAARC", category: "Regional organizations", region: "South Asia", founded: 1985, headquarters: "Kathmandu, Nepal", members: "8 Member States", url: "https://saarc-sec.org/", description: "Regional forum for economic and social cooperation in South Asia." },
        { name: "Bay of Bengal Initiative for Multi-Sectoral Technical and Economic Cooperation", acronym: "BIMSTEC", category: "Regional organizations", region: "South / Southeast Asia", founded: 1997, headquarters: "Dhaka, Bangladesh", members: "7 Member States", url: "https://bimstec.org/", description: "Regional organization linking South and Southeast Asian economies." },
        { name: "ASEAN Plus Three", acronym: "APT", category: "Political-economic forums", region: "Asia-Pacific", founded: 1997, headquarters: "ASEAN Secretariat", members: "ASEAN plus China, Japan, South Korea", url: "https://asean.org/", description: "Regional policy forum for East Asian economic and financial cooperation." },
        { name: "Pacific Islands Forum", acronym: "PIF", category: "Regional organizations", region: "Pacific", founded: 1971, headquarters: "Suva, Fiji", members: "18 Members", url: "https://forumsec.org/", description: "Political and economic cooperation forum for Pacific island states." },
        { name: "Melanesian Spearhead Group", acronym: "MSG", category: "Regional organizations", region: "Pacific", founded: 1986, headquarters: "Port Vila, Vanuatu", members: "5 Members", url: "https://www.msg.int/", description: "Subregional organization for Melanesian countries." },
        { name: "Organization of American States", acronym: "OAS", category: "Regional organizations", region: "Americas", founded: 1948, headquarters: "Washington, D.C., United States", members: "32 Active Member States", url: "https://www.oas.org/", description: "Regional organization promoting democracy, human rights, security, and development." },
        { name: "Community of Latin American and Caribbean States", acronym: "CELAC", category: "Regional political unions", region: "Latin America / Caribbean", founded: 2010, headquarters: "Pro tempore presidency", members: "33 Member States", url: "https://www.celacinternational.org/", description: "Political forum for Latin American and Caribbean cooperation." },
        { name: "Andean Community", acronym: "CAN", category: "Regional economic unions", region: "South America", founded: 1969, headquarters: "Lima, Peru", members: "4 Member States", url: "https://www.comunidadandina.org/", description: "Customs and trade integration community of Andean states." },
        { name: "Mercosur", acronym: "Mercosur", category: "Regional economic unions", region: "South America", founded: 1991, headquarters: "Montevideo, Uruguay", members: "Full and associate members", url: "https://www.mercosur.int/", description: "South American trade bloc promoting free movement and customs integration." },
        { name: "Pacific Alliance", acronym: "PA", category: "Regional economic unions", region: "Americas", founded: 2011, headquarters: "Rotating presidency", members: "4 Member States", url: "https://alianzapacifico.net/", description: "Regional integration initiative for trade and investment among Pacific-facing Latin American economies." },
        { name: "Caribbean Community", acronym: "CARICOM", category: "Regional economic unions", region: "Caribbean", founded: 1973, headquarters: "Georgetown, Guyana", members: "15 Member States", url: "https://caricom.org/", description: "Community promoting economic integration and policy coordination in the Caribbean." },
        { name: "Central American Integration System", acronym: "SICA", category: "Regional political-economic unions", region: "Central America", founded: 1991, headquarters: "El Salvador", members: "8 Member States", url: "https://www.sica.int/", description: "Regional framework for political, economic, social, and environmental integration." },
        { name: "North American Free Trade Agreement / USMCA", acronym: "USMCA", category: "Trade organizations", region: "North America", founded: 2020, headquarters: "Trade agreement secretariats", members: "Canada, Mexico, United States", url: "https://ustr.gov/trade-agreements/free-trade-agreements/united-states-mexico-canada-agreement", description: "North American trade agreement governing trade and investment between Canada, Mexico, and the United States." },
        { name: "International Organization for Standardization", acronym: "ISO", category: "Standards organizations", region: "Global", founded: 1947, headquarters: "Geneva, Switzerland", members: "ISO member bodies", url: "https://www.iso.org/", description: "Independent, nongovernmental organization developing voluntary international standards." },
        { name: "International Organization of Securities Commissions", acronym: "IOSCO", category: "Financial institutions", region: "Global", founded: 1983, headquarters: "Madrid, Spain", members: "Securities regulators worldwide", url: "https://www.iosco.org/", description: "Global association of securities regulators and standard setter for securities markets." },
        { name: "International Federation of Red Cross and Red Crescent Societies", acronym: "IFRC", category: "International NGOs", region: "Global", founded: 1919, headquarters: "Geneva, Switzerland", members: "191 National Societies", url: "https://www.ifrc.org/", description: "Global humanitarian network supporting disaster response and community resilience." },
        { name: "Transparency International", acronym: "TI", category: "International NGOs", region: "Global", founded: 1993, headquarters: "Berlin, Germany", members: "Global civil society network", url: "https://www.transparency.org/", description: "Civil society organization focused on combating corruption." },
        { name: "International Committee of the Red Cross", acronym: "ICRC", category: "International NGOs", region: "Global", founded: 1863, headquarters: "Geneva, Switzerland", members: "Independent humanitarian institution", url: "https://www.icrc.org/", description: "Humanitarian organization protecting people affected by armed conflict." }
    ];

    let initialized = false;
    const foundedDates = {
        "United Nations": "24 October 1945",
        "World Bank Group": "27 December 1945",
        "International Monetary Fund": "27 December 1945",
        "World Trade Organization": "1 January 1995",
        "World Health Organization": "7 April 1948",
        "UNESCO": "16 November 1945",
        "World Food Programme": "24 December 1961",
        "UNICEF": "11 December 1946",
        "United Nations Development Programme": "22 November 1965",
        "UN High Commissioner for Refugees": "14 December 1950",
        "UN Conference on Trade and Development": "30 December 1964",
        "Food and Agriculture Organization": "16 October 1945",
        "International Civil Aviation Organization": "7 December 1944",
        "International Labour Organization": "11 April 1919",
        "International Telecommunication Union": "17 May 1865",
        "World Meteorological Organization": "23 March 1950",
        "World Intellectual Property Organization": "14 July 1967",
        "International Atomic Energy Agency": "29 July 1957",
        "Organisation for Economic Co-operation and Development": "14 December 1960",
        "G20": "26 September 1999",
        "G7": "15 November 1975",
        "New Development Bank": "15 July 2014",
        "Bank for International Settlements": "17 May 1930",
        "Financial Stability Board": "2009",
        "European Union": "1 November 1993",
        "Council of Europe": "5 May 1949",
        "European Free Trade Association": "3 May 1960",
        "Organization for Security and Co-operation in Europe": "1 August 1975",
        "North Atlantic Treaty Organization": "4 April 1949",
        "Nordic Council": "16 March 1952",
        "Commonwealth of Independent States": "8 December 1991",
        "Eurasian Economic Union": "29 May 2014",
        "Shanghai Cooperation Organisation": "15 June 2001",
        "Collective Security Treaty Organization": "7 October 2002",
        "African Union": "26 May 2001",
        "East African Community": "30 November 1999",
        "Economic Community of West African States": "28 May 1975",
        "Southern African Development Community": "17 August 1992",
        "Arab League": "22 March 1945",
        "Gulf Cooperation Council": "25 May 1981",
        "Organization of Islamic Cooperation": "25 September 1969",
        "Organization of Petroleum Exporting Countries": "14 September 1960",
        "Association of Southeast Asian Nations": "8 August 1967",
        "Asia-Pacific Economic Cooperation": "6 November 1989",
        "South Asian Association for Regional Cooperation": "8 December 1985",
        "Pacific Islands Forum": "5 August 1971",
        "Organization of American States": "30 April 1948",
        "Community of Latin American and Caribbean States": "23 February 2010",
        "Andean Community": "26 May 1969",
        "Mercosur": "26 March 1991",
        "Pacific Alliance": "28 April 2011",
        "Caribbean Community": "4 July 1973",
        "Central American Integration System": "13 December 1991",
        "International Organization for Standardization": "23 February 1947",
        "International Federation of Red Cross and Red Crescent Societies": "5 May 1919",
        "Transparency International": "May 1993",
        "International Committee of the Red Cross": "17 February 1863"
    };

    function escape(value) {
        return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
    }

    function safeUrl(value) {
        try {
            const url = new URL(value);
            return ["https:", "http:"].includes(url.protocol) ? url.href : null;
        } catch (error) {
            return null;
        }
    }

    function organizationCacheKey(name) {
        return `org-symbol-v1-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    }

    const organizationSymbolRequests = new Map();
    const ORGANIZATION_SYMBOL_CACHE_TTL = 12 * 60 * 60 * 1000;
    const ORGANIZATION_SYMBOL_FAILURE_TTL = 5 * 60 * 1000;

    function cacheOrganizationSymbol(cacheKey, symbol, ttl) {
        try {
            window.localStorage.setItem(cacheKey, JSON.stringify({
                image: symbol && symbol.image || null,
                expiresAt: Date.now() + ttl
            }));
        } catch (error) {
            console.warn("Could not cache organization symbol:", error);
        }
    }

    function resolveOrganizationSymbol(item) {
        const cacheKey = organizationCacheKey(item.name);
        const cachedRequest = organizationSymbolRequests.get(cacheKey);
        if (cachedRequest && cachedRequest.expiresAt > Date.now()) return cachedRequest.promise;

        const request = {
            expiresAt: Infinity,
            promise: loadOrganizationSymbol(item, cacheKey)
        };
        organizationSymbolRequests.set(cacheKey, request);
        request.promise.then(symbol => {
            if (organizationSymbolRequests.get(cacheKey) === request) {
                request.expiresAt = Date.now()
                    + (symbol ? ORGANIZATION_SYMBOL_CACHE_TTL : ORGANIZATION_SYMBOL_FAILURE_TTL);
            }
        });
        return request.promise;
    }

    async function loadOrganizationSymbol(item, cacheKey) {
        try {
            const cached = window.localStorage.getItem(cacheKey);
            if (cached) {
                const record = JSON.parse(cached);
                const isFresh = !Number.isFinite(record.expiresAt) || record.expiresAt > Date.now();
                if (isFresh && typeof record.image === "string") {
                    if (!Number.isFinite(record.expiresAt)) {
                        cacheOrganizationSymbol(cacheKey, { image: record.image }, ORGANIZATION_SYMBOL_CACHE_TTL);
                    }
                    return { image: record.image };
                }
                if (isFresh && record.image === null) return null;
            }
        } catch (error) {
            console.warn("Could not read organization symbol cache:", error);
        }

        const titleAliases = {
            "G7": "G7",
            "G20": "G20",
            "BRICS": "BRICS",
            "ASEAN": "ASEAN",
            "Mercosur": "Mercosur",
            "Benelux Union": "Benelux",
            "USMCA": "United States–Mexico–Canada Agreement",
            "UNESCO": "UNESCO",
            "UNICEF": "UNICEF",
            "UNHCR": "United Nations High Commissioner for Refugees",
            "UNDP": "United Nations Development Programme",
            "UNIDO": "United Nations Industrial Development Organization",
            "UNCTAD": "United Nations Conference on Trade and Development",
            "WFP": "World Food Programme",
            "FAO": "Food and Agriculture Organization",
            "ICAO": "International Civil Aviation Organization",
            "IMO": "International Maritime Organization",
            "ILO": "International Labour Organization",
            "ITU": "International Telecommunication Union",
            "WMO": "World Meteorological Organization",
            "WIPO": "World Intellectual Property Organization",
            "IAEA": "International Atomic Energy Agency",
            "OECD": "OECD",
            "OPEC": "OPEC",
            "NATO": "NATO",
            "OSCE": "Organization for Security and Co-operation in Europe",
            "SCO": "Shanghai Cooperation Organisation",
            "CSTO": "Collective Security Treaty Organization",
            "AU": "African Union",
            "EAC": "East African Community",
            "ECOWAS": "Economic Community of West African States",
            "SADC": "Southern African Development Community",
            "COMESA": "Common Market for Eastern and Southern Africa",
            "IGAD": "Intergovernmental Authority on Development",
            "LAS": "Arab League",
            "GCC": "Gulf Cooperation Council",
            "OIC": "Organisation of Islamic Cooperation",
            "APEC": "Asia-Pacific Economic Cooperation",
            "SAARC": "South Asian Association for Regional Cooperation",
            "BIMSTEC": "Bay of Bengal Initiative for Multi-Sectoral Technical and Economic Cooperation",
            "PIF": "Pacific Islands Forum",
            "OAS": "Organization of American States",
            "CELAC": "Community of Latin American and Caribbean States",
            "CAN": "Andean Community",
            "CARICOM": "Caribbean Community",
            "SICA": "Central American Integration System",
            "ISO": "International Organization for Standardization",
            "IOSCO": "International Organization of Securities Commissions",
            "IFRC": "International Federation of Red Cross and Red Crescent Societies",
            "ICRC": "International Committee of the Red Cross"
        };
        const title = titleAliases[item.acronym] || item.name;
        try {
            const controller = typeof AbortController === "function" ? new AbortController() : null;
            let timeout;
            const fetchRequest = (async () => {
                const options = { headers: { Accept: "application/json" } };
                if (controller) options.signal = controller.signal;
                const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, options);
                if (!response.ok) throw new Error(`Symbol lookup failed (${response.status})`);
                return response.json();
            })();
            const timeoutRequest = new Promise((resolve, reject) => {
                timeout = window.setTimeout(() => {
                    if (controller) controller.abort();
                    reject(new Error("Symbol lookup timed out after 15000 ms."));
                }, 15000);
            });
            let record;
            try {
                record = await Promise.race([fetchRequest, timeoutRequest]);
            } finally {
                if (timeout) window.clearTimeout(timeout);
            }
            const image = record.originalimage && record.originalimage.source
                ? record.originalimage.source
                : record.thumbnail && record.thumbnail.source
                    ? record.thumbnail.source
                    : null;
            const result = image ? { image } : null;
            cacheOrganizationSymbol(cacheKey, result, ORGANIZATION_SYMBOL_CACHE_TTL);
            return result;
        } catch (error) {
            console.warn(`Could not load the organization symbol for ${item.name}:`, error);
            cacheOrganizationSymbol(cacheKey, null, ORGANIZATION_SYMBOL_FAILURE_TTL);
        }
        return null;
    }

    async function resolveVisibleOrganizationSymbols() {
        const cards = Array.from(document.querySelectorAll("#organizationsDirectory [data-organization-name]"));
        const queue = cards.slice();
        const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
            while (queue.length) {
                const card = queue.shift();
                if (!card) continue;
                const item = organizations.find(record => record.name === card.dataset.organizationName);
                if (!item) continue;
                const symbol = await resolveOrganizationSymbol(item);
                if (!symbol || !symbol.image) continue;
                const image = card.querySelector(".organization-emblem img");
                if (!image) continue;
                image.hidden = false;
                if (image.nextElementSibling) image.nextElementSibling.hidden = true;
                image.onerror = () => {
                    image.hidden = true;
                    if (image.nextElementSibling) image.nextElementSibling.hidden = false;
                };
                image.src = symbol.image;
            }
        });
        await Promise.all(workers);
    }

    function render() {
        const query = (document.getElementById("organizationsSearch").value || "").trim().toLowerCase();
        const category = document.getElementById("organizationsCategory").value;
        const region = document.getElementById("organizationsRegion").value;
        const filtered = organizations.filter(item => {
            const haystack = [item.name, item.acronym, item.category, item.region, item.headquarters, item.members, item.description].join(" ").toLowerCase();
            return (!query || haystack.includes(query))
                && (!category || item.category === category)
                && (!region || item.region === region);
        });

        document.getElementById("organizationsCount").textContent = `${filtered.length} / ${organizations.length} records`;
        document.getElementById("organizationsDirectory").innerHTML = filtered.length
            ? filtered.map(item => {
                const url = safeUrl(item.url);
                const foundedDate = foundedDates[item.name];
                return `<article class="organization-card" data-organization-name="${escape(item.name)}">
                    <div class="organization-card-top">
                        <span class="organization-emblem" role="img" aria-label="${escape(item.name)} emblem">
                            <img alt="${escape(item.name)} emblem" loading="lazy" hidden>
                            <span>${escape(item.acronym)}</span>
                        </span>
                        <span class="organization-category">${escape(item.category)}</span>
                    </div>
                    <h3>${escape(item.name)}</h3>
                    <p>${escape(item.description)}</p>
                    <dl class="organization-facts">
                        <div><dt>Region</dt><dd>${escape(item.region)}</dd></div>
                        <div><dt>Founded</dt><dd>${escape(foundedDate || `${item.founded} · exact day unavailable`)}</dd></div>
                        <div><dt>Headquarters</dt><dd>${escape(item.headquarters)}</dd></div>
                        <div><dt>Membership</dt><dd>${escape(item.members)}</dd></div>
                    </dl>
                    ${url ? `<a class="text-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Official website <span aria-hidden="true">↗</span></a>` : ""}
                </article>`;
            }).join("")
            : `<p class="empty-state">No organizations match the selected filters.</p>`;
        resolveVisibleOrganizationSymbols();
    }

    function populateSelect(id, values) {
        const select = document.getElementById(id);
        if (!select) return;
        values.sort((a, b) => a.localeCompare(b)).forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    function init() {
        if (initialized) return;
        initialized = true;
        populateSelect("organizationsCategory", Array.from(new Set(organizations.map(item => item.category))));
        populateSelect("organizationsRegion", Array.from(new Set(organizations.map(item => item.region))));
        ["organizationsSearch", "organizationsCategory", "organizationsRegion"].forEach(id => {
            document.getElementById(id).addEventListener(id === "organizationsSearch" ? "input" : "change", render);
        });
        render();
    }

    window.EconIntel.Organizations = { init };
}());
