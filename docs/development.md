# Development setup

## Current stage

This repository contains project documentation, collaboration templates, and a
resource-limited Mayan EDMS Compose deployment. See
[the local guide](../infra/mayan/README.md) for commands and limitations.
Docker Desktop with Linux containers is needed for that trial. No custom
application server or automated test suite exists yet.

## Before ECM deployment

Record the following during the next milestone:

- Operating system and available CPU, RAM, and disk space.
- Docker engine availability and Docker Compose version.
- On Windows, the chosen supported Linux-container environment.
- Selected ECM edition, pinned image versions, and compatible dependencies.
- Required ports, configuration variables, storage locations, and health checks.

Document exact startup, shutdown, validation, backup, and restoration commands
after they have been tested. Add `.env.example` when real configuration variables
are known; keep actual `.env` files untracked.

## Local layout

The initial workspace keeps source materials separate:

```text
Internship_Project_2/
  Documents/       Original academic proposal and presentation
  heritage-ecm/    This Git repository
```

Clones elsewhere do not require the sibling `Documents/` directory.

## Initial manual checks

```sh
git status --short
git diff --check
```

Review Markdown links and ensure staged files exclude secrets and runtime data.
Introduce CI with meaningful executable checks when configuration or code lands.
