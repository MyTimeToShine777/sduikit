// End-to-end check of the main promise: change a page on the server and the next request from
// an app returns the change, with no new app release and no server restart.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const allWidgets =
  "text:1,image:1,button:1,spacer:1,divider:1,section_header:1,card:1,banner:1,carousel:1,list:1,grid:1,tabs:1,data_list:1";
const inNovember = "now=2026-11-15T12:00:00Z";
const newApp = `appVersion=1.2.0&country=AE&widgets=${allWidgets}&${inNovember}`;

async function fetchJson(path, options) {
  const response = await fetch(base + path, options);
  return { status: response.status, body: await response.json() };
}
const get = (path) => fetchJson(path);
const save = (path, document) =>
  fetchJson(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(document) });
const post = (path) => fetchJson(path, { method: "POST" });
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

describe("the showcase page", () => {
  const newWidgets =
    "rich_text:1,quote:1,icon:1,avatar:1,badge:1,alert:1,progress:1,stat:1,key_value:1,list_item:1,empty_state:1,steps:1,accordion:1,table:1,countdown:1,gallery:1,video_card:1,hero:1,pricing_card:1,search_bar:1,chips:1,quick_actions:1,rating:1,container:1,form:1";

  it("gives an up-to-date app the whole page, including the form and the hero", async () => {
    const page = (await get(`/pages/showcase?appVersion=1.0.0&country=AE&widgets=${allWidgets},${newWidgets}`)).body;
    assert.ok(widgetIds(page).includes("s_form"));
    assert.ok(widgetIds(page).includes("s_hero"));
    assert.ok(widgetIds(page).includes("s_price"));
  });

  it("gives an app that only knows a few widgets just those, without the form or hero", async () => {
    const page = (await get(`/pages/showcase?appVersion=1.0.0&country=AE&widgets=badge:1,container:1`)).body;
    assert.deepEqual(widgetIds(page), ["s_badge", "s_container"]);
  });
});

describe("live data", () => {
  it("gives the page a data_list that an up-to-date app can draw, and leaves it out for an old app", async () => {
    const newer = (await get(`/pages/home?${newApp}`)).body;
    assert.ok(widgetIds(newer).includes("w_doctors_1"));
    const older = (await get(`/pages/home?appVersion=1.2.0&country=AE&widgets=text:1,button:1&${inNovember}`)).body;
    assert.ok(!widgetIds(older).includes("w_doctors_1"));
  });

  it("serves the rows the data_list asks for", async () => {
    const { status, body } = await get("/data/doctors_nearby?city=Dubai");
    assert.equal(status, 200);
    assert.deepEqual(body.map((doctor) => doctor.name), ["Dr Rao", "Dr Khan"]);
  });

  it("gives an empty list for a city with no doctors, and 404 for data that does not exist", async () => {
    assert.deepEqual((await get("/data/doctors_nearby?city=Nowhere")).body, []);
    assert.equal((await get("/data/pharmacies")).status, 404);
  });
});

describe("drafts, publishing and going back", () => {
  const titleBlock = (screen) => screen.root.children[0].children[0];
  const liveScreen = async () => (await get(`/screens/offers?${newApp}`)).body;

  it("keeps a draft away from apps until it is published", async () => {
    const original = await liveScreen();
    const draft = structuredClone(original);
    draft.revision = "2026-11-02.2";
    titleBlock(draft).text = "Draft title";

    assert.equal((await save("/admin/drafts/screens/offers", draft)).status, 200);
    assert.equal(titleBlock(await liveScreen()).text, "This month's offers"); // apps still see the old one
    assert.equal((await get("/admin/drafts/screens/offers")).body.revision, "2026-11-02.2"); // staff can read it back

    assert.equal((await post("/admin/publish/screens/offers")).status, 200);
    assert.equal(titleBlock(await liveScreen()).text, "Draft title");
    assert.equal((await get("/admin/drafts/screens/offers")).status, 404); // the draft was used up
  });

  it("refuses to publish when there is no draft", async () => {
    assert.equal((await post("/admin/publish/screens/offers")).status, 409);
  });

  it("refuses a broken draft", async () => {
    const draft = structuredClone(await liveScreen());
    draft.root = { block: "nope" };
    const saved = await save("/admin/drafts/screens/offers", draft);
    assert.equal(saved.status, 422);
  });

  it("lists replaced versions and can put an earlier one back", async () => {
    const history = (await get("/admin/history/screens/offers")).body;
    assert.deepEqual(history.map((entry) => entry.revision), ["2026-11-01.1"]);

    assert.equal((await post("/admin/rollback/screens/offers?revision=2026-11-01.1")).status, 200);
    const restored = await liveScreen();
    assert.equal(restored.revision, "2026-11-01.1");
    assert.equal(titleBlock(restored).text, "This month's offers");

    // The version that was just replaced can be restored too.
    const after = (await get("/admin/history/screens/offers")).body;
    assert.deepEqual(after.map((entry) => entry.revision), ["2026-11-01.1", "2026-11-02.2"]);
  });

  it("says so when the version to go back to does not exist", async () => {
    const { status, body } = await post("/admin/rollback/screens/offers?revision=1999");
    assert.equal(status, 404);
    assert.match(body.message, /no earlier version/);
  });
});

