# GLAPI Ontology

GLAPI's ontology is the stable, API-first map of the system: records, fields,
relationships, lifecycle states, operations, event names, and extension points.
The canonical registry lives in `@glapi/types/ontology` so API routes, SDKs,
docs, saved searches, imports, and UI builders can all depend on the same
contract.

## Goals

- Make the ERP model understandable without vendor-specific tribal knowledge.
- Treat APIs and OpenAPI documentation as the product contract, not an adapter.
- Support standard records and organization-defined extensions with the same
  vocabulary.
- Preserve financial correctness with explicit operations, immutable events, and
  versioned deprecation rules.
- Keep infrastructure decisions such as RDS schema changes behind the API model
  until the ontology is stable.

## Naming Standards

| Surface | Rule | Example |
| --- | --- | --- |
| Ontology version | `YYYY.MM` | `2026.05` |
| Record key | Lower snake case | `business_transaction` |
| Field key | Lower camel case | `organizationId` |
| API path | Kebab case resource under `/api` | `/api/revenue-arrangements` |
| Event name | Dot notation, lower camel case segments | `invoice.posted` |
| Lifecycle | `draft`, `active`, `inactive`, `archived`, `deprecated` | `active` |

Record keys are stable. Renames create aliases or new records with deprecation
metadata in a future version; they do not silently replace an existing key.

## Registry Shape

Each record definition includes:

- Stable record key, label, plural label, category, lifecycle, and owning package.
- Storage classification: table, view, custom record, or external system.
- Optional table name and API path.
- Supported operations such as `create`, `search`, `post`, `void`, and `export`.
- Fields with type, required/read-only flags, search/filter/sort hints, enum
  values, and references to other records.
- Relationships between ontology records.
- Event names emitted by the record.
- Whether the record can be extended with custom fields.

The current standard registry is exported as `ONTOLOGY_REGISTRY` from
`@glapi/types/ontology`.

## Runtime API

Fastify exposes the ontology registry through documented API endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/ontology/version` | Return ontology version and supported vocabulary. |
| `GET` | `/api/ontology` | Return the complete registry. |
| `GET` | `/api/ontology/records` | List record definitions with `category`, `customizable`, and `operation` filters. |
| `GET` | `/api/ontology/records/{key}` | Return one record definition by stable record key. |
| `GET` | `/api/ontology/events` | List all declared ontology event names. |

These endpoints are included in `/openapi.json` under the `Ontology` tag.

## Standard And Custom Records

Standard records are built into GLAPI and owned by packages such as
`@glapi/types/entities`, `@glapi/types/accounting`, and
`@glapi/types/transactions`. Examples include `customer`, `account`,
`business_transaction`, `invoice`, `gl_transaction`, `project`, and
`revenue_arrangement`.

Custom record types should be registered through `custom_record_type`. Instances
are stored as `custom_record` and still participate in the ontology: they have
record keys, fields, operations, permissions, search definitions, import/export
support, audit history, and event names.

## Saved Searches

NetSuite saved searches are effectively reusable, permissioned queries over the
application object model. In GLAPI, saved searches should query the ontology
rather than raw tables. A saved search definition should include:

- Target record key.
- Selected fields, joins, filters, sort order, grouping, formulas, and summary
  columns.
- Visibility: private, shared, or system.
- Runtime parameters for API calls and scheduled exports.
- Permission rules and field-level visibility.

Saved searches should power list views, report views, exports, dashboards, MCP
tools, and public API endpoints from one definition. Formula support should use
a restricted expression engine, not arbitrary SQL.

Fastify exposes the generalized saved-search API at `/api/saved-searches`.
The first implementation validates and compiles ontology-backed definitions into
safe query plans, and stores definitions in the API process while durable
database persistence is deferred. The current endpoints are:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/saved-searches` | List visible saved searches by record or visibility. |
| `POST` | `/api/saved-searches` | Create a saved search definition. |
| `POST` | `/api/saved-searches/validate` | Validate a definition without saving it. |
| `POST` | `/api/saved-searches/run` | Compile an ad hoc saved search into a query plan. |
| `GET` | `/api/saved-searches/{id}` | Read one saved search. |
| `PUT` | `/api/saved-searches/{id}` | Update one saved search. |
| `DELETE` | `/api/saved-searches/{id}` | Delete one saved search. |
| `POST` | `/api/saved-searches/{id}/run` | Compile a saved search into a query plan. |

## Custom Fields

