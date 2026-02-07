import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// ═══════════════════════════════════════════════════════════
// LOADER - Fetch existing discount configuration
// ═══════════════════════════════════════════════════════════
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query GetDiscountConfig {
        shop {
          id
          metafield(namespace: "volume_discount", key: "rules") {
            value
          }
        }
      }`
    );

    const data = await response.json();
    const rawValue = data?.data?.shop?.metafield?.value ?? null;
    let config = { products: [], minQty: 2, percentOff: 10 };

    if (rawValue) {
      try {
        const parsed = JSON.parse(rawValue);
        config = {
          products: Array.isArray(parsed?.products) ? parsed.products : [],
          minQty: typeof parsed?.minQty === "number" ? parsed.minQty : 2,
          percentOff:
            typeof parsed?.percentOff === "number" ? parsed.percentOff : 10,
        };
      } catch {
        config = { products: [], minQty: 2, percentOff: 10 };
      }
    }

    return json({ config });
  } catch (error) {
    console.error("Error loading config:", error);
    return json({ config: { products: [], minQty: 2, percentOff: 10 } });
  }
}

// ═══════════════════════════════════════════════════════════
// ACTION - Save discount configuration
// ═══════════════════════════════════════════════════════════
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const config = JSON.parse(formData.get("config"));

    const shopResponse = await admin.graphql(
      `#graphql
      query ShopId {
        shop {
          id
        }
      }`
    );

    const shopJson = await shopResponse.json();
    const shopId = shopJson?.data?.shop?.id;
    if (!shopId) {
      return json({
        success: false,
        error: "Unable to load shop id. Please reinstall the app and try again.",
      });
    }

    const response = await admin.graphql(
      `#graphql
      mutation CreateMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
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
      }
    );

    const result = await response.json();

    if (result.data.metafieldsSet.userErrors.length > 0) {
      return json({ 
        success: false, 
        errors: result.data.metafieldsSet.userErrors 
      });
    }

    return json({ success: true, message: "Configuration saved successfully!" });
  } catch (error) {
    console.error("Error saving config:", error);
    return json({ success: false, error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════
// COMPONENT - Admin UI for Discount Configuration
// ═══════════════════════════════════════════════════════════
export default function DiscountConfig() {
  const { config } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();

  const [percentOff, setPercentOff] = useState(config.percentOff.toString());
  const [minQty, setMinQty] = useState(String(config.minQty ?? 2));
  const [productIds, setProductIds] = useState(
    config.products.join(",")
  );

  const handleSave = useCallback(() => {
    const productsArray = productIds
      .split(",")
      .map(id => id.trim())
      .filter(id => id.length > 0);

    const parsedMinQty = parseInt(minQty, 10);
    const safeMinQty =
      Number.isFinite(parsedMinQty) && parsedMinQty >= 2 && parsedMinQty <= 10
        ? parsedMinQty
        : 2;

    const newConfig = {
      products: productsArray,
      minQty: safeMinQty,
      percentOff: parseInt(percentOff, 10),
    };

    const formData = new FormData();
    formData.append("config", JSON.stringify(newConfig));
    submit(formData, { method: "post" });
  }, [minQty, percentOff, productIds, submit]);

  return (
    <Page
      title="Volume Discount Configuration"
      subtitle="Set up 'Buy 2, get X% off' discounts"
      backAction={{ content: "Home", url: "/app" }}
    >
      <Layout>
        {/* Success/Error Messages */}
        {actionData?.success && (
          <Layout.Section>
            <Banner status="success">
              ✅ {actionData.message}
            </Banner>
          </Layout.Section>
        )}

        {actionData?.success === false && (
          <Layout.Section>
            <Banner status="critical">
              ❌ Error saving configuration. Please try again.
            </Banner>
          </Layout.Section>
        )}

        {/* Main Configuration Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Discount Settings
              </Text>

              {/* Discount Percentage */}
              <TextField
                label="Discount Percentage"
                type="number"
                value={percentOff}
                onChange={setPercentOff}
                min="1"
                max="80"
                suffix="%"
                helpText="Enter a discount between 1-80%"
                autoComplete="off"
              />

              {/* Minimum Quantity */}
              <TextField
                label="Minimum Quantity"
                type="number"
                value={minQty}
                onChange={setMinQty}
                min="2"
                max="10"
                helpText="Minimum quantity required (2-10)"
                autoComplete="off"
              />

              {/* Product IDs Input */}
              <TextField
                label="Product IDs (Shopify Global IDs)"
                type="text"
                value={productIds}
                onChange={setProductIds}
                placeholder="gid://shopify/Product/123, gid://shopify/Product/456"
                helpText="Enter product Global IDs separated by commas"
                multiline={3}
                autoComplete="off"
              />

              {/* How to get Product IDs */}
              <Banner status="info">
                <BlockStack gap="200">
                  <Text fontWeight="bold">How to get Product IDs:</Text>
                  <List type="number">
                    <List.Item>Go to Products in Shopify admin</List.Item>
                    <List.Item>Click on a product</List.Item>
                    <List.Item>Look at the URL - copy the number at the end</List.Item>
                    <List.Item>Format: gid://shopify/Product/[NUMBER]</List.Item>
                  </List>
                  <Text>Example: gid://shopify/Product/7234567890123</Text>
                </BlockStack>
              </Banner>

              {/* Current Config Summary */}
              <Card background="bg-surface-secondary">
                <BlockStack gap="200">
                  <Text variant="headingSm" fontWeight="bold">
                    Current Configuration
                  </Text>
                  <Text>📦 Minimum Quantity: {minQty} units</Text>
                  <Text>💰 Discount: {percentOff}% off</Text>
                  <Text>
                    🛍️ Products: {productIds ? productIds.split(",").filter(id => id.trim()).length : 0} configured
                  </Text>
                </BlockStack>
              </Card>

              {/* Save Button */}
              <InlineStack align="end">
                <Button 
                  primary 
                  onClick={handleSave}
                  size="large"
                >
                  Save Configuration
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Instructions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                📋 Setup Instructions
              </Text>
              <List type="number">
                <List.Item>Set your discount percentage (1-80%)</List.Item>
                <List.Item>Add product Global IDs (comma-separated)</List.Item>
                <List.Item>Click "Save Configuration"</List.Item>
                <List.Item>Deploy the discount function</List.Item>
                <List.Item>Add the widget to your theme</List.Item>
                <List.Item>Test with 2+ items in cart</List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
