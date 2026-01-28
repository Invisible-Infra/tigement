# Uživatelský manuál Tigement (CZ)

Vítejte v Tigementu – pracovním prostoru pro plánování času a úkolů. Tento manuál provede základními pojmy a každodenním používáním.

## Obsah
- [Účel & filozofie plánování](#ucel)
- [Úvod & Pojmy](#pojmy)
- [Začínáme](#zaciname)
- [Práce ve Workspace](#workspace)
- [Plánovací workflow (Den)](#workflow)
- [Automatické plánování & výpočty](#automat)
- [Mobilní UX](#mobilni-ux)
- [Skupiny úkolů](#skupiny)
- [Poznámkové bloky (Notebooks)](#notebooky)
- [Export (CSV / Markdown Review)](#export)
- [Platby & Premium](#platby)
- [Zapomenuté heslo](#zapomenute-heslo)
- [Archivace tabulek](#archivace)
- [Nastavení & Profil](#nastaveni)
- [Zálohování & Obnova dat](#zaloha)
- [Zkratky & Tipy](#zkratky)

<a id="ucel"></a>
## Účel & filozofie plánování
Tigement je optimalizovaný pro plán reálného dne. Zadáváte úkoly s délkami a aplikace je rozloží na časovou osu. Místo mikromanagementu začátků se soustředíte na pořadí a délku. Tigement pak automaticky spočítá začátky/konce, udržuje součet a umožňuje rychlé iterace.

<a id="pojmy"></a>
## Úvod & Pojmy
- Tabulky: dva typy – Den (plán s datem) a TODO (backlog). Každá tabulka obsahuje úkoly.
- Úkoly: název, volitelný začátek/konec (u Den), délka, výběr, skupina a poznámky (notebook).
- **End-to-End šifrování**: Veškerá data workspace jsou zašifrována na vašem zařízení před synchronizací. Pouze vy je můžete dešifrovat pomocí hesla. Dokonce ani vlastník serveru nemůže vidět vaše úkoly, poznámky nebo jakýkoliv obsah workspace.
- Sync: přihlášení uživatelé mohou synchronizovat šifrovaný workspace.

<a id="zaciname"></a>
## Začínáme
1. Zaregistrujte se a přihlaste.
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

<a id="export"></a>
## Export
- CSV Export/Import v postranním panelu.
- Markdown „Export Review“ u každé tabulky – vygeneruje `YYMMDD-nazev.md` se seznamem úkolů, časy a součtem.

<a id="platby"></a>
## Platby & Premium
- BTCPay pokladna s kupóny.
- Aktivace předplatného přes webhooky; idempotentní zpracování.
- Při použití Cloudflare nastavte odpovídající povolovací pravidla.

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
- **Témata**: Vyberte si z Light (Moderní), Classic (Retro), Dark (Tmavý), Terminal (Hacker) nebo ZX Spectrum (autentická 8-bitová estetika Sinclair ZX Spectrum s jasně azurovou a černou).
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

<a id="zkratky"></a>
## Zkratky & Tipy
- Undo / Redo v postranním panelu.
- Přepínání mezi přímou editací času a volbou přes timepicker.
- Hromadné zatržení: „Select All“ checkbox v hlavičce.

