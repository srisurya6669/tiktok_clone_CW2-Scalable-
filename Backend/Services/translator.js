// Comment translation with Azure AI Translator.
const key = process.env.AZURE_TRANSLATOR_KEY;
const region = process.env.AZURE_TRANSLATOR_REGION;
const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || "https://api.cognitive.microsofttranslator.com").replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 5000;

exports.isConfigured = Boolean(key && region);

// Returns { text, from } or null if translation is unavailable.
exports.translate = async (text, to) => {
  if (!exports.isConfigured) return null;

  try {
    const response = await fetch(`${endpoint}/translate?api-version=3.0&to=${encodeURIComponent(to)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region,
      },
      body: JSON.stringify([{ Text: text }]),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("Translation failed with status", response.status);
      return null;
    }

    const result = (await response.json())[0];
    return result ? { text: result.translations[0].text, from: result.detectedLanguage?.language ?? null } : null;
  } catch (error) {
    console.error("Translation error:", error.message);
    return null;
  }
};
