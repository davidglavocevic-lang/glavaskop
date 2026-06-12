# GLAVAŠ KOP web stranica

Profesionalna višestranična web stranica za zemljane radove, izrađena u čistom HTML-u, CSS-u i JavaScriptu bez dodatnih paketa.

## Pokretanje

Najjednostavnije je otvoriti projekt u VS Codeu i pokrenuti `index.html` ekstenzijom Live Server.

Može se pokrenuti i lokalnim serverom:

```bash
python3 -m http.server 8000
```

Zatim otvorite `http://localhost:8000`.

## Gdje se mijenjaju podaci

- Podaci firme, kontakt, usluge i tekstovi: `data/company-data.js`
- Projekti: `data/projects-data.js`
- Demo recenzije: `data/reviews-data.js`
- Fotografije: `images/`

Vrijednosti `DODATI_STVARNU_ADRESU` i `DODATI_STVARNI_OIB` treba zamijeniti stvarnim podacima prije objave.

## Admin demo

Admin prijava dostupna je na `admin-login.html`.

- Korisničko ime: `demo`
- Lozinka: `demo`

Promjene projekata u demo adminu spremaju se samo u `localStorage` trenutnog preglednika. To nije produkcijska sigurnost ni trajna baza podataka.

Za stvarni vlasnički pristup potrebno je povezati:

- sigurnu backend autentikaciju, primjerice Supabase Auth
- bazu podataka za projekte i recenzije
- pohranu fotografija
- serversku validaciju i pravila pristupa

Stvarne lozinke ne smiju se spremati u JavaScript datoteke.

## Kontakt forma i recenzije

Kontakt forma validira podatke i otvara korisnikov e-mail program s pripremljenom porukom. Za automatsko slanje potrebno ju je povezati s backend servisom.

Recenzije su jasno označeni demo podaci. Datoteka `data/reviews-data.js` kasnije se može zamijeniti pozivom prema vlastitom backendu koji dohvaća odobrene stvarne recenzije.
