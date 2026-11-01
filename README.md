# Fortissimo

**IPsec configuration generator for FortiGate**

**Website:** https://pilippopilippo.github.io/fortissimo/

Fortissimo is a web page that generates FortiGate IPsec VPN CLI configuration from a few fields in a guided form. It runs entirely in the browser: no server, no data sent anywhere. The interface is available in English and Italian.

## Scenarios

| Scenario | What it generates |
|---|---|
| FortiGate site-to-site | CLI for both sides, static or BGP routes, blackholes, dual WAN |
| Branch with dynamic IP | Hub and branch CLI, Network ID, BGP with an overlay network |
| FortiClient, local users | FortiGate CLI and FortiClient configuration file (XML) |
| FortiClient, LDAP / Active Directory | CLI, FortiClient file (EAP-TTLS), LDAP server, step-by-step guide |
| FortiClient, RADIUS (for example NPS) | CLI, FortiClient file, RADIUS server, NPS guide |
| FortiClient, SAML Entra ID | CLI, FortiClient file, Entra ID guide |

## Features

- **Checks** for common mistakes: overlapping networks, duplicate Network IDs, proposals FortiClient cannot use, port conflicts, out-of-range values.
- **FortiOS 7.2, 7.4 and 7.6**: options that do not exist in the selected version are neither shown nor generated.
- **Plain-language help for every field**, with the matching CLI command and optional fields marked.
- **Diagnostics**: the debug commands to run and what to look for in the output.
- **Projects saved in the browser** and exportable as JSON. PSKs and passwords are **never saved or exported**.
- English and Italian interface, light and dark theme, mobile friendly.

## Limits

- **Firewall policies are not generated**: create them separately.
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
node tests/smoke.js   # runs every scenario on every FortiOS version
```

Options and versions are checked against official Fortinet documentation (CLI reference, administration guides, knowledge base) and the per-version schema of the official Ansible collection [`fortinet.fortios`](https://github.com/fortinet-ansible-dev/ansible-galaxy-fortios-collection).

## Disclaimer

FortiGate, FortiOS, FortiClient and Fortinet are trademarks of Fortinet, Inc. Fortissimo is an independent project and is **not affiliated with, endorsed or sponsored by Fortinet**.

The generated configurations are provided **"as is", without warranty of any kind**. You are responsible for reviewing and testing them before use.

## License

[MIT](LICENSE)
