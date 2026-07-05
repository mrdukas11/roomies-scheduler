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
      if (body.clearResponses) state.responses = {};
    } else {
      return new Response("Bad request", { status: 400 });
    }

    await store.setJSON("state", state);
    return Response.json(state, { headers: { "cache-control": "no-store" } });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/data" };
