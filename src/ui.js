/* Fortissimo — interfaccia */
(function () {
"use strict";
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  kids.flat(Infinity).forEach(k => { if (k === null || k === undefined || k === false) return; e.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
  return e;
};

const ST_KEY = "fortissimo:state:v1", PR_KEY = "fortissimo:projects:v1";
const store = {
  get(k) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};

const S = { m: null, sec: { psk: "", ppk: "", bgp: "", ldap: "", radius: "" }, lang: "en", mode: "essential", view: "form", tab: "a", search: "", showPsk: false, checks: [] };
const T = k => (UI[S.lang] && UI[S.lang][k]) || UI.it[k] || k;
const H = k => (HELP[S.lang] && HELP[S.lang][k]) || HELP.it[k] || [k, "", ""];

/* ---------- percorsi nel modello ---------- */
function getP(p) {
  if (p.startsWith("adv.")) { const [, side, ...rest] = p.split("."); return (S.m.adv[side] || {})[rest.join(".")]; }
  return p.split(".").reduce((o, k) => (o == null ? o : o[k]), S.m);
}
function setP(p, v) {
  if (p.startsWith("adv.")) {
    const [, side, ...rest] = p.split("."); const k = rest.join(".");
    S.m.adv[side] = S.m.adv[side] || {};
    if (v === "" || v === null || v === undefined) delete S.m.adv[side][k]; else S.m.adv[side][k] = v;
    return;
  }
  const ks = p.split("."), last = ks.pop();
  const o = ks.reduce((o, k) => o[k], S.m); o[last] = v;
}
function presetRef() { return makePreset(S.m.preset || "s2s", S.lang); }
function refVal(p) {
  const r = presetRef();
  if (p.startsWith("adv.")) { const [, side, ...rest] = p.split("."); return (r.adv[side] || {})[rest.join(".")]; }
  return p.split(".").reduce((o, k) => (o == null ? o : o[k]), r);
}
const same = (a, b) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");

/* ---------- salvataggio ---------- */
function persist() { store.set(ST_KEY, { m: S.m, lang: S.lang, mode: S.mode, compact: S.compact }); }
function loadState() {
  const st = store.get(ST_KEY);
  if (st && st.m && st.m.v === 1) { S.m = upgradeModel(st.m); S.lang = st.lang || "en"; S.mode = st.mode || "essential"; S.compact = st.compact; }
  else { S.lang = "en"; S.m = makePreset("s2s", S.lang); }
  S.m.adv = S.m.adv || { a: {}, b: {} };
}

/* ---------- campo con aiuto ---------- */
let uid = 0;
function fieldBox(o) {
  // o: {p, ps, label, hint, why, cli, control, wide, changed, extra}
  const id = "f" + (++uid);
  const helpId = id + "h";
  const ctrl = o.control(id);
  const hasHelp = !!(o.why || o.cli || o.defTxt);
  const head = el("div", { class: "fld-head" },
    el("label", { for: o.noFor ? null : id, id: id + "l", text: o.label }),
    o.badge ? el("span", { class: "tag " + o.badge, text: T(o.badge) }) : null,
    o.changed ? el("span", { class: "dot", title: T("changed"), "aria-label": T("changed") }) : null,
    hasHelp ? el("button", { type: "button", class: "q", "aria-expanded": "false", "aria-controls": helpId, title: T("why"),
      onclick: e => { const b = e.currentTarget, h = document.getElementById(helpId); const open = b.getAttribute("aria-expanded") === "true"; b.setAttribute("aria-expanded", String(!open)); h.hidden = open; } }, "?") : null);
  const help = hasHelp ? el("div", { class: "help", id: helpId, hidden: true },
    o.why ? el("p", { text: o.why }) : null,
    o.cli ? el("p", { class: "cmd" }, el("span", { text: T("cliCmd") }), el("code", { text: o.cli })) : null,
    o.defTxt ? el("p", { class: "defs", text: o.defTxt }) : null) : null;
  const box = el("div", { class: "fld" + (o.wide ? " wide" : ""), "data-p": o.p || "", "data-ps": (o.ps || [o.p]).join(" "),
    "data-search": [o.label, o.hint, o.cli, o.why].filter(Boolean).join(" ").toLowerCase() },
    head, ctrl, o.hint ? el("p", { class: "hint", text: o.hint }) : null, help);
  return box;
}

function helpField(p, key, control, extra) {
  const [l, h, w, opt] = H(key);
  return fieldBox(Object.assign({ p, label: l, hint: h, why: w, control, badge: opt ? "optional" : null, changed: !same(getP(p), refVal(p)) }, extra || {}));
}
const textCtl = (p, opts) => id => el("input", Object.assign({ id, type: "text", value: getP(p) ?? "", "data-bind": p, spellcheck: "false", autocomplete: "off" }, opts || {}));
const areaCtl = (p) => id => el("textarea", { id, "data-bind": p, spellcheck: "false", rows: "3" }, String(getP(p) ?? ""));
const segCtl = (p, items, struct) => id => {
  const cur = getP(p);
  return el("div", { class: "seg", role: "radiogroup", "aria-labelledby": id + "l" },
    items.map(([v, label], i) => {
      const rid = id + "_" + i;
      return [el("input", { type: "radio", id: rid, name: id, value: v, checked: String(cur) === String(v), "data-bind": p, "data-struct": struct ? "1" : null }),
        el("label", { for: rid, text: label })];
    }));
};
const toggleCtl = (p, struct) => id => el("label", { class: "switch" },
  el("input", { type: "checkbox", id, checked: !!getP(p), "data-bind": p, "data-kind": "bool", "data-struct": struct ? "1" : null }),
  el("span", { text: T("on") }));
const checksCtl = (p, list, filter) => id => {
  const cur = getP(p) || [];
  return el("div", { class: "chips", role: "group", "aria-labelledby": id + "l", "data-group": p },
    list.filter(filter || (() => true)).map((x, i) => {
      const cid = id + "_" + i;
      return el("label", { class: "chip" + (x.b ? " " + x.b : ""), for: cid },
        el("input", { type: "checkbox", id: cid, value: x.v, checked: cur.includes(x.v), "data-bind": p, "data-kind": "list" }),
        el("span", { class: "v", text: x.v }), x.b ? el("span", { class: "tag " + x.b, text: T(x.b) }) : null);
    }));
};
function secretCtl(which) {
  return id => {
    const inp = el("input", { id, type: S.showPsk ? "text" : "password", value: S.sec[which] || "", "data-secret": which, spellcheck: "false", autocomplete: "new-password" });
    return el("div", { class: "secret" }, inp,
      el("button", { type: "button", class: "btn small", onclick: () => { S.showPsk = !S.showPsk; $$("input[data-secret]").forEach(i => i.type = S.showPsk ? "text" : "password"); } }, T("showPsk")),
      el("button", { type: "button", class: "btn small primary", onclick: () => { S.sec[which] = randomPsk(32); inp.value = S.sec[which]; inp.type = "text"; S.showPsk = true; refresh(); } }, T("genPsk")));
  };
}

/* ---------- opzione avanzata dallo schema ---------- */
function optSides(o) { return ((o.sides && o.sides[S.m.scenario]) || []).filter(s => optApplies(o, S.m, s)); }
function advField(o) {
  const sides = optSides(o); if (!sides.length) return null;
  const adv0 = S.m.adv[sides[0]] || {};
  if (!optDepOk(o, adv0)) return null;
  const p = "adv." + sides[0] + "." + o.k, ps = sides.map(s => "adv." + s + "." + o.k);
  const tx = o[S.lang] || o.it, cur = getP(p);
  const rec = o.rec ? o.rec(S.m.scenario, sides[0]) : null;
  const struct = OPTS.some(x => x.dep && x.dep[0] === o.k);
  let control;
  if (o.type === "enum") {
    control = id => el("select", { id, "data-bind": p, "data-adv": o.k, "data-struct": struct ? "1" : null },
      el("option", { value: "", selected: cur === undefined || cur === null || cur === "" }, T("fosDefault") + (o.def ? " = " + o.def : "")),
      o.vals.map(v => el("option", { value: v, selected: cur === v }, v + (v === o.def ? " (" + T("def") + ")" : "") + (v === rec ? " (" + T("rec") + ")" : ""))));
  } else {
    control = id => el("input", { id, type: "text", inputmode: o.type === "num" ? "numeric" : null, value: cur ?? "", placeholder: o.def ? T("def") + " " + o.def : "", "data-bind": p, "data-adv": o.k, spellcheck: "false" });
  }
  let label = tx[0];
  if (S.m.scenario === "s2sdyn" && sides.length === 1) label += " (" + T(sides[0] === "a" ? "outA_s2sdyn" : "outB_s2sdyn") + ")";
  const defTxt = (o.def ? T("def") + ": " + o.def : "") + (rec ? (o.def ? "  ·  " : "") + T("rec") + ": " + rec : "");
  return fieldBox({ p, ps, label, hint: tx[1], why: tx[2], cli: "set " + o.cli + " " + (o.vals ? o.vals.join(" | ") : "<" + (o.type === "num" ? (o.min + "–" + o.max) : "testo") + ">"),
    defTxt, control, changed: !same(cur, refVal(p)), badge: o.lvl === "essential" ? null : null });
}

/* ---------- sezioni del modulo ---------- */
function sideLabel(s) { return T((s === "a" ? "sideA_" : "sideB_") + S.m.scenario); }

function buildSections() {
  const m = S.m, sc = m.scenario, secs = [];
  // 1. scenario
  secs.push({ id: "scn", title: T("s_scn"), desc: T("s_scn_d"), paths: ["fos", "name"], fields: [
    helpField("name", "name", textCtl("name")),
    helpField("fos", "fos", id => el("select", { id, "data-bind": "fos" }, (sc === "ms" ? ["7.4", "7.6"] : ["7.2", "7.4", "7.6"]).map(v => el("option", { value: v, selected: m.fos === v }, "FortiOS " + v + (v === "7.2" ? " " + T("eosTag") : "")))))
  ]});
  if (sc === "ms") return msSections(m, secs);
  // 2. lati
  const sideFields = s => {
    const f = [el("h3", { class: "side-title " + s, text: sideLabel(s) })];
    f.push(helpField(s + ".label", "side.label", textCtl(s + ".label")));
    f.push(helpField(s + ".tunnel", "side.tunnel", textCtl(s + ".tunnel", { maxlength: "15" })));
    f.push(helpField(s + ".wan", "side.wan", textCtl(s + ".wan")));
    const dynBranch = sc === "s2sdyn" && s === "b";
    if (!dynBranch) {
      f.push(helpField(s + ".ip", "side.ip", textCtl(s + ".ip", { inputmode: "decimal" })));
      f.push(helpField(s + ".fqdn", "side.fqdn", textCtl(s + ".fqdn")));
    }
    f.push(helpField(s + ".nets", "side.nets", areaCtl(s + ".nets"), { wide: true }));
    if (sc === "s2s") f.push(helpField(s + ".tip", "side.tip", textCtl(s + ".tip", { inputmode: "decimal" })));
    return f;
  };
  const sidePaths = s => ["label", "tunnel", "wan", "ip", "fqdn", "nets", "tip"].map(k => s + "." + k);
  const sideSec = { id: "sides", title: T("s_sides"), desc: T("s_sides_d"), paths: [...sidePaths("a"), ...(DIAL(sc) ? [] : sidePaths("b")), "tunPrefix"], fields: [] };
  const siteCols = [];
  if (advOn(m)) {
    const tunList = nid => {
      const rows = bgpSessions(m, nid).filter(x => x.l.gen && !x.l.bothDyn).map(x => {
        const nm = x.dynHub ? x.l.aIf : x.l[x.me + "If"], ip = x.dynHub ? (bgpNode(m, nid) || {}).dialIp : x.l[x.me + "Ip"];
        return (nm || "—") + " → " + nodeName(m, x.peer) + " · " + (ip || "—") + (x.dynHub ? " (dial-up)" : "");
      });
      return [...new Set(rows)];
    };
    const tunBox = nid => {
      const nd = bgpNode(m, nid), all = bgpSessions(m, nid).filter(x => x.l.kind === "tunnel");
      if (!all.length) return null;
      const seenHub = new Set(), rows = [];
      all.forEach(x => {
        const L = "bgpAdv.links." + x.i + ".", os = x.l.swapped ? (x.me === "a" ? "b" : "a") : x.me;
        if (x.l.src) { rows.push(el("div", { class: "tt-row tt-ro" }, el("span", { class: "tt-peer", text: "→ " + nodeName(m, x.peer) }), el("span", { class: "mono", text: (x.l[x.me + "If"] || "—") + " · " + (x.l[x.me + "Ip"] || "—") + " · " + T("ttMain") }))); return; }
        if (x.dynHub) {
          if (seenHub.has(x.l.aIf)) { rows.push(el("div", { class: "tt-row tt-ro" }, el("span", { class: "tt-peer", text: "→ " + nodeName(m, x.peer) }), el("span", { class: "mono", text: x.l.aIf + " (dial-up) · " + (x.l[x.ot + "Ip"] || "—") }))); return; }
          seenHub.add(x.l.aIf);
          rows.push(el("div", { class: "tt-row tt-ro" }, el("span", { class: "tt-peer", text: "→ " + nodeName(m, x.peer) }), el("span", { class: "mono", text: x.l.aIf + " (dial-up) · " + (nd.dialIp || "—") + " · " + (x.l.range || "—") })));
          return;
        }
        const inp = (k, ph, w, opts) => el("input", Object.assign({ type: "text", class: "tt-in", style: "width:" + w, value: getP(L + os + k) ?? "", "data-bind": L + os + k, placeholder: ph || "", spellcheck: "false", "aria-label": k + " → " + nodeName(m, x.peer) }, opts || {}));
        const gen = !!x.l0.ipsec;
        rows.push(el("div", { class: "fld tt-row" + (gen ? "" : " tt-off"), "data-p": L + os + "If", "data-ps": [L + os + "If", L + os + "Ip", L + os + "Wan", L + os + "Gw", L + "ipsec"].join(" "), "data-search": ("tunnel " + nodeName(m, x.peer)).toLowerCase() },
          el("span", { class: "tt-peer", text: "→ " + nodeName(m, x.peer) }),
          el("label", { class: "tt-gen", title: H("bl.ipsec")[0] }, el("input", { type: "checkbox", checked: gen, "data-bind": L + "ipsec", "data-kind": "bool", "data-struct": "1" }), "IPsec"),
          gen ? [inp("If", "nome", "8.5em", { maxlength: "15", "data-struct": "blur" }), inp("Ip", "IP tunnel", "8.5em", { inputmode: "decimal" }),
                 inp("Wan", nodeWan(m, nd) || "wan", "5em", { maxlength: "15" }), inp("Gw", nodeGw(m, x.peer) || "gateway", "9em")]
              : el("span", { class: "tt-note", text: T("ttOff") })));
      });
      return el("details", { class: "site-tuns", open: !nd.ipsec || all.length <= 4 || !!S.search.trim() }, el("summary", { text: (nd.ipsec ? T("tunOf") + " " + nodeName(m, nd) : T("siteTuns")) + " (" + all.length + ")" }),
        el("div", { class: "tt-head" }, ["", "", T("ttName"), T("ttIp"), "WAN", T("ttGw")].map(x => el("span", { text: x }))), rows);
    };
    const tunBoxOld = (nid, s) => {
      const rows = tunList(nid); if (!rows.length) return null;
      return el("details", { class: "site-tuns" }, el("summary", { text: T("siteTuns") + " (" + rows.length + ")" }), rows.map(r => el("span", { class: "t-v", text: r })));
    };
    m.bgpAdv.nodes.forEach((n, i) => {
      if (n.ipsec && !DIAL(sc)) { siteCols.push({ side: n.ipsec, box: tunBox(n.id) }); return; }
      if (n.ext || n.ipsec) return;
      const P = k => "bgpAdv.nodes." + i + "." + k;
      S.siteOpen = S.siteOpen === undefined ? null : S.siteOpen;
      const open = S.siteOpen === n.id || !!S.search.trim();
      const nT = tunList(n.id).length, hasErr = (S.checks || []).some(c => c.lvl === "err" && (c.ps || [c.p]).some(x => x && x.startsWith("bgpAdv.nodes." + i + ".")));
      const rowHead = el("div", { class: "site-row" + (open ? " open" : "") },
        el("button", { type: "button", class: "site-sum", "aria-expanded": String(open), onclick: () => { S.siteOpen = open ? null : n.id; renderForm(); } },
          el("b", { text: nodeName(m, n) }),
          el("span", { class: "mono", text: (n.wan || "—") + " · " + (n.dyn ? T("topoDyn") : (String(n.pubIp || n.fqdn || "").trim() || "—")) }),
          el("span", { class: "mono", text: parseNets(n.nets).out.map(x => x.net + "/" + x.p).join(", ") || T("topoNoNets") }),
          el("span", { text: nT + " tunnel" }),
          hasErr ? el("span", { class: "tag weak", text: T("hasErr") }) : null),
        el("button", { type: "button", class: "row-x", title: T("remove"), "aria-label": T("remove") + " " + nodeName(m, n), onclick: () => { S.m.bgpAdv.nodes.splice(i, 1); S.m.bgpAdv.links = S.m.bgpAdv.links.filter(l => l.a !== n.id && l.b !== n.id); renderForm(); refresh(); } }, "×"));
      if (!open) { siteCols.push({ box: rowHead }); return; }
      const f = [];
      f.push(helpField(P("name"), "bn.name", textCtl(P("name"), { "data-struct": "blur" }), { changed: false, label: H("side.label")[0] }));
      f.push(helpField(P("wan"), "bn.wan", textCtl(P("wan"), { maxlength: "15" }), { changed: false, cli: "phase1 / set interface <...>" }));
      f.push(helpField(P("dyn"), "bn.dyn", toggleCtl(P("dyn"), true), { changed: false, cli: "set type dynamic / config neighbor-range" }));
      if (!n.dyn) {
        f.push(helpField(P("pubIp"), "bn.pubIp", textCtl(P("pubIp"), { inputmode: "decimal" }), { changed: false, cli: "set remote-gw <ip>" }));
        f.push(helpField(P("fqdn"), "bn.fqdn", textCtl(P("fqdn")), { changed: false, cli: "set remotegw-ddns <fqdn>" }));
      }
      f.push(helpField(P("nets"), "bn.nets", id => el("textarea", { id, "data-bind": P("nets"), spellcheck: "false", rows: "3" }, String(n.nets || "")), { changed: false, wide: true }));
      const tb = tunBox(n.id); if (tb) f.push(tb);
      else f.push(el("p", { class: "bx-note", text: T("ttNone") }));
      siteCols.push({ box: el("div", { class: "site-open" }, rowHead, el("div", { class: "site-body" }, f)) });
    });
  }
  const withTuns = s => sideFields(s);
  const abTuns = siteCols.filter(c => c.side && c.box).map(c => c.box);
  if (DIAL(sc)) sideSec.fields.push(...sideFields("a").slice(1));
  else sideSec.fields.push(el("div", { class: "side-grid" }, el("div", { class: "side-col" }, withTuns("a")), el("div", { class: "side-col" }, withTuns("b"))));
  if (abTuns.length) sideSec.fields.push(el("div", { class: "ab-tuns" }, abTuns));
  const extra = siteCols.filter(c => !c.side).map(c => c.box);
  if (extra.length) {
    if (advOn(m)) { sideSec.title = T("s_sides_bgp"); sideSec.desc = T("s_sides_bgp_d"); }
    sideSec.fields.push(el("div", { class: "site-list" }, el("h3", { class: "side-title", text: T("siteNode") + " (" + extra.length + ")" }), extra));
  }
  if (advOn(m)) sideSec.fields.push(el("div", { class: "bx-row" }, el("button", { type: "button", class: "btn small", onclick: () => { const id = bgpAddNode(S.m, S.lang); S.siteOpen = id; renderForm(); refresh(); } }, T("addSite"))));
  if (sc === "s2s") sideSec.fields.push(helpField("tunPrefix", "tunPrefix", segCtl("tunPrefix", [["30", "/30"], ["31", "/31"]])));
  secs.push(sideSec);
  // 3. autenticazione
  const auth = { id: "auth", title: T("s_auth"), desc: T("s_auth_d"), paths: [], fields: [] };
  const pskField = () => fieldBox({ p: "psk", label: H("psk")[0], hint: H("psk")[1] + ". " + T("pskNote"), why: H("psk")[2], cli: "set psksecret <...>", control: secretCtl("psk") });
  if (!DIAL(sc)) {
    auth.paths.push("auth.method");
    auth.fields.push(helpField("auth.method", "auth.method", segCtl("auth.method", [["psk", T("auth_psk")], ["cert", T("auth_cert")]], true), { cli: "set authmethod psk | signature" }));
    if (m.auth.method === "psk") auth.fields.push(pskField());
    else ["A", "B"].forEach(x => {
      const s = x.toLowerCase();
      auth.fields.push(el("h3", { class: "side-title " + s, text: sideLabel(s) }));
      auth.fields.push(helpField("auth.cert" + x, "auth.cert", textCtl("auth.cert" + x), { cli: "set certificate <...>" }));
      auth.fields.push(helpField("auth.peer" + x, "auth.peer", textCtl("auth.peer" + x), { cli: "set peer <...>" }));
      auth.fields.push(helpField("auth.ca" + x, "auth.ca", textCtl("auth.ca" + x), { cli: "config user peer / set ca <...>" }));
      auth.fields.push(helpField("auth.cn" + x, "auth.cn", textCtl("auth.cn" + x), { cli: "config user peer / set cn <...>" }));
      auth.paths.push("auth.cert" + x, "auth.peer" + x, "auth.ca" + x, "auth.cn" + x);
    });
  } else {
    const d = m.dial;
    auth.paths.push("dial.auth", "dial.group", "dial.users", "dial.ldapServer", "dial.ldapDN", "dial.ldapCreate", "dial.ldapIp", "dial.ldapCnid", "dial.ldapBase", "dial.ldapBind", "dial.ldapSecure", "dial.ldapNested",
      "dial.radiusServer", "dial.radiusCreate", "dial.radiusIp", "dial.radiusTimeout", "dial.samlServer", "dial.samlPort", "dial.tenant", "dial.groupId", "dial.idpCert", "dial.spCert", "dial.authCert");
    const authOpts = [["local", T("dial_local")], ["ldap", T("dial_ldap")], ["radius", T("dial_radius")], ["saml", T("dial_saml")]];
    auth.fields.push(helpField("dial.auth", "dial.auth", segCtl("dial.auth", authOpts, true), { wide: true }));
    auth.fields.push(helpField("dial.group", "dial.group", textCtl("dial.group"), { cli: "set authusrgrp <...>" }));
    if (d.auth === "local") auth.fields.push(helpField("dial.users", "dial.users", textCtl("dial.users"), { wide: true }));
    if (d.auth === "ldap") {
      ["ldapServer", "ldapDN"].forEach(k => auth.fields.push(helpField("dial." + k, "dial." + k, textCtl("dial." + k), { wide: k === "ldapDN" })));
      auth.fields.push(helpField("dial.ldapCreate", "dial.ldapCreate", toggleCtl("dial.ldapCreate", true), { cli: "config user ldap" }));
      if (d.ldapCreate) {
        auth.fields.push(helpField("dial.ldapIp", "dial.ldapIp", textCtl("dial.ldapIp"), { cli: "set server <...>" }));
        auth.fields.push(helpField("dial.ldapCnid", "dial.ldapCnid", textCtl("dial.ldapCnid"), { cli: "set cnid <...>" }));
        auth.fields.push(helpField("dial.ldapBase", "dial.ldapBase", textCtl("dial.ldapBase"), { wide: true, cli: "set dn <...>" }));
        auth.fields.push(helpField("dial.ldapBind", "dial.ldapBind", textCtl("dial.ldapBind"), { wide: true, cli: "set type regular / set username <...>" }));
        auth.fields.push(fieldBox({ p: "ldapPwd", badge: H("ldapPwd")[3] ? "optional" : null, label: H("ldapPwd")[0], hint: H("ldapPwd")[1], why: H("ldapPwd")[2], cli: "set password <...>", control: secretCtl("ldap"), wide: true }));
        auth.fields.push(helpField("dial.ldapSecure", "dial.ldapSecure", segCtl("dial.ldapSecure", [["disable", T("ldapSec_disable")], ["ldaps", "LDAPS"], ["starttls", "STARTTLS"]], true), { wide: true, cli: "set secure ldaps / set port 636" }));
        auth.fields.push(helpField("dial.ldapNested", "dial.ldapNested", toggleCtl("dial.ldapNested"), { cli: "set search-type recursive" }));
      }
    }
    if (d.auth === "radius") {
      auth.fields.push(helpField("dial.radiusServer", "dial.radiusServer", textCtl("dial.radiusServer")));
      auth.fields.push(helpField("dial.radiusCreate", "dial.radiusCreate", toggleCtl("dial.radiusCreate", true), { cli: "config user radius" }));
      if (d.radiusCreate) {
        auth.fields.push(helpField("dial.radiusIp", "dial.radiusIp", textCtl("dial.radiusIp"), { cli: "set server <...>" }));
        auth.fields.push(helpField("dial.radiusTimeout", "dial.radiusTimeout", textCtl("dial.radiusTimeout", { inputmode: "numeric" }), { cli: "set timeout <1-300>" }));
        auth.fields.push(fieldBox({ p: "radiusPwd", badge: H("radiusPwd")[3] ? "optional" : null, label: H("radiusPwd")[0], hint: H("radiusPwd")[1], why: H("radiusPwd")[2], cli: "set secret <...>", control: secretCtl("radius"), wide: true }));
      }
    }
    if (d.auth === "saml") ["samlServer", "samlPort", "tenant", "groupId", "idpCert", "spCert", "authCert"].forEach(k =>
      auth.fields.push(helpField("dial." + k, "dial." + k, textCtl("dial." + k, k === "samlPort" ? { inputmode: "numeric" } : null), { wide: k === "tenant" || k === "groupId" })));
    auth.fields.push(pskField());
  }
  secs.push(auth);
  // 4. identità
  if (sc === "s2sdyn" || sc === "dialup") {
    const idf = { id: "ident", title: T("s_ident"), desc: T("s_ident_d"), paths: ["ident.networkId", "ident.usedIds", "ident.peerMode", "ident.localid"], fields: [] };
    if (m.crypto.ike === "2") {
      idf.fields.push(helpField("ident.networkId", "ident.networkId", textCtl("ident.networkId", { inputmode: "numeric" }), { cli: "set network-overlay enable / set network-id <0-255>" }));
      idf.fields.push(helpField("ident.usedIds", "ident.usedIds", textCtl("ident.usedIds")));
    }
    if (sc === "s2sdyn") {
      idf.fields.push(helpField("ident.peerMode", "ident.peerMode", segCtl("ident.peerMode", [["any", T("peer_any")], ["one", T("peer_one")]], true), { cli: "set peertype any | one" }));
      idf.fields.push(helpField("ident.localid", "ident.localid", textCtl("ident.localid"), { cli: "set localid <...> / set peerid <...>" }));
    }
    if (idf.fields.length) secs.push(idf);
  }
  // 5. crittografia
  const c = m.crypto;
  secs.push(cryptoSection(m));
  // 6. reti
  if (sc === "s2s") secs.push({ id: "nets", title: T("s_nets"), desc: T("s_nets_d"), paths: ["sel.mode"], fields: [
    helpField("sel.mode", "sel.mode", segCtl("sel.mode", [["any", T("sel_any")], ["subnets", T("sel_subnets")]]), { wide: true, cli: "phase2: set src-subnet / dst-subnet" })] });
  if (DIAL(sc)) {
    const dn = { id: "dialnet", title: T("s_dialnet"), desc: T("s_dialnet_d"), paths: ["dial.poolStart", "dial.poolEnd", "dial.dns1", "dial.dns2", "dial.split", "dial.exclude", "dial.localLan", "dial.domains", "dial.suffix"], fields: [] };
    dn.fields.push(helpField("dial.poolStart", "dial.poolStart", textCtl("dial.poolStart", { inputmode: "decimal" }), { cli: "set ipv4-start-ip <...>" }));
    dn.fields.push(helpField("dial.poolEnd", "dial.poolEnd", textCtl("dial.poolEnd", { inputmode: "decimal" }), { cli: "set ipv4-end-ip <...>" }));
    dn.fields.push(helpField("dial.dns1", "dial.dns1", textCtl("dial.dns1", { inputmode: "decimal" }), { cli: "set ipv4-dns-server1 <...>" }));
    dn.fields.push(helpField("dial.dns2", "dial.dns2", textCtl("dial.dns2", { inputmode: "decimal" }), { cli: "set ipv4-dns-server2 <...>" }));
    dn.fields.push(helpField("dial.split", "dial.split", segCtl("dial.split", [["split", T("split_split")], ["full", T("split_full")]], true), { wide: true, cli: "set ipv4-split-include <...>" }));
    if (sc === "dialup" && m.dial.split === "full") {
      dn.fields.push(helpField("dial.exclude", "dial.exclude", areaCtl("dial.exclude"), { wide: true, cli: "set ipv4-split-exclude <...>" }));
      dn.fields.push(helpField("dial.localLan", "dial.localLan", toggleCtl("dial.localLan"), { cli: "FortiClient: <enable_local_lan>" }));
    }
    if (sc === "dialup" && m.fos !== "7.2") dn.fields.push(helpField("dial.domains", "dial.domains", textCtl("dial.domains"), { wide: true, cli: "set internal-domain-list <...>" }));
    if (sc === "dialup" && m.fos === "7.6") dn.fields.push(helpField("dial.suffix", "dial.suffix", textCtl("dial.suffix"), { wide: true, cli: "set dns-suffix-search <...>" }));
    secs.push(dn);
  }
  // origine delle connessioni
  if ((sc === "dialup" || sc === "s2sdyn") && m.fos !== "7.2") {
    const g = { id: "gwm", title: T("s_gwm"), desc: T("s_gwm_d"), paths: ["gwm.mode", "gwm.subnet", "gwm.start", "gwm.end", "gwm.country"], fields: [] };
    g.fields.push(helpField("gwm.mode", "gwm.mode", segCtl("gwm.mode", [["any", T("gwm_any")], ["ipmask", T("gwm_ipmask")], ["iprange", T("gwm_iprange")], ["geography", T("gwm_geo")]], true), { wide: true, cli: "set remote-gw-match any | ipmask | iprange | geography" }));
    if (m.gwm.mode === "ipmask") g.fields.push(helpField("gwm.subnet", "gwm.subnet", textCtl("gwm.subnet"), { cli: "set remote-gw-subnet <...>" }));
    if (m.gwm.mode === "iprange") { g.fields.push(helpField("gwm.start", "gwm.start", textCtl("gwm.start", { inputmode: "decimal" }), { cli: "set remote-gw-start-ip <...>" })); g.fields.push(helpField("gwm.end", "gwm.end", textCtl("gwm.end", { inputmode: "decimal" }), { cli: "set remote-gw-end-ip <...>" })); }
    if (m.gwm.mode === "geography") g.fields.push(helpField("gwm.country", "gwm.country", textCtl("gwm.country", { maxlength: "2" }), { cli: "set remote-gw-country <...>" }));
    secs.push(g);
  }
  // 7. routing
  if (!DIAL(sc)) {
    const r = { id: "route", title: T("s_route"), desc: T("s_route_d"), paths: ["route.on", "route.distance", "route.bh", "route.bhDistance"], fields: [] };
    r.fields.push(helpField("route.on", "route.on", toggleCtl("route.on", true), { cli: "config router static / set device <tunnel>" }));
    if (m.route.on) r.fields.push(helpField("route.distance", "route.distance", textCtl("route.distance", { inputmode: "numeric" }), { cli: "set distance <1-255>" }));
    r.fields.push(helpField("route.bh", "route.bh", toggleCtl("route.bh", true), { cli: "set blackhole enable" }));
    if (m.route.bh) r.fields.push(helpField("route.bhDistance", "route.bhDistance", textCtl("route.bhDistance", { inputmode: "numeric" }), { cli: "set distance 254" }));
    secs.push(r);
    // BGP
    const bg = { id: "bgp", title: T("s_bgp"), desc: T("s_bgp_d"), paths: ["bgp.on", "bgp.asA", "bgp.asB", "bgp.ridA", "bgp.ridB", "bgp.overlay", "a.tip", "b.tip", "bgp.keepalive", "bgp.holdtime", "bgp.soft", "bgp.ldf", "bgp.gr"], fields: [] };
    bg.fields.push(helpField("bgp.on", "bgp.on", toggleCtl("bgp.on", true), { cli: "config router bgp" }));
    if (m.bgp.on) {
      bg.fields.push(helpField("bgp.asA", "bgp.asA", textCtl("bgp.asA", { inputmode: "numeric" }), { cli: "set as <1-4294967295>" }));
      bg.fields.push(helpField("bgp.asB", "bgp.asB", textCtl("bgp.asB", { inputmode: "numeric" }), { cli: "set remote-as <...>" }));
      bg.fields.push(helpField("bgp.ridA", "bgp.ridA", textCtl("bgp.ridA", { inputmode: "decimal" }), { cli: "set router-id <ip>" }));
      bg.fields.push(helpField("bgp.ridB", "bgp.ridB", textCtl("bgp.ridB", { inputmode: "decimal" }), { cli: "set router-id <ip>" }));
      if (sc === "s2sdyn") {
        bg.fields.push(helpField("bgp.overlay", "bgp.overlay", textCtl("bgp.overlay"), { wide: true, cli: "config neighbor-range / set prefix <...>" }));
        bg.fields.push(helpField("a.tip", "bgp.tipHub", textCtl("a.tip", { inputmode: "decimal" }), { cli: "config system interface / set ip <...> 255.255.255.255" }));
        bg.fields.push(helpField("b.tip", "bgp.tipBranch", textCtl("b.tip", { inputmode: "decimal" }), { cli: "config system interface / set ip <...> 255.255.255.255" }));
      }
      bg.fields.push(helpField("bgp.keepalive", "bgp.keepalive", textCtl("bgp.keepalive", { inputmode: "numeric" }), { cli: "set keep-alive-timer <...>" }));
      bg.fields.push(helpField("bgp.holdtime", "bgp.holdtime", textCtl("bgp.holdtime", { inputmode: "numeric" }), { cli: "set holdtime-timer <...>" }));
      bg.fields.push(helpField("bgp.soft", "bgp.soft", toggleCtl("bgp.soft"), { cli: "set soft-reconfiguration enable" }));
      bg.fields.push(helpField("bgp.ldf", "bgp.ldf", toggleCtl("bgp.ldf"), { cli: "set link-down-failover enable" }));
      bg.fields.push(helpField("bgp.gr", "bgp.gr", toggleCtl("bgp.gr"), { cli: "set graceful-restart enable" }));
      bg.fields.push(fieldBox({ p: "bgpPwd", badge: H("bgpPwd")[3] ? "optional" : null, label: H("bgpPwd")[0], hint: H("bgpPwd")[1], why: H("bgpPwd")[2], cli: "set password <...>", control: secretCtl("bgp"), wide: true }));
    }
    if (advOn(m)) secs.push(...bgpAdvSections(m)); else secs.push(bg);
    // doppia WAN
    if (sc === "s2s") {
      const dw = { id: "dual", title: T("s_dual"), desc: T("s_dual_d"), paths: ["dual.on", "dual.aWan", "dual.aIp", "dual.aFqdn", "dual.aTunnel", "dual.aTip", "dual.bWan", "dual.bIp", "dual.bFqdn", "dual.bTunnel", "dual.bTip", "dual.mode", "dual.backupDist"], fields: [] };
      dw.fields.push(helpField("dual.on", "dual.on", toggleCtl("dual.on", true)));
      if (m.dual.on) {
        const col = (x, title) => el("div", { class: "side-col" }, el("h3", { class: "side-title " + x, text: title }),
          ["Tunnel", "Wan", "Ip", "Fqdn", "Tip"].map(k => helpField("dual." + x + k, "dual." + x + k, textCtl("dual." + x + k, k === "Tunnel" ? { maxlength: "15" } : (k === "Ip" || k === "Tip" ? { inputmode: "decimal" } : null)))));
        dw.fields.push(el("div", { class: "side-grid" }, col("a", T("wanA2")), col("b", T("wanB2"))));
        dw.fields.push(helpField("dual.mode", "dual.mode", segCtl("dual.mode", [["backup", T("dual_backup")], ["standby", T("dual_standby")], ["ecmp", T("dual_ecmp")]], true), { wide: true, cli: "config router static / set distance <...>" }));
        if (m.dual.mode !== "ecmp") dw.fields.push(helpField("dual.backupDist", "dual.backupDist", textCtl("dual.backupDist", { inputmode: "numeric" }), { cli: "set distance <...>" }));
        if (m.dual.mode === "standby") {
          dw.fields.push(helpField("dual.holdType", "dual.holdType", segCtl("dual.holdType", [["immediate", T("hold_immediate")], ["delay", T("hold_delay")]], true), { wide: true, cli: "set monitor-hold-down-type immediate | delay" }));
          if (m.dual.holdType === "delay") dw.fields.push(helpField("dual.holdDelay", "dual.holdDelay", textCtl("dual.holdDelay", { inputmode: "numeric" }), { cli: "set monitor-hold-down-delay <...>" }));
        }
      }
      secs.push(dw);
    }
  }
  if (DIAL(sc) && advOn(m)) secs.push(...bgpAdvSections(m));
  // FEC per linee che perdono pacchetti
  if (sc === "s2s" || sc === "s2sdyn") {
    const f = { id: "fec", title: T("s_fec"), desc: T("s_fec_d"), paths: ["fec.on", "fec.base", "fec.redundant"], fields: [] };
    f.fields.push(helpField("fec.on", "fec.on", toggleCtl("fec.on", true), { cli: "set fec-egress enable / set fec-ingress enable" }));
    if (m.fec.on) {
      f.fields.push(helpField("fec.base", "fec.base", textCtl("fec.base", { inputmode: "numeric" }), { cli: "set fec-base <1-40>" }));
      f.fields.push(helpField("fec.redundant", "fec.redundant", textCtl("fec.redundant", { inputmode: "numeric" }), { cli: "set fec-redundant <1-20>" }));
    }
    secs.push(f);
  }
  // trasporto IKE (FortiClient)
  if (sc === "dialup" && m.crypto.ike === "2") {
    const tr = { id: "iketrans", title: T("s_iketrans"), desc: T("s_iketrans_d"), paths: ["trans.mode", "trans.port", "trans.threshold"], fields: [] };
    tr.fields.push(helpField("trans.mode", "trans.mode", segCtl("trans.mode", [["udp", T("trans_udp")], ["tcp", T("trans_tcp")], ...(m.fos === "7.6" || m.trans.mode === "auto" ? [["auto", T("trans_auto")]] : [])], true), { wide: true, cli: m.fos === "7.6" ? "set transport udp | tcp | auto" : "set transport udp | tcp" }));
    if (m.trans.mode !== "udp") {
      tr.fields.push(helpField("trans.port", "trans.port", textCtl("trans.port", { inputmode: "numeric" }), { cli: "config system settings / set ike-tcp-port <...>" }));
      if (m.trans.mode === "auto") tr.fields.push(helpField("trans.threshold", "trans.threshold", textCtl("trans.threshold", { inputmode: "numeric" }), { cli: "set auto-transport-threshold <...>" }));
    }
    secs.push(tr);
  }
  // 8. avanzate dallo schema
  ADV_SECTIONS.forEach(sk => {
    const opts = OPTS.filter(o => o.sec === sk && optSides(o).length);
    if (!opts.length) return;
    secs.push({ id: sk, title: T("s_" + sk), desc: sk === "resil" ? T("s_resil_d") : "", adv: true, opts, fields: opts.map(advField).filter(Boolean),
      essentialOnly: opts.filter(o => o.lvl === "essential").map(o => o.k) });
  });
  // 10. FortiClient
  if (sc === "dialup") secs.push({ id: "client", title: T("s_client"), desc: "", paths: ["dial.client", "dial.authTimeout", "dial.saveUser"], fields: [
    helpField("dial.client", "dial.client", textCtl("dial.client")),
    helpField("dial.authTimeout", "dial.authTimeout", textCtl("dial.authTimeout", { inputmode: "numeric" }), { cli: "config system global / set remoteauthtimeout <...>" }),
    helpField("dial.saveUser", "dial.saveUser", toggleCtl("dial.saveUser"))] });
  return secs;
}

/* ---------- rete multi-sede: procedura guidata ---------- */
const MS_COL_CLI = { "ms.col.lan": "config firewall policy / set srcintf <lan> / set dstintf <lan>", "ms.col.type": "—", "ms.col.cost": "config system sdwan / config members / set cost <n>; config system ipsec-aggregate / set member <in ordine di costo>", "ms.col.code": "config vpn ipsec phase1-interface / edit \"MILW-ROML\"; config system ipsec-aggregate / edit \"MIL-ROM\"", "bn.rid": "config router bgp / set router-id <ip>", "bn.as": "config router bgp / set as <n>; config neighbor / set remote-as <n>",
  "bn.rr": "config neighbor / set route-reflector-client enable", "ms.loName": "config system interface / edit <nome> / set type loopback", "ms.loIp": "set ip <ip> 255.255.255.255; config neighbor / set update-source <loopback>", "ms.col.name": "set description / set comment / edit \"T_<nome>\"", "ms.col.wan": "config vpn ipsec phase1-interface / set interface <wan>",
  "ms.col.addr": "set remote-gw <ip> | set remotegw-ddns <fqdn>", "ms.col.dyn": "set type dynamic (sul FortiGate che riceve)",
  "ms.col.nets": "config router bgp / config network / set prefix <rete>; config router static / set blackhole enable" };
function msSections(m, secs) {
  const g = m.bgpAdv, sites = msSites(m), hub = msHub(m), expert = S.mode === "expert";
  const hf = (p, key, ctl, extra) => helpField(p, key, ctl, Object.assign({ changed: false }, extra || {}));
  const mutate = f => () => { f(); renderForm(); refresh(); };
  const NP = (n, k) => "bgpAdv.nodes." + g.nodes.indexOf(n) + "." + k;
  const res = (g.links || []).map(l => bgpLinkRes(m, l)), nTun = res.filter(l => l.gen && !l.bothDyn && l.agg !== "pair").length;
  const agg = aggOn(m), codes = g.names === "code" && g.topo !== "custom";
  const removeSite = n => { const i = S.m.bgpAdv.nodes.indexOf(n); if (i < 0) return; S.m.bgpAdv.nodes.splice(i, 1); S.m.bgpAdv.links = S.m.bgpAdv.links.filter(l => l.a !== n.id && l.b !== n.id); if (S.m.bgpAdv.hubId === n.id) S.m.bgpAdv.hubId = ""; };
  // 2. quante sedi e topologia
  const count = fieldBox({ p: "msCount", label: H("ms.count")[0], hint: H("ms.count")[1], why: H("ms.count")[2], noFor: true,
    control: id => el("div", { class: "stepper", role: "group", "aria-labelledby": id + "l" },
      el("button", { type: "button", class: "btn small", "aria-label": T("lessSite"), disabled: sites.length <= 2 ? true : null, onclick: mutate(() => { const last = sites.filter(n => n !== hub).pop(); if (last) removeSite(last); }) }, "−"),
      el("output", { id, class: "step-n", "aria-live": "polite", text: String(sites.length) }),
      el("button", { type: "button", class: "btn small", "aria-label": T("moreSite"), disabled: sites.length >= 30 ? true : null, onclick: mutate(() => msAddSite(S.m, S.lang)) }, "+"),
      el("span", { class: "step-info", text: nTun + " " + T("tunnelsN") })) });
  const topoItems = [["hub", T("topo_hub")], ["mesh", T("topo_mesh")]];
  if (expert || g.topo === "custom") topoItems.push(["custom", T("topo_custom")]);
  const mst = { id: "mst", noReset: true, title: T("s_mst"), desc: T("s_mst_d"), fields: [count, hf("bgpAdv.topo", "ms.topo", segCtl("bgpAdv.topo", topoItems, true))] };
  if (g.topo === "hub") {
    mst.fields.push(hf("bgpAdv.hubId", "ms.hub", id => el("select", { id, "data-bind": "bgpAdv.hubId", "data-struct": "1" }, sites.map(n => el("option", { value: n.id, selected: hub === n }, nodeName(m, n))))));
    if (!agg) mst.fields.push(hf("bgpAdv.hubMode", "ms.hubMode", segCtl("bgpAdv.hubMode", [["dial", T("hm_dial")], ["per", T("hm_per")]], true), { cli: "phase1: set type dynamic | static" }));
  }
  if (g.topo !== "custom") mst.fields.push(hf("bgpAdv.sdwan.on", "ms.sdwan", toggleCtl("bgpAdv.sdwan.on", true), { cli: "config system sdwan | config system ipsec-aggregate" }));
  if (g.topo !== "custom" && g.sdwan.on) mst.fields.push(hf("bgpAdv.sdwan.mode", "ms.grp", segCtl("bgpAdv.sdwan.mode", [["zone", T("gm_zone")], ["agg", T("gm_agg")]], true), { cli: "config system sdwan / config members | config system ipsec-aggregate / set member" }));
  secs.push(mst);
  const sw = sdwanOn(m);
  // 3. dati delle sedi
  const dialAll = g.topo === "hub" && g.hubMode === "dial" && !agg;
  // intestazione di tabella: ogni colonna ha il suo «?», l'aiuto si apre in un riquadro sotto l'intestazione
  const colHead = (cls, boxId, cols) => {
    const box = el("div", { class: "help ms-help", id: boxId, role: "region", "aria-live": "polite", hidden: true });
    const q = key => el("button", { type: "button", class: "q", "aria-expanded": "false", "aria-controls": boxId, title: T("why"), "aria-label": T("why") + ": " + H(key)[0],
      onclick: e => {
        const b = e.currentTarget, open = b.getAttribute("aria-expanded") === "true";
        $$('.q[aria-controls="' + boxId + '"]').forEach(x => x.setAttribute("aria-expanded", "false"));
        box.textContent = "";
        if (open) { box.hidden = true; return; }
        const [lab, hint, why] = H(key); b.setAttribute("aria-expanded", "true");
        box.append(el("p", null, el("b", { text: lab + ". " }), why), hint ? el("p", { class: "defs", text: hint }) : null,
          MS_COL_CLI[key] ? el("p", { class: "cmd" }, el("span", { text: T("cliCmd") }), el("code", { text: MS_COL_CLI[key] })) : null);
        box.hidden = false;
      } }, "?");
    return [el("div", { class: "ms-row ms-head " + cls }, cols.map(([lab, key, lab2, key2]) => key ? el("span", { class: "ms-hc" }, el("span", { text: lab }), q(key), ...(key2 ? [el("span", { class: "ms-hc2", text: "· " + lab2 }), q(key2)] : [])) : el("span", { text: lab || "" }))), box];
  };
  const mss = { id: "mss", noReset: true, cls: "ms-tbl", title: T("s_mss"), desc: T(sw ? "s_mss_d_sw" : "s_mss_d"), fields: sw
    ? colHead("ms-s", "msColHelp", [[""], [T("colName"), "ms.col.name", ...(codes ? [T("colCode"), "ms.col.code"] : [])], [T("colLan"), "ms.col.lan"], [T("colNets"), "ms.col.nets"], [""]])
    : colHead("", "msColHelp", [[""], [T("colName"), "ms.col.name", ...(codes ? [T("colCode"), "ms.col.code"] : [])], [T("colWan"), "ms.col.wan"], [T("colAddr"), "ms.col.addr"], [T("colDyn"), "ms.col.dyn"], [T("colNets"), "ms.col.nets"], [""]]) };
  // nome della sede, con il codice accanto quando i tunnel prendono i nomi dai codici
  const nameCell = (n, inp) => codes ? el("span", { class: "ms-nc" }, inp("name", T("colName"), { "data-struct": "blur", maxlength: "40" }),
    inp("code", T("colCode"), { "data-struct": "blur", maxlength: "8", class: "mono code", placeholder: autoSiteCode(m, n), title: T("colCode") })) : inp("name", T("colName"), { "data-struct": "blur", maxlength: "40" });
  if (sw) sites.forEach((n, k) => {
    const P = x => NP(n, x), isHub = n === hub, nm = nodeName(m, n);
    const inp = (x, lab, opts) => el("input", Object.assign({ type: "text", value: n[x] ?? "", "data-bind": P(x), spellcheck: "false", autocomplete: "off", "aria-label": lab + " · " + nm }, opts || {}));
    mss.fields.push(el("div", { class: "fld ms-row ms-s" + (isHub ? " hub" : ""), "data-p": P("name"), "data-ps": ["name", "code", "lanIf", "nets"].map(P).join(" "),
        "data-search": [nm, n.code, n.lanIf, n.nets, T("colName"), T("colNets"), T("colLan")].join(" ").toLowerCase() },
      el("span", { class: "ms-role" + (isHub ? " hub" : ""), text: isHub ? T("roleHub") : g.topo === "hub" ? T("roleSpoke") : String(k + 1) }),
      nameCell(n, inp),
      inp("lanIf", T("colLan"), { maxlength: "35", class: "mono", placeholder: "lan" }),
      inp("nets", T("colNets"), { class: "mono", placeholder: "192.168.10.0/24, 10.10.0.0/16", title: T("netsTip") }),
      el("button", { type: "button", class: "row-x", title: T("removeSite"), "aria-label": T("removeSite") + " " + nm, disabled: sites.length <= 2 ? true : null, onclick: mutate(() => removeSite(n)) }, "×")));
  });
  else sites.forEach((n, k) => {
    const P = x => NP(n, x), isHub = n === hub, needAddr = !(dialAll && !isHub), nm = nodeName(m, n);
    const inp = (x, lab, opts) => el("input", Object.assign({ type: "text", value: n[x] ?? "", "data-bind": P(x), spellcheck: "false", autocomplete: "off", "aria-label": lab + " · " + nm }, opts || {}));
    mss.fields.push(el("div", { class: "fld ms-row" + (isHub ? " hub" : ""), "data-p": P("name"), "data-ps": ["name", "code", "wan", "pubIp", "dyn", "nets"].map(P).join(" "),
        "data-search": [nm, n.code, n.wan, n.pubIp, n.nets, T("colName"), T("colNets"), T("colAddr")].join(" ").toLowerCase() },
      el("span", { class: "ms-role" + (isHub ? " hub" : ""), text: isHub ? T("roleHub") : g.topo === "hub" ? T("roleSpoke") : String(k + 1) }),
      nameCell(n, inp),
      inp("wan", T("colWan"), { maxlength: "15", class: "mono" }),
      !needAddr ? el("span", { class: "ms-note", text: T("addrNotNeeded") })
        : n.dyn ? el("span", { class: "ms-note", text: "—" })
        : inp("pubIp", T("colAddr"), { class: "mono", placeholder: "203.0.113.10" }),
      needAddr && (!isHub || n.dyn) ? el("label", { class: "ms-dyn" }, el("input", { type: "checkbox", checked: !!n.dyn, "data-bind": P("dyn"), "data-kind": "bool", "data-struct": "1" }), el("span", { text: T("colDyn") })) : el("span"),
      inp("nets", T("colNets"), { class: "mono", placeholder: "192.168.10.0/24, 10.10.0.0/16", title: T("netsTip") }),
      el("button", { type: "button", class: "row-x", title: T("removeSite"), "aria-label": T("removeSite") + " " + nm, disabled: sites.length <= 2 ? true : null, onclick: mutate(() => removeSite(n)) }, "×")));
  });
  mss.fields.push(el("p", { class: "bx-note ms-netsnote" }, el("b", { text: T("colNets") + ": " }), T("netsNote")));
  if (codes) mss.fields.push(el("p", { class: "bx-note" }, el("b", { text: T("colName") + " / " + T("colCode") + ": " }), T("codeNote")));
  mss.fields.push(el("div", { class: "bx-row" }, el("button", { type: "button", class: "btn small", disabled: sites.length >= 30 ? true : null, onclick: mutate(() => msAddSite(S.m, S.lang)) }, T("addSite"))));
  secs.push(mss);
  if (sw) {
    // linee delle sedi
    const msw = { id: "msw", noReset: true, cls: "ms-tbl", title: T("s_msw"), desc: T(agg ? "s_msw_d_agg" : "s_msw_d"), fields: colHead("ms-w" + (codes ? " codes" : ""), "mswColHelp",
      [codes ? [T("colLine"), "ms.col.code"] : [T("colLine")], [T("colWan"), "ms.col.wan"], [T("colAddr"), "ms.col.addr"], [T("colDyn"), "ms.col.dyn"], [T("colType"), "ms.col.type"], [T("colCost"), "ms.col.cost"], [""]]) };
    sites.forEach(n => {
      const isHub = n === hub, nm = nodeName(m, n), wl = siteWans(m, n);
      msw.fields.push(el("div", { class: "ms-wsite" }, el("b", { text: nm }), isHub ? el("span", { class: "ms-role hub", text: T("roleHub") }) : null,
        codes ? el("span", { class: "ms-note mono", text: siteCode(m, n) }) : null,
        el("button", { type: "button", class: "btn small", disabled: wl.length >= MAX_LINES ? true : null, onclick: mutate(() => { n.xwans = n.xwans || []; n.xwans.push({ if: "wan" + (wl.length + 1), addr: "", dyn: false, type: "inet", cost: String(10 * wl.length), code: "", seg: "" }); }) }, T("addLine"))));
      wl.forEach(w => {
        const needAddr = !(dialAll && !isHub);
        const inp = (k, lab, opts) => el("input", Object.assign({ type: "text", value: w[k] ?? "", "data-bind": w.p[k], spellcheck: "false", autocomplete: "off", "aria-label": lab + " · " + nm + " " + w.slot }, opts || {}));
        msw.fields.push(el("div", { class: "fld ms-row ms-w" + (codes ? " codes" : ""), "data-p": w.p.if, "data-ps": Object.values(w.p).join(" "), "data-search": [nm, w.if, w.addr, w.type, w.code, w.seg, T("colWan"), T("colAddr")].join(" ").toLowerCase() },
          codes ? el("span", { class: "ms-lc" }, el("span", { class: "ms-role", text: String(w.slot) }), inp("code", T("colCode"), { maxlength: "8", class: "mono", "data-struct": "blur", placeholder: autoLineCode(m, n, w) }))
            : el("span", { class: "ms-role", text: T("colLine") + " " + w.slot }),
          inp("if", T("colWan"), { maxlength: "15", class: "mono", "data-struct": "blur" }),
          !needAddr ? el("span", { class: "ms-note", text: T("addrNotNeeded") }) : w.dyn ? el("span", { class: "ms-note", text: "—" }) : inp("addr", T("colAddr"), { class: "mono", placeholder: "203.0.113.10", "data-struct": "blur" }),
          needAddr && (!isHub || w.dyn) ? el("label", { class: "ms-dyn" }, el("input", { type: "checkbox", checked: !!w.dyn, "data-bind": w.p.dyn, "data-kind": "bool", "data-struct": "1" }), el("span", { text: T("colDyn") })) : el("span"),
          el("span", { class: "ms-tc" }, el("select", { "data-bind": w.p.type, "data-struct": "1", "aria-label": T("colType") + " · " + nm + " " + w.slot }, [["inet", T("tyInet")], ["sat", T("tySat")], ["lte", "LTE / 5G"], ["mpls", T("tyPriv")]].map(([v, t]) => el("option", { value: v, selected: w.type === v }, t))),
            w.type === "mpls" ? inp("seg", T("colSeg"), { maxlength: "20", class: "mono", "data-struct": "blur", placeholder: T("segPh"), title: T("colSeg") }) : null),
          inp("cost", T("colCost"), { inputmode: "numeric", class: "mono" }),
          w.slot > 1 ? el("button", { type: "button", class: "row-x", title: T("removeLine"), "aria-label": T("removeLine") + " " + nm + " " + w.slot, onclick: mutate(() => msRemoveWan(S.m, n, w.slot)) }, "×") : el("span")));
      });
    });
    secs.push(msw);
    // coppie di linee: tutte quelle possibili, togli quelle che non vuoi
    const msp = { id: "msp", noReset: true, title: T("s_msp"), desc: T("s_msp_d"), fields: [
      el("div", { class: "fld wide ms-pp", "data-p": "msPairs", "data-search": T("pp_title").toLowerCase() }, el("div", { class: "fld-head" }, el("b", { text: T("pp_title") })),
        el("div", { class: "bx-row" }, ["all", "type", "slot", "nolte"].map(k => el("button", { type: "button", class: "btn small", onclick: mutate(() => msPairPreset(S.m, k)) }, T("pp_" + k)))),
        el("p", { class: "bx-note", text: T("pp_note") }))] };
    const wLab = (N, w) => (codes ? lineCode(m, N, w) + " · " : "") + (w.if || T("colLine") + " " + w.slot);
    const pairs = hub ? sites.filter(n => n !== hub).map(n => [n, hub]) : sites.flatMap((x, i) => sites.slice(i + 1).map(y => [x, y]));
    const ex = new Set(g.pairEx || []), CAPP = 12, showAllP = S.pairAll || !!S.search.trim();
    pairs.forEach(([A, B], k) => {
      if (!showAllP && k >= CAPP) return;
      const chips = [];
      siteWans(m, A).forEach(wa => siteWans(m, B).forEach(wb => {
        const key = pairKey(A.id, wa.slot, B.id, wb.slot), why = pairWhyNot(wa, wb, agg), on = !why && !ex.has(key);
        chips.push(el("label", { class: "chip" + (why ? " off" : ""), title: why ? T("pairNo_" + why) : "" },
          el("input", { type: "checkbox", checked: on, disabled: why ? true : null, onchange: e => { const L = new Set(S.m.bgpAdv.pairEx || []); if (e.target.checked) L.delete(key); else L.add(key); S.m.bgpAdv.pairEx = [...L]; renderForm(); refresh(); } }),
          el("span", { class: "v", text: wLab(A, wa) + " ⇄ " + wLab(B, wb) }), why ? el("span", { class: "tag weak", text: T("pairNoS_" + why) }) : null));
      }));
      msp.fields.push(el("div", { class: "fld wide ms-pair", "data-p": "msPairs", "data-search": (nodeName(m, A) + " " + nodeName(m, B)).toLowerCase() },
        el("div", { class: "fld-head" }, el("b", { text: nodeName(m, A) + " ⇄ " + nodeName(m, B) })), el("div", { class: "chips" }, chips)));
    });
    if (pairs.length > CAPP && !S.search.trim()) msp.fields.push(el("button", { type: "button", class: "btn link show-more", onclick: () => { S.pairAll = !S.pairAll; renderForm(); } }, S.pairAll ? T("showLess") : T("showMorePairs").replace("{n}", pairs.length - CAPP)));
    secs.push(msp);
    // SD-WAN oppure aggregato IPsec
    if (agg) secs.push({ id: "mssd", noReset: true, title: T("s_msag"), desc: T("s_msag_d"), fields: [
      hf("bgpAdv.sdwan.zone", "ms.zoneAgg", textCtl("bgpAdv.sdwan.zone", { maxlength: "35" }), { cli: "config system zone / edit <...> / set intrazone allow" }),
      hf("bgpAdv.sdwan.alg", "ms.alg", segCtl("bgpAdv.sdwan.alg", [["L4", "L4"], ["L3", "L3"], ["round-robin", "round-robin"], ["redundant", "redundant"]], true), { cli: "config system ipsec-aggregate / set algorithm L3 | L4 | round-robin | redundant" }),
      hf("bgpAdv.sdwan.pol", "ms.polAgg", toggleCtl("bgpAdv.sdwan.pol", true), { cli: "config firewall policy / set srcintf <lan> / set dstintf <zona>" }),
      el("p", { class: "bx-note", text: T("aggModeNote") })] });
    const mssd = agg ? null : { id: "mssd", noReset: true, title: "SD-WAN", desc: T("s_mssd_d"), fields: [
      hf("bgpAdv.sdwan.zone", "ms.zone", textCtl("bgpAdv.sdwan.zone", { maxlength: "35" }), { cli: "config system sdwan / config zone / edit <...>" }),
      hf("bgpAdv.sdwan.lat", "ms.lat", textCtl("bgpAdv.sdwan.lat", { inputmode: "numeric" }), { cli: "config sla / set latency-threshold <ms>" }),
      hf("bgpAdv.sdwan.jit", "ms.jit", textCtl("bgpAdv.sdwan.jit", { inputmode: "numeric" }), { cli: "config sla / set jitter-threshold <ms>" }),
      hf("bgpAdv.sdwan.loss", "ms.loss", textCtl("bgpAdv.sdwan.loss", { inputmode: "numeric" }), { cli: "config sla / set packetloss-threshold <%>" }),
      hf("bgpAdv.sdwan.pol", "ms.pol", toggleCtl("bgpAdv.sdwan.pol", true), { cli: "config firewall policy / set srcintf <lan> / set dstintf <zona>" }),
      el("p", { class: "bx-note", text: T("sdwanModeNote") })] };
    if (mssd && (expert || String(g.sdwan.base) !== "100")) mssd.fields.splice(4, 0, hf("bgpAdv.sdwan.base", "ms.base", textCtl("bgpAdv.sdwan.base", { inputmode: "numeric" }), { cli: "config members / edit <n>; config service / edit <n>" }));
    if (mssd) secs.push(mssd);
  }
  // 4. IPsec comune
  const msi = { id: "msi", noReset: true, title: T("s_msi"), desc: T("s_msi_d"), fields: [
    fieldBox({ p: "psk", label: H("psk")[0], hint: H("psk")[1] + ". " + T("pskNote"), why: H("psk")[2], cli: "set psksecret <...>", control: secretCtl("psk"), wide: true })] };
  if (g.topo !== "custom") msi.fields.push(hf("bgpAdv.names", "ms.names", segCtl("bgpAdv.names", [["peer", T("nm_peer")], ["code", T("nm_code")]], true), { cli: "config vpn ipsec phase1-interface / edit <...>" }));
  if (sw || expert || String(g.dpdInt || "").trim()) msi.fields.push(hf("bgpAdv.dpdInt", "ms.dpdInt", textCtl("bgpAdv.dpdInt", { inputmode: "numeric", placeholder: "20" }), { cli: "set dpd on-idle / set dpd-retryinterval <1-3600>" }));
  const anyP2p = res.some(l => l.gen && !l.dyn && !l.bothDyn && l.agg !== "mem");
  if (anyP2p) {
    msi.fields.push(hf("bgpAdv.pool", "ms.pool", textCtl("bgpAdv.pool"), { cli: "config system interface / set ip <...> 255.255.255.255" }));
    msi.fields.push(hf("bgpAdv.p2pPrefix", "ms.p2pPrefix", segCtl("bgpAdv.p2pPrefix", [["30", "/30"], ["31", "/31"]], true), { cli: "set remote-ip <ip> 255.255.255.252 | 255.255.255.254" }));
    if (g.topo !== "custom") msi.fields.push(hf("bgpAdv.ipPlan", "ms.ipPlan", segCtl("bgpAdv.ipPlan", [["seq", T("ip_seq")], ["site", T("ip_site")]], true), { cli: "config system interface / set ip <...> / set remote-ip <...>; config router bgp / set router-id <...>" }));
  }
  const dialGrps = [];
  res.filter(l => l.gen && l.dyn).forEach(l => { if (!dialGrps.some(x => x.a === l.a && x.aIf === l.aIf)) dialGrps.push(l); });
  dialGrps.forEach(l => {
    if (!(expert || g.topo === "hub")) return;
    const h = bgpNode(m, l.a), P = k => l.grpP + k, many = dialGrps.length > 1;
    if (many) msi.fields.push(el("h3", { class: "side-title", text: T("dialOf") + " " + nodeName(m, h) + " · " + l.aIf + (sw ? " · " + (wanOf(m, h, l.aw).if || "") + " ← " + T("colLine").toLowerCase() + " " + (+l.bw || 1) + (l.netId ? " · network-id " + l.netId : "") : "") }));
    if (!many || l.grp === "1_1") msi.fields.push(hf(P("dialName"), "ms.dialName", textCtl(P("dialName"), { maxlength: "15", "data-struct": "blur", placeholder: l.aIf }), { cli: "config vpn ipsec phase1-interface / edit <...>" }));
    msi.fields.push(hf(P("overlay"), "ms.overlay", textCtl(P("overlay")), { cli: "config system interface / set remote-ip <...>" }));
    msi.fields.push(hf(P("dialIp"), "ms.dialIp", textCtl(P("dialIp"), { inputmode: "decimal" }), { cli: "config system interface / set ip <...> 255.255.255.255" }));
  });
  // indirizzi dei tunnel: proposti da Fortissimo, modificabili qui
  const tunRows = (g.links || []).map((l0, i) => ({ l0, i, l: bgpLinkRes(m, l0) })).filter(x => x.l.gen && !x.l.bothDyn && x.l.agg !== "mem");
  if (tunRows.length) {
    msi.fields.push(el("div", { class: "ms-iphead" }, el("h3", { class: "side-title", text: T("tunIps") }),
      el("button", { type: "button", class: "btn small", title: T("tunIpsResetT"), onclick: mutate(() => msResetIps(S.m)) }, T("tunIpsReset"))));
    msi.fields.push(el("p", { class: "bx-note", text: T("tunIpsNote") }));
    msi.fields.push(el("div", { class: "ms-row ms-ip ms-head" }, el("span", { text: T("ttTunnel") }), el("span", { text: T("ttEndA") }), el("span", { text: T("ttEndB") })));
    const CAP = 12, showAll = S.ipAll || !!S.search.trim();
    tunRows.forEach(({ l0, i, l }, k) => {
      if (!showAll && k >= CAP) return;
      const A = bgpNode(m, l0.a), B = bgpNode(m, l0.b), LP = x => "bgpAdv.links." + i + "." + x;
      const end = s => {
        const node = bgpNode(m, l0[s]), hubSide = l.dyn && (l.swapped ? s === "b" : s === "a");
        const wl = l.agg === "pair" ? " · " + (l0[s + "If"] || "") : sw ? " · " + (wanOf(m, node, l0[s + "w"]).if || "") : "";
        if (hubSide) return el("span", { class: "ms-note mono", text: nodeName(m, node) + wl + " · " + (l.aIp || "—") + " (" + T("ttHubIp") + ")" });
        return el("label", { class: "ms-ipin" }, el("span", { class: "ms-ipn", text: nodeName(m, node) + wl }),
          el("input", { type: "text", class: "mono", inputmode: "decimal", value: l0[s + "Ip"] || "", "data-bind": LP(s + "Ip"), spellcheck: "false", autocomplete: "off", placeholder: l.dyn ? (l.range || "") : "169.254.100.x" }));
      };
      msi.fields.push(el("div", { class: "fld ms-row ms-ip", "data-p": LP("aIp"), "data-ps": [LP("aIp"), LP("bIp")].join(" "), "data-search": (nodeName(m, A) + " " + nodeName(m, B) + " " + (l0.aIp || "") + " " + (l0.bIp || "") + " tunnel ip").toLowerCase() },
        el("span", { class: "ms-ipt" }, el("b", { text: nodeName(m, A) + " ⇄ " + nodeName(m, B) }), el("span", { class: "ms-note", text: l.dyn ? "dial-up " + (l.aIf || "") : (l.agg === "pair" ? T("ttAgg") + " · /" : "/") + p2pLen(m) })),
        end("a"), end("b")));
    });
    if (tunRows.length > CAP && !S.search.trim()) msi.fields.push(el("button", { type: "button", class: "btn link show-more", onclick: () => { S.ipAll = !S.ipAll; renderForm(); } },
      S.ipAll ? T("showLess") : T("showMoreTun").replace("{n}", tunRows.length - CAP)));
  }
  secs.push(msi);
  secs.push(cryptoSection(m));
  // 5. BGP
  const msb = { id: "msb", noReset: true, title: T("s_msb"), desc: T("s_msb_d"), fields: [] };
  if (g.topo !== "custom") msb.fields.push(hf("bgpAdv.bgpType", "ms.bgpType", segCtl("bgpAdv.bgpType", [["ibgp", T("bt_ibgp")], ["ebgp", T("bt_ebgp")]], true), { cli: "config router bgp / set as / set remote-as" }));
  if (!g.asManual && g.topo !== "custom") msb.fields.push(hf("bgpAdv.baseAs", "ms.baseAs", textCtl("bgpAdv.baseAs", { inputmode: "numeric" }), { cli: "set as <1-4294967295>" }));
  if (g.topo !== "custom" && (expert || g.asManual)) msb.fields.push(hf("bgpAdv.asManual", "ms.asManual", toggleCtl("bgpAdv.asManual", true)));
  if (dialAll && g.bgpType === "ibgp") msb.fields.push(hf("bgpAdv.advpn", "ms.advpn", toggleCtl("bgpAdv.advpn"), { cli: "set auto-discovery-sender enable / set auto-discovery-receiver enable" }));
  msb.fields.push(hf("route.bh", "route.bh", toggleCtl("route.bh", true), { cli: "config router static / set blackhole enable" }));
  if (m.route.bh) msb.fields.push(hf("route.bhDistance", "route.bhDistance", textCtl("route.bhDistance", { inputmode: "numeric" }), { cli: "set distance <1-255>" }));
  if (expert || g.multipath) msb.fields.push(hf("bgpAdv.multipath", "bx.multipath", toggleCtl("bgpAdv.multipath"), { cli: "set ibgp-multipath enable / set ebgp-multipath enable" }));
  if (expert || g.gr) msb.fields.push(hf("bgpAdv.gr", "bgp.gr", toggleCtl("bgpAdv.gr"), { cli: "set graceful-restart enable / set capability-graceful-restart enable" }));
  if (expert || agg || String(g.keepalive || "").trim() || String(g.holdtime || "").trim()) {
    msb.fields.push(hf("bgpAdv.keepalive", "bgp.keepalive", textCtl("bgpAdv.keepalive", { inputmode: "numeric" }), { cli: "set keepalive-timer <...>" }));
    msb.fields.push(hf("bgpAdv.holdtime", "bgp.holdtime", textCtl("bgpAdv.holdtime", { inputmode: "numeric" }), { cli: "set holdtime-timer <...>" }));
  }
  msb.fields.push(fieldBox({ p: "bgpPwd", badge: "optional", label: H("bgpPwd")[0], hint: H("bgpPwd")[1], why: H("bgpPwd")[2], cli: "set password <...>", control: secretCtl("bgp"), wide: true }));
  secs.push(msb);
  // 6. tunnel e sessioni, filtri
  const adv = bgpAdvSections(m), bl = adv.find(x => x.id === "bl"), bp = adv.find(x => x.id === "bp");
  if (bl) { bl.title = T("s_msl"); bl.desc = T("s_msl_d"); secs.push(bl); }
  if (bp && (expert || (g.pls || []).length || (g.rms || []).length)) secs.push(bp);
  // 7. opzioni per sede
  const asEdit = g.asManual || g.topo === "custom";
  if (expert || asEdit) {
    const showLo = g.topo === "custom" || sites.some(n => String(n.loIp || "").trim());
    const msx = { id: "msx", noReset: true, cls: "ms-tbl", title: T("s_msx"), desc: T("s_msx_d"), fields: [
      ...colHead("ms-x" + (showLo ? "" : " nolo"), "msxColHelp", [[""], [H("bn.rid")[0], "bn.rid"], ["AS", "bn.as"], ["Route reflector", "bn.rr"], ...(showLo ? [[H("bn.loName")[0], "ms.loName"], [H("bn.loIp")[0], "ms.loIp"]] : [])])] };
    sites.forEach(n => {
      const P = x => NP(n, x), nm = nodeName(m, n);
      const inp = (x, lab, opts) => el("input", Object.assign({ type: "text", value: n[x] ?? "", "data-bind": P(x), spellcheck: "false", autocomplete: "off", class: "mono", "aria-label": lab + " · " + nm }, opts || {}));
      msx.fields.push(el("div", { class: "fld ms-row ms-x", "data-p": P("rid"), "data-ps": ["rid", "as", "rr", "loName", "loIp"].map(P).join(" "), "data-search": (nm + " router id as loopback").toLowerCase() },
        el("span", { class: "ms-xn", text: nm }),
        inp("rid", H("bn.rid")[0], { inputmode: "decimal" }),
        asEdit ? inp("as", "AS", { inputmode: "numeric" }) : el("span", { class: "mono ms-note", text: n.as || "—" }),
        g.topo === "custom" ? el("label", { class: "ms-dyn" }, el("input", { type: "checkbox", checked: !!n.rr, "data-bind": P("rr"), "data-kind": "bool", "data-struct": "1" }), el("span", { text: "RR" })) : el("span", { class: "ms-note", text: n.rr ? "RR" : "—" }),
        showLo ? inp("loName", H("bn.loName")[0], { maxlength: "15" }) : null,
        showLo ? inp("loIp", H("bn.loIp")[0], { inputmode: "decimal" }) : null));
    });
    msx.fields.forEach(f => { if (f.classList && f.classList.contains("ms-x") && !showLo) f.classList.add("nolo"); });
    msx.fields.push(el("p", { class: "bx-note" }, el("b", { text: "Loopback: " }), T(sdwanOn(m) && !agg ? "loNoteSdwan" : showLo ? "loNoteCustom" : "loNote")));
    secs.push(msx);
  }
  return secs;
}

/* crittografia comune */
function cryptoSection(m) {
  const c = m.crypto;
  const cr = { id: "crypto", title: T("s_crypto"), desc: T("s_crypto_d"), paths: ["crypto.ike", "crypto.mode", "crypto.p1", "crypto.dh1", "crypto.life1", "crypto.p2", "crypto.pfs", "crypto.dh2", "crypto.life2"], fields: [] };
  cr.fields.push(helpField("crypto.ike", "crypto.ike", segCtl("crypto.ike", [["2", "IKEv2"], ["1", "IKEv1"]], true), { cli: "set ike-version 1 | 2" }));
  if (c.ike === "1") cr.fields.push(helpField("crypto.mode", "crypto.mode", segCtl("crypto.mode", [["main", "main"], ["aggressive", "aggressive"]]), { cli: "set mode main | aggressive" }));
  cr.fields.push(helpField("crypto.p1", "crypto.p1", checksCtl("crypto.p1", P1_PROPS, x => c.ike === "2" || !x.ike2), { wide: true, noFor: true, cli: "set proposal <...>" }));
  cr.fields.push(helpField("crypto.dh1", "crypto.dh1", checksCtl("crypto.dh1", DH_GROUPS), { wide: true, noFor: true, cli: "set dhgrp <...>" }));
  cr.fields.push(helpField("crypto.life1", "crypto.life1", textCtl("crypto.life1", { inputmode: "numeric" }), { cli: "set keylife <120-172800>" }));
  cr.fields.push(helpField("crypto.p2", "crypto.p2", checksCtl("crypto.p2", P2_PROPS), { wide: true, noFor: true, cli: "phase2: set proposal <...>" }));
  cr.fields.push(helpField("crypto.pfs", "crypto.pfs", segCtl("crypto.pfs", [["enable", T("on")], ["disable", T("off")]], true), { cli: "phase2: set pfs enable | disable" }));
  if (c.pfs === "enable") cr.fields.push(helpField("crypto.dh2", "crypto.dh2", checksCtl("crypto.dh2", DH_GROUPS), { wide: true, noFor: true, cli: "phase2: set dhgrp <...>" }));
  cr.fields.push(helpField("crypto.life2", "crypto.life2", textCtl("crypto.life2", { inputmode: "numeric" }), { cli: "phase2: set keylifeseconds <120-172800>" }));
  return cr;
}

function resetSection(sec) {
  const r = presetRef();
  if (sec.adv) {
    sec.opts.forEach(o => ["a", "b"].forEach(s => { const v = (r.adv[s] || {})[o.k]; if (v === undefined) delete S.m.adv[s][o.k]; else S.m.adv[s][o.k] = v; }));
  } else {
    (sec.paths || []).forEach(p => { const v = p.split(".").reduce((o, k) => (o == null ? o : o[k]), r); if (v !== undefined) setP(p, JSON.parse(JSON.stringify(v))); });
  }
  renderForm(); refresh();
}

function renderForm() {
  const host = $("#form"); const scrollY = window.scrollY;
  const active = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-bind");
  uid = 0; host.textContent = "";
  const q = S.search.trim().toLowerCase();
  let n = 0, any = false;
  const jump = el("nav", { class: "jump", "aria-label": T("jumpTo") }); host.appendChild(jump);
  buildSections().forEach(sec => {
    let fields = sec.fields;
    if (sec.adv && S.mode === "essential" && !q) {
      fields = fields.filter(f => {
        const ps = (f.getAttribute("data-ps") || "").split(" ");
        const k = ps[0].split(".").slice(2).join(".");
        return sec.essentialOnly.includes(k) || ps.some(p => { const v = getP(p); return v !== undefined && v !== null && v !== ""; });
      });
    }
    if (q) fields = fields.filter(f => !f.classList || !f.classList.contains("fld") ? false : f.getAttribute("data-search").includes(q) || (f.getAttribute("data-ps") || "").includes(q));
    if (q && sec.id === "sides") {
      fields = sec.fields.flatMap(f => f.classList && f.classList.contains("fld") ? [f] : $$(".fld", f)).filter(f => f.getAttribute("data-search").includes(q));
    }
    if (!fields.length) return;
    any = true; n++;
    const wrap = el("section", { class: "sec", id: "sec-" + sec.id, "aria-labelledby": "h-" + sec.id },
      el("header", { class: "sec-head" },
        el("span", { class: "num", "aria-hidden": "true", text: String(n) }),
        el("div", null, el("h2", { id: "h-" + sec.id, text: sec.title }), sec.desc ? el("p", { text: sec.desc }) : null),
        sec.id !== "scn" && !sec.noReset ? el("button", { type: "button", class: "btn link", onclick: () => resetSection(sec) }, T("resetSection")) : null),
      el("div", { class: "fields" + (sec.cls ? " " + sec.cls : "") }, fields));
    host.appendChild(wrap);
  });
  $$(".sec", host).forEach(x => { const h = $("h2", x); jump.appendChild(el("button", { type: "button", class: "jump-b", onclick: () => x.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }) }, $(".num", x).textContent + " " + h.textContent)); });
  if ($$(".sec", host).length < 6) jump.remove();
  if (!any) host.appendChild(el("p", { class: "empty", text: T("searchEmpty") }));
  if (active) { const f = $('[data-bind="' + active + '"]', host); if (f && f.type !== "radio" && f.type !== "checkbox") { f.focus(); try { const l = f.value.length; f.setSelectionRange(l, l); } catch (e) {} } }
  window.scrollTo(0, scrollY);
  markFields();
}

/* ---------- eventi del modulo ---------- */
function onFormEvent(e) {
  const t = e.target;
  if (t.matches("[data-secret]")) { S.sec[t.getAttribute("data-secret")] = t.value; refresh(); return; }
  const p = t.getAttribute("data-bind"); if (!p) return;
  if (e.type === "input" && (t.type === "radio" || t.type === "checkbox" || t.tagName === "SELECT")) return;
  // il change dei campi di testo arriva al blur: il valore è già stato applicato dall'input, e rigenerare le schede farebbe perdere il clic
  if (e.type === "change" && (t.tagName === "TEXTAREA" || t.type === "text" || t.type === "password") && t.getAttribute("data-struct") !== "blur") return;
  let v;
  if (t.getAttribute("data-kind") === "bool") v = t.checked;
  else if (t.getAttribute("data-kind") === "list") {
    const group = t.closest("[data-group]");
    v = $$("input[type=checkbox]", group).filter(i => i.checked).map(i => i.value);
  } else v = t.value;
  if (p.startsWith("adv.")) {
    const key = t.getAttribute("data-adv"), o = OPT_BY_KEY[key];
    optSides(o).forEach(s => setP("adv." + s + "." + key, typeof v === "string" ? v.trim() : v));
  } else setP(p, v);
  if (p === "bgpAdv.topo" && v !== "custom") S.m.bgpAdv.bgpType = v === "mesh" ? "ebgp" : "ibgp";
  if (p === "crypto.ike" && v === "1") {
    const c = S.m.crypto, ike2only = P1_PROPS.filter(x => x.ike2).map(x => x.v);
    c.p1 = c.p1.filter(x => !ike2only.includes(x)); if (!c.p1.length) c.p1 = ["aes256-sha256"];
  }
  if (t.getAttribute("data-struct") === "1" || p === "fos" || (t.getAttribute("data-struct") === "blur" && e.type === "change")) renderForm();
  else {
    const box = t.closest(".fld");
    if (box) { const dot = $(".dot", box); const ch = !same(getP(box.getAttribute("data-p")), refVal(box.getAttribute("data-p"))); if (ch && !dot && $(".fld-head label", box)) $(".fld-head label", box).after(el("span", { class: "dot", title: T("changed") })); if (!ch && dot) dot.remove(); }
  }
  refresh();
}

/* ---------- topologia ---------- */
function renderTopo() {
  const m = S.m, sc = m.scenario, c = m.crypto, host = $("#topo"); host.textContent = "";
  const dial = DIAL(sc), nid = parseInt(m.ident.networkId, 10) || 0;
  const nets = s => parseNets(m[s].nets).out.map(n => n.net + "/" + n.p);
  const row = (k, v, cls) => el("div", { class: "t-row" + (cls ? " " + cls : "") }, el("span", { class: "t-k", text: k }), el("span", { class: "t-v", text: v }));
  const chips = list => el("div", { class: "t-chips" }, list.length ? list.map(x => el("span", { class: "t-chip", text: x })) : el("span", { class: "t-chip empty", text: T("topoNoNets") }));
  const node = s => {
    const N = m[s], kids = [el("span", { class: "role", text: sideLabel(s) }), el("b", { text: N.label || "FortiGate" })];
    if (sc === "s2sdyn" && s === "b") kids.push(row("WAN", T("topoDyn")), m.ident.localid ? row("ID", m.ident.localid) : null);
    else kids.push(row(N.wan || "wan", N.ip || N.fqdn || "—"));
    if (sc === "s2s" && m.dual.on) {
      if (s === "a") kids.push(row(m.dual.aWan || "wan2", m.dual.aIp || m.dual.aFqdn || "—"));
      else if (m.dual.bIp || m.dual.bFqdn) kids.push(row(m.dual.bWan || "wan2", m.dual.bIp || m.dual.bFqdn));
    }
    if ((sc === "s2s" || (sc === "s2sdyn" && ipsecBgp(m))) && N.tip) kids.push(row(T("topoTip"), N.tip));
    if (sc === "s2s" && m.dual.on && (s === "a" ? m.dual.aTip : m.dual.bTip)) kids.push(row(T("topoTip") + " 2", s === "a" ? m.dual.aTip : m.dual.bTip));
    kids.push(el("span", { class: "t-k sm", text: T("topoLan") }), chips(nets(s)));
    return el("div", { class: "node " + s }, kids.filter(Boolean));
  };
  // collegamento
  const wires = [];
  const tName = (x, y) => (x || "—") + "  ⇄  " + (y || "—");
  if (dial) wires.push({ label: m.a.tunnel || "—", note: T("topoDialNote"), kind: "solid" });
  else {
    wires.push({ label: tName(m.a.tunnel, m.b.tunnel), note: sc === "s2sdyn" ? T("topoDynNote") : (m.dual.on ? "WAN 1" : ""), kind: "solid" });
    if (sc === "s2s" && m.dual.on) wires.push({ label: tName(m.dual.aTunnel, m.dual.bTunnel), note: "WAN 2 · " + (m.dual.mode === "ecmp" || ipsecBgp(m) ? T("topoEcmp") : m.dual.mode === "standby" ? T("topoStandby") : T("topoBackup")), kind: m.dual.mode === "ecmp" || ipsecBgp(m) ? "solid" : "dashed" });
  }
  const link = el("div", { class: "link" }, wires.map(w => el("div", { class: "t-wire " + w.kind },
    el("span", { class: "tn", text: w.label }), el("span", { class: "wire", "aria-hidden": "true" }), w.note ? el("span", { class: "meta", text: w.note }) : null)));
  // lato destro
  let right;
  if (dial) {
    const d = m.dial;
    right = el("div", { class: "node b" }, el("span", { class: "role", text: sideLabel("b") }), el("b", { text: d.client || "FortiClient" }),
      row(T("topoPool"), (d.poolStart || "—") + " – " + (d.poolEnd || "—")),
      row("DNS", [d.dns1, d.dns2].filter(Boolean).join(", ") || "—"),
      row(T("topoRoute"), d.split === "split" ? T("topoSplit") : T("topoFull")),
      c.ike === "2" && m.trans.mode !== "udp" ? row(T("topoTrans"), "TCP " + (m.trans.port || "?")) : null,
      d.auth === "saml" ? row("SSO", T("topoPort") + " " + (d.samlPort || "?")) : null,
      nid ? row("Network ID", String(nid)) : null);
  } else right = node("b");
  // server di autenticazione per i dial-up
  let auth = null;
  if (dial) {
    const d = m.dial, t = { local: [T("dial_local"), T("topoLocalNote")], ldap: ["Active Directory", (d.ldapCreate ? (d.ldapIp || "—") : (d.ldapServer || "—")) + (d.ldapSecure !== "disable" && d.ldapCreate ? " · " + d.ldapSecure.toUpperCase() : "")],
      radius: ["RADIUS", d.radiusCreate ? (d.radiusIp || "—") : (d.radiusServer || "—")], saml: ["Microsoft Entra ID", T("topoPort") + " " + (d.samlPort || "?") + (d.tenant ? " · " + d.tenant.slice(0, 8) + "…" : "")] }[d.auth];
    auth = el("div", { class: "t-auth" }, el("span", { class: "role", text: T("topoAuthSrv") }), el("b", { text: t[0] }), el("span", { class: "t-v", text: t[1] }));
  }
  // schede riassuntive
  const card = (title, lines) => el("div", { class: "t-card" }, el("span", { class: "t-ct", text: title }), lines.filter(Boolean).map(x => el("span", { class: "t-cl", text: x })));
  const hrs = v => v ? (v % 3600 === 0 ? v / 3600 + " h" : v + " s") : "—";
  const authTxt = dial ? T("dial_" + m.dial.auth) + " · PSK" : (m.auth.method === "cert" ? T("auth_cert") : "PSK");
  const sel = sc === "s2s" ? (m.sel.mode === "subnets" ? T("topoSelN") : "0.0.0.0/0") : (sc === "s2sdyn" ? (ipsecBgp(m) ? "0.0.0.0/0" : T("topoSelN")) : "0.0.0.0/0");
  let routing;
  if (advOn(m)) {
    const g = m.bgpAdv, sites = msSites(m), ases = [...new Set(sites.map(n => String(n.as)))], hub = msHub(m);
    routing = [(ases.length === 1 ? "iBGP AS " + ases[0] : "eBGP · " + ases.length + " AS") + (hub && hub.rr ? " · RR" : "") + (advpnOn(m) ? " · ADVPN" : ""), m.route.bh ? T("topoBh") : ""];
  }
  else if (dial) routing = [T("topoAddRoute")];
  else if (m.bgp.on) routing = ["BGP AS " + (m.bgp.asA || "?") + " ⇄ " + (m.bgp.asB || "?") + " (" + (String(m.bgp.asA) === String(m.bgp.asB) ? "iBGP" : "eBGP") + ")", m.route.bh ? T("topoBh") : ""];
  else routing = [m.route.on ? T("topoStatic") + " · " + T("topoDist") + " " + (m.route.distance || "10") : T("topoNoRoutes"), sc === "s2sdyn" ? T("topoAddRoute") : "", m.route.bh ? T("topoBh") : ""];
  const trans = dial && c.ike === "2" && m.trans.mode !== "udp" ? "TCP " + (m.trans.port || "?") : "UDP 500 / 4500";
  const cards = el("div", { class: "t-cards" },
    card("Phase 1", ["IKEv" + c.ike + (c.ike === "1" ? " " + c.mode : ""), (c.p1[0] || "—") + (c.p1.length > 1 ? " +" + (c.p1.length - 1) : ""), "DH " + (c.dh1.join(", ") || "—") + " · " + hrs(+c.life1)]),
    card("Phase 2", [(c.p2[0] || "—") + (c.p2.length > 1 ? " +" + (c.p2.length - 1) : ""), c.pfs === "enable" ? "PFS DH " + (c.dh2.join(", ") || "—") : T("topoNoPfs"), hrs(+c.life2) + " · " + sel]),
    sc === "ms" ? card(T("topoTopo"), [T("topo_" + m.bgpAdv.topo) + (msHub(m) ? " · " + nodeName(m, msHub(m)) : ""), msSites(m).length + " " + T("sitesCount") + " · " + (m.bgpAdv.links || []).map(l => bgpLinkRes(m, l)).filter(l => l.gen && !l.bothDyn).length + " " + T("tunnelsN"),
      (m.bgpAdv.topo === "hub" ? T("hm_" + m.bgpAdv.hubMode) : "") + (sdwanOn(m) ? (m.bgpAdv.topo === "hub" ? " · " : "") + "SD-WAN " + (m.bgpAdv.sdwan.zone || "VPN") : "")])
    : card(T("topoAuth"), [authTxt, (sc === "dialup" || sc === "s2sdyn") && c.ike === "2" ? "Network ID " + nid : ""]),
    card("Routing", routing),
    card(T("topoTrans"), [trans, dial ? "" : "NAT-T " + ((m.adv.a || {})["p1.nattraversal"] || "enable"), !dial && m.fec.on ? "FEC " + (m.fec.base || "20") + "+" + (m.fec.redundant || "10") : "",
      (sc === "dialup" || sc === "s2sdyn") && m.gwm.mode !== "any" ? T("topoSrc") + " " + ({ ipmask: m.gwm.subnet, iprange: m.gwm.start + "–" + m.gwm.end, geography: String(m.gwm.country).toUpperCase() }[m.gwm.mode] || "?") : ""]));
  // stato delle verifiche
  const ne = S.checks.filter(x => x.lvl === "err").length, nw = S.checks.filter(x => x.lvl === "warn").length;
  const status = el("button", { type: "button", class: "t-status " + (ne ? "err" : nw ? "warn" : "ok"),
    onclick: () => { S.tab = "chk"; if (S.view !== "out") setView("out"); renderTabs(); renderPanel(); $("#tab-chk") && $("#tab-chk").focus(); } },
    ne || nw ? (ne + " " + T(ne === 1 ? "topoErr1" : "topoErrN") + " · " + nw + " " + T(nw === 1 ? "topoWarn1" : "topoWarnN") + ": " + T("topoOpen")) : T("topoOk"));
  if (sc === "ms") host.append(cards);
  else host.append(el("div", { class: "t-grid" + (dial ? " dial" : "") }, node("a"), link, right, auth), cards);
  if (advOn(m)) host.append(bgpTopo(m));
  host.append(status);
}

/* ---------- modulo BGP avanzato: sezioni del modulo ---------- */
function bgpAdvSections(m) {
  const g = m.bgpAdv, secs = [], expert = S.mode === "expert";
  const hf = (p, key, ctl, extra) => helpField(p, key, ctl, Object.assign({ changed: false }, extra || {}));
  const hfL = (p, key, suffix, ctl, extra) => hf(p, key, ctl, Object.assign({ label: H(key)[0] + " · " + suffix }, extra || {}));
  S.bgpOpen = S.bgpOpen || {};
  const isOpen = (id, count) => S.search.trim() ? true : (S.bgpOpen[id] !== undefined ? S.bgpOpen[id] : count <= 2);
  const sibs = id => (id && id[0] === "n" ? g.nodes : g.links).map(x => x.id);
  const row = (title, info, id, pre, onRemove) => el("div", { class: "site-row" },
    el("button", { type: "button", class: "site-sum", "aria-expanded": "false", onclick: () => { sibs(id).forEach(x => { S.bgpOpen[x] = false; }); S.bgpOpen[id] = true; renderForm(); } },
      el("b", { text: title }), el("span", { class: "mono", text: info }), errIn(pre) ? el("span", { class: "tag weak", text: T("hasErr") }) : null),
    onRemove ? el("button", { type: "button", class: "row-x", title: T("remove"), "aria-label": T("remove") + " " + title, onclick: onRemove }, "×") : null);
  const CK = runChecks(m, S.sec, S.lang), errIn = pre => CK.some(c => c.lvl === "err" && c.p && c.p.startsWith(pre));
  const head = (title, onRemove, id, count, pre) => {
    const open = id ? isOpen(id, count) : true;
    return el("div", { class: "bx-head" },
      el("h3", { class: "side-title", text: title }, pre && errIn(pre) ? el("span", { class: "tag weak", style: "margin-left:8px", text: T("hasErr") }) : null),
      el("span", { class: "bx-acts" },
        id ? el("button", { type: "button", class: "btn link", "aria-expanded": String(open), onclick: () => { if (!open) sibs(id).forEach(x => { S.bgpOpen[x] = false; }); S.bgpOpen[id] = !open; renderForm(); } }, T(open ? "closeL" : "openL")) : null,
        onRemove ? el("button", { type: "button", class: "btn link", onclick: onRemove }, T("remove")) : null));
  };
  const mutate = f => () => { f(); renderForm(); refresh(); };
  const nodeSel = p => id => { const cur = getP(p); return el("select", { id, "data-bind": p, "data-struct": "1" },
    el("option", { value: "", selected: !cur }, "—"), (g.nodes || []).map(n => el("option", { value: n.id, selected: cur === n.id }, nodeName(m, n)))); };
  const area = (p, ph) => id => el("textarea", { id, "data-bind": p, spellcheck: "false", rows: "3", placeholder: ph || null }, String(getP(p) ?? ""));
  const filled = v => v !== undefined && v !== null && v !== "" && v !== false;
  // 1. schema e opzioni comuni
  const site = m.scenario === "s2s" || m.scenario === "s2sdyn";
  const tplBtn = id => el("button", { type: "button", class: "btn small" + (g.tpl === id ? " primary" : ""), disabled: id === "ipsec" && !site ? true : null,
    title: id === "ipsec" && !site ? T("tplNoIpsec") : null, onclick: mutate(() => { S.m.bgpAdv = bgpTemplate(S.m, id, S.lang); }) }, T("tpl_" + id));
  const bx = { id: "bx", noReset: true, title: T("s_bx"), desc: T("s_bx_d"), fields: [
    el("div", { class: "bx-row" }, ["ipsec", "hub", "isp", "primbak"].map(tplBtn)), el("p", { class: "bx-note", text: T("tplNote") }),
    hf("bgpAdv.autoLink", "bx.autoLink", segCtl("bgpAdv.autoLink", [["hub", T("al_hub")], ["mesh", T("al_mesh")], ["none", T("al_none")]]), { wide: true }),
    hf("bgpAdv.pool", "bx.pool", textCtl("bgpAdv.pool"), { cli: "config system interface / set ip <...>" }),
    fieldBox({ p: "psk", label: H("psk")[0], hint: H("psk")[1] + ". " + T("pskNote"), why: H("psk")[2], cli: "set psksecret <...>", control: secretCtl("psk"), wide: true }),
    hf("bgpAdv.multipath", "bx.multipath", toggleCtl("bgpAdv.multipath"), { cli: "set ibgp-multipath enable / set ebgp-multipath enable" }),
    hf("bgpAdv.gr", "bgp.gr", toggleCtl("bgpAdv.gr"), { cli: "set graceful-restart enable / set capability-graceful-restart enable" }),
    hf("bgpAdv.keepalive", "bgp.keepalive", textCtl("bgpAdv.keepalive", { inputmode: "numeric" }), { cli: "set keepalive-timer <...>" }),
    hf("bgpAdv.holdtime", "bgp.holdtime", textCtl("bgpAdv.holdtime", { inputmode: "numeric" }), { cli: "set holdtime-timer <...>" }),
    fieldBox({ p: "bgpPwd", badge: "optional", label: H("bgpPwd")[0], hint: H("bgpPwd")[1], why: H("bgpPwd")[2], cli: "set password <...>", control: secretCtl("bgp"), wide: true })] };
  if (m.scenario === "s2sdyn" && (g.links || []).some(l => l.src)) bx.fields.push(
    hf("bgp.overlay", "bgp.overlay", textCtl("bgp.overlay"), { wide: true, cli: "config neighbor-range / set prefix <...>" }),
    hf("a.tip", "bgp.tipHub", textCtl("a.tip", { inputmode: "decimal" }), { cli: "config system interface / set ip <...>" }),
    hf("b.tip", "bgp.tipBranch", textCtl("b.tip", { inputmode: "decimal" }), { cli: "config system interface / set ip <...>" }));
  secs.push(bx);
  // 2. nodi
  const ns = { id: "bn", noReset: true, title: T("s_bn"), desc: T("s_bn_d"), fields: [] };
  (g.nodes || []).forEach((n, i) => {
    const P = k => "bgpAdv.nodes." + i + "." + k, bound = n.ipsec && m[n.ipsec];
    const rmN = mutate(() => { S.m.bgpAdv.nodes.splice(i, 1); S.m.bgpAdv.links = S.m.bgpAdv.links.filter(l => l.a !== n.id && l.b !== n.id); });
    if (!isOpen(n.id, g.nodes.length)) { ns.fields.push(row(nodeName(m, n) + (n.ext ? " (" + T("extNoCfg") + ")" : ""), "AS " + (n.as || "—") + (n.rr ? " · RR" : "") + (n.rid ? " · " + n.rid : ""), n.id, "bgpAdv.nodes." + i + ".", rmN)); return; }
    ns.fields.push(head(T("node") + " " + (i + 1) + " · " + nodeName(m, n) + (n.ext ? " (" + T("extNoCfg") + ")" : ""),
      mutate(() => { S.m.bgpAdv.nodes.splice(i, 1); S.m.bgpAdv.links = S.m.bgpAdv.links.filter(l => l.a !== n.id && l.b !== n.id); }), n.id, g.nodes.length, "bgpAdv.nodes." + i + "."));
    ns.fields.push(hf(P("name"), "bn.name", textCtl(P("name"), { "data-struct": "blur", placeholder: bound ? (m[n.ipsec].label || "") : null })));
    ns.fields.push(hf(P("as"), "bn.as", textCtl(P("as"), { inputmode: "numeric", "data-struct": "blur" }), { cli: "set as <1-4294967295>" }));
    ns.fields.push(hf(P("ext"), "bn.ext", toggleCtl(P("ext"), true)));
    const sesN = bgpSessions(m, n.id), usesGen = sesN.some(x => x.l.gen);
    if (n.ext) {
      if (usesGen) { ns.fields.push(hf(P("pubIp"), "bn.pubIp", textCtl(P("pubIp"), { inputmode: "decimal" }))); ns.fields.push(hf(P("fqdn"), "bn.fqdn", textCtl(P("fqdn")))); }
      return;
    }
    ns.fields.push(hf(P("rid"), "bn.rid", textCtl(P("rid"), { inputmode: "decimal" }), { cli: "set router-id <ip>" }));
    ns.fields.push(hf(P("rr"), "bn.rr", toggleCtl(P("rr"), true), { cli: "set route-reflector-client enable" }));
    if (bound) ns.fields.push(hf(P("nets"), "bn.nets", area(P("nets"), String(m[n.ipsec].nets || "").trim()), { wide: true, cli: "config network / set prefix <...>" }));
    if (bound) ns.fields.push(el("p", { class: "bx-note", text: T("boundNote") + ": " + (nodeWan(m, n) || "—") + " · " + (nodeGw(m, n) || (nodeDyn(m, n) ? T("topoDyn") : "—")) }));
    else ns.fields.push(el("p", { class: "bx-note", text: T("siteInSides") + ": " + (nodeWan(m, n) || "—") + " · " + (nodeDyn(m, n) ? T("topoDyn") : (nodeGw(m, n) || "—")) }));
    if (sesN.some(x => x.l.gen && x.dynHub)) {
      ns.fields.push(el("h3", { class: "side-title", text: T("hubOf") + " " + nodeName(m, n) }));
      ns.fields.push(hf(P("dialName"), "bn.dialName", textCtl(P("dialName"), { maxlength: "15", "data-struct": "blur" }), { cli: "config vpn ipsec phase1-interface / edit <...>" }));
      ns.fields.push(hf(P("overlay"), "bn.overlay", textCtl(P("overlay")), { cli: "config neighbor-range / set prefix <...>" }));
      ns.fields.push(hf(P("dialIp"), "bn.dialIp", textCtl(P("dialIp"), { inputmode: "decimal" }), { cli: "config system interface / set ip <...>" }));
    }
    if (bgpSessions(m, n.id).some(s => s.loop) || expert || filled(n.loIp)) {
      ns.fields.push(hf(P("loName"), "bn.loName", textCtl(P("loName"), { maxlength: "15" }), { cli: "config system interface / set type loopback" }));
      ns.fields.push(hf(P("loIp"), "bn.loIp", textCtl(P("loIp"), { inputmode: "decimal" }), { cli: "set ip <...> 255.255.255.255" }));
    }
    if (expert || n.redisConn || n.redisStatic) {
      ns.fields.push(hf(P("redisConn"), "bn.redisConn", toggleCtl(P("redisConn"), true), { cli: 'config redistribute "connected"' }));
      ns.fields.push(hf(P("redisStatic"), "bn.redisStatic", toggleCtl(P("redisStatic"), true), { cli: 'config redistribute "static"' }));
      if (n.redisConn || n.redisStatic) ns.fields.push(hf(P("redisRm"), "bn.redisRm", textCtl(P("redisRm")), { cli: "set route-map <...>" }));
    }
  });
  ns.fields.push(el("div", { class: "bx-row" }, el("button", { type: "button", class: "btn small", onclick: mutate(() => { const id = bgpAddNode(S.m, S.lang); S.bgpOpen[id] = true; }) }, T("addNode"))));
  secs.push(ns);
  // 3. sessioni
  const ls = { id: "bl", noReset: true, title: T("s_bl"), desc: T("s_bl_d"), fields: [] };
  const msGen = m.scenario === "ms" && g.topo !== "custom";
  if (msGen) ls.fields.push(el("p", { class: "bx-note", text: T("mslNote") }), el("div", { class: "bx-row" },
    el("button", { type: "button", class: "btn small", title: T("autoResetT"), onclick: mutate(() => { (S.m.bgpAdv.links || []).forEach(x => { if (bgpGenLink(x) && x.auto) linkAutoReset(S.m, x); }); bgpNormalize(S.m); }) }, T("autoResetAll"))));
  // l'aggregato della coppia di sedi di un membro, con il nome visto dal lato a del membro
  const aggOf = l0 => { const p = (g.links || []).find(x => x.agg === "pair" && ((x.a === l0.a && x.b === l0.b) || (x.a === l0.b && x.b === l0.a))); return p ? (p.a === l0.a ? p.aIf : p.bIf) : ""; };
  if ((g.links || []).length > 4) {
    if (S.linkFilter && !bgpNode(m, S.linkFilter)) S.linkFilter = "";
    ls.fields.push(el("div", { class: "bx-row link-filter" }, el("label", { for: "lnkf", text: T("linkFilter") }),
      el("select", { id: "lnkf", onchange: e => { S.linkFilter = e.target.value; renderForm(); } },
        el("option", { value: "", selected: !S.linkFilter }, T("allNodes") + " (" + g.links.length + ")"),
        (g.nodes || []).map(n => el("option", { value: n.id, selected: S.linkFilter === n.id }, nodeName(m, n) + " (" + g.links.filter(l => l.a === n.id || l.b === n.id).length + ")")))));
  }
  const LCAP = 8; let shownL = 0, hiddenL = 0;
  // rete multi-sede: i tunnel sono raggruppati per coppia di sedi, con l'aggregato in testa; un gruppo si apre con un clic
  const gKey = l0 => [l0.a, l0.b].sort().join("|"), GR = {}, first = {};
  let order = (g.links || []).map((x, i) => i);
  if (msGen) {
    order.forEach(i => { const k = gKey(g.links[i]); if (!(k in first)) first[k] = i; (GR[k] = GR[k] || []).push(i); });
    order.sort((x, y) => first[gKey(g.links[x])] - first[gKey(g.links[y])] || (g.links[y].agg === "pair") - (g.links[x].agg === "pair") || x - y);
    S.grpOpen = S.grpOpen || {};
    const keys = Object.keys(GR);
    if (keys.length > 1) ls.fields.push(el("div", { class: "bx-row" },
      el("button", { type: "button", class: "btn link", onclick: () => { keys.forEach(k => { S.grpOpen[k] = true; }); renderForm(); } }, T("grpOpenAll")),
      el("button", { type: "button", class: "btn link", onclick: () => { keys.forEach(k => { S.grpOpen[k] = false; }); renderForm(); } }, T("grpCloseAll"))));
  }
  const grpIsOpen = k => !!S.search.trim() || Object.keys(GR).length <= 1 || !!(S.grpOpen && S.grpOpen[k]);
  let curK = null, curHidden = false, shownG = 0, hiddenG = 0;
  order.forEach(i => {
    const l0 = g.links[i];
    if (S.linkFilter && l0.a !== S.linkFilter && l0.b !== S.linkFilter && !S.search.trim()) return;
    if (msGen) {
      const k = gKey(l0);
      if (k !== curK) {
        curK = k;
        curHidden = !S.linkAll && !S.linkFilter && !S.search.trim() && shownG >= LCAP;
        if (curHidden) { hiddenL += GR[k].length; hiddenG++; }
        else {
          shownG++;
          const ids = GR[k], A = bgpNode(m, l0.a), B = bgpNode(m, l0.b), pr = ids.map(x => g.links[x]).find(x => x.agg === "pair"), nT = ids.filter(x => g.links[x].agg !== "pair").length;
          const prR = pr ? bgpLinkRes(m, pr) : null, open = grpIsOpen(k), err = ids.some(x => errIn("bgpAdv.links." + x + "."));
          const ib = A && B && String(A.as) === String(B.as) ? "iBGP" : "eBGP";
          ls.fields.push(el("div", { class: "site-row ms-grp" }, el("button", { type: "button", class: "site-sum", "aria-expanded": String(open), onclick: () => { S.grpOpen[k] = !open; renderForm(); } },
            el("b", { text: (A ? nodeName(m, A) : "?") + " ⇄ " + (B ? nodeName(m, B) : "?") }),
            el("span", { class: "mono", text: nT + " " + T("grpTun") + " · " + (prR ? T("ttAgg") + " " + (prR.aIf || "—") + " · " + (prR.aIp || "—") + " – " + (prR.bIp || "—") + " · " : "") + ib }),
            err ? el("span", { class: "tag weak", text: T("hasErr") }) : null)));
        }
      }
      if (curHidden || !grpIsOpen(k)) return;
    } else {
      if (!S.linkAll && !S.linkFilter && !S.search.trim() && shownL >= LCAP && !(S.bgpOpen[l0.id])) { hiddenL++; return; }
      shownL++;
    }
    const P = k => "bgpAdv.links." + i + "." + k, l = bgpLinkRes(m, l0), autoL = !!l0.auto && !(m.scenario === "ms" && g.topo === "custom");
    const mem = l0.agg === "mem", pair = l0.agg === "pair";
    const A = bgpNode(m, l0.a), B = bgpNode(m, l0.b), nA = A ? nodeName(m, A) : "A", nB = B ? nodeName(m, B) : "B";
    if (!isOpen(l0.id, g.links.length) && msGen) {
      const r = row((l.aIf || "—") + " ⇄ " + (l.bIf || "—"), mem ? "IPsec · " + T("memOf") + " " + (aggOf(l0) || "—")
        : (pair ? T("ttAgg") + " · " : "") + (A && B && String(A.as) === String(B.as) ? "iBGP" : "eBGP") + " · " + (l.aIp || "—") + " – " + (l.bIp || "—") + (l.dyn ? " · dial-up" : ""), l0.id, "bgpAdv.links." + i + ".", null);
      r.classList.add("in-grp"); ls.fields.push(r);
      return;
    }
    if (!isOpen(l0.id, g.links.length)) {
      ls.fields.push(row(nA + " ⇄ " + nB, mem ? "IPsec · " + (l.aIf || "—") + " ⇄ " + (l.bIf || "—") + " · " + T("memOf") + " " + (aggOf(l0) || "—") : (pair ? T("ttAgg") + " · " : "") + (A && B && String(A.as) === String(B.as) ? "iBGP" : "eBGP") + (l.gen ? " · " + (l.aIf || "—") + " ⇄ " + (l.bIf || "—") + " · " + (l.aIp || "—") + " – " + (l.bIp || "—") : l.src ? " · IPsec " + (l.aIf || "—") : " · " + (l.aIf || "—")) + (l.dyn ? " · dial-up" : ""),
        l0.id, "bgpAdv.links." + i + ".", autoL ? null : mutate(() => S.m.bgpAdv.links.splice(i, 1))));
      return;
    }
    ls.fields.push(head((pair ? T("aggL") : autoL ? "Tunnel" : T("link")) + " " + (i + 1) + " · " + nA + " ⇄ " + nB, autoL ? null : mutate(() => S.m.bgpAdv.links.splice(i, 1)), l0.id, g.links.length, "bgpAdv.links." + i + "."));
    if (!autoL) ls.fields.push(hf(P("a"), "bl.a", nodeSel(P("a"))), hf(P("b"), "bl.b", nodeSel(P("b"))));
    if (l0.src) {
      ls.fields.push(el("p", { class: "bx-note", text: T(l0.src === "ipsec2" ? "fromIpsec2" : "fromIpsec1") + ": " + (l.aIf || "—") + " " + (l.aIp || "—") + "  ⇄  " +
        (l.bIf || "—") + " " + (l.bIp || "—") + (l.dyn ? " · neighbor-range " + (l.range || "—") : "") + ". " + T("fromIpsecNote") }));
    } else if (l.gen) {
      if (!autoL) {
        ls.fields.push(hf(P("kind"), "bl.kind", segCtl(P("kind"), [["tunnel", T("kind_tunnel")], ["phys", T("kind_phys")]], true)));
        ls.fields.push(hf(P("ipsec"), "bl.ipsec", toggleCtl(P("ipsec"), true), { cli: "config vpn ipsec phase1-interface / phase2-interface" }));
      }
      ls.fields.push(el("p", { class: "bx-note", text: (mem ? T("memNote") + " (" + (aggOf(l0) || "—") + ")" : pair ? T("aggNote") : T("genNote")) + (l.dyn ? " " + T("dialNote") + " " + (l.aIf || "") + " (" + (l.range || "—") + ")." : "") }));
      if (autoL) ls.fields.push(el("div", { class: "bx-row" }, el("button", { type: "button", class: "btn small", title: T("autoResetT"), onclick: mutate(() => { linkAutoReset(S.m, S.m.bgpAdv.links[i]); bgpNormalize(S.m); }) }, T("autoReset"))));
      [["a", A, nA, B], ["b", B, nB, A]].forEach(([s, N, nm, Pn]) => {
        if (!N || N.ext) return;
        const hubSide = l.dyn && (l.swapped ? s === "b" : s === "a");
        if (hubSide) return;
        const o = s === "a" ? "b" : "a";
        ls.fields.push(el("h3", { class: "side-title " + s, text: T("tunOf") + " " + nm }));
        ls.fields.push(hfL(P(s + "If"), "bl.tname", nm, textCtl(P(s + "If"), { maxlength: "15", "data-struct": "blur" }), { cli: pair ? "config system ipsec-aggregate / edit <...>" : "edit <...>" }));
        if (!mem) ls.fields.push(hfL(P(s + "Ip"), "bl.tip", nm, textCtl(P(s + "Ip"), { inputmode: "decimal" }), { cli: "set ip <...> 255.255.255.255" }));
        if (pair) return;  // l'aggregato non ha WAN né gateway: li hanno i membri
        ls.fields.push(hfL(P(s + "Wan"), "bl.twan", nm, textCtl(P(s + "Wan"), { maxlength: "15", placeholder: nodeWan(m, N, l0[s + "w"]) || null }), { cli: "set interface <...>" }));
        ls.fields.push(hfL(P(s + "Gw"), "bl.tgw", nm, textCtl(P(s + "Gw"), { placeholder: (Pn && nodeGw(m, Pn, l0[o + "w"])) || null }), { cli: "set remote-gw <ip> / set remotegw-ddns <fqdn>" }));
      });
      if (!autoL) ls.fields.push(hf(P("loop"), "bl.loop", toggleCtl(P("loop"), true), { cli: "set update-source <loopback>" }));
      if (!pair) ls.fields.push(hf(P("cOwn"), "bl.cOwn", toggleCtl(P("cOwn"), true)));
      if (l0.cOwn && l0.c) {
        const c = l0.c, C = k => P("c." + k);
        ls.fields.push(hf(C("ike"), "crypto.ike", segCtl(C("ike"), [["2", "IKEv2"], ["1", "IKEv1"]], true), { cli: "set ike-version 1 | 2" }));
        ls.fields.push(hf(C("p1"), "crypto.p1", checksCtl(C("p1"), P1_PROPS, x => c.ike === "2" || !x.ike2), { wide: true, noFor: true, cli: "set proposal <...>" }));
        ls.fields.push(hf(C("dh1"), "crypto.dh1", checksCtl(C("dh1"), DH_GROUPS), { wide: true, noFor: true, cli: "set dhgrp <...>" }));
        ls.fields.push(hf(C("p2"), "crypto.p2", checksCtl(C("p2"), P2_PROPS), { wide: true, noFor: true, cli: "phase2: set proposal <...>" }));
        ls.fields.push(hf(C("pfs"), "crypto.pfs", segCtl(C("pfs"), [["enable", T("on")], ["disable", T("off")]], true), { cli: "phase2: set pfs enable | disable" }));
        if (c.pfs === "enable") ls.fields.push(hf(C("dh2"), "crypto.dh2", checksCtl(C("dh2"), DH_GROUPS), { wide: true, noFor: true, cli: "phase2: set dhgrp <...>" }));
        ls.fields.push(hf(C("life1"), "crypto.life1", textCtl(C("life1"), { inputmode: "numeric" }), { cli: "set keylife <120-172800>" }));
        ls.fields.push(hf(C("life2"), "crypto.life2", textCtl(C("life2"), { inputmode: "numeric" }), { cli: "phase2: set keylifeseconds <120-172800>" }));
      }
    } else {
      ls.fields.push(hf(P("kind"), "bl.kind", segCtl(P("kind"), [["tunnel", T("kind_tunnel")], ["phys", T("kind_phys")]], true)));
      if (l0.kind === "tunnel") ls.fields.push(hf(P("ipsec"), "bl.ipsec", toggleCtl(P("ipsec"), true), { cli: "config vpn ipsec phase1-interface / phase2-interface" }));
      ls.fields.push(hf(P("loop"), "bl.loop", toggleCtl(P("loop"), true), { cli: "set update-source <loopback>" }));
      [["a", A, nA], ["b", B, nB]].forEach(([s, N, nm]) => {
        if (!N || !N.ext) ls.fields.push(hfL(P(s + "If"), "bl.if", nm, textCtl(P(s + "If"), { maxlength: "15" })));
        ls.fields.push(hfL(P(s + "Ip"), "bl.ip", nm, textCtl(P(s + "Ip"), { inputmode: "decimal" }), { cli: "config neighbor / edit <ip>" }));
      });
      if (l0.kind === "tunnel" && !l0.loop) {
        ls.fields.push(hf(P("dyn"), "bl.dyn", toggleCtl(P("dyn"), true), { cli: "config neighbor-group / config neighbor-range" }));
        if (l0.dyn) ls.fields.push(hf(P("range"), "bl.range", textCtl(P("range")), { cli: "config neighbor-range / set prefix <...>" }));
      }
    }
    if (mem) return;  // un membro dell'aggregato non ha sessione BGP: BFD e filtri stanno sull'aggregato
    ls.fields.push(hf(P("bfd"), "bl.bfd", toggleCtl(P("bfd")), { cli: "set bfd enable" }));
    [["a", A, nA], ["b", B, nB]].forEach(([s, N, nm]) => {
      if (!N || N.ext) return;
      const keys = ["RmIn", "RmOut", "PlIn", "PlOut", "Max", "Def", ...(autoL ? [] : ["Nhs"])];
      if (!expert && !keys.some(k => filled(l0[s + k])) && !(g.pls || []).length && !(g.rms || []).length) return;
      ls.fields.push(el("h3", { class: "side-title " + s, text: T("policyOf") + " " + nm }));
      [["RmIn", "bl.rmIn", "set route-map-in <...>"], ["RmOut", "bl.rmOut", "set route-map-out <...>"], ["PlIn", "bl.plIn", "set prefix-list-in <...>"],
       ["PlOut", "bl.plOut", "set prefix-list-out <...>"], ["Max", "bl.max", "set maximum-prefix <...>"]].forEach(([k, key, cli]) =>
        ls.fields.push(hfL(P(s + k), key, nm, textCtl(P(s + k), k === "Max" ? { inputmode: "numeric", placeholder: T("phNone") } : { placeholder: T("phNone") }), { cli })));
      ls.fields.push(hfL(P(s + "Def"), "bl.def", nm, toggleCtl(P(s + "Def")), { cli: "set capability-default-originate enable" }));
      if (!autoL) ls.fields.push(hfL(P(s + "Nhs"), "bl.nhs", nm, toggleCtl(P(s + "Nhs")), { cli: "set next-hop-self enable / set next-hop-self-rr enable" }));
    });
  });
  if (hiddenL) ls.fields.push(el("button", { type: "button", class: "btn link show-more", onclick: () => { S.linkAll = true; renderForm(); } }, msGen ? T("showMorePairs").replace("{n}", hiddenG) : T("showMore").replace("{n}", hiddenL)));
  else if (S.linkAll && g.links.length > LCAP && !S.linkFilter) ls.fields.push(el("button", { type: "button", class: "btn link show-more", onclick: () => { S.linkAll = false; renderForm(); } }, T("showLess")));
  if (!(m.scenario === "ms" && g.topo !== "custom")) ls.fields.push(el("div", { class: "bx-row" }, el("button", { type: "button", class: "btn small", onclick: mutate(() => {
    const ns2 = S.m.bgpAdv.nodes, nl = Object.assign(bgpBlankLink(bgpNextId(S.m.bgpAdv.links, "l")), { ipsec: true });
    if (ns2[0]) nl.a = ns2[0].id; if (ns2[1]) nl.b = ns2[1].id; S.m.bgpAdv.links.push(nl); S.bgpOpen[nl.id] = true; }) }, T("addLink"))));
  secs.push(ls);
  // 4. prefix-list e route-map
  const ps = { id: "bp", noReset: true, title: T("s_bp"), desc: T("s_bp_d"), fields: [] };
  const noObj = !(g.pls || []).length && !(g.rms || []).length;
  ps.fields.push(el("details", { class: "help bx-explain", open: noObj ? true : null }, el("summary", { text: T("bpWhat") }), T("bpExplain").split("\n").map(x => el("p", { text: x }))));
  [["pls", "pl", "Prefix-list "], ["rms", "rm", "Route-map "]].forEach(([coll, k, lab]) => {
    (g[coll] || []).forEach((o, i) => {
      const P = x => "bgpAdv." + coll + "." + i + "." + x;
      ps.fields.push(head(lab + (o.name || i + 1), mutate(() => S.m.bgpAdv[coll].splice(i, 1))));
      ps.fields.push(hf(P("name"), "bp." + k + "Name", textCtl(P("name"), { "data-struct": "blur", maxlength: "35" }), { cli: (k === "pl" ? "config router prefix-list" : "config router route-map") + " / edit <...>" }));
      ps.fields.push(hf(P("rules"), "bp." + k + "Rules", area(P("rules"), k === "pl" ? "permit 192.168.0.0/16 le 24" : "permit match PL_LAN local-pref 200"),
        { wide: true, cli: k === "pl" ? "config rule / set action / set prefix / set ge / set le" : "config rule / set match-ip-address / set set-local-preference / set set-metric / set set-aspath / set set-community" }));
    });
  });
  const addObj = (coll, pre) => mutate(() => { const list = S.m.bgpAdv[coll]; let n = list.length + 1; while (list.some(x => x.name === pre + n)) n++; list.push({ name: pre + n, rules: "" }); });
  ps.fields.push(el("div", { class: "bx-row" }, el("button", { type: "button", class: "btn small", onclick: addObj("pls", "PL_") }, T("addPl")),
    el("button", { type: "button", class: "btn small", onclick: addObj("rms", "RM_") }, T("addRm"))));
  secs.push(ps);
  return secs;
}

/* ---------- rete multi-sede: schema ---------- */
function bgpTopo(m) {
  const g = m.bgpAdv, nodes = (g.nodes || []).filter(n => true), esc = xmlEsc, sw = m.scenario === "ms" && sdwanOn(m);
  const hubN = m.scenario === "ms" ? msHub(m) : null;
  // misure dei riquadri: larghezza dal testo, una riga di linee WAN se l'SD-WAN è acceso
  const cw = (t, px) => String(t).length * px * 0.56;
  const box = {};
  nodes.forEach(n => {
    const nm = nodeName(m, n), name = nm.length > 22 ? nm.slice(0, 21) + "…" : nm;
    const sub = (m.scenario === "ms" && g.names === "code" && g.topo !== "custom" && !n.ext ? siteCode(m, n) + " · " : "") + "AS " + (n.as || "?") + (n.rr ? " · RR" : "") + (n.ext ? " · " + T("extNoCfg") : "");
    const codesT = m.scenario === "ms" && g.names === "code" && g.topo !== "custom";
    const wans = sw && !n.ext ? siteWans(m, n).map(w => (codesT ? lineCode(m, n, w) + " " : "") + (w.if || "wan" + w.slot)) : [];
    const chipsW = wans.reduce((a, w) => a + cw(w, 9.5) + 12 + 4, -4);
    const w = Math.max(116, cw(name, 12.5) + 28, cw(sub, 10.5) + 24, wans.length ? chipsW + 20 : 0);
    box[n.id] = { n, name, sub, wans, w, h: wans.length ? 60 : 44 };
  });
  // posizioni: hub al centro con le filiali intorno, full mesh in cerchio, due sedi affiancate
  const pos = {}, N = nodes.length, avgW = nodes.reduce((a, n) => a + box[n.id].w, 0) / Math.max(1, N), maxH = Math.max(44, ...nodes.map(n => box[n.id].h));
  if (N <= 2) nodes.forEach((n, i) => pos[n.id] = [i * (avgW + 220), 0]);
  else if (hubN && nodes.includes(hubN)) {
    const sp = nodes.filter(n => n !== hubN), k = sp.length;
    const rx = Math.max(250, k * (avgW + 18) / 4.4), ry = Math.max(120 + maxH - 44, rx * 0.42);
    pos[hubN.id] = [0, 0];
    sp.forEach((n, i) => { const a = Math.PI + 2 * Math.PI * i / k; pos[n.id] = [rx * Math.cos(a), ry * Math.sin(a)]; });
  } else {
    const rx = Math.max(250, N * (avgW + 18) / 4.6), ry = Math.max(125 + maxH - 44, rx * 0.46);
    nodes.forEach((n, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / N; pos[n.id] = [rx * Math.cos(a), ry * Math.sin(a)]; });
  }
  // tunnel raggruppati per coppia di sedi
  const groups = {}, order = [];
  (g.links || []).forEach(l0 => {
    const l = bgpLinkRes(m, l0), A = bgpNode(m, l.a), B = bgpNode(m, l.b);
    if (!A || !B || !pos[l.a] || !pos[l.b] || l.a === l.b || (l.gen && l.bothDyn)) return;
    const key = [l.a, l.b].sort().join("|");
    if (!groups[key]) { groups[key] = { A, B, ls: [], pair: null }; order.push(key); }
    if (l.agg === "pair") groups[key].pair = l; else groups[key].ls.push(l);
  });
  // punto in cui il segmento esce dal riquadro (con un piccolo margine)
  const edge = (c, d, b, gap) => { const tx = d[0] ? (b.w / 2 + gap) / Math.abs(d[0]) : Infinity, ty = d[1] ? (b.h / 2 + gap) / Math.abs(d[1]) : Infinity, t = Math.min(tx, ty); return [c[0] + d[0] * t, c[1] + d[1] * t]; };
  let lines = "", badges = "", minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  nodes.forEach(n => { const [x, y] = pos[n.id], b = box[n.id]; grow(x - b.w / 2, y - b.h / 2); grow(x + b.w / 2, y + b.h / 2); });
  const flags = { ib: false, eb: false, dial: false, multi: false, ext: false, loop: false, agg: false };
  order.forEach(key => {
    const { A, B, ls, pair } = groups[key], n = ls.length, pa = pos[A.id], pb = pos[B.id];
    if (!n) return;
    if (pair) flags.agg = true;
    const ib = String(A.as).trim() === String(B.as).trim(), col = ib ? "var(--a)" : "var(--ff)";
    flags[ib ? "ib" : "eb"] = true; if (n > 1) flags.multi = true;
    const ext = A.ext || B.ext, loop = ls.every(l => l.loop); if (ext) flags.ext = true; if (loop) flags.loop = true;
    // chi chiama chi: con il dial-up la freccia entra nell'hub
    const dialTo = ls.some(l => l.gen && l.dyn) ? ls.find(l => l.gen && l.dyn).a : null; if (dialTo) flags.dial = true;
    const [from, to] = dialTo === A.id ? [B, A] : [A, B], p1 = pos[from.id], p2 = pos[to.id];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const k = Math.min(n, 4), sp = 3.6, dash = ext ? ' stroke-dasharray="6 4"' : loop ? ' stroke-dasharray="2 3"' : "";
    const tip = nodeName(m, A) + " ⇄ " + nodeName(m, B) + " · " + (ib ? "iBGP" : "eBGP") + " · " + n + " tunnel" +
      (pair ? "\n" + T("ttAgg") + " " + (pair.a === A.id ? pair.aIf : pair.bIf) + " " + ((pair.a === A.id ? pair.aIp : pair.bIp) || "—") + " ⇄ " + (pair.a === A.id ? pair.bIf : pair.aIf) + " " + ((pair.a === A.id ? pair.bIp : pair.aIp) || "—") : "") + "\n" + ls.map(l => {
      const sa = l.a === A.id ? "a" : "b", sb = sa === "a" ? "b" : "a";
      const wl = (Nn, slot) => sw ? " (" + (wanOf(m, Nn, slot).if || slot) + ")" : "";
      return "· " + (l[sa + "If"] || "—") + wl(A, l[sa + "w"]) + " ⇄ " + (l[sb + "If"] || "—") + wl(B, l[sb + "w"]) + (l.dyn ? " · dial-up" : "");
    }).join("\n");
    // fascio: i tunnel sono fili paralleli su una guaina chiara; con il dial-up una sola freccia entra in chi riceve
    const c1 = edge(p1, [dx, dy], box[from.id], 3), c2 = edge(p2, [-dx, -dy], box[to.id], 3), aw = dialTo ? 9 : 0;
    const e2 = [c2[0] - ux * aw, c2[1] - uy * aw];
    let strands = "";
    if (k > 1 || pair) strands += '<line x1="' + c1[0].toFixed(1) + '" y1="' + c1[1].toFixed(1) + '" x2="' + e2[0].toFixed(1) + '" y2="' + e2[1].toFixed(1) + '" stroke="' + col + '" stroke-opacity="' + (pair ? ".24" : ".13") + '" stroke-width="' + ((k - 1) * sp + (pair ? 9 : 7)) + '" stroke-linecap="' + (pair ? "butt" : "round") + '"/>';
    for (let i = 0; i < k; i++) {
      const off = (i - (k - 1) / 2) * sp, ox = nx * off, oy = ny * off;
      strands += '<line x1="' + (c1[0] + ox).toFixed(1) + '" y1="' + (c1[1] + oy).toFixed(1) + '" x2="' + (e2[0] + ox).toFixed(1) + '" y2="' + (e2[1] + oy).toFixed(1) + '" stroke="' + col + '" stroke-width="1.4" stroke-linecap="round"' + dash + "/>";
    }
    if (dialTo) { const bx = c2[0] - ux * 10, by = c2[1] - uy * 10, hw = Math.max(4.5, ((k - 1) * sp) / 2 + 3.5);
      strands += '<path d="M' + c2[0].toFixed(1) + " " + c2[1].toFixed(1) + " L" + (bx + nx * hw).toFixed(1) + " " + (by + ny * hw).toFixed(1) + " L" + (bx - nx * hw).toFixed(1) + " " + (by - ny * hw).toFixed(1) + ' z" fill="' + col + '"/>'; }
    lines += "<g><title>" + esc(tip) + "</title>" + strands + "</g>";
    if (n > 1 || pair) {
      const mx = (c1[0] + e2[0]) / 2, my = (c1[1] + e2[1]) / 2, r = n > 9 ? 10.5 : 9;
      badges += "<g><title>" + esc(tip) + "</title>" + (pair ? '<rect x="' + (mx - r - 2).toFixed(1) + '" y="' + (my - 8).toFixed(1) + '" width="' + (2 * r + 4) + '" height="16" rx="3" fill="var(--surface)" stroke="' + col + '" stroke-width="1.6"/>'
        : '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="' + r + '" fill="var(--surface)" stroke="' + col + '" stroke-width="1.4"/>') +
        '<text x="' + mx.toFixed(1) + '" y="' + (my + 3.8).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="' + col + '">' + n + "</text></g>";
    }
  });
  // riquadri delle sedi
  let cards = "";
  nodes.forEach(n => {
    const [x, y] = pos[n.id], b = box[n.id], hub = n === hubN || n.rr, top = y - b.h / 2;
    cards += "<g><title>" + esc(nodeName(m, n) + " · " + b.sub + (b.wans.length ? " · " + b.wans.join(", ") : "")) + "</title>" +
      '<rect x="' + (x - b.w / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + b.w.toFixed(1) + '" height="' + b.h + '" rx="9" fill="' + (hub ? "var(--b-soft)" : "var(--surface)") +
      '" stroke="' + (hub ? "var(--b)" : "var(--line)") + '" stroke-width="' + (hub ? 1.6 : 1.2) + '"' + (n.ext ? ' stroke-dasharray="5 4"' : "") + "/>" +
      '<text x="' + x.toFixed(1) + '" y="' + (top + 18).toFixed(1) + '" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--ink)">' + esc(b.name) + "</text>" +
      '<text x="' + x.toFixed(1) + '" y="' + (top + 33).toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="' + (hub ? "var(--b)" : "var(--muted)") + '">' + esc(b.sub) + "</text>";
    if (b.wans.length) {
      const ws = b.wans.map(w => cw(w, 9.5) + 12), tot = ws.reduce((a, v) => a + v, 0) + 4 * (ws.length - 1);
      let cx = x - tot / 2;
      b.wans.forEach((w, i) => {
        cards += '<rect x="' + cx.toFixed(1) + '" y="' + (top + 40).toFixed(1) + '" width="' + ws[i].toFixed(1) + '" height="14" rx="7" fill="var(--sunk)" stroke="var(--line)" stroke-width="1"/>' +
          '<text x="' + (cx + ws[i] / 2).toFixed(1) + '" y="' + (top + 50.2).toFixed(1) + '" text-anchor="middle" font-size="9.5" font-family="JetBrains Mono, ui-monospace, monospace" fill="var(--muted)">' + esc(w) + "</text>";
        cx += ws[i] + 4;
      });
    }
    cards += "</g>";
  });
  const pad = 14, W = Math.ceil(maxX - minX + 2 * pad), Hh = Math.ceil(maxY - minY + 2 * pad);
  const nT = order.reduce((a, k) => a + groups[k].ls.length, 0);
  const ases = [...new Set(nodes.filter(n => !n.ext).map(n => String(n.as)))];
  const claim = nodes.length + " " + T("sitesCount") + " · " + nT + " " + T("tunnelsN") + " · " + (ases.length === 1 ? "iBGP AS " + ases[0] + (hubN && hubN.rr ? ", route reflector " + nodeName(m, hubN) : "") : "eBGP · " + ases.length + " AS") + (sw ? (aggOn(m) ? " · " + T("claimAgg") : " · SD-WAN") : "");
  const svg = '<svg viewBox="' + (minX - pad).toFixed(1) + " " + (minY - pad).toFixed(1) + " " + W + " " + Hh + '" role="img" aria-label="' + esc(claim) + '" style="width:100%;max-width:' + Math.max(W, 320) + 'px;min-width:' + Math.round(Math.min(W, 640) * 0.78) + 'px;height:auto;display:block;margin:0 auto" font-family="Archivo, system-ui, sans-serif">' +
    lines + badges + cards + "</svg>";
  // legenda con i campioni, solo per le codifiche presenti
  const sw1 = (col, extra) => '<svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="' + (extra === "arrow" ? 19 : 25) + '" y2="5" stroke="' + col + '" stroke-width="1.6"' + (extra === "dash" ? ' stroke-dasharray="6 4"' : extra === "dot" ? ' stroke-dasharray="2 3"' : "") + "/>" +
    (extra === "arrow" ? '<path d="M18 1 L25 5 L18 9 z" fill="' + col + '"/>' : "") + "</svg>";
  const items = [];
  if (flags.ib) items.push([sw1("var(--a)"), T("lgIbgp")]);
  if (flags.eb) items.push([sw1("var(--ff)"), T("lgEbgp")]);
  if (flags.dial) items.push([sw1(flags.ib ? "var(--a)" : "var(--ff)", "arrow"), T("lgDial")]);
  if (flags.agg) items.push(['<svg width="24" height="16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" rx="3" fill="var(--surface)" stroke="var(--muted)" stroke-width="1.4"/><text x="12" y="11.5" text-anchor="middle" font-size="10" font-weight="700" fill="var(--muted)">n</text></svg>', T("lgAgg")]);
  if (flags.multi && !flags.agg) items.push(['<svg width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="var(--surface)" stroke="var(--muted)" stroke-width="1.3"/><text x="10" y="13.5" text-anchor="middle" font-size="10" font-weight="700" fill="var(--muted)">n</text></svg>', T("lgCount")]);
  if (flags.ext) items.push([sw1("var(--muted)", "dash"), T("extNoCfg")]);
  if (flags.loop) items.push([sw1("var(--muted)", "dot"), T("lgLoop")]);
  if (hubN || nodes.some(n => n.rr)) items.push(['<svg width="20" height="14" aria-hidden="true"><rect x="1" y="1" width="18" height="12" rx="3" fill="var(--b-soft)" stroke="var(--b)" stroke-width="1.4"/></svg>', T("lgHub")]);
  return el("figure", { class: "t-bgp" },
    el("figcaption", { class: "t-bgp-head" }, el("span", { class: "t-ct", text: T("bgpTopoTitle") }), el("span", { class: "t-bgp-claim", text: claim })),
    el("div", { class: "t-bgp-svg", html: svg }),
    items.length ? el("div", { class: "t-legend" }, items.map(([ic, tx]) => el("span", { class: "t-lg" }, el("span", { class: "t-lg-ic", html: ic }), el("span", { text: tx })))) : null);
}
function isCompact() { return S.compact === undefined ? advOn(S.m) : !!S.compact; }
function updBgpBtn() {
  const c = $("#btnCompact"); if (c) { c.setAttribute("aria-pressed", String(isCompact())); document.body.classList.toggle("compact", isCompact()); }
}

/* ---------- output ---------- */
let OUT = {};
function tabsFor() {
  const sc = S.m.scenario;
  if (sc === "ms") {
    const hub = msHub(S.m);
    return [...msSites(S.m).map(n => ({ id: "bgp_" + n.id, label: nodeName(S.m, n) + (n === hub ? " · " + T("tabSiteHub") : ""), kind: "fw" })),
      { id: "chk", label: T("tabChecks"), kind: "chk" }, { id: "diag", label: T("tabDiag"), kind: "diag" }, { id: "sum", label: T("tabSummary"), kind: "sum" }];
  }
  const t = [{ id: "a", label: T("outA_" + sc), kind: "fw" }];
  if (sc === "dialup") { t.push({ id: "fct", label: T("tabClient"), kind: "fct" }); if (S.m.dial.auth !== "local") t.push({ id: "guide", label: T("tabGuide"), kind: "guide" }); }
  else t.push({ id: "b", label: T("outB_" + sc), kind: "fw" });
  if (advOn(S.m)) (S.m.bgpAdv.nodes || []).filter(n => !n.ext && !(n.ipsec && OUT[n.ipsec] !== undefined)).forEach(n => t.push({ id: "bgp_" + n.id, label: "FortiGate · " + nodeName(S.m, n), kind: "fw" }));
  t.push({ id: "chk", label: T("tabChecks"), kind: "chk" }, { id: "diag", label: T("tabDiag"), kind: "diag" }, { id: "sum", label: T("tabSummary"), kind: "sum" });
  return t;
}
function computeOutputs() {
  const m = S.m;
  setOutLang(S.lang);
  if (m.scenario === "ms") {
    OUT = { sum: genSummary(m, S.lang), diag: genBgpDiag(m, S.lang) };
    msSites(m).forEach(n => { OUT["bgp_" + n.id] = genBgpNode(m, n.id, S.sec); });
  } else {
    OUT = { a: genFortiGate(m, "a", S.sec), diag: "", sum: genSummary(m, S.lang) };
    if (m.scenario === "dialup") { OUT.fct = genXml(m, S.sec); GUIDE = genGuide(m, S.lang); OUT.guide = guideText(GUIDE, m, S.lang); }
    else OUT.b = genFortiGate(m, "b", S.sec);
    OUT.diag = DIAL(m.scenario) ? genDiag(m, "a", S.lang)
      : "# ===== " + T("outA_" + m.scenario) + " =====\n" + genDiag(m, "a", S.lang) + "\n\n# ===== " + T("outB_" + m.scenario) + " =====\n" + genDiag(m, "b", S.lang);
  }
  S.checks = runChecks(m, S.sec, S.lang);
  const open = S.checks.filter(c => c.lvl !== "info");
  if (open.length) OUT.sum += "\n## " + T("sumIssues") + "\n\n" + open.map(c => "- " + T("lvl_" + c.lvl) + ": " + c.msg).join("\n") + "\n";
  if (S.m.fos !== "7.4") S.checks.push({ lvl: "info", p: "fos", msg: S.lang === "en" ? "Options are verified on FortiOS 7.4.2: on " + S.m.fos + " review advanced lines before applying them." : "Le opzioni sono verificate su FortiOS 7.4.2: su " + S.m.fos + " controlla le righe avanzate prima di applicarle." });
}
function renderTabs() {
  const host = $("#tabs"); host.textContent = "";
  const tabs = tabsFor(); if (!tabs.some(t => t.id === S.tab)) S.tab = tabs[0].id;
  const nErr = S.checks.filter(c => c.lvl === "err").length, nWarn = S.checks.filter(c => c.lvl === "warn").length;
  tabs.forEach((t, i) => {
    const b = el("button", { type: "button", role: "tab", class: "tab " + t.kind, id: "tab-" + t.id, "aria-selected": String(S.tab === t.id), "aria-controls": "panel", tabindex: S.tab === t.id ? "0" : "-1",
      onclick: () => { S.tab = t.id; renderTabs(); renderPanel(); },
      onkeydown: e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; S.tab = n.id; renderTabs(); renderPanel(); $("#tab-" + n.id).focus(); e.preventDefault(); } } },
      t.label, t.id === "chk" && (nErr || nWarn) ? el("span", { class: "badge " + (nErr ? "err" : "warn"), text: String(nErr || nWarn) }) : null);
    host.appendChild(b);
  });
  const mb = $("#mobErr"); mb.textContent = nErr ? String(nErr) : ""; mb.hidden = !nErr;
}
function fileName(kind) {
  const base = (S.m.name || "fortissimo").replace(/[^\w.-]+/g, "_").slice(0, 60);
  if (kind === "a") return base + "-" + (S.m.a.tunnel || "A").replace(/[^\w.-]+/g, "_") + ".txt";
  if (kind === "b") return base + "-" + (S.m.b.tunnel || "B").replace(/[^\w.-]+/g, "_") + ".txt";
  if (kind === "fct") return (S.m.dial.client || "forticlient").replace(/[^\w.-]+/g, "_") + ".conf.txt";
  if (kind === "guide") return (S.m.name || "fortissimo").replace(/[^\w.-]+/g, "_") + "_guida.md";
  if (kind === "diag") return base + "-diagnostica.txt";
  if (String(kind).startsWith("bgp_")) { const n = bgpNode(S.m, kind.slice(4)); return base + "-BGP-" + (n ? nodeName(S.m, n) : kind).replace(/[^\w.-]+/g, "_") + ".txt"; }
  if (kind === "sum") return base + "-riepilogo.md";
  return base + ".txt";
}
function renderPanel() {
  const host = $("#panel"); host.textContent = ""; host.setAttribute("aria-labelledby", "tab-" + S.tab);
  if (S.tab === "chk") {
    if (!S.checks.some(c => c.lvl !== "info")) host.appendChild(el("p", { class: "ok", text: T("noIssues") }));
    host.appendChild(el("ul", { class: "checks" }, S.checks.map(c => el("li", { class: c.lvl },
      el("span", { class: "lvl", text: T("lvl_" + c.lvl) }), el("span", { class: "msg", text: c.msg }),
      c.p ? el("button", { type: "button", class: "btn link", onclick: () => gotoField(c.p) }, S.lang === "en" ? "Go to field" : "Vai al campo") : null))));
    return;
  }
  const note = { a: T("outNoteFw"), b: T("outNoteFw"), fct: T("outNoteFct"), guide: T("outNoteGuide"), diag: T("outNoteDiag"), sum: T("outNoteSum") }[S.tab] || (S.tab.startsWith("bgp_") ? T("outNoteMs") : "");
  const flash = el("span", { class: "flash", "aria-live": "polite" });
  const pre = S.tab === "guide"
    ? el("ol", { class: "guide", tabindex: "0" }, GUIDE.map(g => el("li", null,
        el("div", { class: "g-head" }, el("b", { text: g.title }), g.where ? el("span", { class: "g-where", text: g.where }) : null),
        el("ul", null, g.items.map(x => el("li", { text: x }))), g.code ? el("pre", { text: g.code }) : null)))
    : el("pre", { tabindex: "0", class: S.tab === "sum" ? "md" : "" }, OUT[S.tab] || "");
  host.append(...[el("div", { class: "bar" }, el("p", { text: note }),
    el("button", { type: "button", class: "btn primary", onclick: () => copyText(OUT[S.tab], flash, pre) }, T("copy")),
    downloads ? el("button", { type: "button", class: "btn", onclick: () => saveFile(fileName(S.tab), OUT[S.tab], flash) }, T("download")) : null, flash),
    downloads && S.tab === "fct" ? el("p", { class: "hint", text: T("dlRename") }) : null, pre].filter(Boolean));
}
function gotoField(p) {
  if (S.view !== "form") setView("form");
  const mm = /^bgpAdv\.(nodes|links)\.(\d+)\./.exec(p || "");
  if (mm && S.m.bgpAdv[mm[1]] && S.m.bgpAdv[mm[1]][+mm[2]]) {
    const it = S.m.bgpAdv[mm[1]][+mm[2]]; S.bgpOpen = S.bgpOpen || {};
    (mm[1] === "nodes" ? S.m.bgpAdv.nodes : S.m.bgpAdv.links).forEach(x => { S.bgpOpen[x.id] = x.id === it.id; });
    if (mm[1] === "nodes" && !it.ipsec && !it.ext) S.siteOpen = it.id;
    if (mm[1] === "links" && S.linkFilter && it.a !== S.linkFilter && it.b !== S.linkFilter) S.linkFilter = "";
    renderForm();
  }
  let f = $('.fld[data-ps~="' + p + '"]') || $('.fld[data-p="' + p + '"]');
  if (!f && S.mode === "essential") { S.mode = "expert"; renderChrome(); renderForm(); f = $('.fld[data-ps~="' + p + '"]') || $('.fld[data-p="' + p + '"]'); }
  if (!f) return;
  f.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  const inp = $("input,select,textarea", f); if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 300);
  f.classList.add("pulse"); setTimeout(() => f.classList.remove("pulse"), 1600);
}
function markFields() {
  $$(".fld.err, .fld.warn").forEach(f => f.classList.remove("err", "warn"));
  $$(".fld-msgs").forEach(x => x.remove());
  $$("[aria-invalid]").forEach(x => { x.removeAttribute("aria-invalid"); x.removeAttribute("aria-describedby"); });
  $$("input.bad, input.badw").forEach(x => x.classList.remove("bad", "badw"));
  const MAX = 3;
  S.checks.filter(c => c.p && c.lvl !== "info").forEach(c => (c.ps || [c.p]).forEach(p => {
    let fs = $$('.fld[data-ps~="' + p + '"]'); if (!fs.length) fs = $$('.fld[data-p="' + p + '"]');
    fs.forEach(f => {
    if (!f.classList.contains("err")) { f.classList.remove("warn"); f.classList.add(c.lvl); }
    let box = $(".fld-msgs", f);
    if (!box) {
      box = el("div", { class: "fld-msgs", id: "m" + Math.random().toString(36).slice(2, 9), role: "status" });
      const hd = $(".fld-head", f); if (hd && hd.nextElementSibling) hd.nextElementSibling.after(box); else f.appendChild(box);
    }
    if ([...box.children].some(x => x.dataset.msg === c.msg)) return;
    const shown = $$(".fld-msg[data-msg]", box).length;
    if (shown < MAX) box.appendChild(el("p", { class: "fld-msg " + c.lvl, "data-msg": c.msg }, el("b", { text: T("lvl_" + c.lvl) + ": " }), c.msg));
    else {
      box._more = (box._more || 0) + 1;
      let more = $(".fld-more", box); if (!more) { more = el("button", { type: "button", class: "btn link fld-more", onclick: () => { S.tab = "chk"; if (S.view !== "out") setView("out"); renderTabs(); renderPanel(); } }); box.appendChild(more); }
      more.textContent = "+" + box._more + " " + T("moreChecks");
    }
    const own = f.classList.contains("ms-row") ? $$('[data-bind="' + p + '"]', f) : [];
    (own.length ? own : $$("input,select,textarea", f)).forEach(x => { if (c.lvl === "err") x.setAttribute("aria-invalid", "true"); x.setAttribute("aria-describedby", box.id); if (own.length) x.classList.add(c.lvl === "err" ? "bad" : "badw"); });
    });
  }));
}

