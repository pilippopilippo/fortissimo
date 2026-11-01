/* Fortissimo — catalogo opzioni avanzate (FortiOS 7.4.2 CLI reference)
   sides: lati a cui si applica per scenario. rec: valore del preset per scenario e lato (null = predefinito FortiOS). */
const ALL_SC = ["s2s", "s2sdyn", "dialup"];
const BOTH = { s2s: ["a", "b"], s2sdyn: ["a", "b"], dialup: ["a"], native: ["a"] };
const HUB = { s2sdyn: ["a"], dialup: ["a"], native: ["a"] };
const STATIC_SIDES = { s2s: ["a", "b"], s2sdyn: ["b"] };

const OPTS = [
  // Resilienza
  { k: "p1.dpd", cli: "dpd", type: "enum", vals: ["on-idle", "on-demand", "disable"], def: "on-demand", sec: "resil", lvl: "essential", sides: BOTH,
    rec: () => "on-idle",
    it: ["Dead Peer Detection (DPD)", "Controllo che l’altro lato sia ancora vivo", "Il FortiGate manda ogni tanto un «ci sei?» all’altro lato. on-idle lo fa solo quando non passa traffico: si accorge presto di un tunnel morto senza sprecare banda. on-demand controlla solo quando deve inviare traffico. disable non controlla mai: un tunnel morto resta «su» finché le chiavi non scadono, anche ore. Con due linee Internet serve on-idle."],
    en: ["Dead Peer Detection (DPD)", "Checks the other side is still alive", "The FortiGate sends an occasional «are you there?» to the other side. on-idle does it only when no traffic flows: it spots a dead tunnel quickly without wasting bandwidth. on-demand checks only when it has traffic to send. disable never checks: a dead tunnel stays «up» until keys expire, even hours. With two Internet lines you need on-idle."] },
  { k: "p1.dpd-retrycount", cli: "dpd-retrycount", type: "num", min: 0, max: 10, def: "3", sec: "resil", lvl: "expert", sides: BOTH,
    it: ["Tentativi DPD", "Quanti «ci sei?» senza risposta prima di arrendersi", "Dopo questo numero di controlli senza risposta il tunnel viene dichiarato caduto. Alzalo su linee che perdono pacchetti (4G, satellite) per evitare cadute finte; abbassalo per accorgerti prima dei guasti veri."],
    en: ["DPD retries", "How many unanswered «are you there?» before giving up", "After this many unanswered checks the tunnel is declared down. Raise it on lossy lines (4G, satellite) to avoid false drops; lower it to notice real failures sooner."] },
  { k: "p1.dpd-retryinterval", cli: "dpd-retryinterval", type: "num", min: 1, max: 3600, sec: "resil", lvl: "expert", sides: BOTH,
    it: ["Intervallo DPD (secondi)", "Attesa tra un controllo e il successivo", "Tempo tra un «ci sei?» e il successivo. Tempo totale per dichiarare il tunnel caduto = intervallo × tentativi. Valori bassi = guasti scoperti prima; valori alti = più tolleranza alle linee instabili. Con due linee Internet usa lo stesso valore sui due lati."],
    en: ["DPD interval (seconds)", "Wait between one check and the next", "Time between one «are you there?» and the next. Total time to declare the tunnel down = interval × retries. Low values = failures found sooner; high values = more tolerance for unstable lines. With two Internet lines use the same value on both sides."] },
  { k: "p2.auto-negotiate", scope: "p2", cli: "auto-negotiate", type: "enum", vals: ["enable", "disable"], def: "disable", sec: "resil", lvl: "essential", sides: STATIC_SIDES,
    rec: (sc, side) => (sc === "s2s" || (sc === "s2sdyn" && side === "b")) ? "enable" : null,
    it: ["Avvio automatico phase2", "Alza il tunnel senza aspettare traffico", "Senza questa opzione il tunnel si apre solo quando qualcuno manda traffico, e i primi pacchetti possono andare persi (il primo ping fallisce). Con l’opzione attiva il tunnel è sempre pronto. Consigliato tra due sedi."],
    en: ["Phase2 auto-negotiate", "Brings the tunnel up without waiting for traffic", "Without it the tunnel opens only when someone sends traffic, and the first packets may be lost (the first ping fails). With it on the tunnel is always ready. Recommended between two sites."] },
  { k: "p2.keepalive", scope: "p2", cli: "keepalive", type: "enum", vals: ["enable", "disable"], def: "disable", sec: "resil", lvl: "essential", sides: STATIC_SIDES,
    rec: (sc, side) => (sc === "s2s" || (sc === "s2sdyn" && side === "b")) ? "enable" : null,
    it: ["Keepalive phase2", "Tiene vivo il tunnel anche senza traffico", "Rinnova la phase2 anche quando la linea è silenziosa, così il tunnel non scade di notte o nel weekend. Consigliato tra due sedi."],
    en: ["Phase2 keepalive", "Keeps the tunnel alive without traffic", "Renews phase2 even when the line is silent, so the tunnel does not expire at night or at weekends. Recommended between two sites."] },
  { k: "p1.auto-negotiate", cli: "auto-negotiate", type: "enum", vals: ["enable", "disable"], def: "enable", sec: "resil", lvl: "expert", sides: STATIC_SIDES,
    it: ["Avvio automatico IKE", "Il FortiGate avvia la VPN da solo", "Normalmente entrambi i lati provano ad alzare la VPN. Spegnilo solo se questo lato deve limitarsi ad aspettare che sia l’altro a chiamare."],
    en: ["IKE auto-negotiate", "The FortiGate starts the VPN on its own", "Normally both sides try to bring the VPN up. Turn it off only if this side must just wait for the other one to call."] },
  { k: "p1.negotiate-timeout", cli: "negotiate-timeout", type: "num", min: 1, max: 300, def: "30", sec: "resil", lvl: "expert", sides: BOTH,
    it: ["Timeout negoziazione (secondi)", "Tempo massimo per stabilire la VPN", "Quanto tempo ha la negoziazione per completarsi. Il valore di fabbrica (30 secondi) basta quasi sempre; alzalo se gli utenti devono fare una MFA lenta (codice, notifica, login Microsoft) e il collegamento scade prima."],
    en: ["Negotiation timeout (seconds)", "Maximum time to set up the VPN", "How long negotiation has to complete. The factory value (30 seconds) is almost always enough; raise it if users must go through a slow MFA (code, notification, Microsoft sign-in) and the connection times out first."] },

  // Trasporto e frammentazione
  { k: "p1.nattraversal", cli: "nattraversal", type: "enum", vals: ["enable", "disable", "forced"], def: "enable", sec: "trans", lvl: "expert", sides: BOTH,
    it: ["NAT traversal", "Fa passare la VPN dietro un router con NAT", "Se c’è un router che traduce gli indirizzi (NAT) tra i due lati, la VPN viene incapsulata in UDP 4500 per passarlo. enable lo fa solo quando serve, ed è la scelta giusta. forced lo usa sempre: serve se un apparato in mezzo blocca il protocollo ESP anche senza NAT."],
    en: ["NAT traversal", "Lets the VPN cross a router doing NAT", "If a router translating addresses (NAT) sits between the sides, the VPN is wrapped in UDP 4500 to get through. enable does it only when needed, and is the right choice. forced always does it: needed if a device in between blocks the ESP protocol even without NAT."] },
  { k: "p1.keepalive", cli: "keepalive", type: "num", min: 5, max: 900, def: "10", sec: "trans", lvl: "expert", sides: BOTH,
    it: ["Keepalive NAT-T (secondi)", "Ogni quanto tenere aperta la porta sul NAT", "I router con NAT chiudono le «porte» inattive dopo un po’. Questo invio periodico le tiene aperte. Abbassalo se il tunnel cade dopo un periodo di silenzio, ad esempio dietro router 4G."],
    en: ["NAT-T keepalive (seconds)", "How often to keep the NAT port open", "Routers doing NAT close idle «ports» after a while. This periodic packet keeps them open. Lower it if the tunnel drops after a quiet period, for example behind 4G routers."] },
  { k: "p1.fragmentation", cli: "fragmentation", type: "enum", vals: ["enable", "disable"], def: "enable", sec: "trans", lvl: "expert", sides: BOTH,
    it: ["Frammentazione IKE", "Spezza i messaggi IKE troppo grandi", "Con i certificati i messaggi della negoziazione diventano grandi e alcune linee li scartano. Questa opzione li spezza in pezzi più piccoli. Lasciala attiva; spegnila solo se l’altro lato non la supporta."],
    en: ["IKE fragmentation", "Splits IKE messages that are too large", "With certificates negotiation messages get large and some lines drop them. This option splits them into smaller pieces. Keep it on; turn it off only if the other side does not support it."] },
  { k: "p1.fragmentation-mtu", cli: "fragmentation-mtu", type: "num", min: 500, max: 16000, def: "1200", sec: "trans", lvl: "expert", sides: BOTH,
    it: ["Dimensione dei frammenti IKE", "In byte", "Dimensione massima di ogni pezzo quando la frammentazione IKE è attiva. Abbassala su linee con MTU ridotta, come PPPoE o 4G, se la negoziazione con certificati non va a buon fine."],
    en: ["IKE fragment size", "In bytes", "Maximum size of each piece when IKE fragmentation is on. Lower it on lines with a reduced MTU, such as PPPoE or 4G, if negotiation with certificates fails."] },
  { k: "p1.ip-fragmentation", cli: "ip-fragmentation", type: "enum", vals: ["post-encapsulation", "pre-encapsulation"], def: "post-encapsulation", sec: "trans", lvl: "expert", sides: BOTH,
    it: ["Frammentazione dei pacchetti", "Prima o dopo la cifratura", "Quando un pacchetto è troppo grande per la linea va spezzato. post-encapsulation (predefinito) lo spezza dopo averlo cifrato, come prevede lo standard. pre-encapsulation lo spezza prima: l’altro lato non deve ricomporlo, e a volte risolve problemi di velocità su linee con MTU ridotta."],
    en: ["Packet fragmentation", "Before or after encryption", "When a packet is too large for the line it must be split. post-encapsulation (default) splits it after encrypting, as the standard says. pre-encapsulation splits it before: the other side does not have to reassemble it, and it sometimes fixes speed problems on lines with a reduced MTU."] },
  { k: "p1.npu-offload", cli: "npu-offload", type: "enum", vals: ["enable", "disable"], def: "enable", sec: "trans", lvl: "expert", sides: BOTH,
    it: ["Accelerazione hardware", "Cifratura nel chip dedicato", "I FortiGate hanno un chip (NPU) che cifra molto più velocemente della CPU. Lascialo attivo; spegnilo solo su indicazione del supporto per una diagnosi."],
    en: ["Hardware acceleration", "Encryption in the dedicated chip", "FortiGates have a chip (NPU) that encrypts much faster than the CPU. Keep it on; turn it off only when support asks, for troubleshooting."] },

  // Sessioni client (dial-up e hub)
  { k: "p1.net-device", cli: "net-device", type: "enum", vals: ["disable", "enable"], def: "disable", sec: "dialadv", lvl: "essential", sides: HUB,
    rec: () => "disable",
    it: ["Interfaccia per ogni client", "Una interfaccia condivisa o una per connessione", "Con disable (consigliato) tutti i client o le filiali condividono la stessa interfaccia: il FortiGate regge molte più connessioni. enable crea un’interfaccia per ognuno: serve solo in alcuni progetti con routing dinamico particolare."],
    en: ["Interface per client", "One shared interface or one per connection", "With disable (recommended) all clients or branches share the same interface: the FortiGate handles many more connections. enable creates one interface each: needed only in some designs with special dynamic routing."] },
  { k: "p1.add-route", cli: "add-route", type: "enum", vals: ["enable", "disable"], def: "enable", sec: "dialadv", lvl: "essential", sides: HUB,
    rec: (sc) => sc === "s2sdyn" ? "enable" : null,
    it: ["Rotte automatiche dai selettori", "L’hub impara le reti dei client", "Quando una filiale o un client si collega, il FortiGate aggiunge da solo la rotta verso le sue reti. Indispensabile nei dial-up senza BGP; con il BGP Fortissimo lo spegne perché le reti arrivano dal BGP."],
    en: ["Automatic routes from selectors", "The hub learns client networks", "When a branch or client connects, the FortiGate adds the route to its networks by itself. Essential for dial-up without BGP; with BGP Fortissimo turns it off because networks arrive via BGP."] },
  { k: "p1.distance", cli: "distance", type: "num", min: 1, max: 255, def: "15", sec: "dialadv", lvl: "expert", sides: HUB,
    it: ["Distanza delle rotte automatiche", "Priorità delle rotte aggiunte dalla VPN", "Più è bassa, più quelle rotte hanno la precedenza su altri percorsi verso le stesse reti. Cambiala solo se hai percorsi alternativi da far prevalere."],
    en: ["Automatic route distance", "Priority of routes added by the VPN", "The lower it is, the more those routes win over other paths to the same networks. Change it only if you have alternative paths that must win."] },
  { k: "p1.idle-timeout", cli: "idle-timeout", type: "enum", vals: ["disable", "enable"], def: "disable", sec: "dialadv", lvl: "expert", sides: { dialup: ["a"], native: ["a"] },
    it: ["Disconnessione per inattività", "Chiude i client che non usano la VPN", "Se un utente resta collegato senza usare la VPN, dopo il tempo indicato viene disconnesso. Libera indirizzi del pool e chiude sessioni dimenticate aperte."],
    en: ["Idle disconnect", "Closes clients not using the VPN", "If a user stays connected without using the VPN, they are disconnected after the given time. Frees pool addresses and closes forgotten sessions."] },
  { k: "p1.idle-timeoutinterval", cli: "idle-timeoutinterval", type: "num", min: 5, max: 43200, def: "15", sec: "dialadv", lvl: "expert", sides: { dialup: ["a"], native: ["a"] }, dep: ["p1.idle-timeout", "enable"],
    it: ["Minuti di inattività", "Da 5 a 43200 minuti", "Dopo quanti minuti senza traffico il client viene disconnesso."], en: ["Idle minutes", "5 to 43200 minutes", "After how many minutes without traffic the client is disconnected."] },
  { k: "p1.client-keep-alive", cli: "client-keep-alive", type: "enum", vals: ["disable", "enable"], def: "disable", sec: "dialadv", lvl: "expert", sides: { dialup: ["a"] },
    it: ["Keepalive del client", "Il client tiene su il tunnel senza traffico", "Utile per programmi che restano collegati a lungo senza scambiare dati, come un gestionale aperto in pausa pranzo."],
    en: ["Client keepalive", "The client keeps the tunnel up without traffic", "Useful for programs that stay connected for a long time without exchanging data, like an ERP left open over lunch."] },
  { k: "p1.client-auto-negotiate", cli: "client-auto-negotiate", type: "enum", vals: ["disable", "enable"], def: "disable", sec: "dialadv", lvl: "expert", sides: { dialup: ["a"] },
    it: ["Avvio automatico dal client", "Il client alza il tunnel da solo", "Permette al client di alzare il tunnel anche senza traffico in uscita. Normalmente non serve."],
    en: ["Client auto-negotiate", "The client brings the tunnel up by itself", "Lets the client bring the tunnel up even without outgoing traffic. Usually not needed."] },
  { k: "p1.client-resume", cli: "client-resume", type: "enum", vals: ["disable", "enable"], sec: "dialadv", lvl: "expert", sides: { dialup: ["a"] }, since: "7.4",
    it: ["Ripresa della sessione", "Il client riprende il tunnel dopo standby o cambio di rete", "Se il PC va in standby o passa dal Wi-Fi al cavo, il client si ricollega senza rifare login e MFA. Molto comodo per gli utenti. Disponibile da FortiOS 7.4.4."],
    en: ["Session resume", "The client resumes the tunnel after sleep or a network change", "If the PC sleeps or moves from Wi-Fi to cable, the client reconnects without a new sign-in and MFA. Very handy for users. Available from FortiOS 7.4.4."] },
  { k: "p1.client-resume-interval", cli: "client-resume-interval", type: "num", min: 120, max: 172800, sec: "dialadv", lvl: "expert", sides: { dialup: ["a"] }, since: "7.4", dep: ["p1.client-resume", "enable"],
    it: ["Tempo massimo di ripresa (secondi)", "Da 120 a 172800 secondi", "Per quanto tempo dopo la disconnessione il client può riprendere la sessione senza rifare login."], en: ["Maximum resume time (seconds)", "120 to 172800 seconds", "For how long after a disconnection the client can resume the session without signing in again."] },
  { k: "p1.mode-cfg-allow-client-selector", cli: "mode-cfg-allow-client-selector", type: "enum", vals: ["disable", "enable"], def: "disable", sec: "dialadv", lvl: "expert", sides: { dialup: ["a"] },
    it: ["Selettori scelti dal client", "Normalmente spento", "Permette al client di proporre reti diverse da «tutto il traffico». Serve solo con client particolari che lo richiedono; con FortiClient lascialo spento."],
    en: ["Client-chosen selectors", "Normally off", "Lets the client propose networks other than «all traffic». Needed only with special clients that require it; with FortiClient leave it off."] },
  { k: "p1.enforce-unique-id", cli: "enforce-unique-id", type: "enum", vals: ["disable", "keep-new", "keep-old"], def: "disable", sec: "dialadv", lvl: "expert", sides: HUB,
    it: ["Un solo collegamento per ID", "Cosa fare se lo stesso utente si collega due volte", "keep-new tiene l’ultima connessione e chiude la vecchia: utile quando un PC si ricollega dopo un cambio di rete. keep-old rifiuta la nuova. disable permette più connessioni contemporanee con lo stesso ID."],
    en: ["One connection per ID", "What to do if the same user connects twice", "keep-new keeps the latest connection and closes the old one: useful when a PC reconnects after a network change. keep-old rejects the new one. disable allows several simultaneous connections with the same ID."] },

  // Phase1 avanzate
  { k: "p1.rekey", cli: "rekey", type: "enum", vals: ["enable", "disable"], def: "enable", sec: "p1adv", lvl: "expert", sides: BOTH,
    it: ["Rinnovo della phase1", "Rinnova le chiavi alla scadenza", "Alla scadenza della phase1 le chiavi vengono rinnovate senza interrompere la VPN. Spegnerlo fa cadere il tunnel a ogni scadenza: lascialo attivo."],
    en: ["Phase1 rekey", "Renews keys when they expire", "When phase1 expires keys are renewed without interrupting the VPN. Turning it off drops the tunnel at every expiry: keep it on."] },
  { k: "p1.reauth", cli: "reauth", type: "enum", vals: ["disable", "enable"], def: "disable", sec: "p1adv", lvl: "expert", sides: BOTH,
    it: ["Riautenticazione", "Chiede di nuovo le credenziali alla scadenza", "Con gli utenti a ogni scadenza della phase1 bisogna rifare il login (e l’MFA). Più sicuro, ma scomodo: con 24 ore di durata, gli utenti si ricollegano una volta al giorno."],
    en: ["Reauthentication", "Asks for credentials again at expiry", "With users, a new sign-in (and MFA) is needed at every phase1 expiry. More secure, but inconvenient: with a 24-hour lifetime users reconnect once a day."] },
  { k: "p1.localid-type", cli: "localid-type", type: "enum", vals: ["auto", "fqdn", "user-fqdn", "keyid", "address", "asn1dn"], def: "auto", sec: "p1adv", lvl: "expert", sides: BOTH,
    it: ["Tipo di Local ID", "Formato dell’identità inviata", "Normalmente auto va bene. Si cambia quasi solo con apparati di altri produttori che si aspettano un formato preciso (indirizzo, FQDN, email)."],
    en: ["Local ID type", "Format of the identity sent", "auto is normally fine. It is changed almost only with other vendors’ devices that expect a precise format (address, FQDN, email)."] },
  { k: "p1.childless-ike", cli: "childless-ike", type: "enum", vals: ["disable", "enable"], def: "disable", sec: "p1adv", lvl: "expert", sides: BOTH, ike: "2",
    it: ["IKEv2 senza phase2 iniziale", "Standard RFC 6023", "Avvia la phase1 senza creare subito la phase2. Serve solo se l’altro lato lo richiede espressamente."],
    en: ["Childless IKEv2", "RFC 6023 standard", "Starts phase1 without creating phase2 right away. Needed only if the other side explicitly requires it."] },
  { k: "p1.ppk", cli: "ppk", type: "enum", vals: ["disable", "allow", "require"], def: "disable", sec: "p1adv", lvl: "expert", sides: BOTH, ike: "2",
    it: ["Chiave post-quantum (PPK)", "Protezione aggiuntiva contro i computer quantistici", "Aggiunge una seconda chiave segreta, oltre allo scambio normale, che resta sicura anche contro futuri computer quantistici (RFC 8784). Va impostata uguale sui due lati. allow la usa se c’è, require rifiuta chi non ce l’ha."],
    en: ["Post-quantum key (PPK)", "Extra protection against quantum computers", "Adds a second secret key, on top of the normal exchange, that stays safe even against future quantum computers (RFC 8784). It must match on both sides. allow uses it if present, require rejects peers without it."] },
  { k: "p1.ppk-identity", cli: "ppk-identity", type: "text", sec: "p1adv", lvl: "expert", sides: BOTH, ike: "2", dep: ["p1.ppk", "!disable"],
    it: ["Identità PPK", "Nome della chiave PPK", "Un nome che identifica la chiave PPK, uguale sui due lati."], en: ["PPK identity", "Name of the PPK key", "A name identifying the PPK key, the same on both sides."] },
  { k: "p1.comments", cli: "comments", type: "text", sec: "p1adv", lvl: "expert", sides: BOTH,
    it: ["Commento", "Testo libero", "Una nota che resta salvata con il tunnel sul FortiGate, ad esempio chi l’ha creato e perché."], en: ["Comment", "Free text", "A note saved with the tunnel on the FortiGate, for example who created it and why."] },

  // Phase2 avanzate
  { k: "p2.replay", scope: "p2", cli: "replay", type: "enum", vals: ["enable", "disable"], def: "enable", sec: "p2adv", lvl: "expert", sides: BOTH,
    it: ["Protezione anti-replay", "Scarta pacchetti ripetuti", "Impedisce a qualcuno di registrare pacchetti cifrati e rispedirli. Lasciala sempre attiva."],
    en: ["Anti-replay protection", "Drops repeated packets", "Stops anyone from recording encrypted packets and sending them again. Always keep it on."] },
  { k: "p2.keylife-type", scope: "p2", cli: "keylife-type", type: "enum", vals: ["seconds", "kbs", "both"], def: "seconds", sec: "p2adv", lvl: "expert", sides: BOTH,
    it: ["Tipo di durata phase2", "Tempo, traffico o entrambi", "Decide quando rinnovare le chiavi del traffico: dopo un tempo, dopo una quantità di dati, o al primo dei due. Lascia «secondi» salvo richieste dell’altro lato; deve coincidere sui due lati."],
    en: ["Phase2 lifetime type", "Time, traffic or both", "Decides when to renew traffic keys: after a time, after an amount of data, or whichever comes first. Keep «seconds» unless the other side asks otherwise; it must match on both sides."] },
  { k: "p2.keylifekbs", scope: "p2", cli: "keylifekbs", type: "num", min: 5120, max: 4294967295, def: "5120", sec: "p2adv", lvl: "expert", sides: BOTH, dep: ["p2.keylife-type", "!seconds"],
    it: ["Durata phase2 (KB)", "Kilobyte prima del rinnovo", "Quanti kilobyte di traffico prima di rinnovare le chiavi, se il tipo di durata lo prevede."], en: ["Phase2 lifetime (KB)", "Kilobytes before renewal", "How many kilobytes of traffic before keys are renewed, if the lifetime type uses it."] },
  { k: "p2.add-route", scope: "p2", cli: "add-route", type: "enum", vals: ["phase1", "enable", "disable"], def: "phase1", sec: "p2adv", lvl: "expert", sides: HUB,
    it: ["Rotte da questa phase2", "Segue la phase1 o la sovrascrive", "phase1 segue l’impostazione della phase1 (normale). enable o disable la forzano solo per questa phase2."], en: ["Routes from this phase2", "Follows phase1 or overrides it", "phase1 follows the phase1 setting (normal). enable or disable force it for this phase2 only."] },
  { k: "p2.route-overlap", scope: "p2", cli: "route-overlap", type: "enum", vals: ["use-new", "use-old", "allow"], def: "use-new", sec: "p2adv", lvl: "expert", sides: HUB,
    it: ["Rotte sovrapposte", "Due client annunciano la stessa rete", "Se due client o filiali annunciano la stessa rete: use-new tiene quella dell’ultimo collegato, use-old quella del primo, allow le tiene entrambe."],
    en: ["Overlapping routes", "Two clients announce the same network", "If two clients or branches announce the same network: use-new keeps the latest one, use-old the first one, allow keeps both."] },
  { k: "p2.initiator-ts-narrow", scope: "p2", cli: "initiator-ts-narrow", type: "enum", vals: ["disable", "enable"], def: "disable", sec: "p2adv", lvl: "expert", sides: BOTH,
    it: ["Restringimento dei selettori", "Accetta reti più piccole proposte dall’altro lato", "Con IKEv2, se l’altro lato risponde con reti più piccole di quelle proposte, le accetta invece di rifiutare. Serve con alcuni apparati di altri produttori."],
    en: ["Selector narrowing", "Accepts smaller networks proposed by the other side", "With IKEv2, if the other side answers with networks smaller than those proposed, it accepts them instead of refusing. Needed with some other vendors’ devices."] }
];
OPTS.forEach(o => { if (!o.scope) o.scope = "p1"; });
const OPT_BY_KEY = Object.fromEntries(OPTS.map(o => [o.k, o]));
const ADV_SECTIONS = ["resil", "dialadv", "trans", "p1adv", "p2adv"];

