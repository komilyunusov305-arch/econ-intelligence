(function () {
    "use strict";

    window.EconIntel = window.EconIntel || {};
    window.EconIntel.Config = {
        endYear: new Date().getFullYear(),
        startYear: new Date().getFullYear() - 9,
        defaultCountry: "UZB",
        defaultComparison: ["UZB", "CHN", "USA", "DEU"],
        centralAsia: ["UZB", "KAZ", "KGZ", "TJK", "TKM"],
        colors: ["#55d6a5", "#70a9ff", "#f0b768", "#f17e83", "#b48cff", "#55c8d7", "#d9d768", "#ed91c2", "#99d77a", "#f0a178"],
        indicators: {
            gdp: { source: "worldBank", code: "NY.GDP.MKTP.KD.ZG", label: "GDP growth", unit: "%", group: "macro", description: "Annual growth in real gross domestic product, adjusted for inflation." },
            inflation: { source: "worldBank", code: "FP.CPI.TOTL.ZG", label: "Inflation", unit: "%", group: "macro", description: "Annual percentage change in consumer prices." },
            unemployment: { source: "worldBank", code: "SL.UEM.TOTL.ZS", label: "Unemployment", unit: "%", group: "macro", description: "Share of the labor force without work but available for and seeking employment." },
            exportsShare: { source: "worldBank", code: "NE.EXP.GNFS.ZS", label: "Exports of GDP", unit: "%", group: "trade", description: "Exports of goods and services as a share of gross domestic product." },
            exportsValue: { source: "worldBank", code: "NE.EXP.GNFS.CD", label: "Exports", unit: "USD", group: "trade", description: "Exports of goods and services in current US dollars." },
            importsValue: { source: "worldBank", code: "NE.IMP.GNFS.CD", label: "Imports", unit: "USD", group: "trade", description: "Imports of goods and services in current US dollars." },
            governmentDebt: { source: "worldBank", code: "GC.DOD.TOTL.GD.ZS", label: "Central government debt", unit: "%", group: "finance", description: "Central government debt as a share of gross domestic product." },
            currentAccount: { source: "worldBank", code: "BN.CAB.XOKA.GD.ZS", label: "Current account", unit: "%", group: "finance", description: "Current account balance as a share of GDP. A positive balance indicates a net surplus." },
            imfGdp: { source: "worldBank", code: "NY.GDP.MKTP.KD.ZG", label: "Real GDP growth", unit: "%", group: "finance", description: "Annual growth in real gross domestic product, adjusted for inflation." },
            imfInflation: { source: "worldBank", code: "FP.CPI.TOTL.ZG", label: "Consumer inflation", unit: "%", group: "finance", description: "Annual percentage change in consumer prices." },
            imfUnemployment: { source: "worldBank", code: "SL.UEM.TOTL.ZS", label: "Unemployment", unit: "%", group: "finance", description: "Share of the labor force without work but available for and seeking employment." },
            externalDebt: { source: "worldBank", code: "DT.DOD.DECT.CD", label: "External debt stock", unit: "USD", group: "finance", description: "Total external debt stocks in current US dollars." },
            reserves: { source: "worldBank", code: "FI.RES.TOTL.CD", label: "International reserves", unit: "USD", group: "finance", description: "Total reserves including gold in current US dollars." },
            domesticCredit: { source: "worldBank", code: "FS.AST.PRVT.GD.ZS", label: "Domestic credit to private sector", unit: "%", group: "finance", description: "Financial resources provided to the private sector as a share of GDP." },
            broadMoney: { source: "worldBank", code: "FM.LBL.BMNY.ZG", label: "Broad money growth", unit: "%", group: "finance", description: "Annual growth rate of broad money." },
            realInterest: { source: "worldBank", code: "FR.INR.RINR", label: "Real interest rate", unit: "%", group: "finance", description: "Lending interest rate adjusted for inflation by the GDP deflator." }
        },
        overviewIndicators: {
            worldGdp: { code: "NY.GDP.MKTP.CD", label: "World GDP · current US$", unit: "USD" },
            worldPopulation: { code: "SP.POP.TOTL", label: "World population", unit: "people" }
        },
        regions: {
            "North America": ["North America"],
            "Latin America & Caribbean": ["Latin America & Caribbean"],
            "Europe & Central Asia": ["Europe & Central Asia"],
            "Middle East & North Africa": ["Middle East & North Africa"],
            "Sub-Saharan Africa": ["Sub-Saharan Africa"],
            "South Asia": ["South Asia"],
            "East Asia & Pacific": ["East Asia & Pacific"]
        }
    };
}());
