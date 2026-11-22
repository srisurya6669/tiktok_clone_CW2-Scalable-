// Subtitles from the video's audio with Azure AI Speech (fast transcription).
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
const endpoint = (
  process.env.AZURE_SPEECH_ENDPOINT || (region ? `https://${region}.api.cognitive.microsoft.com` : "")
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 60000;
// Candidate languages: the service picks whichever matches the audio.
const LOCALES = (process.env.SPEECH_LOCALES || "en-US,en-GB,hi-IN,fr-FR,es-ES,de-DE").split(",");

exports.isConfigured = Boolean(key && endpoint);

// Returns { transcript, captions: [{ start, end, text }] } in seconds, or null.
exports.transcribe = async (audioBuffer) => {
  if (!exports.isConfigured) return null;

  try {
    const form = new FormData();
    form.append("audio", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");
    form.append("definition", JSON.stringify({ locales: LOCALES }));

    const response = await fetch(
      `${endpoint}/speechtotext/transcriptions:transcribe?api-version=2024-11-15`,
      {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": key },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      console.error("Speech transcription failed with status", response.status);
      return null;
    }

    const data = await response.json();
    const captions = (data.phrases ?? [])
      .filter((phrase) => phrase.text?.trim())
      .map((phrase) => ({
        start: phrase.offsetMilliseconds / 1000,
        end: (phrase.offsetMilliseconds + phrase.durationMilliseconds) / 1000,
        text: phrase.text.trim(),
      }));
    if (captions.length === 0) return null;

    return { transcript: data.combinedPhrases?.[0]?.text ?? captions.map((c) => c.text).join(" "), captions };
  } catch (error) {
    console.error("Speech transcription error:", error.message);
    return null;
  }
};
