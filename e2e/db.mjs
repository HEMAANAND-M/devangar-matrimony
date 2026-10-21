import { execFileSync } from "node:child_process";
import fs from "node:fs";

/**
 * Direct SQL for test setup and assertions.
 * PSQL: psql binary (default: newest C:\Program Files\PostgreSQL\<version> on Windows, else "psql" on PATH).
 * E2E_DATABASE_URL: the local test database (never point this at production).
 */
function findPsql() {
  if (process.env.PSQL) return process.env.PSQL;
  if (process.platform !== "win32") return "psql";
  const root = "C:/Program Files/PostgreSQL";
  const found = fs.existsSync(root)
    ? fs.readdirSync(root).sort((a, b) => Number(b) - Number(a)).map((v) => `${root}/${v}/bin/psql.exe`).find((p) => fs.existsSync(p))
    : undefined;
  return found ?? "psql";
}

export const PSQL = findPsql();
export const DATABASE_URL = process.env.E2E_DATABASE_URL || "postgresql://postgres:devangar_local@localhost:5432/devangar_matrimony";

/** Runs one statement and returns its unaligned, tuples-only output, trimmed. */
export const sql = (query) => execFileSync(PSQL, ["-d", DATABASE_URL, "-tAc", query]).toString().trim();
