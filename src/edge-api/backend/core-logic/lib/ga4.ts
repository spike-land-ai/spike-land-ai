const GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const MAX_BATCH_SIZE = 25;
const MAX_STRING_LENGTH = 500;

export interface GA4Event {
  name: string;
  params: Record<string, string | number | boolean>;
}

function truncateString(value: string | number | boolean): string | number | boolean {
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    return value.slice(0, MAX_STRING_LENGTH);
  }
  return value;
}

export async function hashClientId(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sendGA4Events(
  measurementId: string,
  apiSecret: string,
  clientId: string,
  events: GA4Event[],
): Promise<void> {
  if (!measurementId || !apiSecret) {
    return;
  }

  const truncatedEvents = events.slice(0, MAX_BATCH_SIZE).map((event) => ({
    name: event.name,
    params: Object.fromEntries(
      Object.entries(event.params).map(([key, value]) => [key, truncateString(value)]),
    ),
  }));

  const url = `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      events: truncatedEvents,
    }),
  });
  if (!response.ok) {
    console.error(`[ga4] send failed: ${response.status} ${response.statusText}`);
  }
}