/* Proposte e gruppi */
const P1_PROPS = [
  { v: "aes256gcm-prfsha384", b: "rec", ike2: true }, { v: "aes256gcm-prfsha256", ike2: true }, { v: "aes128gcm-prfsha256", ike2: true },
  { v: "chacha20poly1305-prfsha256", ike2: true }, { v: "aes256-sha512" }, { v: "aes256-sha384" }, { v: "aes256-sha256", b: "rec" },
  { v: "aes128-sha256" }, { v: "aes256-sha1", b: "legacy" }, { v: "aes128-sha1", b: "legacy" }, { v: "3des-sha1", b: "weak" }
];
const P2_PROPS = [
  { v: "aes256gcm", b: "rec" }, { v: "aes128gcm" }, { v: "chacha20poly1305" }, { v: "aes256-sha512" }, { v: "aes256-sha384" },
  { v: "aes256-sha256", b: "rec" }, { v: "aes128-sha256" }, { v: "aes256-sha1", b: "legacy" }, { v: "aes128-sha1", b: "legacy" }, { v: "3des-sha1", b: "weak" }
];
const DH_GROUPS = [
  { v: "21", b: "rec" }, { v: "20", b: "rec" }, { v: "19" }, { v: "32" }, { v: "31" }, { v: "16" }, { v: "15" }, { v: "14" },
  { v: "5", b: "weak" }, { v: "2", b: "weak" }, { v: "1", b: "weak" }
];
/* Corrispondenze FortiClient (valori presi da un export reale di FortiClient 7.4.3) */
const FCT_P1 = { "aes256-sha256": "AES256|SHA256", "aes256-sha384": "AES256|SHA384" };
const FCT_P2 = { "aes256-sha256": "AES256|SHA256", "aes256gcm": "AES256GCM|NONE" };
