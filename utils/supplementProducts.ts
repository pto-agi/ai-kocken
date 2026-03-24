import { REFILL_PRODUCT_CATALOG, type RefillCatalogItem } from '../lib/refillCatalog';

export type Product = RefillCatalogItem;

export const PRODUCTS: Product[] = REFILL_PRODUCT_CATALOG;

/** Top picks shown in compact upsell contexts (e.g. uppföljning form). */
export const UPSELL_PRODUCT_IDS = ['hydro-pulse', 'bcaa', 'omega-3'] as const;

export const UPSELL_PRODUCTS = PRODUCTS.filter((p) =>
  (UPSELL_PRODUCT_IDS as readonly string[]).includes(p.id),
);

/** Products revealed when the user clicks "Se alla produkter". */
export const EXPANDED_PRODUCT_IDS = ['magnesium', 'multivitamin', 'klientpaket'] as const;

export const EXPANDED_PRODUCTS = PRODUCTS.filter((p) =>
  (EXPANDED_PRODUCT_IDS as readonly string[]).includes(p.id),
);

/** Calculate member discount percentage for a product. */
export function discountPercent(product: Product): number {
  if (product.price <= 0) return 0;
  return Math.round(((product.price - product.memberPrice) / product.price) * 100);
}
