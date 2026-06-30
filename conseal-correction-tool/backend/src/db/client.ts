import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config/env";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(config.dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  const schema = fs.readFileSync(
    path.join(__dirname, "schema.sql"),
    "utf-8"
  );
  _db.exec(schema);

  // Idempotent migration: add preloaded_detections column if it doesn't exist
  try {
    _db.exec("ALTER TABLE documents ADD COLUMN preloaded_detections TEXT");
  } catch {
    // Column already exists — safe to ignore
  }

  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