function refresh() { if (advOn(S.m) && bgpNormalize(S.m)) renderForm(); computeOutputs(); renderTopo(); renderTabs(); renderPanel(); markFields(); updBgpBtn(); persist(); }

/* ---------- copia e download ---------- */
async function copyText(text, flash, pre) {
  const say = m => { flash.textContent = m; clearTimeout(flash._t); flash._t = setTimeout(() => flash.textContent = "", 2600); };
  try { await navigator.clipboard.writeText(text); say(T("copied")); return; } catch (e) {}
  try { const ta = el("textarea", { readonly: true, style: "position:fixed;opacity:0" }); ta.value = text; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); if (ok) { say(T("copied")); return; } } catch (e) {}
  const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); say(T("copyManual"));
}
let downloads = null, GUIDE = [];
async function saveFile(name, data, flash) {
  const say = m => { if (!flash) return; flash.textContent = m; clearTimeout(flash._t); flash._t = setTimeout(() => flash.textContent = "", 2600); };
  if (!downloads) return;
  try { await downloads.save({ filename: name, data }); say(T("dlSaved")); }
  catch (e) { const c = e && e.code; if (c === "declined") say(T("dlDeclined")); else if (c === "rate_limited") say(T("dlBusy")); else say(T("dlFail")); }
}

