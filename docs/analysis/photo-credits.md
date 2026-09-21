# Photo credits — route stop images

**Data:** `server/prisma/data/athens-landmarks.js` (`PHOTO`, `COMMONS`), `server/prisma/seed.js` (POIs 10001–10010)
**Applied to an existing database by:** `server/scripts/apply-catalogue-fixes.js`
**Checked:** 2026-09-14

## What changed and why

The 74 POIs that are route stops (the 10 original demo POIs and the 64 curated
landmarks) used to share 12 Unsplash images. 53 of them showed a different
place and 6 only part of one (e.g. the Hellenic Parliament on Omonia Square and
on four museums, the Parthenon on the Areopagus and the Acropolis Museum, a
generic tree-lined path on the Byzantine Museum and the Lycabettus Funicular).
The route card image is the photo of the first stop that has one
(`routeRepository.js`, `favoriteRepository.js`), so a wrong stop photo was also
a wrong card photo.

Every stop POI now shows a photograph of that place:

- **Kept Unsplash images (Unsplash License)** — only where the image does show the
  place: see the table at the end.
- **Wikimedia Commons** — for the other 58 POIs, a freely licensed photograph
  (CC0, public domain, CC BY, CC BY-SA). Candidates came from the Wikipedia
  article's page image and Commons search; each chosen file was downloaded and
  inspected to confirm that it shows the named place and is a usable photograph
  (no maps, logos, plans or close-ups of people). Licence and author are taken
  from the Commons `extmetadata` (`LicenseShortName`, `Artist`).

No stop was left without a photo.

## Image URLs

`https://upload.wikimedia.org/wikipedia/commons/thumb/<h>/<hh>/<File>/960px-<File>`
(500px for the Museum of Greek Folk Art, whose original is 621 px wide).
Wikimedia serves only its standard thumbnail widths (…, 500, 960, 1280, …);
800px returns **HTTP 400**.

**User-Agent.** `upload.wikimedia.org` returns **HTTP 403**
to a request with no `User-Agent` or with a generic library one such as
`okhttp/4.12.0` ("Please set a user-agent and respect our robot policy"), and
**200** to a descriptive one. React Native's Android image loader
(`ReactOkHttpNetworkFetcher`) sends only the headers given in the `Image`
`source`, so OkHttp's default `okhttp/x` agent is used and the Commons photos
would not load on Android with a plain `{ uri }` source. The app therefore
builds every remote image source with `remoteImageSource()` in
`mobile/src/utils/remoteImage.ts`, which adds a descriptive `User-Agent` — the
identifying agent Wikimedia's policy asks for. Verified on the Android emulator
on 2026-09-14 (release build): the Commons photos load. Verified with curl
on all 56 distinct Commons URLs: 56 × 200 with a descriptive agent, 56 × 403
with `okhttp/4.12.0`. The 10 Unsplash URLs return 200 to both.

## Attribution requirements

CC BY and CC BY-SA require crediting the author and naming the licence with a
link; CC BY-SA additionally requires derivatives to keep the licence (the app
only displays the images unmodified, scaled). CC0 and public-domain files need
no credit and are listed for completeness. Licence texts:
CC BY 2.0/3.0/4.0 — https://creativecommons.org/licenses/by/4.0/ (and /2.0/, /3.0/, /3.0/pl/);
CC BY-SA 2.0/3.0/4.0 — https://creativecommons.org/licenses/by-sa/4.0/ (and /2.0/, /3.0/, /3.0/de/);
CC0 — https://creativecommons.org/publicdomain/zero/1.0/.

## Wikimedia Commons images

