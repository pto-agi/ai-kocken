export type RefillCatalogItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  memberPrice: number;
  tag?: string;
  flavors?: string[];
};

export const REFILL_PRODUCT_CATALOG: RefillCatalogItem[] = [
  {
    id: 'klientpaket',
    title: 'Klientpaket',
    description: 'Samtliga kosttillskott som ingår i vårt klientpaket.',
    price: 1375,
    memberPrice: 995,
    tag: 'Mest valt',
  },
  {
    id: 'hydro-pulse',
    title: 'Hydro Pulse',
    description: 'Protein av högsta kvalitet för återhämtning och resultat.',
    price: 399,
    memberPrice: 349,
    flavors: ['Choklad', 'Jordgubb'],
  },
  {
    id: 'bcaa',
    title: 'BCAA',
    description: 'Aminosyror som stödjer återhämtning och muskler.',
    price: 379,
    memberPrice: 349,
  },
  {
    id: 'omega-3',
    title: 'Omega 3',
    description: 'Högkvalitativt omega-3 för hjärta och fokus.',
    price: 199,
    memberPrice: 179,
  },
  {
    id: 'magnesium',
    title: 'Magnesium',
    description: 'Stödjer återhämtning, sömn och nervsystem.',
    price: 199,
    memberPrice: 179,
  },
  {
    id: 'multivitamin',
    title: 'Multivitamin',
    description: 'Dagligt basstöd för viktiga mikronutrienter.',
    price: 199,
    memberPrice: 179,
  },
];

export const REFILL_PRODUCT_MAP = REFILL_PRODUCT_CATALOG.reduce<Record<string, RefillCatalogItem>>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});
