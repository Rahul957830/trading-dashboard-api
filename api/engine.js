/* =========================
   REAL-TIME TRADING ENGINE
   Vercel Serverless Function
========================= */

// Node 18+ (Vercel) has global fetch — NO imports needed

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// Basic safety check
if (!NOTION_TOKEN || !DATABASE_ID) {
  throw new Error("Missing NOTION_TOKEN or NOTION_DATABASE_ID");
}

// Simple in-memory cache (reduces Notion API calls)
let CACHE = {
  timestamp: 0,
  data: null
};
const CACHE_TTL = 60 * 1000; // 60 seconds

/* =========================
   DATE HELPERS
========================= */

function normalizeDate(dateStr) {
  if (!dateStr) return null;

  const d = new Date(dateStr);
  if (isNaN(d)) return null;

  // Normalize to local midnight (ignore time)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
}

function isSameWeek(date, ref) {
  return getWeekStart(date).toDateString() === getWeekStart(ref).toDateString();
}

function isSameMonth(date, ref) {
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth()
  );
}

/* =========================
   FETCH JOURNAL FROM NOTION
========================= */

async function fetchAllTrades() {
  let results = [];
  let cursor = undefined;

  do {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          cursor ? { start_cursor: cursor } : {}
        )
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Notion API error: ${res.status} ${errText}`);
    }

    const data = await res.json();

    results = results.concat(data.results);
    cursor = data.has_more ? data.next_cursor : null;

  } while (cursor);

  // Map only what engine needs
  return results.map(page => ({
    tradeDate: page.properties["Date"]?.date?.start || null,
    pnl: page.properties["Net P&L"]?.number ?? 0
  }));
}

/* =========================
   CORE ENGINE LOGIC
========================= */

function calculateStats(trades) {
  const today = new Date();

  const daily = { pl: 0, trades: 0, wins: 0, losses: 0 };
  const weekly = { pl: 0, trades: 0, wins: 0, losses: 0 };
  const monthly = { pl: 0, trades: 0, wins: 0, losses: 0 };

  trades.forEach(t => {
    const tradeDate = normalizeDate(t.tradeDate);
    if (!tradeDate) return;

    const pnl = Number(t.pnl);
    if (isNaN(pnl)) return;

    if (isSameDay(tradeDate, today)) {
      daily.pl += pnl;
      daily.trades++;
      if (pnl > 0) daily.wins++;
      if (pnl < 0) daily.losses++;
    }

    if (isSameWeek(tradeDate, today)) {
      weekly.pl += pnl;
      weekly.trades++;
      if (pnl > 0) weekly.wins++;
      if (pnl < 0) weekly.losses++;
    }

    if (isSameMonth(tradeDate, today)) {
      monthly.pl += pnl;
      monthly.trades++;
      if (pnl > 0) monthly.wins++;
      if (pnl < 0) monthly.losses++;
    }
  });

  const winrate = (w, l) =>
    w + l === 0 ? 0 : Math.round((w / (w + l)) * 100);

  return {
    daily: {
      pl: daily.pl,
      trades: daily.trades,
      wins: daily.wins,
      losses: daily.losses,
      winrate: winrate(daily.wins, daily.losses)
    },
    weekly: {
      pl: weekly.pl,
      trades: weekly.trades,
      wins: weekly.wins,
      losses: weekly.losses,
      winrate: winrate(weekly.wins, weekly.losses)
    },
    monthly: {
      pl: monthly.pl,
      trades: monthly.trades,
      wins: monthly.wins,
      losses: monthly.losses,
      winrate: winrate(monthly.wins, monthly.losses)
    }
  };
}

/* =========================
   API ENTRY POINT
========================= */

export default async function handler(req, res) {
  try {
    // Serve from cache if fresh
    if (Date.now() - CACHE.timestamp < CACHE_TTL && CACHE.data) {
      return res.status(200).json(CACHE.data);
    }

    const trades = await fetchAllTrades();
    const output = calculateStats(trades);

    CACHE = {
      timestamp: Date.now(),
      data: output
    };

    res.status(200).json(output);

  } catch (err) {
    res.status(500).json({
      error: "Engine error",
      message: err.message
    });
  }
}
