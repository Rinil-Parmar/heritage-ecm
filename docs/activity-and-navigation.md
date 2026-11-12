# Document activity and navigation

The desktop sidebar keeps the brand visible and uses one scroll region for library links, administration, the cabinet tree, and the footer. Expanded cabinets are no longer confined to a small nested scrollbar. Width resizing remains available. On small screens navigation follows normal page scrolling.

## Activity history

Open a document and scroll to **Activity history**. The panel displays recorded event labels, actors, and timestamps, with pagination and refresh. It does not invent a change history from frontend actions or display raw event payloads.

FastAPI checks document access, then requests `/objects/documents/document/{id}/events/` using the signed-in user's Mayan token. Mayan's event-view permission determines access. A denial shows a restricted message; it is not presented as an empty history. Session expiry redirects to sign-in. Refresh record or refresh activity after making changes.

This panel contains the events returned for this document; it is not a guarantee of a complete audit of every related object or background task.

## Manual verification

1. Restart FastAPI if auto-reload is disabled, and refresh the frontend.
2. Expand several cabinets and reduce window height. Scroll navigation to reach the lower links. Confirm sidebar resizing still works.
3. Open a document with an account allowed to view events. Confirm activity entries match the platform history.
4. Change a document title, then refresh activity. Confirm the recorded event appears.
5. Check with an ordinary account lacking event-view access. Expect a restricted message and no event data.
6. Where there are multiple pages, check Previous and Next; refresh returns to page one.

## Permission controls

The next milestone implements access-aware document controls through a read-only Mayan extension. See [permission-controls.md](permission-controls.md) for installation requirements and remaining runtime validation. The extension has not been installed on the VM.

Validation performed: TypeScript compilation, Python syntax checks, and whitespace checks. No test suite or live authenticated UI verification was run.
