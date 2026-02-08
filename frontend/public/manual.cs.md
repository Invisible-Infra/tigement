# Uživatelský manuál Tigement (CZ)

Vítejte v Tigementu – pracovním prostoru pro plánování času a úkolů. Tento manuál provede základními pojmy a každodenním používáním.

## Obsah
- [Účel & filozofie plánování](#ucel)
- [Úvod & Pojmy](#pojmy)
- [Začínáme](#zaciname)
- [Práce ve Workspace](#workspace)
- [Prostory (Spaces)](#prostory)
- [Plánovací workflow (Den)](#workflow)
- [Automatické plánování & výpočty](#automat)
- [Mobilní UX](#mobilni-ux)
- [Skupiny úkolů](#skupiny)
- [Poznámkové bloky (Notebooks)](#notebooky)
- [Deník](#denik)
- [Statistiky](#statistiky)
- [Export (CSV / Markdown Review)](#export)
- [Platby & Premium](#platby)
- [Sdílení tabulek](#sdileni)
- [iCal odběr](#ical)
- [OAuth & přihlášení](#oauth)
- [Zapomenuté heslo](#zapomenute-heslo)
- [Archivace tabulek](#archivace)
- [Nastavení & Profil](#nastaveni)
- [Zálohování & Obnova dat](#zaloha)
- [AI asistent](#ai-asistent)
- [API tokeny](#api-tokeny)
- [Úvodní průvodce & Tutoriál](#uvodni-pruvodce)
- [Zkratky & Tipy](#zkratky)

<a id="ucel"></a>
## Účel & filozofie plánování
Tigement je optimalizovaný pro plán reálného dne. Zadáváte úkoly s délkami a aplikace je rozloží na časovou osu. Místo mikromanagementu začátků se soustředíte na pořadí a délku. Tigement pak automaticky spočítá začátky/konce, udržuje součet a umožňuje rychlé iterace.

<a id="pojmy"></a>
## Úvod & Pojmy
- Tabulky: dva typy – Den (plán s datem) a TODO (backlog). Každá tabulka obsahuje úkoly.
- Úkoly: název, volitelný začátek/konec (u Den), délka, výběr, skupina a poznámky (notebook).
- **End-to-End šifrování**: Veškerá data workspace jsou zašifrována na vašem zařízení před synchronizací. Pouze vy je můžete dešifrovat pomocí hesla. Dokonce ani vlastník serveru nemůže vidět vaše úkoly, poznámky nebo jakýkoliv obsah workspace.
- Sync: prémioví uživatelé mohou synchronizovat šifrovaný workspace mezi zařízeními.

<a id="zaciname"></a>
## Začínáme
1. Zaregistrujte se a přihlaste (e-mail/heslo nebo OAuth: Google, GitHub, Apple, X, Facebook).
2. Přidejte tabulku Den nebo TODO v pravém postranním panelu.
3. Přidejte úkoly; u Den se časy řetězí od počátečního času tabulky.
4. Na mobilu otevřete postranní panel tlačítkem (hamburger).

<a id="workspace"></a>
## Práce ve Workspace
- Řazení úkolů:
  - Desktop: tažením kdekoliv v řádku.
  - Mobil: tažením přes ikony ▲/▼ (během přesunu je scroll uzamčen).
- Výběr úkolů checkboxem; hromadné akce – přidat do skupiny nebo smazat.
- Na mobilu je stránkování fixně dole s tlačítky a rozbalovacím seznamem.
- Umístění kurzoru v názvu úkolu odpovídá přesnému kliknutí.
- **Režimy zobrazení**: Vše v jednom (volný canvas) nebo Prostory (dny vlevo, TODO prostory vpravo). Přepínač v postranním panelu.
- **Zoom**: Pouze desktop – 50 % až 200 %. Rozdělené zobrazení v Prostorech: tažitelný oddělovač mezi dny a TODO panely.

<a id="prostory"></a>
## Prostory (Spaces)
- Organizujte TODO tabulky podle projektu, kontextu nebo kategorie. Každý prostor má název, ikonu a barvu.
- V režimu Prostory: dny jsou vlevo, TODO prostory vpravo. Přiřaďte každou TODO tabulku prostoru nebo „Všechny prostory“.
- Filtrujte workspace podle prostoru v režimu Vše v jednom. Pozice oddělovače (šířka levého/pravého panelu) se ukládá v nastavení.

<a id="workflow"></a>
## Plánovací workflow (Den)
1. Vytvořte tabulku Den – má datum a čas začátku prvního úkolu.
2. Přidejte úkoly v pořadí, v jakém je chcete dělat.
3. Nastavte realistickou délku (např. 00:30, 01:15). Použijte předvolby délky pro rychlý výběr (kliknutí na předvolbu nastaví délku okamžitě).
4. Tigement vypočítá začátky/konce řetězením délek od času začátku tabulky.
5. Změna pořadí okamžitě přepočítá celý den.
6. V hlavičce sledujte součet času (např. 8h).

Tip: Potřebujete pevný začátek? Nastavte čas začátku tabulky; ostatní se dopočítá podle délek.

<a id="automat"></a>
## Automatické plánování & výpočty
- Řetězení časů: konec úkolu N je začátek úkolu N+1.
- Změna délky aktualizuje všechny následující časy.
- Celkový součet: v hlavičce tabulky Den („Time sum“).
- Vizuální nápověda:
  - Začíná-li název úkolu časem (např. „09:30 Stand‑up“), aplikace ukáže shodu/neshodu s vypočteným začátkem.
  - Neshody zvýrazní, abyste snadno sladili očekávání s plánem.
- Mobilní bezpečnost: přesun jen přes ▲/▼, během přesunu je scroll zablokován.

<a id="mobilni-ux"></a>
## Mobilní UX
- Přesun je omezen na ▲/▼; dlouhé podržení názvu otevře „Přesun do tabulky“.
- Haptická odezva při otevření nabídky přesunu.
- Zámek scrollu během přesunu proti nechtěnému posunu stránky.

<a id="skupiny"></a>
## Skupiny úkolů
- Každý úkol může mít skupinu s ikonou a barvou.
- Kliknutí na ikonu (nebo tečku) otevře výběr; lze vytvářet vlastní skupiny.
- Pozadí názvu úkolu odpovídá barvě skupiny (text s automatickým kontrastem).
- Hromadné akce → Přidat vybrané do skupiny.

<a id="notebooky"></a>
## Notebooks
- Notebook workspace: obecné poznámky.
- Notebook úkolu: poznámky k úkolu (ikona knihy u úkolu).
- Podpora Markdownu (nadpisy, seznamy, tabulky, kód se zvýrazněním).
- Notebooky jsou pohyblivá okna, která lze přemísťovat.

<a id="denik"></a>
## Deník
- Denní deník s datovanými záznamy. Plná podpora Markdownu.
- Vytvářejte záznamy ze seznamu Deník; kliknutím otevřete. Režim úprav/náhled. Export jednotlivých záznamů do Markdownu.
- Tažitelné okno deníku na desktopu.

<a id="statistiky"></a>
## Statistiky
- Přehled: celkem tabulky, úkoly (aktivní/archivované), délka, archivované tabulky.
- Skupiny úkolů: počet, úkoly podle skupiny, délka podle skupiny.
- Úložiště: prohlížeč (localStorage) a server (prémiové).
- Export filtrovaných dat: filtr podle skupiny úkolů a rozsahu dat (vše, posledních 7/30 dní, tento měsíc, vlastní).

<a id="export"></a>
## Export
- CSV Export/Import v postranním panelu.
- Markdown „Export Review“ u každé tabulky – vygeneruje `YYMMDD-nazev.md` se seznamem úkolů, časy a součtem.

<a id="platby"></a>
## Platby & Premium
- BTCPay pokladna s kupóny. Více platebních metod: BTCPay, Stripe, PayPal (pokud povoleno).
- Referenční kupóny: prémioví uživatelé získávají kupóny při nákupu; sdílejte nebo použijte pro bezplatný prémiový čas.
- Aktivace předplatného přes webhooky; idempotentní zpracování.
- Při použití Cloudflare nastavte odpovídající povolovací pravidla.

<a id="sdileni"></a>
## Sdílení tabulek (Premium)
- E2EE sdílení tabulek e-mailem. Příjemci dostanou oprávnění Prohlížet nebo Upravovat.
- Tlačítko Sdílet v hlavičce tabulky. Příjemci vidí „Sdíleno se mnou“ v postranním panelu.
- Pouze prohlížení: otevřít tabulku, bez úprav. Úpravy: živá editace v SharedTableEditorModal nebo přidat do workspace a odeslat změny.
- Stáhnout změny: majitel i příjemce mohou stáhnout aktualizace. Řešení konfliktů při editaci více příjemci.

<a id="ical"></a>
## iCal odběr (Premium)
- URL živého kalendářového kanálu pro Google Calendar, Apple Calendar, Outlook.
- Profil → Aplikace & kalendář → povolit iCal odběr, zkopírovat URL.
- Soukromí: data se ukládají na serveru nešifrovaná kvůli kanálu. Pouze po volbě.

<a id="oauth"></a>
## OAuth & přihlášení
- Přihlášení přes Google, GitHub, Apple, X nebo Facebook (pokud povoleno vaší instancí).
- Uživatelé OAuth: nastavte šifrovací heslo při prvním přihlášení. Zapamatujte si ho – odemyká vaše data.
- „Důvěřovat zařízení 30 dní“ přeskočí 2FA pro tuto relaci.

<a id="zapomenute-heslo"></a>
## Zapomenuté heslo
- V přihlašovacím okně klikněte na „Zapomenuté heslo?“, v e-mailu otevřete odkaz a nastavte nové heslo.

<a id="archivace"></a>
## Archivace tabulek
- V menu tabulky (⋮) zvolte Archivovat.
- Archivované tabulky zmizí z workspace, ale zůstanou uložené v nabídce Archiv (postranní panel).
- Obnovení z nabídky Archiv (zobrazuje datum/název a počet úkolů).

<a id="nastaveni"></a>
## Nastavení & Profil
- Tlačítko profilu otevře Profil & Bezpečnost (2FA, iCal, Pokročilé šifrování).
- **End-to-End šifrování**: Data workspace jsou zašifrována klíčem odvozeným z vašeho hesla ještě před opuštěním vašeho zařízení. To znamená:
  - Vaše data jsou na serveru nečitelná – dokonce ani administrátor serveru nemá přístup k vašim úkolům, poznámkám nebo jakémukoliv obsahu workspace
  - Pouze vy můžete dešifrovat svá data pomocí hesla
  - Pokud zapomenete heslo, vaše zašifrovaná data nelze obnovit (používejte správce hesel)
  - V pokročilých nastaveních můžete nastavit vlastní šifrovací klíč pro dodatečnou bezpečnost
- Nastavení obsahuje preference workspace (téma, formáty času/data, časovače, volba timepickerů).
- **Předvolby délky**: Nastavte rychlé tlačítka ve výběru délky. Zadejte minuty oddělené čárkou (např. "15, 30, 60, 120"). Kliknutí na předvolbu nastaví délku okamžitě bez nutnosti stisknout "Hotovo".

<a id="zaloha"></a>
## Zálohování & Obnova dat

### Zálohování dat
- V menu Profil → sekce Bezpečnost → **Zálohování dat**, klikněte na "Stáhnout zálohu"
- Exportuje všechna vaše data (tabulky, nastavení, skupiny úkolů, poznámkové bloky, archivované tabulky) jako čitelný JSON soubor
- Formát názvu souboru: `tigement-backup-YYYY-MM-DD-HHMMSS.json`
- Dostupné všem uživatelům (zdarma i premium)
- **Důležité**: Pravidelně zálohujte svá data, zejména pokud používáte vlastní šifrovací klíč

### Ochrana před selháním dešifrování
Pokud váš šifrovací klíč neodpovídá datům na serveru (např. po změně hesla nebo nastavení vlastního klíče na jiném zařízení), Tigement:

1. **Blokuje synchronizační operace**, aby zabránil ztrátě dat
2. **Automaticky otevře menu Profil** s varovným bannerem
3. **Nabídne dvě možnosti obnovy**:
   - **Zadat vlastní klíč**: Pokud používáte vlastní šifrovací klíč, zadejte ho pro obnovení přístupu. Aplikace automaticky zopakuje synchronizaci.
   - **Vynutit přepsání**: ⚠️ **Varování**: Toto trvale smaže všechna zašifrovaná data na serveru. Použijte to pouze pokud si jste jisti, že chcete přepsat data na serveru aktuálními lokálními daty.

**Proč k tomu dochází:**
- Pokud resetujete heslo účtu přes "Zapomenuté heslo", nové heslo se stane šifrovacím klíčem
- Pokud jste předtím měli vlastní šifrovací klíč, nové heslo neodšifruje stará data
- Vždy znovu nastavte svůj vlastní šifrovací klíč po resetu hesla, nebo použijte stejné heslo, které bylo použito při šifrování dat

**Doporučené postupy:**
- Používejte správce hesel pro zapamatování šifrovacího hesla
- Nastavte vlastní šifrovací klíč a používejte ho konzistentně na všech zařízeních
- Pravidelně stahujte zálohy, abyste měli lokální kopii svých dat
- Pokud resetujete heslo, okamžitě znovu nastavte svůj vlastní šifrovací klíč (pokud jste ho používali)

<a id="ai-asistent"></a>
## AI asistent
- Přineste si vlastní AI (BYOA): připojte OpenAI, Anthropic nebo vlastní (Ollama, LM Studio). Vaše API klíče, vaše soukromí.
- Profil → AI asistent: nastavení poskytovatele, API klíče, modelu, režimu (Náhled/Automatický).
- Menu Workspace → AI asistent: zadejte požadavky (např. „Přesuň pondělní úkoly na úterý“). Režim náhledu: prohlédněte změny před použitím. Časové okno pro vrácení: revertujte AI akce v konfigurovatelném čase.
- Historie AI: zobrazení minulých AI akcí a vrácení nedávných změn.

<a id="api-tokeny"></a>
## API tokeny
- Profil → Vývojář & pokročilé → API tokeny. Generujte tokeny pro CLI a integrace.
- Rozsahy: workspace:read, workspace:write. Volitelně: povolit dešifrování pro CLI.
- Formát tokenu: `tig.PREFIX.TEK`. Uložte ihned – tokeny nelze znovu načíst.

<a id="uvodni-pruvodce"></a>
## Úvodní průvodce & Tutoriál
- Uvítací modál a interaktivní tutoriál při prvním spuštění. Zobrazí se automaticky (pokud není zakázáno).
- Nápověda → Tutoriál / Úvodní průvodce pro znovuotevření. Tutoriál běží v sandboxu – nemění uživatelská data.
- Kroky: čas začátku dne, názvy úkolů, délky, řazení, přesouvání úkolů mezi tabulkami.
- Nápověda → Resetovat úvodní průvodce / Znovu povolit úvodní průvodce pro reset příznaků.

<a id="zkratky"></a>
## Zkratky & Tipy
- Undo / Redo v postranním panelu.
- Přepínání mezi přímou editací času a volbou přes timepicker.
- Hromadné zatržení: „Select All“ checkbox v hlavičce.

---
Tento manuál je verzovaný v repozitáři. Nejnovější online verzi otevřete přes „User Manual“ v menu aplikace.

