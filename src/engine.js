/* Fortissimo — motore (nessuna dipendenza dal DOM) */
const DIAL = sc => sc === "dialup";

/* ---------- modello ---------- */
function baseModel(sc) {
  return {
    v: 1, name: "", scenario: sc, preset: "", fos: "7.4",
    a: { label: "", tunnel: "", wan: "wan1", ip: "", fqdn: "", nets: "", tip: "" },
    b: { label: "", tunnel: "", wan: "wan1", ip: "", fqdn: "", nets: "", tip: "" },
    tunPrefix: "30",
    auth: { method: "psk", certA: "", certB: "", peerA: "", peerB: "", caA: "", caB: "", cnA: "", cnB: "" },
    ident: { networkId: "0", usedIds: "", localid: "", peerMode: "any" },
    crypto: { ike: "2", mode: "main", p1: ["aes256gcm-prfsha384", "aes256-sha256"], dh1: ["20"], life1: "86400",
              p2: ["aes256gcm", "aes256-sha256"], pfs: "enable", dh2: ["20"], life2: "43200" },
    sel: { mode: "any" },
    route: { on: true, distance: "10", bh: true, bhDistance: "254" },
    dial: { auth: "local", group: "", users: "", ldapServer: "", ldapDN: "", radiusServer: "", samlServer: "entra-vpn", samlPort: "9443",
            tenant: "", groupId: "", idpCert: "REMOTE_Cert_1", spCert: "Fortinet_Factory", authCert: "", poolStart: "", poolEnd: "",
            dns1: "", dns2: "", split: "split", client: "", authTimeout: "", saveUser: false,
            ldapCreate: false, ldapIp: "", ldapCnid: "sAMAccountName", ldapBase: "", ldapBind: "", ldapSecure: "disable", ldapNested: false,
            radiusCreate: false, radiusIp: "", radiusTimeout: "", domains: "", suffix: "", exclude: "", localLan: false },
    gwm: { mode: "any", subnet: "", start: "", end: "", country: "" },
    fec: { on: false, base: "", redundant: "" },
    bgp: { on: false, asA: "65001", asB: "65002", ridA: "", ridB: "", overlay: "169.254.20.0/24", keepalive: "", holdtime: "", soft: true, ldf: true, gr: false },
    dual: { on: false, aWan: "wan2", aIp: "", aFqdn: "", aTunnel: "", aTip: "", bWan: "", bIp: "", bFqdn: "", bTunnel: "", bTip: "", mode: "backup", backupDist: "20", holdType: "immediate", holdDelay: "" },
    trans: { mode: "udp", port: "", threshold: "" },
    bgpAdv: { on: false, tpl: "", multipath: false, gr: false, keepalive: "", holdtime: "", nodes: [], links: [], pls: [], rms: [],
              topo: "hub", hubId: "", hubMode: "dial", bgpType: "ibgp", baseAs: "65000", advpn: false, asManual: false, pool: "169.254.100.0/24", autoLink: "hub", p2pPrefix: "30", ipPlan: "seq",
              sdwan: { on: false, zone: "VPN", lat: "150", jit: "30", loss: "2", pol: true, base: "100", mode: "zone", alg: "L4" }, pairEx: [], names: "peer", dpdInt: "" },
    adv: { a: {}, b: {} }
  };
}
function upgradeModel(m) {
  if (m.scenario === "native") { m.scenario = "dialup"; m.preset = "fct-" + ((m.dial && m.dial.auth) || "local"); }
  delete m.native; delete m.ikep;
  const b = baseModel(m.scenario || "s2s");
  Object.keys(b).forEach(k => {
    if (m[k] === undefined || m[k] === null) m[k] = b[k];
    else if (k !== "adv" && b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) Object.keys(b[k]).forEach(j => { if (m[k][j] === undefined) m[k][j] = b[k][j]; });
  });
  m.adv = m.adv || { a: {}, b: {} }; m.adv.a = m.adv.a || {}; m.adv.b = m.adv.b || {};
  if (m.scenario !== "ms" && m.bgpAdv && m.bgpAdv.on && (m.bgpAdv.nodes || []).length) msFromLegacy(m);
  if (m.scenario === "ms") { if (m.fos === "7.2") m.fos = "7.4"; m.bgpAdv.on = true; }
  return m;
}
/* progetti salvati con il vecchio modulo «BGP avanzato»: diventano una rete multi-sede con topologia personalizzata */
function msFromLegacy(m) {
  const g = m.bgpAdv, sc = m.scenario, site = sc === "s2s" || sc === "s2sdyn";
  const bound = s => (g.nodes || []).find(n => n.ipsec === s);
  (g.links || []).forEach(l => {
    if (!l.src) return;
    const na = bound("a"), nb = bound("b"), k = l.src === "ipsec2" ? 1 : 0;
    const ta = site ? tunnelsFor(m, "a")[k] : null, tb = site ? tunnelsFor(m, "b")[k] : null;
    if (!na || !nb || !ta || !tb) { l._drop = true; return; }
    const gwOf = t => String(t.rIp || "").trim() || String(t.rFqdn || "").trim();
    const A = { If: ta.name, Ip: ta.tip || "", Wan: k ? ta.wan || "" : "", Gw: k ? gwOf(ta) : "" }, B = { If: tb.name, Ip: tb.tip || "", Wan: k ? tb.wan || "" : "", Gw: k ? gwOf(tb) : "" };
    const [X, Y] = l.a === na.id ? [A, B] : [B, A];
    ["If", "Ip", "Wan", "Gw"].forEach(x => { l["a" + x] = X[x]; l["b" + x] = Y[x]; });
    Object.assign(l, { kind: "tunnel", ipsec: true, src: "", a: l.a === na.id ? na.id : nb.id, b: l.a === na.id ? nb.id : na.id });
    if (sc === "s2sdyn") Object.assign(na, { dialName: m.a.tunnel || na.dialName, overlay: m.bgp.overlay || na.overlay, dialIp: m.a.tip || na.dialIp });
  });
  g.links = (g.links || []).filter(l => !l._drop);
  (g.nodes || []).forEach(n => {
    if (n.ipsec && m[n.ipsec] && site) {
      const S = m[n.ipsec];
      if (!String(n.name || "").trim()) n.name = S.label || n.id;
      n.wan = S.wan || n.wan;
      n.pubIp = String(S.ip || "").trim() || String(S.fqdn || "").trim();
      if (!String(n.nets || "").trim()) n.nets = S.nets;
      n.dyn = sc === "s2sdyn" && n.ipsec === "b";
    }
    if (!String(n.pubIp || "").trim() && String(n.fqdn || "").trim()) n.pubIp = n.fqdn.trim();
    n.ipsec = "";
  });
  Object.assign(g, { on: true, topo: "custom", asManual: true });
  m.scenario = "ms"; m.preset = "ms"; m._converted = true;
}

function recommendedAdv(sc, blank) {
  const adv = { a: {}, b: {} };
  if (blank) return adv;
  OPTS.forEach(o => {
    const sides = (o.sides && o.sides[sc]) || [];
    sides.forEach(s => { const r = o.rec ? o.rec(sc, s) : null; if (r !== null && r !== undefined) adv[s][o.k] = r; });
  });
  return adv;
}

const PRESETS = ["s2s", "s2sdyn", "ms", "fct-local", "fct-ldap", "fct-radius", "fct-saml", "custom"];

function makePreset(id, lang) {
  const it = lang !== "en";
  let m;
  if (id === "s2s" || id === "custom") {
    m = baseModel("s2s");
    Object.assign(m.a, { label: it ? "Sede A" : "Site A", tunnel: "VPN_to_B", ip: "198.51.100.10", nets: "192.168.10.0/24", tip: "169.254.10.1" });
    Object.assign(m.b, { label: it ? "Sede B" : "Site B", tunnel: "VPN_to_A", ip: "203.0.113.20", nets: "192.168.20.0/24", tip: "169.254.10.2" });
    Object.assign(m.dual, { aTunnel: "VPN2_to_B", bTunnel: "VPN2_to_A", aIp: "198.51.100.50", aTip: "169.254.10.5", bTip: "169.254.10.6" });
    if (id === "custom") {
      m.crypto = { ike: "2", mode: "main", p1: [], dh1: [], life1: "", p2: [], pfs: "enable", dh2: [], life2: "" };
      m.route = { on: true, distance: "", bh: false, bhDistance: "254" };
    }
  } else if (id === "s2sdyn") {
    m = baseModel("s2sdyn");
    Object.assign(m.a, { label: it ? "Sede centrale" : "Head office", tunnel: "DIAL_Filiali", ip: "198.51.100.10", nets: "192.168.10.0/24", tip: "169.254.20.1" });
    Object.assign(m.b, { label: it ? "Filiale" : "Branch", tunnel: "VPN_Centrale", nets: "192.168.30.0/24", tip: "169.254.20.2" });
    m.ident.localid = it ? "filiale-01" : "branch-01";
    m.ident.peerMode = "one";
    m.sel.mode = "subnets";
  } else if (id === "ms") {
    m = baseModel("ms");
    m.bgpAdv = msTemplate(it);
  } else {
    m = baseModel("dialup");
    Object.assign(m.a, { label: it ? "Sede" : "Office", tunnel: "RA_IPsec", fqdn: "vpn.example.com", nets: "192.168.10.0/24" });
    m.crypto = { ike: "2", mode: "main", p1: ["aes256-sha256", "aes256-sha384"], dh1: ["20"], life1: "86400",
                 p2: ["aes256-sha256", "aes256gcm"], pfs: "enable", dh2: ["20"], life2: "43200" };
    Object.assign(m.dial, { group: "VPN_USERS", poolStart: "10.254.10.10", poolEnd: "10.254.10.210", dns1: "192.168.10.10", client: it ? "Azienda VPN" : "Company VPN" });
    m.dial.auth = id.replace("fct-", "");
    if (m.dial.auth === "local") { m.dial.users = it ? "mario.rossi, anna.bianchi" : "john.smith, jane.doe"; m.dial.authTimeout = "60"; }
    if (m.dial.auth === "ldap") Object.assign(m.dial, { ldapServer: "AD_LDAP", ldapDN: it ? "CN=VPN,OU=Gruppi,DC=azienda,DC=local" : "CN=VPN,OU=Groups,DC=company,DC=local", ldapCreate: true, ldapIp: "192.168.10.10",
      ldapBase: it ? "DC=azienda,DC=local" : "DC=company,DC=local", ldapBind: it ? "CN=svc-fortigate,OU=Servizi,DC=azienda,DC=local" : "CN=svc-fortigate,OU=Services,DC=company,DC=local" });
    if (m.dial.auth === "radius") Object.assign(m.dial, { radiusServer: "NPS", authTimeout: "60", radiusCreate: true, radiusIp: "192.168.10.20" });
  }
  m.preset = id;
  m.adv = recommendedAdv(m.scenario, id === "custom");
  m.name = (PRESET_TXT[it ? "it" : "en"][id] || [id])[0];
  if (id === "ms") bgpNormalize(m);
  return m;
}

