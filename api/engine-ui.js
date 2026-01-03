/* =========================================================
   ENGINE UI ADAPTER
   Purpose:
   - Reads core engine output
   - Derives UI-ready fields
   - Keeps core engine untouched
========================================================= */

export default async function handler(req, res) {
  try {
    /* -----------------------------------------
       SAFELY CALL CORE ENGINE (VERCEL-SAFE)
    ----------------------------------------- */
    const engineURL = new URL(
      "/api/engine",
      `http://${req.headers.host}`
    );

    const engineRes = await fetch(engineURL);

    if (!engineRes.ok) {
      throw new Error("Failed to fetch core engine");
    }

    const engine = await engineRes.json();

    /* -----------------------------------------
       EXTRACT CORE DATA
       (from YOUR working engine)
    ----------------------------------------- */
    const daily = engine.daily;
    const weekly = engine.weekly;
    const monthly = engine.monthly;

    /* -----------------------------------------
       DERIVED FLAGS (UI ONLY)
    ----------------------------------------- */

    const hasWeeklyTrades = weekly.trades > 0;
    const hasMonthlyTrades = monthly.trades > 0;

    let systemStatus = "INACTIVE";

    if (hasWeeklyTrades) {
      systemStatus = "ACTIVE";
    } else if (hasMonthlyTrades) {
      systemStatus = "IDLE";
    }

    /* -----------------------------------------
       FINAL UI JSON (STABLE CONTRACT)
    ----------------------------------------- */
    const ui = {
      status: systemStatus,

      weekly: {
        pl: weekly.pl,
        trades: weekly.trades,
        wins: weekly.wins,
        losses: weekly.losses,
        winrate: weekly.winrate,
        hasTrades: hasWeeklyTrades
      },

      monthly: {
        pl: monthly.pl,
        trades: monthly.trades,
        wins: monthly.wins,
        losses: monthly.losses,
        winrate: monthly.winrate,
        hasTrades: hasMonthlyTrades
      }
    };

    res.status(200).json(ui);

  } catch (err) {
    res.status(500).json({
      error: "ENGINE_UI_FAILURE",
      message: err.message
    });
  }
}
