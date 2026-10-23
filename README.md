# Heritage ECM

Enterprise Content Management for archaeological and historical documents.

COMP 8977 Internship/Project-2, Team 05, University of Windsor, Fall 2026.

## Project status

Repository foundation established. Mayan EDMS is selected for the proof of
concept, with a resource-limited local configuration in
[infra/mayan](infra/mayan/README.md). The earlier Alfresco experiment is retained
as evaluation history and is not the active platform.

## Purpose

Create a centralized research environment for documents, maps, photographs,
excavation reports, artifacts, and archaeological sites. Resources should be
searchable through structured metadata and connected to related records.

Example research workflow: select a site, find its artifacts, open related
photographs and excavation reports, and filter historical maps by period.

## Scope

- Upload, organize, retrieve, and version documents.
- Describe resources using shared and domain-specific metadata.
- Search and filter by attributes such as resource type, location, and period.
- Connect sites, artifacts, maps, photographs, and reports.
- Control access through users, roles, and permissions.
- Document setup, configuration, and validation for reproducibility.

OCR, geographic visualization, semantic search, and AI analysis are optional
extensions after the core workflow is complete.

## Technical direction

Use Mayan EDMS as the document system of record. React and a Spring Boot service
will provide the archaeological research interface and domain model where Mayan's
document-oriented model is insufficient. The local proof of concept must confirm
the platform's resource usage and API fit.

Access ECM content through supported APIs. Avoid direct writes to its database
and duplicated document storage in a separate application.

## Repository layout

```text
heritage-ecm/
  .github/       Issue and pull request templates
  docs/          Requirements, evaluation, decisions, and setup guidance
  infra/         ECM deployment and configuration
  scripts/       Future repeatable setup and maintenance tools
  samples/       Synthetic or appropriately licensed demonstration data
```

Application directories will be introduced when their implementation begins.
Original course documents remain in the sibling `../Documents/` directory and
are not required to clone or use this repository.

## Getting started

1. Clone this repository and open it in your editor.
2. Read the [development guide](docs/development.md).
3. Review the [requirements](docs/requirements.md) and
   [platform evaluation plan](docs/platform-evaluation.md).
4. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for branches and pull requests.

See the [local Mayan guide](infra/mayan/README.md) for container versions and
runtime commands. No custom application build exists at this stage.
See the [deployment pipeline guide](docs/deployment-pipeline.md) for the
approval-gated workflow that validates or redeploys Mayan on the university VM.

## Milestones

1. Repository foundation and requirements baseline.
2. Platform proof of concept and recorded selection.
3. Reproducible ECM deployment with persistent storage.
4. Metadata, relationships, roles, and permissions.
5. Complete research workflow and any required custom interface.
6. Functional/access-control testing, backup restoration, and final demo.

The proposal targets final delivery on December 9, 2026.

## License

A project license has not yet been selected. Third-party software and sample
content retain their own licenses. Do not assume this repository grants an
open-source license.
