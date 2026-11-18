# Scripts

Add repeatable setup, sample ingestion, health checking, and maintenance scripts
here when the corresponding workflows exist. Document prerequisites and usage
alongside each script. Destructive operations must be explicit and scoped.

- [Access-control baseline](access-control/README.md): create the five ECM roles
  and groups with explicit global permissions. Includes inventory, dry-run,
  transactional apply, and verification; leaves documents and users unchanged.
- [Mayan API smoke test](api-smoke/README.md): verify HTTPS reachability,
  anonymous denial, token authentication, and read-only document listing.
