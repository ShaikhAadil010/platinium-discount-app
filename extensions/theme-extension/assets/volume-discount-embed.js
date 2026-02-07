(() => {
  const root = document.getElementById("volume-discount-embed");
  if (!root) return;

  let products = [];
  try {
    products = JSON.parse(root.dataset.products || "[]");
  } catch {
    products = [];
  }

  const percent = Number(root.dataset.percent);
  const minQty = Number(root.dataset.minQty) || 2;
  if (!Array.isArray(products) || products.length === 0) return;
  if (!Number.isFinite(percent) || percent <= 0) return;

  const gidSet = new Set(products);
  const numericSet = new Set(
    products
      .map((id) => (typeof id === "string" ? id.split("/").pop() : null))
      .filter(Boolean),
  );

  const message = `Buy ${minQty}, get ${percent}% off`;
  const processed = new WeakSet();

  const findContainer = (node) => {
    const card = node.closest(
      ".card-wrapper, .product-card, .grid-product, .product-card-wrapper",
    );
    if (card) {
      return (
        card.querySelector(
          ".card__information, .card__content, .product-card__info, .grid-product__content",
        ) || card
      );
    }
    return node;
  };

  const ensureMessage = (node) => {
    const container = findContainer(node);
    if (!container || processed.has(container)) return;

    if (container.querySelector(".volume-discount-widget")) {
      processed.add(container);
      return;
    }

    const badge = document.createElement("div");
    badge.className = "volume-discount-widget";
    badge.textContent = message;
    container.appendChild(badge);
    processed.add(container);
  };

  const apply = () => {
    const nodes = document.querySelectorAll("[data-product-id]");
    nodes.forEach((node) => {
      const pid = node.getAttribute("data-product-id") || node.dataset.productId;
      if (!pid) return;

      if (gidSet.has(pid) || numericSet.has(pid)) {
        ensureMessage(node);
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  document.addEventListener("shopify:section:load", apply);
  document.addEventListener("shopify:section:reorder", apply);
  document.addEventListener("shopify:section:select", apply);
})();
