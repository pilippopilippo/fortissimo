# Fortissimo

**Generatore di configurazioni IPsec per FortiGate** · *IPsec configuration generator for FortiGate*

🇮🇹 [Italiano](#italiano) · 🇬🇧 [English](#english)

**Sito / Website:** https://pilippopilippo.github.io/fortissimo/

---

## Italiano

Fortissimo è una pagina web che genera la configurazione CLI di VPN IPsec per FortiGate, partendo da pochi campi compilati in un modulo guidato. Funziona tutta nel browser: nessun server, nessun dato inviato.

### Scenari

| Scenario | Cosa genera |
|---|---|
| Site-to-site tra due FortiGate | CLI di entrambi i lati, rotte statiche o BGP, blackhole, doppia WAN |
| Filiale con IP dinamico | CLI di hub e filiale, Network ID, BGP con rete overlay |
| FortiClient con utenti locali | CLI del FortiGate e file di configurazione FortiClient (XML) |
| FortiClient con LDAP / Active Directory | CLI, file FortiClient (EAP-TTLS), server LDAP, guida passo passo |
| FortiClient con RADIUS (ad esempio NPS) | CLI, file FortiClient, server RADIUS, guida per NPS |
| FortiClient con SAML Entra ID | CLI, file FortiClient, guida per Entra ID |

### Cosa offre

- **Verifiche** su errori tipici: reti sovrapposte, Network ID duplicati, proposte non compatibili con FortiClient, porte in conflitto, valori fuori intervallo.
- **Versioni FortiOS 7.2, 7.4 e 7.6**: le opzioni che non esistono nella versione scelta non vengono mostrate né generate.
- **Spiegazione di ogni campo** in linguaggio semplice, con il comando CLI corrispondente e l’indicazione dei campi facoltativi.
- **Diagnostica**: i comandi di debug da usare e cosa cercare nell’output.
- **Progetti salvati nel browser** ed esportabili in JSON. Chiavi PSK e password **non vengono mai salvate né esportate**.
- **Interfaccia in italiano e inglese**, tema chiaro e scuro, uso da mobile.

### Limiti

- **Le firewall policy non vengono generate**: vanno create a parte.
- Il catalogo copre le opzioni più utili, non tutte quelle di FortiOS.
- **Prova sempre la configurazione in laboratorio** prima di applicarla in produzione.

### Uso offline

Scarica `index.html` e aprilo nel browser: non servono installazioni.

### Sviluppo

I sorgenti sono in `src/`:

| File | Contenuto |
|---|---|
| `i18n.js` | testi dell’interfaccia e spiegazioni dei campi (IT/EN) |
| `schema.js` | catalogo delle opzioni avanzate con versioni e valori |
| `engine.js` | modello, scenari, generatori e verifiche (senza DOM, testabile con Node) |
| `ui.js` | interfaccia |
| `shell.html` | struttura della pagina e stili |

```bash
python3 build.py      # rigenera index.html
node tests/smoke.js   # prova tutti gli scenari su tutte le versioni
```

Le opzioni e le versioni sono verificate sulla documentazione ufficiale Fortinet (CLI reference, guide di amministrazione, KB) e sullo schema per versione della collezione Ansible ufficiale [`fortinet.fortios`](https://github.com/fortinet-ansible-dev/ansible-galaxy-fortios-collection).

---

## English

Fortissimo is a web page that generates FortiGate IPsec VPN CLI configuration from a few fields in a guided form. It runs entirely in the browser: no server, no data sent anywhere.

### Scenarios

| Scenario | What it generates |
|---|---|
| FortiGate site-to-site | CLI for both sides, static or BGP routes, blackholes, dual WAN |
| Branch with dynamic IP | Hub and branch CLI, Network ID, BGP with an overlay network |
| FortiClient, local users | FortiGate CLI and FortiClient configuration file (XML) |
| FortiClient, LDAP / Active Directory | CLI, FortiClient file (EAP-TTLS), LDAP server, step-by-step guide |
| FortiClient, RADIUS (for example NPS) | CLI, FortiClient file, RADIUS server, NPS guide |
| FortiClient, SAML Entra ID | CLI, FortiClient file, Entra ID guide |

### Features

- **Checks** for common mistakes: overlapping networks, duplicate Network IDs, proposals FortiClient cannot use, conflicting ports, out-of-range values.
- **FortiOS 7.2, 7.4 and 7.6**: options that do not exist in the selected version are neither shown nor generated.
- **Plain-language help for every field**, with the matching CLI command and optional fields marked.
- **Diagnostics**: the debug commands to run and what to look for in the output.
- **Projects saved in the browser** and exportable as JSON. PSKs and passwords are **never saved or exported**.
- **Italian and English interface**, light and dark theme, mobile friendly.

### Limits

- **Firewall policies are not generated**: create them separately.
- The catalog covers the most useful options, not every FortiOS option.
- **Always test the configuration in a lab** before applying it in production.

### Offline use

Download `index.html` and open it in a browser: nothing to install.

### Development

Sources live in `src/` (see the table in the Italian section). Build and test:

```bash
python3 build.py      # rebuilds index.html
node tests/smoke.js   # runs every scenario on every version
```

Options and versions are checked against official Fortinet documentation (CLI reference, administration guides, KB) and the per-version schema of the official Ansible collection [`fortinet.fortios`](https://github.com/fortinet-ansible-dev/ansible-galaxy-fortios-collection).

---

## Avvertenze / Disclaimer

FortiGate, FortiOS, FortiClient and Fortinet are trademarks of Fortinet, Inc. Fortissimo is an independent project and is **not affiliated with, endorsed or sponsored by Fortinet**.

The generated configurations are provided **"as is", without warranty of any kind**. You are responsible for reviewing and testing them before use.

FortiGate, FortiOS, FortiClient e Fortinet sono marchi di Fortinet, Inc. Fortissimo è un progetto indipendente, **non affiliato né approvato da Fortinet**. Le configurazioni generate sono fornite **senza alcuna garanzia**: verificale e provale prima dell’uso.

## Licenza / License

[MIT](LICENSE)
