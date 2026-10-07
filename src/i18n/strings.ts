/**
 * strings.ts — everything MnemoClio says, in the languages it says it in.
 *
 * Same contract as MnemoLaw: the host broadcasts its language, a key missing from a locale
 * falls back to English key by key, and an unknown placeholder stays visible. en / fr / es
 * first; de / pt / ru / zh read English until written.
 *
 * The names of things (people, works, regimes) are NOT here: they come from Wikidata in the
 * language of their country, and are translated only on request.
 */

export const LANGS = ['en', 'fr', 'es', 'de', 'pt', 'ru', 'zh'] as const;
export type Lang = (typeof LANGS)[number];

const en = {
  'app.subtitle': 'The history of every country, on one timeline you can move',
  'app.hint': 'Drag to travel through time · wheel to zoom · double-click to dive in',

  'load.reading': 'Reading the history… {done} of {total} subjects',
  'load.failed': '{what} could not be read: {why}',
  'load.dropped': '{n} unreadable rows left out of {what}.',

  'kind.person': 'Births',
  'kind.discovery': 'Discoveries',
  'kind.work': 'Works',
  'kind.knowledge': 'Knowledge',
  'kind.building': 'Buildings',
  'kind.treaty': 'Treaties and constitutions',
  'kind.disaster': 'Disasters',
  'kind.exploration': 'Exploration and space',
  'kind.society': 'Revolts and struggles',
  'kind.movement': 'Movements',
  'kind.sport': 'Sport',
  'kind.wars': 'Wars',

  'subjects.all': 'All subjects',
  'subjects.none': 'None',
  'subjects.cap': '{kind}: the {kept} best known of {total} (at least {min} Wikipedias)',
  'subjects.whole': '{kind}: all {total} that Wikidata dates',

  'countries.add': 'Add a country…',
  'countries.top': 'The 15 best covered',
  'countries.reset': 'Back to 5 countries',
  'countries.remove': 'Remove {name}',
  'countries.none': 'No country matches.',
  'countries.already': 'Already on the timeline.',
  'countries.count': "{n} countries, ended states and territories. Type a name in any language (“Japan”, “日本”, “Ottoman”).",

  'search.placeholder': 'Search the timeline: a person, a work, a treaty…',
  'search.none': 'Nothing by that name on the timeline.',
  'search.war': 'war · {year}',
  'search.regime': 'regime · {year}',

  'names.original': 'Original language',
  'names.french': 'French names',
  'names.original.hint': 'Every name is written in the language of its country, as on Wikidata.',
  'names.missing': '{n} names on screen have no French name on Wikidata (in italics). In the app a model would translate them, at your cost. Not wired yet.',
  'names.allThere': 'Every name on screen has a French name on Wikidata.',

  'play.play': 'Play',
  'play.pause': 'Pause',
  'play.speed': '{n} years / s',
  'zoom.in': 'Zoom in',
  'zoom.out': 'Zoom out',
  'zoom.all': 'Whole timeline',

  'borders.era': 'Borders of the time',
  'borders.now': "Today's borders",
  'borders.consent.title': 'Borders of the time',
  'borders.consent.body': 'These maps come from historical-basemaps by A. Ourednik, under the GPL-3.0 licence. MnemoClio does not carry them: your computer downloads the map of each date you look at from GitHub (1 to 3 MB each).',
  'borders.consent.source': 'See the source',
  'borders.consent.accept': 'Download the maps',
  'borders.consent.cancel': 'Keep today’s borders',
  'borders.loading': 'Downloading the map of {year}…',
  'borders.failed': 'The map of {year} could not be downloaded: {why}',
  'borders.stamp': 'Borders of {year}',
  'borders.stampNow': "Today's borders",
  'borders.before': 'Before {first}, the map of {first} is shown.',

  'now.title': 'In {year}, around the world',
  'now.decade': 'The {decade}s',
  'now.periods': 'Great periods',
  'now.nothing': 'Nothing dated on Wikidata for this country in the {decade}s, with the chosen subjects.',
  'now.more': '+ {n} more',
  'world.name': 'World',
  'world.hint': 'events Wikidata ties to no country',

  'card.birth': 'Birth',
  'card.known': 'in {n} Wikipedias',
  'card.wikidata': 'See on Wikidata',
  'card.meanwhile': 'Meanwhile, elsewhere, in {year}',
  'card.meanwhileNone': 'Nothing else dated that year in the chosen subjects.',
  'card.noCountry': 'no country on Wikidata',
  'card.inFrench': 'in French: {name}',
  'card.close': 'Close',

  'war.title': 'War · Wikidata “part of”, climbed up to the war',
  'war.counts': '{s}–{e} · {n} battles · {g} fronts or campaigns',
  'war.direct': 'Attached to the war itself',
  'regime.title': 'Succession · Wikidata “replaced by”',
  'period.title': 'Period · the wars that are part of it on Wikidata',
  'period.counts': '{s}–{e} · {n} wars',
  'decade.title': '{name} · the {decade}s · {n} events',

  'feed.title': 'Just happened',
  'feed.empty': 'Press play: what the cursor passes appears here.',

  'map.battles': '{n} battles (large dots)',
  'map.events': '{n} places of the {decade}s (small dots, subject colour)',
  'map.none': 'No place known for the {decade}s in the chosen countries.',

  'layout.label': 'Layout',
  'layout.timeline': 'Timeline',
  'layout.balanced': 'Balanced',
  'layout.map': 'Map',
  'layout.resize': 'Drag to resize',
  'map.follow': 'Follow the cursor',
  'kind.subdivision': 'States and regions',
  'kind.election': 'Elections',
  'kind.law': 'Laws',
  'kind.city': 'Cities',
  'kind.company': 'Companies',
  'kind.violence': 'Assassinations and attacks',
  'kind.leaders': 'Leaders',
  'leaders.state': 'Head of state',
  'leaders.gov': 'Head of government',
  'now.inPower': 'In power',
  'country.since': 'Exists since {year}',
  'leader.title': 'Leader · {office}',
  'leader.term': '{s}–{e}',
  'leader.chain': 'Before and after, in the same office',
  'search.leader': 'leader · {year}',
  'polity.ended': "ended state, {s}–{e}",
  'polity.territory': "territory",
  'polity.outside': "This state existed from {s} to {e}.",
  'year.bc': "{y} BC",
  'year.about': "c. {y}",
  'now.span': "{a} – {b}",
  'now.nothingSpan': "Nothing dated on Wikidata for this country in {span}, with the chosen subjects.",
  'jump.label': "Go to…",
  'footer.source': 'Data: Wikidata (CC0), read on {date} · Today’s borders: Natural Earth (public domain)',
};

