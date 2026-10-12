# ECM platform evaluation

Status: planned. No candidate has been deployed or scored.

Alfresco Community is the initial candidate due to the proposal's Java preference.
Mayan EDMS is the alternative. Evaluate available open-source editions and pinned
versions; do not assume enterprise-only features are available.

## Proof of concept

Time-box the first evaluation to approximately two working days. Use a small,
synthetic collection with a site, artifact, photograph, historical map, and report.

1. Record the tested release, license, deployment instructions, and machine resources.
2. Deploy using the candidate's supported container configuration.
3. Upload representative files and define custom metadata.
4. Represent a site and artifact, including entities without files.
5. Link related resources and retrieve those links through an API.
6. Search and filter records through the UI and API.
7. Exercise reader and contributor permissions, including denied API requests.
8. Upload a new version and retrieve the earlier version.
9. Restart services and verify persistence.
10. Record setup time, resource use, limitations, and implementation effort.

## Decision criteria

| Criterion | Weight | Evidence |
| --- | --- | --- |
| Metadata and domain relationships | 30% | Sites/artifacts and typed links represented and retrieved |
| Permissions and versioning | 20% | Allowed/denied access and version retrieval |
| API and customization fit | 20% | Small integration examples and Java suitability |
| Deployment and resource fit | 20% | Repeatable setup and measured resource consumption |
| Discovery experience | 10% | Representative research query completed |

Score each criterion from 1 (poor) to 5 (strong), with evidence. Weighted scores
support the decision but cannot override a failed core requirement or unavailable
license. Record the outcome in a new architecture decision document.

## Official starting points

- [Alfresco Community deployment](https://alfresco.github.io/acs-deployment/docs/docker-compose/README.html)
- [Alfresco Community packaging](https://github.com/Alfresco/acs-community-packaging)
- [Mayan EDMS](https://www.mayan-edms.com/)
- [Mayan documentation](https://docs.mayan-edms.com/)

Consult current official documentation during deployment to establish compatible
versions and configuration. The repository does not pin a platform yet.
