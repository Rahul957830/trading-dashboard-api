import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

const TARGETS_DB = process.env.NOTION_TARGETS_DB;

export default async function handler(req, res) {
  try {
    /* -------------------------------
       FETCH CORE ENGINE (UNCHANGED)
    -------------------------------- */
    const coreRes = await fetch(
      "https://trading-dashboard-api-five.vercel.app/api/engine",
      { cache: "no-store" }
    );

    if (!coreRes.ok) {
      throw new Error("Failed to fetch core engine");
    }

    const core = await coreRes.json();
    const { daily, weekly, monthly } = core;

    /* -------------------------------
       STATUS RULE (LOCKED)
    -------------------------------- */
    let status = "INACTIVE";
    if (weekly.trades > 0) status = "ACTIVE";
    else if (monthly.trades > 0) status = "IDLE";

    /* -------------------------------
       HAS-TRADES FLAGS (PRESERVED)
    -------------------------------- */
    daily.hasTrades = daily.trades > 0;
    weekly.hasTrades = weekly.trades > 0;
    monthly.hasTrades = monthly.trades > 0;

    /* -------------------------------
       FETCH TARGETS (NEW – SAFE)
    -------------------------------- */
    let weeklyTarget = null;
    let monthlyTarget = null;

    if (TARGETS_DB) {
      const targetsRes = await notion.databases.query({
        database_id: TARGETS_DB
      });

      targetsRes.results.forEach(p => {
        const type = p.properties["Target Type"]?.select?.name;
        const value = p.properties["Target"]?.number ?? null;

        if (type === "Weekly") weeklyTarget = value;
        if (type === "Monthly") monthlyTarget = value;
      });
    }

    /* -------------------------------
       ATTACH TARGET + PROGRESS
    -------------------------------- */
    weekly.target = weeklyTarget;
    weekly.progress =
      weeklyTarget && weeklyTarget > 0
        ? Number((weekly.pl / weeklyTarget).toFixed(2))
        : null;

    monthly.target = monthlyTarget;
    monthly.progress =
      monthlyTarget && monthlyTarget > 0
        ? Number((monthly.pl / monthlyTarget).toFixed(2))
        : null;

    /* -------------------------------
       FINAL JSON
    -------------------------------- */
    res.status(200).json({
      status,
      daily,
      weekly,
      monthly
    });

  } catch (err) {
    res.status(500).json({
      error: "ENGINE_UI_FAILURE",
      message: err.message
    });
  }
}
