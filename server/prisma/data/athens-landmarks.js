// Curated Athens landmark set used to compose the generated route catalogue
// (scripts/seed-ai-routes.js).
//
// Why curated rather than straight from OSM: the Overpass sync in
// osmSyncService only imports `node` elements, so most major Athens sites —
// which OSM models as ways or relations (the Parthenon, the Ancient Agora,
// Kerameikos, the Panathenaic Stadium) — never enter the pois table. What the
// sync does bring is ~7.7k small nodes: cafes, pharmacies, kerbs, benches and
// excavation signboards. Those are exactly right as the *detour* candidate
// pool at checkpoints, and exactly wrong as the backbone of a headline route.
//
// Accessibility values here are deliberately conservative and describe the
// APPROACH to the landmark (the public space a visitor actually walks), not
// interior facilities:
//   yes     — paved/level public approach, no steps on the main path
//   limited — mostly navigable but with uneven stone, gravel or a short ramp
//   no      — steps, bedrock or a sustained climb on the only approach
// These rows are stored with dataSource 'admin', which keeps them distinct
// from the 'osm' rows in every query.
//
// photoUrl: every landmark shows a photograph OF THAT PLACE. Until 2026-09 the
// 64 landmarks shared 12 Unsplash images, so most showed a different site (the
// Parliament on Omonia, the Parthenon on the Areopagus, a generic park path on
// the Byzantine Museum). They were replaced as follows:
//
//   PHOTO    — the nine landmarks whose Unsplash image (Unsplash License) does
//              show them are kept: Parthenon, Erechtheion, Odeon of Herodes
//              Atticus, Ancient Agora and Temple of Hephaestus (the temple
//              stands inside the Agora site), Roman Agora and Tower of the
//              Winds, Tzistarakis Mosque, Hellenic Parliament.
//   COMMONS  — the other 55 use a freely licensed photograph from Wikimedia
//              Commons (CC0, public domain, CC BY or CC BY-SA), each checked by
//              eye against its subject. Author, licence and file page for every
//              image: docs/analysis/photo-credits.md (attribution is a licence
//              condition for the CC BY / CC BY-SA files).
//
// Commons URLs are the 960 px thumbnails on upload.wikimedia.org. 960 is one of
// the thumbnail widths Wikimedia pre-renders; other widths such as 800 return
// HTTP 400. upload.wikimedia.org also answers 403 to a request with no
// User-Agent or with a generic library one such as `okhttp/4.x` (Wikimedia's
// User-Agent policy), which is what React Native's Android image loader sends
// unless the Image source sets a `User-Agent` header.
//
// Each Unsplash key SHOWS what its name says:
//   syntagma     Hellenic Parliament      unsplash.com/photos/Pz4GKAw23p8 (location: Syntagma Square)
//   acropolis    Parthenon                (visual)
//   monastiraki  Monastiraki Sq + Tzistarakis Mosque  unsplash.com/photos/u7XtES2Syv8 (location: Monastiraki)
//   agora        Temple of Hephaestus     unsplash.com/photos/_UoiYtwqQeg (tags: ancient agora)
//   romanAgora   Tower of the Winds, Roman Agora      unsplash.com/photos/gRbZy_dUu6A
//   erechtheion  Caryatid porch           (visual)
//   odeon        Odeon of Herodes Atticus (visual, unmistakable)

const U = id => `https://images.unsplash.com/${id}?w=800&q=70&auto=format&fit=crop`;

const PHOTO = {
  syntagma: U('photo-1747560249491-25708b62b71a'),
  acropolis: U('photo-1555993539-1732b0258235'),
  monastiraki: U('photo-1583656696771-2afded31a36c'),
  agora: U('photo-1558297733-383c11030c44'),
  romanAgora: U('photo-1591339922960-f17a1f00dc9b'),
  erechtheion: U('photo-1605707141131-aa742dcf4671'),
  odeon: U('photo-1635672097594-a0cbb7aa3a9e'),
};

