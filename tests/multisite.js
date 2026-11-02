// Multi-site network (BGP) tests, no dependencies: node tests/multisite.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = f => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8");
const code = ["i18n.js", "schema.js", "engine.js"].map(src).join("\n") +
  "\n;globalThis.E = { makePreset, runChecks, genSummary, setOutLang, genBgpNode, genBgpDiag, bgpNormalize, msSites, msAddSite, msPairPreset," +
  " msResetIps, siteWans, linkDial, linkAutoReset, pairWhyNot };";
const ctx = { console, require }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
const E = ctx.E, sec = { psk: "test-psk-0123456789", bgp: "pw" };
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.error("KO " + msg); } };

// n sites, 2 lines each (the second one an LTE line); o: { topo, hubMode, bgpType, sw, mode, names, plan, pool }
function mk(n, o) {
  const m = E.makePreset("ms", "it"), g = m.bgpAdv;
  Object.assign(g, { topo: o.topo || "hub", hubMode: o.hubMode || "dial", bgpType: o.bgpType || "ibgp", keepalive: "10", holdtime: "30" });
  g.sdwan.on = !!o.sw; g.sdwan.mode = o.mode || "zone";
  if (o.names) g.names = o.names;
  if (o.plan) g.ipPlan = o.plan;
  if (o.pool) g.pool = o.pool;
  g.nodes = g.nodes.slice(0, 1); g.nodes[0].dyn = false; E.bgpNormalize(m);
  while (E.msSites(m).length < n) E.msAddSite(m, "it");
  g.nodes.forEach((x, i) => {
    x.dyn = !!(o.dyn && i === n - 1); x.pubIp = x.dyn ? "" : "203.0.113." + (30 + i);
    x.xwans = [{ if: "wan2", addr: "198.51.100." + (30 + i), dyn: false, type: "lte", cost: "50", code: "", seg: "" }];
  });
  E.bgpNormalize(m);
  return m;
}
const errors = m => E.runChecks(m, sec, "it").filter(c => c.lvl === "err").map(c => c.msg);
const steady = m => { const before = JSON.stringify(m); return !E.bgpNormalize(m) && JSON.stringify(m) === before; };
const out = m => E.msSites(m).map(x => E.genBgpNode(m, x.id, sec)).join("\n");

for (const lang of ["it", "en"]) {
  E.setOutLang(lang);
  const cases = [
    ["hub dial iBGP", mk(3, { dyn: true })],
    ["hub per spoke iBGP", mk(4, { hubMode: "per" })],
    ["mesh eBGP", mk(4, { topo: "mesh", bgpType: "ebgp" })],
    ["SD-WAN zone hub", mk(3, { sw: true })],
    ["SD-WAN zone mesh", mk(4, { topo: "mesh", bgpType: "ebgp", sw: true })],
    ["IPsec aggregate mesh", mk(4, { topo: "mesh", bgpType: "ebgp", sw: true, mode: "agg", names: "code" })],
    ["IPsec aggregate hub", mk(3, { sw: true, mode: "agg" })],
    ["aggregate per-site plan", mk(4, { topo: "mesh", bgpType: "ebgp", sw: true, mode: "agg", names: "code", plan: "site", pool: "10.255.0.0/16" })],
  ];
  for (const [name, m] of cases) {
    const t = lang + " " + name + ": ";
    ok(!errors(m).length, t + "check errors: " + errors(m).join(" | "));
    ok(steady(m), t + "the model is not stable after normalize");
    const o = out(m);
    ok(!/<[a-z-]+>/.test(o), t + "placeholder left in the output " + (o.match(/<[a-z-]+>/g) || []).join(" "));
    ok(o.includes("config router bgp"), t + "BGP missing");
    E.genSummary(m, lang); E.genBgpDiag(m, lang);
  }
}
E.setOutLang("it");

