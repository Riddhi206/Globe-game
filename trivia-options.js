// trivia-options.js — hand-written wrong answers for trivia questions whose
// answer doesn't fit an automatic category (see buildChoices in data.js).
// Keyed by the exact question text. An entry here also overrides the
// automatic options for that question.

const TRIVIA_WRONG = {
  // Albania – Czech Republic
  "During the Cold War, Albania built over 170,000 of what concrete defensive structures across the country?": ["Watchtowers", "Tunnels", "Border walls"],
  "Antigua promotes itself as having 365 of what natural feature — one for each day of the year?": ["Coves", "Waterfalls", "Coral reefs"],
  "Argentina shares the world's widest river estuary — what is it called?": ["Paraná Delta", "Amazon Estuary", "Orinoco Delta"],
  "What world-famous Austrian-born bodybuilder won Mr. Universe and served as Governor of California?": ["Lou Ferrigno", "Dwayne Johnson", "Sylvester Stallone"],
  "Azerbaijan is famously nicknamed the 'Land of' what?": ["Wind", "Gold", "Mountains"],
  "In the early 1700s, Nassau in the Bahamas was famously governed as a lawless republic of what seafaring outlaws?": ["Smugglers", "Mutineers", "Privateers"],
  "What causeway connects Bahrain to the mainland of Saudi Arabia?": ["Gulf Bridge", "Qatar Causeway", "Pearl Causeway"],
  "Belarus is a global powerhouse in manufacturing what enormous yellow construction vehicles used in open-pit mines?": ["Bulldozers", "Excavators", "Cranes"],
  "Belgium is the headquarters of which major international organization?": ["United Nations", "World Bank", "OPEC"],
  "What ancient Mesoamerican civilization built major archaeological cities like Caracol in Belize?": ["Aztec", "Olmec", "Inca"],
  "Belize is home to the second largest barrier system in the world of what marine ecosystem?": ["Kelp Forest", "Mangrove", "Seagrass Meadow"],
  "Benin is located in which region of Africa?": ["East Africa", "Central Africa", "Southern Africa"],
  "Bhutan measures its national progress not using GDP, but Gross National what?": ["Wellbeing", "Harmony", "Wealth"],
  "What winding cliffside dirt road in the Bolivian Andes was notoriously nicknamed the 'Death Road' for extreme cyclists?": ["Devil's Highway", "Andes Pass", "Condor Trail"],
  "What royal title is held by the absolute ruler of Brunei?": ["Emir", "Shah", "King"],
  "The Sultan of Brunei famously owns one of the world's largest private collections of what luxury items?": ["Watches", "Yachts", "Paintings"],
  "What script used widely across Eastern Europe originated in the First Bulgarian Empire?": ["Glagolitic", "Latin", "Greek"],
  "Burkina Faso was formerly known by what name?": ["Gold Coast", "Dahomey", "French Sudan"],
  "The name Burkina Faso translates into English as the 'Land of Incorruptible' what?": ["Kings", "Warriors", "Rivers"],
  "What traditional percussion performers of Burundi are recognized on UNESCO's cultural heritage list?": ["Talking Drummers", "Griots", "Mbira Players"],
  "What is the largest freshwater lake in Southeast Asia, situated in Cambodia?": ["Inle Lake", "Lake Toba", "Songkhla Lake"],
  "What giant freshwater lake in Cambodia dramatically reverses its flow direction twice a year with the monsoon?": ["Inle Lake", "Lake Toba", "Laguna de Bay"],
  "Cameroon is sometimes called 'Africa in miniature' — why?": ["It is shaped like Africa", "It is Africa's smallest country", "It has every African language"],
  "What is the largest province in Canada by area?": ["Ontario", "British Columbia", "Alberta"],
  "What leaf is featured on the national flag of Canada?": ["Oak leaf", "Birch leaf", "Pine needle"],
  "What popular pizza style topped with ham and canned pineapple was actually invented in Ontario, Canada, in 1962?": ["Tropical Pizza", "Canadian Pizza", "Pacific Pizza"],
  "Canada's postal service assigned what festive Canadian postal code to Santa Claus so children's letters get answered?": ["N0R 7H1", "X0X 0X0", "S4N 7A1"],
  "Lake Chad, once one of Africa's largest lakes, borders Chad and which other countries?": ["Sudan, Libya, Egypt", "Mali, Burkina Faso, Ghana", "Ethiopia, Kenya, Uganda"],
  "Ancient rock art in the arid Ennedi Plateau of Chad surprisingly depicts humans swimming in what is now which desert?": ["Kalahari", "Namib", "Gobi"],
  "What is the southern tip of South America shared by Chile and Argentina called?": ["Patagonia", "Cape Horn", "Atacama"],
  "What ancient trade route network connected China with the Mediterranean world?": ["Spice Route", "Amber Road", "Tea Horse Road"],
  "Brazzaville and Kinshasa are the closest pair of what in the world?": ["Border towns", "Seaports", "River islands"],
  "Costa Rica is known for its policy of what?": ["Tax-free living", "Open borders", "Free healthcare"],
  "What popular phrase meaning 'pure life' is the national motto of Costa Rica?": ["Hakuna Matata", "Buena Vida", "Vida Loca"],
  "Costa Rica is renowned for world peace, having permanently abolished what armed institution in 1948?": ["Police", "Navy", "Monarchy"],
  "What men's formal neckwear clothing accessory worn with suits was invented by Croatian soldiers in the 17th century?": ["Bow tie", "Cravat pin", "Ascot"],
  "According to Greek mythology, Cyprus was the birthplace of which goddess of love and beauty?": ["Athena", "Hera", "Artemis"],
  "According to ancient Greek legend, which goddess of love and beauty was born from the ocean surf off the coast of Cyprus?": ["Athena", "Hera", "Demeter"],
  "The Czech Republic is also known by what one-word name?": ["Bohemia", "Moravia", "Czechoslovakia"],

  // Denmark – Gabon
  "What Danish cultural buzzword describes a feeling of cozy contentment, warm comfort, and enjoying simple pleasures?": ["Lagom", "Sisu", "Gezellig"],
  "Djibouti sits on which critical strait that links the Red Sea to the Gulf of Aden?": ["Strait of Hormuz", "Strait of Gibraltar", "Suez Strait"],
  "What indigenous Amerindian people still possess a designated territory on Dominica?": ["Taíno", "Arawak", "Garifuna"],
  "Ecuador is named after what geographic feature that passes through it?": ["Andes", "Amazon", "Tropic of Cancer"],
  "What man-made waterway in Egypt connects the Mediterranean Sea to the Red Sea?": ["Panama Canal", "Nile Canal", "Aswan Channel"],
  "Ancient Egyptians revered what common four-legged domestic pet so intensely that killing one carried the death penalty?": ["Dogs", "Horses", "Goats"],
  "What is the continental mainland region of Equatorial Guinea called?": ["Bioko", "Annobón", "Cabinda"],
  "Asmara is celebrated for its well-preserved colonial architecture in which modernist style?": ["Baroque", "Gothic Revival", "Art Nouveau"],
  "What Italian modernist architectural movement left Asmara with hundreds of whimsical 1930s futuristic buildings and cinemas?": ["Baroque", "Brutalism", "Neoclassicism"],
  "Estonia is known as one of the most digitally advanced countries — what e-service pioneered this?": ["Digital Nordic", "Baltic Cloud", "Tallinn Online"],
  "Estonia is one of the three nations comprising which Baltic regional group?": ["Nordic Council", "Benelux", "Visegrád Group"],
  "What popular internet voice/video calling application was originally founded in Estonia in 2003?": ["Zoom", "WhatsApp", "Viber"],
  "Estonia was the very first country in the world to allow its citizens to cast general election votes over what platform?": ["Text message", "Telephone", "Postal mail"],
  "What famous annual cultural ceremony involves tens of thousands of women dancing with cut reeds?": ["Incwala", "Zulu Reed Festival", "Timkat"],
  "Eswatini is the last remaining absolute country of what type in Africa?": ["Theocracy", "Sultanate", "Federation"],
  "Ethiopia is home to the source of which famous river?": ["White Nile", "Congo", "Niger"],
  "What traditional underground earth pit oven in Fiji cooks marinated meats and root vegetables wrapped in banana leaves?": ["Hangi", "Umu", "Imu"],
  "The Finnish concept of perseverance and resilience is known as?": ["Hygge", "Lagom", "Kalsarikännit"],
  "What thermal bath and relaxation room is a central part of Finnish national culture?": ["Hammam", "Onsen", "Banya"],
  "Which northern region of Finland is famously considered the home of Santa Claus?": ["Karelia", "Ostrobothnia", "Kainuu"],
  "Gabon is located on which coast of Africa?": ["East coast", "North coast", "South coast"],

  // Germany – Mozambique
  "What famous German federal highway network is world-renowned for having extensive sections with no posted speed limit?": ["Autostrada", "Interstate", "Autoroute"],
  "Lake Volta in Ghana is one of the world's largest what?": ["Crater lakes", "Salt lakes", "Glacial lakes"],
  "What popular tourist underwater installation by Jason deCaires Taylor is located off Grenada's coast?": ["Coral Cathedral", "Sunken Garden", "Atlantis Reef"],
  "The indigenous name Guyana translates to 'Land of Many' what?": ["Trees", "Birds", "Rivers"],
  "In 1804, Haiti made history as the very first nation in the world established through a successful rebellion of what people?": ["Farmers", "Sailors", "Soldiers"],
  "What is the name of Iceland's national parliament, founded in 930 AD as one of the world's oldest?": ["Storting", "Riksdag", "Folketing"],
  "Iceland is renowned as the land of fire and what cold element?": ["Snow", "Frost", "Hail"],
  "What natural atmospheric light display is frequently viewed in Iceland's night skies?": ["Southern Lights", "Ball Lightning", "Zodiacal Light"],
  "National surveys in Iceland have revealed that a majority of citizens believe in, or refuse to deny the existence of, what magical beings?": ["Trolls", "Mermaids", "Dragons"],
  "The Ganges River is considered sacred in which religion?": ["Buddhism", "Sikhism", "Jainism"],
  "What white marble mausoleum in Agra is one of the New Seven Wonders of the World?": ["Red Fort", "Humayun's Tomb", "Qutub Minar"],
  "Iran was formerly known by what name?": ["Mesopotamia", "Assyria", "Babylon"],
  "What luxurious hand-knotted wool and silk floor coverings from Iran can take artisans years or decades to weave?": ["Kilim Mats", "Tapestries", "Tatami Mats"],
  "Ancient Mesopotamia in modern Iraq was the birthplace of what earliest known writing system, pressed with reeds into clay?": ["Hieroglyphs", "Sanskrit", "Runes"],
  "Ireland is known as the Emerald Isle due to its?": ["Gemstone mines", "Green flag", "Emerald-coloured sea"],
  "What dramatic sea cliffs in County Clare rise over 200 meters above the Atlantic Ocean?": ["White Cliffs of Dover", "Slieve League", "Giant's Causeway"],
  "What small, portable USB flash memory drive used worldwide for data was invented and patented by an Israeli company?": ["Floppy Disk", "SD Card", "CD-ROM"],
  "The Colosseum in Rome was built by which ancient civilization?": ["Greeks", "Etruscans", "Byzantines"],
  "Which independent sovereign microstate is an enclave completely surrounded by Rome?": ["San Marino", "Monaco", "Malta"],
  "The Basilica of Our Lady of Peace in Yamoussoukro is one of the largest what in the world?": ["Mosques", "Stadiums", "Palaces"],
  "What famous Jamaican sprinter holds the world record for the 100m and 200m?": ["Yohan Blake", "Asafa Powell", "Justin Gatlin"],
  "What traditional Japanese garment means literally 'thing to wear'?": ["Yukata", "Hakama", "Obi"],
  "What high-speed bullet train network connects major Japanese cities?": ["Maglev", "Eurostar", "KTX"],
  "Kenya is home to which famous annual wildlife migration?": ["Great Zebra Trek", "Monarch Migration", "Elephant March"],
  "What epic annual wildlife spectacle in Kenya sees over 1.5 million wildebeest migrate across the Mara River?": ["Great Crossing", "Serengeti Run", "Big Five Trek"],
  "Kiribati is the only nation in the world situated in all four of what global divisions?": ["Time zones", "Oceans", "Climate zones"],
  "In 1995, Kiribati moved the International Date Line thousands of kilometers east so its entire nation would share the same what?": ["Time zone", "Season", "Currency"],
  "With summer temperatures frequently exceeding 50°C (122°F), Kuwait regularly ranks among the world's most what places?": ["Humid", "Windy", "Polluted"],
  "What traditional circular felt tent is a nomadic symbol of Kyrgyzstan?": ["Tipi", "Igloo", "Wigwam"],
  "What circular felt-covered tent used by nomadic herders is a cherished national symbol shown on Kyrgyzstan's flag?": ["Tipi", "Wigwam", "Chum"],
  "Latvia is one of the Baltic states — what are the other two?": ["Finland and Estonia", "Lithuania and Poland", "Estonia and Belarus"],
  "Riga is world-renowned for having the highest concentration of which architectural style in Europe?": ["Baroque", "Gothic", "Art Deco"],
  "Latvia claims the historical record for decorating the world's very first documented public what during winter in 1510?": ["Ice rink", "Snowman", "Street market"],
  "Lebanon is known as the 'Switzerland of the Middle East' due to its?": ["Snowy mountains", "Neutrality", "Watchmaking"],
  "What ancient seafaring trade civilization from the coast of Lebanon developed the world's first phonetic alphabet?": ["Sumerians", "Minoans", "Hittites"],
  "Lesotho is the only independent state on Earth whose entire territory lies above 1,000 meters in what measurement?": ["Latitude", "Rainfall", "Temperature"],
  "What traditional woven conical hat is a national symbol featured on Lesotho's flag?": ["Sombrero", "Nón lá", "Fez"],
  "Liberia is one of only three countries in the world that has not officially adopted which international decimal system of units?": ["Imperial System", "Decimal Currency", "Celsius Scale"],
  "In 1866, Liechtenstein dispatched an 80-man military unit to war and returned with 81 men because they made an Italian what?": ["Prisoner", "Deserter", "Guide"],
  "Liechtenstein is a global manufacturing hub for what specialized prosthetic dental devices used by dentists worldwide?": ["Dental Braces", "Dental Drills", "Hearing Aids"],
  "Lithuania was the last country in Europe to officially adopt which religion?": ["Islam", "Judaism", "Protestantism"],
  "Luxembourg is the world's only remaining sovereign country governed by what title of monarch?": ["Prince", "Emperor", "Archduke"],
  "In 2020, Luxembourg became the very first nation on Earth to make all public trains, trams, and buses completely what?": ["Electric", "Driverless", "Solar-powered"],
  "What is the noble royal title held by the hereditary reigning monarch of Luxembourg?": ["Prince", "Emperor", "Archduke"],
  "Malawi is affectionately nicknamed what friendly moniker in Africa?": ["Pearl of Africa", "Land of a Thousand Hills", "Rainbow Nation"],
  "What affectionate nickname is famously given to Malawi because of the exceptional friendliness of its people?": ["Pearl of Africa", "Smiling Coast", "Rainbow Nation"],
  "The Maldives is the world's lowest country by average ground what?": ["Temperature", "Population", "Rainfall"],
  "In 2009, the government cabinet of the Maldives held a press conference underwater wearing what gear to highlight sea-level rise?": ["Life jackets", "Wetsuits only", "Space suits"],
  "Which 14th-century ruler of the Mali Empire is widely considered the wealthiest individual in history?": ["Sundiata Keita", "Askia Muhammad", "Sunni Ali"],
  "What massive adobe mud-brick building in Mali is the largest of its kind in the world?": ["Sankore Mosque", "Great Mosque of Kairouan", "Larabanga Mosque"],
  "What famous historic military order of Christian knights ruled Malta from 1530 to 1798?": ["Knights Templar", "Teutonic Knights", "Knights of the Round Table"],
  "Traditional Marshallese sailors navigated the open ocean using charts made from shells and what material?": ["Bones", "Seaweed", "Feathers"],
  "What massive circular geological feature in central Mauritania is known as the 'Eye of the Sahara'?": ["Tassili Ring", "Aorounga Crater", "Ahaggar Dome"],
  "What massive 40-kilometer circular geological formation in Mauritania is visible from orbit as the 'Eye of the Sahara'?": ["Tassili Ring", "Aorounga Crater", "Ahaggar Dome"],
  "What famous geological feature in southwest Mauritius displays dunes of distinct rainbow hues?": ["Rainbow Mountain", "Painted Desert", "Le Morne Dunes"],
  "What geological wonder in southwest Mauritius features natural sand dunes striped with seven distinct rainbow hues?": ["Rainbow Mountain", "Painted Desert", "Le Morne Dunes"],
  "Micronesia is located in which part of the Pacific Ocean?": ["Eastern Pacific", "South Pacific", "North Pacific coast"],
  "Mileștii Mici in Moldova holds the Guinness World Record for the largest what in the world?": ["Vineyard", "Salt mine", "Bread oven"],
  "What world-famous upscale casino district is located in Monaco?": ["Las Vegas Strip", "Cotai", "Baden-Baden"],
  "Monaco is the second smallest independent nation in the world after which state?": ["San Marino", "Liechtenstein", "Nauru"],
  "Citizens of Monaco are strictly forbidden by national law from gambling in which world-famous casino?": ["Casino Royale", "Bellagio", "Casino de Paris"],
  "Which 13th-century conqueror founded the Mongol Empire?": ["Kublai Khan", "Attila the Hun", "Tamerlane"],
  "What legendary 13th-century conqueror united the nomadic tribes of Mongolia into history's largest contiguous empire?": ["Kublai Khan", "Attila the Hun", "Tamerlane"],
  "What modern military assault firearm is depicted alongside a book and hoe on the national flag of Mozambique?": ["M16", "Uzi", "FN FAL"],
  "The coastal waters of Mozambique are home to the last viable East African population of which gentle herbivorous sea cow?": ["Manatee", "Walrus", "Sea Lion"],

  // Myanmar – Zambia
  "Myanmar was formerly known as?": ["Siam", "Ceylon", "Indochina"],
  "What iconic white clay pan surrounded by giant red dunes is located in Sossusvlei, Namibia?": ["Etosha Pan", "Makgadikgadi", "Skeleton Coast"],
  "Nauru is the smallest independent nation in the world that has what form of government?": ["Monarchy", "Federation", "Theocracy"],
  "Nepal is the birthplace of which religious figure?": ["Confucius", "Mahavira", "Guru Nanak"],
  "The Netherlands is famous for reclaiming land from the sea using what structures?": ["Canals", "Piers", "Sea walls of stone"],
  "What is the seat of the Dutch government and international court of justice (distinct from Amsterdam)?": ["Rotterdam", "Utrecht", "Leiden"],
  "What iconic wind-powered historical structures dot the Dutch countryside?": ["Lighthouses", "Water towers", "Wind turbines"],
  "New Zealand's indigenous people are called?": ["Aboriginals", "Polynesians", "Inuit"],
  "In New Zealand, domestic wool-producing sheep outnumber the human population by roughly what ratio?": ["2 to 1", "10 to 1", "20 to 1"],
  "Niger is the largest country by area in which region of Africa?": ["North Africa", "East Africa", "Central Africa"],
  "What is the booming Nigerian film industry popularly called?": ["Bollywood", "Lollywood", "Kollywood"],
  "Norway has the world's longest fjords — what is the longest called?": ["Geirangerfjord", "Hardangerfjord", "Oslofjord"],
  "What natural light phenomenon illuminates the night skies of northern Norway during winter?": ["Southern Lights", "Midnight Sun", "Ball Lightning"],
  "By royal building codes in Oman, all exterior architecture must be painted exclusively in white or beige to maintain what harmony?": ["Religious Harmony", "Thermal Harmony", "Sound Harmony"],
  "What massive hydroelectric dam on the Paraná River is jointly operated by Paraguay and Brazil?": ["Yacyretá Dam", "Three Gorges Dam", "Guri Dam"],
  "What large, sparsely populated semi-arid lowland region covers western Paraguay?": ["Pampas", "Pantanal", "Llanos"],
  "What giant pre-Columbian geoglyphs etched into the desert sands are located in southern Peru?": ["Atacama Giant", "Paracas Candelabra", "Uffington Horse"],
  "What famous geological formation in Bohol consists of over 1,200 grass-covered mounds?": ["Rice Terraces", "Bohol Domes", "Emerald Hills"],
  "What 16th-century Polish astronomer formulated the model that the Earth orbits the Sun?": ["Galileo Galilei", "Johannes Kepler", "Tycho Brahe"],
  "What world-renowned news media broadcasting network is headquartered in Doha, Qatar?": ["Al Arabiya", "Sky News", "BBC Arabic"],
  "What vast rail network spans over 9,000 kilometers from Moscow to Vladivostok?": ["Orient Express", "Baikal–Amur Line", "Silk Road Railway"],
  "What famous set of Russian wooden nesting dolls open in half to reveal smaller and smaller dolls hidden inside?": ["Babushka Box", "Kokeshi", "Dymkovo"],
  "Rwanda is known as the 'Land of a Thousand' what?": ["Lakes", "Gorillas", "Rivers"],
  "On the last Saturday morning of every month, all citizens of Rwanda participate in Umuganda, a mandatory day of what?": ["Prayer", "Military Training", "Fasting"],
  "What traditional Samoan full-body tattoo, tapped into the skin with bone tools over weeks, is a revered rite of passage?": ["Tā moko", "Kakau", "Sak Yant"],
  "San Marino claims to be the world's oldest surviving sovereign what?": ["Monarchy", "Democracy", "City-state"],
  "What is the ancient microstate of San Marino's historical claim to fame? It is the world's oldest surviving sovereign what?": ["Monarchy", "Democracy", "City-state"],
  "Saudi Arabia is the birthplace of which religion?": ["Judaism", "Zoroastrianism", "Baháʼí Faith"],
  "What vast desert expanse in southern Saudi Arabia is the largest continuous body of sand dunes in the world?": ["Nafud", "Great Sand Sea", "Dasht-e Lut"],
  "What elaborate hand-carved wooden nativity scene in Rajecká Lesná features over 300 moving animated figures?": ["Nazareth", "Jerusalem", "Galilee"],
  "What vast swamp region formed by the White Nile covers a large portion of South Sudan?": ["Okavango", "Pantanal", "Everglades"],
  "What colossal floating papyrus wetland swamp in South Sudan is one of the largest tropical freshwater wetlands in the world?": ["Okavango", "Pantanal", "Everglades"],
  "What pastoralist cattle-herding tribe in South Sudan is known for producing some of the tallest people on the African continent?": ["Maasai", "Zulu", "Himba"],
  "What surreal basilica in Barcelona designed by Antoni Gaudí has been under continuous construction since 1882?": ["Casa Batlló", "Park Güell", "Montserrat"],
  "Sri Lanka was formerly known by what colonial name until 1972?": ["Serendib", "Taprobane", "Tamil Nadu"],
  "What dramatic ancient 200-meter rock citadel in Sri Lanka features ancient frescoes and a gateway carved like giant lion paws?": ["Dambulla", "Anuradhapura", "Polonnaruwa"],
  "Suriname borders Brazil, Guyana, and which French overseas territory?": ["Martinique", "Guadeloupe", "Réunion"],
  "What world-famous flat-pack furniture retail chain was founded in Sweden in 1943?": ["H&M", "JYSK", "Wayfair"],
  "Taiwan is known as the birthplace of what technology sector?": ["Smartphone industry", "Robotics industry", "Video game industry"],
  "What giant intact volcanic caldera in northern Tanzania is a famous wildlife haven?": ["Olduvai Gorge", "Empakaai Crater", "Menengai Crater"],
  "Thailand was formerly known as what country until 1939?": ["Burma", "Annam", "Lan Xang"],
  "What narrow strip of water coastline does Togo have on the Gulf of Guinea?": ["Bight of Biafra", "Gulf of Aden", "Bay of Bengal"],
  "Tonga is the only sovereign monarchy in which region of the world?": ["Caribbean", "Indian Ocean", "Mediterranean"],
  "What ancient North African maritime superpower based in Tunisia fought three epic wars against Rome and was led by Hannibal?": ["Numidia", "Phoenicia", "Egypt"],
  "What famous narrow strait in Turkey separates Europe and Asia while connecting the Black Sea to the Sea of Marmara?": ["Dardanelles", "Strait of Gibraltar", "Kerch Strait"],
  "What fairy-tale region in central Turkey is celebrated for sunrise skies filled with hundreds of floating hot-air balloons?": ["Pamukkale", "Anatolia Plains", "Ephesus"],
  "Tuvalu earns substantial international royalties by licensing which popular country-code top-level domain?": [".io", ".me", ".co"],
  "Tuvalu has the second smallest population of any sovereign nation, after which country?": ["Nauru", "Monaco", "San Marino"],
  "What two-letter internet country-code domain name generates millions in annual licensing royalties for tiny Tuvalu?": [".io", ".me", ".ai"],
  "Tuvalu is so small, peaceful, and tight-knit that there are zero what correctional facilities on its main atoll?": ["Police stations", "Courts", "Banks"],
  "Which British Prime Minister famously coined Uganda 'The Pearl of Africa' in 1908?": ["David Lloyd George", "Neville Chamberlain", "Clement Attlee"],
  "What famous 6,650-kilometer African river has its primary source flowing out from Lake Victoria in Uganda?": ["Congo", "Zambezi", "Niger"],
  "By ancient royal law dating back to the 12th century, the British monarch technically owns all unmarked mute what in open waters?": ["Ducks", "Geese", "Herons"],
  "What is the largest state in the United States by total land area?": ["Texas", "California", "Montana"],
  "Uruguay was the first country in the world to legalize recreational use of which drug?": ["Psilocybin", "Coca leaf", "Kava"],
  "Uzbekistan and Liechtenstein are the only two countries in the world that are what rare geographical status?": ["Enclaved", "Island-locked", "Below sea level"],
  "Uzbekistan and Liechtenstein are the only two nations in the entire world that hold what rare landlocked geographic status?": ["Enclaved", "Triply Landlocked", "Mountain-locked"],
  "What unusual public postal service facility in Vanuatu is submerged 3 meters underwater, requiring waterproof postcards?": ["Volcano Post Office", "Floating Post Office", "Treehouse Post Office"],
  "What natural atmospheric lightning storm phenomenon over Lake Maracaibo in Venezuela flashes up to 300 nights a year?": ["St. Elmo's Fire", "Maracaibo Aurora", "Andes Flash"],
  "What narrow strait connects the Red Sea to the Gulf of Aden southwest of Yemen?": ["Strait of Hormuz", "Strait of Tiran", "Suez Strait"],
  "What naturally formed rock pool perched on the sheer precipice of Victoria Falls in Zambia allows brave swimmers to lean over the edge?": ["Angel's Pool", "Boiling Pot", "Zambezi Basin"],
  "Victoria Falls on the Zambezi River is known locally as Mosi-oa-Tunya, which translates to 'The Smoke That' what?": ["Roars", "Rises", "Falls"],

  // Flag questions (FLAG_TRIVIA_QUESTIONS)
  "What weapon is depicted beneath the Arabic script on Saudi Arabia's flag?": ["Spear", "Dagger", "Bow"],
  "What sun symbol is depicted in the center of Argentina's and Uruguay's flags?": ["Inca Sun", "Rising Sun", "Sun of Liberty"],
  "What bird is depicted perched on a prickly pear cactus on Mexico's flag?": ["Condor", "Quetzal", "Hawk"],
  "What 24-spoke wheel is depicted at the center of India's national flag?": ["Dharma Wheel", "Lotus Wheel", "Surya Chakra"],
  "What leaf is depicted in the center of the flag of Canada: 🇨🇦?": ["Oak leaf", "Birch leaf", "Pine needle"],
};

