/**
 * Product detail copy for the new site, in English.
 *
 * Drafted only from each product's official Smart Store title and the brand's 3D drawings
 * (dimensions) — no claims beyond what those say. Replace any entry with official copy when the
 * brand supplies it; the page shows whatever is here.
 */
export interface ProductDetail {
  overview: string[];
  material: string;
  use: string;
}

export const PRODUCT_DETAILS: Record<string, ProductDetail> = {
  'daily-tote': {
    overview: [
      'A light everyday tote cut from used flour sacks — FlourSack.',
      'The print of each sack stays on the bag, so every piece carries its own graphics.',
    ],
    material: 'Upcycled flour sack',
    use: 'Tote, carried by hand',
  },
  'daily-pouch-bag': {
    overview: ['A mini crossbody bag made from upcycled flour sacks, sized for the everyday essentials.'],
    material: 'Upcycled flour sack',
    use: 'Mini crossbody',
  },
  'origami-picnic-bag': {
    overview: ['A picnic bag that doubles as a picnic mat — carry it as a bag, unfold it to sit on.', 'Made for travel and days outdoors.'],
    material: 'Upcycled material',
    use: 'Bag and picnic mat in one',
  },
  'plano-bag': {
    overview: ['A two-way bag built from upcycled car licence plates.'],
    material: 'Upcycled car licence plates',
    use: 'Two-way',
  },
  'modular-bag-s': {
    overview: ['The small size of the Modular Bag — a two-way bag made from recycled, upcycled material.'],
    material: 'Recycled, upcycled material',
    use: 'Two-way',
  },
  'milkpack-earphone-case': {
    overview: ['An earphone case made from upcycled milk cartons, carried on a key ring.'],
    material: 'Upcycled milk cartons',
    use: 'Earphone case · key ring',
  },
  'book-cover': {
    overview: ['A handmade book cover that also works as a book case, made from upcycled material.'],
    material: 'Upcycled material',
    use: 'Book cover · book case',
  },
  'glasses-case': {
    overview: ['A portable pouch for glasses and sunglasses, made from upcycled material.'],
    material: 'Upcycled material',
    use: 'Glasses · sunglasses case',
  },
};