describe("what a dashboard needs", () => {
  it("lists pages with their state, and returns the live page and the draft together", async () => {
    const { status, body } = await get("/admin/screens");
    assert.equal(status, 200);
    const offers = body.find((entry) => entry.id === "offers");
    assert.equal(offers.isLive, true);
    assert.equal(typeof offers.revision, "string");

    const both = (await get("/admin/screens/offers")).body;
    assert.equal(both.live.id, "offers");
    assert.equal(both.draft, null);
    assert.deepEqual((await get("/admin/screens/nothing")).body, { live: null, draft: null });
  });

  it("lets staff create a brand-new page as a draft, and shows it in the list", async () => {
    const draft = { schema: 1, id: "faq", revision: "1", title: "FAQ", sections: [{ id: "s", widgets: [] }] };
    assert.equal((await save("/admin/drafts/pages/faq", draft)).status, 200);

    const entry = (await get("/admin/pages")).body.find((each) => each.id === "faq");
    assert.deepEqual({ isLive: entry.isLive, hasDraft: entry.hasDraft }, { isLive: false, hasDraft: true });
    assert.equal((await get("/pages/faq?appVersion=1.0.0")).status, 404); // apps cannot see it yet

    assert.equal((await post("/admin/publish/pages/faq")).status, 200);
    assert.equal((await get("/pages/faq?appVersion=1.0.0")).status, 200);
  });

  it("refuses a document whose id does not match the address", async () => {
    const draft = { schema: 1, id: "other", revision: "1", sections: [] };
    const saved = await save("/admin/drafts/pages/faq", draft);
    assert.equal(saved.status, 400);
    assert.match(saved.body.message, /does not match/);
  });

  it("can throw a draft away", async () => {
    const draft = { schema: 1, id: "temp", revision: "1", sections: [] };
    await save("/admin/drafts/pages/temp", draft);
    assert.equal((await fetchJson("/admin/drafts/pages/temp", { method: "DELETE" })).status, 200);
    assert.equal((await get("/admin/drafts/pages/temp")).status, 404);
  });

  it("answers the browser's permission check so a dashboard on another address can call it", async () => {
    const response = await fetch(`${base}/admin/pages`, { method: "OPTIONS" });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("access-control-allow-methods"), /PUT/);
  });
});

describe("staff sign-in and saved changes", () => {
  it("refuses staff routes without the token and allows them with it, while apps are not affected", async () => {
    const locked = createExampleServer({ adminToken: "secret" });
    await new Promise((resolve) => locked.listen(0, resolve));
    const where = `http://localhost:${locked.address().port}`;
    try {
      assert.equal((await fetch(`${where}/admin/pages`)).status, 401);
      assert.equal((await fetch(`${where}/admin/pages`, { headers: { authorization: "Bearer wrong" } })).status, 401);
      assert.equal((await fetch(`${where}/admin/pages`, { headers: { authorization: "Bearer secret" } })).status, 200);
      assert.equal((await fetch(`${where}/pages/home?appVersion=1.0.0`)).status, 200); // apps need no token
    } finally {
      locked.close();
    }
  });

  it("keeps pages, drafts and history after a restart when given a data file", async () => {
    const folder = mkdtempSync(join(tmpdir(), "sduikit-server-"));
    const dataFile = join(folder, "data.json");
    const start = async () => {
      const instance = createExampleServer({ dataFile });
      await new Promise((resolve) => instance.listen(0, resolve));
      return { instance, where: `http://localhost:${instance.address().port}` };
    };
    const send = (where, path, method, body) =>
      fetch(where + path, { method, headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());

    let { instance, where } = await start();
    try {
      const home = (await fetch(`${where}/admin/pages/home`).then((r) => r.json())).live;
      await send(where, "/admin/pages/home", "PUT", { ...home, revision: "saved-1", title: "Saved title" });
      await send(where, "/admin/drafts/pages/home", "PUT", { ...home, revision: "draft-1" });
    } finally {
      instance.close();
    }

    ({ instance, where } = await start()); // a brand-new server using the same file
    try {
      const both = await fetch(`${where}/admin/pages/home`).then((r) => r.json());
      assert.equal(both.live.revision, "saved-1");
      assert.equal(both.draft.revision, "draft-1");
      const versions = await fetch(`${where}/admin/history/pages/home`).then((r) => r.json());
      assert.deepEqual(versions.map((entry) => entry.revision), ["2026-11-01.3"]);
    } finally {
      instance.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
