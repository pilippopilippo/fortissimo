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

const S = { m: null, sec: { psk: "", ppk: "", bgp: "", ldap: "", radius: "" }, lang: "it", mode: "essential", view: "form", tab: "a", search: "", showPsk: false, checks: [] };
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
function persist() { store.set(ST_KEY, { m: S.m, lang: S.lang, mode: S.mode }); }
function loadState() {
  const st = store.get(ST_KEY);
  if (st && st.m && st.m.v === 1) { S.m = upgradeModel(st.m); S.lang = st.lang || "it"; S.mode = st.mode || "essential"; }
  else { const nav = (navigator.language || "it").slice(0, 2); S.lang = nav === "it" ? "it" : "en"; S.m = makePreset("s2s", S.lang); }
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
    helpField("fos", "fos", id => el("select", { id, "data-bind": "fos" }, ["7.2", "7.4", "7.6"].map(v => el("option", { value: v, selected: m.fos === v }, "FortiOS " + v))))
  ]});
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
  if (DIAL(sc)) sideSec.fields.push(...sideFields("a").slice(1));
  else sideSec.fields.push(el("div", { class: "side-grid" }, el("div", { class: "side-col" }, sideFields("a")), el("div", { class: "side-col" }, sideFields("b"))));
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
  secs.push(cr);
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
    secs.push(bg);
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
        sec.id !== "scn" ? el("button", { type: "button", class: "btn link", onclick: () => resetSection(sec) }, T("resetSection")) : null),
      el("div", { class: "fields" }, fields));
    host.appendChild(wrap);
  });
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
  if (p === "crypto.ike" && v === "1") {
    const c = S.m.crypto, ike2only = P1_PROPS.filter(x => x.ike2).map(x => x.v);
    c.p1 = c.p1.filter(x => !ike2only.includes(x)); if (!c.p1.length) c.p1 = ["aes256-sha256"];
  }
  if (t.getAttribute("data-struct") === "1" || p === "fos" || (t.getAttribute("data-struct") === "blur" && e.type === "change")) renderForm();
  else {
    const box = t.closest(".fld");
    if (box) { const dot = $(".dot", box); const ch = !same(getP(box.getAttribute("data-p")), refVal(box.getAttribute("data-p"))); if (ch && !dot) $(".fld-head label", box).after(el("span", { class: "dot", title: T("changed") })); if (!ch && dot) dot.remove(); }
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
    if ((sc === "s2s" || (sc === "s2sdyn" && m.bgp.on)) && N.tip) kids.push(row(T("topoTip"), N.tip));
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
    if (sc === "s2s" && m.dual.on) wires.push({ label: tName(m.dual.aTunnel, m.dual.bTunnel), note: "WAN 2 · " + (m.dual.mode === "ecmp" || m.bgp.on ? T("topoEcmp") : m.dual.mode === "standby" ? T("topoStandby") : T("topoBackup")), kind: m.dual.mode === "ecmp" || m.bgp.on ? "solid" : "dashed" });
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
  const sel = sc === "s2s" ? (m.sel.mode === "subnets" ? T("topoSelN") : "0.0.0.0/0") : (sc === "s2sdyn" ? (m.bgp.on ? "0.0.0.0/0" : T("topoSelN")) : "0.0.0.0/0");
  let routing;
  if (dial) routing = [T("topoAddRoute")];
  else if (m.bgp.on) routing = ["BGP AS " + (m.bgp.asA || "?") + " ⇄ " + (m.bgp.asB || "?") + " (" + (String(m.bgp.asA) === String(m.bgp.asB) ? "iBGP" : "eBGP") + ")", m.route.bh ? T("topoBh") : ""];
  else routing = [m.route.on ? T("topoStatic") + " · " + T("topoDist") + " " + (m.route.distance || "10") : T("topoNoRoutes"), sc === "s2sdyn" ? T("topoAddRoute") : "", m.route.bh ? T("topoBh") : ""];
  const trans = dial && c.ike === "2" && m.trans.mode !== "udp" ? "TCP " + (m.trans.port || "?") : "UDP 500 / 4500";
  const cards = el("div", { class: "t-cards" },
    card("Phase 1", ["IKEv" + c.ike + (c.ike === "1" ? " " + c.mode : ""), (c.p1[0] || "—") + (c.p1.length > 1 ? " +" + (c.p1.length - 1) : ""), "DH " + (c.dh1.join(", ") || "—") + " · " + hrs(+c.life1)]),
    card("Phase 2", [(c.p2[0] || "—") + (c.p2.length > 1 ? " +" + (c.p2.length - 1) : ""), c.pfs === "enable" ? "PFS DH " + (c.dh2.join(", ") || "—") : T("topoNoPfs"), hrs(+c.life2) + " · " + sel]),
    card(T("topoAuth"), [authTxt, (sc === "dialup" || sc === "s2sdyn") && c.ike === "2" ? "Network ID " + nid : ""]),
    card("Routing", routing),
    card(T("topoTrans"), [trans, dial ? "" : "NAT-T " + ((m.adv.a || {})["p1.nattraversal"] || "enable"), !dial && m.fec.on ? "FEC " + (m.fec.base || "20") + "+" + (m.fec.redundant || "10") : "",
      (sc === "dialup" || sc === "s2sdyn") && m.gwm.mode !== "any" ? T("topoSrc") + " " + ({ ipmask: m.gwm.subnet, iprange: m.gwm.start + "–" + m.gwm.end, geography: String(m.gwm.country).toUpperCase() }[m.gwm.mode] || "?") : ""]));
  // stato delle verifiche
  const ne = S.checks.filter(x => x.lvl === "err").length, nw = S.checks.filter(x => x.lvl === "warn").length;
  const status = el("button", { type: "button", class: "t-status " + (ne ? "err" : nw ? "warn" : "ok"),
    onclick: () => { S.tab = "chk"; if (S.view !== "out") setView("out"); renderTabs(); renderPanel(); $("#tab-chk") && $("#tab-chk").focus(); } },
    ne || nw ? (ne + " " + T(ne === 1 ? "topoErr1" : "topoErrN") + " · " + nw + " " + T(nw === 1 ? "topoWarn1" : "topoWarnN") + ": " + T("topoOpen")) : T("topoOk"));
  const grid = el("div", { class: "t-grid" + (dial ? " dial" : "") }, node("a"), link, right, auth);
  host.append(grid, cards, status);
}

