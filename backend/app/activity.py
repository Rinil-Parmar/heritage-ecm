"""Document-scoped history using the current user's upstream permissions."""
from fastapi import APIRouter, HTTPException, Query, Request

from app.documents import check_upstream, read_detail
from app.uploads import call

router = APIRouter(prefix="/api/v1/records", tags=["Document activity"])


@router.get("/{document_id}/activity")
async def activity(request: Request, document_id: int, page: int = Query(1, ge=1)):
    await read_detail(request, document_id)
    response = await call(request, "GET", f"/objects/documents/document/{document_id}/events/", params={"page": page})
    # Mayan deliberately uses 404 as well as 403 for denied object access.
    # The document was already resolved above, so either status means this
    # section is restricted rather than that the record disappeared.
    if response.status_code in (403, 404):
        raise HTTPException(403, "Your account cannot view this document's activity history.")
    check_upstream(request, response.status_code)
    try:
        data = response.json()
        results = []
        for row in data["results"]:
            actor = row.get("actor")
            verb = row.get("verb")
            results.append({
                "id": int(row["id"]), "timestamp": row["timestamp"],
                "action": verb.get("label", "Recorded activity") if isinstance(verb, dict) else "Recorded activity",
                "actor": (actor.get("username") or actor.get("label") or "System") if isinstance(actor, dict) else "System",
            })
        return {"results": results, "has_next": bool(data.get("next"))}
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(502, "Activity history returned an unexpected response.") from None