/* ---------- progetti ---------- */
function projects() { return store.get(PR_KEY) || {}; }
function renderProjects() {
  const sel = $("#projList"); sel.textContent = "";
  const pr = projects(), ids = Object.keys(pr).sort((a, b) => (pr[b].ts || 0) - (pr[a].ts || 0));
  if (!ids.length) sel.appendChild(el("option", { value: "", text: T("noProjects") }));
  ids.forEach(id => sel.appendChild(el("option", { value: id, text: pr[id].name || id })));
  $("#btnOpen").disabled = $("#btnDel").disabled = !ids.length;
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 2600); }

/* ---------- cornice ---------- */
function setView(v) { S.view = v; document.body.setAttribute("data-view", v); $$("#viewSwitch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v))); }
function renderChrome() {
  document.documentElement.lang = S.lang;
  $$("[data-t]").forEach(n => n.textContent = T(n.getAttribute("data-t")));
  $$("[data-tp]").forEach(n => n.setAttribute("placeholder", T(n.getAttribute("data-tp"))));
  $$("#langSwitch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.l === S.lang)));
  $$("#modeSwitch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === S.mode)));
  $("#modeSwitch").setAttribute("aria-label", T("mode")); $("#search").setAttribute("aria-label", T("search"));
  const ph = $("#presets"); ph.textContent = "";
  const pick = id => { S.m = makePreset(id, S.lang); S.siteOpen = null; S.bgpOpen = {}; S.linkFilter = ""; if (id === "custom") S.mode = "expert"; S.search = ""; $("#search").value = ""; renderChrome(); renderForm(); refresh(); };
  const card = (id, short, tags) => {
    const [name, desc] = PRESET_TXT[S.lang][id];
    return el("button", { type: "button", class: "preset" + (S.m.preset === id ? " on" : ""), "aria-pressed": String(S.m.preset === id), onclick: () => pick(id) },
      el("span", { class: "p-ico", "aria-hidden": "true", html: PRESET_ICON[id] }),
      el("span", { class: "p-txt" }, el("b", { text: short ? name.replace(/^FortiClient,\s*/, "").replace(/^./, x => x.toUpperCase()) : name }), el("span", { class: "p-desc", text: desc }),
        el("span", { class: "p-tags" }, tags.map(t => el("span", { class: "p-tag", text: T(t) })))));
  };
  ph.append(
    el("div", { class: "p-group sites" }, el("h3", { text: T("grpSites") }),
      el("div", { class: "p-cards" }, card("s2s", false, ["pt_both"]), card("s2sdyn", false, ["pt_hub"]), card("ms", false, ["pt_multi", "pt_bgp"])),
      el("button", { type: "button", class: "p-custom" + (S.m.preset === "custom" ? " on" : ""), "aria-pressed": String(S.m.preset === "custom"), onclick: () => pick("custom") },
        el("b", { text: PRESET_TXT[S.lang].custom[0] }), " · ", PRESET_TXT[S.lang].custom[1])),
    el("div", { class: "p-group remote" }, el("h3", { text: T("grpRemote") }),
      el("div", { class: "p-cards" }, card("fct-local", true, ["pt_xml"]), card("fct-ldap", true, ["pt_xml", "pt_guide"]),
        card("fct-radius", true, ["pt_xml", "pt_guide"]), card("fct-saml", true, ["pt_xml", "pt_guide"]))));
  renderProjects();
}


const PRESET_ICON = (() => {
  const b = 'stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const bld = x => '<path d="M' + x + ' 26V9l7-3 7 3v17M' + (x + 4) + ' 13h2M' + (x + 8) + ' 13h2M' + (x + 4) + ' 18h2M' + (x + 8) + ' 18h2" ' + b + '/>';
  const pc = x => '<rect x="' + x + '" y="9" width="13" height="10" rx="1.5" ' + b + '/><path d="M' + (x - 2) + ' 23h17" ' + b + '/>';
  const fw = x => '<rect x="' + x + '" y="10" width="14" height="10" rx="2" ' + b + '/><path d="M' + (x + 4) + ' 15h6" ' + b + '/>';
  const svg = s => '<svg viewBox="0 0 48 30" width="48" height="30">' + s + '</svg>';
  const tun = (dash) => '<path d="M17 16h14" ' + b + (dash ? ' stroke-dasharray="2 3"' : '') + '/>';
  return {
    "s2s": svg(bld(2) + tun() + bld(32)),
    "s2sdyn": svg(bld(2) + tun(true) + '<path d="M33 26v-9h12v9M36 21h2M40 21h2" ' + b + '/><circle cx="43" cy="8" r="3" ' + b + '/>'),
    "fct-local": svg(fw(1) + tun() + pc(33)),
    "fct-ldap": svg(fw(1) + tun() + pc(33) + '<path d="M8 20v6M5 26h6" ' + b + '/>'),
    "fct-radius": svg(fw(1) + tun() + pc(33) + '<circle cx="8" cy="26" r="2.5" ' + b + '/>'),
    "fct-saml": svg(fw(1) + tun() + pc(33) + '<path d="M3 27a4 3 0 0 1 4-3a5 4 0 0 1 9 1a2.5 2 0 0 1 0 4H5a2 2 0 0 1-2-2z" ' + b + '/>'),
    "ms": svg('<path d="M7 24V12l5-2 5 2v12M31 24V12l5-2 5 2v12M19 8V2l5-2 5 2v6" ' + b + '/><path d="M17 17h14M15 12l6-5M33 12l-6-5" ' + b + ' stroke-dasharray="2 3"/>'),
    "custom": svg(bld(2) + tun() + bld(32))
  };
})();

/* valori d'esempio dello scenario: se l'utente non li ha cambiati, seguono la lingua */
function translateDefaults(from, to) {
  const id = S.m.preset; if (!id || !PRESETS.includes(id)) return;
  const A = makePreset(id, from), B = makePreset(id, to);
  const walk = (a, b, cur, path) => {
    if (!a || typeof a !== "object" || !cur) return;
    Object.keys(a).forEach(k => {
      if (k === "adv") return;
      const va = a[k], vb = b ? b[k] : undefined;
      if (typeof va === "string" && typeof vb === "string" && va !== vb && cur[k] === va) cur[k] = vb;
      else if (va && typeof va === "object" && !Array.isArray(va)) walk(va, vb, cur[k], path + k + ".");
    });
  };
  walk(A, B, S.m, "");
}

function init() {
  loadState();
  document.body.setAttribute("data-view", "form");
  $("#form").addEventListener("input", onFormEvent);
  $("#form").addEventListener("change", onFormEvent);
  $$("#langSwitch button").forEach(b => b.addEventListener("click", () => { if (b.dataset.l !== S.lang) translateDefaults(S.lang, b.dataset.l); S.lang = b.dataset.l; renderChrome(); renderForm(); refresh(); }));
  $$("#modeSwitch button").forEach(b => b.addEventListener("click", () => { S.mode = b.dataset.m; renderChrome(); renderForm(); persist(); }));
  $$("#viewSwitch button").forEach(b => b.addEventListener("click", () => { setView(b.dataset.v); const tgt = b.dataset.v === "out" ? $(".out") : $("#formcol"); if (tgt && tgt.scrollIntoView) tgt.scrollIntoView({ block: "start" }); }));
  $("#search").addEventListener("input", e => { S.search = e.target.value; renderForm(); });
  $("#btnCompact").addEventListener("click", () => { S.compact = !isCompact(); updBgpBtn(); persist(); });
  $("#btnSave").addEventListener("click", () => {
    const pr = projects(); const id = S.m._id || ("p" + Date.now().toString(36)); S.m._id = id;
    pr[id] = { name: S.m.name || "Fortissimo", ts: Date.now(), m: JSON.parse(JSON.stringify(S.m)) };
    if (store.set(PR_KEY, pr)) toast(T("saved")); renderProjects(); $("#projList").value = id; persist();
  });
  $("#btnOpen").addEventListener("click", () => { const id = $("#projList").value, pr = projects(); if (!pr[id]) return; S.m = upgradeModel(JSON.parse(JSON.stringify(pr[id].m))); renderChrome(); renderForm(); refresh(); });
  $("#btnDel").addEventListener("click", () => { const id = $("#projList").value, pr = projects(); if (!pr[id]) return; delete pr[id]; store.set(PR_KEY, pr); if (S.m._id === id) delete S.m._id; renderProjects(); });
  $("#btnNew").addEventListener("click", () => { S.m = makePreset(S.m.preset || "s2s", S.lang); S.sec = { psk: "", ppk: "", bgp: "", ldap: "", radius: "" }; renderChrome(); renderForm(); refresh(); window.scrollTo(0, 0); });
  $("#btnExport").addEventListener("click", async () => {
    const data = JSON.stringify({ app: "fortissimo", v: 1, model: Object.assign({}, S.m, { _id: undefined }) }, null, 2);
    if (downloads) saveFile((S.m.name || "fortissimo").replace(/[^\w.-]+/g, "_") + ".json", data, null);
    else { await copyText(data, $("#projFlash"), $("#outFallback")); }
  });
  $("#importFile").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { try { const j = JSON.parse(rd.result); const mm = j.model || j; if (!mm || mm.v !== 1 || !mm.scenario) throw 0; S.m = upgradeModel(mm); delete S.m._id; renderChrome(); renderForm(); refresh(); toast(T("importOk")); } catch (err) { toast(T("importErr")); } e.target.value = ""; };
    rd.readAsText(f);
  });
  renderChrome(); renderForm(); refresh();
  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("downloads").then(d => { downloads = d; if (d) renderPanel(); }).catch(() => {});
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