// IPsec aggregate: members without IP, one BGP session per site pair, zone with intrazone allow
{
  const m = mk(3, { topo: "mesh", bgpType: "ebgp", sw: true, mode: "agg", names: "code" }), L = m.bgpAdv.links;
  const pairs = L.filter(l => l.agg === "pair"), mems = L.filter(l => l.agg === "mem");
  ok(pairs.length === 3 && mems.length === 12, "aggregate: 3 aggregates and 12 members expected, got " + pairs.length + "/" + mems.length);
  ok(mems.every(l => !l.aIp && !l.bIp && !E.linkDial(m, l)), "aggregate: members must have no IP and no dial-up");
  const o = E.genBgpNode(m, m.bgpAdv.nodes[0].id, sec);
  ok(/set aggregate-member enable/.test(o) && /config system ipsec-aggregate/.test(o) && /set intrazone allow/.test(o), "aggregate: CLI blocks missing");
  ok((o.match(/set remote-as/g) || []).length === 2, "aggregate: one BGP neighbor per other site expected");
}

// code names: site code + line code, aggregate site-site
{
  const m = mk(2, { topo: "mesh", bgpType: "ebgp", sw: true, mode: "agg", names: "code" });
  m.bgpAdv.nodes[0].name = "Milano"; m.bgpAdv.nodes[1].name = "Roma"; E.bgpNormalize(m);
  const names = m.bgpAdv.links.map(l => l.aIf);
  ok(names.includes("MIL-ROM") && names.includes("MILW-ROML"), "code names: got " + names.join(" "));
}

// per-site addressing: tunnel between site i and site j in /24 number i, router IDs in /24 zero
{
  const m = mk(4, { topo: "mesh", bgpType: "ebgp", sw: true, mode: "agg", names: "code", plan: "site", pool: "10.255.0.0/16" });
  E.msResetIps(m);
  const S = E.msSites(m), pair = (a, b) => m.bgpAdv.links.find(l => l.agg === "pair" && [l.a, l.b].sort().join() === [S[a].id, S[b].id].sort().join());
  const p23 = pair(1, 2), ip = (l, n) => l.a === n.id ? l.aIp : l.bIp;
  ok(ip(p23, S[1]) === "10.255.2.5" && ip(p23, S[2]) === "10.255.2.6", "per-site plan: site 2 ⇄ 3 got " + ip(p23, S[1]) + " / " + ip(p23, S[2]));
  ok(S[2].rid === "10.255.0.3", "per-site plan: router ID of site 3 got " + S[2].rid);
}

// private lines meet only on the same network
{
  const a = { dyn: false, type: "mpls", seg: "MPLS1" }, b = { dyn: false, type: "mpls", seg: "MPLS2" }, c = { dyn: false, type: "inet", seg: "" };
  ok(E.pairWhyNot(a, b, false) === "seg" && E.pairWhyNot(a, c, false) === "mpls" && E.pairWhyNot(a, Object.assign({}, a), false) === "", "private lines pairing");
}

// quick pair choices never leave two sites without a tunnel
for (const k of ["all", "type", "slot", "nolte"]) {
  const m = mk(3, { hubMode: "per", sw: true });
  E.msPairPreset(m, k);
  ok(!errors(m).length, "pair preset " + k + ": " + errors(m).join(" | "));
}

// automatic values: a hand-typed name comes back after the reset
{
  const m = mk(2, { topo: "mesh", bgpType: "ebgp", sw: true, mode: "agg", names: "code" }), l = m.bgpAdv.links.find(x => x.agg === "pair"), auto = l.aIf;
  l.aIf = "HAND"; E.bgpNormalize(m); ok(l.aIf === "HAND", "a hand-typed name must stay");
  E.linkAutoReset(m, l); E.bgpNormalize(m); ok(l.aIf === auto && !!l.aIp, "reset to automatic values");
}

console.log(fails ? `${fails} tests failed` : "All tests passed");
process.exit(fails ? 1 : 0);
