// Sentiment analysis of comments using Azure AI Language (key and endpoint come from .env).
const endpoint = (process.env.AZURE_LANGUAGE_ENDPOINT || "").replace(/\/+$/, "");
const key = process.env.AZURE_LANGUAGE_KEY;

const REQUEST_TIMEOUT_MS = 4000;

exports.isConfigured = Boolean(endpoint && key);

// Returns { label, scores } or null. Never throws: a comment must still post if the AI service is down.
exports.analyze = async (text) => {
  if (!exports.isConfigured) return null;

  try {
    const response = await fetch(
      `${endpoint}/language/:analyze-text?api-version=2023-04-01`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": key,
        },
        body: JSON.stringify({
          kind: "SentimentAnalysis",
          parameters: { modelVersion: "latest" },
          analysisInput: { documents: [{ id: "1", language: "en", text }] },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      console.error("Sentiment analysis failed with status", response.status);
      return null;
    }

    const document = (await response.json()).results?.documents?.[0];
    if (!document) return null;

    return { label: document.sentiment, scores: document.confidenceScores };
  } catch (error) {
    console.error("Sentiment analysis error:", error.message);
    return null;
  }
};
