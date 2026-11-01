// A small example server. It hands each app only what that app can draw and may show, and it has
// the routes a dashboard needs: list, draft, publish, history and rollback.
//
// What apps call:       GET  /manifest, /pages/:id, /screens/:id, /data/:name
// What the dashboard calls (all under /admin, and they need the staff token if one is set):
//   GET  /admin/pages                      list pages (and /admin/screens)
//   GET  /admin/pages/:id                  { live, draft } for one page
//   PUT  /admin/pages/:id                  save and publish at once
//   PUT  /admin/drafts/pages/:id           save a draft (apps do not see it)
//   POST /admin/publish/pages/:id          make the draft live
//   GET  /admin/history/pages/:id          the versions that were replaced
//   POST /admin/rollback/pages/:id?revision=...   put an earlier version back
// The same routes exist for "screens".
//
// Options (all optional):
//   adminToken  staff sign-in. When set, every /admin route needs  Authorization: Bearer <token>.
//   dataFile    path of a JSON file. When set, pages are loaded from it at start and saved to it
//               after every change, so nothing is lost when the server restarts.
// A real server would use its own database and its own staff login instead of these two.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { filterForClient, validate } from "sduikit";

const fixturesFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "valid");
const readFixture = (name) => JSON.parse(readFileSync(join(fixturesFolder, name), "utf8"));

