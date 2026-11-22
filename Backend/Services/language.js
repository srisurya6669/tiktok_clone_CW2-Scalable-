// Extra text analysis from Azure AI Language (same resource as sentiment): language detection,
// key phrases and PII redaction. Every function returns null on failure so a comment still posts.
const endpoint = (process.env.AZURE_LANGUAGE_ENDPOINT || "").replace(/\/+$/, "");
const key = process.env.AZURE_LANGUAGE_KEY;

const REQUEST_TIMEOUT_MS = 4000;
// Only clear personal identifiers are redacted; names and places are left alone.
const PII_CATEGORIES = ["Email", "PhoneNumber", "CreditCardNumber", "IPAddress"];

exports.isConfigured = Boolean(endpoint && key);

async function analyze(kind, text, parameters = {}) {
  if (!exports.isConfigured) return null;

  try {
    const response = await fetch(`${endpoint}/language/:analyze-text?api-version=2023-04-01`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": key },
      body: JSON.stringify({
        kind,
        parameters: { modelVersion: "latest", ...parameters },
        analysisInput: { documents: [{ id: "1", text }] },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`${kind} failed with status`, response.status);
      return null;
    }
    return (await response.json()).results?.documents?.[0] ?? null;
  } catch (error) {
    console.error(`${kind} error:`, error.message);
    return null;
  }
}

// Returns an ISO code such as "en" or "fr", or null when unsure.
exports.detectLanguage = async (text) => {
  const document = await analyze("LanguageDetection", text);
  const detected = document?.detectedLanguage;
  return detected && detected.confidenceScore >= 0.5 ? detected.iso6391Name : null;
};

exports.keyPhrases = async (text) => {
  const document = await analyze("KeyPhraseExtraction", text);
  return document?.keyPhrases?.slice(0, 5) ?? null;
};

// Returns { text, redacted } where personal details are replaced with asterisks.
exports.redactPii = async (text) => {
  const document = await analyze("PiiEntityRecognition", text, { piiCategories: PII_CATEGORIES });
  if (!document) return null;
  return { text: document.redactedText ?? text, redacted: (document.entities?.length ?? 0) > 0 };
};