NetSuite custom fields attach metadata-defined fields to standard records,
transaction bodies, transaction lines, items, entities, CRM records, and custom
records. GLAPI should implement this as `custom_field_definition` records that
validate values stored in each record's `customFields` payload.

Custom field definitions should include:

- Target record key and field key.
- Field type, label, help text, default value, required flag, and lifecycle.
- Search/filter/sort eligibility and index hints.
- Role and field-level permissions.
- Validation rules and allowed values.
- Optional references to standard or custom records.
- PII/compliance classification.

This lets customers extend records without schema churn while still keeping the
API contract discoverable and documented.

Fastify exposes the generalized custom-field API at
`/api/custom-field-definitions`. The first implementation validates definitions
and `customFields` payloads against the ontology, and stores definitions in the
API process while durable database persistence is deferred. Admin-only writes are
enforced at the route layer.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/custom-field-definitions` | List definitions by record or lifecycle. |
| `POST` | `/api/custom-field-definitions` | Create a definition. |
| `POST` | `/api/custom-field-definitions/validate` | Validate a definition without saving it. |
| `POST` | `/api/custom-field-definitions/validate-values` | Validate a record `customFields` payload. |
| `GET` | `/api/custom-field-definitions/{id}` | Read one definition. |
| `PUT` | `/api/custom-field-definitions/{id}` | Update one definition. |
| `DELETE` | `/api/custom-field-definitions/{id}` | Delete one definition. |

## Custom Records

NetSuite custom records are user-defined tables with fields, permissions,
relationships, forms, lists, and scripts. GLAPI should model them as
`custom_record_type` definitions plus `custom_record` instances.

The API should treat custom records like first-class records:

- Discoverable through the ontology registry.
- Addressable through stable API routes.
- Validated by the same field definition system as standard records.
- Searchable by the saved search engine.
- Protected by row-level and field-level permissions.
- Audited and evented.
- Importable and exportable with external IDs.

Fastify now exposes the generalized custom-record API at
`/api/custom-record-types` and `/api/custom-records`. The current
implementation validates custom record type metadata, compiles each type into
an ontology record, validates custom record values, and stores definitions and
records in the API process while durable database persistence is deferred.
Admin-only writes are enforced for record type metadata.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/custom-record-types` | List custom record type definitions by key or lifecycle. |
| `POST` | `/api/custom-record-types` | Create a custom record type definition. |
| `POST` | `/api/custom-record-types/validate` | Validate a type definition without saving it. |
| `GET` | `/api/custom-record-types/{id}` | Read one type definition. |
| `PUT` | `/api/custom-record-types/{id}` | Update one type definition. |
| `DELETE` | `/api/custom-record-types/{id}` | Delete one type definition if it has no records. |
| `GET` | `/api/custom-record-types/{id}/ontology` | Return the compiled ontology record for a type. |
| `GET` | `/api/custom-records` | List custom records by type key, type id, or lifecycle. |
| `POST` | `/api/custom-records` | Create a custom record instance. |
| `POST` | `/api/custom-records/validate` | Validate custom record values against a type. |
| `GET` | `/api/custom-records/{id}` | Read one custom record. |
| `PUT` | `/api/custom-records/{id}` | Update one custom record. |
| `DELETE` | `/api/custom-records/{id}` | Delete one custom record. |

## Versioning And Deprecation

The ontology version changes when record names, fields, relationships,
operations, or event names change. Breaking changes should be staged:

1. Add the new record, field, or operation.
2. Mark the old definition `deprecated` with replacement guidance.
3. Keep OpenAPI and SDK compatibility for a published support window.
4. Remove only after migration tooling and conformance tests cover the change.

## Implementation Sequence

1. Shared registry and naming standards in `@glapi/types/ontology`.
2. Fastify route exposing the registry and typed lookup endpoints.
3. OpenAPI schemas generated from the registry.
4. Generalized saved search API.
5. Generalized custom field definitions.
6. Custom record type and custom record APIs.
7. UI builders for saved searches, fields, forms, and record types.
8. Database and RDS infrastructure changes after the API model stabilizes.

## Additional Considerations

- Use idempotency keys and event IDs for all financial mutations.
- Keep posted GL records immutable; corrections should reverse and repost.
- Add conformance tests that prove each ontology record has OpenAPI docs, SDK
  types, permissions, audit events, import/export behavior, and search coverage.
- Generate index recommendations for saved searches and heavily used custom
  fields before promoting them to production workloads.
- Prevent namespace collisions for custom record and field keys per
  organization.
- Build a safe expression language for formulas and summaries.
- Track field-level security, PII classification, and audit visibility in the
  metadata from the start.