// Sample rows for the data_list widget. A real server would query its database here.
const rowsByCity = {
  Dubai: [
    { id: 7, name: "Dr Rao", specialty: "Dentist", fee: 150, photoUrl: "https://example.com/rao.jpg" },
    { id: 8, name: "Dr Khan", specialty: "Cardiologist", fee: 300 },
  ],
  "Abu Dhabi": [{ id: 9, name: "Dr Li", specialty: "Dermatologist", fee: 220, photoUrl: "https://example.com/li.jpg" }],
};
const dataSources = {
  doctors_nearby: (query) => rowsByCity[query.get("city")] ?? [],
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
const KINDS = ["pages", "screens"];
const mapsToObject = (maps) => Object.fromEntries(KINDS.map((kind) => [kind, Object.fromEntries(maps[kind])]));
const objectToMaps = (objects = {}) => Object.fromEntries(KINDS.map((kind) => [kind, new Map(Object.entries(objects[kind] ?? {}))]));

export function createExampleServer({ adminToken, dataFile } = {}) {
  const manifest = readFixture("manifest.json");

  // Start from the saved file if there is one, otherwise from the sample files.
  const saved = dataFile && existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, "utf8")) : null;
  const live = saved
    ? objectToMaps(saved.live)
    : {
        pages: new Map([["home", readFixture("page-home.json")], ["showcase", readFixture("page-showcase.json")]]),
        screens: new Map([["offers", readFixture("screen-offers.json")]]),
      };
  const drafts = objectToMaps(saved?.drafts);
  const history = objectToMaps(saved?.history); // id -> [{ document, replacedAt }]

  // Writes everything to the data file (to a temporary file first, so a crash cannot leave half a file).
  function persist() {
    if (!dataFile) return;
    const temporary = `${dataFile}.tmp`;
    writeFileSync(temporary, JSON.stringify({ live: mapsToObject(live), drafts: mapsToObject(drafts), history: mapsToObject(history) }));
    renameSync(temporary, dataFile);
  }

  // Makes `document` the live version and remembers the one it replaces, so it can be restored.
  function publish(kind, id, document) {
    const previous = live[kind].get(id);
    if (previous) {
      const older = history[kind].get(id) ?? [];
      older.push({ document: previous, replacedAt: new Date().toISOString() });
      history[kind].set(id, older);
    }
    live[kind].set(id, document);
    persist();
  }

  // Reads the request body and checks it. Returns the document, or sends the error and returns null.
  async function readValidDocument(request, response, id) {
    let document;
    try {
      document = await readJsonBody(request);
    } catch {
      sendJson(response, 400, { message: "The request body is not valid JSON." });
      return null;
    }
    if (document?.id !== id) {
      sendJson(response, 400, { message: `The id inside the document ("${document?.id}") does not match the address ("${id}").` });
      return null;
    }
    const result = validate(document);
    if (!result.valid) {
      sendJson(response, 422, { message: "This was not saved because it has problems.", errors: result.errors });
      return null;
    }
    return document;
  }

  const summary = (document, kind, id) => ({
    id,
    revision: document?.revision ?? null,
    title: document?.title ?? null,
    isLive: live[kind].has(id),
    hasDraft: drafts[kind].has(id),
  });

  async function handleAdmin(request, response, url, parts) {
    if (adminToken && request.headers.authorization !== `Bearer ${adminToken}`) {
      return sendJson(response, 401, { message: "Please sign in as staff to use this." });
    }
    const [, first, second, third] = parts;

    // /admin/<kind> and /admin/<kind>/<id>
    if (isKind(first)) {
      const kind = first;
      const id = second;
      if (request.method === "GET" && !id) {
        const ids = new Set([...live[kind].keys(), ...drafts[kind].keys()]);
        return sendJson(response, 200, [...ids].sort().map((each) => summary(drafts[kind].get(each) ?? live[kind].get(each), kind, each)));
      }
      if (request.method === "GET") {
        return sendJson(response, 200, { live: live[kind].get(id) ?? null, draft: drafts[kind].get(id) ?? null });
      }
      if (request.method === "PUT" && id) {
        const document = await readValidDocument(request, response, id);
        if (!document) return;
        publish(kind, id, document);
        return sendJson(response, 200, { ok: true, revision: document.revision });
      }
      return sendJson(response, 404, { message: "Nothing here." });
    }

    // /admin/<action>/<kind>/<id>
    const action = first;
    const kind = second;
    const id = third;
    if (!isKind(kind) || !id) return sendJson(response, 404, { message: "Nothing here." });

    if (action === "drafts" && request.method === "PUT") {
      const document = await readValidDocument(request, response, id);
      if (!document) return;
      drafts[kind].set(id, document);
      persist();
      return sendJson(response, 200, { ok: true, revision: document.revision });
    }
    if (action === "drafts" && request.method === "GET") {
      const draft = drafts[kind].get(id);
      return draft ? sendJson(response, 200, draft) : sendJson(response, 404, { message: "There is no draft." });
    }
    if (action === "drafts" && request.method === "DELETE") {
      drafts[kind].delete(id);
      persist();
      return sendJson(response, 200, { ok: true });
    }
    if (action === "publish" && request.method === "POST") {
      const draft = drafts[kind].get(id);
      if (!draft) return sendJson(response, 409, { message: "There is no draft to publish." });
      drafts[kind].delete(id);
      publish(kind, id, draft);
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
    // Lets a dashboard running on another address (for example localhost:3000) call this server.
    response.setHeader("access-control-allow-origin", "*");
    // Allow whatever extra headers the dashboard sends (many dashboards add their own to every request).
    response.setHeader("access-control-allow-headers", request.headers["access-control-request-headers"] ?? "content-type, authorization");
    response.setHeader("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      return response.end();
    }
    handle(request, response).catch((error) => sendJson(response, 500, { message: error.message }));
  });
}

// `node server.mjs` starts it on port 3000. Set ADMIN_TOKEN to require staff sign-in and DATA_FILE to keep changes.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  const options = { adminToken: process.env.ADMIN_TOKEN, dataFile: process.env.DATA_FILE };
  createExampleServer(options).listen(port, () => {
    console.log(`Example server on http://localhost:${port}`);
    console.log(options.adminToken ? "Staff sign-in is ON (Authorization: Bearer <ADMIN_TOKEN>)." : "Staff sign-in is OFF (set ADMIN_TOKEN to turn it on).");
    console.log(options.dataFile ? `Saving changes to ${options.dataFile}` : "Changes are kept in memory only (set DATA_FILE to keep them).");
  });
}
