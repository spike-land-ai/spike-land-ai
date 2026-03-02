import { tryCatch } from "@/lib/try-catch";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_ID = "jRAAK67SEFE9m7ci5DhD"; // Custom selected voice
const MAX_TEXT_LENGTH = 5000;

interface ElevenLabsOptions {
  voiceId?: string;
  modelId?: string;
}

export interface NarrationWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

interface TimestampResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

/**
 * Convert character-level timestamps from ElevenLabs to word-level NarrationWord[]
 */
export function characterTimestampsToWords(
  alignment: TimestampResponse["alignment"],
): NarrationWord[] {
  const words: NarrationWord[] = [];
  let currentWord = "";
  let wordStart = -1;
  let wordEnd = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i]!;
    const charStart = alignment.character_start_times_seconds[i]!;
    const charEnd = alignment.character_end_times_seconds[i]!;

    if (char === " " || char === "\n" || char === "\t") {
      if (currentWord.length > 0) {
        words.push({ word: currentWord, start: wordStart, end: wordEnd });
        currentWord = "";
        wordStart = -1;
      }
    } else {
      if (wordStart === -1) {
        wordStart = charStart;
      }
      currentWord += char;
      wordEnd = charEnd;
    }
  }

  // Push last word
  if (currentWord.length > 0) {
    words.push({ word: currentWord, start: wordStart, end: wordEnd });
  }

  return words;
}

function getApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  return apiKey;
}

function validateText(text: string): string {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
  }
  return text.trim();
}

function getVoiceId(options: ElevenLabsOptions): string {
  return options.voiceId || process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
}

/**
 * Synthesize text to speech using ElevenLabs API.
 * Returns MP3 audio buffer.
 */
export async function synthesizeSpeech(
  text: string,
  options: ElevenLabsOptions = {},
): Promise<Buffer> {
  const apiKey = getApiKey();
  const trimmedText = validateText(text);
  const voiceId = getVoiceId(options);
  const modelId = options.modelId || "eleven_multilingual_v2";

  const url = `${ELEVENLABS_API_URL}/${voiceId}`;

  const { data: response, error } = await tryCatch(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: trimmedText,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }),
  );

  if (error) {
    throw new Error(`ElevenLabs API request failed: ${error.message}`);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`ElevenLabs API returned ${response.status}: ${errorBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Synthesize text to speech with word-level timestamps.
 * Returns MP3 audio buffer and NarrationWord[] alignment data.
 */
export async function synthesizeSpeechWithTimestamps(
  text: string,
  options: ElevenLabsOptions = {},
): Promise<{ audio: Buffer; words: NarrationWord[]; audioDurationSeconds: number }> {
  const apiKey = getApiKey();
  const trimmedText = validateText(text);
  const voiceId = getVoiceId(options);
  const modelId = options.modelId || "eleven_multilingual_v2";

  const url = `${ELEVENLABS_API_URL}/${voiceId}/with-timestamps`;

  const { data: response, error } = await tryCatch(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: trimmedText,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }),
  );

  if (error) {
    throw new Error(`ElevenLabs API request failed: ${error.message}`);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`ElevenLabs API returned ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as TimestampResponse;

  const audioBuffer = Buffer.from(data.audio_base64, "base64");
  const words = characterTimestampsToWords(data.alignment);

  // Audio duration is the end time of the last character
  const endTimes = data.alignment.character_end_times_seconds;
  const audioDurationSeconds = endTimes.length > 0 ? endTimes[endTimes.length - 1]! : 0;

  return { audio: audioBuffer, words, audioDurationSeconds };
}

export { MAX_TEXT_LENGTH };
