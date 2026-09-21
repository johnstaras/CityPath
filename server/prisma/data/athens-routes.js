// The generated Athens route catalogue: 100 curated itineraries composed from
// the landmark set in athens-landmarks.js.
//
// Each entry lists only an ordered set of landmark keys — no geometry, no
// distance, no duration. Those three are DERIVED, never authored: seed-ai-routes.js
// routes the stop sequence through the OSRM pedestrian profile, stores the
// street-following LineString it returns, and computes the walking time from
// the real leg distances plus dwell time per stop. That is the same pipeline
// scripts/snap-routes.js already applies to the five original seeded routes,
// so a catalogue route is indistinguishable from a hand-authored one at
// runtime: navigation, checkpoints, detour suggestions and accessibility
// scoring all work on it unchanged.
//
// Stop order matters. Sequences are kept geographically coherent (adjacent
// landmarks in walking order) so OSRM produces a sensible path rather than a
// zigzag across the centre. The seeder additionally rejects any route whose
// snapped distance exceeds MAX_ROUTE_METERS.
//
// `category` is constrained to the three values the mobile FilterBar offers:
// 'historical' | 'cultural' | 'nature'.

const ROUTES = [
  // ── The Acropolis and its slopes ───────────────────────────────────────
  { id: 101, title: 'Acropolis Summit Circuit', description: 'The classical monuments of the Sacred Rock in the order the ancient procession met them.', category: 'historical', stops: ['propylaea', 'athena_nike', 'parthenon', 'erechtheion'] },
  { id: 102, title: 'South Slope Theatres', description: 'From the modern museum up past the two great theatres of the south slope.', category: 'historical', stops: ['acropolis_museum', 'dionysus_theatre', 'herodion', 'areopagitou'] },
  { id: 103, title: 'Acropolis and Its Museum', description: 'The full Acropolis experience, beginning with the finds and ending at the temple they came from.', category: 'historical', stops: ['acropolis_museum', 'areopagitou', 'herodion', 'propylaea', 'parthenon'] },
  { id: 104, title: 'Sacred Rock and Areopagus', description: 'The council hill of the Areopagus and the summit temples above it.', category: 'historical', stops: ['areopagus', 'propylaea', 'parthenon', 'erechtheion'] },
  { id: 105, title: 'The Marble Mile', description: 'The pedestrian avenue along the south slope of the Acropolis, past the museum to the Arch of Hadrian.', category: 'historical', stops: ['areopagitou', 'herodion', 'acropolis_museum', 'hadrian_arch'] },
  { id: 106, title: 'Birthplace of Drama', description: 'Where Greek tragedy was first performed, and where it is still staged each summer.', category: 'historical', stops: ['dionysus_theatre', 'herodion', 'areopagitou', 'acropolis_museum'] },
  { id: 107, title: 'Classical Masterworks', description: 'The temples and the gateway of the Acropolis plateau, then down to the Areopagus.', category: 'historical', stops: ['parthenon', 'erechtheion', 'athena_nike', 'propylaea', 'areopagus'] },
  { id: 108, title: 'Acropolis at Dusk', description: 'A late-afternoon approach timed for the light on the west face of the rock.', category: 'historical', stops: ['areopagitou', 'herodion', 'areopagus', 'propylaea'] },
  { id: 109, title: 'Southern Slopes', description: 'The southern approach, from the museum along the theatres below the rock.', category: 'historical', stops: ['acropolis_museum', 'areopagitou', 'herodion', 'dionysus_theatre'] },
  { id: 110, title: 'Complete Acropolis Experience', description: 'The long version: museum, promenade, theatre, gateway, the Parthenon and the Erechtheion.', category: 'historical', stops: ['acropolis_museum', 'areopagitou', 'herodion', 'propylaea', 'parthenon', 'erechtheion'] },

  // ── The ancient city ───────────────────────────────────────────────────
  { id: 111, title: 'Ancient Agora Explorer', description: 'The civic centre of classical Athens and the promenade that borders it.', category: 'historical', stops: ['ancient_agora', 'stoa_attalos', 'hephaisteion', 'thissio_promenade'] },
  { id: 112, title: 'Agora to Acropolis', description: 'The classic ascent from the marketplace to the Sacred Rock.', category: 'historical', stops: ['hephaisteion', 'ancient_agora', 'stoa_attalos', 'areopagus', 'propylaea'] },
  { id: 113, title: 'Democracy Trail', description: 'The assembly terrace of the Pnyx, the Hill of the Muses and the promenade down to the Temple of Hephaestus.', category: 'historical', stops: ['pnyx', 'philopappos', 'thissio_promenade', 'hephaisteion'] },
  { id: 114, title: 'Hill of the Muses', description: 'A climb with long flights of steps to the Philopappos monument and its Acropolis view, returning by the Pnyx.', category: 'nature', stops: ['thissio_promenade', 'philopappos', 'pnyx'] },
  { id: 115, title: 'Roman Athens', description: 'The imperial city: marketplace, water clock, library and the arch that divided old from new.', category: 'historical', stops: ['roman_agora', 'tower_winds', 'hadrian_library', 'hadrian_arch'] },
  { id: 116, title: 'The Athens of Hadrian', description: 'From his library and his arch to the great temple he completed, ending in the Zappeion gardens.', category: 'historical', stops: ['hadrian_library', 'hadrian_arch', 'olympian_zeus', 'aigli'] },
  { id: 117, title: 'Monastiraki Antiquities', description: 'The layered ruins hiding behind the busiest square in the old town.', category: 'historical', stops: ['tzistarakis', 'hadrian_library', 'roman_agora', 'tower_winds'] },
  { id: 118, title: 'Kerameikos and the City Walls', description: 'The ancient cemetery beside the line of the classical fortifications.', category: 'historical', stops: ['kerameikos_site', 'technopolis', 'avdi'] },
  { id: 119, title: 'The Potters Quarter', description: 'From the gasworks through the burial ground to the temple above the Agora.', category: 'historical', stops: ['technopolis', 'kerameikos_site', 'thissio_promenade', 'hephaisteion'] },
  { id: 120, title: 'Two Agoras and a Library', description: 'The Greek marketplace, its Roman successor with the Tower of the Winds, and the Library of Hadrian beside it.', category: 'historical', stops: ['ancient_agora', 'roman_agora', 'tower_winds', 'hadrian_library'] },
  { id: 121, title: 'Temples of Athens', description: 'The four great temples of the ancient city, west to east.', category: 'historical', stops: ['hephaisteion', 'parthenon', 'erechtheion', 'olympian_zeus'] },
  { id: 122, title: 'Classical Highlights', description: 'The essential ancient sites for a first visit, in walking order.', category: 'historical', stops: ['ancient_agora', 'hephaisteion', 'areopagus', 'parthenon', 'erechtheion'] },

  // ── Plaka, Monastiraki and the old town ────────────────────────────────
  { id: 123, title: 'Plaka Wanderer', description: 'The lanes of the oldest inhabited quarter, ending in the island-style houses.', category: 'cultural', stops: ['adrianou', 'folk_art', 'mnisikleous', 'anafiotika'] },
  { id: 124, title: 'Anafiotika Climb', description: 'Up the taverna steps into the Cycladic hamlet on the north slope.', category: 'cultural', stops: ['adrianou', 'mnisikleous', 'anafiotika', 'areopagus'] },
  { id: 125, title: 'Byzantine Athens', description: 'Two medieval Byzantine churches, the 19th-century cathedral beside them and the folk art museum in Plaka.', category: 'historical', stops: ['kapnikarea', 'cathedral', 'little_metropolis', 'folk_art'] },
  { id: 126, title: 'Churches of the Old City', description: 'Byzantine chapels, the 19th-century cathedral and the Roman Tower of the Winds, within a few hundred metres.', category: 'historical', stops: ['kapnikarea', 'cathedral', 'little_metropolis', 'tower_winds'] },
  { id: 127, title: 'Ermou Shopping Walk', description: 'The main pedestrian street from Parliament down to the flea market.', category: 'cultural', stops: ['parliament', 'ermou', 'kapnikarea', 'tzistarakis'] },
  { id: 128, title: 'Syntagma to Monastiraki', description: 'The spine of the city centre, from the square to the antiques market.', category: 'cultural', stops: ['parliament', 'ermou', 'cathedral', 'tzistarakis', 'avissynias'] },
  { id: 129, title: 'Flea Market Circuit', description: 'Antiques, coppersmiths and the Ottoman mosque at the centre of it all.', category: 'cultural', stops: ['avissynias', 'tzistarakis', 'hadrian_library', 'psyrri'] },
  { id: 130, title: 'Psyrri After Dark', description: 'The workshop quarter that turns into a nightlife district after dark, then back to Monastiraki.', category: 'cultural', stops: ['psyrri', 'avissynias', 'tzistarakis'] },
  { id: 131, title: 'Plaka Tavernas', description: 'The stepped restaurant streets and the folk collections around them.', category: 'cultural', stops: ['mnisikleous', 'adrianou', 'folk_art'] },
  { id: 132, title: 'Lanes of Old Athens', description: 'From the hamlet on the rock down through Plaka to the cathedral square.', category: 'cultural', stops: ['anafiotika', 'mnisikleous', 'adrianou', 'cathedral'] },
  { id: 133, title: 'Cathedral Square Circuit', description: 'The great cathedral, the tiny marble chapel beside it, and Ermou Street.', category: 'cultural', stops: ['cathedral', 'little_metropolis', 'ermou', 'kapnikarea'] },
  { id: 134, title: 'Jewish Athens', description: 'The museum of Greek Jewish life and the Plaka streets around it.', category: 'cultural', stops: ['jewish_museum', 'folk_art', 'adrianou'] },
  { id: 135, title: 'Folk Traditions', description: 'Costume, silverwork and shadow theatre, then the churches of the old town.', category: 'cultural', stops: ['folk_art', 'adrianou', 'cathedral', 'kapnikarea'] },
  { id: 136, title: 'Monastiraki Morning', description: 'The square, the mosque and the Roman ruins before the crowds arrive.', category: 'cultural', stops: ['tzistarakis', 'avissynias', 'hadrian_library', 'roman_agora'] },
  { id: 137, title: 'Ottoman Traces', description: 'What four centuries of Ottoman Athens left behind in the old town.', category: 'historical', stops: ['tzistarakis', 'roman_agora', 'tower_winds'] },

  // ── Neoclassical Athens and the museums ────────────────────────────────
  { id: 138, title: 'The Neoclassical Trilogy', description: 'The trilogy of the Hansen brothers: the Academy, the University and the National Library in a row.', category: 'cultural', stops: ['academy', 'university', 'national_library'] },
  { id: 139, title: 'Panepistimiou Grandeur', description: 'From the Old Parliament past the neoclassical trilogy on Panepistimiou to Omonia.', category: 'cultural', stops: ['old_parliament', 'academy', 'university', 'national_library', 'omonia'] },
  { id: 140, title: 'Omonia to Syntagma', description: 'From Omonia along the marble facades to the seat of government.', category: 'cultural', stops: ['omonia', 'national_library', 'academy', 'old_parliament', 'parliament'] },
  { id: 141, title: 'Kotzia and the Market', description: 'The City Hall square, the ancient road beneath it, and the central market.', category: 'cultural', stops: ['kotzia', 'varvakios', 'omonia'] },
  { id: 142, title: 'Market Morning', description: 'The meat and fish halls at their busiest, then the workshop lanes of Psyrri.', category: 'cultural', stops: ['varvakios', 'kotzia', 'psyrri'] },
  { id: 143, title: 'Museum Mile', description: 'Four major collections on and just off Vasilissis Sofias, heading east from the Benaki.', category: 'cultural', stops: ['benaki', 'cycladic', 'byzantine_museum', 'war_museum'] },
  { id: 144, title: 'Kolonaki Culture', description: 'The smart quarter and the two private collections at its edge.', category: 'cultural', stops: ['kolonaki', 'cycladic', 'benaki', 'dexameni'] },
  { id: 145, title: 'Byzantine and War Museums', description: 'Icons and armour, ending at the Megaron concert hall.', category: 'cultural', stops: ['war_museum', 'byzantine_museum', 'megaron'] },
  { id: 146, title: 'Cycladic Art Walk', description: 'The full embassy-row museum sequence from Benaki to the Megaron.', category: 'cultural', stops: ['benaki', 'cycladic', 'war_museum', 'byzantine_museum', 'megaron'] },
  { id: 147, title: 'The National Archaeological Museum', description: 'The greatest collection in Greece, approached through the student quarter.', category: 'cultural', stops: ['exarcheia', 'national_arch_museum', 'pedion_areos'] },
  { id: 148, title: 'Coins and Mansions', description: 'The Schliemann house, the Old Parliament and the Academy.', category: 'cultural', stops: ['numismatic', 'old_parliament', 'academy'] },
  { id: 149, title: 'The Athens of Schliemann', description: 'The archaeologist mansion and the neoclassical city he helped shape.', category: 'cultural', stops: ['numismatic', 'academy', 'university'] },
  { id: 150, title: 'Literary Athens', description: 'The library, the university and the parliament that made the modern state.', category: 'cultural', stops: ['national_library', 'university', 'academy', 'old_parliament'] },
  { id: 151, title: 'Museum to Monument', description: 'From the archaeological museum south through Exarcheia to the marble facades.', category: 'cultural', stops: ['national_arch_museum', 'exarcheia', 'academy', 'old_parliament'] },

  // ── Kolonaki, Lycabettus and the east ──────────────────────────────────
  { id: 152, title: 'Lycabettus Ascent', description: 'Up the highest hill in central Athens, on foot from Kolonaki.', category: 'nature', stops: ['kolonaki', 'lycabettus_funicular', 'lycabettus', 'agios_georgios'] },
  { id: 153, title: 'Lycabettus Summit Chapel', description: 'From Dexameni Square past the lower funicular station and up the steps to the summit chapel.', category: 'nature', stops: ['dexameni', 'lycabettus_funicular', 'agios_georgios'] },
  { id: 154, title: 'Kolonaki Cafes', description: 'The square, the reservoir garden at Dexameni and the Benaki collection.', category: 'cultural', stops: ['kolonaki', 'dexameni', 'benaki'] },
  { id: 155, title: 'Benaki to Lycabettus', description: 'From the museum through Kolonaki to the foot of the funicular.', category: 'cultural', stops: ['benaki', 'kolonaki', 'dexameni', 'lycabettus_funicular'] },
  { id: 156, title: 'Kolonaki to the Summit', description: 'The full climb from the square to the top of the hill.', category: 'nature', stops: ['kolonaki', 'dexameni', 'lycabettus_funicular', 'lycabettus'] },
  { id: 157, title: 'Embassy Row', description: 'The avenue of museums and legations east of the National Garden.', category: 'cultural', stops: ['megaron', 'byzantine_museum', 'war_museum', 'cycladic'] },
  { id: 158, title: 'Concert Hall and Collections', description: 'An eastern walk ending at the principal concert hall of the city.', category: 'cultural', stops: ['cycladic', 'byzantine_museum', 'megaron'] },
  { id: 159, title: 'Quiet Corners of Kolonaki', description: 'Dexameni and Kolonaki squares above the shopping streets, ending at the Benaki Museum.', category: 'nature', stops: ['dexameni', 'kolonaki', 'benaki'] },

  // ── The stadium, the gardens and the south-east ────────────────────────
  { id: 160, title: 'Panathenaic Stadium Walk', description: 'The marble stadium of the first modern Olympics and the hill behind it.', category: 'historical', stops: ['aigli', 'kallimarmaro', 'ardittos'] },
  { id: 161, title: 'Marble Stadium and Gardens', description: 'From the arch and the great temple through the gardens to the stadium.', category: 'historical', stops: ['hadrian_arch', 'olympian_zeus', 'aigli', 'kallimarmaro'] },
  { id: 162, title: 'Ardittos Green', description: 'The wooded rise between the stadium and the old cemetery.', category: 'nature', stops: ['kallimarmaro', 'ardittos', 'first_cemetery'] },
  { id: 163, title: 'First Cemetery Sculptures', description: 'An open-air gallery of neoclassical funerary sculpture.', category: 'cultural', stops: ['first_cemetery', 'ardittos', 'kallimarmaro'] },
  { id: 164, title: 'Zappeion Gardens', description: 'The garden courtyard, the great temple and the emperor arch.', category: 'nature', stops: ['aigli', 'olympian_zeus', 'hadrian_arch'] },
  { id: 165, title: 'The Presidential Quarter', description: 'The Presidential Mansion and the Parliament, the two palaces beside the National Garden, then the Benaki Museum.', category: 'historical', stops: ['presidential', 'parliament', 'benaki'] },
  { id: 166, title: 'Evzones and Gardens', description: 'Both changing-of-the-guard posts, joined through the gardens.', category: 'historical', stops: ['parliament', 'presidential', 'aigli'] },
  { id: 167, title: 'Stadium to Cemetery', description: 'A southern walk past the marble stadium and over Ardittos Hill to the First Cemetery.', category: 'nature', stops: ['aigli', 'kallimarmaro', 'ardittos', 'first_cemetery'] },
  { id: 168, title: 'Zappeion to the Presidential Mansion', description: 'The garden courtyard, the Temple of Olympian Zeus and the Presidential Mansion, with benches along the way.', category: 'nature', stops: ['aigli', 'olympian_zeus', 'presidential'] },
  { id: 169, title: 'Parks and Palaces', description: 'The presidential mansion, the garden courtyard and the marble stadium.', category: 'nature', stops: ['presidential', 'aigli', 'kallimarmaro'] },

  // ── The northern quarters ──────────────────────────────────────────────
  { id: 170, title: 'Exarcheia and Strefi', description: 'The counterculture quarter and the rocky park above it.', category: 'cultural', stops: ['exarcheia', 'strefi', 'national_arch_museum'] },
  { id: 171, title: 'Pedion tou Areos and Strefi', description: 'One of the largest parks in Athens, the archaeological museum at its edge and the rocky Strefi Hill.', category: 'nature', stops: ['pedion_areos', 'national_arch_museum', 'strefi'] },
  { id: 172, title: 'Green Athens', description: 'Two parks, Pedion tou Areos and Strefi Hill, ending in Exarcheia Square north of the centre.', category: 'nature', stops: ['pedion_areos', 'strefi', 'exarcheia'] },
  { id: 173, title: 'Morning in the Park', description: 'A northern walk from the park past the archaeological museum to Exarcheia, before the heat of the day.', category: 'nature', stops: ['pedion_areos', 'national_arch_museum', 'exarcheia'] },
  { id: 174, title: 'Murals of Exarcheia', description: 'The mural-covered square of Exarcheia, then up Strefi Hill and on to Pedion tou Areos.', category: 'cultural', stops: ['exarcheia', 'strefi', 'pedion_areos'] },

  // ── The western quarters ───────────────────────────────────────────────
  { id: 175, title: 'Street Art of Psyrri', description: 'Workshop walls, the Metaxourgeio square and the old gasworks.', category: 'cultural', stops: ['psyrri', 'avdi', 'technopolis'] },
  { id: 176, title: 'Metaxourgeio Murals', description: 'The painted quarter between the market and the ancient cemetery.', category: 'cultural', stops: ['avdi', 'psyrri', 'kerameikos_site'] },
  { id: 177, title: 'Industrial Heritage', description: 'The gasworks, the Thissio townhouse museum and the promenade below.', category: 'cultural', stops: ['technopolis', 'herakleidon', 'thissio_promenade'] },
  { id: 178, title: 'Art Spaces West', description: 'The contemporary galleries and culture parks west of the centre.', category: 'cultural', stops: ['avdi', 'technopolis', 'kerameikos_site'] },
  { id: 179, title: 'Thissio Promenade Stroll', description: 'The Apostolou Pavlou pedestrian avenue, the Herakleidon Museum and the Temple of Hephaestus above the Agora.', category: 'nature', stops: ['thissio_promenade', 'herakleidon', 'hephaisteion', 'ancient_agora'] },
  { id: 180, title: 'Coppersmiths and Antiques', description: 'The surviving trade streets between the flea market and the central market.', category: 'cultural', stops: ['avissynias', 'psyrri', 'varvakios'] },
  { id: 181, title: 'From Gazi to the Agora', description: 'A long west-to-east traverse from the gasworks to the Ancient Agora.', category: 'historical', stops: ['technopolis', 'kerameikos_site', 'thissio_promenade', 'hephaisteion', 'ancient_agora'] },

  // ── Panoramas and viewpoints ───────────────────────────────────────────
  { id: 182, title: 'Panorama of Athens', description: 'The Hill of the Muses and the Pnyx, each with a different angle on the Acropolis, then down to the Thissio promenade.', category: 'nature', stops: ['philopappos', 'pnyx', 'thissio_promenade'] },
  { id: 183, title: 'Rooftops and Rock', description: 'The bedrock terrace and the whitewashed houses clinging beneath it.', category: 'nature', stops: ['areopagus', 'anafiotika', 'mnisikleous'] },
  { id: 184, title: 'Sunset Viewpoints', description: 'Timed for the last light on the west face of the Acropolis.', category: 'nature', stops: ['philopappos', 'areopagus', 'propylaea'] },
  { id: 185, title: 'Two Hills Walk', description: 'The assembly terrace and the monument hill, ending at the Temple of Hephaestus above the Agora.', category: 'nature', stops: ['pnyx', 'philopappos', 'hephaisteion'] },
  { id: 186, title: 'The Highest Point', description: 'Straight to the summit chapel for the widest view in the city.', category: 'nature', stops: ['lycabettus_funicular', 'lycabettus', 'agios_georgios'] },

  // ── Routes described by their measured path barriers ───────────────────
  { id: 187, title: 'Step-Free City Centre', description: 'No steps on the path from Parliament to the flea market; a short stretch is cobbled.', category: 'cultural', stops: ['parliament', 'ermou', 'cathedral', 'tzistarakis'] },
  { id: 188, title: 'Step-Free Acropolis Approach', description: 'The marble promenade and the museum with no steps, avoiding the climb to the summit; nearly half the path is cobbled.', category: 'historical', stops: ['areopagitou', 'acropolis_museum', 'hadrian_arch'] },
  { id: 189, title: 'Step-Free Central Sights', description: 'Ermou Street, two churches and the Parliament with no steps on the path; a short stretch is cobbled, and Kapnikarea itself has limited wheelchair access.', category: 'cultural', stops: ['ermou', 'kapnikarea', 'cathedral', 'parliament'] },
  { id: 190, title: 'Smooth Paths and Rest Stops', description: 'No steps or cobbles on the path, with benches along the way; two raised kerbs to cross.', category: 'nature', stops: ['aigli', 'olympian_zeus', 'hadrian_arch', 'parliament'] },
  { id: 191, title: 'Acropolis Museum to the Jewish Museum', description: 'Two museums joined by the Dionysiou Areopagitou promenade with no steps; about a third of the path is cobbled, with one raised kerb.', category: 'cultural', stops: ['acropolis_museum', 'areopagitou', 'jewish_museum'] },
  { id: 192, title: 'Kolonaki and the Eastern Museums', description: 'Kolonaki Square and three museums on and near Vasilissis Sofias; the path includes some steps.', category: 'cultural', stops: ['kolonaki', 'cycladic', 'byzantine_museum', 'war_museum'] },
  { id: 193, title: 'Downtown Along Panepistimiou', description: 'From Omonia to the Academy, the University and the National Library; the path has a few steps and one raised kerb.', category: 'cultural', stops: ['omonia', 'academy', 'university', 'national_library'] },
  { id: 194, title: 'Step-Free Market Walk', description: 'Omonia, the City Hall square and the covered market, with no steps on the path.', category: 'cultural', stops: ['omonia', 'kotzia', 'varvakios'] },
  { id: 195, title: 'Culture Park Walk', description: 'The gasworks, the painted Avdi Square and the Kerameikos site; a few steps, some cobbles and one raised kerb on the way.', category: 'cultural', stops: ['technopolis', 'avdi', 'kerameikos_site'] },
  { id: 196, title: 'Thissio to Gazi and Metaxourgeio', description: 'From the Apostolou Pavlou promenade west to the Technopolis gasworks and Avdi Square.', category: 'nature', stops: ['thissio_promenade', 'technopolis', 'avdi'] },

  // ── Long traverses ─────────────────────────────────────────────────────
  { id: 197, title: 'The Full Historic Centre', description: 'Parliament to the Acropolis slopes, taking in Plaka on the way.', category: 'historical', stops: ['parliament', 'ermou', 'cathedral', 'adrianou', 'areopagitou'] },
  { id: 198, title: 'Grand Tour of Antiquity', description: 'The great temple, the arch and the whole southern approach to the Parthenon.', category: 'historical', stops: ['olympian_zeus', 'hadrian_arch', 'areopagitou', 'herodion', 'parthenon'] },
  { id: 199, title: 'Parliament to the Ancient Agora', description: 'From Parliament down Ermou Street through Monastiraki to the Ancient Agora.', category: 'historical', stops: ['parliament', 'ermou', 'tzistarakis', 'hadrian_library', 'ancient_agora'] },
  { id: 200, title: 'North to South Traverse', description: 'The length of the city centre, from Omonia to the Temple of Olympian Zeus.', category: 'historical', stops: ['omonia', 'academy', 'parliament', 'aigli', 'olympian_zeus'] },
];

module.exports = { ROUTES };
