import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

/* ================= CONFIG ================= */

const TRADES_DB = process.env.NOTION_DATABASE_ID;

/* ================= DATE HELPERS ================= */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay() || 7; // Monday = 1
  x.setDate(x.getDate() - day + 1);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/* ================= AGGREGATION ================= */

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
  };
}

/* ================= HANDLER ================= */

export default async function handler(req, res) {
  try {
    const now = new Date();

    const tradesRes = await notion.databases.query({
      database_id: TRADES_DB,
    });

    const trades = tradesRes.results.map(p => {
      const pl = p.properties["Net P&L"]?.number ?? 0;
      const date = new Date(
        p.properties["Date"]?.date?.start
      );
      return { pl, date };
    });

    const dailyTrades = trades.filter(
      t => t.date >= startOfDay(now)
    );

    const weeklyTrades = trades.filter(
      t => t.date >= startOfWeek(now)
    );

    const monthlyTrades = trades.filter(
      t => t.date >= startOfMonth(now)
    );

    res.status(200).json({
      daily: summarize(dailyTrades),
      weekly: summarize(weeklyTrades),
      monthly: summarize(monthlyTrades),
    });

  } catch (err) {
    res.status(500).json({
      error: "ENGINE_FAILURE",
      message: err.message,
    });
  }
}