// Keyed by "Country|Answer" — for answers that come up in more than one
// question (or where the question text is long), one entry covers them all.
const TRIVIA_WRONG_BY_ANSWER = {
  "Afghanistan|Buzkashi": ["Polo", "Kabaddi", "Pehlwani"],
  "Afghanistan|Lapis Lazuli": ["Sapphire", "Turquoise", "Jade"],
  "Albania|Illyrians": ["Thracians", "Celts", "Dacians"],
  "Algeria|Fennec Fox": ["Arctic Fox", "Red Fox", "Bat-eared Fox"],
  "Angola|Giant Sable Antelope": ["Scimitar Oryx", "Greater Kudu", "Bongo"],
  "Antigua and Barbuda|Nelson": ["Drake", "Cook", "Raleigh"],
  "Antigua and Barbuda|Frigatebird": ["Pelican", "Albatross", "Booby"],
  "Antigua and Barbuda|Stingrays": ["Manta Rays", "Sea Turtles", "Dolphins"],
  "Argentina|Tango": ["Salsa", "Samba", "Flamenco"],
  "Argentina|Dulce de leche": ["Nutella", "Marmalade", "Cajeta"],
  "Armenia|Chess": ["Backgammon", "Checkers", "Go"],
  "Armenia|Lavash": ["Naan", "Pita", "Tortilla"],
  "Australia|Great Barrier Reef": ["Ningaloo Reef", "Coral Triangle", "Belize Barrier Reef"],
  "Australia|Sydney": ["Melbourne", "Brisbane", "Perth"],
  "Australia|Uluru": ["Kata Tjuta", "Wave Rock", "Mount Augustus"],
  "Australia|Tasmania": ["Kangaroo Island", "Fraser Island", "Tiwi Islands"],
  "Australia|Emus": ["Kangaroos", "Cassowaries", "Ostriches"],
  "Australia|Eggs": ["Pouches", "Spines", "Webbed feet"],
  "Austria|Mozart": ["Beethoven", "Haydn", "Schubert"],
  "Austria|Apple Strudel": ["Sachertorte", "Linzer Torte", "Kaiserschmarrn"],
  "Azerbaijan|Yanar Dag": ["Darvaza Crater", "Chimaera Flames", "Eternal Flame Falls"],
  "Bahamas|Pigs": ["Goats", "Horses", "Cows"],
  "Bahamas|San Salvador": ["Hispaniola", "Cuba", "Andros"],
  "Bahamas|Dean's Blue Hole": ["Great Blue Hole", "Dragon Hole", "Blue Grotto"],
  "Bahrain|Pearl diving": ["Spice trading", "Shipbuilding", "Salt mining"],
  "Bahrain|Tree of Life": ["Tree of Ténéré", "Dragon Blood Tree", "Baobab of Muscat"],
  "Bahrain|Pearls": ["Sponges", "Coral", "Sea shells"],
  "Bangladesh|Sundarbans": ["Bhitarkanika", "Pichavaram", "Everglades"],
  "Barbados|Rihanna": ["Nicki Minaj", "Shakira", "Beyoncé"],
  "Barbados|Flying Fish": ["Mahi-mahi", "Snapper", "Swordfish"],
  "Barbados|Rum": ["Gin", "Whisky", "Tequila"],
  "Belarus|Białowieża Forest": ["Black Forest", "Bohemian Forest", "Tatra Forest"],
  "Belarus|European Bison": ["Moose", "Aurochs", "Musk Ox"],
  "Belgium|Battle of Waterloo": ["Battle of Austerlitz", "Battle of Leipzig", "Battle of Trafalgar"],
  "Belgium|Chocolate": ["Marzipan", "Nougat", "Licorice"],
  "Belgium|French Fries": ["Potato Chips", "Hash Browns", "Croquettes"],
  "Belgium|Manneken Pis": ["Little Mermaid", "Atomium", "Mannequin Fountain"],
  "Belize|Great Blue Hole": ["Dean's Blue Hole", "Dragon Hole", "Cenote Angelita"],
  "Belize|Howler Monkey": ["Spider Monkey", "Capuchin", "Baboon"],
  "Benin|Vodun": ["Santería", "Candomblé", "Obeah"],
  "Benin|Voodoo": ["Santería", "Candomblé", "Rastafari"],
  "Benin|Dahomey Amazons": ["Mino Guard", "Ashanti Warriors", "Zulu Impis"],
  "Bhutan|Paro Taktsang": ["Punakha Dzong", "Tengboche", "Potala Palace"],
  "Bhutan|Archery": ["Polo", "Wrestling", "Cricket"],
  "Bhutan|Tobacco": ["Alcohol", "Plastic bags", "Chewing gum"],
  "Bhutan|Thunder Dragon": ["Snow Lion", "Garuda", "Phoenix"],
  "Bolivia|Salar de Uyuni": ["Salar de Atacama", "Salinas Grandes", "Bonneville Salt Flats"],
  "Bosnia and Herzegovina|Sarajevo": ["Belgrade", "Zagreb", "Vienna"],
  "Bosnia and Herzegovina|Stari Most": ["Charles Bridge", "Latin Bridge", "Mehmed Paša Bridge"],
  "Bosnia and Herzegovina|Bosnian Coffee": ["Espresso", "Arabic Qahwa", "Cold Brew"],
  "Botswana|Diamonds": ["Emeralds", "Rubies", "Sapphires"],
  "Botswana|Elephants": ["Rhinos", "Hippos", "Giraffes"],
  "Brazil|São Paulo": ["Rio de Janeiro", "Salvador", "Belo Horizonte"],
  "Brazil|Christ the Redeemer": ["Sugarloaf Statue", "Cristo de la Concordia", "Statue of Liberty"],
  "Brazil|Carnival": ["Festa Junina", "Oktoberfest", "Mardi Gras"],
  "Brazil|Piranha": ["Arapaima", "Electric Eel", "Candiru"],
  "Brunei|Borneo": ["Sumatra", "Java", "Sulawesi"],
  "Brunei|Natural Gas": ["Coal", "Gold", "Timber"],
  "Brunei|Kampong Ayer": ["Kampong Glam", "Tonle Sap Village", "Bajau Village"],
  "Bulgaria|Balkan Peninsula": ["Iberian Peninsula", "Crimean Peninsula", "Italian Peninsula"],
  "Bulgaria|Rose oil": ["Lavender oil", "Olive oil", "Sunflower oil"],
  "Bulgaria|Rose Oil": ["Lavender Oil", "Jasmine Oil", "Sandalwood Oil"],
  "Burkina Faso|Crocodiles": ["Hippos", "Turtles", "Pythons"],
  "Burundi|Royal Drummers": ["Talking Drummers", "Griots", "Masked Dancers"],
  "Burundi|Gustave": ["Lolong", "Cassius", "Sweetheart"],
  "Cambodia|Angkor Wat": ["Borobudur", "Bagan", "Preah Vihear"],
  "Cameroon|Douala": ["Yaoundé", "Garoua", "Bamenda"],
  "Cameroon|Carbon Dioxide": ["Methane", "Sulfur Dioxide", "Hydrogen Sulfide"],
  "Cape Verde|Morna": ["Fado", "Coladeira", "Semba"],
  "Cape Verde|Cesária Évora": ["Angélique Kidjo", "Miriam Makeba", "Oumou Sangaré"],
  "Central African Republic|Congo Basin": ["Sahel", "Guinean Savanna", "Upper Guinean Forest"],
  "Central African Republic|Forest Elephants": ["Gorillas", "Okapis", "Bongos"],
  "Central African Republic|Light Pollution": ["Air Pollution", "Noise Pollution", "Cloud Cover"],
  "Chile|Copper": ["Silver", "Lithium", "Iron"],
  "Chile|Easter Island": ["Robinson Crusoe Island", "Chiloé", "Pitcairn Island"],
  "China|North": ["South", "East", "West"],
  "China|Giant Panda": ["Red Panda", "Sun Bear", "Asiatic Black Bear"],
  "China|Terracotta Army": ["Jade Army", "Stone Legion", "Bronze Guard"],
  "Colombia|Coffee": ["Cocoa", "Tea", "Sugarcane"],
  "Colombia|Emerald": ["Ruby", "Jade", "Peridot"],
  "Colombia|Cartagena": ["Santa Marta", "Barranquilla", "Medellín"],
  "Colombia|Cheese": ["Butter", "Egg", "Cream"],
  "Colombia|Caño Cristales": ["Río Magdalena", "Río Cauca", "Río Negro"],
  "Comoros|Ylang-ylang": ["Lavender", "Jasmine", "Sandalwood"],
  "Comoros|Coelacanth": ["Lungfish", "Sturgeon", "Arapaima"],
  "Comoros|Vanilla": ["Cocoa", "Nutmeg", "Coffee"],
  "Congo|Sapeurs": ["Dandies of Dakar", "Afropunks", "Mods"],
  "Costa Rica|Sloth": ["Anteater", "Armadillo", "Koala"],
  "Croatia|Dubrovnik": ["Split", "Zadar", "Kotor"],
  "Croatia|Dalmatian": ["Pointer", "Beagle", "Great Dane"],
  "Cuba|Cigars": ["Snuff", "Pipe tobacco", "Hookah"],
  "Cuba|Mojito": ["Daiquiri", "Piña Colada", "Cuba Libre"],
  "Cyprus|Halloumi": ["Feta", "Mozzarella", "Paneer"],
  "Czech Republic|Charles Bridge": ["Chain Bridge", "Stari Most", "Rialto Bridge"],
  "Czech Republic|Plzeň": ["Brno", "Prague", "Budweis"],
  "Czech Republic|Robot": ["Android", "Cyborg", "Automaton"],
  "DR Congo|Mountain gorilla": ["Bonobo", "Chimpanzee", "Orangutan"],
  "DR Congo|Cobalt": ["Lithium", "Nickel", "Graphite"],
  "DR Congo|Bonobo": ["Chimpanzee", "Gorilla", "Orangutan"],
  "DR Congo|Okapi": ["Bongo", "Zebra Duiker", "Tapir"],
  "Denmark|Jutland": ["Scandinavian Peninsula", "Zealand", "Funen"],
  "Denmark|Lego": ["Meccano", "K'Nex", "Playmobil"],
  "Denmark|Greenland": ["Iceland", "Svalbard", "Baffin Island"],
  "Djibouti|Whale Sharks": ["Manta Rays", "Dolphins", "Sea Turtles"],
  "Djibouti|Float": ["Sink", "Glow", "Tingle"],
  "Dominica|Sisserou Parrot": ["Scarlet Macaw", "Hummingbird", "Frigatebird"],
  "Dominican Republic|Bachata": ["Cumbia", "Salsa", "Reggaeton"],
  "Dominican Republic|Merengue": ["Cumbia", "Samba", "Calypso"],
  "East Timor|Timor": ["Flores", "Sumba", "New Guinea"],
  "East Timor|Crocodile": ["Komodo Dragon", "Sea Turtle", "Python"],
  "Ecuador|Galapagos Islands": ["Juan Fernández Islands", "Falkland Islands", "Canary Islands"],
  "Egypt|Khufu": ["Tutankhamun", "Ramesses II", "Khafre"],
  "Egypt|Rosetta Stone": ["Moabite Stone", "Narmer Palette", "Cyrus Cylinder"],
  "Egypt|Senet": ["Mancala", "Backgammon", "Royal Game of Ur"],
  "El Salvador|Pupusa": ["Arepa", "Tamale", "Gordita"],
  "Eritrea|Tour of Eritrea": ["Tour du Faso", "Tour of Rwanda", "Tour of Egypt"],
  "Estonia|Wife Carrying": ["Bog Snorkelling", "Cheese Rolling", "Toe Wrestling"],
  "Eswatini|Swaziland": ["Basutoland", "Bechuanaland", "Nyasaland"],
  "Eswatini|Reed Dance": ["Incwala", "Rain Dance", "Harvest Dance"],
  "Eswatini|Lion Cavern": ["Blombos Cave", "Border Cave", "Sterkfontein"],
  "Ethiopia|Coffee": ["Tea", "Cocoa", "Kombucha"],
  "Ethiopia|Lalibela": ["Aksum", "Gondar", "Harar"],
  "Fiji|Kava": ["Toddy", "Palm Wine", "Coconut Rum"],
  "Fiji|Viti Levu": ["Vanua Levu", "Taveuni", "Kadavu"],
  "Fiji|Fiji Water": ["Evian", "Voss", "Volvic"],
  "Finland|Lakes": ["Islands", "Fjords", "Glaciers"],
  "Finland|Saunas": ["Log cabins", "Hot tubs", "Ice holes"],
  "Finland|Air Guitar": ["Mobile Phone Throwing", "Wife Carrying", "Swamp Soccer"],
  "France|Cheese": ["Bread", "Wine", "Sausage"],
  "France|Louvre": ["Musée d'Orsay", "Centre Pompidou", "Rodin Museum"],
  "France|Deceased": ["Animals", "Fictional characters", "Themselves"],
  "Gabon|Mandrill": ["Gorilla", "Chimpanzee", "Baboon"],
  "Gabon|Elephants": ["Lions", "Rhinos", "Leopards"],
  "Gambia|Marbles": ["Pebbles", "Beans", "Coins"],
  "Gambia|Hippopotamus": ["Rhinoceros", "Manatee", "Crocodile"],
  "Georgia|Khachapuri": ["Khinkali", "Pide", "Lahmacun"],
  "Georgia|Wine": ["Beer", "Mead", "Cider"],
  "Germany|Oktoberfest": ["Carnival", "Fasching", "Rhine in Flames"],
  "Germany|Sausages": ["Meatballs", "Schnitzels", "Pretzels"],
  "Ghana|Kente cloth": ["Mudcloth", "Ankara print", "Kanga cloth"],
  "Ghana|Gold": ["Ivory", "Pepper", "Salt"],
  "Ghana|Airplanes": ["Pyramids", "Crowns", "Drums"],
  "Ghana|Kente Cloth": ["Mudcloth", "Ankara Print", "Kanga Cloth"],
  "Greece|Parthenon": ["Erechtheion", "Temple of Zeus", "Temple of Apollo"],
  "Greece|Naked": ["Armor", "Togas", "Blindfolded"],
  "Grenada|Spice Isle": ["Isle of Spice Trees", "Pepper Island", "Island of Flowers"],
  "Grenada|Nutmeg": ["Cinnamon", "Clove", "Vanilla"],
  "Grenada|Grenadines": ["Leeward Islands", "Virgin Islands", "Bahamas"],
  "Grenada|Underwater Sculpture Park": ["Coral Cathedral", "Sunken Garden", "Atlantis Reef"],
  "Guatemala|Star Wars": ["Indiana Jones", "Jurassic Park", "Avatar"],
  "Guinea|Bauxite": ["Uranium", "Copper", "Iron ore"],
  "Guinea|Nuts": ["Seeds", "Shells", "Bones"],
  "Guinea Bissau|Bijagos Archipelago": ["Cape Verde Islands", "Banc d'Arguin", "Los Islands"],
  "Guinea Bissau|Hippos": ["Elephants", "Buffalo", "Crocodiles"],
  "Guinea Bissau|Cashew": ["Peanut", "Almond", "Macadamia"],
  "Haiti|Soup Joumou": ["Callaloo", "Sancocho", "Pepper Pot"],
  "Honduras|Fish": ["Frogs", "Flowers", "Stones"],
  "Honduras|Scuba Diving": ["Surfing", "Kite-surfing", "Deep-sea fishing"],
  "Hungary|Pest": ["Buda", "Óbuda", "Margaret Island"],
  "Hungary|Paprika": ["Cumin", "Turmeric", "Saffron"],
  "Hungary|Rubik's Cube": ["Tangram", "Sudoku", "Jigsaw puzzle"],
  "Iceland|Cousins": ["Twins", "Ex-partners", "Neighbors"],
  "India|Bengal Tiger": ["Asian Elephant", "Indian Peacock", "Asiatic Lion"],
  "India|Chess": ["Go", "Backgammon", "Checkers"],
  "India|Cow": ["Elephant", "Goat", "Buffalo"],
  "Indonesia|Komodo dragon": ["Monitor lizard", "Marine iguana", "Gila monster"],
  "Indonesia|Bali": ["Lombok", "Java", "Sumatra"],
  "Indonesia|Durian": ["Jackfruit", "Mangosteen", "Rambutan"],
  "Indonesia|Komodo Dragon": ["Saltwater Crocodile", "Reticulated Python", "Water Monitor"],
  "Iran|Saffron": ["Cardamom", "Vanilla", "Sumac"],
  "Iraq|Hanging Gardens": ["Colossus", "Lighthouse of Alexandria", "Temple of Artemis"],
  "Ireland|British Isles": ["Scandinavia", "Iberia", "Brittany"],
  "Ireland|Shamrock": ["Rose", "Thistle", "Daffodil"],
  "Ireland|Snakes": ["Lizards", "Toads", "Wolves"],
  "Ireland|Guinness": ["Murphy's", "Beamish", "Kilkenny"],
  "Israel|Masada": ["Herodium", "Megiddo", "Petra"],
  "Italy|Boot": ["Sword", "Hook", "Glove"],
  "Italy|Red Wine": ["Beer", "Limoncello", "Grappa"],
  "Ivory Coast|Cocoa": ["Coffee", "Cotton", "Rubber"],
  "Ivory Coast|Abidjan": ["Yamoussoukro", "Bouaké", "San-Pédro"],
  "Ivory Coast|Basilica of Our Lady of Peace": ["Cathedral of St. Paul", "Notre-Dame d'Afrique", "Basilica of Uganda Martyrs"],
  "Jamaica|Reggae": ["Calypso", "Soca", "Salsa"],
  "Jamaica|Usain Bolt": ["Yohan Blake", "Asafa Powell", "Carl Lewis"],
  "Japan|Pets": ["Robots", "Vending machines", "Cars"],
  "Japan|Cats": ["Rabbits", "Deer", "Foxes"],
  "Jordan|Aqaba": ["Eilat", "Amman", "Irbid"],
  "Jordan|Wadi Rum": ["Wadi Mujib", "Dana Valley", "Wadi Musa"],
  "Jordan|Petra": ["Jerash", "Palmyra", "Baalbek"],
  "Jordan|Elevation": ["Temperature", "Salinity", "Depth"],
  "Kazakhstan|Apple": ["Pear", "Cherry", "Apricot"],
  "Kazakhstan|Kumis": ["Kefir", "Ayran", "Kvass"],
  "Kenya|Marathon": ["Sprinting", "High jump", "Triathlon"],
  "Kiribati|Millennium Island": ["Christmas Island", "Tarawa", "Fanning Island"],
  "Kiribati|Atolls": ["Fjords", "Volcanoes", "Sandbars"],
  "Kosovo|Dua Lipa": ["Rita Ora", "Bebe Rexha", "Ava Max"],
  "Kuwait|Oil": ["Gold", "Copper", "Uranium"],
  "Kuwait|Kuwait Towers": ["Burj Khalifa", "Liberation Tower", "Al Hamra Tower"],
  "Laos|Plain of Jars": ["Valley of Pots", "Stone Garden", "Field of Urns"],
  "Laos|Sticky Rice": ["Millet", "Quinoa", "Barley"],
  "Latvia|Amber": ["Jade", "Pearl", "Coral"],
  "Lebanon|Strength and eternity": ["Peace and unity", "Wealth and trade", "Faith and freedom"],
  "Lebanon|Byblos": ["Tyre", "Sidon", "Baalbek"],
  "Lebanon|Cedar Tree": ["Olive Tree", "Date Palm", "Oak Tree"],
  "Lesotho|Basotho Blanket": ["Kente Cloth", "Maasai Shuka", "Poncho"],
  "Liberia|James Monroe": ["Thomas Jefferson", "James Madison", "John Adams"],
  "Liberia|George Weah": ["Samuel Eto'o", "Didier Drogba", "Roger Milla"],
  "Libya|Leptis Magna": ["Carthage", "Cyrene", "Volubilis"],
  "Lithuania|Hill of Crosses": ["Hill of Angels", "Mount of Olives", "Hill of Bells"],
  "Lithuania|Saltibarsciai": ["Borscht", "Gazpacho", "Okroshka"],
  "Luxembourg|European Court of Justice": ["European Parliament", "European Central Bank", "International Court of Justice"],
  "Madagascar|Lemurs": ["Tarsiers", "Lorises", "Marmosets"],
  "Madagascar|Baobabs": ["Acacias", "Cypresses", "Palm Trees"],
  "Madagascar|Aye-aye": ["Tarsier", "Slow Loris", "Bushbaby"],
  "Malaysia|Kuala Lumpur": ["Singapore", "Jakarta", "Bangkok"],
  "Malaysia|Borneo": ["Sumatra", "Java", "Mindanao"],
  "Malaysia|Rafflesia": ["Titan Arum", "Lotus", "Pitcher Plant"],
  "Malaysia|Petronas Towers": ["Marina Bay Sands", "Taipei 101", "Merdeka 118"],
  "Maldives|Atolls": ["Fjords", "Lagoons", "Sandbanks"],
  "Maldives|Plankton": ["Jellyfish", "Algae blooms", "Glowing coral"],
  "Mali|Mansa Musa": ["Sundiata Keita", "Askia Muhammad", "Sunni Ali"],
  "Mali|Timbuktu": ["Djenné", "Gao", "Bamako"],
  "Malta|Megalithic Temples": ["Stone Circles", "Rock-cut Tombs", "Cave Churches"],
  "Malta|Maltese": ["Bichon Frise", "Pomeranian", "Shih Tzu"],
  "Malta|Popeye Village": ["Hook Village", "Mermaid Cove", "Sailor Town"],
  "Marshall Islands|Bikini Atoll": ["Enewetak Atoll", "Mururoa Atoll", "Kwajalein Atoll"],
  "Marshall Islands|Sticks": ["Bones", "Seaweed", "Feathers"],
  "Mauritania|Iron Ore Train": ["Desert Express", "Salt Caravan", "Sahara Rail"],
  "Mauritius|Dodo": ["Moa", "Great Auk", "Passenger Pigeon"],
  "Mexico|Avocado": ["Mango", "Papaya", "Banana"],
  "Mexico|Chichen Itza": ["Teotihuacan", "Tikal", "Palenque"],
  "Mexico|Tequila": ["Rum", "Pisco", "Cachaça"],
  "Mexico|Chocolate": ["Coffee", "Tea", "Beer"],
  "Mexico|Piñata": ["Papel picado", "Sombrero", "Maraca"],
  "Micronesia|Nan Madol": ["Leluh", "Ha'amonga", "Latte Stones"],
  "Micronesia|Rai Stones": ["Shell necklaces", "Carved canoes", "Whale teeth"],
  "Moldova|Milestii Mici": ["Cricova", "Purcari", "Château Mimi"],
  "Moldova|Aurochs": ["Bison", "Wild Boar", "Elk"],
  "Monaco|Formula One": ["MotoGP", "Rally Championship", "IndyCar"],
  "Monaco|Central Park": ["Disneyland", "Heathrow Airport", "Vatican City"],
  "Montenegro|Kotor": ["Budva", "Herceg Novi", "Ulcinj"],
  "Morocco|Goats": ["Sheep", "Monkeys", "Camels"],
  "Mozambique|Gorongosa National Park": ["Kruger National Park", "Niassa Reserve", "Quirimbas Park"],
  "Myanmar|Bagan": ["Angkor", "Ayutthaya", "Borobudur"],
  "Myanmar|Shwedagon Pagoda": ["Sule Pagoda", "Wat Arun", "Golden Rock"],
  "Myanmar|Thanaka": ["Henna", "Kohl", "Turmeric"],
  "Namibia|Skeleton Coast": ["Wild Coast", "Diamond Coast", "Ivory Coast"],
  "Namibia|Deadvlei": ["Etosha Pan", "Sossusvlei Lake", "Makgadikgadi"],
  "Nauru|Phosphate": ["Bauxite", "Nickel", "Gold"],
  "Nauru|Capital City": ["Airport", "Army", "Currency"],
  "Nepal|Rectangle": ["Triangle", "Square", "Circle"],
  "Netherlands|Tulips": ["Roses", "Orchids", "Daffodils"],
  "Netherlands|Bicycles": ["Cars", "Boats", "Scooters"],
  "New Zealand|Kiwi": ["Kakapo", "Emu", "Takahe"],
  "New Zealand|Lord of the Rings": ["Harry Potter", "The Chronicles of Narnia", "Game of Thrones"],
  "Nicaragua|Bull shark": ["Great white shark", "Barracuda", "Moray eel"],
  "Niger|Wodaabe": ["Tuareg", "Maasai", "Berbers"],
  "Niger|Tree of Ténéré": ["Tree of Life", "Arbol del Tule", "Major Oak"],
  "Nigeria|Nollywood": ["Bollywood", "Lollywood", "Kollywood"],
  "North Korea|Korea": ["Chosun", "Pyongyang", "Goryeo"],
  "North Korea|Juche": ["Songun", "Maoism", "Chollima"],
  "North Korea|Hairstyles": ["Shoe colors", "Car brands", "Eye colors"],
  "North Korea|Kim Il Sung": ["Kim Jong Il", "Kim Jong Un", "Mao Zedong"],
  "North Macedonia|Mother Teresa": ["Saint Clement", "Joan of Arc", "Saint Cyril"],
  "Norway|Olav": ["Haakon", "Harald", "Magnus"],
  "Norway|Die": ["Whistle", "Own a cat", "Wear shoes indoors"],
  "Oman|Oil": ["Gold", "Diamonds", "Copper"],
  "Oman|Frankincense": ["Myrrh", "Amber", "Sandalwood"],
  "Pakistan|Mohenjo-daro": ["Babylon", "Ur", "Persepolis"],
  "Pakistan|Footballs": ["Cricket bats", "Tennis balls", "Hockey sticks"],
  "Palau|Rock Islands": ["Phi Phi Islands", "Ha Long Islands", "Mushroom Isles"],
  "Palau|Sharks": ["Whales", "Sea Turtles", "Dolphins"],
  "Palau|Jellyfish": ["Seahorses", "Starfish", "Sea Snakes"],
  "Palau|Palau Pledge": ["Island Oath", "Ocean Promise", "Reef Covenant"],
  "Panama|Pacific and Atlantic": ["Pacific and Indian", "Atlantic and Arctic", "Caribbean and Mediterranean"],
  "Panama|Bridge of the Americas": ["Golden Gate Bridge", "Centennial Bridge", "Rainbow Bridge"],
  "Panama|Panama Canal": ["Suez Canal", "Nicaragua Canal", "Kiel Canal"],
  "Papua New Guinea|Birds of paradise": ["Hummingbirds", "Toucans", "Peacocks"],
  "Papua New Guinea|Birds of Paradise": ["Hummingbirds", "Toucans", "Peacocks"],
  "Paraguay|Tereré": ["Chicha", "Horchata", "Chimarrão"],
  "Peru|Potato": ["Tomato", "Corn", "Cassava"],
  "Peru|Nazca Lines": ["Atacama Giant", "Paracas Candelabra", "Chan Chan"],
  "Philippines|Jeepneys": ["Tuk-tuks", "Tricycles", "Chicken buses"],
  "Philippines|Tarsier": ["Slow Loris", "Bushbaby", "Mouse Lemur"],
  "Poland|Pierogi": ["Pelmeni", "Gnocchi", "Kopytka"],
  "Poland|Crooked Forest": ["Dancing Forest", "Hoia Forest", "Twisted Grove"],
  "Portugal|Belém Tower": ["Tower of Hercules", "Clérigos Tower", "Torre del Oro"],
  "Portugal|Port wine": ["Madeira", "Sherry", "Marsala"],
  "Portugal|Cork": ["Rubber", "Cinnamon", "Balsa"],
  "Portugal|Pastel de Nata": ["Crème Brûlée", "Churros", "Bola de Berlim"],
  "Qatar|Falcon": ["Eagle", "Hawk", "Owl"],
  "Qatar|The Pearl": ["Palm Jumeirah", "Lusail Island", "Amwaj Islands"],
  "Romania|Bran Castle": ["Peleș Castle", "Corvin Castle", "Poenari Castle"],
  "Romania|Palace of the Parliament": ["Royal Palace", "Palace of Culture", "People's Hall"],
  "Rwanda|Clean": ["Green", "Quiet", "Crowded"],
  "Saint Kitts and Nevis|Western Hemisphere": ["Northern Hemisphere", "Eastern Hemisphere", "Southern Hemisphere"],
  "Saint Kitts and Nevis|Brimstone Hill": ["Fort Charlotte", "Shirley Heights", "El Morro"],
  "Saint Kitts and Nevis|Green Vervet Monkeys": ["Capuchin Monkeys", "Macaques", "Howler Monkeys"],
  "Saint Lucia|The Pitons": ["The Twins", "The Sisters", "The Needles"],
  "Saint Lucia|Woman": ["Ship", "King", "River"],
  "Saint Lucia|Sulphur Springs": ["Blue Lagoon", "Emerald Pools", "Hot Sand Baths"],
  "Saint Vincent and the Grenadines|Pirates of the Caribbean": ["Treasure Island", "Captain Blood", "Hook"],
  "Saint Vincent and the Grenadines|Arches": ["Towers", "Bridges", "Churches"],
  "Saint Vincent and the Grenadines|Mustique": ["Bequia", "Canouan", "Union Island"],
  "Samoa|Robert Louis Stevenson": ["Herman Melville", "Jack London", "Mark Twain"],
  "Samoa|To Sua": ["Blue Lagoon", "Giant Clam Pool", "Papase'ea Pool"],
  "San Marino|Regent": ["Consul", "Doge", "Chancellor"],
  "Sao Tome and Principe|Cocoa": ["Coffee", "Vanilla", "Sugar"],
  "Sao Tome and Principe|Pico Cao Grande": ["Pico Duarte", "Mount Cameroon", "Pico de Teide"],
  "Sao Tome and Principe|Pico Cão Grande": ["Pico Duarte", "Mount Cameroon", "Pico do Fogo"],
  "Sao Tome and Principe|Chocolate Islands": ["Spice Islands", "Sugar Islands", "Coffee Coast"],
  "Saudi Arabia|Mecca": ["Medina", "Jerusalem", "Riyadh"],
  "Saudi Arabia|Rub' al Khali": ["Nafud Desert", "Dahna Desert", "Syrian Desert"],
  "Saudi Arabia|Hegra": ["Petra", "Palmyra", "Persepolis"],
  "Senegal|Laamb": ["Sumo", "Glima", "Dambe"],
  "Senegal|Algae": ["Pink Flamingos", "Iron Oxide", "Coral"],
  "Senegal|Gorée Island": ["Robben Island", "Bunce Island", "Zanzibar"],
  "Senegal|Baobabs": ["Acacias", "Kapok Trees", "Mangroves"],
  "Serbia|Nikola Tesla": ["Thomas Edison", "Michael Faraday", "Mihajlo Pupin"],
  "Serbia|Kalemegdan Fortress": ["Petrovaradin Fortress", "Smederevo Fortress", "Golubac Fortress"],
  "Serbia|Slivovitz": ["Rakija of Pears", "Ouzo", "Pálinka"],
  "Seychelles|Vallee de Mai": ["Aldabra Atoll", "Morne Seychellois", "Curieuse Island"],
  "Seychelles|Granite": ["Limestone", "Basalt", "Marble"],
  "Seychelles|Coco de Mer": ["Coconut Palm", "Date Palm", "Royal Palm"],
  "Seychelles|Giant Tortoises": ["Marine Iguanas", "Komodo Dragons", "Leatherback Turtles"],
  "Sierra Leone|Diamonds": ["Emeralds", "Rubies", "Sapphires"],
  "Singapore|Merlion": ["Garuda", "Naga", "Singa"],
  "Singapore|Chewing Gum": ["Candy floss", "Lollipops", "Toffee"],
  "Slovakia|Castles": ["Cathedrals", "Windmills", "Monasteries"],
  "Slovenia|Postojna Cave": ["Škocjan Caves", "Blue Grotto", "Eisriesenwelt"],
  "Slovenia|Olm": ["Axolotl", "Fire Salamander", "Hellbender"],
  "Solomon Islands|Guadalcanal": ["Iwo Jima", "Okinawa", "Midway"],
  "Solomon Islands|Melanesia": ["Polynesia", "Micronesia", "Australasia"],
  "Solomon Islands|John F. Kennedy": ["Richard Nixon", "Gerald Ford", "George H. W. Bush"],
  "Solomon Islands|Blond Hair": ["Green eyes", "Red hair", "Freckles"],
  "Somalia|Frankincense": ["Myrrh", "Sandalwood", "Amber"],
  "South Africa|Penguins": ["Puffins", "Flamingos", "Pelicans"],
  "South Korea|Hallyu": ["K-Wave Boom", "Seoul Style", "Hanbok Movement"],
  "South Korea|Jeju Island": ["Ulleungdo", "Geoje Island", "Tsushima"],
  "South Korea|Kimchi": ["Bibimbap", "Bulgogi", "Tteokbokki"],
  "South Korea|Gangnam Style": ["Dynamite", "Gentleman", "Baby Shark"],
  "Spain|Barcelona": ["Madrid", "Valencia", "Seville"],
  "Spain|Alhambra": ["Alcázar of Seville", "Mezquita of Córdoba", "El Escorial"],
  "Spain|Paella": ["Risotto", "Jambalaya", "Arroz con pollo"],
  "Spain|Tomatina": ["San Fermín", "Las Fallas", "Batalla del Vino"],
  "Sri Lanka|Cinnamon": ["Nutmeg", "Cardamom", "Black Pepper"],
  "Sri Lanka|Sigiriya": ["Dambulla", "Anuradhapura", "Polonnaruwa"],
  "Sri Lanka|Ceylon": ["Assam", "Darjeeling", "Earl Grey"],
  "Sudan|Khartoum": ["Omdurman", "Port Sudan", "Juba"],
  "Sudan|Meroë": ["Giza", "Thebes", "Aksum"],
  "Sudan|Nile": ["Niger", "Congo", "Zambezi"],
  "Suriname|Amazon Rainforest": ["Congo Rainforest", "Atlantic Forest", "Daintree Rainforest"],
  "Sweden|ABBA": ["Roxette", "Ace of Base", "The Cardigans"],
  "Sweden|Surströmming": ["Lutefisk", "Hákarl", "Gravlax"],
  "Sweden|IKEA": ["H&M", "JYSK", "Wayfair"],
  "Switzerland|Guinea Pig": ["Hamster", "Rabbit", "Parrot"],
  "Syria|Palmyra": ["Petra", "Baalbek", "Aleppo"],
  "Taiwan|Taipei 101": ["Petronas Towers", "Burj Khalifa", "Shanghai Tower"],
  "Taiwan|Bubble tea": ["Matcha latte", "Thai iced tea", "Chai"],
  "Taiwan|Bubble Tea": ["Matcha Latte", "Thai Iced Tea", "Chai"],
  "Taiwan|Garbage Trucks": ["Ice cream vans", "Buses", "Taxis"],
  "Tanzania|Zanzibar": ["Comoros", "Seychelles", "Lamu"],
  "Tanzania|Serengeti": ["Masai Mara", "Kruger", "Tarangire"],
  "Thailand|Rice": ["Wheat", "Corn", "Barley"],
  "Thailand|Songkran": ["Loy Krathong", "Tet", "Holi"],
  "Thailand|Monkeys": ["Elephants", "Tigers", "Buffalo"],
  "Togo|Akodessewa": ["Grand Marché", "Dantokpa Market", "Kejetia Market"],
  "Togo|Tata Somba": ["Kasbahs", "Rondavels", "Ksour"],
  "Tonga|Sovereignty": ["Language", "Monarchy", "Currency"],
  "Tonga|Captain Cook": ["Abel Tasman", "William Bligh", "Ferdinand Magellan"],
  "Tonga|Humpback Whales": ["Orcas", "Blue Whales", "Sperm Whales"],
  "Trinidad and Tobago|Steelpan": ["Marimba", "Bongo drum", "Cuatro"],
  "Trinidad and Tobago|Calypso": ["Reggae", "Merengue", "Zouk"],
  "Tunisia|Amphitheatre of El Jem": ["Colosseum of Carthage", "Theatre of Dougga", "Arena of Nîmes"],
  "Tunisia|Star Wars": ["Indiana Jones", "Dune", "Mad Max"],
  "Turkey|Europe and Asia": ["Asia and Africa", "Europe and Africa", "Europe and the Middle East"],
  "Turkey|Hagia Sophia": ["Blue Mosque", "Topkapı Palace", "Süleymaniye Mosque"],
  "Turkey|Tulips": ["Roses", "Lilies", "Orchids"],
  "Turkmenistan|White marble": ["Glass", "Gold leaf", "Sandstone"],
  "Turkmenistan|Darvaza Gas Crater": ["Yanar Dag", "Eternal Flame Falls", "Chimaera Flames"],
  "Uganda|Mountain gorilla": ["Bonobo", "Chimpanzee", "Orangutan"],
  "Uganda|Mountain Gorillas": ["Bonobos", "Chimpanzees", "Golden Monkeys"],
  "Ukraine|Love": ["Dreams", "Wishes", "Secrets"],
  "Ukraine|Chernobyl": ["Zaporizhzhia", "Rivne", "Khmelnytskyi"],
  "United Arab Emirates|Dubai": ["Abu Dhabi", "Sharjah", "Ajman"],
  "United Arab Emirates|Palm Jumeirah": ["The World Islands", "Yas Island", "Bluewaters Island"],
  "United Arab Emirates|Lamborghini": ["Tesla", "Land Cruiser", "Camel"],
  "United Kingdom|London": ["Manchester", "Edinburgh", "Liverpool"],
  "United Kingdom|Stonehenge": ["Avebury", "Callanish Stones", "Castlerigg"],
  "United Kingdom|Big Ben": ["Great Tom", "Big Tom", "Great Paul"],
  "United Kingdom|Unicorn": ["Lion", "Stag", "Red Dragon"],
  "United States|Grand Canyon": ["Bryce Canyon", "Antelope Canyon", "Zion Canyon"],
  "United States|Yellowstone": ["Yosemite", "Glacier", "Grand Teton"],
  "Uruguay|Mate": ["Tereré", "Coffee", "Chai"],
  "Uruguay|Cannabis": ["Psilocybin", "Coca leaf", "Kava"],
  "Uzbekistan|Samarkand": ["Tashkent", "Khiva", "Nukus"],
  "Vanuatu|Land Diving": ["Fire Walking", "Cliff Diving", "Pole Climbing"],
  "Vanuatu|Post Office": ["Bank", "Restaurant", "Hotel"],
  "Vatican|The Pope": ["The Cardinal Secretary", "The Archbishop of Rome", "The Swiss Guard Captain"],
  "Vatican|Sistine Chapel": ["Pauline Chapel", "Chapel of Nicholas V", "St. Peter's Basilica"],
  "Vatican|Population": ["Coastline", "Altitude", "Budget"],
  "Vatican|White Smoke": ["Black Smoke", "Red Smoke", "Gold Smoke"],
  "Vatican|Swiss Guard": ["Papal Gendarmerie", "Knights of Malta", "Noble Guard"],
  "Venezuela|Oil": ["Gold", "Coal", "Lithium"],
  "Vietnam|Ho Chi Minh City": ["Hanoi", "Da Nang", "Hai Phong"],
  "Vietnam|Pho": ["Bún chả", "Ramen", "Laksa"],
  "Vietnam|Egg Coffee": ["Coconut Coffee", "Salt Coffee", "Cà phê sữa đá"],
  "Yemen|Mocha": ["Aden", "Java", "Sana'a"],
  "Yemen|Dragon Blood Tree": ["Baobab Tree", "Frankincense Tree", "Quiver Tree"],
  "Yemen|Shibam": ["Sana'a", "Zabid", "Marib"],
  "Zambia|Copper": ["Tin", "Silver", "Lithium"],
  "Zimbabwe|Great Zimbabwe": ["Mapungubwe", "Khami Ruins", "Thulamela"],
  "Afghanistan|Hindu Kush": ["Pamir Mountains", "Karakoram", "Zagros Mountains"],
  "Andorra|Pyrenees": ["Alps", "Apennines", "Cantabrian Mountains"],
  "Andorra|Chamois": ["Ibex", "Mouflon", "Markhor"],
  "Argentina|Aconcagua": ["Ojos del Salado", "Chimborazo", "Huascarán"],
  "Austria|Alps": ["Carpathians", "Dolomites", "Pyrenees"],
  "Azerbaijan|Mud Volcanoes": ["Geysers", "Hot Springs", "Salt Domes"],
  "Bhutan|Himalayas": ["Karakoram", "Hindu Kush", "Kunlun Mountains"],
  "Cameroon|Central Africa": ["West Africa", "East Africa", "North Africa"],
  "Cameroon|Miniature": ["Bloom", "Motion", "Colour"],
  "Dominican Republic|Larimar": ["Turquoise", "Aquamarine", "Lapis Lazuli"],
  "Ecuador|Cotopaxi": ["Chimborazo", "Tungurahua", "Villarrica"],
  "El Salvador|Volcanoes": ["Lakes", "Waterfalls", "Canyons"],
  "France|Mont Blanc": ["Matterhorn", "Mont Ventoux", "Monte Rosa"],
  "Germany|Black Forest": ["Bavarian Forest", "Harz", "Thuringian Forest"],
  "Guinea|Fouta Djallon": ["Aïr Mountains", "Adamawa Plateau", "Jos Plateau"],
  "Haiti|Citadelle Laferrière": ["Sans-Souci Palace", "Fort Jacques", "El Morro"],
  "Kyrgyzstan|Issyk-Kul": ["Lake Balkhash", "Song-Kul", "Lake Baikal"],
  "Lesotho|Sky": ["Mountains", "Clouds", "Eagles"],
  "Lesotho|Skiing": ["Ice skating", "Snowboarding only", "Curling"],
  "Liechtenstein|Alps": ["Carpathians", "Dolomites", "Jura Mountains"],
  "Montenegro|Black Mountain": ["Green Mountain", "White Mountain", "Red Mountain"],
  "Morocco|Chefchaouen": ["Essaouira", "Fes", "Ifrane"],
  "Nepal|Gurkhas": ["Sherpas", "Sikhs", "Rajputs"],
  "Nepal|Yeti": ["Bigfoot", "Chupacabra", "Wendigo"],
  "Netherlands|House of Orange": ["House of Bourbon", "House of Habsburg", "House of Tudor"],
  "New Zealand|Milford Sound": ["Doubtful Sound", "Abel Tasman", "Lake Wakatipu"],
  "Nicaragua|Volcano Boarding": ["Sandboarding", "Lava Surfing", "Ash Skiing"],
  "Pakistan|Markhor": ["Ibex", "Snow Leopard", "Chamois"],
  "Rwanda|Dian Fossey": ["Jane Goodall", "Biruté Galdikas", "Diane Fossett"],
  "Saint Lucia|Volcano": ["Waterfall", "Hot Spring", "Crater Lake"],
  "Saint Vincent and the Grenadines|La Soufriere": ["Mount Pelée", "Soufrière Hills", "Mount Liamuiga"],
  "Samoa|To Sua Ocean Trench": ["Blue Lagoon", "Giant Clam Pool", "Papase'ea Pool"],
  "Senegal|The Gambia": ["Guinea-Bissau", "Mauritania", "Cape Verde"],
  "Singapore|Marina Bay Sands": ["Raffles Hotel", "Resorts World Sentosa", "Gardens by the Bay"],
  "Slovakia|High Tatras": ["Low Tatras", "Julian Alps", "Sudetes"],
  "Slovenia|Triglav": ["Grossglockner", "Zugspitze", "Mont Blanc"],
  "South Africa|Table Mountain": ["Lion's Head", "Drakensberg", "Signal Hill"],
  "Switzerland|Matterhorn": ["Eiger", "Jungfrau", "Mont Blanc"],
  "Tajikistan|Pamir Highway": ["Karakoram Highway", "Silk Road Highway", "Tian Shan Highway"],
  "Tajikistan|Mountains": ["Deserts", "Forests", "Grasslands"],
  "Burkina Faso|Land of Incorruptible People": ["Land of Gold", "Land of Rivers", "Land of the Brave"],
  "Cameroon|French and English": ["French and German", "English and Portuguese", "French and Spanish"],
  "Papua New Guinea|Diverse": ["Isolated", "Crowded", "Mountainous"],
  "Paraguay|Guaraní": ["Quechua", "Aymara", "Nahuatl"],
  "Pakistan|Karachi": ["Lahore", "Faisalabad", "Gwadar"],
  "Palestine|Ramallah": ["Nablus", "Hebron", "Jericho"],
  "Palestine|Dead Sea": ["Sea of Galilee", "Red Sea", "Lake Assal"],
  "Palestine|Intangible Cultural Heritage": ["World Heritage Sites", "Memory of the World", "Creative Cities Network"],
  "Palestine|Olive Tree": ["Date Palm", "Fig Tree", "Pomegranate Tree"],
  "Palestine|Dabke": ["Hora", "Sirtaki", "Zeybek"],
  "Palestine|Knafeh": ["Baklava", "Basbousa", "Qatayef"],
  "Suriname|Dutch": ["German", "Danish", "Swedish"],
};

