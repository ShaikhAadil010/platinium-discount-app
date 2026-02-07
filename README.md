# Platinium Discount App

Platinium Discount App is a Shopify app that lets merchants configure a simple volume discount (buy a minimum quantity 2 and get a percentage off) and surface that offer on the storefront.

## What The App Does

This app is built with Remix and Shopify App tooling. It provides an admin screen to configure discount rules, stores those rules in a shop metafield, applies the discount in cart with a Shopify Function, and shows a storefront message via a theme extension.

## Features

- Admin UI to configure volume discount rules (minimum quantity and percent off).
- Product selection for eligible items.
- Stores configuration in `shop.metafields.volume_discount.rules`.
- Shopify Function applies percentage discounts to eligible cart lines.
- Theme extension displays the offer message on product cards/pages.

## Pull And Run


1. `git clone https://github.com/ShaikhAadil010/platinium-discount-app.git`
2. `cd platinium-discount-app`
3. `npm install`
4. `shopify app dev`


If you do not have the Shopify CLI installed:

1. `npm install -g @shopify/cli@latest`

## Notes

- You need a Shopify Partner account and a development store for local testing.
- `shopify app dev` will guide you through connecting the app and setting required env vars.

## StoreFront URL 
https://platiniumstore-2.myshopify.com/
