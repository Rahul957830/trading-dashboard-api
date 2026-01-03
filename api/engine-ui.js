/* =========================================================
   ENGINE UI ADAPTER (SAFE + DEFENSIVE)
   Reads from:
   - Core Engine (/api/engine)
   - Targets DB (Notion)
========================================================= */

import { Client } from "@notionhq/client";

/* ================= ENV ================= */

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TARGETS_DB = process.env.NOTION_TARGETS_DB;
const ENGINE_URL = process.env.ENGINE_URL || "https://trading-dashboard-api-five.vercel.app/api/engine";

if (!NOTION_TOKEN || !TARGETS_DB) {
  throw new Error("Missing NOTION_TOKEN or NOTION_TARGETS_DB");
}

const notion = new Client({ auth: NOTION_TOKEN });

/* ================= HELPERS ================= */

/** Safely extract select / status / text */
function extractType(prop) {
  if (!prop) return null;

  if (prop.type === "select") {
    return prop.select?.name ?? null;
  }

  if (prop.type === "status") {
    return prop.status?.name ?? null;
  }

  if (prop.type === "rich_text") {
    return prop.rich_text?.[0]?.plain_text ?? null;
  }

  return null;
}

function extractNumber(prop) {
  if (!prop) return null;

  if (prop.type === "number") {
    return Number(prop.number);
  }

  if (prop.type === "formula") {
    return Number(prop.formula?.number);
  }

  return null;
}

/* ================= FETCH TARGETS ================= */

async function fetchTargets() {
  const res = await notion.databases.query({
    database_id: TARGETS_DB
  });

  let weekly = null;
  let monthly = null;

  res.results.forEach(page => {
    const typeProp = page.properties["Target Type"];
    const valueProp = page.properties["Target"];

    const type = extractType(typeProp);
    const value = extractNumber(valueProp);

    if (!type || value == null) return;

    if (type === "Weekly") weekly = value;
    if (type === "Monthly") monthly = value;
  });

  return { weekly, monthly };
}

/* ================= MAIN HANDLER ================= */

export default async function handler(req, res) {
  try {
    /* ---- Fetch core engine ---- */
    const engineRes = await fetch(ENGINE_URL, { cache: "no-store" });

    if (!engineRes.ok) {
      throw new Error("Failed to fetch core engine");
    }

    const core = await engineRes.json();

    /* ---- Fetch targets ---- */
    const targets = await fetchTargets();

    /* ---- Attach targets + progress ---- */
    if (targets.weekly != null) {
      core.weekly.target = targets.weekly;
      core.weekly.progress =
        targets.weekly > 0 ? core.weekly.pl / targets.weekly : 0;
    } else {
      core.weekly.target = null;
      core.weekly.progress = null;
    }

    if (targets.monthly != null) {
      core.monthly.target = targets.monthly;
      core.monthly.progress =
        targets.monthly > 0 ? core.monthly.pl / targets.monthly : 0;
    } else {
      core.monthly.target = null;
      core.monthly.progress = null;
    }

    /* ---- System status ---- */
    const status =
      core.weekly.hasTrades ? "ACTIVE" :
      core.monthly.hasTrades ? "IDLE" :
      "INACTIVE";

    res.status(200).json({
      status,
      daily: core.daily,
      weekly: core.weekly,
      monthly: core.monthly
    });

  } catch (err) {
    res.status(500).json({
      error: "ENGINE_UI_FAILURE",
      message: err.message
    });
  }
}
