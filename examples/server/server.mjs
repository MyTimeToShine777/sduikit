// A small example server. It keeps pages in memory and hands each app only what that app can
// draw and may show. Real servers would read pages from a database instead.
//
// What apps call:       GET  /manifest, /pages/:id, /screens/:id, /data/:name
// What the dashboard calls:
//   PUT  /admin/pages/:id            save and publish at once
//   PUT  /admin/drafts/pages/:id     save a draft (apps do not see it)
//   GET  /admin/drafts/pages/:id     read the draft
//   POST /admin/publish/pages/:id    make the draft live
//   GET  /admin/history/pages/:id    list the versions that were replaced
//   POST /admin/rollback/pages/:id?revision=...   put an earlier version back
// (The same routes exist for "screens".)
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { filterForClient, validate } from "sduikit";

const fixturesFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "valid");
const readFixture = (name) => JSON.parse(readFileSync(join(fixturesFolder, name), "utf8"));

// Sample rows for the data_list widget. A real server would query its database here.
const doctorsByCity = {
  Dubai: [
    { id: 7, name: "Dr Rao", specialty: "Dentist", fee: 150, photoUrl: "https://example.com/rao.jpg" },
    { id: 8, name: "Dr Khan", specialty: "Cardiologist", fee: 300 },
  ],
  "Abu Dhabi": [{ id: 9, name: "Dr Li", specialty: "Dermatologist", fee: 220, photoUrl: "https://example.com/li.jpg" }],
};
const dataSources = {
  doctors_nearby: (query) => doctorsByCity[query.get("city")] ?? [],
};

// "text:1,banner:1,banner:2" -> { text: [1], banner: [1, 2] }
function parseSupportedWidgets(text) {
  const supported = {};
  for (const entry of (text ?? "").split(",").filter(Boolean)) {
    const [type, version] = entry.split(":");
    (supported[type] ??= []).push(Number(version));
  }
  return supported;
}

// The app describes itself in the query string, for example:
// /pages/home?appVersion=1.2.0&country=AE&widgets=text:1,banner:1
function clientFromQuery(query) {
  return {
    appVersion: query.get("appVersion") ?? "0.0.0",
    country: query.get("country") ?? undefined,
    supportedWidgets: parseSupportedWidgets(query.get("widgets")),
    // `now` is only here so the tests do not depend on today's date.
    now: query.get("now") ? new Date(query.get("now")) : undefined,
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const isKind = (word) => word === "pages" || word === "screens";

export function createExampleServer() {
  const manifest = readFixture("manifest.json");
  const live = { pages: new Map([["home", readFixture("page-home.json")]]), screens: new Map([["offers", readFixture("screen-offers.json")]]) };
  const drafts = { pages: new Map(), screens: new Map() };
  const history = { pages: new Map(), screens: new Map() }; // id -> [{ document, replacedAt }]

  // Makes `document` the live version and remembers the one it replaces, so it can be restored.
  function publish(kind, id, document) {
    const previous = live[kind].get(id);
    if (previous) {
      const older = history[kind].get(id) ?? [];
      older.push({ document: previous, replacedAt: new Date().toISOString() });
      history[kind].set(id, older);
    }
    live[kind].set(id, document);
  }

  // Reads the request body and checks it. Returns the document, or sends the error and returns null.
  async function readValidDocument(request, response) {
    let document;
    try {
      document = await readJsonBody(request);
    } catch {
      sendJson(response, 400, { message: "The request body is not valid JSON." });
      return null;
    }
    const result = validate(document);
    if (!result.valid) {
      sendJson(response, 422, { message: "This was not saved because it has problems.", errors: result.errors });
      return null;
    }
    return document;
  }

  async function handleAdmin(request, response, url, parts) {
    const [, action, kind, id] = parts; // /admin/<action>/<kind>/<id>, or /admin/<kind>/<id>

    // Save and publish at once.
    if (request.method === "PUT" && isKind(action)) {
      const document = await readValidDocument(request, response);
      if (!document) return;
      publish(action, kind, document);
      return sendJson(response, 200, { ok: true, revision: document.revision });
    }
    if (!isKind(kind)) return sendJson(response, 404, { message: "Nothing here." });

    if (action === "drafts" && request.method === "PUT") {
      const document = await readValidDocument(request, response);
      if (!document) return;
      drafts[kind].set(id, document);
      return sendJson(response, 200, { ok: true, revision: document.revision });
    }
    if (action === "drafts" && request.method === "GET") {
      const draft = drafts[kind].get(id);
      return draft ? sendJson(response, 200, draft) : sendJson(response, 404, { message: "There is no draft." });
    }
    if (action === "publish" && request.method === "POST") {
      const draft = drafts[kind].get(id);
      if (!draft) return sendJson(response, 409, { message: "There is no draft to publish." });
      publish(kind, id, draft);
      drafts[kind].delete(id);
      return sendJson(response, 200, { ok: true, revision: draft.revision });
    }
    if (action === "history" && request.method === "GET") {
      const versions = (history[kind].get(id) ?? []).map(({ document, replacedAt }) => ({ revision: document.revision, replacedAt }));
      return sendJson(response, 200, versions);
    }
    if (action === "rollback" && request.method === "POST") {
      const revision = url.searchParams.get("revision");
      const found = [...(history[kind].get(id) ?? [])].reverse().find((entry) => entry.document.revision === revision);
      if (!found) return sendJson(response, 404, { message: `There is no earlier version with revision "${revision}".` });
      publish(kind, id, found.document); // the version being replaced goes into the history too
      return sendJson(response, 200, { ok: true, revision });
    }
    return sendJson(response, 404, { message: "Nothing here." });
  }

  async function handle(request, response) {
    const url = new URL(request.url, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean); // "/pages/home" -> ["pages", "home"]

    if (parts[0] === "admin") return handleAdmin(request, response, url, parts);

    if (request.method === "GET" && parts[0] === "manifest") {
      return sendJson(response, 200, filterForClient(manifest, clientFromQuery(url.searchParams)));
    }
    if (request.method === "GET" && isKind(parts[0])) {
      const document = live[parts[0]].get(parts[1]);
      if (!document) return sendJson(response, 404, { message: `There is no ${parts[0].slice(0, -1)} called "${parts[1]}".` });
      return sendJson(response, 200, filterForClient(document, clientFromQuery(url.searchParams)));
    }
    if (request.method === "GET" && parts[0] === "data") {
      const source = dataSources[parts[1]];
      if (!source) return sendJson(response, 404, { message: `There is no data called "${parts[1]}".` });
      return sendJson(response, 200, source(url.searchParams));
    }
    return sendJson(response, 404, { message: "Nothing here." });
  }

  return createServer((request, response) => {
    handle(request, response).catch((error) => sendJson(response, 500, { message: error.message }));
  });
}

// `node server.mjs` starts it on port 3000.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  createExampleServer().listen(port, () => console.log(`Example server on http://localhost:${port}`));
}