| POI id | POI | Commons file | Author | Licence |
|-------:|-----|--------------|--------|---------|
| 10004 | National Garden | [Attica 06-13 Athens 12 National Garden.jpg](https://commons.wikimedia.org/wiki/File:Attica_06-13_Athens_12_National_Garden.jpg) | A.Savin | CC BY-SA 3.0 |
| 10008 | Thissio Promenade | [Apostolou Pavlou Pedestrian Street on March 20, 2020.jpg](https://commons.wikimedia.org/wiki/File:Apostolou_Pavlou_Pedestrian_Street_on_March_20,_2020.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10009 | Kerameikos | [Kerameikos Cemetery on July 28, 2019.jpg](https://commons.wikimedia.org/wiki/File:Kerameikos_Cemetery_on_July_28,_2019.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10102 | Propylaea | [East Facade of the Propylaea on July 23, 2019.jpg](https://commons.wikimedia.org/wiki/File:East_Facade_of_the_Propylaea_on_July_23,_2019.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10104 | Temple of Athena Nike | [Temple of Athena Nikè from Propylaea, Acropolis, Athens, Greece.jpg](https://commons.wikimedia.org/wiki/File:Temple_of_Athena_Nik%C3%A8_from_Propylaea,_Acropolis,_Athens,_Greece.jpg) | Jebulon | CC0 |
| 10106 | Theatre of Dionysus | [Theatre of Dionysus Acropolis Athens Greece.jpg](https://commons.wikimedia.org/wiki/File:Theatre_of_Dionysus_Acropolis_Athens_Greece.jpg) | Jebulon | CC0 |
| 10107 | Acropolis Museum | [New Acropolis Museum building in Athens, Greece.jpg](https://commons.wikimedia.org/wiki/File:New_Acropolis_Museum_building_in_Athens,_Greece.jpg) | philip.mallis | CC BY-SA 2.0 |
| 10108 | Areopagus Hill | [Areopagus hill Saint Paul from Acropolis Athens.jpg](https://commons.wikimedia.org/wiki/File:Areopagus_hill_Saint_Paul_from_Acropolis_Athens.jpg) | Jebulon | CC0 |
| 10109 | Dionysiou Areopagitou | [View of the Acropolis of Athens from Dionysiou Areopagitou pedestrian street.jpg](https://commons.wikimedia.org/wiki/File:View_of_the_Acropolis_of_Athens_from_Dionysiou_Areopagitou_pedestrian_street.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10111 | Stoa of Attalos | [Stoa of Attalos, Athens, Greece.jpg](https://commons.wikimedia.org/wiki/File:Stoa_of_Attalos,_Athens,_Greece.jpg) | Julian Lupyan | CC0 |
| 10115 | Library of Hadrian | [The west facade in Pentelic marble with columns of Karystos marble of the Library of Hadrian, Athens (14023204344).jpg](https://commons.wikimedia.org/wiki/File:The_west_facade_in_Pentelic_marble_with_columns_of_Karystos_marble_of_the_Library_of_Hadrian,_Athens_%2814023204344%29.jpg) | Carole Raddato from FRANKFURT, Germany | CC BY-SA 2.0 |
| 10116 | Kerameikos Archaeological Site | [Kerameikos Cemetery on July 28, 2019.jpg](https://commons.wikimedia.org/wiki/File:Kerameikos_Cemetery_on_July_28,_2019.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10117 | Arch of Hadrian | [Attica 06-13 Athens 24 Arch of Hadrian.jpg](https://commons.wikimedia.org/wiki/File:Attica_06-13_Athens_24_Arch_of_Hadrian.jpg) | A.Savin | CC BY-SA 3.0 |
| 10118 | Temple of Olympian Zeus | [L'Olympieion (Athènes) (30776483926).jpg](https://commons.wikimedia.org/wiki/File:L%27Olympieion_%28Ath%C3%A8nes%29_%2830776483926%29.jpg) | Jean-Pierre Dalbéra from Paris, France | CC BY 2.0 |
| 10119 | Pnyx | [Pnyx Bema 2.jpg](https://commons.wikimedia.org/wiki/File:Pnyx_Bema_2.jpg) | Tomisti | CC BY-SA 4.0 |
| 10120 | Philopappos Monument | [Monument de Philopappos crop.jpg](https://commons.wikimedia.org/wiki/File:Monument_de_Philopappos_crop.jpg) | Eusebius | CC BY 3.0 |
| 10121 | Omonia Square | [Πλατεία Ομονοίας, 2026.jpg](https://commons.wikimedia.org/wiki/File:%CE%A0%CE%BB%CE%B1%CF%84%CE%B5%CE%AF%CE%B1_%CE%9F%CE%BC%CE%BF%CE%BD%CE%BF%CE%AF%CE%B1%CF%82,_2026.jpg) | Apaleutos25 | CC BY-SA 4.0 |
| 10122 | Kotzia Square | [Athens Kotzia square.jpg](https://commons.wikimedia.org/wiki/File:Athens_Kotzia_square.jpg) | Badseed | CC BY 3.0 |
| 10123 | Psyrri | [Psyrri square Athens.jpg](https://commons.wikimedia.org/wiki/File:Psyrri_square_Athens.jpg) | Badseed | CC BY-SA 3.0 |
| 10124 | Adrianou Street | [Athens, Odos Adrianou 03.JPG](https://commons.wikimedia.org/wiki/File:Athens,_Odos_Adrianou_03.JPG) | Palickap | CC BY-SA 4.0 |
| 10125 | Anafiotika | [Anafiotika, Athens, 20240601 0923 0020.jpg](https://commons.wikimedia.org/wiki/File:Anafiotika,_Athens,_20240601_0923_0020.jpg) | Jakub Hałun | CC BY 4.0 |
| 10126 | Mnisikleous Steps | [The upper part of Mnisikleous Street on September 30, 2019.jpg](https://commons.wikimedia.org/wiki/File:The_upper_part_of_Mnisikleous_Street_on_September_30,_2019.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10127 | Kolonaki Square | [Kolonaki Square 3.jpg](https://commons.wikimedia.org/wiki/File:Kolonaki_Square_3.jpg) | Giorgoos | Public domain |
| 10128 | Exarcheia Square | [Exarchia square Athens.jpg](https://commons.wikimedia.org/wiki/File:Exarchia_square_Athens.jpg) | Badseed | CC BY-SA 3.0 |
| 10129 | Varvakios Market | [Central Market of Athens.jpg](https://commons.wikimedia.org/wiki/File:Central_Market_of_Athens.jpg) | athenswalk | CC0 |
| 10130 | Ermou Street | [Ermou-street.jpg](https://commons.wikimedia.org/wiki/File:Ermou-street.jpg) | Dimorsitanos | CC BY-SA 3.0 |
| 10131 | Avissynias Square | [Πλατεία Αβησσυνίας 6367.jpg](https://commons.wikimedia.org/wiki/File:%CE%A0%CE%BB%CE%B1%CF%84%CE%B5%CE%AF%CE%B1_%CE%91%CE%B2%CE%B7%CF%83%CF%83%CF%85%CE%BD%CE%AF%CE%B1%CF%82_6367.jpg) | C messier | CC BY-SA 4.0 |
| 10133 | Avdi Square | [Avdi Square 001.jpg](https://commons.wikimedia.org/wiki/File:Avdi_Square_001.jpg) | KathyB111 | CC BY-SA 3.0 |
| 10134 | National Archaeological Museum | [Archäologisches Nationalmuseum Athen.jpg](https://commons.wikimedia.org/wiki/File:Arch%C3%A4ologisches_Nationalmuseum_Athen.jpg) | Thomas Wolf, www.foto-tw.de | CC BY-SA 3.0 de |
| 10135 | Benaki Museum | [Benaki Museum Athens.JPG](https://commons.wikimedia.org/wiki/File:Benaki_Museum_Athens.JPG) | Dimboukas | CC BY-SA 3.0 |
| 10136 | Museum of Cycladic Art | [Goulandris Museum of Cycladic Art, Athens - Joy of Museums.jpg](https://commons.wikimedia.org/wiki/File:Goulandris_Museum_of_Cycladic_Art,_Athens_-_Joy_of_Museums.jpg) | Joyofmuseums | CC BY-SA 4.0 |
| 10137 | Byzantine and Christian Museum | [Byzantine and Christian Museum, Athens 04.jpg](https://commons.wikimedia.org/wiki/File:Byzantine_and_Christian_Museum,_Athens_04.jpg) | John Samuel | CC BY-SA 4.0 |
| 10138 | War Museum | [FG-695 at Athens War Museum (2019).jpg](https://commons.wikimedia.org/wiki/File:FG-695_at_Athens_War_Museum_%282019%29.jpg) | Colin Cooke Photo | CC BY-SA 2.0 |
| 10139 | Numismatic Museum | [Ιλίου Μέλαθρον 6649.jpg](https://commons.wikimedia.org/wiki/File:%CE%99%CE%BB%CE%AF%CE%BF%CF%85_%CE%9C%CE%AD%CE%BB%CE%B1%CE%B8%CF%81%CE%BF%CE%BD_6649.jpg) | C messier | CC BY-SA 4.0 |
| 10140 | Jewish Museum of Greece | [The Jewish Museum of Greece.jpg](https://commons.wikimedia.org/wiki/File:The_Jewish_Museum_of_Greece.jpg) | Dafniotis | CC BY-SA 4.0 |
| 10141 | Museum of Greek Folk Art | [Museum of Greek Folk Art.jpg](https://commons.wikimedia.org/wiki/File:Museum_of_Greek_Folk_Art.jpg) | Hoverfish | Public domain |
| 10142 | Herakleidon Museum | [The Herakleidon Museum at 37 Apostolou Pavlou Street on August 15, 2020.jpg](https://commons.wikimedia.org/wiki/File:The_Herakleidon_Museum_at_37_Apostolou_Pavlou_Street_on_August_15,_2020.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10143 | Technopolis Gazi | [The Technopolis in Gazi on January 17, 2021.jpg](https://commons.wikimedia.org/wiki/File:The_Technopolis_in_Gazi_on_January_17,_2021.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10144 | National Historical Museum | [The Old Parliament House - National Historical Museum - on March 1, 2019.jpg](https://commons.wikimedia.org/wiki/File:The_Old_Parliament_House_-_National_Historical_Museum_-_on_March_1,_2019.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10145 | Academy of Athens | [Ακαδημία Αθηνών 5260.jpg](https://commons.wikimedia.org/wiki/File:%CE%91%CE%BA%CE%B1%CE%B4%CE%B7%CE%BC%CE%AF%CE%B1_%CE%91%CE%B8%CE%B7%CE%BD%CF%8E%CE%BD_5260.jpg) | C messier | CC BY-SA 4.0 |
| 10146 | University of Athens | [Universität von Athen.jpg](https://commons.wikimedia.org/wiki/File:Universit%C3%A4t_von_Athen.jpg) | Thomas Wolf, www.foto-tw.de | CC BY-SA 3.0 de |
| 10147 | National Library of Greece | [Vallianeio Megaron - the National Library of Greece in Athens (1).jpg](https://commons.wikimedia.org/wiki/File:Vallianeio_Megaron_-_the_National_Library_of_Greece_in_Athens_%281%29.jpg) | Radosław Botev | CC BY 3.0 pl |
| 10149 | Presidential Mansion | [Presidential Mansion in Athens.jpg](https://commons.wikimedia.org/wiki/File:Presidential_Mansion_in_Athens.jpg) | Άργος | CC BY-SA 4.0 |
| 10150 | Metropolitan Cathedral | [Μητρόπολη Αθηνών 3321.jpg](https://commons.wikimedia.org/wiki/File:%CE%9C%CE%B7%CF%84%CF%81%CF%8C%CF%80%CE%BF%CE%BB%CE%B7_%CE%91%CE%B8%CE%B7%CE%BD%CF%8E%CE%BD_3321.jpg) | C messier | CC BY-SA 4.0 |
| 10151 | Little Metropolis | [Church Theotokos Gorgoepikoos and Agios Eleytherios Athens, Greece.jpg](https://commons.wikimedia.org/wiki/File:Church_Theotokos_Gorgoepikoos_and_Agios_Eleytherios_Athens,_Greece.jpg) | Jebulon | CC0 |
| 10152 | Kapnikarea | [Church of Panagia Kapnikarea, Athens, 20240531 0947 9460.jpg](https://commons.wikimedia.org/wiki/File:Church_of_Panagia_Kapnikarea,_Athens,_20240531_0947_9460.jpg) | Jakub Hałun | CC BY 4.0 |
| 10153 | Agios Georgios Chapel | [Ekklesia Agii Giorgii Lycabettus Athens Greece.jpg](https://commons.wikimedia.org/wiki/File:Ekklesia_Agii_Giorgii_Lycabettus_Athens_Greece.jpg) | Jebulon | CC0 |
| 10154 | Lycabettus Hill | [View of Lycabettus Hill from the Areopagus, Athens, 20240531 1216 9596.jpg](https://commons.wikimedia.org/wiki/File:View_of_Lycabettus_Hill_from_the_Areopagus,_Athens,_20240531_1216_9596.jpg) | Jakub Hałun | CC BY 4.0 |
| 10155 | Lycabettus Funicular | [Attica 06-13 Athens 48 Lycabettus railway car.jpg](https://commons.wikimedia.org/wiki/File:Attica_06-13_Athens_48_Lycabettus_railway_car.jpg) | A.Savin | CC BY-SA 3.0 |
| 10156 | Strefi Hill | [Attica 06-13 Athens 38 View from Lycabettus - Strefi Hill.jpg](https://commons.wikimedia.org/wiki/File:Attica_06-13_Athens_38_View_from_Lycabettus_-_Strefi_Hill.jpg) | A.Savin | CC BY-SA 3.0 |
| 10157 | Pedion tou Areos | [Square in Pedion tou Areos.jpg](https://commons.wikimedia.org/wiki/File:Square_in_Pedion_tou_Areos.jpg) | Grzegorz Wysocki | CC BY 3.0 |
| 10158 | Ardittos Hill | [The Hill of Ardettus and the Panathenaic Stadium on October 17, 2019.jpg](https://commons.wikimedia.org/wiki/File:The_Hill_of_Ardettus_and_the_Panathenaic_Stadium_on_October_17,_2019.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10159 | Aigli Zappiou | [Aigli coffee shop in Zappeion established in 1904.jpg](https://commons.wikimedia.org/wiki/File:Aigli_coffee_shop_in_Zappeion_established_in_1904.jpg) | athenswalk | CC0 |
| 10160 | First Cemetery of Athens | [First Cemetery of Athens - panoramio.jpg](https://commons.wikimedia.org/wiki/File:First_Cemetery_of_Athens_-_panoramio.jpg) | Robert Freeman | CC BY-SA 3.0 |
| 10161 | Panathenaic Stadium | [Panathenaic Stadium - panoramio (1).jpg](https://commons.wikimedia.org/wiki/File:Panathenaic_Stadium_-_panoramio_%281%29.jpg) | Mister No | CC BY 3.0 |
| 10162 | Apostolou Pavlou Promenade | [Apostolou Pavlou Pedestrian Street on March 20, 2020.jpg](https://commons.wikimedia.org/wiki/File:Apostolou_Pavlou_Pedestrian_Street_on_March_20,_2020.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10163 | Dexameni Square | [Dexameni Square, Kolonaki. In the distance Iraklitou Street and the Acropolis.jpg](https://commons.wikimedia.org/wiki/File:Dexameni_Square,_Kolonaki._In_the_distance_Iraklitou_Street_and_the_Acropolis.jpg) | George E. Koronaios | CC BY-SA 4.0 |
| 10164 | Megaron Concert Hall | [Megaron Garden (6).jpg](https://commons.wikimedia.org/wiki/File:Megaron_Garden_%286%29.jpg) | StrangeTraveler | CC BY-SA 4.0 |

## Unsplash images kept (Unsplash License)

| POI id | POI | Image subject | Source |
|-------:|-----|---------------|--------|
| 10001 | Syntagma Square | Hellenic Parliament on Syntagma Square | unsplash.com/photos/Pz4GKAw23p8 |
| 10002 | Plaka | Neoclassical Plaka street | unsplash.com/photos/qGtpTQrN7VU |
| 10003 | Acropolis | Parthenon | photo-1555993539-1732b0258235 |
| 10005 | Zappeion | Zappeion Hall | unsplash.com/photos/EwePE4mBPug |
| 10006 | Monastiraki Square | Monastiraki Square and Tzistarakis Mosque | unsplash.com/photos/u7XtES2Syv8 |
| 10007 | Ancient Agora | Temple of Hephaestus (inside the Agora site) | unsplash.com/photos/_UoiYtwqQeg |
| 10010 | Odeon of Herodes Atticus | Odeon of Herodes Atticus | photo-1635672097594-a0cbb7aa3a9e |
| 10101 | Parthenon | Parthenon | photo-1555993539-1732b0258235 |
| 10103 | Erechtheion | Caryatid porch | photo-1605707141131-aa742dcf4671 |
| 10105 | Odeon of Herodes Atticus | Odeon of Herodes Atticus | photo-1635672097594-a0cbb7aa3a9e |
| 10110 | Ancient Agora of Athens | Temple of Hephaestus (inside the Agora site) | unsplash.com/photos/_UoiYtwqQeg |
| 10112 | Temple of Hephaestus | Temple of Hephaestus | unsplash.com/photos/_UoiYtwqQeg |
| 10113 | Roman Agora | Tower of the Winds in the Roman Agora | unsplash.com/photos/gRbZy_dUu6A |
| 10114 | Tower of the Winds | Tower of the Winds | unsplash.com/photos/gRbZy_dUu6A |
| 10132 | Tzistarakis Mosque | Monastiraki Square and Tzistarakis Mosque | unsplash.com/photos/u7XtES2Syv8 |
| 10148 | Hellenic Parliament | Hellenic Parliament | unsplash.com/photos/Pz4GKAw23p8 |

POI 10004 National Garden (stop of route 2) had a generic tree-lined path, not
identifiable as the garden, until a second pass of the same correction
(2026-09-14) gave it the Commons photograph listed above.
