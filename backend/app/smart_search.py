"""Permission-safe natural-language search planning and execution."""

from datetime import date, datetime, time
import asyncio
import json
import re
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.auth import COOKIE_NAME, store_for, trusted_origin
from app.documents import UpstreamPage, check_upstream, upstream_access
from app.uploads import cabinet_rows, call, require_write

router = APIRouter(prefix="/api/v1/smart-search", tags=["Smart search"])
MAX_CATALOG_ITEMS = 150


class MetadataCriterion(BaseModel):
    field: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=200)


class SearchPlan(BaseModel):
    keywords: str = Field(default="", max_length=200)
    created_from: date | None = None
    created_to: date | None = None
    document_type_id: int | None = Field(default=None, ge=1)
    tag_id: int | None = Field(default=None, ge=1)
    cabinet_id: int | None = Field(default=None, ge=1)
    metadata: list[MetadataCriterion] = Field(default_factory=list, max_length=5)
    explanation: str = Field(default="", max_length=300)

    @model_validator(mode="after")
    def dates_are_ordered(self):
        if self.created_from and self.created_to and self.created_from > self.created_to:
            raise ValueError("created_from must not be after created_to")
        return self


class SmartSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)


class SearchResult(BaseModel):
    id: int
    label: str
    description: str = ""
    datetime_created: datetime
    document_type: dict[str, Any] | None = None
    language: str = ""


class SmartSearchResponse(BaseModel):
    mode: Literal["ai", "standard"]
    warning: str = ""
    plan: SearchPlan
    interpretation: list[str]
    count: int
    page: int
    next_page: int | None
    previous_page: int | None
    results: list[SearchResult]


class SearchPageRequest(BaseModel):
    plan: SearchPlan
    page: int = Field(ge=1, le=100000)


class SearchPageResponse(BaseModel):
    count: int
    page: int
    next_page: int | None
    previous_page: int | None
    results: list[SearchResult]


def provider_ready(settings) -> bool:
    return settings.ai_provider == "openai" and bool(settings.ai_api_key)


@router.get("/status")
async def smart_search_status(request: Request):
    settings, _ = upstream_access(request)
    return {
        "ai_enabled": provider_ready(settings),
        "mode": "ai" if provider_ready(settings) else "standard",
        "capabilities": ["keywords", "created dates", "document types", "tags", "cabinets", "metadata"],
        "examples": [
            "Find excavation reports from Canada created between 2023 and 2025",
            "Show records tagged Needs Review from 2026",
            "Find documents for Site A in the Archaeology cabinet",
        ],
    }


async def bounded_rows(request: Request, path: str) -> list[dict]:
    try:
        rows: list[dict] = []
        for page in range(1, 21):
            response = await call(request, "GET", path, params={"page": page})
            check_upstream(request, response.status_code)
            data = response.json()
            batch = data.get("results")
            if not isinstance(batch, list):
                raise ValueError
            rows.extend(batch)
            if len(rows) >= MAX_CATALOG_ITEMS or not data.get("next"):
                return rows[:MAX_CATALOG_ITEMS]
        return rows[:MAX_CATALOG_ITEMS]
    except HTTPException as exc:
        if exc.status_code in (403, 404):
            return []
        raise
    except (ValueError, TypeError):
        raise HTTPException(502, "The archive configuration service returned an unexpected response.") from None


async def catalog_for(request: Request) -> dict[str, list[dict]]:
    types, tags, metadata, cabinet_source = await asyncio.gather(
        bounded_rows(request, "/document_types/"), bounded_rows(request, "/tags/"),
        bounded_rows(request, "/metadata_types/"), bounded_rows(request, "/cabinets/"),
    )
    cabinets = cabinet_rows(cabinet_source)[:MAX_CATALOG_ITEMS]
    return {
        "document_types": [{"id": row.get("id"), "label": row.get("label", "")} for row in types],
        "tags": [{"id": row.get("id"), "label": row.get("label", "")} for row in tags],
        "cabinets": [{"id": row.get("id"), "label": row.get("full_path") or row.get("label", "")} for row in cabinets],
        "metadata": [{"name": row.get("name", ""), "label": row.get("label", "")} for row in metadata],
    }


def phrase_match(query: str, rows: list[dict], value_key: str = "label") -> dict | None:
    lowered = query.casefold()
    matches = [row for row in rows if str(row.get(value_key) or "").casefold() in lowered]
    if not matches:
        return None
    return max(matches, key=lambda row: len(str(row.get(value_key) or "")))


