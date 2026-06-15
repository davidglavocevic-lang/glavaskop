begin;

create table if not exists public.website_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists website_settings_updated_at on public.website_settings;
create trigger website_settings_updated_at
before update on public.website_settings
for each row execute function public.set_updated_at();

alter table public.website_settings enable row level security;

drop policy if exists website_settings_public_read on public.website_settings;
create policy website_settings_public_read on public.website_settings
for select to anon, authenticated
using (id = 'company');

drop policy if exists website_settings_admin_insert on public.website_settings;
create policy website_settings_admin_insert on public.website_settings
for insert to authenticated
with check (public.is_organizer_admin());

drop policy if exists website_settings_admin_update on public.website_settings;
create policy website_settings_admin_update on public.website_settings
for update to authenticated
using (public.is_organizer_admin())
with check (public.is_organizer_admin());

insert into public.website_settings (id, data)
values (
  'company',
  '{
    "name": "GLAVAŠ KOP",
    "shortName": "GK",
    "legalName": "GLAVAŠ KOP",
    "eyebrow": "SNAGA KOJA GRADI",
    "slogan": "Teren pripremamo. Planove pokrećemo.",
    "heroTitle": "Pouzdani zemljani radovi za projekte bez zastoja.",
    "heroText": "Iskopi, rušenja, priprema i uređenje terena uz precizan dogovor, odgovoran rad i mehanizaciju prilagođenu svakom gradilištu.",
    "about": "GLAVAŠ KOP izvodi zemljane radove za privatne, poslovne i manje infrastrukturne projekte. Svakom poslu pristupamo organizirano, od prvog pregleda terena do završnog ravnanja i odvoza materijala.",
    "aboutExtended": "Naš fokus je jednostavan: jasan dogovor, sigurna izvedba i uredno gradilište. Iskustvo na različitim terenima pomaže nam unaprijed prepoznati izazove i ponuditi rješenje koje štedi vrijeme, materijal i nepotrebne troškove.",
    "phone": "091 553 0077",
    "phoneHref": "+385915530077",
    "email": "info@glavaskop.hr",
    "address": "DODATI_STVARNU_ADRESU",
    "serviceArea": "Zagreb i okolica",
    "workingHours": "Pon - Sub: 07:00 - 18:00",
    "oib": "DODATI_STVARNI_OIB",
    "seo": {
      "title": "GLAVAŠ KOP | Iskopi i uređenje terena",
      "description": "Profesionalni iskopi, rušenja, priprema i uređenje terena. Zatražite procjenu i dogovorite pregled terena."
    },
    "services": [
      {"number":"01","icon":"⌁","title":"Iskopi i priprema terena","text":"Iskop temelja, kanala, bazena i instalacija te precizna priprema podloge za nastavak gradnje."},
      {"number":"02","icon":"◇","title":"Rušenja i uklanjanje","text":"Kontrolirano uklanjanje manjih objekata, zidova, betona i starih površina uz organiziran odvoz."},
      {"number":"03","icon":"▰","title":"Ravnanje i uređenje","text":"Planiranje terena, priprema dvorišta, prilaza i površina za opločenje, travnjak ili druge završne slojeve."},
      {"number":"04","icon":"↗","title":"Odvoz i dovoz materijala","text":"Odvoz zemlje i šute te dovoz tampona, šljunka i drugog materijala potrebnog za kvalitetnu izvedbu."}
    ],
    "advantages": [
      {"value":"01","label":"Jedna kontakt osoba od dogovora do završetka"},
      {"value":"02","label":"Mehanizacija za uske i zahtjevne terene"},
      {"value":"03","label":"Jasna procjena opsega prije početka rada"},
      {"value":"04","label":"Odgovoran odnos prema prostoru i susjedstvu"}
    ],
    "stats": [
      {"value":"100%","label":"Fokus na kvalitetnu izvedbu"},
      {"value":"4","label":"Ključne skupine usluga"},
      {"value":"1","label":"Pouzdan tim za cijeli posao"},
      {"value":"24 h","label":"Ciljani rok prvog odgovora"}
    ],
    "equipment": [
      {"title":"Mini bager","tag":"PRECIZAN RAD","text":"Idealan za dvorišta, uske prolaze, kanale i rad uz postojeće objekte.","image":"images/slika1.jpeg"},
      {"title":"Bager s hidrauličnim čekićem","tag":"RUŠENJE","text":"Za kontrolirano razbijanje betonskih površina i uklanjanje tvrdih prepreka.","image":"images/slika2.jpeg"},
      {"title":"Kompaktni utovarivač","tag":"BRZA MANIPULACIJA","text":"Za premještanje materijala, čišćenje i fino oblikovanje radne površine.","image":"images/slika3.jpeg"}
    ],
    "process": [
      {"step":"01","title":"Pošaljite upit","text":"Opišite posao i po mogućnosti priložite fotografije terena."},
      {"step":"02","title":"Pregled i procjena","text":"Dogovaramo detalje, pristup strojevima i realan opseg radova."},
      {"step":"03","title":"Izvedba","text":"Dolazimo prema dogovoru i izvodimo radove organizirano i sigurno."},
      {"step":"04","title":"Uredno završavanje","text":"Provjeravamo izvedeno i ostavljamo teren spreman za sljedeću fazu."}
    ],
    "navigation": [
      {"label":"Početna","href":"index.html"},
      {"label":"Usluge","href":"index.html#usluge"},
      {"label":"Projekti","href":"projects.html"},
      {"label":"O nama","href":"about.html"},
      {"label":"Kontakt","href":"contact.html"}
    ],
    "socials": []
  }'::jsonb
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-website-images',
  'public-website-images',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists website_images_admin_insert on storage.objects;
create policy website_images_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'public-website-images' and public.is_organizer_admin());

drop policy if exists website_images_admin_update on storage.objects;
create policy website_images_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'public-website-images' and public.is_organizer_admin())
with check (bucket_id = 'public-website-images' and public.is_organizer_admin());

drop policy if exists website_images_admin_delete on storage.objects;
create policy website_images_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'public-website-images' and public.is_organizer_admin());

commit;
