/* =========================================================
   ENGINE UI ADAPTER
   Purpose:
   - Read core engine JSON
   - Derive UI-friendly status + progress
   - NEVER touch core engine logic
========================================================= */

export default async function handler(req, res) {
  try {
    /* =========================
       RESOLVE BASE URL (VERCEL SAFE)
    ========================= */
    const BASE_URL =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    /* =========================
       FETCH CORE ENGINE
    ========================= */
    const engineRes = await fetch(`${BASE_URL}/api/engine`);

    if (!engineRes.ok) {
      throw new Error("Failed to fetch core engine");
    }

    const engine = await engineRes.json();

    /* =========================
       DERIVE SYSTEM STATUS
       (UI ONLY — NOT ENGINE LOGIC)
    ========================= */
    let systemStatus = "INACTIVE";

    if (engine.weekly.trades > 0) {
      systemStatus = "ACTIVE";
    } else if (engine.monthly.trades > 0) {
      systemStatus = "IDLE";
    }

    /* =========================
       BUILD UI JSON (STABLE CONTRACT)
    ========================= */
    const uiPayload = {
      status: systemStatus,

      weekly: {
        profit: engine.weekly.pl,
        trades: engine.weekly.trades,
        wins: engine.weekly.wins,
        losses: engine.weekly.losses,
        winrate: engine.weekly.winrate,
        hasTrades: engine.weekly.trades > 0,

        // Targets intentionally 0 for now (future-proof)
        target: 0,
        progress: 0
      },

      monthly: {
        profit: engine.monthly.pl,
        trades: engine.monthly.trades,
        wins: engine.monthly.wins,
        losses: engine.monthly.losses,
        winrate: engine.monthly.winrate,
        hasTrades: engine.monthly.trades > 0,

        target: 0,
        progress: 0
      }
    };

    /* =========================
       RESPONSE
    ========================= */
    res.status(200).json(uiPayload);

  } catch (err) {
    res.status(500).json({
      error: "ENGINE_UI_FAILURE",
      message: err.message
    });
  }
}
