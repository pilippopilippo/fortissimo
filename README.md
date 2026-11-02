# Fortissimo

**IPsec configuration generator for FortiGate**

**Website:** https://pilippopilippo.github.io/fortissimo/

Fortissimo is a web page that generates FortiGate IPsec VPN and BGP CLI configuration from a few fields in a guided form. It runs entirely in the browser: no server, no data sent anywhere. 
The interface is available in English and Italian.

## Scenarios

| Scenario | What it generates |
|---|---|
| FortiGate site-to-site | CLI for both sides, static or BGP routes, blackholes, dual WAN |
| Branch with dynamic IP | Hub and branch CLI, Network ID, BGP with an overlay network |
| FortiClient, local users | FortiGate CLI and FortiClient configuration file (XML) |
| FortiClient, LDAP / Active Directory | CLI, FortiClient file (EAP-TTLS), LDAP server, step-by-step guide |
| FortiClient, RADIUS (for example NPS) | CLI, FortiClient file, RADIUS server, NPS guide |
| FortiClient, SAML Entra ID | CLI, FortiClient file, Entra ID guide |
| Multi-site network (BGP) | One CLI per site: hub and spoke or full mesh, iBGP or eBGP, IPsec tunnels, blackholes; with several lines per site, an SD-WAN zone or one IPsec aggregate per site pair |

## Features

- **Multi-site network** (FortiOS 7.4 and 7.6):
  - 2 to 30 sites, hub and spoke (one dial-up tunnel on the hub, or one tunnel per spoke) or full mesh; iBGP with route reflector or eBGP with one AS per site; optional ADVPN shortcuts.
  - Up to 8 lines per site (cable/fibre, satellite, LTE/5G, private networks such as MPLS). One tunnel per line pair, with a matrix to drop the pairs you do not want and quick choices (every combination, same type only, line by line, no LTE with LTE).
  - Tunnels grouped in an **SD-WAN zone** (one BGP session per tunnel, health-checks, SLA rules by cost) or in an **IPsec aggregate** per site pair (`config system ipsec-aggregate`, one IP and one BGP session per pair, zone with `intrazone allow`).
  - Tunnel names from the site names or from short codes (`MILW-ROML`: Milan's line W toward Rome's line L; aggregate `MIL-ROM`).
  - Tunnel addresses in sequence or **per site** (one /24 per site, router IDs in /24 zero), every address editable.
  - Network map, per-site tab, diagnostics and summary; firewall policies on the zone when there are several lines per site.
- **Checks** for common mistakes: overlapping networks, duplicate Network IDs, proposals FortiClient cannot use, port conflicts, out-of-range values.
- **FortiOS 7.2, 7.4 and 7.6**: options that do not exist in the selected version are neither shown nor generated.
- **Plain-language help for every field**, with the matching CLI command and optional fields marked.
- **Diagnostics**: the debug commands to run and what to look for in the output.
- **Projects saved in the browser** and exportable as JSON. PSKs and passwords are **never saved or exported**.
- English and Italian interface, light and dark theme, mobile friendly.

## Limits

- **Firewall policies are generated only in the multi-site network with several lines per site**; elsewhere the summary lists the ones to create.
- The catalog covers the most useful options, not every FortiOS option.
- **Always test the configuration in a lab** before applying it in production.

## Offline use

Download `index.html` and open it in a browser: nothing to install.

## Development

Sources live in `src/`:

| File | Contents |
|---|---|
| `i18n.js` | interface text and field help (English and Italian) |
| `schema.js` | advanced option catalog with versions and values |
| `engine.js` | model, scenarios, generators and checks (no DOM, testable with Node) |
| `ui.js` | user interface |
| `shell.html` | page structure and styles |

```bash
python3 build.py      # rebuilds index.html from src/
node tests/smoke.js       # runs every scenario on every FortiOS version
node tests/multisite.js   # multi-site network: topologies, SD-WAN zone, IPsec aggregate, names, addressing
```

Options and versions are checked against official Fortinet documentation (CLI reference, administration guides, knowledge base) and the per-version schema of the official Ansible collection [`fortinet.fortios`](https://github.com/fortinet-ansible-dev/ansible-galaxy-fortios-collection).

## Disclaimer

FortiGate, FortiOS, FortiClient and Fortinet are trademarks of Fortinet, Inc. Fortissimo is an independent project and is **not affiliated with, endorsed or sponsored by Fortinet**.

The generated configurations are provided **"as is", without warranty of any kind**. You are responsible for reviewing and testing them before use.

## License

[MIT](LICENSE)
