# Initial requirements

Status: proposal-derived baseline, pending supervisor and sample-data validation.

## Core acceptance criteria

| ID | Capability | Acceptance evidence |
| --- | --- | --- |
| FR-01 | Content ingestion | An authorized contributor uploads and retrieves a representative document, image, and map. |
| FR-02 | Metadata | Required fields are validated; permitted users can update metadata and retrieve it through the platform API. |
| FR-03 | Discovery | A researcher locates records by title, resource type, location, and historical period. |
| FR-04 | Relationships | A site connects to an artifact, photograph, map, and report using stable identifiers. |
| FR-05 | Access control | A reader can view permitted records but cannot edit; a restricted record cannot be retrieved by an unauthorized user through either UI or API. |
| FR-06 | Version history | A second document version can be uploaded and an earlier version retrieved. |
| FR-07 | Research workflow | A user can navigate from a site to its related research resources. |
| NFR-01 | Reproducibility | A teammate can follow documented setup with pinned component versions. |
| NFR-02 | Persistence | Uploaded content and metadata remain available after services restart. |
| NFR-03 | Recovery | A documented backup restores both content and metadata into a test environment. |

## Proposed information model

Resource types: site, artifact, historical document, map, photograph, and report.
Common metadata: identifier, title, description, creator, type, source, rights,
language, location, historical period, and related record identifiers.

Distinguish document creation dates from discovery dates and historical coverage.
Support unknown and approximate dates; avoid forcing ancient or uncertain dates
into a single exact timestamp. Physical artifacts and sites may exist without an
uploaded file. Validate how each candidate platform represents these entities.

Proposed roles: administrator, contributor/archivist, and researcher/reader.
Confirm collection-specific restrictions before finalizing permissions.

## Open questions

- Is Java preferred or required for assessed implementation?
- What representative data and metadata does the supervisor provide?
- Which relationships must be typed, directional, or many-to-many?
- Are approval workflows required for the first demonstration?
- What deployment host, resource budget, collection size, and concurrent usage
  should be supported?
- Which rights and restrictions apply to source material and site locations?

## Deferred features

OCR, maps, AI extraction, semantic search, and advanced analysis are optional.
No performance targets or production-readiness claims are established yet.
