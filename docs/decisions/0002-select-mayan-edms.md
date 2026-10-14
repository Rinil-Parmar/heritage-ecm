# ADR 0002: Select Mayan EDMS for the proof of concept

- Date: 2026-10-14
- Status: Accepted
- Supersedes: ADR 0001's pending platform evaluation

## Context

The project needs metadata, search/OCR, permissions, workflows, document versions,
and API access. The development laptop has 8 GB RAM. A reduced Alfresco trial put
the laptop under significant resource pressure before its web interface started,
and the university server cannot currently run Docker under the team's account.
The academic delivery date is December 9, 2026.

## Decision

Use Mayan EDMS as the document-management platform. Begin with a small local proof
of concept and move the same deployment model to a suitable VM when shared access
is required.

Retain React for the research interface and Java/Spring Boot for the domain and
integration API. Mayan owns document binaries, document metadata, versions, OCR,
document permissions, and document workflows. The application database will own
archaeological sites, physical artifacts, geographic information, and typed domain
relationships, referencing Mayan document identifiers where needed.

## Consequences

The team avoids Alfresco's heavier operating footprint and can validate document
workflows earlier. Mayan's internals are Python/Django, so Java work occurs in the
separate integration service. Coordinated authorization, stable identifiers, and
backup/restore across Mayan and the application database require explicit design
and testing. The local proof of concept must still demonstrate acceptable resource
usage and the required API behavior.
