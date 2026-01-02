import { Client } from "@notionhq/client";

/* ================= INIT ================= */

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

const TRADES_DB  = process.env.NOTION_DATABASE_ID;   // your trades DB
const TARGETS_DB = process.env.NOTION_TARGETS_DB;    // targets DB

/* ================= DATE HELPERS ================= */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay() || 7; // Monday start
  x.setDate(x.getDate() - day + 1);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/* ================= NOTION NUMBER READER ================= */

function readNumber(prop) {
  if (!prop) return 0;

  if (prop.type === "number") {
    return prop.number ?? 0;
  }

  if (prop.type === "formula") {
    return prop.formula.number ?? 0;
  }

  if (prop.type === "rollup") {
    return prop.rollup.number ?? 0;
  }

  return 0;
}

/* ================= SUMMARY ================= */

function summarize(trades) {
  let profit = 0;
  let wins = 0;
  let losses = 0;

  trades.forEach(t => {
    profit += t.pl;
    if (t.pl > 0) wins++;
    if (t.pl < 0) losses++;
  });

  const total = trades.length;

  return {
    profit,
    trades: total,
    wins,
    losses,
    winrate: total > 0 ? Math.round((wins / total) * 100) : 0,
    hasTrades: total > 0
  };
}

/* ================= API HANDLER ================= */

export default async function handler(req, res) {
  try {
    const now = new Date();

    /* -------- FETCH TRADES -------- */

    const tradesRes = await notion.databases.query({
      database_id: TRADES_DB
    });

    const trades = tradesRes.results
      .map(p => {
        const pl = readNumber(p.properties["Net P&L"]);

        const dateStr = p.properties["Date"]?.date?.start;
        if (!dateStr) return null;

        return {
          pl,
          date: new Date(dateStr)
        };
      })
      .filter(Boolean);

    /* -------- SPLIT PERIODS -------- */

    const dailyTrades = trades.filter(
      t => t.date >= startOfDay(now)
    );

    const weeklyTrades = trades.filter(
      t => t.date >= startOfWeek(now)
    );

    const monthlyTrades = trades.filter(
      t => t.date >= startOfMonth(now)
    );

    const daily   = summarize(dailyTrades);
    const weekly  = summarize(weeklyTrades);
    const monthly = summarize(monthlyTrades);

    /* -------- FETCH TARGETS -------- */

    let weeklyTarget = 0;
    let monthlyTarget = 0;

    if (TARGETS_DB) {
      const targetsRes = await notion.databases.query({
        database_id: TARGETS_DB
      });

      targetsRes.results.forEach(p => {
        const type =
          p.properties["Target Type"]?.select?.name;

        const value =
          p.properties["Target"]?.number ?? 0;

        if (type === "Weekly") weeklyTarget = value;
        if (type === "Monthly") monthlyTarget = value;
      });
    }

    /* -------- ATTACH TARGETS -------- */

    weekly.target = weeklyTarget;
    weekly.progress =
      weeklyTarget > 0 ? weekly.profit / weeklyTarget : 0;

    monthly.target = monthlyTarget;
    monthly.progress =
      monthlyTarget > 0 ? monthly.profit / monthlyTarget : 0;

    /* -------- RESPONSE -------- */

    res.status(200).json({
      daily,
      weekly,
      monthly
    });

  } catch (err) {
    res.status(500).json({
      error: "ENGINE_FAILURE",
      message: err.message
    });
  }
}
