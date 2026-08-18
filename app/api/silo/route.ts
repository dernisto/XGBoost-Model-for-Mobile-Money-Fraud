import { NextResponse } from "next/server";

type SiloStatus = "LOW LEVEL" | "NORMAL" | "HIGH LEVEL" | "OFFLINE";

type SiloResponse = {
  weight: number;
  percentage: number;
  minThreshold: number;
  maxThreshold: number;
  consumptionRate: number;
  daysOfSupply: number;
  status: SiloStatus;
  timestamp: string;
};

const PINS = ["V0", "V1", "V2", "V3", "V4", "V5"];

function offlinePayload(timestamp = new Date().toISOString()): SiloResponse {
  return {
    weight: 0,
    percentage: 0,
    minThreshold: 0,
    maxThreshold: 0,
    consumptionRate: 0,
    daysOfSupply: 0,
    status: "OFFLINE",
    timestamp,
  };
}

function parseNumericPin(raw: unknown, pin: string): number {
  if (raw === null || raw === undefined || raw === "") {
    throw new Error(`Missing datastream: ${pin}`);
  }

  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num)) {
    throw new Error(`Malformed datastream value: ${pin}`);
  }

  return num;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Blynk request failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    const text = (await response.text()).trim();
    if (text === "true") {
      return true;
    }
    if (text === "false") {
      return false;
    }

    throw new Error("Malformed Blynk response");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET() {
  const token = process.env.BLYNK_AUTH_TOKEN;
  const server = process.env.BLYNK_SERVER || "blynk.cloud";
  const timestamp = new Date().toISOString();

  if (!token) {
    return NextResponse.json(
      {
        ...offlinePayload(timestamp),
        error: "Blynk connection unavailable",
        reason: "Missing BLYNK_AUTH_TOKEN environment variable",
      },
      { status: 500 },
    );
  }

  const baseUrl = `https://${server}/external/api`;
  const queryPins = PINS.map((pin) => `&${pin}`).join("");
  const getUrl = `${baseUrl}/get?token=${encodeURIComponent(token)}${queryPins}`;
  const connectedUrl = `${baseUrl}/isHardwareConnected?token=${encodeURIComponent(token)}`;

  try {
    const [pinPayload, connectedPayload] = await Promise.all([
      fetchJson(getUrl),
      fetchJson(connectedUrl),
    ]);

    if (!pinPayload || typeof pinPayload !== "object") {
      throw new Error("Malformed Blynk payload object");
    }

    const values = pinPayload as Record<string, unknown>;

    const weight = parseNumericPin(values.v0, "V0");
    const percentage = parseNumericPin(values.v1, "V1");
    const minThreshold = parseNumericPin(values.v2, "V2");
    const maxThreshold = parseNumericPin(values.v3, "V3");
    const consumptionRate = parseNumericPin(values.v4, "V4");
    const daysOfSupply = parseNumericPin(values.v5, "V5");

    const isConnected = typeof connectedPayload === "boolean" ? connectedPayload : false;

    let status: SiloStatus;
    if (!isConnected) {
      status = "OFFLINE";
    } else if (weight < minThreshold) {
      status = "LOW LEVEL";
    } else if (weight < maxThreshold) {
      status = "NORMAL";
    } else {
      status = "HIGH LEVEL";
    }

    const result: SiloResponse = {
      weight,
      percentage,
      minThreshold,
      maxThreshold,
      consumptionRate,
      daysOfSupply,
      status,
      timestamp,
    };

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        ...offlinePayload(timestamp),
        error: "Blynk connection unavailable",
      },
      { status: 503 },
    );
  }
}
