import logger from "@/lib/logger";

interface EventParams {
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * Sends a server-side event to Google Analytics 4 via the Measurement Protocol.
 *
 * Requires GA_MEASUREMENT_ID and GA_API_SECRET environment variables.
 *
 * @param clientId - The anonymous client ID or fallback.
 * @param userId - The user ID, if known.
 * @param eventName - The name of the event to track.
 * @param params - Additional parameters for the event.
 */
export async function trackServerEvent(
  clientId: string,
  userId: string | undefined,
  eventName: string,
  params: EventParams = {},
): Promise<void> {
  const measurementId = process.env.GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;

  if (!measurementId || !apiSecret) {
    if (process.env.NODE_ENV === "development") {
      logger.debug("GA_MEASUREMENT_ID or GA_API_SECRET is missing. Skipping GA event tracking.", {
        eventName,
      });
    }
    return;
  }

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  // Filter out undefined and null values
  const cleanParams: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (typeof value === "string") {
        // GA limits string parameters to 100 characters usually, but we'll try to truncate error messages if needed.
        cleanParams[key] = value.length > 500 ? value.substring(0, 500) + "..." : value;
      } else {
        cleanParams[key] = value;
      }
    }
  }

  const payload = {
    client_id: clientId,
    ...(userId ? { user_id: userId } : {}),
    events: [
      {
        name: eventName,
        params: cleanParams,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to send GA event", {
        status: response.status,
        errorText,
        eventName,
      });
    }
  } catch (error) {
    logger.error("Error sending GA event", { error, eventName });
  }
}
