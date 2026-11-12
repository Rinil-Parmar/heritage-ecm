"""Fail-closed proxy for the versioned Mayan access extension."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, ValidationError

from app.documents import check_upstream, read_detail
from app.uploads import call

router = APIRouter(prefix='/api/v1/records', tags=['Document access'])


class DocumentAccess(BaseModel):
    model_config = ConfigDict(extra='ignore')
    schema_version: StrictInt
    edit_details: StrictBool
    edit_metadata: StrictBool
    upload_version: StrictBool
    add_comment: StrictBool
    download: StrictBool
    tags_add: list[StrictInt] = Field(max_length=5000)
    tags_remove: list[StrictInt] = Field(max_length=5000)
    cabinets_add: list[StrictInt] = Field(max_length=5000)
    cabinets_remove: list[StrictInt] = Field(max_length=5000)


@router.get('/{document_id}/access', response_model=DocumentAccess)
async def document_access(request: Request, document_id: int):
    await read_detail(request, document_id)
    response = await call(request, 'GET', f'/archeoecm/documents/{document_id}/access/')
    if response.status_code == 404:
        raise HTTPException(503, 'Document access checks are unavailable. Ask your administrator to enable the access service.')
    check_upstream(request, response.status_code)
    try:
        result = DocumentAccess.model_validate(response.json())
        if result.schema_version != 1:
            raise ValueError
        return result
    except (ValueError, ValidationError):
        raise HTTPException(502, 'Document access could not be verified.') from None
