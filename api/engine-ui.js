/* =========================================================
   ENGINE UI ADAPTER (DERIVED VIEW)
========================================================= */

export default async function handler(req, res) {
  try {
    /* -------- FETCH CORE ENGINE -------- */

    const engineURL = new URL(
      "/api/engine",
      `http://${req.headers.host}`
    );

    const engineRes = await fetch(engineURL);
    if (!engineRes.ok) {
      throw new Error("Failed to fetch core engine");
    }

    const engine = await engineRes.json();

    const { daily, weekly, monthly } = engine;

    /* -------- STATUS LOGIC -------- */

    let status = "INACTIVE";

    if (weekly.trades > 0) {
      status = "ACTIVE";
    } else if (monthly.trades > 0) {
      status = "IDLE";
    }

    /* -------- TARGETS (SAFE DEFAULTS) -------- */

    const weeklyTarget = weekly.target ?? null;
    const monthlyTarget = monthly.target ?? null;

    const weeklyProgress =
      weeklyTarget && weeklyTarget > 0
        ? weekly.pl / weeklyTarget
        : null;

    const monthlyProgress =
      monthlyTarget && monthlyTarget > 0
        ? monthly.pl / monthlyTarget
        : null;

    /* -------- FINAL UI JSON -------- */

    res.status(200).json({
      status,

      daily: {
        ...daily,
        hasTrades: daily.trades > 0
      },

      weekly: {
        ...weekly,
        hasTrades: weekly.trades > 0,
        target: weeklyTarget,
        progress: weeklyProgress
      },

      monthly: {
        ...monthly,
        hasTrades: monthly.trades > 0,
        target: monthlyTarget,
        progress: monthlyProgress
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "ENGINE_UI_FAILURE",
      message: err.message
    });
  }
}
