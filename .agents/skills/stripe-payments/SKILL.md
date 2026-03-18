---
name: stripe_payments
description: How to manage Stripe payments — products, prices, subscriptions, invoices, and the MCP server.
---

# Stripe Payments Skill

## Overview

PTO uses Stripe for membership payments and product orders. The **Stripe MCP server** is available for managing Stripe resources directly.

## Current Payment Links (from Agent Instructions)

| Product | Price | Link |
|---|---|---|
| 6-month extension | 1 995 kr (40% discount) | `https://betalning.privatetrainingonline.se/b/6oU4gy4bN41hcyW4sDcfK0x?locale=sv` |
| 12-month extension | 2 995 kr (60% discount) | `https://betalning.privatetrainingonline.se/b/14A6oG7nZ0P56aycZ9cfK0y?locale=sv` |

## Available MCP Tools

### Read Operations
- `list_products` / `list_prices` — Browse catalog
- `list_customers` — Search customers by email
- `list_subscriptions` — View subscription status
- `list_invoices` — View invoices
- `list_payment_intents` — View payments
- `retrieve_balance` — Check balance
- `fetch_stripe_resources` — Get details by ID
- `search_stripe_resources` — Complex Stripe queries

### Write Operations
- `create_product` / `create_price` — Define new items
- `create_customer` — Add customers
- `create_invoice` / `create_invoice_item` / `finalize_invoice` — Invoicing
- `create_payment_link` — Generate payment URLs
- `create_coupon` — Discount codes
- `create_refund` — Process refunds
- `cancel_subscription` / `update_subscription` — Manage subscriptions

## Supplement Products (from Agent Instructions)

| Product | Price |
|---|---|
| Hydro Pulse | 349 kr |
| BCAA | 349 kr |
| Magnesium | 179 kr |
| Multivitamin | 179 kr |
| Omega 3 | 179 kr |

## Common Workflows

### Look up a customer
```
mcp_stripe_search_stripe_resources: customers:email:"user@example.com"
```

### Create a payment link
1. Find or create the product
2. Find or create the price
3. Create payment link with `create_payment_link`
