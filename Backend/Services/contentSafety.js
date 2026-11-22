// Moderation of comments with Azure AI Content Safety (hate, sexual, violence, self-harm).
const endpoint = (process.env.AZURE_CONTENT_SAFETY_ENDPOINT || "").replace(/\/+$/, "");
const key = process.env.AZURE_CONTENT_SAFETY_KEY;

const REQUEST_TIMEOUT_MS = 4000;
// Severity is 0, 2, 4 or 6. 4 and above (medium or worse) is blocked.
const BLOCK_AT = Number(process.env.CONTENT_SAFETY_BLOCK_AT) || 4;

exports.isConfigured = Boolean(endpoint && key);

// Returns { blocked, categories } or null if the service is unavailable (fail open, like sentiment).
exports.check = async (text) => {
  if (!exports.isConfigured) return null;

  try {
    const response = await fetch(`${endpoint}/contentsafety/text:analyze?api-version=2023-10-01`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": key },
      body: JSON.stringify({ text, outputType: "FourSeverityLevels" }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("Content Safety failed with status", response.status);
      return null;
    }

    const analysis = (await response.json()).categoriesAnalysis ?? [];
    const categories = analysis.filter((item) => item.severity >= BLOCK_AT).map((item) => item.category);
    return { blocked: categories.length > 0, categories };
  } catch (error) {
    console.error("Content Safety error:", error.message);
    return null;
  }
};
