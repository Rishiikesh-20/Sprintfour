import dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const config = {
  port: parseInt(process.env["PORT"] ?? "3001", 10),
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  dbPath: process.env["DB_PATH"] ?? "./data/conseal.db",
  geminiApiKey: process.env["GEMINI_API_KEY"] ?? "",

  // Confidence band thresholds — tune in one place
  confidence: {
    ambiguousLow: 0.4,
    ambiguousHigh: 0.7,
  },

  // Rapid-action heuristic — N actions within T ms triggers the nudge
  rapidAction: {
    windowMs: 2000,
    actionCount: 3,
  },

  // Risk proximity — name+high-risk within this many chars = both bump to high
  riskProximityChars: 200,
} as const;

export function isDev(): boolean {
  return config.nodeEnv === "development";
}
