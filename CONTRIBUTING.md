# Contributing

## Workflow

1. Create or select an issue with a clear outcome and acceptance criteria.
2. Update your local `main` branch before starting work.
3. Create a short branch, for example `docs/platform-evaluation` or
   `feat/site-metadata`.
4. Make focused changes and update relevant documentation.
5. Run the checks appropriate to the change and record the results.
6. Open a pull request against `main`; request a teammate's review.
7. Merge after review and successful required checks, when configured.

Branch protection and automated CI are not yet configured. These are team
conventions until repository settings and executable checks are introduced.

Use descriptive commit messages such as `docs: record ECM evaluation results`.

## Configuration and data

- Commit reproducible configuration and placeholder examples, never credentials.
- Keep uploaded content, databases, backups, and runtime volumes out of Git.
- Use synthetic or appropriately licensed sample records; document provenance.
- Keep original academic documents and student identifiers out of the repository.
- Explain significant architecture choices in `docs/decisions/`.

## Review expectations

Explain the behavior changed, why it is needed, and how it was validated.
Include reproduction steps for defects. For deployment changes, document
storage persistence and recovery implications. For permissions, test both
allowed and denied operations.
