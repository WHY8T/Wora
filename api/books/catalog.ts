import type { BookSummary } from "@contracts/types";

/**
 * Curated local catalog of popular books.
 * Guarantees the app always has a rich, searchable base of well-known titles,
 * even when external book APIs are unreachable. Covers load client-side from
 * Open Library by ISBN; the UI falls back to a generated cover on error.
 */
type Seed = [
  slug: string,
  title: string,
  authors: string[],
  isbn: string,
  categories: string[],
  year: string,
  pages: number,
  rating: number,
  ratingsK: number, // thousands
  trending: number,
  blurb: string,
];

const S = (
  slug: Seed[0],
  title: Seed[1],
  authors: Seed[2],
  isbn: Seed[3],
  categories: Seed[4],
  year: Seed[5],
  pages: Seed[6],
  rating: Seed[7],
  ratingsK: Seed[8],
  trending: Seed[9],
  blurb: Seed[10],
): BookSummary => ({
  externalId: `local:${slug}`,
  source: "local",
  title,
  authors,
  cover: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
  description: blurb,
  categories,
  pageCount: pages,
  publishedDate: year,
  isbn,
  externalRating: rating,
  externalRatingsCount: ratingsK * 1000,
  trendingScore: trending,
  readUrl: null,
});

export const CATALOG: BookSummary[] = [
  S("dune", "Dune", ["Frank Herbert"], "9780441172719", ["Sci-Fi", "Classics"], "1965", 412, 4.3, 1400, 98,
    "Set on the desert planet Arrakis, Dune is the story of Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the spice melange. A stunning blend of adventure, mysticism, and politics."),
  S("project-hail-mary", "Project Hail Mary", ["Andy Weir"], "9780593135204", ["Sci-Fi", "Thriller"], "2021", 476, 4.5, 900, 96,
    "Ryland Grace wakes up on a spaceship with no memory of who he is or why he's there. The fate of humanity rests on his solving an impossible scientific mystery — alone, light-years from home. Or so he thinks."),
  S("fourth-wing", "Fourth Wing", ["Rebecca Yarros"], "9781649374042", ["Fantasy", "Romance"], "2023", 498, 4.4, 1100, 97,
    "Twenty-year-old Violet Sorrengail was supposed to enter the Scribe Quadrant, living a quiet life among books. Instead, she's thrust into the brutal war college of Basgiath, where cadets bond dragons or die trying."),
  S("the-hobbit", "The Hobbit", ["J.R.R. Tolkien"], "9780547928227", ["Fantasy", "Classics"], "1937", 310, 4.3, 3900, 90,
    "Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life — until the wizard Gandalf and thirteen dwarves whisk him away on a quest to reclaim treasure from the dragon Smaug."),
  S("name-of-the-wind", "The Name of the Wind", ["Patrick Rothfuss"], "9780756404741", ["Fantasy"], "2007", 662, 4.5, 950, 88,
    "Told in Kvothe's own voice, this is the tale of the magically gifted young man who grows to be the most notorious wizard his world has ever seen."),
  S("a-game-of-thrones", "A Game of Thrones", ["George R.R. Martin"], "9780553593716", ["Fantasy"], "1996", 694, 4.4, 2200, 85,
    "In a land where summers span decades and winters can last a lifetime, noble families wage a deadly game for control of the Iron Throne."),
  S("mistborn", "Mistborn: The Final Empire", ["Brandon Sanderson"], "9780765311788", ["Fantasy"], "2006", 541, 4.5, 700, 84,
    "For a thousand years the ash has fallen and no flowers have bloomed. A half-skaa thief discovers she has the powers of a Mistborn — and joins a crew plotting to overthrow the Lord Ruler."),
  S("the-way-of-kings", "The Way of Kings", ["Brandon Sanderson"], "9780765365279", ["Fantasy"], "2010", 1007, 4.6, 550, 83,
    "On the storm-swept world of Roshar, an enslaved bridgeman, a reluctant scholar, and a war-weary highprince are drawn toward an ancient, world-shaking secret."),
  S("babel", "Babel", ["R.F. Kuang"], "9780063021426", ["Fantasy", "Historical Fiction"], "2022", 545, 4.2, 400, 82,
    "Oxford, 1836. Robin Swift studies the art of silver-working translation magic at Babel — and must reckon with the empire that magic serves. A sweeping critique of colonialism wrapped in dark academia."),
  S("the-poppy-war", "The Poppy War", ["R.F. Kuang"], "9780062662569", ["Fantasy"], "2018", 544, 4.1, 300, 78,
    "Orphan Rin aces the empire's hardest exam and earns a place at its elite military academy — where she discovers a shamanic power with terrible costs."),
  S("1984", "1984", ["George Orwell"], "9780451524935", ["Classics", "Sci-Fi", "Fiction"], "1949", 328, 4.2, 4600, 87,
    "Winston Smith works at the Ministry of Truth, rewriting history for the Party. In a world of perpetual war, omnipresent surveillance, and thought control, he dares to fall in love."),
  S("brave-new-world", "Brave New World", ["Aldous Huxley"], "9780060850524", ["Classics", "Sci-Fi"], "1932", 288, 4.0, 1800, 74,
    "Huxley's vision of a future engineered for stability — genetically bred citizens, happiness on demand, and no freedom worth the name."),
  S("fahrenheit-451", "Fahrenheit 451", ["Ray Bradbury"], "9781451673319", ["Classics", "Sci-Fi"], "1953", 249, 4.0, 2100, 76,
    "Guy Montag is a fireman whose job is to burn books — until a free-spirited neighbor makes him question everything."),
  S("the-great-gatsby", "The Great Gatsby", ["F. Scott Fitzgerald"], "9780743273565", ["Classics", "Fiction"], "1925", 180, 3.9, 5000, 80,
    "Jay Gatsby's lavish Long Island parties mask a single obsessive dream: to win back Daisy Buchanan. A portrait of the Jazz Age and the American Dream's glittering hollow core."),
  S("to-kill-a-mockingbird", "To Kill a Mockingbird", ["Harper Lee"], "9780061120084", ["Classics", "Fiction"], "1960", 324, 4.3, 5600, 79,
    "Through the eyes of Scout Finch, a story of conscience and courage in a small Alabama town, as her father Atticus defends a Black man falsely accused of a crime."),
  S("pride-and-prejudice", "Pride and Prejudice", ["Jane Austen"], "9780141439518", ["Classics", "Romance"], "1813", 432, 4.3, 3900, 77,
    "Elizabeth Bennet spars with the proud Mr. Darcy in Austen's sparkling comedy of manners, misunderstanding, and slow-burn love."),
  S("the-catcher-in-the-rye", "The Catcher in the Rye", ["J.D. Salinger"], "9780316769488", ["Classics", "Fiction"], "1951", 277, 3.8, 3300, 70,
    "Holden Caulfield wanders New York City after being expelled from prep school, railing against phoniness in one of literature's most iconic voices."),
  S("the-alchemist", "The Alchemist", ["Paulo Coelho"], "9780062315007", ["Fiction", "Classics"], "1988", 208, 3.9, 2700, 72,
    "Santiago, an Andalusian shepherd boy, journeys to the Egyptian pyramids in search of treasure — and discovers his Personal Legend."),
  S("the-kite-runner", "The Kite Runner", ["Khaled Hosseini"], "9781594631931", ["Fiction", "Historical Fiction"], "2003", 371, 4.3, 2600, 71,
    "Amir and Hassan grow up together in Kabul, until betrayal tears them apart. A sweeping story of friendship, guilt, and redemption across decades of Afghan history."),
  S("the-book-thief", "The Book Thief", ["Markus Zusak"], "9780375842207", ["Historical Fiction", "Young Adult"], "2005", 584, 4.4, 2400, 75,
    "Narrated by Death: Liesel Meminger steals books in Nazi Germany and shares them with neighbors and the Jewish man hidden in her basement."),
  S("all-the-light-we-cannot-see", "All the Light We Cannot See", ["Anthony Doerr"], "9781501173219", ["Historical Fiction"], "2014", 531, 4.3, 1500, 73,
    "A blind French girl and a German boy's paths collide in occupied Saint-Malo. Pulitzer Prize winner about war, radio waves, and the light we cannot see."),
  S("circe", "Circe", ["Madeline Miller"], "9780316556347", ["Fantasy", "Historical Fiction"], "2018", 393, 4.3, 1100, 81,
    "The witch of Aiaia tells her own story at last — exile, monsters, gods, and a woman's hard-won power in a world ruled by immortals."),
  S("the-song-of-achilles", "The Song of Achilles", ["Madeline Miller"], "9780062060624", ["Historical Fiction", "Romance"], "2011", 378, 4.4, 1000, 80,
    "Patroclus, exiled prince, and Achilles, the Greeks' greatest hero — a devastating retelling of the Iliad as a love story."),
  S("the-night-circus", "The Night Circus", ["Erin Morgenstern"], "9780307744432", ["Fantasy", "Romance"], "2011", 387, 4.0, 900, 74,
    "Le Cirque des Rêves arrives without warning, open only at night. Within its striped tents, two young magicians duel in a competition only one can survive."),
  S("piranesi", "Piranesi", ["Susanna Clarke"], "9781635575637", ["Fantasy", "Mystery"], "2020", 245, 4.2, 350, 72,
    "Piranesi lives in the House — an infinite labyrinth of halls and statues, with an ocean trapped inside. He knows no other world. Then messages begin to appear."),
  S("normal-people", "Normal People", ["Sally Rooney"], "9781984822178", ["Fiction", "Romance"], "2018", 273, 3.9, 800, 68,
    "Connell and Marianne circle each other from small-town Ireland to Trinity College in a story of class, intimacy, and miscommunication."),
  S("the-midnight-library", "The Midnight Library", ["Matt Haig"], "9780525559474", ["Fiction", "Sci-Fi"], "2020", 288, 4.0, 1300, 74,
    "Between life and death there is a library. Each book lets Nora Seed live a different version of her life — and find out what truly makes one worth living."),
  S("klara-and-the-sun", "Klara and the Sun", ["Kazuo Ishiguro"], "9780593318171", ["Sci-Fi", "Fiction"], "2021", 303, 3.8, 400, 66,
    "Klara is an Artificial Friend, waiting in a store for a child to choose her. A haunting meditation on love, loyalty, and what makes us human."),
  S("the-martian", "The Martian", ["Andy Weir"], "9780553418026", ["Sci-Fi"], "2011", 369, 4.4, 1200, 76,
    "Astronaut Mark Watney is stranded on Mars, presumed dead. His only hope: science the hell out of this."),
  S("enders-game", "Ender's Game", ["Orson Scott Card"], "9780812550702", ["Sci-Fi", "Young Adult"], "1985", 324, 4.3, 1500, 73,
    "Child prodigy Ender Wiggin is trained in orbital Battle School to command humanity's fleet against an alien threat. The enemy's gate is down."),
  S("foundation", "Foundation", ["Isaac Asimov"], "9780553293357", ["Sci-Fi", "Classics"], "1951", 255, 4.2, 800, 70,
    "Hari Seldon's psychohistory predicts the Empire's fall. His Foundation is humanity's one chance to shorten the coming dark age."),
  S("hitchhikers-guide", "The Hitchhiker's Guide to the Galaxy", ["Douglas Adams"], "9780345391803", ["Sci-Fi", "Classics"], "1979", 216, 4.2, 1800, 71,
    "Seconds before Earth is demolished for a hyperspace bypass, Arthur Dent hitches a ride on a passing spaceship. Don't Panic."),
  S("neuromancer", "Neuromancer", ["William Gibson"], "9780441569595", ["Sci-Fi", "Classics"], "1984", 271, 3.9, 500, 65,
    "Case, a washed-up console cowboy, is hired for one last job in cyberspace. The novel that defined cyberpunk."),
  S("the-handmaids-tale", "The Handmaid's Tale", ["Margaret Atwood"], "9780385490818", ["Fiction", "Sci-Fi", "Classics"], "1985", 311, 4.1, 1800, 69,
    "In the Republic of Gilead, Offred is a Handmaid, valued only for her fertility. Her resistance is memory, story, and small acts of defiance."),
  S("gone-girl", "Gone Girl", ["Gillian Flynn"], "9780307588371", ["Thriller", "Mystery"], "2012", 415, 4.1, 2500, 72,
    "On their fifth anniversary, Amy Dunne disappears. Her husband Nick becomes the prime suspect. Nothing in this marriage is what it seems."),
  S("the-girl-with-the-dragon-tattoo", "The Girl with the Dragon Tattoo", ["Stieg Larsson"], "9780307454546", ["Mystery", "Thriller"], "2005", 465, 4.2, 1400, 66,
    "Journalist Mikael Blomkvist and hacker Lisbeth Salander dig into a wealthy family's forty-year-old disappearance — and its rotten core."),
  S("the-silent-patient", "The Silent Patient", ["Alex Michaelides"], "9781250301697", ["Thriller", "Mystery"], "2019", 325, 4.1, 1100, 70,
    "Alicia Berenson shot her husband and never spoke again. Psychotherapist Theo Faber is determined to make her talk — and uncover why."),
  S("big-little-lies", "Big Little Lies", ["Liane Moriarty"], "9780425274866", ["Fiction", "Mystery"], "2014", 460, 4.1, 900, 63,
    "Three mothers, one school trivia night, one death. A sharp, darkly funny unraveling of the little lies we tell to survive."),
  S("where-the-crawdads-sing", "Where the Crawdads Sing", ["Delia Owens"], "9780735219090", ["Fiction", "Mystery"], "2018", 384, 4.4, 1600, 71,
    "Kya Clark, the Marsh Girl of North Carolina's coast, raises herself in the wild — until a local golden boy turns up dead and suspicion falls on her."),
  S("mexican-gothic", "Mexican Gothic", ["Silvia Moreno-Garcia"], "9780525620785", ["Horror", "Mystery"], "2020", 301, 3.9, 400, 64,
    "Noemí Taboada travels to a remote mansion in 1950s Mexico to check on her cousin — and finds High Place has secrets that seep into dreams."),
  S("the-shining", "The Shining", ["Stephen King"], "9780307743657", ["Horror"], "1977", 447, 4.3, 1600, 68,
    "Jack Torrance takes a winter caretaker job at the Overlook Hotel with his wife and psychic son. The hotel has plans of its own."),
  S("acotar", "A Court of Thorns and Roses", ["Sarah J. Maas"], "9781619634442", ["Fantasy", "Romance", "Young Adult"], "2015", 419, 4.2, 1300, 83,
    "Huntress Feyre kills a faerie wolf and is dragged to the magical lands of Prythian, where her captor is not what he seems."),
  S("the-hunger-games", "The Hunger Games", ["Suzanne Collins"], "9780439023481", ["Young Adult", "Sci-Fi"], "2008", 374, 4.3, 3900, 75,
    "Katniss Everdeen volunteers to take her sister's place in a televised fight to the death staged by the Capitol. May the odds be ever in your favor."),
  S("the-fault-in-our-stars", "The Fault in Our Stars", ["John Green"], "9780525478812", ["Young Adult", "Romance"], "2012", 313, 4.2, 3500, 67,
    "Hazel and Augustus meet at a cancer support group and fall in love while chasing an author's unfinished story in Amsterdam."),
  S("six-of-crows", "Six of Crows", ["Leigh Bardugo"], "9781250076960", ["Young Adult", "Fantasy"], "2015", 465, 4.5, 800, 76,
    "Kaz Brekker assembles six outcasts for an impossible heist: break into the impenetrable Ice Court and come out alive — and rich."),
  S("seven-husbands", "The Seven Husbands of Evelyn Hugo", ["Taylor Jenkins Reid"], "9781501161933", ["Fiction", "Romance"], "2017", 400, 4.5, 1400, 82,
    "Reclusive Hollywood icon Evelyn Hugo finally tells her life story — all seven husbands and the one great love — to an unknown journalist with questions of her own."),
  S("daisy-jones", "Daisy Jones & The Six", ["Taylor Jenkins Reid"], "9781524798628", ["Fiction"], "2019", 355, 4.2, 900, 70,
    "An oral history of the rise and mysterious breakup of a 1970s rock band — sex, drugs, and the songs that outlived them."),
  S("it-ends-with-us", "It Ends with Us", ["Colleen Hoover"], "9781501110368", ["Romance", "Fiction"], "2016", 384, 4.2, 2000, 72,
    "Lily's new relationship with neurosurgeon Ryle unravels as her first love Atlas reappears. A raw novel about breaking cycles of abuse."),
  S("book-lovers", "Book Lovers", ["Emily Henry"], "9780593440872", ["Romance"], "2022", 377, 4.1, 700, 69,
    "Literary agent Nora keeps getting dumped for small-town romance heroines. Then she collides with her rival editor — in the small town she can't escape."),
  S("sapiens", "Sapiens: A Brief History of Humankind", ["Yuval Noah Harari"], "9780062316097", ["Non-Fiction", "Science", "History"], "2011", 443, 4.4, 1200, 68,
    "How did an insignificant ape come to rule the planet? Harari spans 70,000 years of cognitive revolutions, myths, money, and empires."),
  S("educated", "Educated", ["Tara Westover"], "9780399590504", ["Non-Fiction", "Biography"], "2018", 334, 4.5, 1000, 71,
    "Raised in a survivalist family in Idaho with no formal schooling, Tara Westover taught herself enough to reach Cambridge — and had to choose between family and knowledge."),
  S("atomic-habits", "Atomic Habits", ["James Clear"], "9780735211292", ["Self-Help", "Non-Fiction"], "2018", 320, 4.4, 900, 74,
    "Tiny changes, remarkable results. A practical system for building good habits and breaking bad ones, one small improvement at a time."),
  S("thinking-fast-and-slow", "Thinking, Fast and Slow", ["Daniel Kahneman"], "9780374533557", ["Non-Fiction", "Science", "Psychology"], "2011", 499, 4.2, 700, 62,
    "Nobel laureate Kahneman maps the two systems that drive how we think — fast intuition and slow deliberation — and the biases between them."),
  S("the-body-keeps-the-score", "The Body Keeps the Score", ["Bessel van der Kolk"], "9780143127741", ["Non-Fiction", "Psychology", "Self-Help"], "2014", 464, 4.4, 500, 64,
    "A pioneering psychiatrist explains how trauma reshapes the body and brain — and the paths to recovery."),
  S("becoming", "Becoming", ["Michelle Obama"], "9781524763138", ["Biography", "Non-Fiction"], "2018", 448, 4.5, 900, 66,
    "From the South Side of Chicago to the White House, Michelle Obama's memoir of finding her voice and using it."),
  S("born-a-crime", "Born a Crime", ["Trevor Noah"], "9780399588174", ["Biography", "Non-Fiction", "Humor"], "2016", 304, 4.5, 700, 65,
    "Trevor Noah's memoir of growing up mixed-race in apartheid South Africa — where his very existence was illegal. Funny, moving, and unforgettable."),
  S("life-of-pi", "Life of Pi", ["Yann Martel"], "9780156027328", ["Fiction"], "2001", 319, 3.9, 1600, 62,
    "Pi Patel survives 227 days on a lifeboat in the Pacific — with a Bengal tiger named Richard Parker. Which story do you believe?"),
  S("rebecca", "Rebecca", ["Daphne du Maurier"], "9780380730407", ["Classics", "Mystery", "Romance"], "1938", 449, 4.2, 1000, 63,
    "A young bride arrives at Manderley to find her new home haunted by the memory of her husband's first wife, Rebecca. Last night I dreamt I went to Manderley again."),
];

export function searchCatalog(q: string, limit = 8): BookSummary[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const terms = query.split(/\s+/);
  return CATALOG.map((b) => {
    const hay = `${b.title} ${b.authors.join(" ")} ${b.categories.join(" ")}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (b.title.toLowerCase().includes(t)) score += 3;
      else if (b.authors.join(" ").toLowerCase().includes(t)) score += 2;
      else if (hay.includes(t)) score += 1;
      else return null;
    }
    return { b, score };
  })
    .filter((x): x is { b: BookSummary; score: number } => x !== null)
    .sort((a, z) => z.score - a.score || (z.b.trendingScore ?? 0) - (a.b.trendingScore ?? 0))
    .slice(0, limit)
    .map((x) => x.b);
}

export function trendingCatalog(limit = 12): BookSummary[] {
  return [...CATALOG].sort((a, z) => (z.trendingScore ?? 0) - (a.trendingScore ?? 0)).slice(0, limit);
}

export function catalogById(externalId: string): BookSummary | undefined {
  return CATALOG.find((b) => b.externalId === externalId);
}
