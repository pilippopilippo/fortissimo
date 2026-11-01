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
  return m;
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

const PRESETS = ["s2s", "s2sdyn", "fct-local", "fct-ldap", "fct-radius", "fct-saml", "custom"];

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
const PH_EN = { "as-locale": "local-as", "as-remoto": "remote-as", "ca-peer": "peer-ca", "certificato": "certificate", "certificato-idp": "idp-certificate",
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
  const bgpOn = (sc === "s2s" || sc === "s2sdyn") && m.bgp.on;
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
  if (bgpOn) L.push(...genBgp(m, side, tunnels, sec), "");

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
    if (m.bgp.on) L.push("get router info bgp summary", "get router info routing-table bgp");
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
  if (!dial && m.bgp.on) L.push("#   " + (it ? "bgp summary: State/PfxRcd con un numero = sessione BGP stabilita" : "bgp summary: a number in State/PfxRcd = BGP session established"));
  return L.join("\n");
}

/* ---------- riepilogo ---------- */
function genSummary(m, lang) {
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
  else if (m.bgp.on) {
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
  L.push("", t("Le firewall policy non sono incluse in questa configurazione.", "Firewall policies are not included in this configuration."), "");
  return L.join("\n");
}

/* ---------- verifiche ---------- */
function runChecks(m, sec, lang) {
  const it = lang !== "en", t = (a, b) => it ? a : b;
  const R = [], add = (lvl, msg, p) => R.push({ lvl, msg, p });
  const sc = m.scenario, c = m.crypto;
  const sides = DIAL(sc) ? ["a"] : ["a", "b"];
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
  if (!DIAL(sc)) {
    const A = parseNets(m.a.nets).out, B = parseNets(m.b.nets).out;
    A.forEach(x => B.forEach(y => { if (overlap(x, y)) add("err", t("Le reti ", "Networks ") + x.raw + t(" e ", " and ") + y.raw + t(" si sovrappongono: i due lati devono usare reti diverse.", " overlap: the two sides must use different networks."), "b.nets"); }));
    if (sc === "s2s" && (m.a.tip || m.b.tip)) {
      ["a", "b"].forEach(s => { if (m[s].tip && !isIp(m[s].tip)) add("err", t("IP del tunnel non valido: ", "Invalid tunnel IP: ") + m[s].tip, s + ".tip"); });
      if (!(isIp(m.a.tip) && isIp(m.b.tip))) add("warn", t("Indica l’IP del tunnel su entrambi i lati, altrimenti non viene configurato.", "Set the tunnel IP on both sides, otherwise it is not configured."), "a.tip");
    }
    if (!m.route.bh) add("warn", t("Senza rotte blackhole, se il tunnel cade il traffico verso le reti remote può uscire su Internet.", "Without blackhole routes, traffic to the remote networks can leave over the Internet when the tunnel drops."), "route.bh");
    if (sc === "s2sdyn") {
      if (m.ident.peerMode === "one" && !String(m.ident.localid).trim()) add("err", t("Con Solo il peer ID indicato serve il Local ID della filiale.", "With Only the given peer ID the branch local ID is required."), "ident.localid");
      if (!m.bgp.on && (m.adv.a || {})["p1.add-route"] === "disable") add("warn", t("Con add-route disattivo l’hub non impara le reti della filiale: servono rotte o BGP.", "With add-route off the hub does not learn the branch networks: routes or BGP are needed."), "adv.a.p1.add-route");
      if (!m.bgp.on) add("info", t("La filiale propone una phase2 per ogni coppia di reti: così l’hub crea da solo le rotte verso la filiale.", "The branch proposes one phase2 per network pair: this way the hub creates the routes to the branch by itself."), null);
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
      parseNets(m.a.nets).out.forEach(n => { if (a <= n.end && b >= n.start) add("err", t("Il pool si sovrappone alla rete interna ", "The pool overlaps the internal network ") + n.raw + ".", "dial.poolStart"); });
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
  if ((sc === "s2s" || sc === "s2sdyn") && m.bgp.on) {
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
    if (String(d2.aTunnel).trim() && d2.aTunnel === m.a.tunnel) add("err", t("I due tunnel del lato A devono avere nomi diversi.", "The two side A tunnels need different names."), "dual.aTunnel");
    if (String(d2.bTunnel).trim() && d2.bTunnel === m.b.tunnel) add("err", t("I due tunnel del lato B devono avere nomi diversi.", "The two side B tunnels need different names."), "dual.bTunnel");
    if (!String(d2.aWan).trim()) add("err", t("Manca la seconda interfaccia WAN del lato A.", "Side A second WAN interface is missing."), "dual.aWan");
    if (!String(d2.aIp).trim() && !String(d2.aFqdn).trim()) add("err", t("Serve l’IP pubblico o l’FQDN della seconda WAN del lato A: il lato B lo usa per il secondo tunnel.", "The side A second WAN IP or FQDN is needed: side B uses it for the second tunnel."), "dual.aIp");
    ["aIp", "bIp", "aTip", "bTip"].forEach(k => { if (String(d2[k]).trim() && !isIp(d2[k])) add("err", t("Indirizzo non valido: ", "Invalid address: ") + d2[k], "dual." + k); });
    if ((String(d2.bIp).trim() || String(d2.bFqdn).trim()) && !String(d2.bWan).trim()) add("err", t("Indica l’interfaccia della seconda WAN del lato B.", "Set the side B second WAN interface."), "dual.bWan");
    if (d2.mode === "backup" && !m.bgp.on) {
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
    if (m.bgp.on) add("warn", t("Con il BGP il tunnel in standby non serve: il BGP sceglie già il percorso. Valuta la modalità in parallelo.", "With BGP a standby tunnel is not needed: BGP already picks the path. Consider parallel mode."), "dual.mode");
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
  const order = { err: 0, warn: 1, info: 2 }, seen = new Set();
  return R.filter(r => { if (seen.has(r.lvl + r.msg)) return false; seen.add(r.lvl + r.msg); return true; }).sort((x, y) => order[x.lvl] - order[y.lvl]);
}

if (typeof module !== "undefined") module.exports = { setOutLang, baseModel, upgradeModel, makePreset, genFortiGate, genXml, genGuide, guideText, genDiag, genSummary, runChecks, parseNets, randomPsk, PRESETS, recommendedAdv, optApplies, optDepOk };
