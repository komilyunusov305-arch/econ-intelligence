(function () {
    "use strict";

    const config = window.EconIntel.Config;
    const chartInstances = new WeakMap();
    const activeCharts = new Set();
    const util = {
        escape: value => String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]),
        number: value => value === null || value === undefined || !Number.isFinite(Number(value)) ? "–" : Number(value).toFixed(1),
        money: value => {
            if (value === null || value === undefined || !Number.isFinite(Number(value))) return "–";
            const number = Number(value);
            const absolute = Math.abs(number);
            if (absolute >= 1e12) return `$${(number / 1e12).toFixed(2)}T`;
            if (absolute >= 1e9) return `$${(number / 1e9).toFixed(1)}B`;
            if (absolute >= 1e6) return `$${(number / 1e6).toFixed(1)}M`;
            return `$${number.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
        }
    };

    function destroyChart(element) {
        const chart = chartInstances.get(element);
        if (chart) {
            chart.destroy();
            activeCharts.delete(chart);
        }
        chartInstances.delete(element);
    }

    function canvasFor(element, label) {
        destroyChart(element);
        if (!window.Chart) {
            element.innerHTML = "<p class='empty-state'>Charts unavailable · Chart.js did not load.</p>";
            return null;
        }
        element.replaceChildren();
        const canvas = document.createElement("canvas");
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", label);
        element.appendChild(canvas);
        return canvas;
    }

    function chartColors() {
        const styles = getComputedStyle(document.documentElement);
        return {
            text: styles.getPropertyValue("--muted").trim() || "#8c9aab",
            grid: styles.getPropertyValue("--line-soft").trim() || "rgba(144,164,184,.12)"
        };
    }

    function axisValue(value, unit) {
        return unit === "USD" ? util.money(value) : `${Number(value).toFixed(1)}${unit || ""}`;
    }

    function renderLine(element, items, options) {
        const valid = items.map((item, index) => ({
            ...item,
            color: item.color || config.colors[index % config.colors.length],
            points: item.points.filter(point => Number.isFinite(point.year) && Number.isFinite(point.value))
        })).filter(item => item.points.length);
        if (!valid.length) {
            destroyChart(element);
            element.innerHTML = `<p class="empty-state">${util.escape(options.empty || "No observations are available for this selection.")}</p>`;
            return;
        }

        const canvas = canvasFor(element, options.label || "Economic indicator trend");
        if (!canvas) return;
        const colors = chartColors();
        const years = valid.flatMap(item => item.points.map(point => point.year));
        const xMin = Math.min(...years);
        const xMax = Math.max(...years);
        const datasets = valid.map(item => ({
            label: item.label,
            data: item.points.map(point => ({ x: point.year, y: point.value })),
            parsing: false,
            borderColor: item.color,
            backgroundColor: item.color,
            borderWidth: 2,
            tension: 0.24,
            spanGaps: false,
            pointRadius: context => context.raw.x === options.selectedYear ? 4.5 : 2,
            pointHoverRadius: 5,
            pointBorderColor: "#0d141c",
            pointBorderWidth: 1.5
        }));
        const chart = new window.Chart(canvas, {
            type: "line",
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                normalized: true,
                interaction: { mode: "nearest", intersect: false },
                plugins: {
                    legend: {
                        display: valid.length > 1,
                        labels: { color: colors.text, usePointStyle: true, boxWidth: 7, boxHeight: 7, padding: 18 }
                    },
                    tooltip: {
                        callbacks: {
                            label: context => `${context.dataset.label} · ${context.raw.x}: ${axisValue(context.raw.y, options.unit)}`
                        }
                    }
                },
                scales: {
                    x: {
                        type: "linear",
                        min: xMin,
                        max: xMax === xMin ? xMax + 1 : xMax,
                        grid: { color: colors.grid },
                        ticks: {
                            color: colors.text,
                            maxTicksLimit: 8,
                            precision: 0,
                            callback: value => String(Math.round(value))
                        }
                    },
                    y: {
                        grid: { color: colors.grid },
                        ticks: { color: colors.text, callback: value => axisValue(value, options.unit) }
                    }
                }
            }
        });
        chartInstances.set(element, chart);
        activeCharts.add(chart);
    }

    function renderBars(element, rows, unit) {
        const valid = rows.filter(row => Number.isFinite(row.value));
        if (!valid.length) {
            destroyChart(element);
            element.style.height = "";
            element.innerHTML = "<p class='empty-state'>No GDP growth observation is available for this country in the selected year.</p>";
            return;
        }

        element.style.height = `${Math.max(180, valid.length * 38)}px`;
        const canvas = canvasFor(element, "GDP growth by selected country");
        if (!canvas) return;
        const colors = chartColors();
        const chart = new window.Chart(canvas, {
            type: "bar",
            data: {
                labels: valid.map(row => row.label),
                datasets: [{
                    data: valid.map(row => row.value),
                    backgroundColor: valid.map(row => row.value < 0 ? "#f17e83" : "#55d6a5"),
                    borderRadius: 3,
                    barThickness: 10,
                    maxBarThickness: 14
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => ` ${axisValue(context.raw, unit)} · ${valid[context.dataIndex].year || ""}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: colors.grid },
                        ticks: { color: colors.text, callback: value => axisValue(value, unit) }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: colors.text }
                    }
                }
            }
        });
        chartInstances.set(element, chart);
        activeCharts.add(chart);
    }

    window.addEventListener("econintel:themechange", () => {
        const colors = chartColors();
        activeCharts.forEach(chart => {
            Object.values(chart.options.scales).forEach(scale => {
                if (scale.ticks) scale.ticks.color = colors.text;
                if (scale.grid && scale.grid.display !== false) scale.grid.color = colors.grid;
            });
            const legendLabels = chart.options.plugins.legend && chart.options.plugins.legend.labels;
            if (legendLabels) legendLabels.color = colors.text;
            chart.update("none");
        });
    });

    window.EconIntel.Utils = util;
    window.EconIntel.Charts = { renderLine, renderBars };
}());
