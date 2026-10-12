# ADR 0001: Use an existing ECM as the content system of record

- Date: 2026-10-12
- Status: Accepted for the initial project direction

## Context

The project requires content storage, metadata, permissions, search, versioning,
and relationships for archaeological and historical research within an academic
delivery schedule.

## Decision

Configure and extend an existing open-source ECM. Evaluate Alfresco Community
first, with Mayan EDMS as an alternative. Platform selection is still pending.

Use the platform interface for the first proof of concept. Introduce a custom
research interface and integration service only when concrete workflows need
them. Integrate using supported APIs rather than direct database writes.

## Consequences

The team can focus on the domain model and research workflows. Platform limits,
operational requirements, licenses, and extension mechanisms must be evaluated.
Configuration and deployment instructions must be versioned so the environment
can be reproduced. A separate decision will record the selected platform and
evidence from the proof of concept.
