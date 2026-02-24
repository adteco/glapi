# Karate API Tests

This folder contains API acceptance tests for the ASC-606 intermediary flow.
It also includes smoke checks for auth-sensitive tRPC endpoints.

## Run

1. Start API server (port `3031`):

```bash
pnpm dev:api
```

2. Run Karate tests:

```bash
pnpm test:karate

# Targeted suites
pnpm test:karate:asc606
pnpm test:karate:demo-seed
pnpm test:karate:trpc-auth
```

## Config

The runner uses these system properties / env vars:

- `KARATE_BASE_URL` (default `http://localhost:3031`)
- `KARATE_ORG_ID` (default `ba3b8cdf-efc1-4a60-88be-ac203d263fe2`)
- `KARATE_USER_ID` (default `00000000-0000-0000-0000-000000000001`)
- `KARATE_API_KEY` (optional; leave unset to preserve your explicit `x-user-id`)
- `KARATE_SUBSIDIARY_ID` (existing subsidiary UUID used in sales order creation)
- `KARATE_CUSTOMER_ID` (existing customer/entity UUID used in sales order creation)
- `KARATE_ITEM_ID` (existing item UUID used in sales order line)

Example:

```bash
KARATE_BASE_URL=http://127.0.0.1:3031 \
KARATE_USER_ID=<entity-uuid> \
KARATE_SUBSIDIARY_ID=<subsidiary-uuid> \
KARATE_CUSTOMER_ID=<customer-entity-uuid> \
KARATE_ITEM_ID=<item-uuid> \
pnpm test:karate:asc606
```