// ============================================================
// Multiple-choice options: the answer plus three wrong ones.
// Hand-written options win; otherwise wrong answers come from the
// same kind of answer elsewhere in the trivia (capitals from nearby
// countries, currencies from other countries, numbers close by…).
// ============================================================
const _countryByName = new Map(COUNTRIES.map(c => [c.name, c]));

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'Oceania', 'South America', 'North America', 'Caribbean', 'Central America'];
const COLOURS    = ['Red', 'Blue', 'Green', 'White', 'Black', 'Yellow', 'Orange', 'Gold'];

const _Q = re => q => re.test(q.q);
const _A = re => q => re.test(q.a);

// First match wins — order matters
const TRIVIA_KINDS = [
  ['yesno',     _A(/^(true|false|yes|no)$/i)],
  ['number',    q => /^\d/.test(q.a) && (/^[\d.,]+\s*(%|km|m|s|th|st|nd|rd)?\b/i.test(q.a) || /how many|percentage|century|what year|decade|ratio/i.test(q.q))],
  ['country',   q => _countryByName.has(q.a)],
  ['capital',   _Q(/capital/i)],
  ['currency',  _Q(/currency/i)],
  ['language',  _Q(/\b(official|national|main|primary|sole) language|language (is )?(officially |widely )?spoken|(which|what) language/i)],
  ['continent', q => CONTINENTS.some(c => c.toLowerCase() === q.a.toLowerCase())],
  ['colour',    q => /colou?r/i.test(q.q) && COLOURS.some(c => c.toLowerCase() === q.a.toLowerCase())],
  // Water and mountains: only when the answer itself is named that way
  // ("Lake Chad", "Atlantic Ocean", "Atlas Mountains", "Mount Kenya")
  ['water',     _A(/^(sea|ocean|gulf|bay|lake|river|strait)\b|\b(sea|ocean|gulf|bay|lake|river|strait|channel|falls|delta|lagoon)$/i)],
  ['mountain',  _A(/^(mount|mt\.?|pico|monte)\s|\s(mountains|range|massif|highlands|peak|volcano)$/i)],
  ['desert',    _A(/desert/i)],
  ['person',    _Q(/\bwho\b|\bhero\b|composer|singer|\bstar\b|explorer|painter|writer|author|leader|president|king|queen|footballer|athlete|scientist|poet|artist|musician|founder|dictator|emperor|saint\b|born in|revolutionary/i)],
  ['animal',    _Q(/animal|bird|fish|species|mammal|creature|predator|primate|reptile|insect|lizard|\bbeast\b|turtle|tortoise|crocodile|monkey|\bape\b|antelope|\bcat\b|\bdog\b|whale|shark|snake|parrot|eagle|horse|lemur|deer|\bbear\b/i)],
  ['plant',     _Q(/tree|flower|plant|crop|spice|fruit|\bnut\b|bean|seed|palm/i)],
  ['food',      _Q(/dish|food|bread|dessert|pastry|spread|drink|coffee|\btea\b|snack|cheese|sauce|soup|beverage|liquor|spirit|beer|wine|meal|cuisine|delicacy|stew|dumpling|flatbread|sweet|rum|cocktail/i)],
  ['sport',     _Q(/sport|game|martial art|wrestling|race|tournament/i)],
  ['music',     _Q(/dance|music|instrument|genre|song|festival|celebration|drum/i)],
  ['city',      _Q(/city|town|port\b|settlement|village/i)],
  ['landmark',  _Q(/monument|temple|statue|bridge|tower|landmark|monolith|palace|mosque|church|cathedral|castle|ruins|fortress|pyramid|tomb|monastery|\bwall\b|canal|\bsite\b|\bpark\b|reef|cave|\bhole\b|forest|island|beach|valley|glacier|waterfall|geyser|\bplain|salt flat|basin|peninsula|archipelago/i)],
  ['material',  _Q(/gem|stone|mineral|metal|resource|export|ore|oil|gas|diamond|gold|copper|textile|fabric|product/i)],
];