const COMMONS = {
  propylaea: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/East_Facade_of_the_Propylaea_on_July_23%2C_2019.jpg/960px-East_Facade_of_the_Propylaea_on_July_23%2C_2019.jpg',
  athena_nike: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Temple_of_Athena_Nik%C3%A8_from_Propylaea%2C_Acropolis%2C_Athens%2C_Greece.jpg/960px-Temple_of_Athena_Nik%C3%A8_from_Propylaea%2C_Acropolis%2C_Athens%2C_Greece.jpg',
  dionysus_theatre: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Theatre_of_Dionysus_Acropolis_Athens_Greece.jpg/960px-Theatre_of_Dionysus_Acropolis_Athens_Greece.jpg',
  acropolis_museum: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/New_Acropolis_Museum_building_in_Athens%2C_Greece.jpg/960px-New_Acropolis_Museum_building_in_Athens%2C_Greece.jpg',
  areopagus: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Areopagus_hill_Saint_Paul_from_Acropolis_Athens.jpg/960px-Areopagus_hill_Saint_Paul_from_Acropolis_Athens.jpg',
  areopagitou: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/View_of_the_Acropolis_of_Athens_from_Dionysiou_Areopagitou_pedestrian_street.jpg/960px-View_of_the_Acropolis_of_Athens_from_Dionysiou_Areopagitou_pedestrian_street.jpg',
  stoa_attalos: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Stoa_of_Attalos%2C_Athens%2C_Greece.jpg/960px-Stoa_of_Attalos%2C_Athens%2C_Greece.jpg',
  hadrian_library: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/The_west_facade_in_Pentelic_marble_with_columns_of_Karystos_marble_of_the_Library_of_Hadrian%2C_Athens_%2814023204344%29.jpg/960px-The_west_facade_in_Pentelic_marble_with_columns_of_Karystos_marble_of_the_Library_of_Hadrian%2C_Athens_%2814023204344%29.jpg',
  kerameikos_site: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Kerameikos_Cemetery_on_July_28%2C_2019.jpg/960px-Kerameikos_Cemetery_on_July_28%2C_2019.jpg',
  hadrian_arch: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Attica_06-13_Athens_24_Arch_of_Hadrian.jpg/960px-Attica_06-13_Athens_24_Arch_of_Hadrian.jpg',
  olympian_zeus: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/L%27Olympieion_%28Ath%C3%A8nes%29_%2830776483926%29.jpg/960px-L%27Olympieion_%28Ath%C3%A8nes%29_%2830776483926%29.jpg',
  pnyx: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Pnyx_Bema_2.jpg/960px-Pnyx_Bema_2.jpg',
  philopappos: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Monument_de_Philopappos_crop.jpg/960px-Monument_de_Philopappos_crop.jpg',
  omonia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/%CE%A0%CE%BB%CE%B1%CF%84%CE%B5%CE%AF%CE%B1_%CE%9F%CE%BC%CE%BF%CE%BD%CE%BF%CE%AF%CE%B1%CF%82%2C_2026.jpg/960px-%CE%A0%CE%BB%CE%B1%CF%84%CE%B5%CE%AF%CE%B1_%CE%9F%CE%BC%CE%BF%CE%BD%CE%BF%CE%AF%CE%B1%CF%82%2C_2026.jpg',
  kotzia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Athens_Kotzia_square.jpg/960px-Athens_Kotzia_square.jpg',
  psyrri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Psyrri_square_Athens.jpg/960px-Psyrri_square_Athens.jpg',
  adrianou: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Athens%2C_Odos_Adrianou_03.JPG/960px-Athens%2C_Odos_Adrianou_03.JPG',
  anafiotika: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Anafiotika%2C_Athens%2C_20240601_0923_0020.jpg/960px-Anafiotika%2C_Athens%2C_20240601_0923_0020.jpg',
  mnisikleous: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/The_upper_part_of_Mnisikleous_Street_on_September_30%2C_2019.jpg/960px-The_upper_part_of_Mnisikleous_Street_on_September_30%2C_2019.jpg',
  kolonaki: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Kolonaki_Square_3.jpg/960px-Kolonaki_Square_3.jpg',
  exarcheia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Exarchia_square_Athens.jpg/960px-Exarchia_square_Athens.jpg',
  varvakios: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Central_Market_of_Athens.jpg/960px-Central_Market_of_Athens.jpg',
  ermou: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Ermou-street.jpg/960px-Ermou-street.jpg',
  avissynias: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/%CE%A0%CE%BB%CE%B1%CF%84%CE%B5%CE%AF%CE%B1_%CE%91%CE%B2%CE%B7%CF%83%CF%83%CF%85%CE%BD%CE%AF%CE%B1%CF%82_6367.jpg/960px-%CE%A0%CE%BB%CE%B1%CF%84%CE%B5%CE%AF%CE%B1_%CE%91%CE%B2%CE%B7%CF%83%CF%83%CF%85%CE%BD%CE%AF%CE%B1%CF%82_6367.jpg',
  avdi: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Avdi_Square_001.jpg/960px-Avdi_Square_001.jpg',
  national_arch_museum: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Arch%C3%A4ologisches_Nationalmuseum_Athen.jpg/960px-Arch%C3%A4ologisches_Nationalmuseum_Athen.jpg',
  benaki: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Benaki_Museum_Athens.JPG/960px-Benaki_Museum_Athens.JPG',
  cycladic: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Goulandris_Museum_of_Cycladic_Art%2C_Athens_-_Joy_of_Museums.jpg/960px-Goulandris_Museum_of_Cycladic_Art%2C_Athens_-_Joy_of_Museums.jpg',
  byzantine_museum: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Byzantine_and_Christian_Museum%2C_Athens_04.jpg/960px-Byzantine_and_Christian_Museum%2C_Athens_04.jpg',
  war_museum: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/FG-695_at_Athens_War_Museum_%282019%29.jpg/960px-FG-695_at_Athens_War_Museum_%282019%29.jpg',
  numismatic: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/%CE%99%CE%BB%CE%AF%CE%BF%CF%85_%CE%9C%CE%AD%CE%BB%CE%B1%CE%B8%CF%81%CE%BF%CE%BD_6649.jpg/960px-%CE%99%CE%BB%CE%AF%CE%BF%CF%85_%CE%9C%CE%AD%CE%BB%CE%B1%CE%B8%CF%81%CE%BF%CE%BD_6649.jpg',
  jewish_museum: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/The_Jewish_Museum_of_Greece.jpg/960px-The_Jewish_Museum_of_Greece.jpg',
  folk_art: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Museum_of_Greek_Folk_Art.jpg/500px-Museum_of_Greek_Folk_Art.jpg',
  herakleidon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/The_Herakleidon_Museum_at_37_Apostolou_Pavlou_Street_on_August_15%2C_2020.jpg/960px-The_Herakleidon_Museum_at_37_Apostolou_Pavlou_Street_on_August_15%2C_2020.jpg',
  technopolis: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/The_Technopolis_in_Gazi_on_January_17%2C_2021.jpg/960px-The_Technopolis_in_Gazi_on_January_17%2C_2021.jpg',
  old_parliament: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/The_Old_Parliament_House_-_National_Historical_Museum_-_on_March_1%2C_2019.jpg/960px-The_Old_Parliament_House_-_National_Historical_Museum_-_on_March_1%2C_2019.jpg',
  academy: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/%CE%91%CE%BA%CE%B1%CE%B4%CE%B7%CE%BC%CE%AF%CE%B1_%CE%91%CE%B8%CE%B7%CE%BD%CF%8E%CE%BD_5260.jpg/960px-%CE%91%CE%BA%CE%B1%CE%B4%CE%B7%CE%BC%CE%AF%CE%B1_%CE%91%CE%B8%CE%B7%CE%BD%CF%8E%CE%BD_5260.jpg',
  university: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Universit%C3%A4t_von_Athen.jpg/960px-Universit%C3%A4t_von_Athen.jpg',
  national_library: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Vallianeio_Megaron_-_the_National_Library_of_Greece_in_Athens_%281%29.jpg/960px-Vallianeio_Megaron_-_the_National_Library_of_Greece_in_Athens_%281%29.jpg',
  presidential: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Presidential_Mansion_in_Athens.jpg/960px-Presidential_Mansion_in_Athens.jpg',
  cathedral: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/%CE%9C%CE%B7%CF%84%CF%81%CF%8C%CF%80%CE%BF%CE%BB%CE%B7_%CE%91%CE%B8%CE%B7%CE%BD%CF%8E%CE%BD_3321.jpg/960px-%CE%9C%CE%B7%CF%84%CF%81%CF%8C%CF%80%CE%BF%CE%BB%CE%B7_%CE%91%CE%B8%CE%B7%CE%BD%CF%8E%CE%BD_3321.jpg',
  little_metropolis: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Church_Theotokos_Gorgoepikoos_and_Agios_Eleytherios_Athens%2C_Greece.jpg/960px-Church_Theotokos_Gorgoepikoos_and_Agios_Eleytherios_Athens%2C_Greece.jpg',
  kapnikarea: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Church_of_Panagia_Kapnikarea%2C_Athens%2C_20240531_0947_9460.jpg/960px-Church_of_Panagia_Kapnikarea%2C_Athens%2C_20240531_0947_9460.jpg',
  agios_georgios: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Ekklesia_Agii_Giorgii_Lycabettus_Athens_Greece.jpg/960px-Ekklesia_Agii_Giorgii_Lycabettus_Athens_Greece.jpg',
  lycabettus: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/View_of_Lycabettus_Hill_from_the_Areopagus%2C_Athens%2C_20240531_1216_9596.jpg/960px-View_of_Lycabettus_Hill_from_the_Areopagus%2C_Athens%2C_20240531_1216_9596.jpg',
  lycabettus_funicular: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Attica_06-13_Athens_48_Lycabettus_railway_car.jpg/960px-Attica_06-13_Athens_48_Lycabettus_railway_car.jpg',
  strefi: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Attica_06-13_Athens_38_View_from_Lycabettus_-_Strefi_Hill.jpg/960px-Attica_06-13_Athens_38_View_from_Lycabettus_-_Strefi_Hill.jpg',
  pedion_areos: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Square_in_Pedion_tou_Areos.jpg/960px-Square_in_Pedion_tou_Areos.jpg',
  ardittos: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/The_Hill_of_Ardettus_and_the_Panathenaic_Stadium_on_October_17%2C_2019.jpg/960px-The_Hill_of_Ardettus_and_the_Panathenaic_Stadium_on_October_17%2C_2019.jpg',
  aigli: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Aigli_coffee_shop_in_Zappeion_established_in_1904.jpg/960px-Aigli_coffee_shop_in_Zappeion_established_in_1904.jpg',
  first_cemetery: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/First_Cemetery_of_Athens_-_panoramio.jpg/960px-First_Cemetery_of_Athens_-_panoramio.jpg',
  kallimarmaro: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Panathenaic_Stadium_-_panoramio_%281%29.jpg/960px-Panathenaic_Stadium_-_panoramio_%281%29.jpg',
  thissio_promenade: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Apostolou_Pavlou_Pedestrian_Street_on_March_20%2C_2020.jpg/960px-Apostolou_Pavlou_Pedestrian_Street_on_March_20%2C_2020.jpg',
  dexameni: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Dexameni_Square%2C_Kolonaki._In_the_distance_Iraklitou_Street_and_the_Acropolis.jpg/960px-Dexameni_Square%2C_Kolonaki._In_the_distance_Iraklitou_Street_and_the_Acropolis.jpg',
  megaron: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Megaron_Garden_%286%29.jpg/960px-Megaron_Garden_%286%29.jpg',
};

