"""Application-owned links between Mayan records, filtered by Mayan access."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, PositiveInt

from app.auth import COOKIE_NAME, settings_for, store_for, trusted_origin
from app.database import delete_relationship, relationship_row, relationship_rows, save_relationship
from app.documents import DocumentDetail, read_detail
from app.uploads import require_write

router = APIRouter(prefix="/api/v1/records", tags=["Record relationships"])
RelationshipType = Literal["same_site", "depicts", "supports", "cites", "supersedes", "related"]


class RelationshipInput(BaseModel):
    target_document_id: PositiveInt
    relationship_type: RelationshipType
    note: str = Field(default="", max_length=500)


def username(request: Request) -> str:
    session = store_for(request).get(request.cookies.get(COOKIE_NAME))
    if not session:
        raise HTTPException(401, "Please sign in.")
    return session.username


def document_view(document: DocumentDetail) -> dict:
    return {
        "id": document.id,
        "label": document.label,
        "document_type": document.document_type.model_dump() if document.document_type else None,
        "datetime_created": document.datetime_created,
    }


async def visible_relationship(request: Request, row: dict, document_id: int) -> dict | None:
    outgoing = row["source_document_id"] == document_id
    related_id = row["target_document_id"] if outgoing else row["source_document_id"]
    try:
        related = await read_detail(request, related_id)
    except HTTPException as exc:
        if exc.status_code in (403, 404):
            return None
        raise
    return {
        "id": row["id"],
        "relationship_type": row["relationship_type"],
        "direction": "outgoing" if outgoing else "incoming",
        "note": row["note"],
        "created_by": row["created_by"],
        "created_at": row["created_at"],
        "document": document_view(related),
    }


@router.get("/{document_id}/relationships")
async def list_relationships(request: Request, document_id: int):
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    await read_detail(request, document_id)
    results = []
    for row in relationship_rows(settings_for(request).database_path, document_id):
        item = await visible_relationship(request, row, document_id)
        if item:
            results.append(item)
    return {"results": results}


@router.post("/{document_id}/relationships", status_code=201,
             dependencies=[Depends(trusted_origin), Depends(require_write)])
async def create_relationship(request: Request, document_id: int, payload: RelationshipInput):
    if document_id < 1 or document_id == payload.target_document_id:
        raise HTTPException(422, "Choose a different related record.")
    await read_detail(request, document_id)
    await read_detail(request, payload.target_document_id)
    row = save_relationship(
        settings_for(request).database_path,
        source_id=document_id,
        target_id=payload.target_document_id,
        relationship_type=payload.relationship_type,
        note=payload.note.strip(),
        actor=username(request),
    )
    item = await visible_relationship(request, row, document_id)
    return item


@router.delete("/{document_id}/relationships/{relationship_id}",
               dependencies=[Depends(trusted_origin), Depends(require_write)])
async def remove_relationship(request: Request, document_id: int, relationship_id: int):
    row = relationship_row(settings_for(request).database_path, relationship_id)
    if not row or document_id not in (row["source_document_id"], row["target_document_id"]):
        raise HTTPException(404, "Relationship not found.")
    await read_detail(request, document_id)
    other_id = row["target_document_id"] if row["source_document_id"] == document_id else row["source_document_id"]
    await read_detail(request, other_id)
    delete_relationship(settings_for(request).database_path, relationship_id)
    return {"deleted": True}
