// A small example server. It keeps pages in memory and hands each app only what that app can
// draw and may show. Real servers would read pages from a database instead.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { filterForClient, validate } from "sduikit";

const fixturesFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "valid");
const readFixture = (name) => JSON.parse(readFileSync(join(fixturesFolder, name), "utf8"));

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

export function createExampleServer() {
  const manifest = readFixture("manifest.json");
  const pages = new Map([["home", readFixture("page-home.json")]]);
  const screens = new Map([["offers", readFixture("screen-offers.json")]]);

  async function handle(request, response) {
    const url = new URL(request.url, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean); // "/pages/home" -> ["pages", "home"]

    // What apps call
    if (request.method === "GET" && parts[0] === "manifest") {
      return sendJson(response, 200, filterForClient(manifest, clientFromQuery(url.searchParams)));
    }
    if (request.method === "GET" && (parts[0] === "pages" || parts[0] === "screens")) {
      const store = parts[0] === "pages" ? pages : screens;
      const document = store.get(parts[1]);
      if (!document) return sendJson(response, 404, { message: `There is no ${parts[0].slice(0, -1)} called "${parts[1]}".` });
      return sendJson(response, 200, filterForClient(document, clientFromQuery(url.searchParams)));
    }

    // What the dashboard calls: save a page or screen, but only if it is valid.
    if (request.method === "PUT" && parts[0] === "admin" && (parts[1] === "pages" || parts[1] === "screens")) {
      let document;
      try {
        document = await readJsonBody(request);
      } catch {
        return sendJson(response, 400, { message: "The request body is not valid JSON." });
      }
      const result = validate(document);
      if (!result.valid) return sendJson(response, 422, { message: "This was not saved because it has problems.", errors: result.errors });
      (parts[1] === "pages" ? pages : screens).set(parts[2], document);
      return sendJson(response, 200, { ok: true, revision: document.revision });
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
