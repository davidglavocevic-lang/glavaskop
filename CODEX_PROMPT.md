# PROMPT ZA CODEX: NOVA PROFESIONALNA GLAVASKOP WEB STRANICA

Radi izravno u trenutno otvorenom VS Code projektu. Kao glavni izvor zahtjeva obavezno prvo pročitaj:

`/Users/davidglavocevic/Documents/GLAVASKOP_PROMPT.md`

Nemoj mi samo objašnjavati što bi trebalo napraviti i nemoj stati na planu. Pregledaj postojeće datoteke, zatim implementiraj, pokreni i testiraj cijelu novu stranicu.

## Glavni zadatak

Potpuno zamijeni postojeću web stranicu novom, modernom i profesionalnom stranicom za GLAVASKOP. Smiješ obrisati ili zamijeniti postojeći HTML, CSS i JavaScript koji više nije potreban. Prije brisanja pregledaj lokalne slike i zadrži sve kvalitetne slike koje se mogu iskoristiti.

Vizualne, sadržajne i funkcionalne smjernice preuzmi iz `GLAVASKOP_PROMPT.md`, ali ih poboljšaj gdje je potrebno. Konačni rezultat mora izgledati kao ozbiljna premium web stranica stvarne građevinske tvrtke, a ne kao generički predložak ili školski projekt.

## Tehnologija i arhitektura

Koristi Vite + React. Koristi postojeći styling sustav ako projekt već ima dobru konfiguraciju; u suprotnom koristi obični modularni CSS s CSS varijablama. Nemoj uvoditi nepotrebne pakete.

Organiziraj projekt u ponovljive komponente i jasne cjeline, primjerice:

```text
src/
  components/
  pages/
  data/
    companyData.js
    projects.js
    reviews.js
  services/
    reviewsService.js
    authService.js
  styles/
  App.jsx
  main.jsx
```

Koristi routing za odvojene stranice. Javne stranice i admin ne smiju biti samo sekcije iste HTML stranice.

## Najvažnije: svi podaci firme u jednoj datoteci

Napravi jednu centralnu datoteku `src/data/companyData.js`. U njoj moraju biti svi podaci specifični za firmu:

- naziv i kratki naziv firme
- slogan i hero tekst
- opis firme i tekst sekcije O nama
- telefon, e-mail, adresa i radno vrijeme
- OIB i ostali pravni podaci, ako su poznati
- društvene mreže
- navigacija
- popis usluga i opisi
- statistike
- podaci o mehanizaciji
- CTA tekstovi
- SEO naslov i opis
- podaci za footer

Komponente ne smiju sadržavati hardkodirane podatke firme kada ih mogu čitati iz `companyData.js`. Želim kasnije istu stranicu prilagoditi drugoj firmi uglavnom promjenom te jedne datoteke, slika i projekata.

Ako neki stvarni podatak nije poznat, označi ga jasnim placeholderom poput `DODATI_STVARNI_TELEFON`. Nemoj izmišljene podatke prikazivati kao činjenice.

## Javna web stranica

Izradi najmanje ove rute:

- `/` - profesionalna početna stranica
- `/projekti` - svi projekti s filtriranjem
- `/projekti/:slug` - detalji pojedinog projekta
- `/o-nama` - informacije o firmi
- `/kontakt` - kontakt forma i kontakt podaci
- `/admin/login` - prijava vlasnika
- `/admin` - zaštićeni admin dashboard

Početna stranica treba sadržavati:

- sticky navigaciju i dobar mobilni meni
- snažan hero s jasnim CTA gumbima
- usluge
- zašto odabrati GLAVASKOP
- mehanizaciju
- istaknute projekte
- Top 5 recenzija
- sekciju O nama
- završni CTA i kontakt
- profesionalni footer

Koristi sadržaj i vizualni smjer iz `GLAVASKOP_PROMPT.md`, ali poboljšaj raspored, tipografiju, razmake, responsivnost i ukupnu jasnoću. Dizajn treba biti robustan i građevinski, ali elegantan. Animacije trebaju biti suptilne i ne smiju usporavati stranicu.

## Top 5 recenzija

Napravi profesionalnu sekciju `Top 5 recenzija` s pet privremenih recenzija. Svaka recenzija treba imati:

- ime osobe
- ocjenu od 1 do 5
- tekst
- datum
- izvor
- opcionalnu profilnu sliku
- oznaku je li recenzija potvrđena