def standard_plan(query: str, catalog: dict[str, list[dict]]) -> SearchPlan:
    """Useful, deterministic fallback before or during provider configuration."""
    years = [int(value) for value in re.findall(r"\b(?:19|20)\d{2}\b", query)]
    start = date(min(years), 1, 1) if years else None
    end = date(max(years), 12, 31) if years else None
    document_type = phrase_match(query, catalog["document_types"])
    tag = phrase_match(query, catalog["tags"])
    cabinet = phrase_match(query, catalog["cabinets"])
    keywords = re.sub(r"\b(?:19|20)\d{2}\b", " ", query)
    for matched in (document_type, tag, cabinet):
        if matched:
            keywords = re.sub(re.escape(str(matched["label"])), " ", keywords, flags=re.I)
    keywords = re.sub(r"\b(?:from|to|between|and|in|created|dated|show|find|records?|documents?|tagged|tag|cabinet|folder|type)\b", " ", keywords, flags=re.I)
    keywords = re.sub(r"\s+", " ", keywords).strip()
    return SearchPlan(
        keywords=keywords[:200], created_from=start, created_to=end,
        document_type_id=int(document_type["id"]) if document_type else None,
        tag_id=int(tag["id"]) if tag else None,
        cabinet_id=int(cabinet["id"]) if cabinet else None,
        explanation="Standard search extracted recognizable filters from the request.",
    )


PLAN_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "keywords": {"type": "string"},
        "created_from": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "created_to": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "document_type_id": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "tag_id": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "cabinet_id": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "metadata": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"field": {"type": "string"}, "value": {"type": "string"}},
            "required": ["field", "value"],
        }},
        "explanation": {"type": "string"},
    },
    "required": ["keywords", "created_from", "created_to", "document_type_id", "tag_id", "cabinet_id", "metadata", "explanation"],
}


def response_text(payload: dict) -> str:
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    raise ValueError("No structured output")