/* ---------- utilità rete ---------- */
const isIp = s => { const x = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim()); return !!x && x.slice(1).every(o => +o <= 255); };
const ipInt = s => s.split(".").reduce((a, o) => a * 256 + (+o), 0);
const intIp = n => [24, 16, 8, 0].map(b => Math.floor(n / Math.pow(2, b)) % 256).join(".");
const maskOf = p => p === 0 ? "0.0.0.0" : intIp((Math.pow(2, 32) - Math.pow(2, 32 - p)));
function parseNets(txt) {
  const out = [], bad = [];
  String(txt || "").split(/[\n,;]+/).map(x => x.trim()).filter(Boolean).forEach(x => {
    let [ip, p] = x.split("/"); p = p === undefined ? 32 : Number(p);
    if (!isIp(ip) || !Number.isInteger(p) || p < 0 || p > 32) { bad.push(x); return; }
    const size = Math.pow(2, 32 - p), start = Math.floor(ipInt(ip) / size) * size;
    out.push({ raw: x, ip, p, net: intIp(start), mask: maskOf(p), start, end: start + size - 1, aligned: start === ipInt(ip) });
  });
  return { out, bad };
}
const overlap = (a, b) => a.start <= b.end && b.start <= a.end;
const q = s => '"' + String(s).replace(/"/g, "") + '"';
let PH_LANG = "it";
function setOutLang(l) { PH_LANG = l === "en" ? "en" : "it"; }
const PH_EN = { "interfaccia-lan": "lan-interface", "interfaccia": "interface", "as-locale": "local-as", "as-remoto": "remote-as", "ca-peer": "peer-ca", "certificato": "certificate", "certificato-idp": "idp-certificate",
  "certificato-sp": "sp-certificate", "dn-account-di-bind": "bind-account-dn", "dn-base": "base-dn", "dn-gruppo": "group-dn", "gruppo": "group",
  "id-gruppo-entra": "entra-group-id", "id-tenant": "tenant-id", "ip-del-dc": "dc-ip", "ip-del-server": "server-ip", "ip-remoto": "remote-ip",
  "ip-tunnel-remoto": "remote-tunnel-ip", "local-id-filiale": "branch-local-id", "nome-connessione": "connection-name", "porta": "port", "porta-tcp": "tcp-port",
  "primo-ip": "first-ip", "ultimo-ip": "last-ip", "server-ldap": "ldap-server", "server-radius": "radius-server", "server-saml": "saml-server",
  "utente-peer": "peer-user", "gruppi-dh": "dh-groups", "proposte": "proposals", "password-di-bind": "bind-password", "segreto-condiviso": "shared-secret",
  "rete-overlay": "overlay-network", "utente": "user", "rete": "network", "paese": "country", "secondi": "seconds", "cifratura": "encryption", "integrita": "integrity" };
const phL = n => "<" + (PH_LANG === "en" ? (PH_EN[n] || n) : n) + ">";
const ph = (v, name) => (v !== undefined && v !== null && String(v).trim() !== "") ? String(v).trim() : phL(name);
const xmlEsc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const fosNum = m => Number(m.fos) || 7.4;

function randomPsk(len) {
  const cs = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_.+=@%^*~";
  const buf = new Uint32Array(len || 32); (globalThis.crypto || require("crypto").webcrypto).getRandomValues(buf);
  return Array.from(buf, n => cs[n % cs.length]).join("");
}
/* overlay BGP per la filiale a IP dinamico */
function overlayInfo(m) {
  const o = parseNets(m.bgp.overlay).out[0];
  if (!o || o.p > 30) return null;
  return Object.assign({}, o, { bogus: intIp(o.end - 1) });
}

/* ---------- applicabilità opzioni ---------- */
function optApplies(o, m, side) {
  const sides = (o.sides && o.sides[m.scenario]) || [];
  if (!sides.includes(side)) return false;
  if (o.ike && m.crypto.ike !== o.ike) return false;
  if (o.since && Number(m.fos) < Number(o.since)) return false;
  return true;
}
function optDepOk(o, adv) {
  if (!o.dep) return true;
  const [k, v] = o.dep, cur = adv[k];
  if (v.startsWith("!")) return cur !== undefined && cur !== null && cur !== "" && cur !== v.slice(1);
  return cur === v;
}

/* ---------- tunnel per lato (doppia WAN) ---------- */
function tunnelsFor(m, side) {
  const sc = m.scenario, S = m[side], O = m[side === "a" ? "b" : "a"], d = m.dual;
  const T1 = ph(S.tunnel, side === "a" ? "tunnel-A" : "tunnel-B");
  const list = [{ k: 1, name: T1, wan: S.wan, rIp: sc === "s2sdyn" ? m.a.ip : O.ip, rFqdn: sc === "s2sdyn" ? m.a.fqdn : O.fqdn, tip: S.tip, otip: O.tip }];
  if (sc === "s2s" && d.on) {
    const bHas2 = !!(String(d.bIp).trim() || String(d.bFqdn).trim());
    if (side === "a") list.push({ k: 2, name: ph(d.aTunnel, "tunnel-A2"), wan: d.aWan, rIp: bHas2 ? d.bIp : m.b.ip, rFqdn: bHas2 ? d.bFqdn : m.b.fqdn, tip: d.aTip, otip: d.bTip });
    else list.push({ k: 2, name: ph(d.bTunnel, "tunnel-B2"), wan: bHas2 ? d.bWan : m.b.wan, rIp: d.aIp, rFqdn: d.aFqdn, tip: d.bTip, otip: d.aTip });
  }
  return list;
}

/* ---------- generatore FortiGate ---------- */
function genFortiGate(m, side, sec) {
  const S = m[side], O = m[side === "a" ? "b" : "a"], sc = m.scenario, c = m.crypto, dial = DIAL(sc);
  const isHub = (sc === "s2sdyn" && side === "a") || dial;
  const bgpOn = ipsecBgp(m);
  const tunnels = tunnelsFor(m, side);
  const T = tunnels[0].name;
  const L = [];
  const adv = (m.adv && m.adv[side]) || {};
  const advSet = scope => OPTS.filter(o => o.scope === scope && optApplies(o, m, side) && optDepOk(o, adv))
                              .filter(o => adv[o.k] !== undefined && adv[o.k] !== null && adv[o.k] !== "")
                              .filter(o => !(bgpOn && isHub && o.k === "p1.add-route"));
  const d = m.dial;

  // 1. globali e impostazioni di sistema
  if (dial) {
    const g = [];
    if (sc === "dialup" && d.auth === "saml") g.push("    set auth-ike-saml-port " + ph(d.samlPort, "porta"));
    if (String(d.authTimeout).trim()) g.push("    set remoteauthtimeout " + d.authTimeout.trim());
    if (g.length) L.push("config system global", ...g, "end", "");
  }
  if (sc === "dialup" && m.trans.mode !== "udp" && fosNum(m) >= 7.4 && c.ike === "2")
    L.push("config system settings", "    set ike-tcp-port " + ph(m.trans.port, "porta-tcp"), "end", "");
  // 2. server di autenticazione, utenti e gruppi
  if (dial && d.auth === "ldap" && d.ldapCreate) {
    const x = ["config user ldap", "    edit " + q(ph(d.ldapServer, "server-ldap")), "        set server " + q(ph(d.ldapIp, "ip-del-dc")),
      "        set cnid " + q(ph(d.ldapCnid, "sAMAccountName")), "        set dn " + q(ph(d.ldapBase, "dn-base")), "        set type regular",
      "        set username " + q(ph(d.ldapBind, "dn-account-di-bind")), "        set password " + (sec && sec.ldap ? q(sec.ldap) : phL("password-di-bind"))];
    if (d.ldapSecure === "ldaps") x.push("        set secure ldaps", "        set port 636");
    else if (d.ldapSecure === "starttls") x.push("        set secure starttls");
    if (d.ldapNested) x.push("        set search-type recursive");
    L.push(...x, "    next", "end", "");
  }
  if (dial && d.auth === "radius" && d.radiusCreate) {
    const x = ["config user radius", "    edit " + q(ph(d.radiusServer, "server-radius")), "        set server " + q(ph(d.radiusIp, "ip-del-server")),
      "        set secret " + (sec && sec.radius ? q(sec.radius) : phL("segreto-condiviso"))];
    if (String(d.radiusTimeout).trim()) x.push("        set timeout " + d.radiusTimeout.trim());
    L.push(...x, "    next", "end", "");
  }
  if (dial) {
    const G = ph(d.group, "gruppo");
    if (sc === "dialup" && d.auth === "saml") {
      const S2 = ph(d.samlServer, "server-saml"), P = ph(d.samlPort, "porta"), H = ph(m.a.fqdn || m.a.ip, "fqdn"), TN = ph(d.tenant, "id-tenant");
      const sp = "https://" + H + ":" + P + "/remote/saml/";
      L.push("config user saml", "    edit " + q(S2),
        "        set cert " + q(ph(d.spCert, "certificato-sp")),
        "        set entity-id " + q(sp + "metadata"), "        set single-sign-on-url " + q(sp + "login"), "        set single-logout-url " + q(sp + "logout"),
        "        set idp-entity-id " + q("https://sts.windows.net/" + TN + "/"),
        "        set idp-single-sign-on-url " + q("https://login.microsoftonline.com/" + TN + "/saml2"),
        "        set idp-single-logout-url " + q("https://login.microsoftonline.com/" + TN + "/saml2"),
        "        set idp-cert " + q(ph(d.idpCert, "certificato-idp")),
        '        set user-name "username"', '        set group-name "group"', "        set digest-method sha256", "    next", "end", "");
      L.push("config user group", "    edit " + q(G), "        set member " + q(S2), "        config match", "            edit 1",
        "                set server-name " + q(S2), "                set group-name " + q(ph(d.groupId, "id-gruppo-entra")),
        "            next", "        end", "    next", "end", "");
      L.push("config system interface", "    edit " + q(ph(S.wan, "wan")), "        set ike-saml-server " + q(S2), "    next", "end", "");
      if (String(d.authCert).trim()) L.push("config user setting", "    set auth-cert " + q(d.authCert.trim()), "end", "");
    } else if (sc === "dialup" && d.auth === "ldap") {
      const LS = ph(d.ldapServer, "server-ldap");
      L.push("config user group", "    edit " + q(G), "        set member " + q(LS), "        config match", "            edit 1",
        "                set server-name " + q(LS), "                set group-name " + q(ph(d.ldapDN, "dn-gruppo")),
        "            next", "        end", "    next", "end", "");
    } else if (d.auth === "radius") {
      L.push("config user group", "    edit " + q(G), "        set member " + q(ph(d.radiusServer, "server-radius")), "    next", "end", "");
    } else {
      const users = String(d.users).split(",").map(x => x.trim()).filter(Boolean);
      L.push("config user group", "    edit " + q(G), "        set member " + (users.length ? users.map(q).join(" ") : q(phL("utente"))), "    next", "end", "");
    }
  }
  // 3. peer PKI
  const useCert = !dial && m.auth.method === "cert";
  const peerName = side === "a" ? m.auth.peerA : m.auth.peerB;
  if (useCert) {
    const ca = side === "a" ? m.auth.caA : m.auth.caB, cn = side === "a" ? m.auth.cnA : m.auth.cnB;
    L.push("config user peer", "    edit " + q(ph(peerName, "utente-peer")), "        set ca " + q(ph(ca, "ca-peer")));
    if (String(cn).trim()) L.push("        set cn " + q(cn.trim()));
    L.push("    next", "end", "");
  }
  // 4. oggetti split tunnel
  const ownNets = parseNets(S.nets).out;
  const splitName = T + "_split";
  if (dial && d.split === "split" && ownNets.length) {
    L.push("config firewall address");
    ownNets.forEach((n, i) => L.push("    edit " + q(T + "_net" + (i + 1)), "        set subnet " + n.net + " " + n.mask, "    next"));
    L.push("end", "", "config firewall addrgrp", "    edit " + q(splitName),
      "        set member " + ownNets.map((n, i) => q(T + "_net" + (i + 1))).join(" "), "    next", "end", "");
  }

  const exclNets = parseNets(d.exclude).out, exclName = T + "_exclude";
  if (dial && d.split === "full" && exclNets.length) {
    L.push("config firewall address");
    exclNets.forEach((n, i) => L.push("    edit " + q(T + "_excl" + (i + 1)), "        set subnet " + n.net + " " + n.mask, "    next"));
    L.push("end", "", "config firewall addrgrp", "    edit " + q(exclName),
      "        set member " + exclNets.map((n, i) => q(T + "_excl" + (i + 1))).join(" "), "    next", "end", "");
  }
  const listQ = v => String(v || "").split(/[\s,;]+/).map(x => x.trim()).filter(Boolean).map(q).join(" ");
  // 5. phase1 (uno per tunnel)
  const nid = parseInt(m.ident.networkId, 10);
  L.push("config vpn ipsec phase1-interface");
  tunnels.forEach(t => {
    let type = "static";
    if (isHub) type = "dynamic"; else if (!String(t.rIp || "").trim() && String(t.rFqdn || "").trim()) type = "ddns";
    const p1 = ["    edit " + q(t.name), "        set type " + type, "        set interface " + q(ph(t.wan, "wan")), "        set ike-version " + c.ike];
    if (c.ike === "1") p1.push("        set mode " + c.mode);
    if (useCert) {
      p1.push("        set authmethod signature", "        set certificate " + q(ph(side === "a" ? m.auth.certA : m.auth.certB, "certificato")),
        "        set peertype peer", "        set peer " + q(ph(peerName, "utente-peer")));
    } else if (sc === "s2sdyn" && side === "a" && m.ident.peerMode === "one") p1.push("        set peertype one", "        set peerid " + q(ph(m.ident.localid, "local-id-filiale")));
    else p1.push("        set peertype any");
    if (sc === "s2sdyn" && side === "b" && String(m.ident.localid).trim()) p1.push("        set localid " + q(m.ident.localid.trim()));
    if (type === "static") p1.push("        set remote-gw " + ph(t.rIp, "ip-remoto"));
    else if (type === "ddns") p1.push("        set remotegw-ddns " + q(t.rFqdn));
    if ((sc === "dialup" || sc === "s2sdyn") && c.ike === "2" && nid > 0) p1.push("        set network-overlay enable", "        set network-id " + nid);
    p1.push("        set proposal " + (c.p1.length ? c.p1.join(" ") : phL("proposte")), "        set dhgrp " + (c.dh1.length ? c.dh1.join(" ") : phL("gruppi-dh")));
    if (String(c.life1).trim()) p1.push("        set keylife " + c.life1.trim());
    if (dial) {
      if (c.ike === "2") p1.push("        set eap enable", "        set eap-identity send-request", "        set authusrgrp " + q(ph(d.group, "gruppo")));
      else p1.push("        set xauthtype auto", "        set authusrgrp " + q(ph(d.group, "gruppo")));
      p1.push("        set mode-cfg enable", "        set ipv4-start-ip " + ph(d.poolStart, "primo-ip"), "        set ipv4-end-ip " + ph(d.poolEnd, "ultimo-ip"));
      if (String(d.dns1).trim()) p1.push("        set ipv4-dns-server1 " + d.dns1.trim());
      if (String(d.dns2).trim()) p1.push("        set ipv4-dns-server2 " + d.dns2.trim());
      if (d.split === "split" && ownNets.length) p1.push("        set ipv4-split-include " + q(splitName));
      if (d.split === "full" && exclNets.length) p1.push("        set ipv4-split-exclude " + q(exclName));
      if (fosNum(m) >= 7.4 && listQ(d.domains)) p1.push("        set internal-domain-list " + listQ(d.domains));
      if (fosNum(m) >= 7.6 && listQ(d.suffix)) p1.push("        set dns-suffix-search " + listQ(d.suffix));
      if (c.ike === "1") p1.push("        set unity-support enable");
    }
    if (sc === "dialup" && c.ike === "2" && m.trans.mode !== "udp" && fosNum(m) >= 7.4) {
      if (m.trans.mode === "auto" && fosNum(m) >= 7.6) {
        p1.push("        set transport auto");
        if (String(m.trans.threshold).trim()) p1.push("        set auto-transport-threshold " + m.trans.threshold.trim());
      } else p1.push("        set transport tcp");
    }
    if (isHub && fosNum(m) >= 7.4 && m.gwm.mode !== "any") {
      const g = m.gwm;
      p1.push("        set remote-gw-match " + g.mode);
      if (g.mode === "ipmask") { const n = parseNets(g.subnet).out[0]; p1.push("        set remote-gw-subnet " + (n ? n.net + " " + n.mask : phL("rete"))); }
      else if (g.mode === "iprange") p1.push("        set remote-gw-start-ip " + ph(g.start, "primo-ip"), "        set remote-gw-end-ip " + ph(g.end, "ultimo-ip"));
      else if (g.mode === "geography") p1.push("        set remote-gw-country " + q(ph(String(g.country).trim().toUpperCase(), "paese")));
    }
    if (t.k === 2 && m.dual.mode === "standby") {
      p1.push("        set monitor " + q(tunnels[0].name));
      if (m.dual.holdType === "delay") p1.push("        set monitor-hold-down-type delay", "        set monitor-hold-down-delay " + ph(m.dual.holdDelay, "secondi"));
    }
    const fecOn = (sc === "s2s" || sc === "s2sdyn") && m.fec.on;
    if (fecOn) {
      p1.push("        set npu-offload disable", "        set fec-egress enable", "        set fec-ingress enable");
      if (String(m.fec.base).trim()) p1.push("        set fec-base " + m.fec.base.trim());
      if (String(m.fec.redundant).trim()) p1.push("        set fec-redundant " + m.fec.redundant.trim());
    }
    if (bgpOn && isHub) p1.push("        set add-route disable");
    advSet("p1").filter(o => !(fecOn && o.k === "p1.npu-offload")).forEach(o => p1.push("        set " + o.cli + " " + (o.type === "text" ? q(adv[o.k]) : adv[o.k])));
    if (!useCert) p1.push("        set psksecret " + (sec && sec.psk ? q(sec.psk) : "<PSK>"));
    if (adv["p1.ppk"] && adv["p1.ppk"] !== "disable" && c.ike === "2") p1.push("        set ppk-secret " + (sec && sec.ppk ? q(sec.ppk) : "<PPK>"));
    p1.push("    next");
    L.push(...p1);
  });
  L.push("end", "");

  // 6. phase2
  const p2common = ["        set proposal " + (c.p2.length ? c.p2.join(" ") : phL("proposte"))];
  if (c.pfs === "enable") p2common.push("        set dhgrp " + (c.dh2.length ? c.dh2.join(" ") : phL("gruppi-dh")));
  else p2common.push("        set pfs disable");
  if (String(c.life2).trim() && adv["p2.keylife-type"] !== "kbs") p2common.push("        set keylifeseconds " + c.life2.trim());
  advSet("p2").forEach(o => p2common.push("        set " + o.cli + " " + adv[o.k]));
  const remote = parseNets(O.nets).out;
  const useSubnets = (sc === "s2s" && m.sel.mode === "subnets") || (sc === "s2sdyn" && side === "b" && !bgpOn);
  L.push("config vpn ipsec phase2-interface");
  tunnels.forEach(t => {
    if (useSubnets && ownNets.length && remote.length) {
      let i = 0;
      ownNets.forEach(ln => remote.forEach(rn => {
        i++;
        L.push("    edit " + q(t.name + "_p2_" + i), "        set phase1name " + q(t.name), ...p2common,
          "        set src-subnet " + ln.net + " " + ln.mask, "        set dst-subnet " + rn.net + " " + rn.mask, "    next");
      }));
    } else L.push("    edit " + q(t.name), "        set phase1name " + q(t.name), ...p2common, "    next");
  });
  L.push("end", "");

  // 7. IP delle interfacce tunnel
  const ifs = [];
  if (sc === "s2s") {
    const pre = Number(m.tunPrefix) || 30;
    tunnels.forEach(t => { if (isIp(t.tip) && isIp(t.otip)) ifs.push("    edit " + q(t.name), "        set ip " + t.tip + " 255.255.255.255",
      "        set remote-ip " + t.otip + " " + maskOf(pre), "        set allowaccess ping", "    next"); });
  } else if (sc === "s2sdyn" && bgpOn) {
    const ov = overlayInfo(m);
    if (ov && isIp(S.tip)) ifs.push("    edit " + q(T), "        set ip " + S.tip + " 255.255.255.255", "        set remote-ip " + ov.bogus + " " + ov.mask, "        set allowaccess ping", "    next");
  }
  if (ifs.length) L.push("config system interface", ...ifs, "end", "");

  // 8. rotte statiche e blackhole
  const routes = [];
  const label = O.label ? O.label : (side === "a" ? "B" : "A");
  if (!dial && remote.length) {
    const viaTunnel = m.route.on && !bgpOn && !(sc === "s2sdyn" && side === "a");
    remote.forEach(n => {
      if (viaTunnel) tunnels.forEach(t => {
        const dist = t.k === 1 || m.dual.mode === "ecmp" ? String(m.route.distance).trim() : String(m.dual.backupDist).trim();
        routes.push("    edit 0", "        set dst " + n.net + " " + n.mask, "        set device " + q(t.name));
        if (dist) routes.push("        set distance " + dist);
        routes.push("        set comment " + q("VPN " + label + (t.k === 2 ? " (WAN 2)" : "")), "    next");
      });
      if (m.route.bh) routes.push("    edit 0", "        set dst " + n.net + " " + n.mask, "        set blackhole enable",
        "        set distance " + (String(m.route.bhDistance).trim() || "254"), "        set comment " + q("Blackhole VPN " + label), "    next");
    });
  }
  if (routes.length) L.push("config router static", ...routes, "end", "");

  // 9. BGP
  if (bgpOn && !advOn(m)) L.push(...genBgp(m, side, tunnels, sec), "");

  while (L.length && L[L.length - 1] === "") L.pop();
  return L.join("\n");
}

function genBgp(m, side, tunnels, sec) {
  const b = m.bgp, sc = m.scenario;
  const as = side === "a" ? b.asA : b.asB, ras = side === "a" ? b.asB : b.asA;
  const ibgp = String(b.asA).trim() !== "" && String(b.asA).trim() === String(b.asB).trim();
  const rid = String(side === "a" ? b.ridA : b.ridB).trim();
  const own = parseNets(m[side].nets).out;
  const ind = n => " ".repeat(n);
  const nb = n => {
    const x = [ind(n) + "set remote-as " + ph(ras, "as-remoto")];
    if (b.soft) x.push(ind(n) + "set soft-reconfiguration enable");
    if (b.ldf) x.push(ind(n) + "set link-down-failover enable");
    if (String(b.keepalive).trim()) x.push(ind(n) + "set keep-alive-timer " + b.keepalive.trim());
    if (String(b.holdtime).trim()) x.push(ind(n) + "set holdtime-timer " + b.holdtime.trim());
    if (sec && sec.bgp) x.push(ind(n) + "set password " + q(sec.bgp));
    return x;
  };
  const L = ["config router bgp", "    set as " + ph(as, "as-locale")];
  if (rid) L.push("    set router-id " + rid);
  if (b.gr) L.push("    set graceful-restart enable");
  if (sc === "s2s" && m.dual.on) L.push(ibgp ? "    set ibgp-multipath enable" : "    set ebgp-multipath enable");
  if (sc === "s2sdyn" && side === "a") {
    const ov = overlayInfo(m), G = tunnels[0].name + "_peers";
    L.push("    config neighbor-group", "        edit " + q(G), ...nb(12));
    if (ibgp) L.push("            set route-reflector-client enable");
    L.push("        next", "    end", "    config neighbor-range", "        edit 1",
      "            set prefix " + (ov ? ov.net + " " + ov.mask : phL("rete-overlay")), "            set neighbor-group " + q(G), "        next", "    end");
  } else {
    const peers = sc === "s2sdyn" ? [m.a.tip] : tunnels.map(t => t.otip);
    L.push("    config neighbor");
    peers.forEach(p => L.push("        edit " + q(ph(p, "ip-tunnel-remoto")), ...nb(12), "        next"));
    L.push("    end");
  }
  if (own.length) {
    L.push("    config network");
    own.forEach((n, i) => L.push("        edit " + (i + 1), "            set prefix " + n.net + " " + n.mask, "        next"));
    L.push("    end");
  }
  L.push("end");
  return L;
}

/* ---------- FortiClient XML ---------- */
function genXml(m, sec) {
  const c = m.crypto, d = m.dial, nid = parseInt(m.ident.networkId, 10);
  const now = new Date(), date = now.getFullYear() + "/" + String(now.getMonth() + 1).padStart(2, "0") + "/" + String(now.getDate()).padStart(2, "0");
  const i = n => " ".repeat(n);
  const p1 = c.p1.map(p => FCT_P1[p]).filter(Boolean), p2 = c.p2.map(p => FCT_P2[p]).filter(Boolean);
  const tm = { udp: 0, tcp: 1, auto: 2 }[m.trans.mode] || 0;
  const L = ['<?xml version="1.0" encoding="UTF-8" ?>', "<forticlient_configuration>",
    i(4) + "<forticlient_version>7.4.3.6002</forticlient_version>", i(4) + "<version>7.4.3</version>",
    i(4) + "<exported_by_version>7.4.3.6002</exported_by_version>", i(4) + "<date>" + date + "</date>",
    i(4) + "<partial_configuration>1</partial_configuration>", i(4) + "<os_version>windows</os_version>", i(4) + "<os_architecture>x64</os_architecture>",
    i(4) + "<vpn>", i(8) + "<ipsecvpn>", i(12) + "<connections>", i(16) + "<connection>",
    i(20) + "<name>" + xmlEsc(ph(d.client, "nome-connessione")) + "</name>", i(20) + "<single_user_mode>0</single_user_mode>",
    i(20) + "<machine>0</machine>", i(20) + "<type>manual</type>",
    i(20) + "<ui>", i(24) + "<show_passcode>0</show_passcode>", i(24) + "<show_remember_password>0</show_remember_password>",
    i(24) + "<show_alwaysup>0</show_alwaysup>", i(24) + "<show_autoconnect>0</show_autoconnect>",
    i(24) + "<save_username>" + (d.saveUser ? 1 : 0) + "</save_username>", i(20) + "</ui>",
    i(20) + "<ike_settings>", i(24) + "<version>" + c.ike + "</version>"];
  if (d.auth === "ldap" && c.ike === "2") L.push(i(24) + "<eap_method>2</eap_method>");
  L.push(i(24) + "<implied_SPDO>0</implied_SPDO>", i(24) + "<implied_SPDO_timeout>0</implied_SPDO_timeout>", i(24) + "<xauth_timeout>0</xauth_timeout>",
    i(24) + "<prompt_certificate>0</prompt_certificate>", i(24) + "<description />",
    i(24) + "<server>" + xmlEsc(ph(m.a.fqdn || m.a.ip, "fqdn")) + "</server>", i(24) + "<authentication_method>Preshared Key</authentication_method>",
    i(24) + "<auth_data>", i(28) + "<preshared_key>" + xmlEsc((sec && sec.psk) || "") + "</preshared_key>", i(24) + "</auth_data>",
    i(24) + "<mode>" + (c.ike === "1" ? c.mode : "main") + "</mode>", i(24) + "<dhgroup>" + c.dh1.map(x => x + ";").join("") + "</dhgroup>",
    i(24) + "<key_life>" + (String(c.life1).trim() || "86400") + "</key_life>", i(24) + "<localid />", i(24) + "<peerid />",
    i(24) + "<nat_traversal>1</nat_traversal>", i(24) + "<transport_mode>" + tm + "</transport_mode>", i(24) + "<udp_port>500</udp_port>",
    i(24) + "<tcp_port>" + xmlEsc(String(m.trans.port).trim() || "443") + "</tcp_port>",
    i(24) + "<mode_config>1</mode_config>", i(24) + "<enable_local_lan>" + (d.split === "full" && d.localLan ? 1 : 0) + "</enable_local_lan>", i(24) + "<session_resume>0</session_resume>",
    i(24) + "<childless_mode>0</childless_mode>", i(24) + "<cert_subjectcheck>0</cert_subjectcheck>", i(24) + "<failover_sslvpn_connection />",
    i(24) + "<block_outside_dns>0</block_outside_dns>", i(24) + "<nat_alive_freq>5</nat_alive_freq>", i(24) + "<dpd>1</dpd>",
    i(24) + "<dpd_retry_count>3</dpd_retry_count>", i(24) + "<dpd_retry_interval>5</dpd_retry_interval>", i(24) + "<enable_ike_fragmentation>0</enable_ike_fragmentation>");
  if (nid > 0 && c.ike === "2") L.push(i(24) + "<networkid>" + nid + "</networkid>");
  L.push(i(24) + "<sso_enabled>" + (d.auth === "saml" ? 1 : 0) + "</sso_enabled>");
  if (d.auth === "saml") L.push(i(24) + "<ike_saml_port>" + xmlEsc(ph(d.samlPort, "porta")) + "</ike_saml_port>");
  L.push(i(24) + "<use_external_browser>0</use_external_browser>",
    i(24) + "<xauth>", i(28) + "<enabled>1</enabled>", i(28) + "<prompt_username>1</prompt_username>", i(28) + "<username />",
    i(28) + "<vpn_before_logon>", i(32) + "<username_format>username</username_format>", i(28) + "</vpn_before_logon>", i(28) + "<password />", i(24) + "</xauth>",
    i(24) + "<proposals>", ...p1.map(p => i(28) + "<proposal>" + p + "</proposal>"), i(24) + "</proposals>", i(20) + "</ike_settings>",
    i(20) + "<ipsec_settings>", i(24) + "<remote_networks>", i(28) + "<network>", i(32) + "<addr>0.0.0.0</addr>", i(32) + "<mask>0.0.0.0</mask>",
    i(28) + "</network>", i(24) + "</remote_networks>", i(24) + "<ipv4_split_exclude_networks />",
    i(24) + "<dhgroup>" + (c.pfs === "enable" ? (c.dh2[0] || "") : "") + "</dhgroup>", i(24) + "<key_life_type>seconds</key_life_type>",
    i(24) + "<key_life_seconds>" + (String(c.life2).trim() || "43200") + "</key_life_seconds>", i(24) + "<key_life_Kbytes>5120</key_life_Kbytes>",
    i(24) + "<replay_detection>1</replay_detection>", i(24) + "<pfs>" + (c.pfs === "enable" ? 1 : 0) + "</pfs>", i(24) + "<use_vip>1</use_vip>",
    i(24) + "<virtualip>", i(28) + "<type>modeconfig</type>", i(28) + "<ip>0.0.0.0</ip>", i(28) + "<mask>0.0.0.0</mask>",
    i(28) + "<dnsserver>0.0.0.0</dnsserver>", i(28) + "<winserver>0.0.0.0</winserver>", i(24) + "</virtualip>",
    i(24) + "<proposals>", ...p2.map(p => i(28) + "<proposal>" + p + "</proposal>"), i(24) + "</proposals>", i(20) + "</ipsec_settings>",
    i(20) + "<keep_fqdn_resolution_consistency>0</keep_fqdn_resolution_consistency>",
    i(16) + "</connection>", i(12) + "</connections>", i(8) + "</ipsecvpn>", i(4) + "</vpn>", "</forticlient_configuration>", "");
  return L.join("\r\n");
}

/* ---------- guida ai passaggi esterni al FortiGate ---------- */
function genGuide(m, lang) {
  const it = lang !== "en", t = (a, b) => it ? a : b, d = m.dial;
  const host = ph(m.a.fqdn || m.a.ip, "fqdn"), port = ph(d.samlPort, "porta");
  const steps = [];
  const st = (title, items, code, where) => steps.push({ title, items: items.filter(Boolean), code: code || "", where: where || "" });
  if (d.auth === "ldap") {
    const srv = ph(d.ldapServer, "server-ldap");
    st(t("Account di servizio per il bind", "Bind service account"), [
      t("In Utenti e computer di Active Directory crea un utente dedicato, ad esempio svc-fortigate, con password che non scade e nessun privilegio amministrativo.", "In Active Directory Users and Computers create a dedicated user, for example svc-fortigate, with a non-expiring password and no admin rights."),
      t("Attiva Visualizza → Funzionalità avanzate, apri le proprietà dell’utente → Editor attributi e copia distinguishedName nel campo «DN dell’account di bind».", "Enable View → Advanced Features, open the user properties → Attribute Editor and copy distinguishedName into the «Bind account DN» field."),
      t("Inserisci la sua password nel campo protetto: come la PSK, non viene salvata.", "Enter its password in the protected field: like the PSK, it is never saved.")], "", "Active Directory");
    st(t("Gruppo VPN", "VPN group"), [
      t("Crea un gruppo di sicurezza, ad esempio VPN-Utenti, e aggiungi gli utenti autorizzati.", "Create a security group, for example VPN-Users, and add the authorized users."),
      t("Copia il suo distinguishedName nel campo «DN del gruppo»: il FortiGate fa entrare solo i membri di questo gruppo.", "Copy its distinguishedName into the «Group DN» field: the FortiGate admits only members of this group."),
      d.ldapNested ? t("La ricerca ricorsiva è attiva: valgono anche gli utenti di gruppi annidati.", "Recursive search is on: users in nested groups count too.") : t("Se gli utenti stanno in gruppi annidati dentro il gruppo VPN, attiva la ricerca ricorsiva.", "If users are in groups nested inside the VPN group, turn on recursive search.")], "", "Active Directory");
    st(t("Collegamento LDAP sul FortiGate", "LDAP connection on the FortiGate"), [
      t("Common Name Identifier sAMAccountName fa accedere con il nome breve (mario.rossi); userPrincipalName con l’indirizzo completo.", "Common Name Identifier sAMAccountName signs in with the short name (mario.rossi); userPrincipalName with the full address."),
      d.ldapCreate ? t("Il blocco config user ldap è già nella configurazione del FortiGate.", "The config user ldap block is already in the FortiGate configuration.") : t("Il server LDAP deve già esistere sul FortiGate con il nome indicato.", "The LDAP server must already exist on the FortiGate with the given name."),
      d.ldapSecure === "ldaps" ? t("Con LDAPS importa sul FortiGate il certificato della CA che ha emesso quello del domain controller.", "With LDAPS import on the FortiGate the CA certificate that issued the domain controller one.") : ""], "", "FortiGate");
    st(t("Prova delle credenziali", "Credential test"), [
      t("Deve rispondere succeeded e mostrare il gruppo VPN tra le Group membership(s).", "It must answer succeeded and list the VPN group under Group membership(s).")],
      "diagnose test authserver ldap " + srv + " " + phL("utente") + " <password>", "FortiGate CLI");
    st(t("Client", "Client"), [
      t("Il file FortiClient usa già EAP-TTLS (eap_method 2): con LDAP serve FortiClient 7.4.3 o successivo.", "The FortiClient file already uses EAP-TTLS (eap_method 2): LDAP needs FortiClient 7.4.3 or later."),
      t("Se il login fallisce, guarda il debug di fnbamd: indica se l’errore è nel bind, nella ricerca dell’utente o nel gruppo.", "If sign-in fails, check the fnbamd debug: it shows whether the error is in the bind, the user search or the group.")],
      "diagnose debug application fnbamd -1\ndiagnose debug enable", "FortiGate CLI");
  } else if (d.auth === "radius") {
    const srv = ph(d.radiusServer, "server-radius");
    st(t("Client RADIUS su NPS", "RADIUS client on NPS"), [
      t("In NPS → Client e server RADIUS → Client RADIUS crea un nuovo client con l’IP con cui il FortiGate raggiunge il server.", "In NPS → RADIUS Clients and Servers → RADIUS Clients create a new client with the IP the FortiGate uses to reach the server."),
      t("Usa lo stesso segreto condiviso inserito qui.", "Use the same shared secret entered here.")], "", "NPS");
    st(t("Criterio di rete", "Network policy"), [
      t("In Criteri → Criteri di rete crea un criterio con condizione Gruppi di Windows = il gruppo VPN.", "In Policies → Network Policies create a policy with condition Windows Groups = the VPN group."),
      t("In Vincoli → Metodi di autenticazione aggiungi «Microsoft: Password protetta (EAP-MSCHAP v2)»: FortiClient usa EAP-MSCHAPv2 con IKEv2.", "In Constraints → Authentication Methods add «Microsoft: Secured password (EAP-MSCHAP v2)»: FortiClient uses EAP-MSCHAPv2 with IKEv2."),
      t("NPS applica il primo criterio che corrisponde, dall’alto: mettilo sopra eventuali criteri di rifiuto.", "NPS applies the first matching policy from the top: place it above any deny policies.")], "", "NPS");
    st(t("Prova delle credenziali", "Credential test"), [
      t("Usa la CLI: il pulsante Test della GUI prova con PAP e può fallire anche se la VPN funziona.", "Use the CLI: the GUI Test button tries PAP and may fail even when the VPN works."),
      t("Evita lettere accentate nelle password: NPS non le codifica in UTF-8 e il login fallisce.", "Avoid accented letters in passwords: NPS does not encode them in UTF-8 and sign-in fails.")],
      "diagnose test authserver radius " + srv + " mschap2 " + phL("utente") + " <password>", "FortiGate CLI");
    st(t("MFA sul server RADIUS", "MFA on the RADIUS server"), [
      t("Se NPS o il server RADIUS chiedono un secondo fattore, alza il timeout del server, il tempo per l’MFA (remoteauthtimeout) e negotiate-timeout della phase1.", "If NPS or the RADIUS server asks for a second factor, raise the server timeout, the MFA time (remoteauthtimeout) and the phase1 negotiate-timeout.")], "", "FortiGate");
  } else if (d.auth === "saml") {
    const base = "https://" + host + ":" + port + "/remote/saml/";
    st(t("Gruppo in Entra ID", "Group in Entra ID"), [
      t("Entra admin center → Gruppi → Nuovo gruppo: tipo Sicurezza, appartenenza Assegnata; aggiungi gli utenti VPN.", "Entra admin center → Groups → New group: type Security, membership Assigned; add the VPN users."),
      t("Copia l’ID oggetto del gruppo nel campo «ID del gruppo Entra».", "Copy the group Object ID into the «Entra group ID» field.")], "", "Entra ID");
    st(t("Applicazione aziendale", "Enterprise application"), [
      t("Applicazioni aziendali → Nuova applicazione → cerca «FortiGate SSL VPN» nella galleria, rinominala e creala: funziona anche per IPsec.", "Enterprise applications → New application → search «FortiGate SSL VPN» in the gallery, rename it and create it: it works for IPsec too."),
      t("Proprietà → Assegnazione obbligatoria: No, e gestisci l’accesso solo dal gruppo. In alternativa assegna gli utenti uno per uno: con Entra ID Free non si possono assegnare gruppi all’app.", "Properties → Assignment required: No, and manage access from the group only. Otherwise assign users one by one: Entra ID Free cannot assign groups to the app.")], "", "Entra ID");
    st(t("Configurazione SAML di base", "Basic SAML configuration"), [
      t("Single Sign-On → SAML → Configurazione SAML di base. Stato inoltro: vuoto.", "Single Sign-On → SAML → Basic SAML Configuration. Relay state: empty.")],
      t("Identificatore (ID entità): ", "Identifier (Entity ID): ") + base + "metadata\n" + t("URL di risposta: ", "Reply URL: ") + base + "login\n" + t("URL di accesso: ", "Sign on URL: ") + base + "login\n" + t("URL di disconnessione: ", "Logout URL: ") + base + "logout", "Entra ID");
    st(t("Attributi e attestazioni", "Attributes and claims"), [
      t("Aggiungi un’attestazione username, spazio dei nomi vuoto, attributo di origine user.userprincipalname. Il nome è sensibile alle maiuscole.", "Add a username claim, empty namespace, source attribute user.userprincipalname. The name is case-sensitive."),
      t("L’attestazione di gruppo esiste già (l’app ne ammette una sola): modificala con Gruppi di sicurezza, attributo di origine ID gruppo, e in Opzioni avanzate personalizza il nome in group con spazio dei nomi vuoto.", "The group claim already exists (the app allows only one): edit it with Security groups, source attribute Group ID, and in Advanced options customize the name to group with an empty namespace.")], "", "Entra ID");
    st(t("Certificato e URL di Entra", "Entra certificate and URLs"), [
      t("Riquadro Certificati SAML: scarica Certificato (Base64). Sul FortiGate: System → Certificates → Create/Import → Remote Certificate; il nome assegnato (REMOTE_Cert_N) va nel campo «Certificato IdP».", "SAML Certificates pane: download Certificate (Base64). On the FortiGate: System → Certificates → Create/Import → Remote Certificate; the assigned name (REMOTE_Cert_N) goes in the «IdP certificate» field."),
      t("Confronta gli URL del riquadro di configurazione con quelli generati dal tenant ID; l’identificatore termina con la barra.", "Compare the URLs in the setup pane with those generated from the tenant ID; the identifier ends with a slash."),
      t("Annota la scadenza del certificato di firma (di solito tre anni): quando scade va reimportato e aggiornato idp-cert.", "Note the signing certificate expiry (usually three years): when it expires, re-import it and update idp-cert.")],
      "idp-entity-id          https://sts.windows.net/" + ph(d.tenant, "id-tenant") + "/\nidp-single-sign-on-url https://login.microsoftonline.com/" + ph(d.tenant, "id-tenant") + "/saml2", "Entra ID → FortiGate");
    st(t("Certificato del FortiGate per FortiClient", "FortiGate certificate for FortiClient"), [
      t("FortiClient verifica il certificato presentato sulla porta SAML: il CN deve essere " + host + ". Per il primo test va bene Fortinet_Factory accettando l’avviso.", "FortiClient checks the certificate presented on the SAML port: its CN must be " + host + ". For the first test Fortinet_Factory is fine if you accept the warning."),
      t("Certificato definitivo: Let’s Encrypt da System → Certificates (challenge TLS-ALPN-01 su TCP 443, che non deve essere usata da VIP o altri servizi) oppure la CA interna distribuita ai PC.", "Final certificate: Let’s Encrypt from System → Certificates (TLS-ALPN-01 challenge on TCP 443, which must not be used by a VIP or other services) or the internal CA deployed to PCs."),
      t("Va impostato in config user saml (cert) e in auth-cert, che è globale: prima controlla chi altro lo usa.", "Set it in config user saml (cert) and in auth-cert, which is global: check first who else uses it.")],
      "show full-configuration user setting | grep auth-cert", "FortiGate");
    st(t("Porta SAML", "SAML port"), [
      t("La porta " + port + " non deve coincidere con l’HTTPS di amministrazione né con l’SSL-VPN.", "Port " + port + " must not match the HTTPS admin port or the SSL-VPN."),
      t("Verificala dall’esterno, non dalla LAN: l’ascolto è attivo solo sull’interfaccia con ike-saml-server. Un diagnose sys tcpsock vuoto su quella porta è normale.", "Check it from outside, not from the LAN: listening is active only on the interface with ike-saml-server. An empty diagnose sys tcpsock on that port is normal."),
      t("In config user setting non deve esserci auth-keepalive enable.", "config user setting must not contain auth-keepalive enable.")],
      "show system global | grep port\nTest-NetConnection " + host + " -Port " + port, "FortiGate / PowerShell");
    st(t("Test", "Test"), [
      t("Con FortiOS 7.4 la porta SAML, ike-saml-server e authusrgrp in phase1 si impostano solo da CLI: sono già nella configurazione generata.", "On FortiOS 7.4 the SAML port, ike-saml-server and phase1 authusrgrp are CLI-only: they are already in the generated configuration."),
      t("Nel debug cerca la risposta Success di Entra, l’ID del gruppo nel claim group e EAP succeeded.", "In the debug look for Entra’s Success response, the group ID in the group claim and EAP succeeded.")],
      "diagnose debug application samld -1\ndiagnose debug application ike -1\ndiagnose debug enable", "FortiGate CLI");
  }
  return steps;
}
function guideText(steps, m, lang) {
  const L = ["# " + (m.name || "Fortissimo"), ""];
  steps.forEach((s, i) => {
    L.push("## " + (i + 1) + ". " + s.title + (s.where ? "  [" + s.where + "]" : ""), "");
    s.items.forEach(x => L.push("- " + x));
    if (s.code) L.push("", ...s.code.split("\n").map(x => "    " + x));
    L.push("");
  });
  return L.join("\n");
}

/* ---------- diagnostica ---------- */
function genDiag(m, side, lang) {
  const it = lang !== "en", S = m[side], O = m[side === "a" ? "b" : "a"], sc = m.scenario, dial = DIAL(sc);
  const tunnels = tunnelsFor(m, side), T = tunnels[0].name;
  const peerIp = dial ? (it ? "<IP pubblico del client>" : "<client public IP>")
               : (sc === "s2sdyn" && side === "a") ? (it ? "<IP pubblico della filiale>" : "<branch public IP>")
               : ph(sc === "s2sdyn" ? m.a.ip : O.ip, it ? "IP-del-peer" : "peer-IP");
  const nid = parseInt(m.ident.networkId, 10) || 0;
  const L = [], h = s => L.push("# " + s);
  h(it ? "1. Stato del tunnel" : "1. Tunnel status");
  L.push("get vpn ipsec tunnel summary");
  tunnels.forEach(t => L.push("diagnose vpn ike gateway list name " + t.name, "diagnose vpn tunnel list name " + t.name));
  L.push("");
  if (!dial) {
    h(it ? "2. Rotte verso le reti remote" : "2. Routes to remote networks");
    L.push("get router info routing-table all");
    if (m.bgp.on && !advOn(m)) L.push("get router info bgp summary", "get router info routing-table bgp");
    L.push("");
  }
  h(it ? "3. Debug della negoziazione (ripeti la connessione mentre è attivo)" : "3. Negotiation debug (retry the connection while it runs)");
  L.push("diagnose debug reset", "diagnose vpn ike log filter clear", "diagnose vpn ike log filter rem-addr4 " + peerIp,
    "diagnose debug console timestamp enable", "diagnose debug application ike -1");
  if (dial) L.push("diagnose debug application " + (sc === "dialup" && m.dial.auth === "saml" ? "samld" : "fnbamd") + " -1");
  L.push("diagnose debug enable", "", "# " + (it ? "al termine:" : "when done:"), "diagnose debug disable", "diagnose debug reset", "");
  h(it ? "Cosa cercare nell’output del debug" : "What to look for in the debug output");
  if (sc === "dialup" || (sc === "s2sdyn" && side === "a")) {
    if (m.crypto.ike === "2") L.push("#   NETWORK ID : " + nid);
    L.push("#   matched gateway " + T + "   (" + (it ? "se compare un altro nome, il tunnel scelto è sbagliato" : "if another name appears, the wrong tunnel was chosen") + ")");
  }
  L.push("#   " + (it ? "no SA proposal chosen = proposte o gruppi DH diversi tra i lati" : "no SA proposal chosen = proposals or DH groups differ between sides"));
  if (dial) L.push("#   EAP succeeded / EAP failed = " + (it ? "esito dell’autenticazione utente" : "user authentication result"));
  else L.push("#   " + (it ? "authentication failed / AUTHENTICATION_FAILED = PSK o certificati non corrispondenti" : "authentication failed / AUTHENTICATION_FAILED = PSK or certificates do not match"));
  L.push("#   " + (it ? "established IKE SA / added IPsec SA = tunnel su" : "established IKE SA / added IPsec SA = tunnel up"));
  if (!dial && m.bgp.on && !advOn(m)) L.push("#   " + (it ? "bgp summary: State/PfxRcd con un numero = sessione BGP stabilita" : "bgp summary: a number in State/PfxRcd = BGP session established"));
  return L.join("\n");
}

/* ---------- riepilogo ---------- */
function genMsSummary(m, lang) {
  const it = lang !== "en", t = (a, b) => it ? a : b, g = m.bgpAdv, c = m.crypto, sites = msSites(m), hub = msHub(m);
  const L = ["# " + (m.name || "Fortissimo"), "", "- " + t("Scenario: rete multi-sede (BGP)", "Scenario: multi-site network (BGP)"), "- FortiOS: " + m.fos];
  const all = (g.links || []).map((l0, i) => ({ l0, i, l: bgpLinkRes(m, l0) })).filter(x => x.l.gen && !x.l.bothDyn);
  const links = all.filter(x => x.l.agg !== "pair"), aggs = all.filter(x => x.l.agg === "pair"), agg = aggOn(m);
  const tyL = w => ({ inet: "internet", sat: "satellite", lte: "LTE", mpls: t("privata", "private") }[w.type] || w.type) + (w.type === "mpls" && w.seg ? " " + w.seg : "");
  const topo = g.topo === "hub" ? t("hub e spoke, hub ", "hub and spoke, hub ") + (hub ? nodeName(m, hub) : "—") + (g.hubMode === "dial" ? t(", un tunnel dial-up sull’hub", ", one dial-up tunnel on the hub") : t(", un tunnel per spoke", ", one tunnel per spoke"))
    : g.topo === "mesh" ? t("full mesh", "full mesh") : t("personalizzata", "custom");
  L.push("- " + t("Topologia", "Topology") + ": " + topo, "- " + t("Sedi", "Sites") + ": " + sites.length + ", tunnel: " + links.length + (agg ? t(", aggregati IPsec: ", ", IPsec aggregates: ") + aggs.length : ""));
  const ases = [...new Set(sites.map(n => String(n.as)))];
  L.push("- BGP: " + (ases.length === 1 ? "iBGP, AS " + ases[0] + (hub && hub.rr ? t(", route reflector sull’hub", ", route reflector on the hub") : "") : t("eBGP, un AS per sede", "eBGP, one AS per site")) + (advpnOn(m) ? t(", scorciatoie ADVPN", ", ADVPN shortcuts") : ""));
  if (msPlan(m)) L.push("- " + t("Indirizzi dei tunnel: per sede, rete ", "Tunnel addresses: per site, network ") + g.pool + t(" (una /24 per sede, router ID nella /24 zero)", " (one /24 per site, router IDs in /24 zero)"));
  L.push("- Blackhole: " + (m.route.bh ? t("sì, distanza ", "yes, distance ") + (m.route.bhDistance || "254") : t("no", "no")), "");
  L.push("## " + t("Sedi", "Sites"), "");
  sites.forEach(n => {
    const tun = bgpSessions(m, n.id, true).filter(s => s.l.gen && !s.l.bothDyn && s.l.agg !== "pair").map(s => s.dynHub ? s.l.aIf : s.l[s.me + "If"]);
    const ags = bgpSessions(m, n.id).filter(s => s.l.agg === "pair").map(s => s.l[s.me + "If"]);
    L.push("### " + nodeName(m, n) + (n === hub ? " (hub)" : ""), "",
      "- AS " + (n.as || "—") + ", router-id " + (n.rid || "—") + (n.rr ? ", route reflector" : "") + (g.names === "code" && g.topo !== "custom" ? t(", codice ", ", code ") + siteCode(m, n) : ""),
      ...siteWans(m, n).map(w => "- " + (sdwanOn(m) ? t("Linea ", "Line ") + w.slot + (g.names === "code" ? " (" + lineCode(m, n, w) + ")" : "") + " " : "WAN ") + (w.if || "—") + ": " + (w.dyn ? t("IP dinamico", "dynamic IP") : (w.addr || "—")) + (sdwanOn(m) ? ", " + (agg || w.type !== "mpls" || w.seg ? tyL(w) : "MPLS") + t(", costo ", ", cost ") + (w.cost || "0") : "")),
      "- " + t("Reti", "Networks") + ": " + (parseNets(n.nets).out.map(x => x.net + "/" + x.p).join(", ") || "—"),
      "- Tunnel: " + ([...new Set(tun)].join(", ") || "—"), ...(ags.length ? [t("- Aggregati: ", "- Aggregates: ") + ags.join(", ")] : []), "");
  });
  L.push("## " + t("Tunnel IPsec", "IPsec tunnels"), "");
  links.forEach(({ l }) => {
    const A = bgpNode(m, l.a), B = bgpNode(m, l.b);
    const wl = (N, slot) => sdwanOn(m) ? " (" + (wanOf(m, N, slot).if || slot) + ")" : "";
    if (l.agg === "mem") { const p = aggs.find(x => (x.l.a === l.a && x.l.b === l.b) || (x.l.a === l.b && x.l.b === l.a));
      L.push("- " + nodeName(m, A) + wl(A, l.aw) + " ⇄ " + nodeName(m, B) + wl(B, l.bw) + ": " + (l.aIf || "—") + " ⇄ " + (l.bIf || "—") + t(", membro di ", ", member of ") + (p ? (p.l.a === l.a ? p.l.aIf : p.l.bIf) : "—") + (l.cOwn ? t(", crittografia dedicata", ", own cryptography") : "")); return; }
    L.push("- " + nodeName(m, A) + wl(A, l.aw) + " ⇄ " + nodeName(m, B) + wl(B, l.bw) + ": " + (l.dyn ? "dial-up " + l.aIf + " " + (l.aIp || "—") + " ⇄ " + (l.bIf || "—") + " " + (l.bIp || "—")
      : (l.aIf || "—") + " " + (l.aIp || "—") + " ⇄ " + (l.bIf || "—") + " " + (l.bIp || "—")) + ", " + (String(A.as) === String(B.as) ? "iBGP" : "eBGP") + (l.cOwn ? t(", crittografia dedicata", ", own cryptography") : ""));
  });
  if (aggs.length) {
    L.push("", "## " + t("Aggregati IPsec", "IPsec aggregates"), "");
    aggs.forEach(({ l }) => { const A = bgpNode(m, l.a), B = bgpNode(m, l.b), k = links.filter(x => x.l.agg === "mem" && ((x.l.a === l.a && x.l.b === l.b) || (x.l.a === l.b && x.l.b === l.a))).length;
      L.push("- " + nodeName(m, A) + " ⇄ " + nodeName(m, B) + ": " + (l.aIf || "—") + " " + (l.aIp || "—") + " ⇄ " + (l.bIf || "—") + " " + (l.bIp || "—") + ", " + k + t(" tunnel membri", " member tunnels") + ", " + (String(A.as) === String(B.as) ? "iBGP" : "eBGP")); });
  }
  L.push("", "## " + t("Crittografia (tutti i tunnel)", "Cryptography (all tunnels)"), "",
    "- IKEv" + c.ike + (c.ike === "1" ? " (" + c.mode + ")" : "") + ", PSK " + t("unica", "shared"),
    "- Phase1: " + (c.p1.join(", ") || "—") + "; DH " + (c.dh1.join(", ") || "—") + "; " + t("durata", "lifetime") + " " + (c.life1 || "—") + " s",
    "- Phase2: " + (c.p2.join(", ") || "—") + "; PFS " + (c.pfs === "enable" ? "DH " + (c.dh2.join(", ") || "—") : t("disattivo", "off")) + "; " + t("durata", "lifetime") + " " + (c.life2 || "—") + " s; " + t("selettori", "selectors") + " 0.0.0.0/0", "");
  const sw = sdwanOn(m) ? g.sdwan : null;
  if (sw && agg) {
    L.push("## " + t("Raggruppamento: aggregato IPsec", "Grouping: IPsec aggregate"), "", "- " + t("Un aggregato per coppia di sedi, algoritmo ", "One aggregate per site pair, algorithm ") + (sw.alg || "L4") + t("; membri in ordine di costo", "; members in cost order"),
      "- " + t("Zona ", "Zone ") + (sw.zone || "VPN") + t(" con tutti gli aggregati della sede, intrazone allow", " with every aggregate of the site, intrazone allow"),
      "- " + t("BGP: una sessione per aggregato, sull’IP dell’aggregato", "BGP: one session per aggregate, on the aggregate IP") + (hub && g.bgpType === "ibgp" ? t(", next-hop-self-rr sull’hub", ", next-hop-self-rr on the hub") : ""),
      "- DPD: on-idle" + (String(g.dpdInt || "").trim() ? ", " + t("intervallo ", "interval ") + g.dpdInt + " s" : t(", intervallo predefinito", ", default interval")));
    const ex = (g.pairEx || []).length; if (ex) L.push("- " + t("Coppie di linee escluse a mano: ", "Line pairs excluded by hand: ") + ex);
    L.push("");
  } else if (sw) {
    L.push("## SD-WAN", "", "- " + t("Zona ", "Zone ") + (sw.zone || "VPN") + t(" con tutti i tunnel di ogni sede; membri e regole dal numero ", " with every tunnel of each site; members and rules from number ") + (sw.base || "100"),
      "- Health-check: ping " + t("verso la loopback ", "to the loopback ") + (hub ? t("dell’hub ", "of the hub ") + nodeName(m, hub) + " (" + (hub.loIp || "—") + ")" : t("di ogni sede", "of each site")) +
        "; SLA " + t("latenza ", "latency ") + sw.lat + " ms, jitter " + sw.jit + " ms, " + t("perdita ", "loss ") + sw.loss + "%",
      "- " + t("Regole: il tunnel più economico tra quelli entro SLA (mode sla); se nessuno rispetta lo SLA vale l’ordine dei membri per costo", "Rules: the cheapest tunnel among those within SLA (mode sla); if none meets the SLA the members’ cost order applies"),
      "- " + t("BGP: una sessione per tunnel, multipath attivo", "BGP: one session per tunnel, multipath on") + (hub && g.bgpType === "ibgp" ? t(", next-hop-self-rr sull’hub", ", next-hop-self-rr on the hub") : ""));
    const ex = (g.pairEx || []).length; if (ex) L.push("- " + t("Coppie di linee escluse a mano: ", "Line pairs excluded by hand: ") + ex);
    L.push("");
  }
  if (sw && sw.pol && agg) {
    L.push("## " + t("Firewall policy generate", "Generated firewall policies"), "", t("Sono nelle schede delle sedi, sulla zona ", "They are in the site tabs, on zone ") + (sw.zone || "VPN") + t(", con servizio ALL: restringi i servizi a quelli che servono davvero. Il transito tra aggregati passa con intrazone allow.", ", with service ALL: narrow the services to those you actually need. Transit between aggregates passes through intrazone allow."), "");
    sites.forEach(n => L.push("- " + nodeName(m, n) + ": LAN_to_" + (sw.zone || "VPN") + ", " + (sw.zone || "VPN") + "_to_LAN" + t(" · interfaccia LAN ", " · LAN interface ") + (n.lanIf || "—")));
  } else if (sw && sw.pol) {
    L.push("## " + t("Firewall policy generate", "Generated firewall policies"), "", t("Sono nelle schede delle sedi, sulla zona ", "They are in the site tabs, on zone ") + (sw.zone || "VPN") + t(", con servizio ALL: restringi i servizi a quelli che servono davvero.", ", with service ALL: narrow the services to those you actually need."), "");
    sites.forEach(n => L.push("- " + nodeName(m, n) + ": LAN_to_" + (sw.zone || "VPN") + ", " + (sw.zone || "VPN") + "_to_LAN" +
      ((n === hub || (g.topo === "mesh" && g.bgpType === "ebgp")) ? ", " + (sw.zone || "VPN") + "_to_" + (sw.zone || "VPN") : "") + ((g.topo === "mesh" || n === hub) ? ", " + (sw.zone || "VPN") + "_HC (ping " + t("verso la loopback", "to the loopback") + ")" : "") +
      t(" · interfaccia LAN ", " · LAN interface ") + (n.lanIf || "—")));
  } else {
  L.push("## " + t("Firewall policy da creare", "Firewall policies to create"), "",
    t("Fortissimo non le genera: crea su ogni FortiGate le policy qui sotto, con i servizi che servono davvero (ALL solo per le prove). «LAN» è l’interfaccia interna della sede.", "Fortissimo does not generate them: create the policies below on each FortiGate, with the services you actually need (ALL only for testing). «LAN» is the site’s internal interface."), "");
  sites.forEach(n => {
    const tun = agg ? [sw.zone || "VPN"] : [...new Set(bgpSessions(m, n.id).filter(s => s.l.gen && !s.l.bothDyn).map(s => s.dynHub ? s.l.aIf : s.l[s.me + "If"]).filter(Boolean))];
    if (!tun.length) return;
    const lan = parseNets(n.nets).out.map(x => x.net + "/" + x.p).join(", ") || "—";
    const others = sites.filter(x => x !== n).flatMap(x => parseNets(x.nets).out.map(y => y.net + "/" + y.p)).join(", ") || "—";
    L.push("- " + nodeName(m, n) + ":",
      "  - LAN → " + tun.join(", ") + t(": da ", ": from ") + lan + t(" verso ", " to ") + others,
      "  - " + tun.join(", ") + " → LAN" + t(": da ", ": from ") + others + t(" verso ", " to ") + lan);
    if (n === hub) L.push("  - " + tun.join(", ") + " → " + tun.join(", ") + t(": traffico tra filiali attraverso l’hub (con più tunnel conviene raggrupparli in una zona)", ": traffic between branches through the hub (with several tunnels group them in a zone)"));
  });
  }
  if (!(sw && sw.pol) && g.topo === "mesh" && ases.length > 1) L.push("", t("In full mesh eBGP, se un tunnel cade il traffico può passare da una terza sede: per permetterlo, su ogni sede aggiungi una policy tra i suoi tunnel.", "In an eBGP full mesh, when a tunnel drops traffic can go through a third site: to allow it, add a policy between the tunnels on each site."));
  L.push("", "## " + t("Ordine di applicazione", "Order of application"), "",
    "1. " + (hub ? t("Prima l’hub ", "The hub first ") + nodeName(m, hub) + t(", poi le filiali.", ", then the branches.") : t("Una sede alla volta: ogni tunnel sale quando entrambe le sedi sono configurate.", "One site at a time: each tunnel comes up once both sites are configured.")),
    "2. " + (sw && sw.pol ? t("Controlla le firewall policy generate e restringi i servizi. Il BGP verso il FortiGate stesso non ha bisogno di policy.", "Check the generated firewall policies and narrow the services. BGP to the FortiGate itself needs no policy.") : t("Crea le firewall policy: senza policy il tunnel sale ma il traffico tra le LAN viene bloccato. Il BGP verso il FortiGate stesso non ha bisogno di policy.", "Create the firewall policies: without them the tunnel comes up but LAN traffic is blocked. BGP to the FortiGate itself needs no policy.")),
    "3. " + t("Controlla con i comandi della scheda Diagnostica.", "Check with the commands in the Diagnostics tab."));
  const used = new Set();
  (g.links || []).forEach(l => ["a", "b"].forEach(s => ["RmIn", "RmOut", "PlIn", "PlOut"].forEach(k => { const v = String(l[s + k] || "").trim(); if (v) used.add(v); })));
  if (used.size) L.push("", "## " + t("Filtri", "Filters"), "", "- " + [...used].join(", "));
  return L.join("\n") + "\n";
}
function genSummary(m, lang) {
  if (m.scenario === "ms") return genMsSummary(m, lang);
  const it = lang !== "en", c = m.crypto, sc = m.scenario, dial = DIAL(sc);
  const t = (a, b) => it ? a : b;
  const U = UI[it ? "it" : "en"];
  const L = ["# " + (m.name || "Fortissimo"), "", "- " + t("Scenario", "Scenario") + ": " + U["sc_" + sc], "- FortiOS: " + m.fos, ""];
  const sideTxt = (s, title) => {
    const S = m[s], nets = parseNets(S.nets).out.map(n => n.net + "/" + n.p).join(", ") || "—";
    L.push("## " + title + (S.label ? " – " + S.label : ""), "",
      "- " + t("Tunnel", "Tunnel") + ": " + tunnelsFor(m, s).map(x => x.name + " (" + (x.wan || "—") + ")").join(", "));
    if (!(sc === "s2sdyn" && s === "b")) L.push("- " + t("Indirizzo pubblico", "Public address") + ": " + (S.ip || S.fqdn || "—") + (sc === "s2s" && m.dual.on && s === "a" ? ", " + (m.dual.aIp || m.dual.aFqdn || "—") : "") + (sc === "s2s" && m.dual.on && s === "b" && (m.dual.bIp || m.dual.bFqdn) ? ", " + (m.dual.bIp || m.dual.bFqdn) : ""));
    L.push("- " + t("Reti", "Networks") + ": " + nets);
    if (S.tip) L.push("- " + t("IP del tunnel", "Tunnel IP") + ": " + S.tip);
    L.push("");
  };
  sideTxt("a", U["sideA_" + sc]);
  if (!dial) sideTxt("b", U["sideB_" + sc]);
  L.push("## " + t("Crittografia", "Cryptography"), "",
    "- IKEv" + c.ike + (c.ike === "1" ? " (" + c.mode + ")" : ""),
    "- Phase1: " + (c.p1.join(", ") || "—") + "; DH " + (c.dh1.join(", ") || "—") + "; " + t("durata", "lifetime") + " " + (c.life1 || "—") + " s",
    "- Phase2: " + (c.p2.join(", ") || "—") + "; PFS " + (c.pfs === "enable" ? "DH " + (c.dh2.join(", ") || "—") : t("disattivo", "off")) + "; " + t("durata", "lifetime") + " " + (c.life2 || "—") + " s", "");
  L.push("## " + t("Autenticazione", "Authentication"), "");
  if (dial) {
    L.push("- " + t("Utenti", "Users") + ": " + U["dial_" + m.dial.auth] + ", " + t("gruppo", "group") + " " + (m.dial.group || "—"),
      "- " + t("Autenticazione del FortiGate", "FortiGate authentication") + ": PSK",
      "- Pool: " + (m.dial.poolStart || "—") + " – " + (m.dial.poolEnd || "—"),
      "- DNS: " + ([m.dial.dns1, m.dial.dns2].filter(Boolean).join(", ") || "—"),
      "- " + (m.dial.split === "split" ? t("Split tunnel verso le reti interne", "Split tunnel to internal networks") : t("Tunnel completo", "Full tunnel")));
    if (sc === "dialup" && parseInt(m.ident.networkId, 10) > 0) L.push("- Network ID: " + m.ident.networkId + " " + t("(impostato anche nel file FortiClient)", "(also set in the FortiClient file)"));
    if (sc === "dialup" && m.trans.mode !== "udp") L.push("- " + t("Trasporto IKE", "IKE transport") + ": " + m.trans.mode.toUpperCase() + ", " + t("porta", "port") + " " + (m.trans.port || "—"));
  } else {
    L.push("- " + (m.auth.method === "cert" ? t("Certificati", "Certificates") : "PSK"));
    if (sc === "s2sdyn") L.push("- " + t("Peer accettati dall’hub", "Peers accepted by the hub") + ": " + (m.ident.peerMode === "one" ? (m.ident.localid || "—") : t("qualsiasi", "any")));
  }
  L.push("", "## Routing", "");
  if (dial) L.push("- " + t("Rotte verso i client aggiunte automaticamente dal FortiGate", "Routes to clients added automatically by the FortiGate"));
  else if (advOn(m)) {
    L.push("- " + t("BGP avanzato: vedi la sezione sotto", "Advanced BGP: see the section below"), "- Blackhole: " + (m.route.bh ? t("sì", "yes") : t("no", "no")));
  } else if (m.bgp.on) {
    L.push("- BGP: AS " + (m.bgp.asA || "—") + " ⇄ AS " + (m.bgp.asB || "—") + " (" + (String(m.bgp.asA) === String(m.bgp.asB) ? "iBGP" : "eBGP") + ")");
    if (sc === "s2sdyn") L.push("- " + t("Rete overlay", "Overlay network") + ": " + (m.bgp.overlay || "—"));
    L.push("- Blackhole: " + (m.route.bh ? t("sì", "yes") : t("no", "no")));
  } else {
    L.push("- " + t("Rotte statiche verso le reti remote", "Static routes to the remote networks") + ": " + (m.route.on ? t("sì", "yes") : t("no", "no")) + (sc === "s2sdyn" ? t(" (l’hub le impara dai selettori della filiale)", " (the hub learns them from the branch selectors)") : ""));
    if (sc === "s2s" && m.dual.on) L.push("- " + t("Doppia WAN", "Dual WAN") + ": " + (m.dual.mode === "ecmp" ? t("entrambi i tunnel attivi (ECMP)", "both tunnels active (ECMP)") : m.dual.mode === "standby" ? t("secondo tunnel in standby (monitor)", "second tunnel on standby (monitor)") : t("secondo tunnel di riserva, distanza ", "second tunnel as backup, distance ") + (m.dual.backupDist || "—")));
    L.push("- Blackhole: " + (m.route.bh ? t("sì", "yes") + ", " + t("distanza", "distance") + " " + (m.route.bhDistance || "254") : t("no", "no")));
  }
  if ((sc === "s2s" || sc === "s2sdyn") && m.fec.on) L.push("- FEC: " + t("attivo", "on") + " (base " + (m.fec.base || "20") + ", " + t("ridondanti", "redundant") + " " + (m.fec.redundant || "10") + ")");
  if ((sc === "dialup" || sc === "s2sdyn") && m.gwm.mode !== "any") L.push("- " + t("Origine ammessa", "Allowed source") + ": " + ({ ipmask: m.gwm.subnet, iprange: m.gwm.start + " – " + m.gwm.end, geography: String(m.gwm.country).toUpperCase() }[m.gwm.mode] || "—"));
  if (advOn(m)) L.push("", genBgpSummary(m, lang));
  L.push("", t("Le firewall policy non sono incluse in questa configurazione.", "Firewall policies are not included in this configuration."), "");
  return L.join("\n");
}

/* ---------- verifiche ---------- */
function runChecks(m, sec, lang) {
  const it = lang !== "en", t = (a, b) => it ? a : b;
  const R = [], add = (lvl, msg, p) => R.push(Array.isArray(p) ? { lvl, msg, p: p[0], ps: [...new Set(p.filter(Boolean))] } : { lvl, msg, p });
  const sc = m.scenario, c = m.crypto;
  const sides = sc === "ms" ? [] : DIAL(sc) ? ["a"] : ["a", "b"];
  const sideName = s => UI[it ? "it" : "en"][(s === "a" ? "sideA_" : "sideB_") + sc];

  sides.forEach(s => {
    const S = m[s];
    if (!String(S.tunnel).trim()) add("err", t("Manca il nome del tunnel", "Tunnel name is missing") + " (" + sideName(s) + ").", s + ".tunnel");
    else if (S.tunnel.length > 15) add("err", t("Il nome del tunnel ha ", "The tunnel name has ") + S.tunnel.length + t(" caratteri: FortiOS ne accetta al massimo 15", " characters: FortiOS accepts 15 at most") + " (" + sideName(s) + ").", s + ".tunnel");
    if (/[\s"]/.test(S.tunnel)) add("err", t("Il nome del tunnel non può contenere spazi o virgolette", "The tunnel name cannot contain spaces or quotes") + " (" + sideName(s) + ").", s + ".tunnel");
    if (!String(S.wan).trim()) add("err", t("Manca l’interfaccia WAN", "WAN interface is missing") + " (" + sideName(s) + ").", s + ".wan");
    if (S.ip && !isIp(S.ip)) add("err", t("Indirizzo non valido: ", "Invalid address: ") + S.ip, s + ".ip");
    const pn = parseNets(S.nets);
    pn.bad.forEach(x => add("err", t("Rete non valida: ", "Invalid network: ") + x + t(". Usa il formato CIDR, ad esempio 192.168.1.0/24.", ". Use CIDR format, for example 192.168.1.0/24."), s + ".nets"));
    pn.out.filter(n => !n.aligned).forEach(n => add("warn", n.raw + t(" non è un indirizzo di rete: uso ", " is not a network address: using ") + n.net + "/" + n.p + ".", s + ".nets"));
    if (!pn.out.length && !pn.bad.length) add(DIAL(sc) && m.dial.split === "full" ? "info" : "err", t("Nessuna rete locale indicata", "No local network given") + " (" + sideName(s) + ").", s + ".nets");
  });
  if (sc === "s2s") {
    ["a", "b"].forEach(s => { if (!m[s].ip && !m[s].fqdn) add("err", t("Serve l’IP pubblico o l’FQDN di ", "Public IP or FQDN needed for ") + sideName(s) + ".", s + ".ip"); });
    if (!m.a.ip && !m.b.ip) add("warn", t("Nessuno dei due lati ha un IP fisso: con due FQDN dinamici il tunnel dipende dalla risoluzione DNS di entrambi.", "Neither side has a fixed IP: with two dynamic FQDNs the tunnel depends on DNS on both sides."), "a.ip");
  }
  if (sc === "s2sdyn" && !m.a.ip && !m.a.fqdn) add("err", t("Serve l’IP pubblico o l’FQDN dell’hub: la filiale lo usa come gateway remoto.", "The hub public IP or FQDN is needed: the branch uses it as remote gateway."), "a.ip");
  if (DIAL(sc) && !m.a.ip && !m.a.fqdn) add("err", t("Serve l’FQDN o l’IP pubblico a cui si collegano i client.", "The FQDN or public IP clients connect to is needed."), "a.fqdn");
  if (!DIAL(sc) && sc !== "ms") {
    const A = parseNets(m.a.nets).out, B = parseNets(m.b.nets).out;
    A.forEach(x => B.forEach(y => { if (overlap(x, y)) add("err", t("Le reti ", "Networks ") + x.raw + t(" e ", " and ") + y.raw + t(" si sovrappongono: i due lati devono usare reti diverse.", " overlap: the two sides must use different networks."), ["b.nets", "a.nets"]); }));
    if (sc === "s2s" && (m.a.tip || m.b.tip)) {
      ["a", "b"].forEach(s => { if (m[s].tip && !isIp(m[s].tip)) add("err", t("IP del tunnel non valido: ", "Invalid tunnel IP: ") + m[s].tip, s + ".tip"); });
      if (!(isIp(m.a.tip) && isIp(m.b.tip))) add("warn", t("Indica l’IP del tunnel su entrambi i lati, altrimenti non viene configurato.", "Set the tunnel IP on both sides, otherwise it is not configured."), "a.tip");
    }
    if (!m.route.bh) add("warn", t("Senza rotte blackhole, se il tunnel cade il traffico verso le reti remote può uscire su Internet.", "Without blackhole routes, traffic to the remote networks can leave over the Internet when the tunnel drops."), "route.bh");
    if (sc === "s2sdyn") {
      if (m.ident.peerMode === "one" && !String(m.ident.localid).trim()) add("err", t("Con Solo il peer ID indicato serve il Local ID della filiale.", "With Only the given peer ID the branch local ID is required."), "ident.localid");
      if (!ipsecBgp(m) && (m.adv.a || {})["p1.add-route"] === "disable") add("warn", t("Con add-route disattivo l’hub non impara le reti della filiale: servono rotte o BGP.", "With add-route off the hub does not learn the branch networks: routes or BGP are needed."), "adv.a.p1.add-route");
      if (!ipsecBgp(m)) add("info", t("La filiale propone una phase2 per ogni coppia di reti: così l’hub crea da solo le rotte verso la filiale.", "The branch proposes one phase2 per network pair: this way the hub creates the routes to the branch by itself."), null);
    }
    if (m.auth.method === "cert") {
      ["A", "B"].forEach(x => {
        if (!m.auth["cert" + x]) add("err", t("Manca il certificato locale del lato ", "Local certificate missing on side ") + x + ".", "auth.cert" + x);
        if (!m.auth["ca" + x]) add("err", t("Manca la CA del peer sul lato ", "Peer CA missing on side ") + x + ".", "auth.ca" + x);
      });
    }
  }
  // Network ID
  if (sc === "dialup" || sc === "s2sdyn") {
    const nidRaw = String(m.ident.networkId).trim(), nid = parseInt(nidRaw, 10);
    if (nidRaw !== "" && (!/^\d+$/.test(nidRaw) || nid > 255)) add("err", t("Il Network ID deve essere un numero da 0 a 255.", "The Network ID must be a number from 0 to 255."), "ident.networkId");
    const used = String(m.ident.usedIds).split(/[,;\s]+/).filter(Boolean).map(x => parseInt(x, 10)).filter(x => !isNaN(x));
    if (used.length && used.includes(nid || 0)) add("err", t("Il Network ID ", "Network ID ") + (nid || 0) + t(" è già usato da un altro tunnel dial-up sulla stessa interfaccia: le connessioni finirebbero sull’altro tunnel.", " is already used by another dial-up tunnel on the same interface: connections would land on the other tunnel."), "ident.networkId");
    if (c.ike === "2" && nid > 0 && sc === "dialup") add("info", t("Il client deve inviare Network ID ", "The client must send Network ID ") + nid + t(": importa il file XML, perché la GUI di FortiClient non ha questo campo.", ": import the XML file, since the FortiClient GUI has no such field."), "ident.networkId");
    if (c.ike === "2" && (nid || 0) === 0 && !used.length) add("info", t("Network ID 0 va bene se questo è l’unico tunnel dial-up IKEv2 sulla WAN. Con più tunnel assegna valori diversi.", "Network ID 0 is fine if this is the only IKEv2 dial-up tunnel on the WAN. With several tunnels assign different values."), "ident.networkId");
  }
  // dial-up (FortiClient e client nativi)
  if (DIAL(sc)) {
    const d = m.dial;
    if (!d.group) add("err", t("Manca il gruppo utenti.", "User group is missing."), "dial.group");
    if (d.auth === "local" && !d.users) add("warn", t("Nessun utente locale nel gruppo.", "No local user in the group."), "dial.users");
    if (d.auth === "local") add("info", t("Crea gli utenti in User & Authentication con password e FortiToken. Il FortiGate include 2 FortiToken Mobile gratuiti.", "Create users in User & Authentication with password and FortiToken. The FortiGate includes 2 free FortiToken Mobile."), null);
    if (d.auth === "local" && sc === "dialup") add("info", t("La notifica push di FortiToken su IPsec IKEv2 richiede FortiOS 7.2.8, 7.4.4, 7.6.0 o successivi e FortiClient 7.2.4 o successivo su Windows; con versioni precedenti l’utente inserisce il codice.", "FortiToken push over IPsec IKEv2 needs FortiOS 7.2.8, 7.4.4, 7.6.0 or later and FortiClient 7.2.4 or later on Windows; with older versions the user types the code."), null);
    if (d.auth === "ldap") {
      if (!d.ldapServer || !d.ldapDN) add("err", t("Servono server LDAP e DN del gruppo.", "LDAP server and group DN are required."), "dial.ldapServer");
      add("info", t("Con LDAP il client usa EAP-TTLS: il file XML include eap_method 2 (FortiClient 7.4.3 o successivo). Nella versione gratuita di FortiClient l’MFA con LDAP non è supportato.", "With LDAP the client uses EAP-TTLS: the XML file includes eap_method 2 (FortiClient 7.4.3 or later). The free FortiClient does not support MFA with LDAP."), null);
    }
    if (d.auth === "radius") { if (!d.radiusServer) add("err", t("Manca il server RADIUS.", "RADIUS server is missing."), "dial.radiusServer");
      add("info", t("Sul server RADIUS il criterio deve accettare EAP-MSCHAPv2. Se il server chiede anche l’MFA, alza remoteauthtimeout, il timeout del server (config user radius) e negotiate-timeout della phase1.", "The RADIUS server policy must accept EAP-MSCHAPv2. If the server also asks for MFA, raise remoteauthtimeout, the server timeout (config user radius) and the phase1 negotiate-timeout."), null); }
    if (d.auth === "saml") {
      const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!guid.test(d.tenant)) add("err", t("ID tenant Entra mancante o non valido.", "Entra tenant ID missing or invalid."), "dial.tenant");
      if (!guid.test(d.groupId)) add("err", t("ID del gruppo Entra mancante o non valido.", "Entra group ID missing or invalid."), "dial.groupId");
      if (d.samlPort === "443" || d.samlPort === "80") add("warn", t("La porta SAML ", "SAML port ") + d.samlPort + t(" è quasi sempre già in uso: scegline una dedicata, ad esempio 9443.", " is almost always in use: pick a dedicated one, for example 9443."), "dial.samlPort");
      add("info", t("Su ogni interfaccia si imposta un solo server SAML: altri tunnel dial-up sulla stessa WAN devono usare un altro metodo.", "Only one SAML server can be set per interface: other dial-up tunnels on the same WAN need another method."), null);
    }
    ["poolStart", "poolEnd", "dns1", "dns2"].forEach(k => { if (d[k] && !isIp(d[k])) add("err", t("Indirizzo non valido: ", "Invalid address: ") + d[k], "dial." + k); });
    if (!d.poolStart || !d.poolEnd) add("err", t("Indica il pool di indirizzi dei client.", "Set the client address pool."), "dial.poolStart");
    if (isIp(d.poolStart) && isIp(d.poolEnd)) {
      const a = ipInt(d.poolStart), b = ipInt(d.poolEnd);
      if (a > b) add("err", t("Il primo IP del pool è maggiore dell’ultimo.", "The first pool IP is greater than the last."), "dial.poolStart");
      parseNets(m.a.nets).out.forEach(n => { if (a <= n.end && b >= n.start) add("err", t("Il pool si sovrappone alla rete interna ", "The pool overlaps the internal network ") + n.raw + ".", ["dial.poolStart", "a.nets"]); });
    }
    if (String(d.authTimeout).trim() && !(/^\d+$/.test(String(d.authTimeout).trim()) && +d.authTimeout >= 1 && +d.authTimeout <= 300)) add("err", t("Il tempo per l’MFA deve essere tra 1 e 300 secondi.", "Time for MFA must be between 1 and 300 seconds."), "dial.authTimeout");
    if (!d.client) add("warn", t("Manca il nome della connessione nel client.", "Client connection name is missing."), "dial.client");
    if (sc === "dialup" && c.ike === "1") add("err", t("FortiClient non supporta IKEv1 dalla versione 7.4.4: usa IKEv2.", "FortiClient no longer supports IKEv1 since 7.4.4: use IKEv2."), "crypto.ike");
    if (sc === "dialup" && !c.p1.some(p => FCT_P1[p])) add("err", t("Nessuna proposta phase1 è utilizzabile nel file FortiClient: includi aes256-sha256 o aes256-sha384.", "No phase1 proposal can be used in the FortiClient file: include aes256-sha256 or aes256-sha384."), "crypto.p1");
    if (sc === "dialup" && !c.p2.some(p => FCT_P2[p])) add("err", t("Nessuna proposta phase2 è utilizzabile nel file FortiClient: includi aes256-sha256 o aes256gcm.", "No phase2 proposal can be used in the FortiClient file: include aes256-sha256 or aes256gcm."), "crypto.p2");
    if (sc === "dialup") add("info", t("Dopo l’import non modificare la connessione dalla GUI di FortiClient: Network ID ed EAP impostati via XML possono andare persi.", "After import do not edit the connection in the FortiClient GUI: Network ID and EAP set via XML may be lost."), null);
  }
  // crittografia
  if (!c.p1.length) add("err", t("Seleziona almeno una proposta phase1.", "Select at least one phase1 proposal."), "crypto.p1");
  if (!c.dh1.length) add("err", t("Seleziona almeno un gruppo DH phase1.", "Select at least one phase1 DH group."), "crypto.dh1");
  if (!c.p2.length) add("err", t("Seleziona almeno una proposta phase2.", "Select at least one phase2 proposal."), "crypto.p2");
  if (c.pfs === "enable" && !c.dh2.length) add("err", t("Con PFS attivo seleziona almeno un gruppo DH phase2.", "With PFS on select at least one phase2 DH group."), "crypto.dh2");
  if (c.ike === "1") {
    const aead = c.p1.filter(p => /gcm|chacha/.test(p));
    if (aead.length) add("err", t("Le proposte ", "Proposals ") + aead.join(", ") + t(" esistono solo con IKEv2.", " exist only with IKEv2."), "crypto.p1");
    add("warn", t("IKEv1 è legacy: usalo solo se il peer non supporta IKEv2.", "IKEv1 is legacy: use it only if the peer lacks IKEv2."), "crypto.ike");
    if (c.mode === "aggressive" && !(!DIAL(sc) && m.auth.method === "cert")) add("warn", t("IKEv1 aggressive con PSK espone la chiave ad attacchi offline.", "IKEv1 aggressive with PSK exposes the key to offline attacks."), "crypto.mode");
  }
  const weakDh = [...c.dh1, ...(c.pfs === "enable" ? c.dh2 : [])].filter(x => ["1", "2", "5"].includes(x));
  if (weakDh.length) add("warn", t("Gruppi DH deboli: ", "Weak DH groups: ") + [...new Set(weakDh)].join(", ") + t(". Usa 14 o superiori, meglio 20 o 21.", ". Use 14 or higher, ideally 20 or 21."), "crypto.dh1");
  const weakP = [...c.p1, ...c.p2].filter(p => /sha1|md5|3des|des-/.test(p));
  if (weakP.length) add("warn", t("Proposte legacy o insicure: ", "Legacy or insecure proposals: ") + [...new Set(weakP)].join(", ") + ".", "crypto.p1");
  if (c.pfs !== "enable") add("warn", t("PFS disattivo: una chiave compromessa può esporre il traffico passato.", "PFS off: a compromised key can expose past traffic."), "crypto.pfs");
  const l1 = Number(c.life1), l2 = Number(c.life2);
  if (c.life1 && (!Number.isInteger(l1) || l1 < 120 || l1 > 172800)) add("err", t("Durata phase1 fuori intervallo (120–172800).", "Phase1 lifetime out of range (120–172800)."), "crypto.life1");
  if (c.life2 && (!Number.isInteger(l2) || l2 < 120 || l2 > 172800)) add("err", t("Durata phase2 fuori intervallo (120–172800).", "Phase2 lifetime out of range (120–172800)."), "crypto.life2");
  // segreti
  const needPsk = sc === "dialup" || (!DIAL(sc) && m.auth.method === "psk");
  if (needPsk) {
    const psk = (sec && sec.psk) || "";
    if (!psk) add("warn", t("PSK vuota: nel risultato compare il segnaposto <PSK>. Usa Genera per crearne una sicura.", "PSK empty: the output shows the <PSK> placeholder. Use Generate to create a strong one."), "psk");
    else {
      if (/[?"\\]/.test(psk)) add("err", t("La PSK contiene ?, virgolette o barre rovesciate: nella CLI il ? apre l’aiuto e la riga non viene accettata.", "The PSK contains ?, quotes or backslashes: in the CLI ? opens help and the line is rejected."), "psk");
      if (psk.length < 20) add("warn", t("PSK corta: usa almeno 20 caratteri casuali.", "Short PSK: use at least 20 random characters."), "psk");
      if (sc === "dialup") add("info", t("Il file XML contiene la PSK in chiaro: dopo l’import cancellalo e non inviarlo per email.", "The XML file holds the PSK in clear: delete it after import and do not email it."), null);
    }
  }
  // avanzate
  ["a", "b"].forEach(s => {
    const adv = (m.adv && m.adv[s]) || {};
    if (adv["p1.dpd"] === "disable") add("warn", t("DPD disattivo: un tunnel caduto resta su fino alla scadenza.", "DPD off: a dead tunnel stays up until expiry."), "adv." + s + ".p1.dpd");
    if (adv["p2.replay"] === "disable") add("warn", t("Anti-replay disattivo.", "Anti-replay off."), "adv." + s + ".p2.replay");
    if (adv["p1.ppk"] && adv["p1.ppk"] !== "disable" && !(sec && sec.ppk)) add("warn", t("PPK attivo senza chiave: compare il segnaposto <PPK>.", "PPK on without a key: the <PPK> placeholder is shown."), "adv." + s + ".p1.ppk");
    Object.keys(adv).forEach(k => {
      const o = OPT_BY_KEY[k]; if (!o || o.type !== "num" || adv[k] === "" || adv[k] === null) return;
      const v = Number(adv[k]);
      if (!Number.isFinite(v) || v < o.min || v > o.max) add("err", o[it ? "it" : "en"][0] + ": " + t("valore fuori intervallo ", "value out of range ") + "(" + o.min + "–" + o.max + ").", "adv." + s + "." + k);
    });
  });

  // fase 2: BGP
  if ((sc === "s2s" || sc === "s2sdyn") && m.bgp.on && !advOn(m)) {
    const b = m.bgp, asOk = v => /^\d+$/.test(String(v).trim()) && +v >= 1 && +v <= 4294967295;
    if (!asOk(b.asA)) add("err", t("AS del lato A non valido (1–4294967295).", "Side A AS is invalid (1–4294967295)."), "bgp.asA");
    if (!asOk(b.asB)) add("err", t("AS del lato B non valido (1–4294967295).", "Side B AS is invalid (1–4294967295)."), "bgp.asB");
    ["ridA", "ridB"].forEach(k => { if (String(b[k]).trim() && !isIp(b[k])) add("err", t("Router ID non valido: ", "Invalid router ID: ") + b[k], "bgp." + k); });
    if (sc === "s2s") {
      if (!(isIp(m.a.tip) && isIp(m.b.tip))) add("err", t("Il BGP usa gli IP del tunnel come vicini: indicali su entrambi i lati.", "BGP uses the tunnel IPs as neighbors: set them on both sides."), "a.tip");
      if (m.dual.on && !(isIp(m.dual.aTip) && isIp(m.dual.bTip))) add("err", t("Con doppia WAN e BGP servono gli IP anche sul secondo tunnel.", "With dual WAN and BGP the second tunnel needs IPs too."), "dual.aTip");
      if (m.dual.on && m.dual.mode === "backup") add("info", t("Con il BGP i due tunnel lavorano in parallelo (multipath): la scelta di un tunnel di riserva vale solo per le rotte statiche.", "With BGP both tunnels work in parallel (multipath): the backup choice applies to static routes only."), "dual.mode");
    } else {
      const ov = overlayInfo(m);
      if (!ov) add("err", t("Rete overlay non valida: usa un CIDR da /24 a /30, ad esempio 169.254.20.0/24.", "Invalid overlay network: use a /24 to /30 CIDR, for example 169.254.20.0/24."), "bgp.overlay");
      ["a", "b"].forEach(s => {
        const ip = m[s].tip;
        if (!isIp(ip)) add("err", t("Serve l’IP del tunnel per il BGP", "The tunnel IP is needed for BGP") + " (" + sideName(s) + ").", s + ".tip");
        else if (ov && (ipInt(ip) <= ov.start || ipInt(ip) >= ov.end - 1)) add("err", ip + t(" non è un indirizzo utilizzabile della rete overlay ", " is not a usable address of the overlay network ") + ov.net + "/" + ov.p + t(" (l’ultimo è riservato come remote-ip fittizio).", " (the last one is reserved as dummy remote-ip)."), s + ".tip");
      });
      if (isIp(m.a.tip) && m.a.tip === m.b.tip) add("err", t("Hub e filiale non possono avere lo stesso IP del tunnel.", "Hub and branch cannot share the tunnel IP."), "b.tip");
      add("info", t("Con il BGP l’hub non usa add-route e la filiale usa una sola phase2 0.0.0.0/0: le reti arrivano via BGP.", "With BGP the hub does not use add-route and the branch uses a single 0.0.0.0/0 phase2: networks arrive via BGP."), null);
    }
    [["keepalive", 0, 65535], ["holdtime", 3, 65535]].forEach(([k, lo, hi]) => { const v = String(b[k]).trim(); if (v && !(/^\d+$/.test(v) && +v >= lo && +v <= hi)) add("err", t("Timer BGP fuori intervallo.", "BGP timer out of range."), "bgp." + k); });
    if (String(b.keepalive).trim() && String(b.holdtime).trim() && +b.holdtime < 3 * +b.keepalive) add("warn", t("L’holdtime di solito è almeno il triplo del keepalive.", "Holdtime is usually at least three times the keepalive."), "bgp.holdtime");
    if (m.route.on) add("info", t("Con il BGP le rotte statiche verso il tunnel non vengono generate; le blackhole restano.", "With BGP no static routes to the tunnel are generated; blackholes stay."), "route.on");
  }
  // fase 2: doppia WAN
  if (sc === "s2s" && m.dual.on) {
    const d2 = m.dual;
    [["aTunnel", "A"], ["bTunnel", "B"]].forEach(([k, x]) => {
      const v = String(d2[k]).trim();
      if (!v) add("err", t("Manca il nome del secondo tunnel sul lato ", "Second tunnel name missing on side ") + x + ".", "dual." + k);
      else if (v.length > 15) add("err", t("Il nome del secondo tunnel supera 15 caratteri (lato ", "The second tunnel name exceeds 15 characters (side ") + x + ").", "dual." + k);
    });
    if (String(d2.aTunnel).trim() && d2.aTunnel === m.a.tunnel) add("err", t("I due tunnel del lato A devono avere nomi diversi.", "The two side A tunnels need different names."), ["dual.aTunnel", "a.tunnel"]);
    if (String(d2.bTunnel).trim() && d2.bTunnel === m.b.tunnel) add("err", t("I due tunnel del lato B devono avere nomi diversi.", "The two side B tunnels need different names."), ["dual.bTunnel", "b.tunnel"]);
    if (!String(d2.aWan).trim()) add("err", t("Manca la seconda interfaccia WAN del lato A.", "Side A second WAN interface is missing."), "dual.aWan");
    if (!String(d2.aIp).trim() && !String(d2.aFqdn).trim()) add("err", t("Serve l’IP pubblico o l’FQDN della seconda WAN del lato A: il lato B lo usa per il secondo tunnel.", "The side A second WAN IP or FQDN is needed: side B uses it for the second tunnel."), "dual.aIp");
    ["aIp", "bIp", "aTip", "bTip"].forEach(k => { if (String(d2[k]).trim() && !isIp(d2[k])) add("err", t("Indirizzo non valido: ", "Invalid address: ") + d2[k], "dual." + k); });
    if ((String(d2.bIp).trim() || String(d2.bFqdn).trim()) && !String(d2.bWan).trim()) add("err", t("Indica l’interfaccia della seconda WAN del lato B.", "Set the side B second WAN interface."), "dual.bWan");
    if (d2.mode === "backup" && !ipsecBgp(m)) {
      const p = Number(m.route.distance) || 10, bd = Number(d2.backupDist);
      if (!(bd > p && bd < (Number(m.route.bhDistance) || 254))) add("err", t("La distanza del tunnel di riserva deve essere maggiore di quella principale e minore di quella delle blackhole.", "The backup tunnel distance must be higher than the primary one and lower than the blackhole one."), "dual.backupDist");
    }
    if ((m.adv.a || {})["p1.dpd"] === undefined) add("warn", t("Con la doppia WAN serve il DPD attivo per accorgersi in fretta della caduta di un tunnel.", "With dual WAN DPD is needed to notice a tunnel drop quickly."), "adv.a.p1.dpd");
  }
  // fase 2: IKE su TCP (FortiClient)
  if (sc === "dialup" && m.trans.mode !== "udp") {
    const port = String(m.trans.port).trim();
    if (fosNum(m) < 7.4) add("err", t("IKE su TCP per i dial-up non è disponibile su FortiOS 7.2: richiede FortiOS 7.4.6 o successivo.", "IKE over TCP for dial-up is not available on FortiOS 7.2: it needs FortiOS 7.4.6 or later."), "trans.mode");
    if (c.ike !== "2") add("err", t("IKE su TCP funziona solo con IKEv2.", "IKE over TCP works only with IKEv2."), "trans.mode");
    if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) add("err", t("Indica la porta TCP per IKE (1–65535).", "Set the TCP port for IKE (1–65535)."), "trans.port");
    if (port && port === String(m.dial.samlPort).trim() && m.dial.auth === "saml") add("err", t("La porta TCP di IKE non può coincidere con la porta SAML.", "The IKE TCP port cannot match the SAML port."), "trans.port");
    if (m.trans.mode === "auto" && fosNum(m) < 7.6) add("err", t("La modalità automatica UDP/TCP esiste da FortiOS 7.6: su 7.4 (dalla 7.4.5) restano solo udp e tcp, e la configurazione usa tcp.", "Automatic UDP/TCP mode exists from FortiOS 7.6: on 7.4 (from 7.4.5) only udp and tcp remain, and the configuration uses tcp."), "trans.mode");
    const th = String(m.trans.threshold).trim();
    if (th && !(/^\d+$/.test(th) && +th >= 1 && +th <= 300)) add("err", t("Soglia di fallback fuori intervallo (1–300 secondi).", "Fallback threshold out of range (1–300 seconds)."), "trans.threshold");
    add("warn", t("Cambiare ike-tcp-port riavvia tutti i tunnel IPsec del FortiGate, anche quelli UDP: applicalo fuori orario. La porta non può coincidere con la porta HTTPS di amministrazione né con un VIP.", "Changing ike-tcp-port flushes every IPsec tunnel on the FortiGate, UDP ones too: apply it after hours. The port cannot match the HTTPS admin port or a VIP."), "trans.port");
    add("info", t("Servono FortiOS 7.4.6 o successivo e FortiClient 7.4.1 o successivo; nel file XML transport_mode e tcp_port sono già impostati. La porta TCP si imposta solo con ike-tcp-port in config system settings.", "FortiOS 7.4.6 or later and FortiClient 7.4.1 or later are required; transport_mode and tcp_port are already set in the XML file. The TCP port is set only with ike-tcp-port in config system settings."), null);
  }
  // origine delle connessioni
  if ((sc === "dialup" || sc === "s2sdyn") && m.gwm.mode !== "any") {
    const g = m.gwm;
    if (fosNum(m) < 7.4) add("err", t("La limitazione dell’origine (remote-gw-match) esiste da FortiOS 7.4.4.", "Source restriction (remote-gw-match) exists from FortiOS 7.4.4."), "gwm.mode");
    else add("info", t("remote-gw-match richiede FortiOS 7.4.4 o successivo.", "remote-gw-match needs FortiOS 7.4.4 or later."), "gwm.mode");
    if (g.mode === "ipmask" && !parseNets(g.subnet).out.length) add("err", t("Indica la rete di origine ammessa in formato CIDR, ad esempio 203.0.113.0/24.", "Set the allowed source network in CIDR format, for example 203.0.113.0/24."), "gwm.subnet");
    if (g.mode === "iprange") {
      if (!isIp(g.start) || !isIp(g.end)) add("err", t("Indica primo e ultimo IP dell’intervallo ammesso.", "Set the first and last IP of the allowed range."), "gwm.start");
      else if (ipInt(g.start) > ipInt(g.end)) add("err", t("Il primo IP dell’intervallo è dopo l’ultimo.", "The range first IP comes after the last."), "gwm.start");
    }
    if (g.mode === "geography") {
      if (!/^[A-Za-z]{2}$/.test(String(g.country).trim())) add("err", t("Il paese va indicato con il codice di due lettere, ad esempio IT.", "The country needs its two-letter code, for example IT."), "gwm.country");
      if (sc === "dialup") add("warn", t("Con il filtro per paese chi è in viaggio all’estero non si collega, e la posizione dipende dal database GeoIP: avvisa gli utenti.", "With the country filter users travelling abroad cannot connect, and the location depends on the GeoIP database: tell users."), "gwm.country");
    }
  }
  // opzioni del client dial-up
  if (sc === "dialup") {
    const d = m.dial;
    if (d.split === "full") { const ex = parseNets(d.exclude); ex.bad.forEach(x => add("err", t("Rete da escludere non valida: ", "Invalid network to exclude: ") + x, "dial.exclude")); }
    if (String(d.domains).trim() && fosNum(m) < 7.4) add("warn", t("I domini interni (internal-domain-list) esistono da FortiOS 7.4.1: su 7.2 non vengono generati.", "Internal domains (internal-domain-list) exist from FortiOS 7.4.1: they are not generated on 7.2."), "dial.domains");
    if (String(d.suffix).trim() && fosNum(m) < 7.6) add("warn", t("I suffissi DNS (dns-suffix-search) esistono da FortiOS 7.6.4: con questa versione non vengono generati.", "DNS suffixes (dns-suffix-search) exist from FortiOS 7.6.4: they are not generated with this version."), "dial.suffix");
    if (String(d.suffix).trim() && fosNum(m) >= 7.6) add("info", t("dns-suffix-search richiede FortiOS 7.6.4 o successivo.", "dns-suffix-search needs FortiOS 7.6.4 or later."), "dial.suffix");
    if ((String(d.domains).trim() || String(d.suffix).trim()) && !String(d.dns1).trim()) add("warn", t("Domini interni e suffissi servono a poco senza un DNS interno da assegnare ai client.", "Internal domains and suffixes are of little use without an internal DNS assigned to clients."), "dial.dns1");
  }
  // FEC
  if ((sc === "s2s" || sc === "s2sdyn") && m.fec.on) {
    const b = String(m.fec.base).trim(), r = String(m.fec.redundant).trim();
    if (b && !(/^\d+$/.test(b) && +b >= 1 && +b <= 40)) add("err", t("Pacchetti base FEC fuori intervallo (1–40).", "FEC base packets out of range (1–40)."), "fec.base");
    if (r && !(/^\d+$/.test(r) && +r >= 1 && +r <= 20)) add("err", t("Pacchetti ridondanti FEC fuori intervallo (1–20).", "FEC redundant packets out of range (1–20)."), "fec.redundant");
    const pct = Math.round(100 * (+(r || 10)) / (+(b || 20)));
    add("warn", t("Con FEC il tunnel invia circa il " + pct + "% di traffico in più e l’accelerazione NPU viene disattivata: usalo solo su linee che perdono pacchetti.", "With FEC the tunnel sends about " + pct + "% more traffic and NPU acceleration is turned off: use it only on lossy lines."), "fec.on");
  }
  // standby con monitor
  if (sc === "s2s" && m.dual.on && m.dual.mode === "standby") {
    if (ipsecBgp(m)) add("warn", t("Con il BGP il tunnel in standby non serve: il BGP sceglie già il percorso. Valuta la modalità in parallelo.", "With BGP a standby tunnel is not needed: BGP already picks the path. Consider parallel mode."), "dual.mode");
    if (m.dual.holdType === "delay") { const v = String(m.dual.holdDelay).trim(); if (!/^\d+$/.test(v)) add("err", t("Indica dopo quanti secondi tornare al tunnel principale.", "Set after how many seconds to return to the primary tunnel."), "dual.holdDelay"); }
    add("info", t("In standby il secondo tunnel resta spento finché il primo è su: il passaggio richiede qualche secondo in più rispetto a due tunnel sempre attivi.", "In standby the second tunnel stays down while the first is up: failover takes a few more seconds than with two always-on tunnels."), null);
  }
  // server LDAP e RADIUS
  if (sc === "dialup" && m.dial.auth === "ldap") {
    const d = m.dial;
    if (d.ldapCreate) {
      if (!String(d.ldapIp).trim()) add("err", t("Manca l’indirizzo del server LDAP (domain controller).", "LDAP server (domain controller) address is missing."), "dial.ldapIp");
      if (!String(d.ldapBase).trim()) add("err", t("Manca il DN base del dominio, ad esempio DC=azienda,DC=local.", "Domain base DN is missing, for example DC=company,DC=local."), "dial.ldapBase");
      else if (!/dc=/i.test(d.ldapBase)) add("warn", t("Il DN base di solito contiene i componenti DC= del dominio.", "The base DN usually contains the domain DC= components."), "dial.ldapBase");
      if (!String(d.ldapBind).trim()) add("err", t("Manca il DN dell’account di bind.", "Bind account DN is missing."), "dial.ldapBind");
      else if (!/^cn=/i.test(d.ldapBind.trim())) add("warn", t("Per il bind regular serve il DN completo dell’account (CN=…,OU=…,DC=…), non il solo nome utente.", "Regular bind needs the full account DN (CN=…,OU=…,DC=…), not just the username."), "dial.ldapBind");
      if (!sec || !sec.ldap) add("warn", t("Password di bind non inserita: nella CLI resta il segnaposto.", "Bind password not entered: the CLI keeps the placeholder."), "ldapPwd");
      if (d.ldapSecure === "disable") add("info", t("Senza LDAPS il bind dell’account di servizio viaggia in chiaro verso il DC: valuta LDAPS sulla porta 636.", "Without LDAPS the service account bind travels in clear text to the DC: consider LDAPS on port 636."), "dial.ldapSecure");
    }
    if (d.ldapDN && d.ldapBase && !d.ldapDN.toLowerCase().endsWith(d.ldapBase.toLowerCase())) add("warn", t("Il DN del gruppo VPN non sta sotto il DN base: il FortiGate non lo troverebbe.", "The VPN group DN is not under the base DN: the FortiGate would not find it."), "dial.ldapDN");
  }
  if (sc === "dialup" && m.dial.auth === "radius") {
    const d = m.dial;
    if (d.radiusCreate) {
      if (!String(d.radiusIp).trim()) add("err", t("Manca l’indirizzo del server RADIUS.", "RADIUS server address is missing."), "dial.radiusIp");
      if (!sec || !sec.radius) add("warn", t("Segreto condiviso RADIUS non inserito: nella CLI resta il segnaposto.", "RADIUS shared secret not entered: the CLI keeps the placeholder."), "radiusPwd");
      const to = String(d.radiusTimeout).trim();
      if (to && !(/^\d+$/.test(to) && +to >= 1 && +to <= 300)) add("err", t("Timeout RADIUS fuori intervallo (1–300 secondi).", "RADIUS timeout out of range (1–300 seconds)."), "dial.radiusTimeout");
    }
    add("info", t("Un gateway dial-up IKEv2 con gruppi RADIUS non usa altri server di autenticazione: per un secondo server serve un altro tunnel con un Network ID diverso.", "An IKEv2 dial-up gateway with RADIUS groups does not use other authentication servers: a second server needs another tunnel with a different Network ID."), null);
  }
  // conflitti tra parti diverse
  conflictChecks(m, sec, it, add);
  // modulo BGP avanzato
  if (advOn(m)) bgpAdvChecks(m, sec, it, add);
  if (sc === "ms" && m.fos === "7.2") add("err", t("La rete multi-sede è disponibile solo per FortiOS 7.4 e 7.6.", "The multi-site network is available only for FortiOS 7.4 and 7.6."), "fos");
  if (m.fos === "7.2") add("warn", t("FortiOS 7.2 è fuori supporto Fortinet dal 30 settembre 2026: niente più patch, nemmeno di sicurezza. Pianifica l’aggiornamento a 7.4 o 7.6.", "FortiOS 7.2 has been out of Fortinet support since 30 September 2026: no more patches, security ones included. Plan the upgrade to 7.4 or 7.6."), "fos");
  const order = { err: 0, warn: 1, info: 2 }, seen = new Set();
  return R.filter(r => { if (seen.has(r.lvl + r.msg)) return false; seen.add(r.lvl + r.msg); return true; }).sort((x, y) => order[x.lvl] - order[y.lvl]);
}

/* ---------- conflitti tra parametri di tutte le parti ---------- */
function conflictChecks(m, sec, it, add) {
  const t = (a, b) => it ? a : b, sc = m.scenario, adv = advOn(m), g = m.bgpAdv || {};
  const U = UI[it ? "it" : "en"], sideName = s => U[(s === "a" ? "sideA_" : "sideB_") + sc];
  // i FortiGate della configurazione: lati IPsec e nodi BGP (un nodo legato a un lato è lo stesso apparato)
  const dev = {};
  const D = (id, name) => (dev[id] = dev[id] || { id, name, ips: [], ifs: [], nets: [] });
  const sides = sc === "ms" ? [] : DIAL(sc) ? ["a"] : ["a", "b"];
  sides.forEach(s => {
    const d = D("side:" + s, m[s].label || sideName(s));
    d.ifs.push({ v: m[s].wan, p: s + ".wan", what: "WAN" });
    if (!DIAL(sc)) d.ifs.push({ v: m[s].tunnel, p: s + ".tunnel", what: t("tunnel", "tunnel") });
    if ((sc === "s2s" || (sc === "s2sdyn" && ipsecBgp(m))) && isIp(m[s].tip)) d.ips.push({ v: m[s].tip, p: s + ".tip", what: t("IP del tunnel", "tunnel IP") });
    parseNets(m[s].nets).out.forEach(n => d.nets.push({ n, p: s + ".nets" }));
    if (sc === "s2s" && m.dual.on) {
      d.ifs.push({ v: m.dual[s + "Tunnel"], p: "dual." + s + "Tunnel", what: t("secondo tunnel", "second tunnel") });
      if (String(m.dual[s + "Wan"] || "").trim()) d.ifs.push({ v: m.dual[s + "Wan"], p: "dual." + s + "Wan", what: t("seconda WAN", "second WAN"), wan: true });
      if (isIp(m.dual[s + "Tip"])) d.ips.push({ v: m.dual[s + "Tip"], p: "dual." + s + "Tip", what: t("IP del secondo tunnel", "second tunnel IP") });
    }
  });
  if (DIAL(sc)) D("side:a").ifs.push({ v: m.a.tunnel, p: "a.tunnel", what: "tunnel" });
  const devOf = n => n.ipsec && dev["side:" + n.ipsec] ? dev["side:" + n.ipsec] : D(n.id, nodeName(m, n));
  if (adv) {
    (g.nodes || []).forEach((n, i) => {
      if (n.ext) return;
      const d = devOf(n), P = k => "bgpAdv.nodes." + i + "." + k;
      if (!n.ipsec) siteWans(m, n).forEach(w => { if (w.if) d.ifs.push({ v: w.if, p: w.p.if, what: "WAN", wan: true }); });
      if (isIp(n.loIp)) { d.ips.push({ v: n.loIp, p: P("loIp"), what: "loopback" }); d.ifs.push({ v: n.loName, p: P("loName"), what: "loopback" }); }
      if (!n.ipsec || String(n.nets || "").trim()) parseNets(n.nets).out.forEach(x => d.nets.push({ n: x, p: P("nets") }));
    });
    const dialSeen = {};
    (g.links || []).forEach((l0, i) => {
      const l = bgpLinkRes(m, l0); if (!l.gen || l.bothDyn) return;
      const oi = s => l.swapped ? (s === "a" ? "b" : "a") : s, LP = k => "bgpAdv.links." + i + "." + k;
      ["a", "b"].forEach(s => {
        const n = bgpNode(m, l[s]); if (!n || n.ext) return;
        const d = devOf(n);
        if (l.dyn && s === "a") {
          const k = n.id + "|" + l.aIf; if (dialSeen[k]) return; dialSeen[k] = 1;
          const gp = l.grpP || "bgpAdv.nodes." + (g.nodes || []).indexOf(n) + ".";
          d.ifs.push({ v: l.aIf, p: gp + "dialName", what: t("tunnel dial-up", "dial-up tunnel") });
          if (isIp(l.aIp)) d.ips.push({ v: l.aIp, p: gp + "dialIp", what: t("IP dell’hub", "hub IP") });
          return;
        }
        d.ifs.push({ v: l[s + "If"], p: LP(oi(s) + "If"), what: "tunnel" });
        if (isIp(l[s + "Ip"])) d.ips.push({ v: l[s + "Ip"], p: LP(oi(s) + "Ip"), what: t("IP del tunnel", "tunnel IP") });
      });
    });
  }
  const devs = Object.values(dev);
  // 1. lo stesso IP su due interfacce
  const ipSeen = {};
  devs.forEach(d => d.ips.forEach(x => {
    const k = String(x.v).trim(), prev = ipSeen[k];
    if (prev) add("err", t("Conflitto: l’indirizzo ", "Conflict: address ") + k + t(" è usato due volte (", " is used twice (") + prev.d.name + ", " + prev.x.what + "; " + d.name + ", " + x.what + ").", [x.p, prev.x.p]);
    else ipSeen[k] = { d, x };
  }));
  // 2. IP di tunnel e loopback dentro una LAN
  devs.forEach(d => d.ips.forEach(x => devs.forEach(e => e.nets.forEach(y => {
    const v = ipInt(x.v); if (v >= y.n.start && v <= y.n.end) add("err", t("Conflitto: ", "Conflict: ") + x.what + " " + x.v + t(" di ", " of ") + d.name + t(" sta dentro la rete ", " sits inside network ") + y.n.raw + t(" di ", " of ") + e.name + t(": usa una rete dedicata ai tunnel.", ": use a network dedicated to tunnels."), [x.p, y.p]);
  }))));
  // 3. due interfacce con lo stesso nome sullo stesso FortiGate
  devs.forEach(d => {
    const seen = {};
    d.ifs.filter(x => String(x.v || "").trim()).forEach(x => {
      const k = String(x.v).trim(), prev = seen[k];
      if (prev && !(prev.wan && x.wan)) add("err", t("Conflitto su ", "Conflict on ") + d.name + ": " + t("il nome ", "the name ") + k + t(" è usato sia per ", " is used for both ") + prev.what + t(" sia per ", " and ") + x.what + ".", [x.p, prev.p]);
      else if (!prev) seen[k] = x;
    });
  });
  // 4. reti LAN sovrapposte tra FortiGate diversi (A e B sono già controllati)
  for (let i = 0; i < devs.length; i++) for (let j = i + 1; j < devs.length; j++) {
    const A = devs[i], B = devs[j]; if (A.id === "side:a" && B.id === "side:b") continue;
    A.nets.forEach(x => B.nets.forEach(y => { if (overlap(x.n, y.n)) add("err", t("Conflitto: la rete ", "Conflict: network ") + x.n.raw + t(" di ", " of ") + A.name + t(" si sovrappone a ", " overlaps ") + y.n.raw + t(" di ", " of ") + B.name + ".", [x.p, y.p]); }));
  }
  // 5. reti di servizio (tunnel, spoke, pool dei client) sovrapposte alle LAN
  const svc = [];
  if (adv && parseNets(g.pool).out[0] && (g.links || []).some(l => { const r = bgpLinkRes(m, l); return r.gen && !r.dyn && !r.bothDyn; })) svc.push({ n: parseNets(g.pool).out[0], p: "bgpAdv.pool", what: t("rete dei tunnel BGP", "BGP tunnel network") });
  if (adv) { const seenG = {}; (g.links || []).forEach(l0 => { const r = bgpLinkRes(m, l0); if (!r.gen || !r.dyn || !r.overlay) return; const k = r.a + "|" + r.aIf; if (seenG[k]) return; seenG[k] = 1;
    svc.push({ n: r.overlay, p: (r.grpP || "") + "overlay", what: t("rete degli spoke di ", "spoke network of ") + nodeName(m, bgpNode(m, r.a)) + (r.grp && r.grp !== "1_1" ? " (" + r.aIf + ")" : "") }); }); }
  if (sc === "s2sdyn" && ipsecBgp(m)) { const o = overlayInfo(m); if (o) svc.push({ n: o, p: "bgp.overlay", what: t("rete overlay", "overlay network") }); }
  if (DIAL(sc) && isIp(m.dial.poolStart) && isIp(m.dial.poolEnd) && ipInt(m.dial.poolStart) <= ipInt(m.dial.poolEnd))
    svc.push({ n: { start: ipInt(m.dial.poolStart), end: ipInt(m.dial.poolEnd), raw: m.dial.poolStart + "–" + m.dial.poolEnd }, p: "dial.poolStart", what: t("pool dei client", "client pool") });
  svc.forEach(x => devs.forEach(e => e.nets.forEach(y => {
    if (overlap(x.n, y.n) && !(x.p === "dial.poolStart" && e.id === "side:a")) add("err", t("Conflitto: la ", "Conflict: the ") + x.what + " " + (x.n.raw || "") + t(" si sovrappone alla rete ", " overlaps network ") + y.n.raw + t(" di ", " of ") + e.name + ".", [x.p, y.p]);
  })));
  for (let i = 0; i < svc.length; i++) for (let j = i + 1; j < svc.length; j++) if (overlap(svc[i].n, svc[j].n))
    add("err", t("Conflitto: la ", "Conflict: the ") + svc[i].what + t(" e la ", " and the ") + svc[j].what + t(" si sovrappongono.", " overlap."), [svc[i].p, svc[j].p]);
  // pool dei client contro IP di tunnel
  const pool = svc.find(x => x.p === "dial.poolStart");
  if (pool) devs.forEach(d => d.ips.forEach(x => { const v = ipInt(x.v); if (v >= pool.n.start && v <= pool.n.end) add("err", t("Conflitto: ", "Conflict: ") + x.what + " " + x.v + t(" è dentro il pool dei client.", " is inside the client pool."), [x.p, "dial.poolStart"]); }));
  // 6. lo stesso IP pubblico per due FortiGate diversi
  if (adv) {
    const pub = {};
    sides.forEach(s => { if (isIp(m[s].ip)) pub[m[s].ip.trim()] = { name: m[s].label || sideName(s), p: s + ".ip", id: "side:" + s }; });
    (g.nodes || []).forEach((n, i) => {
      if (n.ipsec || !isIp(n.pubIp) || n.dyn) return;
      const k = n.pubIp.trim(), prev = pub[k];
      if (prev && prev.id !== n.id) add("warn", t("Possibile conflitto: ", "Possible conflict: ") + nodeName(m, n) + t(" e ", " and ") + prev.name + t(" hanno lo stesso IP pubblico ", " have the same public IP ") + k + ".", ["bgpAdv.nodes." + i + ".pubIp", prev.p]);
      else pub[k] = { name: nodeName(m, n), p: "bgpAdv.nodes." + i + ".pubIp", id: n.id };
    });
  }
  // 7. router ID uguale alla loopback di un altro nodo, o a un IP di interfaccia di un altro FortiGate
  if (adv) (g.nodes || []).forEach((n, i) => {
    if (n.ext || !isIp(n.rid)) return;
    const mine = devOf(n), hit = devs.find(d => d !== mine && d.ips.some(x => x.v.trim() === n.rid.trim()));
    if (hit) add("warn", t("Possibile conflitto: il router ID ", "Possible conflict: router ID ") + n.rid + t(" di ", " of ") + nodeName(m, n) + t(" è un indirizzo di ", " is an address of ") + hit.name + ".", "bgpAdv.nodes." + i + ".rid");
  });
}

/* ---------- modulo BGP avanzato (FortiOS 7.4 e 7.6) ---------- */
/* il modulo BGP vive solo nello scenario «Rete multi-sede» (FortiOS 7.4 e 7.6) */
const advOn = m => m.scenario === "ms";
const asValid = v => /^\d+$/.test(String(v).trim()) && +v >= 1 && +v <= 4294967295;
const isPrivAs = v => { const n = +v; return (n >= 64512 && n <= 65534) || (n >= 4200000000 && n <= 4294967294); };
const objNameOk = s => /^[A-Za-z0-9_.-]{1,35}$/.test(String(s || ""));
/* i tunnel IPsec portano il BGP (rotte statiche spente, add-route spento sull'hub) */
const ipsecBgp = m => (m.scenario === "s2s" || m.scenario === "s2sdyn") &&
  (advOn(m) ? (m.bgpAdv.links || []).some(l => l.src) : !!m.bgp.on);

function bgpBlankNode(id) {
  return { id, name: "", ipsec: "", as: "", rid: "", rr: false, ext: false, loName: "lo_bgp", loIp: "", nets: "", redisConn: false, redisStatic: false, redisRm: "",
    wan: "wan1", pubIp: "", fqdn: "", dyn: false, dialName: "DIAL_BGP", overlay: "169.254.200.0/24", dialIp: "",
    wanType: "inet", wanCost: "0", xwans: [], lanIf: "lan", dials: {}, code: "", wanCode: "", wanSeg: "", ridGen: "" };
}
function bgpBlankLink(id) {
  return { id, src: "", a: "", b: "", kind: "tunnel", loop: false, aIf: "", aIp: "", bIf: "", bIp: "", dyn: false, range: "", bfd: false,
    ipsec: false, aWan: "", bWan: "", aGw: "", bGw: "", cOwn: false, c: null, auto: false, dialHub: false, aIfGen: "", bIfGen: "", aIpGen: "", bIpGen: "", aw: 1, bw: 1, agg: "",
    aRmIn: "", aRmOut: "", aPlIn: "", aPlOut: "", aMax: "", aDef: false, aNhs: false,
    bRmIn: "", bRmOut: "", bPlIn: "", bPlOut: "", bMax: "", bDef: false, bNhs: false };
}
function bgpNextId(list, p) { let n = 0; (list || []).forEach(x => { const k = parseInt(String(x.id).slice(1), 10); if (k > n) n = k; }); return p + (n + 1); }
function bgpNode(m, id) { return ((m.bgpAdv && m.bgpAdv.nodes) || []).find(n => n.id === id); }
const nodeName = (m, n) => String(n.name || "").trim() || (n.ipsec && m[n.ipsec] ? String(m[n.ipsec].label || "").trim() : "") || n.id;
const nodeNets = (m, n) => String(n.nets || "").trim() ? n.nets : (n.ipsec && m[n.ipsec] ? m[n.ipsec].nets : "");
/* WAN, gateway pubblico e IP dinamico del nodo (dal lato IPsec se il nodo è collegato a un lato) */
/* più linee per sede (SD-WAN): solo nella rete multi-sede con hub e spoke o full mesh */
const sdwanOn = m => m.scenario === "ms" && !!(m.bgpAdv && m.bgpAdv.sdwan && m.bgpAdv.sdwan.on) && m.bgpAdv.topo !== "custom";
/* le linee di una sede: la 1 sta nei campi della sede, le altre in xwans */
function siteWans(m, n) {
  const ni = ((m.bgpAdv && m.bgpAdv.nodes) || []).indexOf(n), NP = k => "bgpAdv.nodes." + ni + "." + k;
  const L = [{ slot: 1, if: String(n.wan || "").trim(), addr: String(n.pubIp || "").trim() || String(n.fqdn || "").trim(), dyn: !!n.dyn, type: n.wanType || "inet", cost: String(n.wanCost ?? "0"),
    code: String(n.wanCode || "").trim(), seg: String(n.wanSeg || "").trim(),
    p: { if: NP("wan"), addr: NP("pubIp"), dyn: NP("dyn"), type: NP("wanType"), cost: NP("wanCost"), code: NP("wanCode"), seg: NP("wanSeg") } }];
  if (sdwanOn(m)) (n.xwans || []).forEach((w, k) => L.push({ slot: k + 2, if: String(w.if || "").trim(), addr: String(w.addr || "").trim(), dyn: !!w.dyn, type: w.type || "inet", cost: String(w.cost ?? ""),
    code: String(w.code || "").trim(), seg: String(w.seg || "").trim(),
    p: { if: NP("xwans." + k + ".if"), addr: NP("xwans." + k + ".addr"), dyn: NP("xwans." + k + ".dyn"), type: NP("xwans." + k + ".type"), cost: NP("xwans." + k + ".cost"), code: NP("xwans." + k + ".code"), seg: NP("xwans." + k + ".seg") } }));
  return L;
}
/* aggregato IPsec: per ogni coppia di sedi i tunnel diventano un'interfaccia sola, con un IP e una sessione BGP */
const aggOn = m => sdwanOn(m) && m.bgpAdv.sdwan.mode === "agg";
/* codici brevi per i nomi a codici. Vuoti, si ricavano: la sede dal nome (iniziali, o le prime tre lettere di una parola sola),
   la linea dal tipo (I internet, L LTE, P privata, con un numero se la sede ne ha più di una dello stesso tipo) */
function autoSiteCode(m, n) {
  const sites = msSites(m), used = new Set(sites.map(x => String(x.code || "").trim().toUpperCase()).filter(Boolean));
  for (const x of sites) {
    if (String(x.code || "").trim()) continue;
    const w = String(nodeName(m, x)).normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
    const c = (w.length > 1 ? w.map(t => /^\d+$/.test(t) ? t : t[0]).join("") : (w[0] || "").slice(0, 3)).toUpperCase().slice(0, 4) || "S";
    let y = c, k = 2; while (used.has(y)) y = c.slice(0, 3) + k++;
    used.add(y); if (x === n) return y;
  }
  return "S";
}
const siteCode = (m, n) => String(n.code || "").trim() || autoSiteCode(m, n);
const LINE_LETTER = { inet: "W", sat: "S", lte: "L", mpls: "P" };
/* lettera del tipo; una linea privata prende il nome della sua rete (al massimo 4 caratteri) */
function lineBase(w) {
  if (w.type === "mpls") { const b = String(w.seg || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z0-9]+/); return b ? b[0].slice(0, 4) : "P"; }
  return LINE_LETTER[w.type] || "W";
}
function autoLineCode(m, n, w) {
  const base = lineBase(w), same = siteWans(m, n).filter(x => !String(x.code || "").trim() && lineBase(x).toLowerCase() === base.toLowerCase());
  if (same.length < 2) return base;
  // linee private su reti diverse verso sedi diverse: basta lo stesso codice, i nomi si distinguono per la sede remota
  if (same.every(x => x.type === "mpls")) {
    const segs = same.map(x => String(x.seg || "").trim().toLowerCase()), seen = new Set();
    let ok = segs.every(Boolean) && new Set(segs).size === segs.length;
    if (ok) segs.forEach(sg => msSites(m).forEach(p => { if (p !== n && siteWans(m, p).some(y => y.type === "mpls" && String(y.seg || "").trim().toLowerCase() === sg)) { if (seen.has(p.id)) ok = false; seen.add(p.id); } }));
    if (ok) return base;
  }
  const k = same.findIndex(x => x.slot === w.slot);
  return k <= 0 ? base : base + (k + 1);
}
const lineCode = (m, n, w) => String(w.code || "").trim() || autoLineCode(m, n, w);
const MAX_LINES = 8;
const wanOf = (m, n, slot) => { const L = siteWans(m, n); return L.find(w => w.slot === (+slot || 1)) || L[0]; };
const nodeWan = (m, n, slot) => n.ipsec && m[n.ipsec] ? (m[n.ipsec].wan || "") : wanOf(m, n, slot).if;
const nodeGw = (m, n, slot) => n.ipsec && m[n.ipsec] ? (String(m[n.ipsec].ip || "").trim() || String(m[n.ipsec].fqdn || "").trim()) : wanOf(m, n, slot).addr;
const nodeDyn = (m, n, slot) => !n.ext && (n.ipsec ? (m.scenario === "s2sdyn" && n.ipsec === "b") : wanOf(m, n, slot).dyn);
/* coppia di linee: chiave stabile, esclusa a mano o impossibile (due IP dinamici, MPLS con una linea internet) */
const pairKey = (a, sa, b, sb) => [a + ":" + sa, b + ":" + sb].sort().join("|");
/* con l'aggregato i tunnel sono statici: basta una linea con IP dinamico (senza FQDN) per escludere la coppia; le linee private si parlano solo sulla stessa rete */
const pairWhyNot = (wa, wb, agg) => (agg ? wa.dyn || wb.dyn : wa.dyn && wb.dyn) ? (agg ? "dynagg" : "dyn")
  : (wa.type === "mpls") !== (wb.type === "mpls") ? "mpls"
  : wa.type === "mpls" && String(wa.seg || "").trim().toLowerCase() !== String(wb.seg || "").trim().toLowerCase() ? "seg" : "";
/* tunnel dial-up dell'hub: uno per linea dell'hub e per linea della filiale (i_j); 1_1 vive nei campi della sede */
function grpObj(hub, i, j, create) {
  if ((+i || 1) === 1 && (+j || 1) === 1) return hub;
  const k = (+i || 1) + "_" + (+j || 1);
  if (!hub.dials || !hub.dials[k]) { const d = { dialName: "", overlay: "", dialIp: "", overlayGen: "", dialIpGen: "" }; if (!create) return d; hub.dials = hub.dials || {}; hub.dials[k] = d; }
  return hub.dials[k];
}
const grpName = (hub, i, j) => { const o = grpObj(hub, i, j); return String(o.dialName || "").trim() || (o === hub ? "DIAL_BGP" : String(hub.dialName || "DIAL_BGP").trim().slice(0, 11) + "_" + (+i || 1) + (+j || 1)); };
const grpPath = (m, hub, i, j) => "bgpAdv.nodes." + m.bgpAdv.nodes.indexOf(hub) + "." + (((+i || 1) === 1 && (+j || 1) === 1) ? "" : "dials." + (+i || 1) + "_" + (+j || 1) + ".");
/* sulla stessa linea dell'hub più tunnel dial-up si distinguono con il network-id (IKEv2) */
function hubNetId(m, hub, i, j) {
  const js = new Set();
  ((m.bgpAdv && m.bgpAdv.links) || []).forEach(l => { if (!bgpGenLink(l)) return; const hs = linkDial(m, l); if (hs !== "a" && hs !== "b") return;
    const h = hs === "a" ? l.a : l.b, hi = hs === "a" ? l.aw : l.bw, sj = hs === "a" ? l.bw : l.aw; if (h === hub.id && (+hi || 1) === (+i || 1)) js.add(+sj || 1); });
  return js.size > 1 ? (+j || 1) : 0;
}
const BGP_SIDE_KEYS = ["If", "Ip", "RmIn", "RmOut", "PlIn", "PlOut", "Max", "Def", "Nhs", "Wan", "Gw", "IfGen", "IpGen", "w"];
/* quale lato del tunnel generato è l'hub dial-up: "a", "b", "both" (due IP dinamici) o null (tunnel statico) */
function linkDial(m, l) {
  if (l.agg) return null;
  const A = bgpNode(m, l.a), B = bgpNode(m, l.b); if (!A || !B) return null;
  const da = nodeDyn(m, A, l.aw), db = nodeDyn(m, B, l.bw);
  if (da && db) return "both";
  if (db || (l.dialHub && !da)) return "a";
  if (da) return "b";
  return null;
}
function bgpSwap(r) {
  const o = Object.assign({}, r); o.a = r.b; o.b = r.a;
  BGP_SIDE_KEYS.forEach(k => { o["a" + k] = r["b" + k]; o["b" + k] = r["a" + k]; });
  o.swapped = true; return o;
}
const bgpGenLink = l => !l.src && l.kind === "tunnel" && !!l.ipsec;
function hubOverlay(n) { const o = parseNets(n.overlay).out[0]; return o && o.p <= 30 ? Object.assign({}, o, { bogus: intIp(o.end - 1) }) : null; }
/* maschera dei tunnel tra IP fissi: /30 di serie, /31 a scelta nella rete multi-sede */
const p2pLen = m => m.scenario === "ms" && String((m.bgpAdv || {}).p2pPrefix) === "31" ? 31 : 30;
/* toglie una linea da una sede: coppie escluse, tunnel e tunnel dial-up seguono la nuova numerazione */
function msRemoveWan(m, n, slot) {
  const k = slot - 2, g = m.bgpAdv; if (k < 0 || !n.xwans || !n.xwans[k]) return;
  n.xwans.splice(k, 1);
  g.pairEx = (g.pairEx || []).map(key => {
    const pt = key.split("|").map(x => x.split(":"));
    for (const x of pt) if (x[0] === n.id) { if (+x[1] === slot) return null; if (+x[1] > slot) x[1] = String(+x[1] - 1); }
    return pairKey(pt[0][0], pt[0][1], pt[1][0], pt[1][1]);
  }).filter(Boolean);
  g.links = (g.links || []).filter(l => !((l.a === n.id && +l.aw === slot) || (l.b === n.id && +l.bw === slot)));
  g.links.forEach(l => ["a", "b"].forEach(s => { if (l[s] === n.id && +l[s + "w"] > slot) l[s + "w"] = +l[s + "w"] - 1; }));
  const d = {}; Object.keys(n.dials || {}).forEach(key => { const [i, j] = key.split("_").map(Number); if (i === slot) return; d[(i > slot ? i - 1 : i) + "_" + j] = n.dials[key]; }); n.dials = d;
  bgpNormalize(m);
}
/* riporta un tunnel generato ai valori proposti da Fortissimo (nome, IP, WAN, gateway, crittografia); i filtri BGP restano */
function linkAutoReset(m, l) {
  ["a", "b"].forEach(s => { l[s + "If"] = l[s + "IfGen"] = l[s + "Ip"] = l[s + "IpGen"] = l[s + "Wan"] = l[s + "Gw"] = ""; });
  l.cOwn = false; l.c = null;
}
/* scelte rapide per le coppie di linee: tutte, stesso tipo, linea per linea, senza LTE con LTE.
   Se una regola lascerebbe due sedi senza tunnel, per quella coppia di sedi restano tutte. */
function msPairPreset(m, kind) {
  const g = m.bgpAdv, sites = msSites(m), hub = msHub(m), agg = aggOn(m), ex = [];
  const pairs = hub ? sites.filter(n => n !== hub).map(n => [hub, n]) : g.topo === "mesh" ? sites.flatMap((x, i) => sites.slice(i + 1).map(y => [x, y])) : [];
  pairs.forEach(([A, B]) => {
    const all = [], drop = [];
    siteWans(m, A).forEach(wa => siteWans(m, B).forEach(wb => {
      if (pairWhyNot(wa, wb, agg)) return; all.push(1);
      const d = kind === "type" ? wa.type !== wb.type : kind === "slot" ? wa.slot !== wb.slot : kind === "nolte" ? wa.type === "lte" && wb.type === "lte" : false;
      if (d) drop.push(pairKey(A.id, wa.slot, B.id, wb.slot));
    }));
    if (drop.length < all.length) ex.push(...drop);
  });
  g.pairEx = ex; bgpNormalize(m);
}
/* riassegna dal pool tutti gli indirizzi dei tunnel generati, anche quelli scritti a mano */
function msResetIps(m) {
  (m.bgpAdv.links || []).forEach(l => { if (bgpGenLink(l)) { l.aIp = l.bIp = l.aIpGen = l.bIpGen = ""; } });
  (m.bgpAdv.nodes || []).forEach(n => { n.dialIp = n.dialIpGen = ""; Object.values(n.dials || {}).forEach(d => { d.dialIp = d.dialIpGen = ""; }); });
  bgpNormalize(m);
}
/* rete multi-sede: le sedi, l'hub e i tunnel voluti dalla topologia */
const msSites = m => ((m.bgpAdv && m.bgpAdv.nodes) || []).filter(n => !n.ext);
function msHub(m) { const g = m.bgpAdv, s = msSites(m); return g.topo === "hub" ? (s.find(n => n.id === g.hubId) || s[0] || null) : null; }
function msTemplate(it) {
  const g = Object.assign(baseModel("ms").bgpAdv, { on: true, topo: "hub", hubId: "n1", hubMode: "dial", bgpType: "ibgp", baseAs: "65000" });
  const N = (id, o) => Object.assign(bgpBlankNode(id), o);
  g.nodes.push(N("n1", { name: it ? "Sede centrale" : "Head office", pubIp: "198.51.100.10", nets: "192.168.10.0/24" }),
    N("n2", { name: it ? "Filiale 1" : "Branch 1", pubIp: "203.0.113.20", nets: "192.168.20.0/24" }),
    N("n3", { name: it ? "Filiale 2" : "Branch 2", dyn: true, nets: "192.168.30.0/24" }));
  return g;
}
/* allinea AS, route reflector, router ID e tunnel alla topologia scelta; restituisce true se ha cambiato il modello */
function msBuild(m) {
  const g = m.bgpAdv; let ch = false;
  const set = (o, k, v) => { if (o[k] !== v) { o[k] = v; ch = true; } };
  const sites = msSites(m), hub = msHub(m);
  if (g.topo === "hub" && hub) set(g, "hubId", hub.id);
  if (!g.asManual && g.topo !== "custom") {
    const base = asValid(g.baseAs) ? +g.baseAs : 65000;
    if (g.bgpType === "ibgp") sites.forEach(n => set(n, "as", String(base)));
    else (hub ? [hub, ...sites.filter(n => n !== hub)] : sites).forEach((n, k) => set(n, "as", String(Math.min(base + k, 4294967295))));
  }
  if (g.topo !== "custom") sites.forEach(n => set(n, "rr", !!hub && g.bgpType === "ibgp" && n === hub));
  const rids = new Set(sites.map(n => String(n.rid || "").trim()).filter(Boolean));
  // piano per sede: il router ID della sede k è il k-esimo indirizzo della prima /24 della rete dei tunnel
  const pl = msPlan(m), rid0 = pl ? pl.pool.start : null;
  sites.forEach((n, k) => {
    const cur = String(n.rid || "").trim();
    if (cur && !(n.ridGen && cur === n.ridGen)) return;
    let want = rid0 !== null ? intIp(rid0 + k + 1) : "";
    if (want && want !== cur && rids.has(want)) want = "";
    if (!want) { if (cur) return; for (let x = 1; x < 255; x++) if (!rids.has("10.255.0." + x)) { want = "10.255.0." + x; break; } }
    if (want && want !== cur) { rids.delete(cur); n.rid = n.ridGen = want; rids.add(want); ch = true; }
  });
  if (g.topo === "custom") {
    // nella topologia personalizzata non ci sono aggregati: i membri tornano tunnel normali
    const keep = (g.links || []).filter(l => l.agg !== "pair"); keep.forEach(l => set(l, "agg", ""));
    if (keep.length !== (g.links || []).length) { g.links = keep; ch = true; }
    return ch;
  }
  const pairs = [], sw = sdwanOn(m), agg = aggOn(m), ex = new Set(g.pairEx || []);
  if (hub) sites.forEach(n => { if (n !== hub) pairs.push([hub, n]); });
  else if (g.topo === "mesh") sites.forEach((x, i) => sites.slice(i + 1).forEach(y => pairs.push([x, y])));
  const want = [];
  pairs.forEach(([A, B]) => {
    if (!sw) { want.push([A.id, B.id, 1, 1, ""]); return; }
    const mem = [];
    siteWans(m, A).forEach(wa => siteWans(m, B).forEach(wb => { if (!pairWhyNot(wa, wb, agg) && !ex.has(pairKey(A.id, wa.slot, B.id, wb.slot))) mem.push([A.id, B.id, wa.slot, wb.slot, agg ? "mem" : ""]); }));
    if (agg && mem.length) want.push([A.id, B.id, 0, 0, "pair"]);
    want.push(...mem);
  });
  // la coppia dell'aggregato ha una chiave sua; i membri riusano i tunnel della zona SD-WAN e viceversa
  const key = (a, aw, b, bw, k) => (k === "pair" ? "P|" : "") + pairKey(a, +aw || 1, b, +bw || 1), autos = [], others = [];
  (g.links || []).forEach(l => { if (l.auto) autos.push(l); else others.push(l); });
  const out = [];
  want.forEach(([a, b, aw, bw, kind]) => {
    let l = autos.find(x => key(x.a, x.aw, x.b, x.bw, x.agg) === key(a, aw, b, bw, kind) && !out.includes(x));
    if (!l) { l = Object.assign(bgpBlankLink(bgpNextId([...(g.links || []), ...out], "l")), { a, b, aw, bw, ipsec: true, auto: true, agg: kind }); ch = true; }
    if (l.a !== a) { const s = bgpSwap(l); BGP_SIDE_KEYS.forEach(k => { l["a" + k] = s["a" + k]; l["b" + k] = s["b" + k]; }); l.a = a; l.b = b; ch = true; }
    set(l, "aw", aw); set(l, "bw", bw); set(l, "agg", kind);
    set(l, "dialHub", !!hub && g.hubMode === "dial" && !agg);
    set(l, "ipsec", true); set(l, "kind", "tunnel"); set(l, "loop", false); set(l, "src", "");
    if (hub) { set(l, "aNhs", kind !== "mem" && g.bgpType === "ibgp" && (g.hubMode !== "dial" || sw)); set(l, "bNhs", false); }
    out.push(l);
  });
  const next = [...out, ...others];
  if (next.length !== (g.links || []).length || next.some((x, i) => x !== g.links[i])) { g.links = next; ch = true; }
  return ch;
}
/* piano di indirizzi per sede: una /24 per sede nella rete dei tunnel, la /24 zero per i router ID */
function msPlan(m) {
  const g = m.bgpAdv; if (m.scenario !== "ms" || !g || g.ipPlan !== "site" || g.topo === "custom") return null;
  const pool = parseNets(g.pool).out[0]; if (!pool || pool.p > 24) return null;
  return { pool, blocks: Math.floor((pool.end - pool.start + 1) / 256) };
}
/* nuova sede con la prima LAN 192.168.x.0/24 libera */
function msAddSite(m, lang) {
  const g = m.bgpAdv, it = lang !== "en", id = bgpNextId(g.nodes, "n"), n = bgpBlankNode(id);
  const names = new Set(g.nodes.map(x => nodeName(m, x)));
  let k = msSites(m).length; do { n.name = (g.topo === "hub" ? (it ? "Filiale " : "Branch ") : (it ? "Sede " : "Site ")) + k++; } while (names.has(n.name));
  const used = msSites(m).flatMap(x => parseNets(x.nets).out);
  for (let x = 10; x <= 250; x += 10) { const c = parseNets("192.168." + x + ".0/24").out[0]; if (!used.some(u => overlap(u, c))) { n.nets = c.raw; break; } }
  g.nodes.push(n);
  bgpNormalize(m);
  return id;
}
/* completa nomi e IP dei tunnel generati; restituisce true se ha cambiato il modello */
function bgpNormalize(m) {
  const g = m.bgpAdv; if (!g) return false;
  let ch = false;
  if (!g.pool) { g.pool = "169.254.100.0/24"; ch = true; }
  if (!g.autoLink) { g.autoLink = "hub"; ch = true; }
  (g.nodes || []).forEach(n => { const b = bgpBlankNode(n.id); Object.keys(b).forEach(k => { if (n[k] === undefined) { n[k] = b[k]; ch = true; } }); });
  (g.links || []).forEach(l => { const b = bgpBlankLink(l.id); Object.keys(b).forEach(k => { if (l[k] === undefined) { l[k] = b[k]; ch = true; } }); });
  (g.nodes || []).forEach(n => (n.xwans || []).forEach(w => { const b = { if: "", addr: "", dyn: false, type: "inet", cost: "", code: "", seg: "" }; Object.keys(b).forEach(k => { if (w[k] === undefined) { w[k] = b[k]; ch = true; } }); }));
  if (g.sdwan) { const b = { mode: "zone", alg: "L4" }; Object.keys(b).forEach(k => { if (g.sdwan[k] === undefined) { g.sdwan[k] = b[k]; ch = true; } }); }
  if (g.names === undefined) { g.names = "peer"; ch = true; }
  if (g.dpdInt === undefined) { g.dpdInt = ""; ch = true; }
  if (g.ipPlan === undefined) { g.ipPlan = "seq"; ch = true; }
  if (m.scenario === "ms" && msBuild(m)) ch = true;
  const sw = sdwanOn(m), agg = aggOn(m);
  // con l'SD-WAN l'health-check punta alla loopback dell'altra sede: la loopback prende il router ID se è vuota
  if (m.scenario === "ms") msSites(m).forEach(n => {
    const target = sw && !agg && (m.bgpAdv.topo === "mesh" || n === msHub(m));
    if (target && !String(n.loIp || "").trim() && isIp(n.rid)) { n.loIp = n.loIpGen = n.rid; ch = true; }
    else if (target && n.loIpGen && n.loIp === n.loIpGen && isIp(n.rid) && n.loIp !== n.rid) { n.loIp = n.loIpGen = n.rid; ch = true; }
    else if (!target && n.loIpGen && n.loIp === n.loIpGen) { n.loIp = n.loIpGen = ""; ch = true; }
  });
  // tunnel dial-up: uno per hub, per linea dell'hub e per linea della filiale, ognuno con la sua rete
  const grps = [];
  (g.links || []).forEach(l => {
    if (!bgpGenLink(l)) return; const hs = linkDial(m, l); if (hs !== "a" && hs !== "b") return;
    const h = bgpNode(m, hs === "a" ? l.a : l.b); if (!h) return;
    const i = +(hs === "a" ? l.aw : l.bw) || 1, j = +(hs === "a" ? l.bw : l.aw) || 1;
    if (!grps.some(x => x.hub === h && x.i === i && x.j === j)) grps.push({ hub: h, i, j, o: grpObj(h, i, j, true) });
  });
  // i nomi generati seguono i nomi delle sedi finché non li cambi a mano
  const prev = {};
  (g.links || []).forEach(l => { if (!bgpGenLink(l)) return; ["a", "b"].forEach(s => { const v = String(l[s + "If"] || "").trim(); if (!v || v === l[s + "IfGen"]) { prev[l.id + s] = l[s + "If"]; l[s + "If"] = ""; } }); });
  const used = {}, useName = (nid, nm) => { (used[nid] = used[nid] || new Set()).add(nm); };
  (g.nodes || []).forEach(n => { if (n.ipsec && m[n.ipsec]) tunnelsFor(m, n.ipsec).forEach(t => useName(n.id, t.name)); useName(n.id, n.dialName || "DIAL_BGP"); });
  grps.forEach(x => useName(x.hub.id, grpName(x.hub, x.i, x.j)));
  (g.links || []).forEach(l => { if (l.aIf) useName(l.a, l.aIf); if (l.bIf) useName(l.b, l.bIf); });
  const clean = s => String(s || "").normalize("NFD").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  const freeName = (nid, peer, sfx, pre) => {
    const base = (((pre || "T_") + clean(peer)).slice(0, 15 - (sfx || "").length) + (sfx || "")) || "T_peer";
    let nm = base, k = 2; while ((used[nid] || new Set()).has(nm)) { const sfx = "_" + k++; nm = base.slice(0, 15 - sfx.length) + sfx; }
    useName(nid, nm); return nm;
  };
  // nomi a codici: sede+linea-altrasede+linea per i tunnel (MILW-ROML), sede-altrasede per gli aggregati (MIL-ROM); oltre 15 caratteri lo segnalano le verifiche
  const codes = m.scenario === "ms" && g.names === "code" && g.topo !== "custom";
  const codeName = (nid, nm) => { let x = nm, k = 2; while ((used[nid] || new Set()).has(x)) x = nm + "_" + k++; useName(nid, x); return x; };
  const tunName = (l, s, me, peer) => {
    const o = s === "a" ? "b" : "a";
    if (codes) {
      const lc = (N, w) => l.agg === "pair" || !sw ? "" : clean(lineCode(m, N, wanOf(m, N, w)));
      return codeName(me.id, clean(siteCode(m, me)) + lc(me, l[s + "w"]) + "-" + clean(siteCode(m, peer)) + lc(peer, l[o + "w"]));
    }
    if (l.agg === "pair") return freeName(me.id, nodeName(m, peer), "", "AG_");
    return freeName(me.id, nodeName(m, peer), sw && l.auto ? "_" + (+l[s + "w"] || 1) + (+l[o + "w"] || 1) : "");
  };
  const pool = parseNets(g.pool).out[0];
  // ogni tunnel dial-up ha la sua rete degli spoke: se due si sovrappongono, il secondo ne riceve una nuova
  const taken = [];
  grps.forEach(({ o: h }) => {
    let o = parseNets(h.overlay).out[0];
    const autoOv = !String(h.overlay || "").trim() || h.overlay === h.overlayGen || h.overlay === "169.254.200.0/24";
    if (autoOv && (!o || o.p > 30 || taken.some(t => overlap(t, o)) || (pool && overlap(pool, o)))) {
      for (let k = 200; k < 255; k++) { const c = parseNets("169.254." + k + ".0/24").out[0]; if (!taken.some(t => overlap(t, c)) && !(pool && overlap(pool, c))) { h.overlay = h.overlayGen = "169.254." + k + ".0/24"; h.dialIp = h.dialIpGen = intIp(c.start + 1); o = c; ch = true; break; } }
    }
    if (o && o.p <= 30) taken.push(o);
  });
  // indirizzi: si riassegnano quando il tunnel passa da statico a dial-up o cambia hub
  (g.links || []).forEach(l => {
    if (!bgpGenLink(l)) return;
    const hs = linkDial(m, l), mode = l.agg === "mem" ? "mem" : hs === "a" || hs === "b" ? "dial:" + (hs === "a" ? l.a : l.b) + ((+l.aw || 1) * (+l.bw || 1) > 1 ? ":" + (hs === "a" ? l.aw + "_" + l.bw : l.bw + "_" + l.aw) : "") : (hs ? "none" : "p2p/" + p2pLen(m) + (msPlan(m) ? "/site" : ""));
    if (l.ipMode !== mode) {
      const prefixOnly = String(l.ipMode || "").startsWith("p2p") && mode.startsWith("p2p");
      const auto = ["a", "b"].every(s => !String(l[s + "Ip"] || "").trim() || l[s + "Ip"] === l[s + "IpGen"]);
      if (l.ipMode !== undefined && (!prefixOnly || auto)) { l.aIp = l.bIp = l.aIpGen = l.bIpGen = ""; }
      l.ipMode = mode; ch = true;
    }
  });
  const ips = new Set();
  (g.links || []).forEach(l => { [l.aIp, l.bIp].forEach(x => { if (isIp(x)) ips.add(ipInt(x)); }); });
  // piano per sede: il tunnel t tra la sede i e la sede j (i < j) va nella /24 numero i, posizione (j − 2)·T + t
  const plan = msPlan(m), siteNo = new Map(msSites(m).map((n, k) => [n.id, k + 1])), slotOf = new Map();
  if (plan) {
    (g.nodes || []).forEach(n => { if (isIp(n.rid)) ips.add(ipInt(n.rid)); });
    const per = {};
    (g.links || []).forEach(l => { if (bgpGenLink(l) && l.agg !== "mem" && !linkDial(m, l)) { const k = [l.a, l.b].sort().join("|"); (per[k] = per[k] || []).push(l); } });
    const T = Math.max(1, ...Object.values(per).map(x => x.length));
    Object.values(per).forEach(ls => ls.forEach((l, t) => { const ia = siteNo.get(l.a), ib = siteNo.get(l.b); if (!ia || !ib) return;
      slotOf.set(l.id, { i: Math.min(ia, ib), slot: (Math.max(ia, ib) - 2) * T + t, low: ia < ib ? "a" : "b" }); }));
  }
  (g.nodes || []).forEach(n => { if (isIp(n.dialIp)) ips.add(ipInt(n.dialIp)); });
  grps.forEach(x => { if (isIp(x.o.dialIp)) ips.add(ipInt(x.o.dialIp)); });
  ["a", "b"].forEach(s => { if (m[s] && isIp(m[s].tip) && m.scenario !== "ms") ips.add(ipInt(m[s].tip)); });
  grps.forEach(({ o: n }) => {
    const o = hubOverlay(n), auto = !String(n.dialIp || "").trim() || n.dialIp === n.dialIpGen;
    if (o && auto && !(isIp(n.dialIp) && ipInt(n.dialIp) > o.start && ipInt(n.dialIp) < o.end - 1)) { n.dialIp = n.dialIpGen = intIp(o.start + 1); ips.add(o.start + 1); ch = true; }
  });
  (g.links || []).forEach(l => {
    if (!bgpGenLink(l)) return;
    if (l.cOwn && !l.c) { l.c = JSON.parse(JSON.stringify(m.crypto)); ch = true; }
    const A = bgpNode(m, l.a), B = bgpNode(m, l.b); if (!A || !B || l.a === l.b) return;
    ["a", "b"].forEach(s => {
      const me = s === "a" ? A : B, peer = s === "a" ? B : A;
      if (!String(l[s + "If"] || "").trim() && !me.ext) { l[s + "If"] = tunName(l, s, me, peer); l[s + "IfGen"] = l[s + "If"]; }
      if (l.id + s in prev ? prev[l.id + s] !== l[s + "If"] : false) ch = true;
    });
    if (l.agg === "mem") return;  // i membri dell'aggregato non hanno IP: l'IP sta sull'aggregato
    const hs = linkDial(m, l);
    if (hs === "a" || hs === "b") {
      const sp = hs === "a" ? "b" : "a", hub = grpObj(hs === "a" ? A : B, l[hs + "w"], l[sp + "w"]), o = hubOverlay(hub), cur = l[sp + "Ip"];
      const auto = (!String(cur || "").trim() && !l[sp + "IpGen"]) || cur === l[sp + "IpGen"];
      if (o && auto && !(isIp(cur) && ipInt(cur) > o.start && ipInt(cur) < o.end - 1 && ipInt(cur) !== ipInt(isIp(hub.dialIp) ? hub.dialIp : "0.0.0.0"))) {
        for (let x = o.start + 2; x < o.end - 1; x++) if (!ips.has(x) && x !== ipInt(isIp(hub.dialIp) ? hub.dialIp : "0.0.0.0")) { l[sp + "Ip"] = l[sp + "IpGen"] = intIp(x); ips.add(x); ch = true; break; }
      }
    } else if (!hs && !String(l.aIp || "").trim() && !String(l.bIp || "").trim() && !l.aIpGen && !l.bIpGen && pool) {
      const st = p2pLen(m) === 31 ? 2 : 4, off = st === 2 ? [0, 1] : [1, 2], put = (x, lo) => { const hi = lo === "a" ? "b" : "a";
        l[lo + "Ip"] = l[lo + "IpGen"] = intIp(x + off[0]); l[hi + "Ip"] = l[hi + "IpGen"] = intIp(x + off[1]); ips.add(x + off[0]); ips.add(x + off[1]); ch = true; };
      const sl = plan && slotOf.get(l.id), x0 = sl ? plan.pool.start + sl.i * 256 + sl.slot * st : -1;
      if (sl && sl.i < plan.blocks && (sl.slot + 1) * st <= 256 && !off.some(d => ips.has(x0 + d))) put(x0, sl.low);
      else for (let x = plan ? pool.start + 256 : pool.start; x + st - 1 <= pool.end; x += st) if (!off.some(d => ips.has(x + d))) { put(x, "a"); break; }
    }
  });
  return ch;
}
/* collega un nuovo nodo secondo la scelta «autoLink»: all'hub, in full mesh o a mano */
function bgpAddNode(m, lang) {
  const g = m.bgpAdv, it = lang !== "en", id = bgpNextId(g.nodes, "n"), n = bgpBlankNode(id);
  const fgs = (g.nodes || []).filter(x => !x.ext), hub = fgs.find(x => x.rr) || fgs[0];
  const used = new Set(fgs.map(x => String(x.as).trim()));
  let as = 65001; while (used.has(String(as))) as++;
  n.name = (it ? "Sede " : "Site ") + ((g.nodes || []).length + 1);
  const rids = new Set((g.nodes || []).map(x => String(x.rid || "").trim()));
  for (let k = 1; k < 255; k++) if (!rids.has("10.255.0." + k)) { n.rid = "10.255.0." + k; break; }
  n.as = g.autoLink === "hub" && hub ? hub.as : (g.autoLink === "mesh" && fgs.length && fgs.every(x => x.as === fgs[0].as) ? fgs[0].as : String(as));
  g.nodes.push(n);
  const link = (a, ibgpHub) => { const l = Object.assign(bgpBlankLink(bgpNextId(g.links, "l")), { a, b: id, ipsec: true }); if (ibgpHub) l.aNhs = true; g.links.push(l); };
  if (g.autoLink === "hub" && hub) link(hub.id, String(hub.as) === String(n.as));
  if (g.autoLink === "mesh") fgs.forEach(x => link(x.id, false));
  bgpNormalize(m);
  return id;
}

/* schemi di partenza */
function bgpTemplate(m, tpl, lang) {
  const it = lang !== "en", N = bgpBlankNode, Lk = bgpBlankLink;
  const g = { on: true, tpl, multipath: false, gr: false, keepalive: "", holdtime: "", pool: "169.254.100.0/24", autoLink: "hub", nodes: [], links: [], pls: [], rms: [] };
  const siteIpsec = m.scenario === "s2s" || m.scenario === "s2sdyn";
  if (tpl === "ipsec" && siteIpsec) {
    const dyn = m.scenario === "s2sdyn";
    g.nodes.push(Object.assign(N("n1"), { ipsec: "a", as: dyn ? "65000" : "65001", rid: "10.255.0.1", rr: dyn }));
    g.nodes.push(Object.assign(N("n2"), { ipsec: "b", as: dyn ? "65000" : "65002", rid: "10.255.0.2" }));
    g.links.push(Object.assign(Lk("l1"), { src: "ipsec1", a: "n1", b: "n2" }));
    if (m.scenario === "s2s" && m.dual.on) { g.links.push(Object.assign(Lk("l2"), { src: "ipsec2", a: "n1", b: "n2" })); g.multipath = true; }
    if (!dyn) g.autoLink = "mesh";
  } else if (tpl === "hub" || tpl === "ipsec") {
    g.tpl = "hub";
    g.nodes.push(Object.assign(N("n1"), { name: "Hub", as: "65000", rid: "10.255.0.1", rr: true, nets: "10.1.0.0/24", pubIp: "192.0.2.10" }));
    [1, 2, 3].forEach(i => {
      g.nodes.push(Object.assign(N("n" + (i + 1)), { name: (it ? "Filiale " : "Branch ") + i, as: "65000", rid: "10.255.0." + (i + 1), nets: "10.1." + i + ".0/24", pubIp: "192.0.2." + (10 + i) }));
      g.links.push(Object.assign(Lk("l" + i), { a: "n1", b: "n" + (i + 1), ipsec: true, aIf: "VPN_F" + i, aIp: "169.254.100." + (4 * i - 3), bIf: "VPN_HUB", bIp: "169.254.100." + (4 * i - 2), aNhs: true }));
    });
  } else if (tpl === "isp") {
    g.nodes.push(Object.assign(N("n1"), { name: (m.a && m.a.label) || (it ? "Sede" : "Office"), as: "64511", rid: "10.255.0.1", nets: "203.0.113.0/24" }));
    g.nodes.push(Object.assign(N("n2"), { name: "Provider", as: "64500", ext: true }));
    g.links.push(Object.assign(Lk("l1"), { a: "n1", b: "n2", kind: "phys", aIf: "wan1", aIp: "198.51.100.2", bIp: "198.51.100.1", aPlIn: "PL_ISP_IN", aPlOut: "PL_ISP_OUT", aMax: "10" }));
    g.pls.push({ name: "PL_ISP_IN", rules: "permit 0.0.0.0/0" }, { name: "PL_ISP_OUT", rules: "permit 203.0.113.0/24" });
  } else if (tpl === "primbak") {
    const bound = m.scenario === "s2s" && m.dual.on;
    g.autoLink = "mesh";
    g.nodes.push(Object.assign(N("n1"), bound ? { ipsec: "a" } : { name: it ? "Sede X" : "Site X", nets: "10.2.1.0/24", pubIp: "192.0.2.21" }, { as: "65001", rid: "10.255.0.1" }));
    g.nodes.push(Object.assign(N("n2"), bound ? { ipsec: "b" } : { name: it ? "Sede Y" : "Site Y", nets: "10.2.2.0/24", pubIp: "192.0.2.22" }, { as: "65002", rid: "10.255.0.2" }));
    const l1 = Object.assign(Lk("l1"), { a: "n1", b: "n2", aRmIn: "RM_PRIMARY", bRmIn: "RM_PRIMARY" });
    const l2 = Object.assign(Lk("l2"), { a: "n1", b: "n2", aRmOut: "RM_BACKUP", bRmOut: "RM_BACKUP" });
    if (bound) { l1.src = "ipsec1"; l2.src = "ipsec2"; }
    else { Object.assign(l1, { ipsec: true, aIf: "VPN_PRI", aIp: "169.254.100.1", bIf: "VPN_PRI", bIp: "169.254.100.2" });
      Object.assign(l2, { ipsec: true, aIf: "VPN_BAK", aIp: "169.254.100.5", bIf: "VPN_BAK", bIp: "169.254.100.6", aWan: "wan2", bWan: "wan2", aGw: "192.0.2.122", bGw: "192.0.2.121" }); }
    g.links.push(l1, l2);
    g.rms.push({ name: "RM_PRIMARY", rules: "permit local-pref 200" }, { name: "RM_BACKUP", rules: "permit prepend 3" });
  }
  return g;
}

/* sessione con i dati presi dai tunnel IPsec quando è collegata */
function bgpLinkRes(m, l) {
  const r = Object.assign({}, l);
  if (l.src) {
    const site = m.scenario === "s2s" || m.scenario === "s2sdyn";
    const ta = site ? tunnelsFor(m, "a") : [], tb = site ? tunnelsFor(m, "b") : [], k = l.src === "ipsec2" ? 1 : 0;
    if (ta[k] && tb[k]) Object.assign(r, { kind: "tunnel", aIf: ta[k].name, aIp: ta[k].tip, bIf: tb[k].name, bIp: tb[k].tip,
      dyn: m.scenario === "s2sdyn", range: m.scenario === "s2sdyn" ? m.bgp.overlay : "" });
    else r.missing = true;
  }
  if (r.kind !== "tunnel") r.dyn = false;
  if (bgpGenLink(l)) {
    r.gen = true; r.dyn = false;
    const A = bgpNode(m, l.a), B = bgpNode(m, l.b);
    if (A && B) {
      const hs = linkDial(m, l);
      if (hs === "both") r.bothDyn = true;
      else if (hs) {
        const x = hs === "b" ? bgpSwap(r) : r, hub = bgpNode(m, x.a), i = +x.aw || 1, j = +x.bw || 1, go = grpObj(hub, i, j), o = hubOverlay(go);
        Object.assign(x, { dyn: true, range: go.overlay, aIf: grpName(hub, i, j), aIp: go.dialIp, overlay: o, grp: i + "_" + j, grpP: grpPath(m, hub, i, j), netId: hubNetId(m, hub, i, j) });
        return x;
      }
    }
  }
  return r;
}
function bgpSessions(m, nid, withMem) {
  const out = [];
  ((m.bgpAdv && m.bgpAdv.links) || []).forEach((l0, i) => {
    if (l0.agg === "mem" && !withMem) return;  // membro di un aggregato: solo IPsec, il BGP gira sull'aggregato
    const l = bgpLinkRes(m, l0);
    if (l.a !== nid && l.b !== nid) return;
    const me = l.a === nid ? "a" : "b", ot = me === "a" ? "b" : "a";
    const self = bgpNode(m, nid), peer = bgpNode(m, l[ot]);
    if (!self || !peer || l.a === l.b) return;
    out.push({ i, l, l0, me, ot, self, peer, loop: !!l.loop, peerIp: l.loop ? peer.loIp : l[ot + "Ip"],
      ibgp: String(self.as).trim() !== "" && String(self.as).trim() === String(peer.as).trim(),
      dynHub: !!l.dyn && me === "a", dynSpoke: !!l.dyn && me === "b", pol: k => l[me + k] });
  });
  return out;
}

/* prefix-list: «permit 10.0.0.0/8 le 24», «deny any» */
function parsePL(txt) {
  const rules = [], bad = [];
  String(txt || "").split(/\n+/).map(x => x.trim()).filter(Boolean).forEach(line => {
    const t = line.split(/\s+/), r = { line, action: (t[0] || "").toLowerCase(), any: false, ge: "", le: "" };
    if (!["permit", "deny"].includes(r.action) || !t[1]) { bad.push(line); return; }
    if (t[1].toLowerCase() === "any") r.any = true;
    else { const n = parseNets(t[1]).out[0]; if (!n || !t[1].includes("/")) { bad.push(line); return; } Object.assign(r, { net: n.net, mask: n.mask, p: n.p, start: n.start, end: n.end, aligned: n.aligned }); }
    let ok = true;
    for (let i = 2; i < t.length; i += 2) {
      const k = t[i].toLowerCase(), v = t[i + 1];
      if (!["ge", "le"].includes(k) || !/^\d+$/.test(v || "") || +v > 32) { ok = false; break; }
      r[k] = String(+v);
    }
    if (!ok || r.any && (r.ge || r.le)) { bad.push(line); return; }
    rules.push(r);
  });
  return { rules, bad };
}
function plPermits(rules, n) {
  for (const r of rules) {
    let hit;
    if (r.any) hit = true;
    else {
      const inside = n.start >= r.start && n.end <= r.end;
      const lo = r.ge ? +r.ge : r.p, hi = r.le ? +r.le : (r.ge ? 32 : r.p);
      hit = inside && n.p >= lo && n.p <= hi;
    }
    if (hit) return r.action === "permit";
  }
  return false;
}
/* route-map: «permit match PL_LAN local-pref 200 med 50 prepend 2 community 65001:100 additive» */
function parseRM(txt) {
  const rules = [], bad = [];
  String(txt || "").split(/\n+/).map(x => x.trim()).filter(Boolean).forEach(line => {
    const t = line.split(/\s+/), r = { line, action: (t[0] || "").toLowerCase(), match: "", lp: "", med: "", prepend: 0, comm: [], additive: false };
    if (!["permit", "deny"].includes(r.action)) { bad.push(line); return; }
    let ok = true;
    for (let i = 1; i < t.length && ok; i++) {
      const k = t[i].toLowerCase(), v = t[i + 1];
      if (k === "additive") { r.additive = true; continue; }
      if (v === undefined) { ok = false; break; }
      if (k === "match") { if (!objNameOk(v)) ok = false; else r.match = v; }
      else if (k === "local-pref") { if (!/^\d+$/.test(v) || +v > 4294967295) ok = false; else r.lp = String(+v); }
      else if (k === "med") { if (!/^\d+$/.test(v) || +v > 4294967295) ok = false; else r.med = String(+v); }
      else if (k === "prepend") { if (!/^\d+$/.test(v) || +v < 1 || +v > 10) ok = false; else r.prepend = +v; }
      else if (k === "community") { const cs = v.split(","); if (!cs.every(c => /^\d{1,5}:\d{1,5}$/.test(c) || ["no-export", "no-advertise", "local-as", "internet"].includes(c))) ok = false; else r.comm.push(...cs); }
      else ok = false;
      i++;
    }
    if (!ok) { bad.push(line); return; }
    rules.push(r);
  });
  return { rules, bad };
}
/* quante reti del nodo superano i filtri in uscita della sessione */
function bgpOutPass(m, s, nets) {
  const g = m.bgpAdv, plName = String(s.pol("PlOut") || "").trim(), rmName = String(s.pol("RmOut") || "").trim();
  const pl = plName ? (g.pls || []).find(p => p.name === plName) : null, rm = rmName ? (g.rms || []).find(r => r.name === rmName) : null;
  return nets.filter(n => {
    if (pl && !plPermits(parsePL(pl.rules).rules, n)) return false;
    if (rm) {
      for (const r of parseRM(rm.rules).rules) {
        let hit = true;
        if (r.match) { const p = (g.pls || []).find(x => x.name === r.match); hit = !!p && plPermits(parsePL(p.rules).rules, n); }
        if (hit) return r.action === "permit";
      }
      return false;
    }
    return true;
  });
}
const dynGroupName = k => (String(k) + "_peers").slice(0, 35);
/* scorciatoie ADVPN: solo hub e spoke, tunnel dial-up sull'hub e iBGP (con eBGP il next hop diventa l'hub e le scorciatoie non servono) */
const advpnOn = m => m.scenario === "ms" && !!m.bgpAdv.advpn && m.bgpAdv.topo === "hub" && m.bgpAdv.hubMode === "dial" && m.bgpAdv.bgpType === "ibgp" && !sdwanOn(m);

/* tunnel IPsec generati dalle sessioni di un nodo */
function genBgpIpsec(m, n, ses, sec) {
  const gen = ses.filter(s => s.l.gen && !s.l.bothDyn && s.l.agg !== "pair"); if (!gen.length) return [];
  const dpdInt = m.scenario === "ms" ? String(m.bgpAdv.dpdInt || "").trim() : "";
  const P1 = [], P2 = [], IF = [], psk = sec && sec.psk ? q(sec.psk) : "<PSK>";
  const cr = s => (s.l.cOwn && s.l.c) ? s.l.c : m.crypto;
  const p1c = (c, I) => {
    const x = [I + "set ike-version " + c.ike];
    if (c.ike === "1") x.push(I + "set mode " + c.mode);
    x.push(I + "set peertype any", I + "set proposal " + (c.p1.length ? c.p1.join(" ") : phL("proposte")), I + "set dhgrp " + (c.dh1.length ? c.dh1.join(" ") : phL("gruppi-dh")));
    if (String(c.life1 || "").trim()) x.push(I + "set keylife " + String(c.life1).trim());
    x.push(I + "set dpd on-idle");
    if (/^\d+$/.test(dpdInt)) x.push(I + "set dpd-retryinterval " + dpdInt);
    return x;
  };
  const p2c = (c, I) => {
    const x = [I + "set proposal " + (c.p2.length ? c.p2.join(" ") : phL("proposte"))];
    if (c.pfs === "enable") x.push(I + "set dhgrp " + (c.dh2.length ? c.dh2.join(" ") : phL("gruppi-dh"))); else x.push(I + "set pfs disable");
    if (String(c.life2 || "").trim()) x.push(I + "set keylifeseconds " + String(c.life2).trim());
    return x;
  };
  // hub dial-up: un tunnel per hub, condiviso dagli spoke a IP dinamico
  const hubGroups = {};
  gen.filter(s => s.dynHub).forEach(s => { (hubGroups[s.l.aIf] = hubGroups[s.l.aIf] || []).push(s); });
  Object.keys(hubGroups).forEach(name => {
    const s = hubGroups[name][0], c = cr(s), o = s.l.overlay, nid = s.l.netId && c.ike === "2" ? ["        set network-overlay enable", "        set network-id " + s.l.netId] : [];
    P1.push("    edit " + q(name), "        set type dynamic", "        set interface " + q(ph(s.l.aWan || nodeWan(m, n, s.l.aw), "wan")), ...p1c(c, "        "), ...nid,
      "        set net-device disable", "        set add-route disable", ...(advpnOn(m) ? ["        set auto-discovery-sender enable"] : []), "        set psksecret " + psk, "    next");
    P2.push("    edit " + q(name), "        set phase1name " + q(name), ...p2c(c, "        "), "    next");
    if (o && isIp(s.l.aIp)) IF.push("    edit " + q(name), "        set ip " + s.l.aIp + " 255.255.255.255", "        set remote-ip " + o.bogus + " " + o.mask, "        set allowaccess ping", "    next");
  });
  // tunnel punto-punto e spoke verso l'hub
  gen.filter(s => !s.dynHub).forEach(s => {
    const c = cr(s), name = ph(s.l[s.me + "If"], "tunnel"), gw = String(s.l[s.me + "Gw"] || "").trim() || nodeGw(m, s.peer, s.l[s.ot + "w"]);
    const P = ["    edit " + q(name), "        set type " + (isIp(gw) || !gw ? "static" : "ddns"), "        set interface " + q(ph(String(s.l[s.me + "Wan"] || "").trim() || nodeWan(m, n, s.l[s.me + "w"]), "wan")), ...p1c(c, "        ")];
    if (s.l.agg === "mem") P.push("        set net-device disable", "        set aggregate-member enable");
    if (isIp(gw) || !gw) P.push("        set remote-gw " + ph(gw, "ip-remoto")); else P.push("        set remotegw-ddns " + q(gw));
    if (s.dynSpoke) {
      if (s.l.netId && c.ike === "2") P.push("        set network-overlay enable", "        set network-id " + s.l.netId);
      if (advpnOn(m)) P.push("        set net-device enable", "        set add-route disable");
      P.push("        set auto-discovery-receiver enable");
    }
    P.push("        set psksecret " + psk, "    next");
    P1.push(...P);
    P2.push("    edit " + q(name), "        set phase1name " + q(name), ...p2c(c, "        "), "        set auto-negotiate enable", "        set keepalive enable", "    next");
    const me = s.l[s.me + "Ip"], ot = s.l[s.ot + "Ip"];
    if (isIp(me) && isIp(ot)) {
      const mask = s.dynSpoke && s.l.overlay ? s.l.overlay.mask : maskOf(p2pLen(m));
      IF.push("    edit " + q(name), "        set ip " + me + " 255.255.255.255", "        set remote-ip " + ot + " " + mask, "        set allowaccess ping", "    next");
    }
  });
  const L = ["config vpn ipsec phase1-interface", ...P1, "end", "", "config vpn ipsec phase2-interface", ...P2, "end", ""];
  if (IF.length) L.push("config system interface", ...IF, "end", "");
  return L;
}

/* SD-WAN della sede: indirizzi, zona, membri, health-check e regole (pre) e firewall policy sulla zona (post) */
/* oggetti address per le reti delle sedi: NET_<sede> e NET_VPN_REMOTE (le altre sedi) */
function msAddrObjs(m, n) {
  const on = x => String(x || "").normalize("NFD").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "site";
  const sites = msSites(m), others = sites.filter(x => x !== n), nets = x => parseNets(x.nets).out;
  const grpN = x => ("NET_" + on(nodeName(m, x))).slice(0, 72), adN = (x, k) => grpN(x) + "_" + (k + 1);
  const lines = [], withNets = sites.filter(x => nets(x).length), remote = others.filter(x => nets(x).length);
  if (withNets.length) {
    lines.push("config firewall address");
    withNets.forEach(x => nets(x).forEach((nt, k) => lines.push("    edit " + q(adN(x, k)), "        set subnet " + nt.net + " " + nt.mask, "        set comment " + q("Fortissimo · " + nodeName(m, x)), "    next")));
    lines.push("end", "", "config firewall addrgrp");
    withNets.forEach(x => lines.push("    edit " + q(grpN(x)), "        set member " + nets(x).map((nt, k) => q(adN(x, k))).join(" "), "    next"));
    if (remote.length) lines.push("    edit " + q("NET_VPN_REMOTE"), "        set member " + remote.map(x => q(grpN(x))).join(" "), "    next");
    lines.push("end", "");
  }
  return { lines, on, sites, nets, grpN, remote };
}
function genMsSdwan(m, n, ses) {
  const g = m.bgpAdv, sw = g.sdwan, zone = String(sw.zone || "").trim() || "VPN", base = +String(sw.base || "").trim() || 100, hub = msHub(m);
  const AD = msAddrObjs(m, n), { on, sites, nets, grpN, remote } = AD;
  const pre = [...AD.lines], post = [];
  // membri: un tunnel per riga; il tunnel dial-up dell'hub è un solo membro per tutti gli spoke
  const mem = [];
  ses.filter(s => s.l.gen && !s.l.bothDyn).forEach(s => {
    const name = s.dynHub ? s.l.aIf : s.l[s.me + "If"]; if (!name) return;
    const cost = (+wanOf(m, n, s.l[s.me + "w"]).cost || 0) + (s.dynHub ? 0 : (+wanOf(m, s.peer, s.l[s.ot + "w"]).cost || 0));
    let x = mem.find(y => y.name === name);
    if (!x) { x = { name, seq: base + mem.length, cost, peers: new Set() }; mem.push(x); }
    if (!s.dynHub) x.peers.add(s.peer.id);
  });
  if (!mem.length) return { pre, post };
  pre.push("config system sdwan", "    set status enable", "    config zone", "        edit " + q(zone), "        next", "    end", "    config members");
  mem.forEach(x => pre.push("        edit " + x.seq, "            set interface " + q(x.name), "            set zone " + q(zone), "            set cost " + x.cost, "        next"));
  pre.push("    end");
  // health-check verso la loopback dell'altra sede, solo sui tunnel dedicati a quella sede
  const targets = [];
  sites.forEach(p => { if (p === n || !(g.topo === "mesh" || p === hub)) return; const ms = mem.filter(x => x.peers.has(p.id)); if (ms.length && isIp(p.loIp)) targets.push({ p, ms }); });
  if (targets.length) {
    pre.push("    config health-check");
    targets.forEach(({ p, ms }) => pre.push("        edit " + q(("HC_" + on(nodeName(m, p))).slice(0, 35)), "            set server " + q(p.loIp.trim()), "            set protocol ping",
      "            set members " + ms.map(x => x.seq).join(" "), "            config sla", "                edit 1", "                    set latency-threshold " + (String(sw.lat).trim() || "150"),
      "                    set jitter-threshold " + (String(sw.jit).trim() || "30"), "                    set packetloss-threshold " + (String(sw.loss).trim() || "2"), "                next", "            end", "        next"));
    pre.push("    end");
    const rules = targets.map(({ p, ms }) => ({ p, ms, dst: hub && p === hub ? (remote.length ? "NET_VPN_REMOTE" : "") : (nets(p).length ? grpN(p) : "") })).filter(r => r.dst);
    if (rules.length) {
      pre.push("    config service");
      rules.forEach(({ p, ms, dst }, k) => {
        pre.push("        edit " + (base + k), "            set name " + q(("VPN_" + on(nodeName(m, p))).slice(0, 35)), "            set mode sla", "            set dst " + q(dst));
        if (nets(n).length) pre.push("            set src " + q(grpN(n)));
        pre.push("            config sla", "                edit " + q(("HC_" + on(nodeName(m, p))).slice(0, 35)), "                    set id 1", "                next", "            end",
          "            set priority-members " + ms.slice().sort((a, b) => a.cost - b.cost || a.seq - b.seq).map(x => x.seq).join(" "), "        next");
      });
      pre.push("    end");
    }
  }
  pre.push("end", "");
  // firewall policy sulla zona
  if (sw.pol) {
    const P = [], pol = (name, si, di, sa, da, svc) => P.push("    edit 0", "        set name " + q(name.slice(0, 35)), "        set srcintf " + q(si), "        set dstintf " + q(di),
      "        set srcaddr " + q(sa), "        set dstaddr " + q(da), "        set action accept", '        set schedule "always"', "        set service " + svc.map(q).join(" "), "    next");
    const lan = String(n.lanIf || "").trim() || phL("interfaccia-lan");
    if (nets(n).length && remote.length) { pol("LAN_to_" + zone, lan, zone, grpN(n), "NET_VPN_REMOTE", ["ALL"]); pol(zone + "_to_LAN", zone, lan, "NET_VPN_REMOTE", grpN(n), ["ALL"]); }
    if (remote.length && (n === hub || (g.topo === "mesh" && g.bgpType === "ebgp"))) pol(zone + "_to_" + zone, zone, zone, "NET_VPN_REMOTE", "NET_VPN_REMOTE", ["ALL"]);
    if ((g.topo === "mesh" || n === hub) && isIp(n.loIp)) pol(zone + "_HC", zone, ph(n.loName, "loopback"), "all", "all", ["PING"]);
    if (P.length) post.push("config firewall policy", ...P, "end", "");
  }
  return { pre, post };
}

/* aggregato IPsec della sede: un'interfaccia per ogni altra sede con i tunnel delle coppie di linee, IP sull'aggregato, zona con intrazone allow */
function genMsAgg(m, n, all) {
  const g = m.bgpAdv, sw = g.sdwan, zone = String(sw.zone || "").trim() || "VPN";
  const pre = [], post = [], AD = msAddrObjs(m, n), { nets, grpN, remote } = AD;
  if (sw.pol) pre.push(...AD.lines);
  const pairs = all.filter(s => s.l.agg === "pair" && s.l[s.me + "If"]), mems = all.filter(s => s.l.agg === "mem" && s.l[s.me + "If"]);
  const AG = [], IF = [];
  pairs.forEach(s => {
    const name = s.l[s.me + "If"];
    // membri in ordine di costo (somma delle due linee), poi di linea: con «redundant» il primo porta il traffico
    // a parità di costo vale l'ordine dei tunnel, uguale sulle due sedi
    const ms = mems.filter(x => x.peer.id === s.peer.id).map(x => ({ name: x.l[x.me + "If"], i: x.i,
      cost: (+wanOf(m, n, x.l[x.me + "w"]).cost || 0) + (+wanOf(m, x.peer, x.l[x.ot + "w"]).cost || 0) })).sort((x, y) => x.cost - y.cost || x.i - y.i);
    AG.push("    edit " + q(name), "        set member " + (ms.length ? ms.map(x => q(x.name)).join(" ") : phL("tunnel")), "        set algorithm " + (sw.alg || "L4"), "    next");
    const me = s.l[s.me + "Ip"], ot = s.l[s.ot + "Ip"];
    if (isIp(me) && isIp(ot)) IF.push("    edit " + q(name), "        set ip " + me + " 255.255.255.255", "        set remote-ip " + ot + " " + maskOf(p2pLen(m)), "        set allowaccess ping", "    next");
  });
  if (AG.length) pre.push("config system ipsec-aggregate", ...AG, "end", "");
  if (IF.length) pre.push("config system interface", ...IF, "end", "");
  if (pairs.length) pre.push("config system zone", "    edit " + q(zone), "        set intrazone allow", "        set interface " + pairs.map(s => q(s.l[s.me + "If"])).join(" "), "    next", "end", "");
  // firewall policy sulla zona: il transito tra aggregati lo permette intrazone allow
  if (sw.pol && nets(n).length && remote.length) {
    const lan = String(n.lanIf || "").trim() || phL("interfaccia-lan"), P = [];
    const pol = (name, si, di, sa, da) => P.push("    edit 0", "        set name " + q(name.slice(0, 35)), "        set srcintf " + q(si), "        set dstintf " + q(di),
      "        set srcaddr " + q(sa), "        set dstaddr " + q(da), "        set action accept", '        set schedule "always"', '        set service "ALL"', "    next");
    pol("LAN_to_" + zone, lan, zone, grpN(n), "NET_VPN_REMOTE"); pol(zone + "_to_LAN", zone, lan, "NET_VPN_REMOTE", grpN(n));
    post.push("config firewall policy", ...P, "end", "");
  }
  return { pre, post };
}

/* configurazione BGP di un nodo */
function genBgpNode(m, nid, sec) {
  const n = bgpNode(m, nid); if (!n || n.ext) return "";
  const g = m.bgpAdv, all = bgpSessions(m, nid, true), ses = all.filter(s => s.l.agg !== "mem"), L = [];
  const loName = ph(n.loName, "loopback");
  L.push(...genBgpIpsec(m, n, all, sec));
  if (ses.some(s => s.loop) || String(n.loIp).trim())
    L.push("config system interface", "    edit " + q(loName), '        set vdom "root"', "        set type loopback",
      "        set ip " + ph(n.loIp, "ip-loopback") + " 255.255.255.255", "        set allowaccess ping", "    next", "end", "");
  const bfdIf = [...new Set(ses.filter(s => s.l.bfd).map(s => String(s.l[s.me + "If"] || "").trim()).filter(Boolean))];
  if (bfdIf.length) L.push("config system interface", ...bfdIf.flatMap(x => ["    edit " + q(x), "        set bfd enable", "    next"]), "end", "");
  const lr = [];
  ses.filter(s => s.loop).forEach(s => {
    lr.push("    edit 0", "        set dst " + ph(s.peer.loIp, "ip-loopback-peer") + " 255.255.255.255");
    if (s.l.kind === "phys") lr.push("        set gateway " + ph(s.l[s.ot + "Ip"], "ip-remoto"));
    lr.push("        set device " + q(ph(s.l[s.me + "If"], "interfaccia")), "        set comment " + q("BGP loopback " + nodeName(m, s.peer)), "    next");
  });
  if (m.scenario === "ms" && m.route.bh) msSites(m).filter(x => x !== n).forEach(x => parseNets(x.nets).out.forEach(net => {
    lr.push("    edit 0", "        set dst " + net.net + " " + net.mask, "        set blackhole enable", "        set distance " + (String(m.route.bhDistance || "").trim() || "254"),
      "        set comment " + q("Blackhole " + nodeName(m, x)), "    next");
  }));
  if (lr.length) L.push("config router static", ...lr, "end", "");
  // oggetti di policy usati da questo nodo
  const rmNames = new Set(), plNames = new Set();
  ses.forEach(s => {
    ["RmIn", "RmOut"].forEach(k => { const v = String(s.pol(k) || "").trim(); if (v) rmNames.add(v); });
    ["PlIn", "PlOut"].forEach(k => { const v = String(s.pol(k) || "").trim(); if (v) plNames.add(v); });
  });
  if (String(n.redisRm || "").trim() && (n.redisConn || n.redisStatic)) rmNames.add(n.redisRm.trim());
  const rmObjs = (g.rms || []).filter(r => rmNames.has(r.name));
  rmObjs.forEach(r => parseRM(r.rules).rules.forEach(x => { if (x.match) plNames.add(x.match); }));
  const plObjs = (g.pls || []).filter(p => plNames.has(p.name));
  if (plObjs.length) {
    L.push("config router prefix-list");
    plObjs.forEach(p => {
      L.push("    edit " + q(p.name), "        config rule");
      parsePL(p.rules).rules.forEach((r, i) => {
        L.push("            edit " + (i + 1), "                set action " + r.action, "                set prefix " + (r.any ? "0.0.0.0 0.0.0.0" : r.net + " " + r.mask));
        if (r.any) L.push("                set le 32");
        if (r.ge) L.push("                set ge " + r.ge);
        if (r.le) L.push("                set le " + r.le);
        L.push("            next");
      });
      L.push("        end", "    next");
    });
    L.push("end", "");
  }
  if (rmObjs.length) {
    L.push("config router route-map");
    rmObjs.forEach(r => {
      L.push("    edit " + q(r.name), "        config rule");
      parseRM(r.rules).rules.forEach((x, i) => {
        L.push("            edit " + (i + 1), "                set action " + x.action);
        if (x.match) L.push("                set match-ip-address " + q(x.match));
        if (x.action === "permit") {
          if (x.lp !== "") L.push("                set set-local-preference " + x.lp);
          if (x.med !== "") L.push("                set set-metric " + x.med);
          if (x.prepend) L.push("                set set-aspath " + q(Array(x.prepend).fill(ph(n.as, "as-locale")).join(" ")));
          if (x.comm.length) { L.push("                set set-community " + x.comm.map(q).join(" ")); if (x.additive) L.push("                set set-community-additive enable"); }
        }
        L.push("            next");
      });
      L.push("        end", "    next");
    });
    L.push("end", "");
  }
  const SW = sdwanOn(m) ? (aggOn(m) ? genMsAgg(m, n, all) : genMsSdwan(m, n, ses)) : { pre: [], post: [] };
  L.push(...SW.pre);
  // router bgp
  const B = ["config router bgp", "    set as " + ph(n.as, "as-locale")];
  if (String(n.rid).trim()) B.push("    set router-id " + n.rid.trim());
  if (String(g.keepalive).trim()) B.push("    set keepalive-timer " + g.keepalive.trim());
  if (String(g.holdtime).trim()) B.push("    set holdtime-timer " + g.holdtime.trim());
  if (g.multipath || (sdwanOn(m) && !aggOn(m))) { if (ses.some(s => s.ibgp)) B.push("    set ibgp-multipath enable"); if (ses.some(s => !s.ibgp)) B.push("    set ebgp-multipath enable"); }
  if (g.gr) B.push("    set graceful-restart enable");
  const nbLines = (s, ind) => {
    const I = " ".repeat(ind), x = [I + "set remote-as " + ph(s.peer.as, "as-remoto")];
    if (s.loop) { x.push(I + "set update-source " + q(loName)); if (!s.ibgp) x.push(I + "set ebgp-enforce-multihop enable"); }
    const rrc = n.rr && s.ibgp && !s.peer.rr;
    if (rrc) x.push(I + "set route-reflector-client enable");
    if (s.pol("Nhs")) x.push(I + (rrc ? "set next-hop-self-rr enable" : "set next-hop-self enable"));
    x.push(I + "set soft-reconfiguration enable");
    if (!s.loop) x.push(I + "set link-down-failover enable");
    if (s.l.bfd) x.push(I + "set bfd enable");
    if (g.gr) x.push(I + "set capability-graceful-restart enable");
    if (s.pol("Def")) x.push(I + "set capability-default-originate enable");
    [["PlIn", "prefix-list-in"], ["PlOut", "prefix-list-out"], ["RmIn", "route-map-in"], ["RmOut", "route-map-out"]].forEach(([k, c]) => {
      const v = String(s.pol(k) || "").trim(); if (v) x.push(I + "set " + c + " " + q(v)); });
    const mx = String(s.pol("Max") || "").trim(); if (mx) x.push(I + "set maximum-prefix " + mx);
    if (sec && sec.bgp && !s.peer.ext) x.push(I + "set password " + q(sec.bgp));
    return x;
  };
  const isRange = s => s.dynHub && !s.l.gen;
  const nb = ses.filter(s => !isRange(s));
  if (nb.length) {
    B.push("    config neighbor");
    nb.forEach(s => B.push("        edit " + q(ph(s.peerIp, "ip-peer")), "            set description " + q(nodeName(m, s.peer)), ...nbLines(s, 12), "        next"));
    B.push("    end");
  }
  const dyn = ses.filter(isRange);
  if (dyn.length) {
    const groups = {}; dyn.forEach(s => { const k = String(s.l.aIf || "").trim() || "dyn"; (groups[k] = groups[k] || []).push(s); });
    B.push("    config neighbor-group");
    Object.keys(groups).forEach(k => B.push("        edit " + q(dynGroupName(k)), ...nbLines(groups[k][0], 12), "        next"));
    B.push("    end", "    config neighbor-range");
    Object.keys(groups).forEach((k, i) => {
      const r = parseNets(groups[k][0].l.range).out[0];
      B.push("        edit " + (i + 1), "            set prefix " + (r ? r.net + " " + r.mask : phL("rete-overlay")), "            set neighbor-group " + q(dynGroupName(k)), "        next");
    });
    B.push("    end");
  }
  const own = parseNets(nodeNets(m, n)).out;
  if (own.length) {
    B.push("    config network");
    own.forEach((x, i) => B.push("        edit " + (i + 1), "            set prefix " + x.net + " " + x.mask, "        next"));
    B.push("    end");
  }
  [["redisConn", "connected"], ["redisStatic", "static"]].forEach(([k, c]) => {
    if (!n[k]) return;
    B.push("    config redistribute " + q(c), "        set status enable");
    if (String(n.redisRm || "").trim()) B.push("        set route-map " + q(n.redisRm.trim()));
    B.push("    end");
  });
  B.push("end");
  L.push(...B);
  if (SW.post.length) L.push("", ...SW.post.slice(0, -1));
  return L.join("\n");
}

/* verifiche incrociate tra i nodi */
function bgpAdvChecks(m, sec, it, add) {
  const t = (a, b) => it ? a : b, g = m.bgpAdv, nodes = g.nodes || [], links = g.links || [];
  const NP = (i, k) => "bgpAdv.nodes." + i + "." + k, LP = (i, k) => "bgpAdv.links." + i + "." + k;
  const idx = n => nodes.indexOf(n);
  const fgs = nodes.filter(n => !n.ext), ms = m.scenario === "ms";
  if (ms) msChecks(m, sec, it, add);
  else if (fgs.length < 1 || !links.length) add("err", t("Il modulo BGP avanzato non ha ancora sessioni: parti da uno schema o aggiungi nodi e sessioni.", "The advanced BGP module has no sessions yet: start from a template or add nodes and sessions."), null);
  const names = {}, rids = {};
  nodes.forEach((n, i) => {
    const nm = nodeName(m, n);
    if (names[nm]) add("err", (ms ? t("Due sedi si chiamano ", "Two sites are called ") : t("Due nodi si chiamano ", "Two nodes are called ")) + nm + ".", NP(i, "name")); names[nm] = 1;
    if (!asValid(n.as)) add("err", t("AS non valido per ", "Invalid AS for ") + nm + " (1–4294967295).", NP(i, "as"));
    if (n.ext) return;
    const r = String(n.rid || "").trim();
    if (r && !isIp(r)) add("err", t("Router ID non valido: ", "Invalid router ID: ") + r, NP(i, "rid"));
    else if (r && rids[r]) add("err", t("Router ID ", "Router ID ") + r + t(" usato da due nodi: deve essere unico.", " used by two nodes: it must be unique."), NP(i, "rid"));
    if (r) rids[r] = 1;
    if (String(n.loIp || "").trim() && !isIp(n.loIp)) add("err", t("IP della loopback non valido: ", "Invalid loopback IP: ") + n.loIp, NP(i, "loIp"));
    if (String(n.loName || "").length > 15) add("err", t("Il nome della loopback supera 15 caratteri.", "The loopback name exceeds 15 characters."), NP(i, "loName"));
    const pn = parseNets(nodeNets(m, n));
    pn.bad.forEach(x => add("err", t("Rete non valida su ", "Invalid network on ") + nm + ": " + x, NP(i, "nets")));
    if ((n.redisConn || n.redisStatic) && !String(n.redisRm || "").trim()) add("warn", t("Su ", "On ") + nm + t(" la ridistribuzione senza route-map annuncia tutte le reti connesse o statiche, comprese WAN e management.", " redistribution without a route-map announces every connected or static network, WAN and management included."), NP(i, "redisRm"));
    if (String(n.redisRm || "").trim() && !(g.rms || []).some(x => x.name === n.redisRm.trim())) add("err", t("La route-map ", "Route-map ") + n.redisRm + t(" non esiste.", " does not exist."), NP(i, "redisRm"));
    if (!bgpSessions(m, n.id).length) add("warn", nm + t(" non ha sessioni BGP.", " has no BGP session."), NP(i, "name"));
  });
  if (fgs.some(n => parseNets(nodeNets(m, n)).out.length)) add("info", t("Le reti in config network vengono annunciate solo se sono nella tabella di routing del FortiGate (network-import-check, attivo di fabbrica).", "Networks under config network are announced only if they are in the FortiGate routing table (network-import-check, on by default)."), null);
  const peerSeen = {}, gwSeen = {}, tunNames = {};
  const addTun = (nid, nm, i, side) => { if (!nm) return; const k = nid + "|" + nm; if (tunNames[k] && !(tunNames[k] === "dial" && side === "dial")) add("err", t("Due tunnel con lo stesso nome ", "Two tunnels with the same name ") + nm + t(" sullo stesso FortiGate.", " on the same FortiGate."), "bgpAdv.links." + i + "." + side + "If"); tunNames[k] = side; };
  (nodes || []).forEach(n => { if (n.ipsec && m[n.ipsec] && (m.scenario === "s2s" || m.scenario === "s2sdyn")) tunnelsFor(m, n.ipsec).forEach(tn => { tunNames[n.id + "|" + tn.name] = "ipsec"; }); });
  links.forEach((l0, i) => {
    const l = bgpLinkRes(m, l0), A = bgpNode(m, l.a), B = bgpNode(m, l.b);
    const no = t("Sessione ", "Session ") + (i + 1);
    if (!A || !B) { add("err", no + t(": scegli i due nodi.", ": pick both nodes."), LP(i, A ? "b" : "a")); return; }
    if (l.a === l.b) { add("err", no + t(": i due lati sono lo stesso nodo.", ": both ends are the same node."), LP(i, "b")); return; }
    if (A.ext && B.ext) { add("err", no + t(": almeno un lato deve essere un FortiGate.", ": at least one end must be a FortiGate."), LP(i, "a")); return; }
    const lab = nodeName(m, A) + " ⇄ " + nodeName(m, B), ibgp = String(A.as).trim() === String(B.as).trim();
    if (l.missing) { add("err", no + t(" usa il secondo tunnel IPsec, ma la doppia WAN è spenta.", " uses the second IPsec tunnel, but dual WAN is off."), "dual.on"); return; }
    if (l.gen) {
      const oi = s => l.swapped ? (s === "a" ? "b" : "a") : s;  // lato del modello salvato
      if (l.bothDyn) add("err", lab + t(": entrambi i FortiGate hanno IP dinamico, quindi nessuno dei due può chiamare l’altro. Almeno uno deve avere un IP pubblico o un FQDN.", ": both FortiGates have a dynamic IP, so neither can call the other. At least one needs a public IP or an FQDN."), NP(idx(B), "dyn"));
      [["a", A, B], ["b", B, A]].forEach(([s, me, peer]) => {
        if (me.ext) return;
        if (l.dyn && s === "a") { addTun(me.id, l.aIf, i, "dial"); tunNames[me.id + "|" + l.aIf] = "dial"; return; }
        const nm = String(l[s + "If"] || "").trim();
        if (nm.length > 15) add("err", (ms && g.names === "code" ? nodeName(m, me) + ": " + nm + t(" supera 15 caratteri, il massimo per un’interfaccia del FortiGate: accorcia i codici della sede o delle linee, oppure scrivi il nome a mano.", " exceeds 15 characters, the maximum for a FortiGate interface: shorten the site or line codes, or type the name by hand.")
          : no + t(": il nome del tunnel supera 15 caratteri.", ": the tunnel name exceeds 15 characters.")), LP(i, oi(s) + "If"));
        addTun(me.id, nm, i, oi(s));
        if (l.agg === "pair") return;  // l'aggregato non ha gateway né WAN: li hanno i suoi membri
        const gw = String(l[s + "Gw"] || "").trim() || nodeGw(m, peer, l[(s === "a" ? "b" : "a") + "w"]);
        if (!gw && ms) { /* segnalato una volta per sede in msChecks */ }
        else if (!gw) add("err", nodeName(m, me) + t(": per il tunnel verso ", ": the tunnel to ") + nodeName(m, peer) + t(" manca l’IP pubblico o l’FQDN di ", " needs the public IP or FQDN of ") + nodeName(m, peer) + ".", peer.ipsec ? peer.ipsec + ".ip" : NP(idx(peer), "pubIp"));
        else if ((/^[\d.]+$/.test(gw) && !isIp(gw)) || !/^[A-Za-z0-9.-]+$/.test(gw)) add("err", t("Indirizzo o FQDN non valido: ", "Invalid address or FQDN: ") + gw, String(l[s + "Gw"] || "").trim() ? LP(i, oi(s) + "Gw") : NP(idx(peer), "pubIp"));
        const wan = String(l[s + "Wan"] || "").trim() || nodeWan(m, me, l[s + "w"]);
        if (!wan && !ms) add("err", nodeName(m, me) + t(": manca l’interfaccia WAN.", ": WAN interface missing."), me.ipsec ? me.ipsec + ".wan" : NP(idx(me), "wan"));
        const k = me.id + "|" + wan + "|" + gw;
        if (gw && wan && gwSeen[k]) add("err", nodeName(m, me) + t(" ha due tunnel verso ", " has two tunnels to ") + gw + t(" sulla stessa WAN ", " on the same WAN ") + wan + t(": usa un’altra WAN o un altro gateway per il secondo.", ": use another WAN or gateway for the second."), LP(i, oi(s) + "Wan"));
        gwSeen[k] = 1;
      });
      if (l.dyn) {
        const hub = A, GP = k => (l.grpP || NP(idx(hub), "")) + k;
        if (!l.overlay) add("err", nodeName(m, hub) + " (" + l.aIf + ")" + t(": la rete degli spoke dinamici non è valida, usa un CIDR da /24 a /30.", ": the dynamic spoke network is invalid, use a /24 to /30 CIDR."), GP("overlay"));
        else if (!isIp(l.aIp) || ipInt(l.aIp) <= l.overlay.start || ipInt(l.aIp) >= l.overlay.end - 1) add("err", nodeName(m, hub) + t(": l’IP dell’hub deve essere un indirizzo utilizzabile della rete degli spoke.", ": the hub IP must be a usable address of the spoke network."), GP("dialIp"));
      } else if (isIp(l.aIp) && isIp(l.bIp) && Math.floor(ipInt(l.aIp) / (p2pLen(m) === 31 ? 2 : 4)) !== Math.floor(ipInt(l.bIp) / (p2pLen(m) === 31 ? 2 : 4))) add("warn", lab + t(": i due IP del tunnel non stanno nella stessa /", ": the two tunnel IPs are not in the same /") + p2pLen(m) + ".", LP(i, "bIp"));
      else if (isIp(l.aIp) && isIp(l.bIp) && p2pLen(m) === 30 && [l.aIp, l.bIp].some(x => ipInt(x) % 4 === 0 || ipInt(x) % 4 === 3)) add("err", lab + t(": in una /30 il primo e l’ultimo indirizzo non si usano (rete e broadcast): scegli il secondo e il terzo, ad esempio .1 e .2.", ": in a /30 the first and last addresses cannot be used (network and broadcast): pick the second and third, for example .1 and .2."), LP(i, (ipInt(l.aIp) % 4 === 0 || ipInt(l.aIp) % 4 === 3) ? oi("a") + "Ip" : oi("b") + "Ip"));
      if (l.cOwn && l.c && (!l.c.p1.length || !l.c.dh1.length || !l.c.p2.length || (l.c.pfs === "enable" && !l.c.dh2.length))) add("err", lab + t(": la crittografia dedicata del tunnel è incompleta.", ": the tunnel’s own cryptography is incomplete."), LP(i, "c.p1"));
    }
    if (l.src) {
      const pa = l.src === "ipsec2" ? "dual.aTip" : "a.tip", pb = l.src === "ipsec2" ? "dual.bTip" : "b.tip";
      if (!isIp(l.aIp)) add("err", t("Serve l’IP del tunnel per il BGP", "The tunnel IP is needed for BGP") + " (" + nodeName(m, A) + ").", pa);
      if (!isIp(l.bIp)) add("err", t("Serve l’IP del tunnel per il BGP", "The tunnel IP is needed for BGP") + " (" + nodeName(m, B) + ").", pb);
      if (m.scenario === "s2sdyn") {
        const ov = overlayInfo(m);
        if (!ov) add("err", t("Rete overlay non valida: usa un CIDR da /24 a /30, ad esempio 169.254.20.0/24.", "Invalid overlay network: use a /24 to /30 CIDR, for example 169.254.20.0/24."), "bgp.overlay");
        else [[l.aIp, "a.tip"], [l.bIp, "b.tip"]].forEach(([ip, p]) => { if (isIp(ip) && (ipInt(ip) <= ov.start || ipInt(ip) >= ov.end - 1)) add("err", ip + t(" non è un indirizzo utilizzabile della rete overlay.", " is not a usable overlay address."), p); });
      }
    } else if (!l.gen) {
      [["a", A], ["b", B]].forEach(([s, N]) => {
        if (!N.ext && !String(l[s + "If"] || "").trim()) add("err", no + t(": manca l’interfaccia su ", ": interface missing on ") + nodeName(m, N) + ".", LP(i, s + "If"));
        if (String(l[s + "If"] || "").length > 15) add("err", no + t(": il nome dell’interfaccia supera 15 caratteri.", ": the interface name exceeds 15 characters."), LP(i, s + "If"));
        const ip = String(l[s + "Ip"] || "").trim();
        if (ip && !isIp(ip)) add("err", t("Indirizzo non valido: ", "Invalid address: ") + ip, LP(i, s + "Ip"));
        else if (!ip && (!l.loop || l.kind === "phys")) add("err", no + t(": manca l’IP di ", ": IP missing for ") + nodeName(m, N) + t(" sul collegamento.", " on the link."), LP(i, s + "Ip"));
      });
      if (l.dyn) {
        const r = parseNets(l.range).out[0];
        if (!r || r.p > 30) add("err", no + t(": indica la rete da cui l’hub accetta gli spoke, ad esempio 169.254.20.0/24.", ": set the network the hub accepts spokes from, for example 169.254.20.0/24."), LP(i, "range"));
        else if (isIp(l.bIp) && (ipInt(l.bIp) < r.start || ipInt(l.bIp) > r.end)) add("err", l.bIp + t(" non è dentro la rete degli spoke ", " is not inside the spoke network ") + l.range + ".", LP(i, "bIp"));
        if (A.ext || B.ext) add("err", no + t(": il neighbor-range serve tra FortiGate.", ": neighbor-range is meant between FortiGates."), LP(i, "dyn"));
      }
    }
    if (l.loop) {
      [A, B].forEach(N => { if (!N.ext && !isIp(N.loIp)) add("err", t("La sessione sulle loopback richiede l’IP della loopback su ", "The loopback session needs the loopback IP on ") + nodeName(m, N) + ".", NP(idx(N), "loIp")); });
      if (A.ext || B.ext) add("err", no + t(": in questo modulo le sessioni sulle loopback sono solo tra FortiGate.", ": in this module loopback sessions are only between FortiGates."), LP(i, "loop"));
      if (l.dyn) add("err", no + t(": il neighbor-range non si combina con le loopback in questo modulo.", ": neighbor-range cannot be combined with loopbacks in this module."), LP(i, "loop"));
      add("info", lab + t(": sulle loopback il FortiGate genera la rotta verso la loopback del peer, ma serve anche una firewall policy che faccia entrare il BGP (TCP 179) dall’interfaccia della sessione verso la loopback.", ": over loopbacks the FortiGate gets the route to the peer loopback, but a firewall policy letting BGP (TCP 179) in from the session interface to the loopback is also needed."), LP(i, "loop"));
    }
    // vicini duplicati sullo stesso nodo
    [["a", A, B], ["b", B, A]].forEach(([s, me, peer]) => {
      if (me.ext || (l.dyn && s === "a")) return;
      const ip = l.loop ? peer.loIp : l[(s === "a" ? "b" : "a") + "Ip"]; if (!isIp(ip)) return;
      const k = me.id + "|" + ip; if (peerSeen[k]) add("err", nodeName(m, me) + t(" ha due sessioni verso ", " has two sessions to ") + ip + t(": il vicino sarebbe configurato due volte.", ": the neighbor would be configured twice."), LP(i, "a")); peerSeen[k] = 1;
    });
    // riferimenti e filtri
    [["a", A, B], ["b", B, A]].forEach(([s, me, peer]) => {
      if (me.ext) return;
      [["RmIn", "rms"], ["RmOut", "rms"], ["PlIn", "pls"], ["PlOut", "pls"]].forEach(([k, coll]) => {
        const v = String(l[s + k] || "").trim();
        if (v && !(g[coll] || []).some(x => x.name === v)) add("err", (coll === "rms" ? "Route-map " : "Prefix-list ") + v + t(" non esiste.", " does not exist."), LP(i, s + k));
      });
      const mx = String(l[s + "Max"] || "").trim();
      if (mx && !(/^\d+$/.test(mx) && +mx >= 1 && +mx <= 4294967295)) add("err", t("maximum-prefix fuori intervallo (1–4294967295).", "maximum-prefix out of range (1–4294967295)."), LP(i, s + "Max"));
      const ses = bgpSessions(m, me.id).find(x => x.i === i);
      const own = parseNets(nodeNets(m, me)).out;
      if (ses && own.length && (String(l[s + "PlOut"] || "").trim() || String(l[s + "RmOut"] || "").trim()) && !bgpOutPass(m, ses, own).length)
        add("warn", nodeName(m, me) + t(": i filtri in uscita verso ", ": the outbound filters to ") + nodeName(m, peer) + t(" non lasciano passare nessuna delle sue reti.", " let none of its networks through."), LP(i, s + (String(l[s + "PlOut"] || "").trim() ? "PlOut" : "RmOut")));
      if (peer.ext) {
        if (!String(l[s + "PlOut"] || "").trim() && !String(l[s + "RmOut"] || "").trim()) add("warn", nodeName(m, me) + t(": nessun filtro in uscita verso ", ": no outbound filter to ") + nodeName(m, peer) + t(". Senza filtro annunci tutte le rotte BGP del FortiGate, comprese quelle imparate da altri vicini.", ". Without one you announce every BGP route of the FortiGate, including those learned from other neighbors."), LP(i, s + "PlOut"));
        if (!String(l[s + "PlIn"] || "").trim() && !String(l[s + "RmIn"] || "").trim()) add("warn", nodeName(m, me) + t(": nessun filtro in ingresso da ", ": no inbound filter from ") + nodeName(m, peer) + t(": accetti qualsiasi rotta ti venga annunciata.", ": you accept any route announced to you."), LP(i, s + "PlIn"));
        if (!mx) add("warn", nodeName(m, me) + t(": senza maximum-prefix verso ", ": without maximum-prefix toward ") + nodeName(m, peer) + t(" un errore del peer può riempire la tabella di routing.", " a peer mistake can flood the routing table."), LP(i, s + "Max"));
        if (l[s + "Def"]) add("warn", nodeName(m, me) + t(" annuncia la rotta di default a ", " announces the default route to ") + nodeName(m, peer) + t(": verso un peer esterno di solito è un errore.", ": toward an external peer this is usually a mistake."), LP(i, s + "Def"));
        if (asValid(me.as) && asValid(peer.as) && isPrivAs(me.as) && !isPrivAs(peer.as)) add("warn", t("L’AS ", "AS ") + me.as + t(" di ", " of ") + nodeName(m, me) + t(" è privato e il peer ha un AS pubblico: concorda con il provider che lo tolga (remove-private-as) prima di annunciare le tue reti, oppure usa un AS pubblico.", " is private and the peer has a public AS: agree with the provider that it strips it (remove-private-as) before announcing your networks, or use a public AS."), NP(idx(me), "as"));
      }
    });
    if (l.bfd) add("info", lab + t(": il BFD si attiva sul vicino e sull’interfaccia; l’altro lato deve averlo attivo.", ": BFD is enabled on the neighbor and on the interface; the other end must have it on too."), null);
  });
  // neighbor-range: un solo AS remoto per gruppo
  fgs.forEach(n => {
    const groups = {};
    bgpSessions(m, n.id).filter(s => s.dynHub && !s.l.gen).forEach(s => { const k = String(s.l.aIf || "").trim() || "dyn"; (groups[k] = groups[k] || []).push(s); });
    Object.keys(groups).forEach(k => { const ases = [...new Set(groups[k].map(s => String(s.peer.as).trim()))]; if (ases.length > 1) add("err", nodeName(m, n) + t(": gli spoke accettati sull’interfaccia ", ": the spokes accepted on interface ") + k + t(" hanno AS diversi, ma un neighbor-group ha un solo remote-as.", " have different ASes, but a neighbor-group has a single remote-as."), "bgpAdv.links." + groups[k][1].i + ".a"); });
  });
  // iBGP: full mesh o route reflector
  const byAs = {};
  fgs.forEach(n => { const a = String(n.as).trim(); if (a) (byAs[a] = byAs[a] || []).push(n); });
  Object.keys(byAs).forEach(a => {
    const grp = byAs[a]; if (grp.length < 3 || grp.some(n => n.rr)) return;
    const missing = [];
    grp.forEach((x, i) => grp.slice(i + 1).forEach(y => { if (!bgpSessions(m, x.id).some(s => s.peer.id === y.id)) missing.push(nodeName(m, x) + " ⇄ " + nodeName(m, y)); }));
    if (missing.length) add("warn", t("Nell’AS ", "In AS ") + a + t(" i nodi iBGP non sono in full mesh e manca un route reflector: le rotte imparate da un vicino iBGP non passano agli altri. Mancano: ", " the iBGP nodes are not fully meshed and there is no route reflector: routes learned from an iBGP neighbor are not passed to the others. Missing: ") + missing.join(", ") + ".", null);
  });
  // route reflector e next-hop degli spoke
  fgs.filter(n => n.rr).forEach(n => {
    const cl = bgpSessions(m, n.id).filter(s => s.ibgp && !s.peer.rr && !s.loop && !s.pol("Nhs") && !s.dynHub);
    if (cl.length >= 2) add("warn", nodeName(m, n) + t(" riflette le rotte tra client su reti di tunnel separate: i client ricevono il next-hop dell’altro client, che non sanno raggiungere. Attiva next-hop-self sul route reflector o usa una rete overlay comune.", " reflects routes between clients over separate tunnel networks: clients receive the other client’s next-hop, which they cannot reach. Turn on next-hop-self on the route reflector or use a shared overlay network."), "bgpAdv.links." + cl[0].i + ".aNhs");
  });
  // oggetti di policy
  const seenObj = {};
  (g.pls || []).forEach((p, i) => {
    if (!objNameOk(p.name)) add("err", t("Nome della prefix-list non valido: lettere, numeri, punto, trattino o trattino basso, al massimo 35.", "Invalid prefix-list name: letters, digits, dot, dash or underscore, 35 at most."), "bgpAdv.pls." + i + ".name");
    if (seenObj["pl" + p.name]) add("err", t("Due prefix-list si chiamano ", "Two prefix-lists are called ") + p.name + ".", "bgpAdv.pls." + i + ".name"); seenObj["pl" + p.name] = 1;
    const r = parsePL(p.rules);
    r.bad.forEach(x => add("err", "Prefix-list " + (p.name || i + 1) + t(": riga non valida «", ": invalid line «") + x + t("». Esempi: permit 10.0.0.0/8 le 24, deny any.", "». Examples: permit 10.0.0.0/8 le 24, deny any."), "bgpAdv.pls." + i + ".rules"));
    if (!r.rules.length && !r.bad.length) add("err", "Prefix-list " + (p.name || i + 1) + t(" è vuota.", " is empty."), "bgpAdv.pls." + i + ".rules");
    else if (r.rules.length && r.rules.every(x => x.action === "deny")) add("warn", "Prefix-list " + p.name + t(" contiene solo regole deny: alla fine c’è un deny implicito, quindi non passa nessun prefisso.", " has only deny rules: an implicit deny follows, so no prefix passes."), "bgpAdv.pls." + i + ".rules");
    r.rules.filter(x => !x.any && !x.aligned).forEach(x => add("warn", x.line + t(": l’indirizzo non è un indirizzo di rete, uso ", ": the address is not a network address, using ") + x.net + "/" + x.p + ".", "bgpAdv.pls." + i + ".rules"));
    r.rules.filter(x => x.ge && x.le && +x.ge > +x.le).forEach(x => add("err", x.line + t(": ge è maggiore di le.", ": ge is greater than le."), "bgpAdv.pls." + i + ".rules"));
  });
  (g.rms || []).forEach((rm, i) => {
    if (!objNameOk(rm.name)) add("err", t("Nome della route-map non valido: lettere, numeri, punto, trattino o trattino basso, al massimo 35.", "Invalid route-map name: letters, digits, dot, dash or underscore, 35 at most."), "bgpAdv.rms." + i + ".name");
    if (seenObj["rm" + rm.name]) add("err", t("Due route-map si chiamano ", "Two route-maps are called ") + rm.name + ".", "bgpAdv.rms." + i + ".name"); seenObj["rm" + rm.name] = 1;
    const r = parseRM(rm.rules);
    r.bad.forEach(x => add("err", "Route-map " + (rm.name || i + 1) + t(": riga non valida «", ": invalid line «") + x + t("». Esempio: permit match PL_LAN local-pref 200.", "». Example: permit match PL_LAN local-pref 200."), "bgpAdv.rms." + i + ".rules"));
    if (!r.rules.length && !r.bad.length) add("err", "Route-map " + (rm.name || i + 1) + t(" è vuota.", " is empty."), "bgpAdv.rms." + i + ".rules");
    else if (r.rules.length && r.rules.every(x => x.action === "deny")) add("warn", "Route-map " + rm.name + t(" contiene solo regole deny: non lascia passare nessun prefisso.", " has only deny rules: it lets no prefix through."), "bgpAdv.rms." + i + ".rules");
    r.rules.forEach(x => {
      if (x.match && !(g.pls || []).some(p => p.name === x.match)) add("err", "Route-map " + rm.name + t(": la prefix-list ", ": prefix-list ") + x.match + t(" non esiste.", " does not exist."), "bgpAdv.rms." + i + ".rules");
      if (x.action === "deny" && (x.lp || x.med || x.prepend || x.comm.length)) add("warn", "Route-map " + rm.name + t(": in una regola deny i valori set vengono ignorati.", ": set values are ignored in a deny rule."), "bgpAdv.rms." + i + ".rules");
    });
    if (r.rules.length && r.rules.every(x => x.match) && r.rules.every(x => x.action === "permit")) add("info", "Route-map " + rm.name + t(": i prefissi che non corrispondono a nessuna regola vengono scartati. Aggiungi «permit» in fondo per lasciar passare il resto.", ": prefixes matching no rule are dropped. Add «permit» at the end to let the rest through."), "bgpAdv.rms." + i + ".rules");
  });
  [["keepalive", 0, 65535], ["holdtime", 3, 65535]].forEach(([k, lo, hi]) => { const v = String(g[k] || "").trim(); if (v && !(/^\d+$/.test(v) && +v >= lo && +v <= hi)) add("err", t("Timer BGP fuori intervallo.", "BGP timer out of range."), "bgpAdv." + k); });
  if (String(g.keepalive).trim() && String(g.holdtime).trim() && +g.holdtime < 3 * +g.keepalive) add("warn", t("L’holdtime di solito è almeno il triplo del keepalive.", "Holdtime is usually at least three times the keepalive."), "bgpAdv.holdtime");
  if (links.some(l => l.src) && m.route.on) add("info", t("Sui tunnel IPsec che portano il BGP le rotte statiche non vengono generate; le blackhole restano.", "On IPsec tunnels carrying BGP no static routes are generated; blackholes stay."), "route.on");
  const anyGen = links.some(l => bgpGenLink(l));
  if (ms) return;
  if (anyGen && !(sec && sec.psk)) add("warn", t("I tunnel generati dal modulo BGP usano un’unica PSK: inseriscila o generala, altrimenti nella CLI resta <PSK>.", "The tunnels generated by the BGP module use a single PSK: enter or generate it, otherwise the CLI keeps <PSK>."), "psk");
  if (anyGen) add("info", t("Per i tunnel generati Fortissimo non crea firewall policy né rotte blackhole: aggiungile per ogni tunnel.", "For generated tunnels Fortissimo creates no firewall policies or blackhole routes: add them for each tunnel."), null);
  add("info", t("Il modulo BGP genera una scheda per ogni FortiGate: incollala dopo la configurazione IPsec. Le firewall policy non sono incluse.", "The BGP module makes one tab per FortiGate: paste it after the IPsec configuration. Firewall policies are not included."), null);
}

/* verifiche dell'SD-WAN con più linee */
function msSdwanChecks(m, sec, it, add) {
  const t = (a, b) => it ? a : b, g = m.bgpAdv, sw = g.sdwan, sites = msSites(m), hub = msHub(m);
  const res = (g.links || []).map(l => bgpLinkRes(m, l)).filter(l => l.gen && !l.bothDyn);
  const pairs = hub ? sites.filter(n => n !== hub).map(n => [hub, n]) : sites.flatMap((x, i) => sites.slice(i + 1).map(y => [x, y]));
  const agg = aggOn(m);
  pairs.forEach(([A, B]) => { if (!res.some(l => (l.a === A.id && l.b === B.id) || (l.a === B.id && l.b === A.id)))
    add("err", nodeName(m, A) + " ⇄ " + nodeName(m, B) + t(": nessun tunnel. Tutte le coppie di linee sono escluse o impossibili (", ": no tunnel. Every line pair is excluded or impossible (") +
      (agg ? t("con l’aggregato una linea con IP dinamico, ", "with the aggregate a dynamic-IP line, ") : t("due IP dinamici, ", "two dynamic IPs, ")) + t("una linea privata con una linea internet, linee private su reti diverse).", "a private line with an Internet line, private lines on different networks)."), "msPairs"); });
  if (res.some(l => l.netId) && m.crypto.ike !== "2") add("err", t("Più tunnel dial-up sulla stessa linea dell’hub si distinguono con il network-id, che esiste solo con IKEv2.", "Several dial-up tunnels on the same hub line are told apart by network-id, which exists only with IKEv2."), "crypto.ike");
  if (res.some(l => l.netId)) add("info", t("Sull’hub più tunnel dial-up condividono la stessa linea: Fortissimo li distingue con network-overlay e network-id, uguali sull’hub e sulla filiale. Se sulla stessa WAN c’è già un altro dial-up IKEv2, controlla che i network-id non coincidano.", "On the hub several dial-up tunnels share the same line: Fortissimo tells them apart with network-overlay and network-id, the same on hub and branch. If the same WAN already has another IKEv2 dial-up, check that the network-ids do not clash."), null);
  const zone = String(sw.zone || "").trim();
  if (!objNameOk(zone)) add("err", (agg ? t("Nome della zona non valido", "Invalid zone name") : t("Nome della zona SD-WAN non valido", "Invalid SD-WAN zone name")) + t(": lettere, numeri, punto, trattino o trattino basso, al massimo 35.", ": letters, digits, dot, dash or underscore, 35 at most."), "bgpAdv.sdwan.zone");
  else if (["virtual-wan-link", "sdwan"].includes(zone)) add("warn", t("La zona ", "Zone ") + zone + t(" è quella predefinita delle linee Internet: usa una zona dedicata ai tunnel.", " is the default zone of the Internet lines: use a zone dedicated to the tunnels."), "bgpAdv.sdwan.zone");
  if (agg) { msAggChecks(m, sec, it, add); return; }
  [["lat", 1, 10000, t("latenza", "latency")], ["jit", 1, 10000, "jitter"], ["loss", 0, 100, t("perdita", "packet loss")]].forEach(([k, lo, hi, nm]) => {
    const v = String(sw[k] || "").trim(); if (!(/^\d+$/.test(v) && +v >= lo && +v <= hi)) add("err", t("Soglia SLA di ", "SLA threshold for ") + nm + t(" fuori intervallo (", " out of range (") + lo + "–" + hi + ").", "bgpAdv.sdwan." + k); });
  const base = String(sw.base || "").trim();
  if (!(/^\d+$/.test(base) && +base >= 1 && +base <= 400)) add("err", t("Il primo numero per membri e regole SD-WAN deve stare tra 1 e 400.", "The first number for SD-WAN members and rules must be between 1 and 400."), "bgpAdv.sdwan.base");
  if (sw.pol) sites.forEach(n => { if (!String(n.lanIf || "").trim()) add("err", nodeName(m, n) + t(": serve l’interfaccia LAN per le firewall policy.", ": the LAN interface is needed for the firewall policies."), "bgpAdv.nodes." + g.nodes.indexOf(n) + ".lanIf"); });
  sites.forEach(n => { const tg = g.topo === "mesh" || n === hub; if (tg && !isIp(n.loIp)) add("err", nodeName(m, n) + t(": serve l’IP della loopback, che le altre sedi usano come bersaglio dell’health-check.", ": the loopback IP is needed; the other sites use it as health-check target."), "bgpAdv.nodes." + g.nodes.indexOf(n) + ".loIp"); });
  add("info", t("I tunnel diventano membri della zona SD-WAN ", "The tunnels become members of SD-WAN zone ") + (zone || "VPN") + t(": nelle rotte e nelle firewall policy si usa la zona, non il singolo tunnel. Membri e regole partono dal numero ", ": routes and firewall policies use the zone, not the single tunnel. Members and rules start from number ") + (base || "100") + t(": se il FortiGate usa già l’SD-WAN, controlla che siano liberi.", ": if the FortiGate already uses SD-WAN, check they are free."), "bgpAdv.sdwan.base");
  add("info", t("Il BGP gira su ogni tunnel e il multipath installa tutti i percorsi: le regole SD-WAN possono usare un tunnel solo se la tabella di routing ha una rotta verso la destinazione attraverso quel tunnel.", "BGP runs over every tunnel and multipath installs every path: SD-WAN rules can use a tunnel only if the routing table has a route to the destination through it."), null);
}

/* verifiche dell'aggregato IPsec */
function msAggChecks(m, sec, it, add) {
  const t = (a, b) => it ? a : b, g = m.bgpAdv, sw = g.sdwan, sites = msSites(m), zone = String(sw.zone || "").trim() || "VPN";
  if (!["L3", "L4", "round-robin", "redundant"].includes(sw.alg)) add("err", t("Algoritmo dell’aggregato non valido.", "Invalid aggregate algorithm."), "bgpAdv.sdwan.alg");
  if (sw.pol) sites.forEach(n => { if (!String(n.lanIf || "").trim()) add("err", nodeName(m, n) + t(": serve l’interfaccia LAN per le firewall policy.", ": the LAN interface is needed for the firewall policies."), "bgpAdv.nodes." + g.nodes.indexOf(n) + ".lanIf"); });
  const res = (g.links || []).map(l => bgpLinkRes(m, l));
  res.filter(l => l.agg === "pair").forEach(p => { const k = res.filter(l => l.agg === "mem" && ((l.a === p.a && l.b === p.b) || (l.a === p.b && l.b === p.a))).length;
    if (k === 1) add("info", nodeName(m, bgpNode(m, p.a)) + " ⇄ " + nodeName(m, bgpNode(m, p.b)) + t(": l’aggregato ha un solo tunnel, quindi non bilancia né fa da riserva finché non aggiungi un’altra coppia di linee.", ": the aggregate has a single tunnel, so it neither balances nor backs up until you add another line pair."), "msPairs"); });
  add("info", t("Per ogni coppia di sedi Fortissimo crea un aggregato IPsec (config system ipsec-aggregate) con i tunnel delle coppie di linee in ordine di costo. L’IP e la sessione BGP stanno sull’aggregato; i tunnel membri hanno net-device disable e aggregate-member enable e non hanno IP. Gli aggregati entrano nella zona ", "For each site pair Fortissimo creates an IPsec aggregate (config system ipsec-aggregate) holding the line-pair tunnels in cost order. The IP and the BGP session sit on the aggregate; the member tunnels have net-device disable and aggregate-member enable and no IP. The aggregates join zone ") + zone + t(" con intrazone allow, così il transito tra due sedi passa senza policy.", " with intrazone allow, so transit between two sites passes without a policy."), "bgpAdv.sdwan.mode");
  add("info", sw.alg === "redundant" ? t("Algoritmo redundant: tutto il traffico va sul primo tunnel attivo della lista, quello con il costo più basso; gli altri restano di riserva.", "Redundant algorithm: all traffic uses the first live tunnel of the list, the one with the lowest cost; the others stay as backup.")
    : sw.alg === "round-robin" ? t("Algoritmo round-robin: i pacchetti vanno a turno su tutti i tunnel. Con linee di latenza molto diversa (fibra e satellite) i pacchetti di una connessione possono arrivare in disordine: in quel caso preferisci L4.", "Round-robin algorithm: packets take every tunnel in turn. With lines of very different latency (fibre and satellite) a connection’s packets may arrive out of order: prefer L4 then.")
    : t("Algoritmo ", "Algorithm ") + sw.alg + t(": il traffico si distribuisce su tutti i tunnel attivi, anche su quelli lenti o a consumo come LTE e satellite. Se una linea deve fare solo da riserva, toglila dalle coppie o usa l’algoritmo redundant.", ": traffic is spread over every live tunnel, slow or metered ones such as LTE and satellite included. If a line must be a backup only, drop it from the pairs or use the redundant algorithm."), "bgpAdv.sdwan.alg");
  if (!String(g.dpdInt || "").trim()) add("info", t("Un tunnel esce dall’aggregato quando il DPD lo dà per caduto: con l’intervallo predefinito (20 s) può volerci più di un minuto. Imposta l’intervallo DPD nella sezione IPsec, ad esempio 2–5 s, per un failover più rapido.", "A tunnel leaves the aggregate when DPD declares it dead: with the default interval (20 s) this can take over a minute. Set the DPD interval in the IPsec section, for example 2–5 s, for a faster failover."), "bgpAdv.dpdInt");
  const ka = String(g.keepalive || "").trim(), ho = String(g.holdtime || "").trim();
  add(ka && ho && +ho <= 60 ? "info" : "warn", t("Da FortiOS 7.0.1 l’interfaccia dell’aggregato resta sempre up, anche quando tutti i suoi tunnel sono caduti: il BGP se ne accorge solo allo scadere dell’holdtime, che di fabbrica è 180 s. ", "From FortiOS 7.0.1 the aggregate interface always stays up, even when all its tunnels are down: BGP notices only when the holdtime expires, 180 s by default. ") +
    (ka && ho && +ho <= 60 ? t("Con holdtime ", "With holdtime ") + ho + t(" s il traffico passa a un’altra strada entro quel tempo.", " s traffic moves to another path within that time.") : t("Imposta timer più brevi nella sezione BGP, ad esempio keepalive 10 e holdtime 30.", "Set shorter timers in the BGP section, for example keepalive 10 and holdtime 30.")), ka && ho ? "bgpAdv.holdtime" : "bgpAdv.keepalive");
  add("info", t("Il bilanciamento dell’aggregato non guarda la qualità della linea: un tunnel attivo che perde pacchetti resta nel gruppo finché il DPD risponde. Se ti servono soglie di latenza e perdita, usa la zona SD-WAN.", "The aggregate’s balancing ignores line quality: a tunnel that is up but losing packets stays in the group as long as DPD answers. If you need latency and loss thresholds, use the SD-WAN zone."), null);
}

/* verifiche proprie della rete multi-sede */
function msChecks(m, sec, it, add) {
  const t = (a, b) => it ? a : b, g = m.bgpAdv, sites = msSites(m), NP = (n, k) => "bgpAdv.nodes." + g.nodes.indexOf(n) + "." + k;
  if (m._converted) add("info", t("Progetto convertito dal vecchio modulo «BGP avanzato»: la topologia è personalizzata e tunnel e sessioni sono quelli salvati. Controlla sedi e tunnel prima di usarlo.", "Project converted from the old «Advanced BGP» module: the topology is custom and tunnels and sessions are the saved ones. Check sites and tunnels before using it."), "bgpAdv.topo");
  if (sites.length < 2) { add("err", t("Servono almeno due sedi.", "At least two sites are needed."), "msCount"); return; }
  const codes = g.names === "code" && g.topo !== "custom", seenCode = {}, codeOk = x => /^[A-Za-z0-9]{1,8}$/.test(x);
  if (String(g.dpdInt || "").trim() && !(/^\d+$/.test(String(g.dpdInt).trim()) && +g.dpdInt >= 1 && +g.dpdInt <= 3600)) add("err", t("Intervallo DPD fuori intervallo (1–3600 secondi).", "DPD interval out of range (1–3600 seconds)."), "bgpAdv.dpdInt");
  sites.forEach(n => {
    if (!String(n.name || "").trim()) add("err", t("Dai un nome a ogni sede: compare nelle schede, nei commenti e nei nomi dei tunnel.", "Give every site a name: it appears in the tabs, comments and tunnel names."), NP(n, "name"));
    if (codes) {
      const c = String(n.code || "").trim(), ce = siteCode(m, n);
      if (c && !codeOk(c)) add("err", nodeName(m, n) + t(": il codice della sede può avere solo lettere e numeri, al massimo 8.", ": the site code may have only letters and digits, 8 at most."), NP(n, "code"));
      else if (seenCode[ce.toLowerCase()]) add("err", t("Due sedi hanno il codice ", "Two sites have code ") + ce + t(": i nomi dei tunnel si confonderebbero.", ": the tunnel names would clash."), [NP(n, "code"), seenCode[ce.toLowerCase()]]);
      seenCode[ce.toLowerCase()] = NP(n, "code");
      if (sdwanOn(m)) siteWans(m, n).forEach(w => {
        if (w.code && !codeOk(w.code)) add("err", nodeName(m, n) + t(": il codice della linea può avere solo lettere e numeri, al massimo 8.", ": the line code may have only letters and digits, 8 at most."), w.p.code);
      });
    }
    const wl = siteWans(m, n), seenIf = {};
    wl.forEach(w => {
      if (!w.if) add("err", nodeName(m, n) + t(": manca l’interfaccia della linea ", ": interface missing for line ") + w.slot + ".", w.p.if);
      else if (w.if.length > 15 || /[\s"]/.test(w.if)) add("err", nodeName(m, n) + t(": nome d’interfaccia non valido: ", ": invalid interface name: ") + w.if, w.p.if);
      else if (seenIf[w.if]) add("err", nodeName(m, n) + t(": due linee usano la stessa interfaccia ", ": two lines use the same interface ") + w.if + ".", [w.p.if, seenIf[w.if]]);
      if (w.if) seenIf[w.if] = w.p.if;
      if (w.addr && ((/^[\d.]+$/.test(w.addr) && !isIp(w.addr)) || !/^[A-Za-z0-9.-]+$/.test(w.addr))) add("err", t("Indirizzo o FQDN non valido: ", "Invalid address or FQDN: ") + w.addr, w.p.addr);
      if (sdwanOn(m) && String(w.cost).trim() && !(/^\d+$/.test(String(w.cost).trim()) && +w.cost <= 4294967295)) add("err", nodeName(m, n) + t(": costo della linea non valido.", ": invalid line cost."), w.p.cost);
      if (sdwanOn(m) && w.type === "mpls" && !w.seg && siteWans(m, n).some(x => x.slot !== w.slot && x.type === "mpls")) add("warn", nodeName(m, n) + t(": più linee private senza il nome della rete. Scrivilo (ad esempio MPLS1 o SAT-MIL): due linee private formano un tunnel solo se sono sulla stessa rete.", ": several private lines without a network name. Type it (for example MPLS1 or SAT-MIL): two private lines form a tunnel only if they are on the same network."), w.p.seg);
      if (aggOn(m) && w.dyn) add("warn", nodeName(m, n) + " (" + (w.if || t("linea ", "line ") + w.slot) + ")" + t(": nell’aggregato IPsec Fortissimo usa solo tunnel statici, quindi una linea con IP dinamico non entra in nessun tunnel. Se ha un nome DDNS (ad esempio FortiDDNS), scrivilo come FQDN e togli la spunta.", ": in the IPsec aggregate Fortissimo uses static tunnels only, so a dynamic-IP line joins no tunnel. If it has a DDNS name (for example FortiDDNS), type it as FQDN and untick the box."), w.p.dyn);
    });
    if (!parseNets(n.nets).out.length && !parseNets(n.nets).bad.length) add("warn", nodeName(m, n) + t(" non ha reti LAN: non annuncia nulla alle altre sedi.", " has no LAN network: it announces nothing to the other sites."), NP(n, "nets"));
    parseNets(n.nets).out.filter(x => !x.aligned).forEach(x => add("warn", x.raw + t(" non è un indirizzo di rete: uso ", " is not a network address: using ") + x.net + "/" + x.p + ".", NP(n, "nets")));
  });
  if (codes && sdwanOn(m)) {
    // un messaggio per sede: i nomi che si ripeterebbero e le linee da cui nascono
    const seenN = {}, clash = new Map();
    (g.links || []).forEach(l => { if (!bgpGenLink(l) || l.agg === "pair") return; ["a", "b"].forEach(s => {
      const o = s === "a" ? "b" : "a", me = bgpNode(m, l[s]), peer = bgpNode(m, l[o]); if (!me || !peer || me.ext) return;
      const wm = wanOf(m, me, l[s + "w"]), wp = wanOf(m, peer, l[o + "w"]), nm = siteCode(m, me) + lineCode(m, me, wm) + "-" + siteCode(m, peer) + lineCode(m, peer, wp), k = me.id + "|" + nm.toLowerCase();
      if (seenN[k] && seenN[k] !== l.id) { const c = clash.get(me) || { names: new Set(), paths: new Set() }; c.names.add(nm); c.paths.add(wm.p.code); clash.set(me, c); }
      seenN[k] = l.id; }); });
    clash.forEach((c, me) => add("err", nodeName(m, me) + t(": più tunnel avrebbero lo stesso nome (", ": several tunnels would get the same name (") + [...c.names].join(", ") + t("). Dai codici diversi alle linee della sede o delle sedi remote.", "). Give different codes to the lines of this site or of the remote sites."), [...c.paths]));
  }
  if (g.ipPlan === "site" && g.topo !== "custom") {
    const pool = parseNets(g.pool).out[0], need = sites.length + 1, minP = 24 - Math.ceil(Math.log2(need));
    if (!pool || pool.p > 24 || Math.floor((pool.end - pool.start + 1) / 256) < need)
      add("err", t("Con gli indirizzi per sede la rete dei tunnel deve contenere una /24 per ogni sede più una per i router ID: con ", "With per-site addressing the tunnel network must hold one /24 per site plus one for the router IDs: with ") + sites.length + t(" sedi serve almeno una /", " sites it needs at least a /") + minP + t(", ad esempio 10.255.0.0/16.", ", for example 10.255.0.0/16."), "bgpAdv.pool");
    else {
      const per = {}; (g.links || []).forEach(l => { if (bgpGenLink(l) && l.agg !== "mem" && !linkDial(m, l)) { const k = [l.a, l.b].sort().join("|"); per[k] = (per[k] || 0) + 1; } });
      const T = Math.max(1, ...Object.values(per)), st = p2pLen(m) === 31 ? 2 : 4;
      if ((sites.length - 1) * T * st > 256) add("warn", t("Con ", "With ") + sites.length + t(" sedi e ", " sites and ") + T + t(" tunnel con IP per coppia di sedi i tunnel non stanno tutti nella /24 della loro sede: quelli in più prendono il primo indirizzo libero. Usa la maschera /31, meno coppie di linee o l’aggregato IPsec.", " tunnels with an IP per site pair the tunnels do not all fit in their site’s /24: the extra ones take the first free address. Use the /31 mask, fewer line pairs or the IPsec aggregate."), "bgpAdv.ipPlan");
      add("info", t("Indirizzi per sede: il tunnel tra la sede i e la sede j (i < j) sta nella /24 numero i della rete ", "Per-site addressing: the tunnel between site i and site j (i < j) sits in /24 number i of network ") + g.pool + t(" e la sede i prende il primo indirizzo; la /24 zero contiene i router ID proposti. Il numero della sede è la sua posizione nella tabella delle sedi.", " and site i takes the first address; /24 zero holds the proposed router IDs. A site’s number is its position in the site table."), "bgpAdv.ipPlan");
    }
  }
  const needAddr = new Map();
  (g.links || []).forEach(l0 => {
    const l = bgpLinkRes(m, l0); if (!l.gen || l.bothDyn || l.agg === "pair") return;
    ["a", "b"].forEach(s => { if (l.dyn && s === "a") return; const o = s === "a" ? "b" : "a", me = bgpNode(m, l[s]), peer = bgpNode(m, l[o]); if (me && peer && !me.ext && !String(l[s + "Gw"] || "").trim()) needAddr.set(peer.id + ":" + (+l[o + "w"] || 1), [peer, +l[o + "w"] || 1]); });
  });
  needAddr.forEach(([n, slot]) => { const w = wanOf(m, n, slot); if (!w.addr) add("err", nodeName(m, n) + (slot > 1 ? " (" + (w.if || t("linea ", "line ") + slot) + ")" : "") + t(": manca l’IP pubblico o l’FQDN, che le altre sedi usano per raggiungerla. Se l’indirizzo cambia, spunta IP dinamico.", ": the public IP or FQDN is missing; the other sites use it to reach this one. If the address changes, tick Dynamic IP."), w.p.addr); });
  (g.links || []).forEach((l0, i) => {
    const l = bgpLinkRes(m, l0); if (!l.gen || l.bothDyn || l.agg === "mem") return;
    const lab = nodeName(m, bgpNode(m, l.a)) + " ⇄ " + nodeName(m, bgpNode(m, l.b)) + (l.agg === "pair" ? t(" (aggregato)", " (aggregate)") : "");
    const sides = l.dyn ? [l.swapped ? "a" : "b"] : ["a", "b"];
    sides.forEach(s => {
      const v = String(l0[s + "Ip"] || "").trim(), P = "bgpAdv.links." + i + "." + s + "Ip";
      if (!v) add("err", lab + t(": manca l’IP del tunnel di ", ": tunnel IP missing for ") + nodeName(m, bgpNode(m, l0[s])) + t(". Scrivilo o usa «Riassegna tutti gli indirizzi».", ". Type it or use «Reassign every address»."), P);
      else if (!isIp(v)) add("err", t("IP del tunnel non valido: ", "Invalid tunnel IP: ") + v, P);
      else if (l.dyn && l.overlay && (ipInt(v) <= l.overlay.start || ipInt(v) >= l.overlay.end - 1)) add("err", lab + ": " + v + t(" non è un indirizzo utilizzabile della rete delle filiali ", " is not a usable address of the branch network ") + (l.range || "") + ".", P);
    });
  });
  const hub = msHub(m);
  if (hub && !aggOn(m)) siteWans(m, hub).forEach(w => { if (w.dyn) add("err", t("L’hub ", "Hub ") + nodeName(m, hub) + (w.slot > 1 ? " (" + (w.if || w.slot) + ")" : "") + t(" deve avere un IP pubblico o un FQDN: sono gli spoke a chiamarlo.", " needs a public IP or an FQDN: the spokes call it."), w.p.dyn); });
  if (sdwanOn(m)) msSdwanChecks(m, sec, it, add);
  if (g.topo === "mesh" && sites.length > 8) add("warn", t("Full mesh con ", "Full mesh with ") + sites.length + t(" sedi: ", " sites: ") + (sites.length * (sites.length - 1) / 2) + t(" tunnel e altrettante sessioni BGP da gestire. Oltre 8 sedi valuta hub e spoke.", " tunnels and as many BGP sessions to manage. Beyond 8 sites consider hub and spoke."), "bgpAdv.topo");
  if (!g.asManual && g.topo !== "custom" && !asValid(g.baseAs)) add("err", t("AS di partenza non valido (1–4294967295).", "Invalid starting AS (1–4294967295)."), "bgpAdv.baseAs");
  if (!m.route.bh) add("warn", t("Senza rotte blackhole, se un tunnel cade il traffico verso quella sede può uscire su Internet.", "Without blackhole routes, traffic to a site can leave over the Internet when its tunnel drops."), "route.bh");
  const bhd = String(m.route.bhDistance || "").trim();
  if (m.route.bh && bhd && !(/^\d+$/.test(bhd) && +bhd >= 1 && +bhd <= 255)) add("err", t("Distanza delle blackhole fuori intervallo (1–255).", "Blackhole distance out of range (1–255)."), "route.bhDistance");
  const dialHubs = [...new Set((g.links || []).map(l => bgpLinkRes(m, l)).filter(l => l.gen && l.dyn).map(l => l.a))];
  if (dialHubs.length) {
    add("info", t("Sugli spoke la phase1 verso l’hub dial-up ha auto-discovery-receiver enable: da FortiOS 7.0.1 l’hub riconosce così ogni spoke dal suo IP di tunnel, che è anche il next hop BGP. In laboratorio controlla con diagnose vpn tunnel list che tun_id sia l’IP del tunnel dello spoke.", "On the spokes the phase1 to the dial-up hub has auto-discovery-receiver enable: from FortiOS 7.0.1 this is how the hub tells each spoke apart by its tunnel IP, which is also the BGP next hop. In the lab check with diagnose vpn tunnel list that tun_id is the spoke tunnel IP."), null);
    add("info", t("Se su ", "If ") + dialHubs.map(id => nodeName(m, bgpNode(m, id))).join(", ") + t(" c’è già un altro tunnel dial-up IKEv2 sulla stessa WAN (ad esempio per FortiClient), i due tunnel vanno distinti con un Network ID.", " already has another IKEv2 dial-up tunnel on the same WAN (for example for FortiClient), the two tunnels must be told apart with a Network ID."), null);
  }
  if (g.advpn && !advpnOn(m)) add("info", t("Le scorciatoie ADVPN richiedono hub e spoke, tunnel dial-up sull’hub e iBGP: con queste scelte non vengono generate.", "ADVPN shortcuts need hub and spoke, a dial-up tunnel on the hub and iBGP: with these choices they are not generated."), "bgpAdv.advpn");
  if (advpnOn(m)) add("info", t("ADVPN: sull’hub serve una firewall policy dal tunnel dial-up verso sé stesso, così il primo pacchetto tra due filiali passa dall’hub e fa partire la scorciatoia.", "ADVPN: the hub needs a firewall policy from the dial-up tunnel to itself, so the first packet between two branches goes through the hub and triggers the shortcut."), "bgpAdv.advpn");
  if (g.topo === "mesh" && g.bgpType === "ibgp") add("info", t("Full mesh in iBGP: ogni sede impara le reti solo dal tunnel diretto. Se un tunnel cade, le due sedi non si raggiungono passando da una terza: con eBGP sì.", "Full mesh in iBGP: each site learns networks only over the direct tunnel. If a tunnel drops, the two sites cannot reach each other through a third one: with eBGP they can."), "bgpAdv.bgpType");
  if (sites.some(n => nodeDyn(m, n)) && g.topo === "mesh" && !aggOn(m)) add("info", t("Le sedi con IP dinamico vengono accettate dalle altre con un tunnel dial-up; tra due sedi con IP dinamico il tunnel non è possibile.", "Sites with a dynamic IP are accepted by the others through a dial-up tunnel; no tunnel is possible between two dynamic-IP sites."), null);
  if (sdwanOn(m) && g.sdwan.pol) add("info", t("Ogni sede ha la sua scheda con tunnel IPsec, rotte blackhole, BGP e firewall policy: incollala intera sul FortiGate di quella sede.", "Each site has its own tab with IPsec tunnels, blackhole routes, BGP and firewall policies: paste it whole on that site’s FortiGate."), null);
  else add("info", t("Ogni sede ha la sua scheda con tunnel IPsec, rotte blackhole e BGP: incollala intera sul FortiGate di quella sede. Le firewall policy da creare sono elencate nel Riepilogo.", "Each site has its own tab with IPsec tunnels, blackhole routes and BGP: paste it whole on that site’s FortiGate. The firewall policies to create are listed in the Summary."), null);
  if (codes) add("info", t("Nomi a codici: il tunnel si chiama codice della sede e della linea locali, trattino, codice della sede e della linea remote (MILW-ROML: linea W di Milano verso la linea L di Roma); l’aggregato si chiama sede-altrasede (MIL-ROM). Un codice vuoto si ricava dal nome della sede e dal tipo di linea. Un nome scritto a mano nella sezione «Tunnel e sessioni» resta com’è.", "Code names: a tunnel is named local site and line codes, dash, remote site and line codes (MILW-ROML: Milan’s line W toward Rome’s line L); an aggregate is named site-othersite (MIL-ROM). An empty code is derived from the site name and the line type. A name typed by hand in the «Tunnels and sessions» section stays as it is."), "bgpAdv.names");
}

function genBgpDiag(m, lang) {
  const it = lang !== "en", L = [];
  (m.bgpAdv.nodes || []).filter(n => !n.ext).forEach(n => {
    L.push("# ===== BGP · " + nodeName(m, n) + " =====");
    const tn = [...new Set(bgpSessions(m, n.id, true).filter(s => s.l.gen && !s.l.bothDyn && s.l.agg !== "pair").map(s => s.l[s.me + "If"]).filter(Boolean))];
    const dialT = [...new Set(bgpSessions(m, n.id).filter(s => s.l.gen && s.dynHub).map(s => s.l.aIf))];
    if (tn.length || dialT.length) L.push("get vpn ipsec tunnel summary", ...tn.filter(x => !dialT.includes(x)).map(x => "diagnose vpn ike gateway list name " + x));
    if (dialT.length) L.push("# " + (it ? "spoke collegati: tun_id deve essere l’IP del tunnel di ogni spoke" : "connected spokes: tun_id must be each spoke’s tunnel IP"), "diagnose vpn tunnel list | grep tun_id");
    if (aggOn(m) && tn.length) L.push("# " + (it ? "aggregati: membri e algoritmo; un membro giù in tunnel summary esce dal bilanciamento" : "aggregates: members and algorithm; a member down in tunnel summary leaves the balancing"), "show system ipsec-aggregate", "show system zone");
    L.push("get router info bgp summary");
    bgpSessions(m, n.id).forEach(s => {
      if (s.dynHub && !s.l.gen) { L.push("# " + (it ? "spoke dinamici di " : "dynamic spokes on ") + s.l.aIf + ": " + (it ? "compaiono nel summary quando si collegano" : "they appear in the summary once connected")); return; }
      const ip = ph(s.peerIp, it ? "ip-peer" : "peer-ip");
      L.push("get router info bgp neighbors " + ip, "get router info bgp neighbors " + ip + " advertised-routes", "get router info bgp neighbors " + ip + " received-routes");
    });
    L.push("get router info routing-table bgp");
    if (sdwanOn(m) && !aggOn(m)) L.push("diagnose sys sdwan member", "diagnose sys sdwan health-check", "diagnose sys sdwan service4");
    L.push("");
  });
  L.push("# " + (it ? "Cosa cercare" : "What to look for"),
    "#   " + (it ? "summary: un numero in State/PfxRcd = sessione stabilita; Active o Connect = il vicino non risponde" : "summary: a number in State/PfxRcd = session established; Active or Connect = the neighbor does not answer"),
    "#   " + (it ? "advertised-routes vuoto = filtri in uscita troppo stretti o reti assenti dalla tabella di routing" : "empty advertised-routes = outbound filters too strict or networks missing from the routing table"),
    "#   " + (it ? "dopo aver cambiato un filtro: execute router clear bgp ip <ip-peer> soft" : "after changing a filter: execute router clear bgp ip <peer-ip> soft"),
    ...(sdwanOn(m) && !aggOn(m) ? ["#   " + (it ? "health-check: ogni membro deve risultare alive e dentro SLA; service4: per ogni regola il membro scelto è il primo della lista" : "health-check: every member must be alive and within SLA; service4: for each rule the chosen member is the first in the list")] : []),
    "", "# " + (it ? "Debug (al termine: diagnose debug disable)" : "Debug (when done: diagnose debug disable)"),
    "diagnose ip router bgp all enable", "diagnose ip router bgp level info", "diagnose debug enable");
  return L.join("\n");
}

function genBgpSummary(m, lang) {
  const it = lang !== "en", t = (a, b) => it ? a : b, L = ["## " + t("BGP avanzato", "Advanced BGP"), ""];
  (m.bgpAdv.nodes || []).forEach(n => {
    const nets = parseNets(nodeNets(m, n)).out.map(x => x.net + "/" + x.p).join(", ");
    L.push("- " + nodeName(m, n) + ": AS " + (n.as || "—") + (n.ext ? t(" (peer esterno, nessuna configurazione generata)", " (external peer, no configuration generated)") : "") +
      (n.rid ? ", router-id " + n.rid : "") + (n.rr ? ", route reflector" : "") + (n.loIp && !n.ext ? ", loopback " + n.loIp : "") + (nets && !n.ext ? "; " + t("reti", "networks") + " " + nets : ""));
  });
  L.push("", "### " + t("Sessioni", "Sessions"), "");
  (m.bgpAdv.links || []).forEach((l0, i) => {
    const l = bgpLinkRes(m, l0), A = bgpNode(m, l.a), B = bgpNode(m, l.b); if (!A || !B) return;
    const pol = s => ["RmIn", "RmOut", "PlIn", "PlOut"].map(k => String(l[s + k] || "").trim()).filter(Boolean);
    const pa = pol("a"), pb = pol("b");
    L.push("- " + nodeName(m, A) + " ⇄ " + nodeName(m, B) + ": " + (String(A.as) === String(B.as) ? "iBGP" : "eBGP") + ", " +
      (l.src ? t("tunnel IPsec ", "IPsec tunnel ") + (l.src === "ipsec2" ? "2" : "1") : (l.kind === "phys" ? t("collegamento fisico", "physical link") : "tunnel " + (l.aIf || "—"))) +
      (l.gen ? t(", tunnel IPsec generato ", ", generated IPsec tunnel ") + (l.aIf || "—") + "/" + (l.bIf || "—") + " " + (l.aIp || "—") + "–" + (l.bIp || "—") : "") +
      (l.loop ? t(", sulle loopback", ", over loopbacks") : "") + (l.dyn ? t(", spoke dinamici (neighbor-range ", ", dynamic spokes (neighbor-range ") + (l.range || "—") + ")" : "") + (l.bfd ? ", BFD" : "") +
      (pa.length ? "; " + nodeName(m, A) + ": " + pa.join(", ") : "") + (pb.length ? "; " + nodeName(m, B) + ": " + pb.join(", ") : ""));
  });
  return L.join("\n");
}

if (typeof module !== "undefined") module.exports = { setOutLang, baseModel, upgradeModel, makePreset, genFortiGate, genXml, genGuide, guideText, genDiag, genSummary, runChecks, parseNets, randomPsk, PRESETS, recommendedAdv, optApplies, optDepOk, genBgpNode, bgpTemplate, bgpAdvChecks, genBgpDiag, genBgpSummary, parsePL, parseRM, advOn, bgpNormalize, bgpAddNode,
  msSites, msHub, msAddSite, msRemoveWan, msResetIps, msPairPreset, msPlan, bgpSessions, bgpLinkRes, linkDial, siteWans, sdwanOn, aggOn, pairWhyNot, siteCode, lineCode, linkAutoReset };
