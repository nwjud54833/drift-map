# OpenAPI import and comparison

The importer accepts OpenAPI 3.0.x as JSON or YAML, up to 2 MiB. It retains the normalized specification, operation identity (`path` + HTTP method), parameters, request body, response status codes, and schemas in the snapshot's JSON `contract` value. The Workbench derives a navigable path tree from those schemas. Existing JSON payload-sample imports remain supported.

Cloud diffs persist these change categories in `ContractChange.kind`. Migration `20261012180000_openapi_change_kinds` adds the corresponding PostgreSQL enum values. Apply it through the normal deployment migration process before enabling OpenAPI cloud comparisons; it is additive and does not rewrite existing rows. No database migration was run as part of this change.

Local structural `#/...` references are expanded before operation extraction. Repeated/circular references are represented by a circular marker rather than recursively expanded. External structural `$ref` references are rejected and are never fetched; `$ref`-looking keys inside literal examples remain example data. OpenAPI 3.1, Swagger 2.0, and AsyncAPI are explicitly rejected; they are not converted implicitly.

## Compatibility policy

- Removing a path/method, request parameter, response status, or declared response property is breaking.
- Adding a path/method, optional request parameter, optional request property, or response status is safe by default. Adding a required request parameter/property or a required request body is breaking.
- Request schemas are interpreted as input accepted by the API. Narrowing types/enums, adding required properties, or tightening validation is breaking; relaxation is safe.
- Response schemas are interpreted as output consumed by clients. Removing properties or status codes is breaking. Newly possible enum values or null values are warnings; reducing the output domain is generally safe.
- Format changes and validation changes that cannot be ordered reliably are warnings. The report includes the reason and does not infer path renames.

These are deterministic heuristics for OpenAPI declarations, not proof that a deployed implementation conforms to either document. Vendor extensions, callbacks/webhooks, security-policy compatibility, server behavior, and semantic changes not expressed in schemas are not compared. Review the persisted source specification when a warning says compatibility is ambiguous.