async def ai_plan(settings, query: str, catalog: dict[str, list[dict]]) -> SearchPlan:
    safe_catalog = json.dumps(catalog, ensure_ascii=True, separators=(",", ":"))
    payload = {
        "model": settings.ai_model, "store": False, "max_output_tokens": 700,
        "instructions": (
            "Convert an archive search request into filters. Use only IDs and metadata field names in the supplied catalog. "
            "Never invent an ID or field. Put unmatched subject terms in keywords. Dates refer to record creation unless the "
            "request clearly names a catalogued metadata field. Return empty keywords when filters fully express the request."
        ),
        "input": f"Catalog: {safe_catalog}\nUser request: {query}",
        "text": {"format": {"type": "json_schema", "name": "archive_search_plan", "strict": True, "schema": PLAN_SCHEMA}},
    }
    headers = {"Authorization": f"Bearer {settings.ai_api_key.get_secret_value()}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=settings.ai_timeout, follow_redirects=False) as client:
        response = await client.post("https://api.openai.com/v1/responses", headers=headers, json=payload)
    if response.status_code != 200:
        raise RuntimeError("Provider request failed")
    try:
        return SearchPlan.model_validate_json(response_text(response.json()))
    except (ValueError, ValidationError, json.JSONDecodeError) as exc:
        raise RuntimeError("Provider returned an invalid plan") from exc


def validate_catalog_plan(plan: SearchPlan, catalog: dict[str, list[dict]]) -> SearchPlan:
    valid_ids = {
        "document_type_id": {row["id"] for row in catalog["document_types"]},
        "tag_id": {row["id"] for row in catalog["tags"]},
        "cabinet_id": {row["id"] for row in catalog["cabinets"]},
    }
    updates = {field: value if value in ids else None for field, ids in valid_ids.items() if (value := getattr(plan, field)) is not None}
    names = {row["name"] for row in catalog["metadata"] if row.get("name")}
    updates["metadata"] = [item for item in plan.metadata if item.field in names]
    return plan.model_copy(update=updates)


def search_params(plan: SearchPlan, page: int = 1) -> dict[str, str | int]:
    params: dict[str, str | int] = {"page": page, "_match_all": "yes"}
    if plan.keywords:
        params["q"] = plan.keywords
    if plan.document_type_id:
        params["document_type__id"] = f"={plan.document_type_id}"
    if plan.tag_id:
        params["tags__id"] = f"={plan.tag_id}"
    if plan.cabinet_id:
        params["cabinets__id"] = f"={plan.cabinet_id}"
    if plan.created_from and plan.created_to:
        params["datetime_created"] = f"[]{datetime.combine(plan.created_from, time.min).isoformat()}..{datetime.combine(plan.created_to, time.max).isoformat()}"
    elif plan.created_from:
        params["datetime_created"] = f">={datetime.combine(plan.created_from, time.min).isoformat()}"
    elif plan.created_to:
        params["datetime_created"] = f"<={datetime.combine(plan.created_to, time.max).isoformat()}"
    scopes: list[str] = []
    for index, item in enumerate(plan.metadata):
        params[f"__{index}_metadata__metadata_type__name"] = f"={item.field}"
        params[f"__{index}_metadata__value"] = item.value
        scopes.append(str(index))
    while len(scopes) > 1:
        left, right = scopes.pop(0), scopes.pop(0)
        combined = f"{left}{right}"
        params[f"__operator_{left}_{right}"] = f"AND_{combined}"
        scopes.insert(0, combined)
    if scopes:
        params["__result"] = scopes[0]
    return params


def interpretation(plan: SearchPlan, catalog: dict[str, list[dict]]) -> list[str]:
    values: list[str] = []
    if plan.keywords:
        values.append(f'Keywords: “{plan.keywords}”')
    for field, collection, prefix in (("document_type_id", "document_types", "Type"), ("tag_id", "tags", "Tag"), ("cabinet_id", "cabinets", "Cabinet")):
        selected = getattr(plan, field)
        row = next((item for item in catalog[collection] if item["id"] == selected), None)
        if row:
            values.append(f"{prefix}: {row['label']}")
    if plan.created_from or plan.created_to:
        values.append(f"Created: {plan.created_from or 'any'} to {plan.created_to or 'any'}")
    labels = {row["name"]: row["label"] for row in catalog["metadata"]}
    values.extend(f"{labels.get(item.field, item.field)}: {item.value}" for item in plan.metadata)
    return values or ["All accessible records"]


async def execute_search(request: Request, plan: SearchPlan, page_number: int) -> SearchPageResponse:
    settings, headers = upstream_access(request)
    async with httpx.AsyncClient(timeout=settings.request_timeout, follow_redirects=False) as client:
        try:
            response = await client.get(
                str(settings.mayan_api_url).rstrip("/") + "/search/documents.documentsearchresult/",
                params=search_params(plan, page_number), headers={**headers, "Accept": "application/json"},
            )
        except httpx.HTTPError:
            raise HTTPException(503, "The archive search service is unavailable. Please try again.") from None
    if response.status_code == 400:
        raise HTTPException(422, "These search filters could not be applied. Refine the request and try again.")
    check_upstream(request, response.status_code)
    try:
        page = UpstreamPage.model_validate(response.json())
    except (ValueError, ValidationError):
        raise HTTPException(502, "The archive search service returned an unexpected response.") from None
    return SearchPageResponse(
        count=page.count, page=page_number,
        next_page=page_number + 1 if page.next else None,
        previous_page=page_number - 1 if page.previous and page_number > 1 else None,
        results=[SearchResult.model_validate(item.model_dump()) for item in page.results],
    )


@router.post("", response_model=SmartSearchResponse, dependencies=[Depends(trusted_origin), Depends(require_write)])
async def smart_search(request: Request, body: SmartSearchRequest):
    settings, _ = upstream_access(request)
    session = store_for(request).get(request.cookies.get(COOKIE_NAME))
    catalog = await catalog_for(request)
    mode: Literal["ai", "standard"] = "standard"
    warning = ""
    if provider_ready(settings):
        if not store_for(request).allow_ai_search(session.username, settings.ai_searches_per_minute, settings.ai_searches_per_day):
            raise HTTPException(429, "Smart search limit reached. Refine your existing results or try again later.")
        try:
            plan = await ai_plan(settings, body.query.strip(), catalog)
            mode = "ai"
        except (httpx.HTTPError, RuntimeError):
            plan = standard_plan(body.query.strip(), catalog)
            warning = "AI interpretation is temporarily unavailable; a standard archive search was used."
    else:
        plan = standard_plan(body.query.strip(), catalog)
        warning = "AI setup is pending; recognizable filters and keywords were applied."
    plan = validate_catalog_plan(plan, catalog)
    page = await execute_search(request, plan, 1)
    return SmartSearchResponse(
        mode=mode, warning=warning, plan=plan, interpretation=interpretation(plan, catalog),
        **page.model_dump(),
    )


@router.post("/page", response_model=SearchPageResponse, dependencies=[Depends(trusted_origin), Depends(require_write)])
async def smart_search_page(request: Request, body: SearchPageRequest):
    """Page an already validated plan without another paid provider request."""
    catalog = await catalog_for(request)
    plan = validate_catalog_plan(body.plan, catalog)
    return await execute_search(request, plan, body.page)
