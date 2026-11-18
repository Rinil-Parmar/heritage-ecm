# Collection overview

Open a cabinet from the sidebar to see its name, full path, navigable parents,
accessible subfolders, and the existing searchable document table.

This is the first step toward Site Dossiers. Cabinets are collections, not
automatically archaeological sites: a site profile, location and description
will need an explicit association before they can be displayed.

## Access and integration

The overview reuses GET /api/v1/upload/cabinets and the existing document list
with cabinet_id. Both use the signed-in user's Mayan credentials. No new
administrator privileges, ACL grants, database schema or Mayan endpoints are
required. Document counts refer to the current filtered results, not every
record in the site or its subfolders.

Administrators, professors, assistants and viewers use the same navigation;
each sees the folders and records returned for their account. No new editing
actions are introduced by this overview.

## Manual verification

1. Open a parent cabinet. Confirm its title and full path.
2. Open a child folder card. Confirm the document list changes to that cabinet.
3. Use the parent breadcrumb to return.
4. Apply document filters and check that they stay inside the selected cabinet.
5. Use Clear filters; confirm the cabinet remains selected.
6. Repeat as a research viewer with cabinet access and limited document access.
   Only authorized records should appear; an empty list does not mean the
   cabinet contains no records for other users.
7. Check a cabinet without children and resize to a narrow viewport.

## Subsequent milestones

Add explicit record relationships before a Context Graph. Then associate site
profiles with collections for Site Dossiers. Image annotations, provenance
exports and research stories remain separate future milestones.
