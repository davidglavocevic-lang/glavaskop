# GLAVAŠ KOP web stranica i Organizer

Javna višestranična web stranica i privatni poslovni Organizer povezan sa Supabase Authom, PostgreSQL bazom i privatnim Storage bucketom. Deploy je pripremljen za Vercel.

## Lokalno pokretanje

Za javne statičke stranice dovoljan je lokalni HTTP server. Organizer za rad treba Vercel serverless rutu `/api/config`, pa ga lokalno pokrenite Vercel CLI-jem:

```bash
npm install
npx vercel dev
```

Provjera JavaScript sintakse:

```bash
npm run check
```

## Supabase setup

Koristi se postojeći projekt **GLAVASKOP Test(Web+Org)**. Ne kreirati novi Supabase projekt.

1. Primijenite sve migracije iz direktorija:

```text
supabase/migrations/
```

2. Migracija kreira:

- `profiles`
- `employees`
- `internal_projects`
- `project_workers`
- `employee_payments`
- `employee_work_hours`
- `expenses`
- `project_files`
- `calendar_events`
- `calendar_reminders`
- `holidays`
- `push_subscriptions`
- `website_projects`
- `website_settings`

3. Migracija uključuje RLS na svim privatnim tablicama. Pristup imaju samo prijavljeni korisnici čiji je `profiles.role` jednak `owner` ili `admin`.
4. Postojeći Supabase korisnik s e-mailom `davidglavocevic@gmail.com` automatski dobiva ulogu `owner`. Ako vlasnički Auth korisnik koristi drugu adresu, u SQL Editoru promijenite njegov profil:

```sql
update public.profiles
set role = 'owner'
where email = 'STVARNI_VLASNICKI_EMAIL';
```

Registracija nije izložena u aplikaciji. Vlasničkog korisnika kreirajte ili pozovite kroz Supabase Authentication.

## Private Storage

Migracija kreira privatni bucket `private-project-files` i Storage policies za owner/admin korisnike.

- Slike: `projects/{project_id}/images/...`
- Dokumenti: `projects/{project_id}/documents/...`
- Privatne datoteke nemaju public URL.
- Prikaz i download koriste kratkotrajni signed URL.
- PDF limit je 20 MB.

Slike se prije uploada u browseru smanjuju na najviše 2000 px, pretvaraju u WebP kada je podržan i spremaju s kvalitetom `0.75`. U `project_files` se spremaju originalna i komprimirana veličina.

## Public Website Storage

Bucket `public-website-images` sadrži javne naslovne i galerijske fotografije web projekata te fotografije mehanizacije. Upload, zamjena i brisanje rade kroz admin, a pisanje je dopušteno samo owner/admin korisnicima.

## Vercel environment variables

Sve varijable iz [.env.example](.env.example) treba postaviti za Production, Preview i Development prema potrebi:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
CRON_SECRET
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` i `VAPID_PRIVATE_KEY` smiju se koristiti samo server-side. Nikad ih ne commitati niti slati u browser.

## Push i podsjetnici

Organizer uvijek provjerava podsjetnike dok je otvoren i prikazuje in-app obavijest. Uz dopuštenje preglednika koristi i Notification API.

Background push koristi:

- `POST /api/push/subscribe`
- `POST /api/push/unsubscribe`
- `POST /api/push/test`
- `GET /api/cron/send-reminders`

Cron endpoint zahtijeva `Authorization: Bearer ${CRON_SECRET}`. Produkcijski `vercel.json` koristi dnevni poziv u `06:00 UTC` jer povezani Vercel Hobby plan ne dopušta češći raspored. Za stvarni background podsjetnik svakih pet minuta promijenite schedule u `*/5 * * * *` nakon prelaska na Vercel Pro ili pozivajte isti zaštićeni endpoint vanjskim schedulerom. In-app podsjetnici rade svake minute dok je Organizer otvoren.

VAPID ključevi mogu se generirati naredbom:

```bash
npx web-push generate-vapid-keys
```

## Rute

```text
/admin/login
/admin/web
/admin/web/projekti
/admin/web/recenzije
/admin/web/sadrzaj
/admin/organizer
/admin/organizer/kalendar
/admin/organizer/mitarbeiter
/admin/organizer/radni-sati
/admin/organizer/projekte
/admin/organizer/projekte/{id}
/admin/organizer/isplate
/admin/organizer/nacrti
/admin/organizer/troskovi
```

## Podaci javne stranice

- Podaci firme, kontakt, usluge i mehanizacija: Supabase `website_settings`, uređivanje na `/admin/web/sadrzaj`
- Javni projekti: Supabase tablica `website_projects`, uređivanje na `/admin/web/projekti`
- Javne fotografije: Supabase Storage bucket `public-website-images`
- `data/company-data.js` ostaje fallback ako Supabase privremeno nije dostupan
- `data/projects-data.js` ostaje fallback ako Supabase privremeno nije dostupan
- Demo recenzije: `data/reviews-data.js`
- Fotografije: `images/`

Adresu, OIB i ostale podatke mijenjajte kroz admin bez izmjene koda.

Javni projekti i demo recenzije ostaju odvojeni od privatnih Organizer podataka. Javna stranica ne dohvaća nijednu Organizer tablicu.

## Dnevna evidencija radnih sati

Ruta `/admin/organizer/radni-sati` omogućuje unos sati za više radnika po datumu i projektu. Svaki zapis čuva satnicu koja je vrijedila na dan unosa. Zarada se računa iz dnevnih sati, dok dogovoreni fiksni iznos na projektu ima prednost i ne zbraja se dvaput.

## Deploy

Projekt je povezan s Vercel projektom `davidglavocevic-glavaskop`.

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add NEXT_PUBLIC_SITE_URL production
npx vercel env add CRON_SECRET production
npx vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production
npx vercel env add VAPID_PRIVATE_KEY production
npx vercel env add VAPID_SUBJECT production
npx vercel --prod
```
