import { getStore } from "@netlify/blobs";
import { createApi } from "../server/core.mjs";

// All data lives in Netlify Blobs (built-in storage, no separate database needed).
const blobs = getStore({ name: "classroom", consistency: "strong" });

const store = {
  get: (key) => blobs.get(key, { type: "json" }),
  set: (key, value) => blobs.setJSON(key, value),
  list: async (prefix) => {
    const { blobs: items } = await blobs.list({ prefix });
    return items.map((b) => b.key);
  }
};

const api = createApi({ store, env: process.env });

export default async (req) => api(req);

export const config = { path: "/api/*" };
