import { getStore } from "@netlify/blobs";

const DEFAULT_STATE = {
  month: {
    book: "The Second Estate",
    author: "Ray D. Madoff",
    note: "7:30 pm Eastern \u00b7 4:30 pm Pacific",
    dates: [
      "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17",
      "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24",
      "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31",
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07",
    ],
    roster: ["Lodi", "Morgan", "Mark D", "Ben", "John", "Rock"],
  },
  responses: {},
};

export default async (req) => {
  const store = getStore("roomies-scheduler");

  const load = async () => {
    const saved = await store.get("state", { type: "json" });
    return saved ?? structuredClone(DEFAULT_STATE);
  };

  if (req.method === "GET") {
    return Response.json(await load(), {
      headers: { "cache-control": "no-store" },
    });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const state = await load();

    if (body.type === "response" && typeof body.name === "string") {
      // Only touch this one roomie's slice, so simultaneous saves
      // from different roomies never clobber each other.
      if (!state.month.roster.includes(body.name)) {
        return new Response("Unknown roomie", { status: 400 });
      }
      const statuses = {};
      const valid = new Set(state.month.dates);
      for (const [date, status] of Object.entries(body.statuses || {})) {
        if (valid.has(date) && ["good", "bad", "maybe"].includes(status)) {
          statuses[date] = status;
        }
      }
      state.responses[body.name] = {
        statuses,
        comment: String(body.comment || "").slice(0, 200),
        done: Boolean(body.done),
        updated: new Date().toISOString(),
      };
      // notify the organizer the moment the last roomie replies
      const allDone =
        state.month.roster.length > 0 &&
        state.month.roster.every((r) => state.responses[r] && state.responses[r].done);
      if (allDone && !state.completeNotified) {
        state.completeNotified = true;
        try { await notifyComplete(state); } catch (e) { console.error("notify failed", e); }
      } else if (!allDone) {
        state.completeNotified = false;
      }
    } else if (body.type === "setup" && body.month) {
      const m = body.month;
      state.month = {
        book: String(m.book || "").slice(0, 120),
        author: String(m.author || "").slice(0, 120),
        note: String(m.note || "").slice(0, 120),
        dates: Array.isArray(m.dates) ? m.dates.slice(0, 40) : [],
        roster: Array.isArray(m.roster) && m.roster.length
          ? m.roster.map((r) => String(r).slice(0, 40)).slice(0, 12)
          : state.month.roster,
      };
      if (body.clearResponses) {
        state.responses = {};
        state.completeNotified = false;
      }
    } else {
      return new Response("Bad request", { status: 400 });
    }

    await store.setJSON("state", state);
    return Response.json(state, { headers: { "cache-control": "no-store" } });
  }

  return new Response("Method not allowed", { status: 405 });
};

async function notifyComplete(state) {
  const { roster, dates, book } = state.month;
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const label = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return DOW[dt.getDay()] + " " + MON[dt.getMonth()] + " " + dt.getDate();
  };
  const statusOf = (r, d) =>
    state.responses[r] && state.responses[r].statuses[d];

  const worksForAll = dates.filter((d) => roster.every((r) => statusOf(r, d) === "good"));
  const clean = dates
    .map((d) => ({
      d,
      good: roster.filter((r) => statusOf(r, d) === "good").length,
      hasBad: roster.some((r) => statusOf(r, d) === "bad"),
    }))
    .filter((x) => !x.hasBad && x.good > 0)
    .sort((a, b) => b.good - a.good);

  let message = "All " + roster.length + " roomies have replied for \"" + book + "\".\n\n";
  if (worksForAll.length) {
    message += "Works for everyone: " + worksForAll.map(label).join(", ");
  } else if (clean.length) {
    message += "No date works for all. Best options (good votes, no objections): " +
      clean.slice(0, 5).map((x) => label(x.d) + " (" + x.good + " good)").join(", ");
  } else {
    message += "Every date has at least one objection - check the grid.";
  }

  // file a Netlify Forms submission; Netlify emails the organizer
  await fetch(process.env.URL + "/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ "form-name": "all-replied", book, message }).toString(),
  });
}

export const config = { path: "/api/data" };
