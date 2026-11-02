# Changelog

## 2026-11-02

### Added
- **Multi-site network (BGP)** scenario, FortiOS 7.4 and 7.6: 2 to 30 sites, hub and spoke or full mesh, iBGP with route reflector or eBGP with one AS per site, one configuration tab per site. It replaces the earlier "advanced BGP" module; saved projects are converted to a custom topology.
- Hub tunnels: one dial-up tunnel (spokes with `auto-discovery-receiver`, one explicit BGP neighbor per spoke) or one static tunnel per spoke; optional ADVPN shortcuts.
- Several lines per site (up to 8): cable/fibre, satellite, LTE/5G and private networks (MPLS, radio, dedicated links) that pair only within the same network. Line-pair matrix with quick choices.
- Tunnel grouping: SD-WAN zone (members, health-checks to the loopbacks, SLA rules by cost) or IPsec aggregate per site pair (members with `aggregate-member enable`, algorithm L4, L3, round-robin or redundant, IP and BGP on the aggregate, zone with `intrazone allow`).
- Firewall policies on the zone when there are several lines per site.
- Tunnel names from site names or short codes (`MILW-ROML`, aggregate `MIL-ROM`); codes derived from the site name and line type, editable.
- Tunnel addresses in sequence or per site (one /24 per site, router IDs in /24 zero); "Tunnel addresses" table with every address editable and a reset button.
- DPD retry interval; BGP timers suggested for the aggregate, whose interface stays up when all members are down.
- Network map with tunnel bundles, counters and line chips.
- "Tunnels and sessions" grouped by site pair, with "Automatic values" to bring a tunnel back to the proposed name, IP, WAN, gateway and cryptography.
- `tests/multisite.js`.

### Changed
- `tests/smoke.js` also covers the multi-site scenario (refused on FortiOS 7.2 by design).
