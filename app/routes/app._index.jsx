import { useMemo, useState } from "react";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  InlineStack,
  TextField,
  Banner,
  Badge,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const configResponse = await admin.graphql(
    `#graphql
      query DiscountConfig {
        shop {
          id
          metafield(namespace: "volume_discount", key: "rules") {
            value
          }
        }
      }`,
  );
  const configJson = await configResponse.json();
  const rawValue = configJson?.data?.shop?.metafield?.value ?? null;
  let config = { products: [], minQty: 2, percentOff: 20 };

  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue);
      config = {
        products: Array.isArray(parsed?.products) ? parsed.products : [],
        minQty: typeof parsed?.minQty === "number" ? parsed.minQty : 2,
        percentOff:
          typeof parsed?.percentOff === "number" ? parsed.percentOff : 20,
      };
    } catch {
      config = { products: [], minQty: 2, percentOff: 20 };
    }
  }

  let productSummaries = [];
  if (config.products.length > 0) {
    const productsResponse = await admin.graphql(
      `#graphql
        query ProductTitles($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
            }
          }
        }`,
      {
        variables: { ids: config.products },
      },
    );
    const productsJson = await productsResponse.json();
    productSummaries = (productsJson?.data?.nodes ?? [])
      .filter(Boolean)
      .map((node) => ({ id: node.id, title: node.title }));
  }

  return json({ config, productSummaries });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const percentOff = Number(formData.get("percentOff"));
  const minQty = Number(formData.get("minQty"));
  const productsRaw = formData.get("products");
  const products = productsRaw ? JSON.parse(productsRaw) : [];

  const errors = {};
  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 80) {
    errors.percentOff = "Percent off must be between 1 and 80.";
  }
  if (!Number.isFinite(minQty) || minQty < 2 || minQty > 10) {
    errors.minQty = "Minimum quantity must be between 2 and 10.";
  }
  if (!Array.isArray(products) || products.length === 0) {
    errors.products = "Select at least one product.";
  }

  if (Object.keys(errors).length > 0) {
    return json({ ok: false, errors }, { status: 400 });
  }

  const configResponse = await admin.graphql(
    `#graphql
      query DiscountConfigShop {
        shop {
          id
        }
      }`,
  );
  const configJson = await configResponse.json();
  const shopId = configJson?.data?.shop?.id;
  const shopErrors = configJson?.errors;

  if (!shopId) {
    const message =
      shopErrors?.[0]?.message ||
      "Unable to load shop id. Please reinstall the app and try again.";
    return json({ ok: false, errors: { api: message } }, { status: 400 });
  }

  const config = { products, minQty, percentOff };
  const metafieldsResponse = await admin.graphql(
    `#graphql
      mutation SaveDiscountConfig($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            namespace
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "volume_discount",
            key: "rules",
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    },
  );
  const metafieldsJson = await metafieldsResponse.json();
  const userErrors = metafieldsJson?.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    return json(
      { ok: false, errors: { api: userErrors[0].message } },
      { status: 400 },
    );
  }

  return json({ ok: true, config });
};

export default function Index() {
  const { config, productSummaries } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const shopify = useAppBridge();

  const [selectedProducts, setSelectedProducts] = useState(productSummaries);
  const [percentOff, setPercentOff] = useState(config.percentOff);
  const [minQty, setMinQty] = useState(config.minQty ?? 2);

  const selectedIds = useMemo(
    () => selectedProducts.map((product) => product.id),
    [selectedProducts],
  );

  const openPicker = async () => {
    const result = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      action: "select",
    });

    const selection = Array.isArray(result) ? result : result?.selection ?? [];

    if (!selection || selection.length === 0) return;
    setSelectedProducts(
      selection.map((product) => ({
        id: product.id,
        title: product.title,
      })),
    );
  };

  const handleSave = () => {
    submit(
      {
        percentOff,
        minQty,
        products: JSON.stringify(selectedIds),
      },
      { method: "post" },
    );
  };

  const hasErrors = actionData?.ok === false && actionData?.errors;

  return (
    <Page>
      <TitleBar title="Volume Discount Config" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Buy {minQty}, get {percentOff}% off
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Choose products and a discount percent. The offer appears on
                    the product page and is applied automatically in cart.
                  </Text>
                </BlockStack>
                <BlockStack gap="300">
                  {hasErrors?.api && (
                    <Banner tone="critical">{actionData.errors.api}</Banner>
                  )}
                  {actionData?.ok && (
                    <Banner tone="success">
                      Saved. Discount config updated.
                    </Banner>
                  )}
                  <InlineStack gap="200" align="start">
                    <Button onClick={openPicker}>Select products</Button>
                    <Text variant="bodyMd">
                      {selectedProducts.length} selected
                    </Text>
                  </InlineStack>
                  {hasErrors?.products && (
                    <Text tone="critical">{actionData.errors.products}</Text>
                  )}
                  {selectedProducts.length > 0 && (
                    <Box>
                      <InlineStack gap="200" wrap>
                        {selectedProducts.map((product) => (
                          <Badge key={product.id}>{product.title}</Badge>
                        ))}
                      </InlineStack>
                    </Box>
                  )}
                  <TextField
                    label="Percent off"
                    type="number"
                    min={1}
                    max={80}
                    value={String(percentOff)}
                    onChange={(value) => setPercentOff(Number(value))}
                    error={hasErrors?.percentOff}
                  />
                  <TextField
                    label="Minimum quantity"
                    type="number"
                    min={2}
                    max={10}
                    value={String(minQty)}
                    onChange={(value) => setMinQty(Number(value))}
                    error={hasErrors?.minQty}
                  />
                </BlockStack>
                <InlineStack gap="300">
                  <Button variant="primary" onClick={handleSave}>
                    Save
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Config location
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Metafield
                      </Text>
                      <Text as="span" variant="bodyMd">
                        volume_discount.rules
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Min qty
                      </Text>
                      <Text as="span" variant="bodyMd">
                        {minQty}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Products
                      </Text>
                      <Text as="span" variant="bodyMd">
                        {selectedProducts.length}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Percent
                      </Text>
                      <Text as="span" variant="bodyMd">
                        {percentOff}%
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Notes
                  </Text>
                  <List>
                    <List.Item>
                      Widget only appears on configured products.
                    </List.Item>
                    <List.Item>
                      Discount applies automatically at qty 2+.
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