/* ---------- output ---------- */
let OUT = {};
function tabsFor() {
  const sc = S.m.scenario;
  const t = [{ id: "a", label: T("outA_" + sc), kind: "fw" }];
  if (sc === "dialup") { t.push({ id: "fct", label: T("tabClient"), kind: "fct" }); if (S.m.dial.auth !== "local") t.push({ id: "guide", label: T("tabGuide"), kind: "guide" }); }
  else t.push({ id: "b", label: T("outB_" + sc), kind: "fw" });
  t.push({ id: "chk", label: T("tabChecks"), kind: "chk" }, { id: "diag", label: T("tabDiag"), kind: "diag" }, { id: "sum", label: T("tabSummary"), kind: "sum" });
  return t;
}
function computeOutputs() {
  const m = S.m;
  setOutLang(S.lang);
  OUT = { a: genFortiGate(m, "a", S.sec), diag: "", sum: genSummary(m, S.lang) };
  if (m.scenario === "dialup") { OUT.fct = genXml(m, S.sec); GUIDE = genGuide(m, S.lang); OUT.guide = guideText(GUIDE, m, S.lang); }
  else OUT.b = genFortiGate(m, "b", S.sec);
  OUT.diag = DIAL(m.scenario) ? genDiag(m, "a", S.lang)
    : "# ===== " + T("outA_" + m.scenario) + " =====\n" + genDiag(m, "a", S.lang) + "\n\n# ===== " + T("outB_" + m.scenario) + " =====\n" + genDiag(m, "b", S.lang);
  S.checks = runChecks(m, S.sec, S.lang);
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
  const note = { a: T("outNoteFw"), b: T("outNoteFw"), fct: T("outNoteFct"), guide: T("outNoteGuide"), diag: T("outNoteDiag"), sum: T("outNoteSum") }[S.tab];
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
  let f = $('.fld[data-ps~="' + p + '"]') || $('.fld[data-p="' + p + '"]');
  if (!f && S.mode === "essential") { S.mode = "expert"; renderChrome(); renderForm(); f = $('.fld[data-ps~="' + p + '"]') || $('.fld[data-p="' + p + '"]'); }
  if (!f) return;
  f.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  const inp = $("input,select,textarea", f); if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 300);
  f.classList.add("pulse"); setTimeout(() => f.classList.remove("pulse"), 1600);
}
function markFields() {
  $$(".fld.err, .fld.warn").forEach(f => f.classList.remove("err", "warn"));
  S.checks.filter(c => c.p && c.lvl !== "info").forEach(c => { const f = $('.fld[data-ps~="' + c.p + '"]') || $('.fld[data-p="' + c.p + '"]'); if (f && !f.classList.contains("err")) f.classList.add(c.lvl); });
}

function refresh() { computeOutputs(); renderTopo(); renderTabs(); renderPanel(); markFields(); persist(); }

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
  const pick = id => { S.m = makePreset(id, S.lang); if (id === "custom") S.mode = "expert"; S.search = ""; $("#search").value = ""; renderChrome(); renderForm(); refresh(); };
  const card = (id, short, tags) => {
    const [name, desc] = PRESET_TXT[S.lang][id];
    return el("button", { type: "button", class: "preset" + (S.m.preset === id ? " on" : ""), "aria-pressed": String(S.m.preset === id), onclick: () => pick(id) },
      el("span", { class: "p-ico", "aria-hidden": "true", html: PRESET_ICON[id] }),
      el("span", { class: "p-txt" }, el("b", { text: short ? name.replace(/^FortiClient,\s*/, "").replace(/^./, x => x.toUpperCase()) : name }), el("span", { class: "p-desc", text: desc }),
        el("span", { class: "p-tags" }, tags.map(t => el("span", { class: "p-tag", text: T(t) })))));
  };
  ph.append(
    el("div", { class: "p-group sites" }, el("h3", { text: T("grpSites") }),
      el("div", { class: "p-cards" }, card("s2s", false, ["pt_both"]), card("s2sdyn", false, ["pt_hub"])),
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