// id range 10101+ — 10001..10010 belong to the original demo POIs in seed.js.
const LANDMARKS = [
  // Acropolis and its slopes
  { key: 'parthenon', id: 10101, name: 'Parthenon', description: 'The temple of Athena Parthenos crowning the Acropolis, built 447-432 BC.', category: 'historical', lat: 37.9715, lng: 23.7267, wheelchair: 'limited', surface: 'stone', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: PHOTO.acropolis },
  { key: 'propylaea', id: 10102, name: 'Propylaea', description: 'The monumental gateway forming the ceremonial entrance to the Acropolis.', category: 'historical', lat: 37.9719, lng: 23.7255, wheelchair: 'limited', surface: 'stone', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.propylaea },
  { key: 'erechtheion', id: 10103, name: 'Erechtheion', description: 'The Ionic temple on the north side of the Acropolis, famous for its Caryatid porch.', category: 'historical', lat: 37.9720, lng: 23.7264, wheelchair: 'limited', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: PHOTO.erechtheion },
  { key: 'athena_nike', id: 10104, name: 'Temple of Athena Nike', description: 'The small Ionic temple on the southwest bastion of the Acropolis.', category: 'historical', lat: 37.9716, lng: 23.7254, wheelchair: 'limited', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.athena_nike },
  { key: 'herodion', id: 10105, name: 'Odeon of Herodes Atticus', description: 'The Roman stone theatre of AD 161 on the south slope, still used for summer performances.', category: 'historical', lat: 37.9709, lng: 23.7245, wheelchair: 'no', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: PHOTO.odeon },
  { key: 'dionysus_theatre', id: 10106, name: 'Theatre of Dionysus', description: 'The birthplace of Greek drama on the south slope of the Acropolis.', category: 'historical', lat: 37.9705, lng: 23.7278, wheelchair: 'limited', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.dionysus_theatre },
  { key: 'acropolis_museum', id: 10107, name: 'Acropolis Museum', description: 'The modern museum housing the finds of the Acropolis, with a glass-floored Parthenon gallery.', category: 'cultural', lat: 37.9683, lng: 23.7286, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: true, hasRestArea: true, photoUrl: COMMONS.acropolis_museum },
  { key: 'areopagus', id: 10108, name: 'Areopagus Hill', description: 'The polished bedrock outcrop below the Acropolis where the ancient council met.', category: 'historical', lat: 37.9724, lng: 23.7248, wheelchair: 'no', surface: 'rock', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.areopagus },
  { key: 'areopagitou', id: 10109, name: 'Dionysiou Areopagitou', description: 'The broad marble pedestrian avenue running along the south slope of the Acropolis.', category: 'historical', lat: 37.9697, lng: 23.7267, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: true, hasRestArea: true, photoUrl: COMMONS.areopagitou },

  // Ancient sites
  { key: 'ancient_agora', id: 10110, name: 'Ancient Agora of Athens', description: 'The civic and commercial heart of the classical city.', category: 'historical', lat: 37.9750, lng: 23.7215, wheelchair: 'limited', surface: 'gravel', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: PHOTO.agora },
  { key: 'stoa_attalos', id: 10111, name: 'Stoa of Attalos', description: 'The fully reconstructed 2nd-century BC colonnade housing the Agora Museum.', category: 'cultural', lat: 37.9754, lng: 23.7229, wheelchair: 'yes', surface: 'stone', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.stoa_attalos },
  { key: 'hephaisteion', id: 10112, name: 'Temple of Hephaestus', description: 'The best-preserved Doric temple in Greece, overlooking the Agora from Thissio.', category: 'historical', lat: 37.9756, lng: 23.7213, wheelchair: 'limited', surface: 'gravel', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: PHOTO.agora },
  { key: 'roman_agora', id: 10113, name: 'Roman Agora', description: 'The Roman-era marketplace built with donations from Julius Caesar and Augustus.', category: 'historical', lat: 37.9744, lng: 23.7256, wheelchair: 'limited', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: PHOTO.romanAgora },
  { key: 'tower_winds', id: 10114, name: 'Tower of the Winds', description: 'The octagonal marble clocktower of Andronicus, the first meteorological station.', category: 'historical', lat: 37.9745, lng: 23.7261, wheelchair: 'limited', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: PHOTO.romanAgora },
  { key: 'hadrian_library', id: 10115, name: 'Library of Hadrian', description: 'The monumental library complex founded by the emperor Hadrian in AD 132.', category: 'historical', lat: 37.9757, lng: 23.7256, wheelchair: 'limited', surface: 'stone', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.hadrian_library },
  { key: 'kerameikos_site', id: 10116, name: 'Kerameikos Archaeological Site', description: 'The ancient cemetery and potters quarter beside the city walls.', category: 'historical', lat: 37.9785, lng: 23.7180, wheelchair: 'limited', surface: 'gravel', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.kerameikos_site },
  { key: 'hadrian_arch', id: 10117, name: 'Arch of Hadrian', description: 'The marble gateway marking the boundary between the old city and the new Roman quarter.', category: 'historical', lat: 37.9702, lng: 23.7331, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.hadrian_arch },
  { key: 'olympian_zeus', id: 10118, name: 'Temple of Olympian Zeus', description: 'The colossal temple completed by Hadrian, its surviving columns still 17 m tall.', category: 'historical', lat: 37.9693, lng: 23.7331, wheelchair: 'limited', surface: 'gravel', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.olympian_zeus },
  { key: 'pnyx', id: 10119, name: 'Pnyx', description: 'The hillside terrace where the assembly of Athenian citizens met, the cradle of democracy.', category: 'historical', lat: 37.9714, lng: 23.7203, wheelchair: 'no', surface: 'rock', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.pnyx },
  { key: 'philopappos', id: 10120, name: 'Philopappos Monument', description: 'The Roman tomb monument crowning the Hill of the Muses, with the finest view of the Acropolis.', category: 'nature', lat: 37.9678, lng: 23.7211, wheelchair: 'no', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.philopappos },

  // Squares, streets and neighbourhoods
  { key: 'omonia', id: 10121, name: 'Omonia Square', description: 'The busy transport hub at the north end of the historic triangle.', category: 'cultural', lat: 37.9841, lng: 23.7280, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: true, hasRestArea: true, photoUrl: COMMONS.omonia },
  { key: 'kotzia', id: 10122, name: 'Kotzia Square', description: 'The neoclassical square before the City Hall, with an exposed section of ancient road.', category: 'cultural', lat: 37.9816, lng: 23.7287, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.kotzia },
  { key: 'psyrri', id: 10123, name: 'Psyrri', description: 'A dense quarter of workshops, tavernas and street art north of Monastiraki.', category: 'cultural', lat: 37.9784, lng: 23.7249, wheelchair: 'limited', surface: 'asphalt', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.psyrri },
  { key: 'adrianou', id: 10124, name: 'Adrianou Street', description: 'The long pedestrian street of Plaka running beside the Ancient Agora.', category: 'cultural', lat: 37.9722, lng: 23.7290, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.adrianou },
  { key: 'anafiotika', id: 10125, name: 'Anafiotika', description: 'The whitewashed Cycladic-style hamlet built into the north slope of the Acropolis.', category: 'cultural', lat: 37.9727, lng: 23.7273, wheelchair: 'no', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.anafiotika },
  { key: 'mnisikleous', id: 10126, name: 'Mnisikleous Steps', description: 'The stepped taverna street climbing from Plaka toward Anafiotika.', category: 'cultural', lat: 37.9733, lng: 23.7285, wheelchair: 'no', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.mnisikleous },
  { key: 'kolonaki', id: 10127, name: 'Kolonaki Square', description: 'The elegant cafe square below Lycabettus, at the centre of the smartest quarter in Athens.', category: 'cultural', lat: 37.9793, lng: 23.7442, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.kolonaki },
  { key: 'exarcheia', id: 10128, name: 'Exarcheia Square', description: 'The heart of the student and counterculture quarter, dense with murals.', category: 'cultural', lat: 37.9862, lng: 23.7333, wheelchair: 'limited', surface: 'asphalt', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.exarcheia },
  { key: 'varvakios', id: 10129, name: 'Varvakios Market', description: 'The 19th-century central market hall for meat, fish and spices.', category: 'cultural', lat: 37.9806, lng: 23.7268, wheelchair: 'limited', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.varvakios },
  { key: 'ermou', id: 10130, name: 'Ermou Street', description: 'The main pedestrian shopping street running from Syntagma to Monastiraki.', category: 'cultural', lat: 37.9760, lng: 23.7300, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: true, hasRestArea: true, photoUrl: COMMONS.ermou },
  { key: 'avissynias', id: 10131, name: 'Avissynias Square', description: 'The antiques and flea-market square at the heart of old Monastiraki.', category: 'cultural', lat: 37.9766, lng: 23.7245, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.avissynias },
  { key: 'tzistarakis', id: 10132, name: 'Tzistarakis Mosque', description: 'The 1759 Ottoman mosque on Monastiraki Square, now a ceramics collection.', category: 'cultural', lat: 37.9761, lng: 23.7252, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: PHOTO.monastiraki },
  { key: 'avdi', id: 10133, name: 'Avdi Square', description: 'The Metaxourgeio square beside the Municipal Gallery, ringed with murals.', category: 'cultural', lat: 37.9856, lng: 23.7222, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.avdi },

  // Museums and cultural institutions
  { key: 'national_arch_museum', id: 10134, name: 'National Archaeological Museum', description: 'The largest archaeological collection in Greece, from the Mask of Agamemnon onward.', category: 'cultural', lat: 37.9891, lng: 23.7327, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.national_arch_museum },
  { key: 'benaki', id: 10135, name: 'Benaki Museum', description: 'The neoclassical mansion holding Greek art from antiquity to the modern state.', category: 'cultural', lat: 37.9757, lng: 23.7397, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.benaki },
  { key: 'cycladic', id: 10136, name: 'Museum of Cycladic Art', description: 'The definitive collection of Cycladic figurines and ancient Greek art.', category: 'cultural', lat: 37.9765, lng: 23.7433, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.cycladic },
  { key: 'byzantine_museum', id: 10137, name: 'Byzantine and Christian Museum', description: 'Icons, mosaics and manuscripts spanning the Byzantine world.', category: 'cultural', lat: 37.9752, lng: 23.7449, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.byzantine_museum },
  { key: 'war_museum', id: 10138, name: 'War Museum', description: 'The national military history collection beside the Byzantine Museum.', category: 'cultural', lat: 37.9754, lng: 23.7440, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.war_museum },
  { key: 'numismatic', id: 10139, name: 'Numismatic Museum', description: 'The coin collection housed in the Iliou Melathron, the mansion of Heinrich Schliemann.', category: 'cultural', lat: 37.9778, lng: 23.7354, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.numismatic },
  { key: 'jewish_museum', id: 10140, name: 'Jewish Museum of Greece', description: 'The record of 2,300 years of Jewish life in Greece, on the edge of Plaka.', category: 'cultural', lat: 37.9738, lng: 23.7343, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.jewish_museum },
  { key: 'folk_art', id: 10141, name: 'Museum of Greek Folk Art', description: 'Costume, silverwork and shadow-theatre traditions of the Greek countryside.', category: 'cultural', lat: 37.9723, lng: 23.7297, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.folk_art },
  { key: 'herakleidon', id: 10142, name: 'Herakleidon Museum', description: 'A Thissio townhouse museum of art, mathematics and ancient technology.', category: 'cultural', lat: 37.9761, lng: 23.7196, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.herakleidon },
  { key: 'technopolis', id: 10143, name: 'Technopolis Gazi', description: 'The restored 19th-century gasworks, now the industrial-heritage culture park of the city.', category: 'cultural', lat: 37.9786, lng: 23.7115, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: true, hasRestArea: true, photoUrl: COMMONS.technopolis },
  { key: 'old_parliament', id: 10144, name: 'National Historical Museum', description: 'The Old Parliament building on Stadiou, covering the War of Independence onward.', category: 'cultural', lat: 37.9781, lng: 23.7331, wheelchair: 'limited', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.old_parliament },

  // Neoclassical Athens
  { key: 'academy', id: 10145, name: 'Academy of Athens', description: 'The marble masterpiece of Theophil Hansen, centrepiece of the neoclassical trilogy.', category: 'cultural', lat: 37.9801, lng: 23.7333, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.academy },
  { key: 'university', id: 10146, name: 'University of Athens', description: 'The original 1839 university building at the centre of the trilogy.', category: 'cultural', lat: 37.9804, lng: 23.7330, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.university },
  { key: 'national_library', id: 10147, name: 'National Library of Greece', description: 'The Doric-fronted third building of the neoclassical trilogy on Panepistimiou.', category: 'cultural', lat: 37.9807, lng: 23.7328, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.national_library },
  { key: 'parliament', id: 10148, name: 'Hellenic Parliament', description: 'The former royal palace above Syntagma, with the Tomb of the Unknown Soldier.', category: 'historical', lat: 37.9754, lng: 23.7365, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: true, hasRestArea: true, photoUrl: PHOTO.syntagma },
  { key: 'presidential', id: 10149, name: 'Presidential Mansion', description: 'The Ziller palace on Herodou Attikou, guarded by the Evzones.', category: 'historical', lat: 37.9736, lng: 23.7412, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.presidential },

  // Churches
  { key: 'cathedral', id: 10150, name: 'Metropolitan Cathedral', description: 'The 1862 cathedral of Athens on Mitropoleos Square.', category: 'cultural', lat: 37.9744, lng: 23.7305, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.cathedral },
  { key: 'little_metropolis', id: 10151, name: 'Little Metropolis', description: 'The 12th-century marble chapel of Panagia Gorgoepikoos beside the cathedral.', category: 'historical', lat: 37.9743, lng: 23.7307, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.little_metropolis },
  { key: 'kapnikarea', id: 10152, name: 'Kapnikarea', description: 'The 11th-century Byzantine church marooned in the middle of Ermou Street.', category: 'historical', lat: 37.9757, lng: 23.7304, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: false, photoUrl: COMMONS.kapnikarea },
  { key: 'agios_georgios', id: 10153, name: 'Agios Georgios Chapel', description: 'The whitewashed chapel on the summit of Lycabettus.', category: 'nature', lat: 37.9822, lng: 23.7434, wheelchair: 'no', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.agios_georgios },

  // Parks, hills and green space
  { key: 'lycabettus', id: 10154, name: 'Lycabettus Hill', description: 'The pine-covered limestone peak that is the highest point in central Athens.', category: 'nature', lat: 37.9819, lng: 23.7432, wheelchair: 'no', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.lycabettus },
  { key: 'lycabettus_funicular', id: 10155, name: 'Lycabettus Funicular', description: 'The tunnel railway carrying visitors from Kolonaki to the summit.', category: 'nature', lat: 37.9803, lng: 23.7440, wheelchair: 'limited', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.lycabettus_funicular },
  { key: 'strefi', id: 10156, name: 'Strefi Hill', description: 'The rocky neighbourhood park above Exarcheia, with a view over the city.', category: 'nature', lat: 37.9878, lng: 23.7379, wheelchair: 'no', surface: 'gravel', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.strefi },
  { key: 'pedion_areos', id: 10157, name: 'Pedion tou Areos', description: 'One of the largest public parks in Athens, laid out along broad straight avenues.', category: 'nature', lat: 37.9925, lng: 23.7345, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.pedion_areos },
  { key: 'ardittos', id: 10158, name: 'Ardittos Hill', description: 'The wooded rise beside the Panathenaic Stadium.', category: 'nature', lat: 37.9673, lng: 23.7402, wheelchair: 'no', surface: 'gravel', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.ardittos },
  { key: 'aigli', id: 10159, name: 'Aigli Zappiou', description: 'The garden courtyard and cafe behind the Zappeion.', category: 'nature', lat: 37.9709, lng: 23.7361, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.aigli },
  { key: 'first_cemetery', id: 10160, name: 'First Cemetery of Athens', description: 'The 19th-century cemetery, an open-air museum of neoclassical funerary sculpture.', category: 'cultural', lat: 37.9639, lng: 23.7379, wheelchair: 'limited', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.first_cemetery },

  // Landmarks east and south
  { key: 'kallimarmaro', id: 10161, name: 'Panathenaic Stadium', description: 'The all-marble stadium of 1896, rebuilt on the ancient running track.', category: 'historical', lat: 37.9683, lng: 23.7411, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.kallimarmaro },
  { key: 'thissio_promenade', id: 10162, name: 'Apostolou Pavlou Promenade', description: 'The pedestrian avenue linking Thissio to the Acropolis slopes.', category: 'nature', lat: 37.9767, lng: 23.7207, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: true, hasRestArea: true, photoUrl: COMMONS.thissio_promenade },
  { key: 'dexameni', id: 10163, name: 'Dexameni Square', description: 'The Kolonaki square built over the ancient Hadrianic reservoir.', category: 'nature', lat: 37.9807, lng: 23.7412, wheelchair: 'limited', surface: 'paved', hasRamp: false, hasTactilePaving: false, hasRestArea: true, photoUrl: COMMONS.dexameni },
  { key: 'megaron', id: 10164, name: 'Megaron Concert Hall', description: 'The principal concert hall of Athens, on Vasilissis Sofias.', category: 'cultural', lat: 37.9793, lng: 23.7529, wheelchair: 'yes', surface: 'paved', hasRamp: true, hasTactilePaving: true, hasRestArea: true, photoUrl: COMMONS.megaron },
];

module.exports = { LANDMARKS, PHOTO, COMMONS };
