/* =========================================================
   ENGINE UI ADAPTER
   Purpose:
   - Derive UI-friendly state from core engine
   - NEVER recalculates trades
   - ONLY interprets engine output
========================================================= */

export default async function handler(req, res) {
  try {
    /* -------------------------------
       FETCH CORE ENGINE
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
       STATUS RULE (FINAL, LOCKED)
    --------------------------------
       - DAILY never affects status
       - Weekly > Monthly > Inactive
    */
    let status = "INACTIVE";

    if (weekly.trades > 0) {
      status = "ACTIVE";
    } else if (monthly.trades > 0) {
      status = "IDLE";
    }

    /* -------------------------------
       ATTACH FLAGS
    -------------------------------- */
    daily.hasTrades = daily.trades > 0;
    weekly.hasTrades = weekly.trades > 0;
    monthly.hasTrades = monthly.trades > 0;

    /* -------------------------------
       TARGET & PROGRESS (SAFE)
    -------------------------------- */
    weekly.target ??= null;
    weekly.progress =
      weekly.target && weekly.target > 0
        ? Number((weekly.pl / weekly.target).toFixed(2))
        : null;

    monthly.target ??= null;
    monthly.progress =
      monthly.target && monthly.target > 0
        ? Number((monthly.pl / monthly.target).toFixed(2))
        : null;

    /* -------------------------------
       FINAL UI JSON
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
