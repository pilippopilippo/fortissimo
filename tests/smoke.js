// Quick engine test with no dependencies: node tests/smoke.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = f => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8");
const code = ["i18n.js", "schema.js", "engine.js"].map(src).join("\n") +
  "\n;globalThis.E = { PRESETS, makePreset, genFortiGate, genXml, genGuide, guideText, genDiag, genSummary, runChecks, setOutLang, msSites, genBgpNode, genBgpDiag };";
const ctx = { console, require }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
const E = ctx.E, sec = { psk: "test-psk-0123456789" };
let fails = 0;
for (const lang of ["it", "en"]) for (const fos of ["7.2", "7.4", "7.6"]) for (const id of E.PRESETS) {
  try {
    E.setOutLang(lang);
    const m = E.makePreset(id, lang); m.fos = fos;
    // the SAML preset leaves tenant data empty: fill it with dummy values
    if (id === "fct-saml") Object.assign(m.dial, { tenant: "00000000-0000-4000-8000-000000000001", groupId: "00000000-0000-4000-8000-000000000002" });
    // multi-site network: 7.4 and 7.6 only, one configuration per site
    if (m.scenario === "ms") {
      const errs = E.runChecks(m, sec, lang).filter(c => c.lvl === "err");
      if (fos === "7.2") { if (!errs.length) throw new Error("7.2 should be refused"); continue; }
      E.msSites(m).forEach(n => { if (!E.genBgpNode(m, n.id, sec).includes("config router bgp")) throw new Error("BGP missing on " + n.name); });
      E.genBgpDiag(m, lang); E.genSummary(m, lang);
      if (errs.length) throw new Error("check errors: " + errs.map(e => e.msg).join(" | "));
      continue;
    }
    const a = E.genFortiGate(m, "a", sec);
    if (!a.includes("config vpn ipsec phase1-interface")) throw new Error("phase1 missing");
    if (m.scenario === "dialup") { E.genXml(m, sec); E.guideText(E.genGuide(m, lang), m, lang); }
    else E.genFortiGate(m, "b", sec);
    E.genDiag(m, "a", lang); E.genSummary(m, lang);
    const errs = E.runChecks(m, sec, lang).filter(c => c.lvl === "err");
    if (errs.length && id !== "custom") throw new Error("check errors: " + errs.map(e => e.msg).join(" | "));
  } catch (e) { fails++; console.error(`KO ${lang} ${fos} ${id}: ${e.message}`); }
}
console.log(fails ? `${fails} tests failed` : "All tests passed");
process.exit(fails ? 1 : 0);
