/**
 * Common trades to switch on, in the order work happens on site. None of
 * them is created automatically: each project switches on what it needs and
 * can add its own. The names are shown to users and therefore German.
 */
export const TRADE_CATALOG = [
  'Planung & Einreichung',
  'Abbruch',
  'Baumeister',
  'Zimmerer & Dach',
  'Spengler',
  'Fenster & Türen',
  'Elektro',
  'Installateur',
  'Innenputz',
  'Estrich',
  'Trockenbau',
  'Fliesen',
  'Böden',
  'Maler',
  'Tischler',
  'Küche',
  'Fassade',
  'Außenanlagen',
];

/** Catalogue trades sort by construction order, custom ones come after. */
export const sortOrderFor = (name: string, currentMax: number) => {
  const i = TRADE_CATALOG.indexOf(name);
  return i >= 0 ? i : Math.max(TRADE_CATALOG.length, currentMax + 1);
};