export type Key = keyof typeof en;
type Dict = Partial<Record<Key, string>>;

const fr: Dict = {
  'app.subtitle': "L'histoire de chaque pays, sur une frise qu'on fait bouger",
  'app.hint': 'Glisse pour voyager dans le temps · molette pour zoomer · double-clic pour plonger',

  'load.reading': "Lecture de l'histoire… {done} sujets sur {total}",
  'load.failed': "{what} n'a pas pu être lu : {why}",
  'load.dropped': '{n} lignes illisibles écartées de {what}.',

  'kind.person': 'Naissances',
  'kind.discovery': 'Découvertes',
  'kind.work': 'Œuvres',
  'kind.knowledge': 'Savoir',
  'kind.building': 'Bâtiments',
  'kind.treaty': 'Traités et constitutions',
  'kind.disaster': 'Catastrophes',
  'kind.exploration': 'Explorations et espace',
  'kind.society': 'Révoltes et luttes',
  'kind.movement': 'Courants',
  'kind.sport': 'Sport',
  'kind.wars': 'Guerres',

  'subjects.all': 'Tous les sujets',
  'subjects.none': 'Aucun',
  'subjects.cap': '{kind} : les {kept} plus connus sur {total} (au moins {min} Wikipédias)',
  'subjects.whole': '{kind} : les {total} que Wikidata date',

  'countries.add': 'Ajouter un pays…',
  'countries.top': 'Les 15 plus couverts',
  'countries.reset': 'Revenir à 5 pays',
  'countries.remove': 'Retirer {name}',
  'countries.none': 'Aucun pays ne correspond.',
  'countries.already': 'Déjà sur la frise.',
  'countries.count': "{n} pays, États disparus et territoires. Tape un nom dans n’importe quelle langue (« Japon », « 日本 », « ottoman »).",

  'search.placeholder': 'Chercher dans la frise : une personne, une œuvre, un traité…',
  'search.none': 'Rien de ce nom dans la frise.',
  'search.war': 'guerre · {year}',
  'search.regime': 'régime · {year}',

  'names.original': "Langue d'origine",
  'names.french': 'Traduire en français',
  'names.original.hint': 'Chaque nom est écrit dans la langue de son pays, comme sur Wikidata.',
  'names.missing': "{n} noms à l'écran n'ont pas de nom français sur Wikidata (en italique). Dans l'app, un modèle les traduirait, à tes frais. Pas encore branché.",
  'names.allThere': "Tous les noms à l'écran ont un nom français sur Wikidata.",

  'play.play': 'Lecture',
  'play.pause': 'Pause',
  'play.speed': '{n} ans / s',
  'zoom.in': 'Zoomer',
  'zoom.out': 'Dézoomer',
  'zoom.all': 'Toute la frise',

  'borders.era': "Frontières de l'époque",
  'borders.now': "Frontières d'aujourd'hui",
  'borders.consent.title': "Frontières de l'époque",
  'borders.consent.body': "Ces cartes viennent de historical-basemaps, d'A. Ourednik, sous licence GPL-3.0. MnemoClio ne les embarque pas : ton ordinateur télécharge depuis GitHub la carte de chaque date que tu regardes (1 à 3 Mo chacune).",
  'borders.consent.source': 'Voir la source',
  'borders.consent.accept': 'Télécharger les cartes',
  'borders.consent.cancel': "Garder les frontières d'aujourd'hui",
  'borders.loading': 'Téléchargement de la carte de {year}…',
  'borders.failed': "La carte de {year} n'a pas pu être téléchargée : {why}",
  'borders.stamp': 'Frontières de {year}',
  'borders.stampNow': "Frontières d'aujourd'hui",
  'borders.before': 'Avant {first}, la carte de {first} est affichée.',

  'now.title': 'En {year}, dans le monde',
  'now.decade': 'Les années {decade}',
  'now.periods': 'Grandes périodes',
  'now.nothing': 'Rien de daté sur Wikidata pour ce pays dans les années {decade}, avec les sujets choisis.',
  'now.more': '+ {n} autres',
  'world.name': 'Monde',
  'world.hint': 'événements que Wikidata ne rattache à aucun pays',

  'card.birth': 'Naissance',
  'card.known': 'dans {n} Wikipédias',
  'card.wikidata': 'Voir sur Wikidata',
  'card.meanwhile': 'Pendant ce temps, ailleurs, en {year}',
  'card.meanwhileNone': "Rien d'autre de daté cette année-là dans les sujets choisis.",
  'card.noCountry': 'sans pays sur Wikidata',
  'card.inFrench': 'en français : {name}',
  'card.close': 'Fermer',

  'war.title': "Guerre · « fait partie de » sur Wikidata, remonté jusqu'à la guerre",
  'war.counts': '{s}–{e} · {n} batailles · {g} fronts ou campagnes',
  'war.direct': 'Rattachées directement à la guerre',
  'regime.title': 'Succession · « remplacé par » sur Wikidata',
  'period.title': 'Période · les guerres qui en font partie sur Wikidata',
  'period.counts': '{s}–{e} · {n} guerres',
  'decade.title': '{name} · années {decade} · {n} événements',

  'feed.title': 'Vient de se passer',
  'feed.empty': "Appuie sur lecture : ce que le curseur traverse s'affiche ici.",

  'map.battles': '{n} batailles (gros points)',
  'map.events': '{n} lieux des années {decade} (petits points, couleur du sujet)',
  'map.none': 'Aucun lieu connu pour les années {decade} dans les pays choisis.',

  'layout.label': 'Disposition',
  'layout.timeline': 'Frise',
  'layout.balanced': 'Équilibré',
  'layout.map': 'Carte',
  'layout.resize': 'Glisse pour redimensionner',
  'map.follow': 'Suivre le curseur',
  'kind.subdivision': 'États et régions',
  'kind.election': 'Élections',
  'kind.law': 'Lois',
  'kind.city': 'Villes',
  'kind.company': 'Entreprises',
  'kind.violence': 'Assassinats et attentats',
  'kind.leaders': 'Dirigeants',
  'leaders.state': "Chef d'État",
  'leaders.gov': 'Chef de gouvernement',
  'now.inPower': 'Au pouvoir',
  'country.since': 'Existe depuis {year}',
  'leader.title': 'Dirigeant · {office}',
  'leader.term': '{s}–{e}',
  'leader.chain': 'Avant et après, dans la même fonction',
  'search.leader': 'dirigeant · {year}',
  'polity.ended': "État disparu, {s}–{e}",
  'polity.territory': "territoire",
  'polity.outside': "Cet État a existé de {s} à {e}.",
  'year.bc': "{y} av. J.-C.",
  'year.about': "v. {y}",
  'now.span': "{a} – {b}",
  'now.nothingSpan': "Rien de daté sur Wikidata pour ce pays dans {span}, avec les sujets choisis.",
  'jump.label': "Aller à…",
  'footer.source': "Données : Wikidata (CC0), lues le {date} · Frontières d'aujourd'hui : Natural Earth (domaine public)",
};

