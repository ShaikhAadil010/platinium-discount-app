import { DiscountClass, ProductDiscountSelectionStrategy } from '../generated/api';

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

const EMPTY_RESULT = { operations: [] };

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return EMPTY_RESULT;
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return EMPTY_RESULT;
  }

  const metafieldValue = input.shop?.metafield?.value;
  if (!metafieldValue) {
    return EMPTY_RESULT;
  }

  let config;
  try {
    config = JSON.parse(metafieldValue);
  } catch {
    return EMPTY_RESULT;
  }

  const percentOff = Number(config?.percentOff);
  const minQty =
    Number.isFinite(Number(config?.minQty)) && Number(config?.minQty) >= 2
      ? Number(config?.minQty)
      : 2;
  const products = Array.isArray(config?.products) ? config.products : [];

  if (!Number.isFinite(percentOff) || percentOff <= 0) {
    return EMPTY_RESULT;
  }

  if (products.length === 0) {
    return EMPTY_RESULT;
  }

  const eligibleProducts = new Set(products);

  const targets = input.cart.lines
    .filter((line) => {
      const productId = line.merchandise?.product?.id;
      return (
        line.quantity >= minQty &&
        productId &&
        eligibleProducts.has(productId)
      );
    })
    .map((line) => ({
      cartLine: {
        id: line.id,
      },
    }));

  if (targets.length === 0) {
    return EMPTY_RESULT;
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `Buy ${minQty}, get ${percentOff}% off`,
              targets,
              value: {
                percentage: {
                  value: percentOff,
                },
              },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}
