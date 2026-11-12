# Organization release milestones

Implement and manually verify each milestone before promoting it to a release.

| Priority | Outcome | Scope |
| --- | --- | --- |
| 1 | Find records | Cabinet tree, colored tag browser, scoped search, pagination and clear navigation |
| 2 | Respect access | Verify effective document permissions and hide unavailable actions; keep upstream enforcement |
| 3 | Explain changes | Document activity timeline with actor, action and timestamp |
| 4 | Recover mistakes | Trash and restore with confirmation and permission checks |
| 5 | Resume work | Recent documents dashboard with real accessible records |
| 6 | Review work | View workflow state and perform permitted transitions after approval stages are agreed |
| 7 | Browse structured collections | Read-only index navigation after metadata and index templates are configured |

User management already has account editing and group assignment. A dedicated user detail page should consolidate profile and memberships; do not expose sensitive activity or administrative controls to ordinary users.

Workflow and index template configuration belongs to authorized administrators. Ordinary users need workflow status, allowed actions and navigation, not configuration editors.

Release requirements: verify regular-user and administrator flows, resolve effective-permission visibility, check partial-write recovery, then test and deploy through the approved pipeline. Do not describe untested local changes as production-ready.
