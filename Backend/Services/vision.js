// Auto-tagging of a video frame with Azure AI Vision (Image Analysis).
const endpoint = (process.env.AZURE_VISION_ENDPOINT || "").replace(/\/+$/, "");
const key = process.env.AZURE_VISION_KEY;

const REQUEST_TIMEOUT_MS = 15000;
const MIN_CONFIDENCE = 0.7;
const MAX_TAGS = 8;

exports.isConfigured = Boolean(endpoint && key);

// Returns a list of tag names, or null if the service is unavailable.
exports.tagImage = async (imageBuffer) => {
  if (!exports.isConfigured) return null;

  try {
    const response = await fetch(
      `${endpoint}/computervision/imageanalysis:analyze?api-version=2023-10-01&features=tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "Ocp-Apim-Subscription-Key": key },
        body: imageBuffer,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      console.error("Vision tagging failed with status", response.status);
      return null;
    }

    const values = (await response.json()).tagsResult?.values ?? [];
    return values
      .filter((tag) => tag.confidence >= MIN_CONFIDENCE)
      .slice(0, MAX_TAGS)
      .map((tag) => tag.name);
  } catch (error) {
    console.error("Vision tagging error:", error.message);
    return null;
  }
};
