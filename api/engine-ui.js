/* =========================================================
   ENGINE UI ADAPTER
   Purpose: Interpret core engine output for UI/widgets
   Platform: Vercel Serverless (Node 18)
========================================================= */

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TARGETS_DB = process.env.NOTION_TARGETS_DB;

if (!NOTION_TOKEN || !TARGETS_DB) {
  throw new Error("Missing NOTION_TOKEN or NOTION_TARGETS_DB");
}

/* =========================
   CACHE
========================= */
let CACHE = {
  timestamp: 0,
  data: null
};

const CACHE_TTL = 10 * 1000; // 10 seconds

/* =========================
   FETCH CORE ENGINE
========================= */

async function fetchEngine() {
  const res = await fetch(
    `${process.env.VERCEL_URL
      ? "https://" + process.env.VERCEL_URL
      : "http://localhost:3000"
    }/api/engine`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch core engine");
  }

  return res.json();
}

/* =========================
   FETCH TARGETS
========================= */

async function fetchTargets() {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${TARGETS_DB}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      }
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch targets DB");
  }

  const data = await res.json();

  let weeklyTarget = 0;
  let monthlyTarget = 0;

  data.results.forEach(page => {
    const type = page.properties["Target Type"]?.select?.name;
    const value = page.properties["Target"]?.number || 0;

    if (type === "Weekly") weeklyTarget = value;
    if (type === "Monthly") monthlyTarget = value;
  });

  return { weeklyTarget, monthlyTarget };
}

/* =========================
   MAIN HANDLER
========================= */

export default async function handler(req, res) {
  try {
    // Serve cache if fresh
    if (Date.now() - CACHE.timestamp < CACHE_TTL && CACHE.data) {
      return res.status(200).json(CACHE.data);
    }

    /* -------- CORE DATA -------- */
    const engine = await fetchEngine();

    /* -------- TARGETS -------- */
    const { weeklyTarget, monthlyTarget } = await fetchTargets();

    /* -------- HAS-TRADES FLAGS -------- */
    engine.daily.hasTrades = engine.daily.trades > 0;
    engine.weekly.hasTrades = engine.weekly.trades > 0;
    engine.monthly.hasTrades = engine.monthly.trades > 0;

    /* -------- ATTACH TARGETS -------- */
    engine.weekly.target = weeklyTarget;
    engine.weekly.progress =
      weeklyTarget > 0 ? engine.weekly.pl / weeklyTarget : 0;

    engine.monthly.target = monthlyTarget;
    engine.monthly.progress =
      monthlyTarget > 0 ? engine.monthly.pl / monthlyTarget : 0;

    /* -------- SYSTEM STATUS -------- */
    let systemStatus = "INACTIVE";

    if (engine.weekly.hasTrades) {
      systemStatus = "ACTIVE";
    } else if (engine.monthly.hasTrades) {
      systemStatus = "IDLE";
    }

    const output = {
      ...engine,
      status: {
        system: systemStatus
      }
    };

    /* -------- CACHE & RESPOND -------- */
    CACHE = {
      timestamp: Date.now(),
      data: output
    };

    res.status(200).json(output);

  } catch (err) {
    res.status(500).json({
      error: "ENGINE_UI_FAILURE",
      message: err.message
    });
  }
}
