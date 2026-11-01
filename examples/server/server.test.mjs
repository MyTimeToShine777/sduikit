// End-to-end check of the main promise: change a page on the server and the next request from
// an app returns the change, with no new app release and no server restart.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createExampleServer } from "./server.mjs";

let server;
let base;

before(async () => {
  server = createExampleServer();
  await new Promise((resolve) => server.listen(0, resolve)); // port 0 = any free port
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const allWidgets = "text:1,image:1,button:1,spacer:1,divider:1,section_header:1,card:1,banner:1,carousel:1,list:1,grid:1,tabs:1";
const inNovember = "now=2026-11-15T12:00:00Z";
const newApp = `appVersion=1.2.0&country=AE&widgets=${allWidgets}&${inNovember}`;

async function fetchJson(path, options) {
  const response = await fetch(base + path, options);
  return { status: response.status, body: await response.json() };
}
const get = (path) => fetchJson(path);
const save = (path, document) =>
  fetchJson(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(document) });
const widgetIds = (page) => page.sections.flatMap((section) => section.widgets.map((widget) => widget.id));

describe("example server", () => {
  it("serves the app setup", async () => {
    const { status, body } = await get(`/manifest?${newApp}`);
    assert.equal(status, 200);
    assert.equal(body.navigation.bottomBar[0].label, "Home");
  });

  it("gives a new app the whole home page", async () => {
    const { body } = await get(`/pages/home?${newApp}`);
    assert.ok(widgetIds(body).includes("w_banner_1"));
    assert.ok(widgetIds(body).includes("w_tabs_1"));
  });

  it("gives an app in another country a page without the UAE-only banner", async () => {
    const { body } = await get(`/pages/home?appVersion=1.2.0&country=IN&widgets=${allWidgets}&${inNovember}`);
    assert.ok(!widgetIds(body).includes("w_banner_1"));
    assert.ok(widgetIds(body).includes("w_button_1"));
  });

  it("gives an old app only what it can draw, using the fallback for the banner", async () => {
    const { body } = await get(`/pages/home?appVersion=1.2.0&country=AE&widgets=text:1,button:1&${inNovember}`);
    const ids = widgetIds(body);
    assert.ok(ids.includes("w_banner_1_fallback"));
    assert.ok(!ids.includes("w_carousel_1"));
    assert.ok(ids.includes("w_button_1"));
  });

  it("serves a screen", async () => {
    const { status, body } = await get(`/screens/offers?${newApp}`);
    assert.equal(status, 200);
    assert.equal(body.root.block, "scroll");
  });

  it("returns 404 for a page that does not exist", async () => {
    const { status, body } = await get(`/pages/nope?${newApp}`);
    assert.equal(status, 404);
    assert.match(body.message, /no page called "nope"/);
  });

  it("shows a change right away after staff save it (no release, no restart)", async () => {
    const before = (await get(`/pages/home?${newApp}`)).body;
    const edited = structuredClone(before);
    edited.revision = "2026-11-02.1";
    edited.sections[0].widgets[0].data.title = "Winter offers are here";

    const saved = await save("/admin/pages/home", edited);
    assert.equal(saved.status, 200);

    const after = (await get(`/pages/home?${newApp}`)).body;
    assert.equal(after.revision, "2026-11-02.1");
    assert.equal(after.sections[0].widgets[0].data.title, "Winter offers are here");
  });

  it("refuses to save a broken page and keeps the old one", async () => {
    const current = (await get(`/pages/home?${newApp}`)).body;
    const broken = structuredClone(current);
    delete broken.sections[0].widgets[0].data.imageUrl;

    const saved = await save("/admin/pages/home", broken);
    assert.equal(saved.status, 422);
    assert.equal(saved.body.errors[0].path, "sections[0].widgets[0].data.imageUrl");

    const stillThere = (await get(`/pages/home?${newApp}`)).body;
    assert.equal(stillThere.revision, "2026-11-02.1");
  });

  it("refuses a body that is not JSON", async () => {
    const response = await fetch(`${base}/admin/pages/home`, { method: "PUT", body: "not json" });
    assert.equal(response.status, 400);
  });
});