const es: Dict = {
  'app.subtitle': 'La historia de cada país, en una línea de tiempo que se mueve',
  'app.hint': 'Arrastra para viajar en el tiempo · rueda para hacer zoom · doble clic para entrar',

  'load.reading': 'Leyendo la historia… {done} de {total} temas',
  'load.failed': 'No se pudo leer {what}: {why}',
  'load.dropped': '{n} filas ilegibles apartadas de {what}.',

  'kind.person': 'Nacimientos',
  'kind.discovery': 'Descubrimientos',
  'kind.work': 'Obras',
  'kind.knowledge': 'Saber',
  'kind.building': 'Edificios',
  'kind.treaty': 'Tratados y constituciones',
  'kind.disaster': 'Catástrofes',
  'kind.exploration': 'Exploración y espacio',
  'kind.society': 'Revueltas y luchas',
  'kind.movement': 'Corrientes',
  'kind.sport': 'Deporte',
  'kind.wars': 'Guerras',

  'subjects.all': 'Todos los temas',
  'subjects.none': 'Ninguno',
  'subjects.cap': '{kind}: los {kept} más conocidos de {total} (al menos {min} Wikipedias)',
  'subjects.whole': '{kind}: los {total} que Wikidata fecha',

  'countries.add': 'Añadir un país…',
  'countries.top': 'Los 15 mejor cubiertos',
  'countries.reset': 'Volver a 5 países',
  'countries.remove': 'Quitar {name}',
  'countries.none': 'Ningún país coincide.',
  'countries.already': 'Ya está en la línea de tiempo.',
  'countries.count': "{n} países, Estados desaparecidos y territorios. Escribe un nombre en cualquier idioma («Japón», «日本», «otomano»).",

  'search.placeholder': 'Buscar en la línea de tiempo: una persona, una obra, un tratado…',
  'search.none': 'Nada con ese nombre en la línea de tiempo.',
  'search.war': 'guerra · {year}',
  'search.regime': 'régimen · {year}',

  'names.original': 'Idioma original',
  'names.french': 'Nombres en francés',
  'names.original.hint': 'Cada nombre está escrito en el idioma de su país, como en Wikidata.',
  'names.missing': '{n} nombres en pantalla no tienen nombre francés en Wikidata (en cursiva). En la app, un modelo los traduciría, a tu cargo. Aún no está conectado.',
  'names.allThere': 'Todos los nombres en pantalla tienen nombre francés en Wikidata.',

  'play.play': 'Reproducir',
  'play.pause': 'Pausa',
  'play.speed': '{n} años / s',
  'zoom.in': 'Acercar',
  'zoom.out': 'Alejar',
  'zoom.all': 'Toda la línea',

  'borders.era': 'Fronteras de la época',
  'borders.now': 'Fronteras de hoy',
  'borders.consent.title': 'Fronteras de la época',
  'borders.consent.body': 'Estos mapas vienen de historical-basemaps, de A. Ourednik, bajo licencia GPL-3.0. MnemoClio no los incluye: tu ordenador descarga desde GitHub el mapa de cada fecha que miras (de 1 a 3 MB cada uno).',
  'borders.consent.source': 'Ver la fuente',
  'borders.consent.accept': 'Descargar los mapas',
  'borders.consent.cancel': 'Mantener las fronteras de hoy',
  'borders.loading': 'Descargando el mapa de {year}…',
  'borders.failed': 'No se pudo descargar el mapa de {year}: {why}',
  'borders.stamp': 'Fronteras de {year}',
  'borders.stampNow': 'Fronteras de hoy',
  'borders.before': 'Antes de {first} se muestra el mapa de {first}.',

  'now.title': 'En {year}, en el mundo',
  'now.decade': 'Los años {decade}',
  'now.periods': 'Grandes periodos',
  'now.nothing': 'Nada fechado en Wikidata para este país en los años {decade}, con los temas elegidos.',
  'now.more': '+ {n} más',
  'world.name': 'Mundo',
  'world.hint': 'hechos que Wikidata no asocia a ningún país',

  'card.birth': 'Nacimiento',
  'card.known': 'en {n} Wikipedias',
  'card.wikidata': 'Ver en Wikidata',
  'card.meanwhile': 'Mientras tanto, en otros lugares, en {year}',
  'card.meanwhileNone': 'Nada más fechado ese año en los temas elegidos.',
  'card.noCountry': 'sin país en Wikidata',
  'card.inFrench': 'en francés: {name}',
  'card.close': 'Cerrar',

  'war.title': 'Guerra · «forma parte de» en Wikidata, subido hasta la guerra',
  'war.counts': '{s}–{e} · {n} batallas · {g} frentes o campañas',
  'war.direct': 'Asociadas directamente a la guerra',
  'regime.title': 'Sucesión · «sustituido por» en Wikidata',
  'period.title': 'Periodo · las guerras que forman parte de él en Wikidata',
  'period.counts': '{s}–{e} · {n} guerras',
  'decade.title': '{name} · años {decade} · {n} hechos',

  'feed.title': 'Acaba de pasar',
  'feed.empty': 'Pulsa reproducir: lo que cruza el cursor aparece aquí.',

  'map.battles': '{n} batallas (puntos grandes)',
  'map.events': '{n} lugares de los años {decade} (puntos pequeños, color del tema)',
  'map.none': 'Ningún lugar conocido para los años {decade} en los países elegidos.',

  'layout.label': 'Disposición',
  'layout.timeline': 'Línea',
  'layout.balanced': 'Equilibrado',
  'layout.map': 'Mapa',
  'layout.resize': 'Arrastra para cambiar el tamaño',
  'map.follow': 'Seguir el cursor',
  'kind.subdivision': 'Estados y regiones',
  'kind.election': 'Elecciones',
  'kind.law': 'Leyes',
  'kind.city': 'Ciudades',
  'kind.company': 'Empresas',
  'kind.violence': 'Asesinatos y atentados',
  'kind.leaders': 'Dirigentes',
  'leaders.state': 'Jefe de Estado',
  'leaders.gov': 'Jefe de Gobierno',
  'now.inPower': 'En el poder',
  'country.since': 'Existe desde {year}',
  'leader.title': 'Dirigente · {office}',
  'leader.term': '{s}–{e}',
  'leader.chain': 'Antes y después, en el mismo cargo',
  'search.leader': 'dirigente · {year}',
  'polity.ended': "Estado desaparecido, {s}–{e}",
  'polity.territory': "territorio",
  'polity.outside': "Este Estado existió de {s} a {e}.",
  'year.bc': "{y} a. C.",
  'year.about': "h. {y}",
  'now.span': "{a} – {b}",
  'now.nothingSpan': "Nada fechado en Wikidata para este país en {span}, con los temas elegidos.",
  'jump.label': "Ir a…",
  'footer.source': 'Datos: Wikidata (CC0), leídos el {date} · Fronteras de hoy: Natural Earth (dominio público)',
};

/** de / pt / ru / zh are not written yet: those locales read English. */
const DICTS: Record<Lang, Dict> = { en, fr, es, de: {}, pt: {}, ru: {}, zh: {} };

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}

/** One string, in one language, with `{placeholders}` filled. A missing key reads English. */
export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const s = DICTS[lang]?.[key] ?? en[key];
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** For the parity test: every written locale and its dictionary. */
export const WRITTEN: Record<'en' | 'fr' | 'es', Dict> = { en, fr, es };