const STOP_WORDS = new Set(['the', 'and', 'of', 'de', 'la', 'del', 'by']);

// "Pico Cão Grande" and "Pico Cao Grande" count as the same option
const _norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Kinds whose wrong answers are generated; everything else is hand-written
const AUTO_KINDS = new Set(['yesno', 'number', 'country', 'capital', 'currency', 'language', 'continent', 'colour', 'water', 'mountain', 'desert']);

function triviaKind(q) {
  const k = TRIVIA_KINDS.find(([, test]) => test(q));
  return k ? k[0] : null;
}

// Built on first use: kind → [{ country, answer }], and country → capital
let _pools = null;
function triviaPools() {
  if (_pools) return _pools;
  _pools = { byKind: {}, capitals: new Map(), ownAnswers: new Map() };
  for (const [country, list] of Object.entries(TRIVIA)) {
    _pools.ownAnswers.set(country, new Set(list.map(q => q.a.toLowerCase())));
    for (const q of list) {
      const kind = triviaKind(q);
      if (!kind) continue;
      (_pools.byKind[kind] ||= []).push({ country, answer: q.a });
      if (kind === 'capital' && /^what is the capital of/i.test(q.q)) _pools.capitals.set(country, q.a);
    }
  }
  return _pools;
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Countries nearest to `name`, closest first
function _nearestCountries(name) {
  const from = _countryByName.get(name);
  if (!from) return _shuffle(COUNTRIES.map(c => c.name));
  return COUNTRIES
    .filter(c => c.name !== name)
    .map(c => [c.name, (c.lat - from.lat) ** 2 + ((c.lon - from.lon) * Math.cos(from.lat * Math.PI / 180)) ** 2])
    .sort((a, b) => a[1] - b[1])
    .map(([n]) => n);
}

function _ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Nearby but clearly different numbers, keeping the answer's format
function _numberOptions(answer) {
  const m = answer.match(/^(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return [];
  const n    = parseFloat(m[1].replace(/,/g, ''));
  const rest = m[2];
  const fmt  = x => (m[1].includes(',') ? x.toLocaleString('en-US') : String(x)) + rest;

  let cands;
  if (/^(st|nd|rd|th)\b/i.test(rest)) {                       // 4th century
    const tail = rest.replace(/^(st|nd|rd|th)/i, '');
    return _shuffle([-3, -2, -1, 1, 2, 3].map(d => n + d).filter(x => x > 0)).slice(0, 3).map(x => _ordinal(x) + tail);
  } else if (/^s\b/.test(rest)) {                              // 2000s
    cands = [-30, -20, -10, 10, 20].map(d => n + d);
  } else if (rest.trim().startsWith('%')) {
    cands = [-30, -20, -10, 10, 20, 30].map(d => n + d).filter(x => x > 0 && x < 100);
  } else if (n >= 1000 && n <= 2100 && !rest.trim()) {         // a year
    cands = [-50, -25, -10, 10, 25].map(d => n + d).filter(x => x <= new Date().getFullYear());
  } else if (n <= 12 && Number.isInteger(n)) {
    cands = [-3, -2, -1, 1, 2, 3, 4].map(d => n + d).filter(x => x >= 0);
  } else {
    const round2 = x => { const p = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };
    cands = [0.25, 0.5, 2, 4, 10].map(f => round2(n * f)).filter(x => x > 0);
  }
  return _shuffle([...new Set(cands)].filter(x => x !== n)).slice(0, 3).map(fmt);
}

// Candidates for one question, best first
function _wrongCandidates(q, country, kind) {
  const pools = triviaPools();
  switch (kind) {
    case 'yesno':     return [];
    case 'number':    return _numberOptions(q.a);
    case 'continent': return _shuffle(CONTINENTS.slice());
    case 'colour':    return _shuffle(COLOURS.slice());
    case 'country':   return _nearestCountries(q.a).filter(n => n !== country).slice(0, 8);
    case 'capital':   return _nearestCountries(country).map(n => pools.capitals.get(n)).filter(Boolean).slice(0, 8);
  }
  if (!AUTO_KINDS.has(kind)) return [];
  // Same kind of answer from other countries. Ones sharing a word with the
  // answer ("Lake …", "… Mountains", "… Franc") read most plausibly.
  const own    = pools.ownAnswers.get(country) || new Set();
  const words  = a => a.toLowerCase().split(/[\s,]+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  const shared = new Set(words(q.a));
  const others = _shuffle((pools.byKind[kind] || [])
    .filter(e => e.country !== country && !own.has(e.answer.toLowerCase()))
    .filter(e => /,| and /.test(e.answer) === /,| and /.test(q.a)) // "French and Dutch" only among combos
    .map(e => e.answer));
  return [...others.filter(a => words(a).some(w => shared.has(w))), ...others];
}

// → shuffled array of option strings, answer included
function buildChoices(q, country = null) {
  const kind = triviaKind(q);
  if (kind === 'yesno') {
    return /^(true|false)$/i.test(q.a) ? ['True', 'False'] : ['Yes', 'No'];
  }

  const wrong = [];
  const seen  = new Set([_norm(q.a)]);
  const add   = list => {
    for (const a of list) {
      if (wrong.length === 3) return;
      if (a && !seen.has(_norm(a))) { seen.add(_norm(a)); wrong.push(a); }
    }
  };

  add(TRIVIA_WRONG[q.q] || TRIVIA_WRONG_BY_ANSWER[`${country}|${q.a}`] || []);
  if (wrong.length < 3) {
    const cands = _wrongCandidates(q, country, kind);
    // Nearby countries/capitals: pick at random among the closest few
    add(kind === 'country' || kind === 'capital' ? _shuffle(cands.slice(0, 6)) : cands);
  }
  if (wrong.length < 3) {
    const pools = triviaPools();
    add(_shuffle(Object.values(pools.byKind).flat().map(e => e.answer)));
  }
  return _shuffle([q.a, ...wrong]);
}