Privremene recenzije jasno označi u kodu kao demo podatke. Ne predstavljaj ih kao stvarne Google recenzije.

Podatke drži u `src/data/reviews.js`, a prikaz recenzija napravi kroz `src/services/reviewsService.js`. Servis sada može čitati lokalne podatke, ali struktura mora biti spremna da se kasnije lako poveže s pravim izvorom recenzija ili backend API-jem bez mijenjanja UI komponenti.

Prikaži prosječnu ocjenu, broj recenzija, zvjezdice i kartice recenzija. Sekcija mora izgledati vjerodostojno i profesionalno na desktopu i mobitelu.

## Zaseban i zaštićen admin

Admin mora biti zasebna stranica s vlastitim layoutom, dostupna na `/admin`. Ne prikazuj admin link kao glavni istaknuti element javne navigacije. Može biti diskretan link u footeru ili se adminu može pristupiti izravnim URL-om.

Dodaj:

- `/admin/login`
- login formu
- zaštićenu admin rutu
- odjavu
- dashboard
- pregled, dodavanje, uređivanje i brisanje projekata
- upravljanje osnovnim sadržajem i recenzijama
- validaciju formi
- potvrdu prije brisanja
- prazna, loading i error stanja

Važno: skriveni link, lozinka u JavaScriptu ili samo `localStorage` nisu prava sigurnost. Napravi čist `authService` i protected-route arhitekturu. Ako nema backenda, implementiraj samo jasno označen development/demo login te u README-u objasni da se za produkcijski pristup samo vlasniku mora povezati pravi backend autentikacijski sustav, primjerice Supabase Auth ili vlastiti server. Nikakvu stvarnu lozinku nemoj hardkodirati niti commitati.

Admin dizajn treba biti profesionalan, pregledan i prilagođen desktopu i mobitelu, ali vizualno odvojen od javne stranice.

## Projekti i sadržaj

Podatke projekata drži odvojeno u `src/data/projects.js`. Svaki projekt treba podržavati:

- `id`
- `slug`
- naslov
- kategoriju
- lokaciju
- kratki i puni opis
- naslovnu sliku
- galeriju
- datum
- status
- korištenu mehanizaciju
- tehničke podatke
- istaknuti projekt

Iskoristi postojeće lokalne slike gdje odgovaraju. Nemoj koristiti pokvarene vanjske URL-ove. Sve slike optimiziraj za prikaz, dodaj smislen hrvatski `alt`, lazy loading gdje ima smisla i spriječi layout shift.

## Kvaliteta

Obavezno:

- mobile-first i potpuno responzivan prikaz
- semantički HTML
- pristupačna navigacija, forme i modali
- vidljiva focus stanja
- dobar kontrast
- ispravni naslovi stranica i osnovni SEO meta podaci
- Open Graph meta podaci
- favicon ili jednostavan inicijalni brand znak
- 404 stranica
- bez JavaScript grešaka u konzoli
- bez mrtvih linkova i gumba koji ništa ne rade
- kontakt forma s frontend validacijom i jasnom porukom uspjeha; pripremi servis za kasnije spajanje na backend
- poštivanje `prefers-reduced-motion`
- čist, čitljiv i ponovljiv kod

Sav javni tekst mora biti na prirodnom hrvatskom jeziku. Ispravi tipfelere i nemoj koristiti generičke AI fraze.

## Način rada

1. Pročitaj cijeli `GLAVASKOP_PROMPT.md`.
2. Pregledaj cijeli postojeći projekt i lokalne slike.
3. Napiši kratak plan.
4. Zamijeni staru implementaciju novom.
5. Instaliraj samo potrebne pakete.
6. Implementiraj sve javne i admin rute.
7. Pokreni formatter/linter ako postoji.
8. Pokreni production build i popravi sve greške.
9. Provjeri najvažnije funkcije i responzivnost.
10. Ažuriraj `README.md` s uputama za pokretanje, uređivanje `companyData.js`, zamjenu demo recenzija i buduće spajanje pravog admin logina.

Nemoj završiti dok projekt nije funkcionalan. Na kraju mi sažeto napiši:

- koje si datoteke i funkcionalnosti napravio
- kako pokrenuti projekt
- gdje mijenjam podatke firme
- gdje mijenjam projekte i recenzije
- što još zahtijeva pravi backend za produkciju
- rezultate builda i testova
