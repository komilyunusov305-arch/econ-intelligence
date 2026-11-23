const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const RESPONSE_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
};

function respond(statusCode, payload) {
    return {
        statusCode,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify(payload)
    };
}

function cleanObservations(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 200).filter(item =>
        item && typeof item.indicator === "string" && typeof item.code === "string"
        && Number.isFinite(Number(item.value)) && Number.isInteger(Number(item.year))
    ).map(item => ({
        indicator: item.indicator.slice(0, 100),
        code: item.code.slice(0, 40),
        value: Number(item.value),
        unit: typeof item.unit === "string" ? item.unit.slice(0, 20) : "",
        year: Number(item.year),
        source: typeof item.source === "string" ? item.source.slice(0, 80) : "Unknown"
    }));
}

export const handler = async event => {
    if (event.httpMethod === "GET") {
        return respond(200, { configured: Boolean(process.env.OPENAI_API_KEY), model: MODEL });
    }
    if (event.httpMethod !== "POST") {
        return respond(405, { error: "Use GET to check configuration or POST to ask a question." });
    }
    if (!process.env.OPENAI_API_KEY) {
        return respond(503, { error: "The server is missing the OPENAI_API_KEY environment variable." });
    }
    if (!event.body || event.body.length > 40000) {
        return respond(413, { error: "The request body is empty or too large." });
    }

    let input;
    try {
        input = JSON.parse(event.body);
    } catch (error) {
        return respond(400, { error: "The request body must be valid JSON." });
    }
    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (!question || question.length > 1200) {
        return respond(400, { error: "Provide a question of 1 to 1200 characters." });
    }

    const context = {
        country: typeof input.country === "string" ? input.country.slice(0, 100) : "Not selected",
        observations: cleanObservations(input.observations)
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: MODEL,
                temperature: 0.2,
                max_tokens: 700,
                messages: [
                    {
                        role: "system",
                        content: "You are an economic analyst. Base factual claims only on the supplied source observations. Cite each value's source, indicator code, and year. If the observations do not support an answer, say what is missing. Do not invent, estimate, extrapolate, or present outside knowledge as current data. Clearly distinguish source-reported estimates or projections from historical observations."
                    },
                    {
                        role: "user",
                        content: JSON.stringify({ question, context })
                    }
                ]
            })
        });
        if (!upstream.ok) {
            console.error("OpenAI request failed with status", upstream.status);
            return respond(502, {
                error: upstream.status === 401
                    ? "The configured OpenAI API key was rejected."
                    : `The AI provider returned HTTP ${upstream.status}.`
            });
        }
        const result = await upstream.json();
        const answer = result.choices && result.choices[0] && result.choices[0].message
            && result.choices[0].message.content;
        if (typeof answer !== "string" || !answer.trim()) {
            console.error("OpenAI returned no message content.");
            return respond(502, { error: "The AI provider returned an empty response." });
        }
        return respond(200, { answer: answer.trim(), model: MODEL });
    } catch (error) {
        console.error("OpenAI request failed:", error.name === "AbortError" ? "timeout" : error.message);
        return respond(502, {
            error: error.name === "AbortError"
                ? "The AI provider request timed out. Please try again."
                : "The AI provider could not be reached. Please try again later."
        });
    } finally {
        clearTimeout(timeout);
    }
};
