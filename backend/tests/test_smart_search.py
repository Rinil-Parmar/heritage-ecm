import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

import httpx

from app.sessions import SessionStore
import app.smart_search as smart_search_module
from app.smart_search import (
    MetadataCriterion, SearchPlan, execute_search, response_text, search_params,
    standard_plan, validate_catalog_plan,
)


CATALOG = {
    "document_types": [{"id": 7, "label": "Excavation Report"}],
    "tags": [{"id": 9, "label": "Needs Review"}],
    "cabinets": [{"id": 11, "label": "Archaeology / Site A"}],
    "metadata": [{"name": "country", "label": "Country"}],
}


def test_standard_plan_recognizes_catalog_and_year_range():
    plan = standard_plan(
        "Find Excavation Report records tagged Needs Review from 2023 to 2025 in Archaeology / Site A",
        CATALOG,
    )
    assert plan.created_from == date(2023, 1, 1)
    assert plan.created_to == date(2025, 12, 31)
    assert plan.document_type_id == 7
    assert plan.tag_id == 9
    assert plan.cabinet_id == 11
    assert "Needs Review" not in plan.keywords
    assert "Excavation Report" not in plan.keywords


def test_standard_plan_preserves_subject_terms_for_mayan_full_text():
    plan = standard_plan("Find documents that mention blue stone", CATALOG)
    assert plan.keywords == "blue stone"
    assert search_params(plan)["q"] == "blue stone"


def test_exact_phrase_quotes_only_the_mayan_content_query():
    plan = standard_plan(
        "Find documents that mention blue stone from Canada",
        CATALOG,
        content_mode="exact_phrase",
    )
    params = search_params(plan)
    assert params["q"] == '"blue stone"'
    assert params["__1_metadata__metadata_type__name"] == "=country"
    assert params["__1_metadata__value"] == "Canada"
    assert params["__operator_0_1"] == "AND_01"
    assert params["__result"] == "01"


def test_from_trench_is_content_not_a_country_filter():
    plan = standard_plan("ceramic assemblage from trench", CATALOG)
    assert plan.metadata == []
    assert plan.keywords == "ceramic assemblage trench"
    assert search_params(plan)["q"] == "ceramic assemblage trench"


def test_untrusted_plan_values_are_removed_before_search():
    plan = SearchPlan(
        document_type_id=999, tag_id=9, cabinet_id=998,
        metadata=[MetadataCriterion(field="invented", value="x"), MetadataCriterion(field="country", value="Canada")],
    )
    safe = validate_catalog_plan(plan, CATALOG)
    assert safe.document_type_id is None
    assert safe.tag_id == 9
    assert safe.cabinet_id is None
    assert safe.metadata == [MetadataCriterion(field="country", value="Canada")]


def test_search_params_scope_metadata_and_dates():
    plan = SearchPlan(
        created_from=date(2024, 1, 1), created_to=date(2024, 12, 31),
        metadata=[MetadataCriterion(field="country", value="Canada")],
    )
    params = search_params(plan, 3)
    assert params["page"] == 3
    assert params["__0_metadata__metadata_type__name"] == "=country"
    assert params["__0_metadata__value"] == "Canada"
    assert params["__result"] == "0"
    assert str(params["datetime_created"]).startswith("[]2024-01-01")


def test_structured_response_extraction_and_rate_limit():
    assert response_text({"output": [{"type": "message", "content": [{"type": "output_text", "text": "{}"}]}]}) == "{}"
    store = SessionStore()
    assert store.allow_ai_search("researcher", 1, 2)
    assert not store.allow_ai_search("researcher", 1, 2)


def test_execute_search_calls_mayan_and_maps_an_authorized_result():
    """Exercise the complete Mayan search request without a live university VM."""
    captured: dict = {}

    def upstream_access(_request):
        settings = SimpleNamespace(
            request_timeout=10,
            mayan_api_url="https://archive.example/api/v4/",
        )
        return settings, {"Authorization": "Token session-secret"}

    response_payload = {
                "count": 1,
                "next": "https://archive.example/api/v4/search/documents.documentsearchresult/?page=3",
                "previous": "https://archive.example/api/v4/search/documents.documentsearchresult/?page=1",
                "results": [
                    {
                        "id": 42,
                        "label": "Blue Stone Excavation Report",
                        "description": "Field notes mentioning a blue stone fragment.",
                        "datetime_created": "2026-11-25T14:30:00Z",
                        "document_type": {"id": 7, "label": "Excavation Report"},
                        "language": "eng",
                    }
                ],
            }

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json():
            return response_payload

    class FakeMayanClient:
        def __init__(self, **kwargs):
            captured["client_options"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, *, params, headers):
            captured["url"] = url
            captured["params"] = params
            captured["authorization"] = headers.get("Authorization")
            captured["accept"] = headers.get("Accept")
            return FakeResponse()

    plan = SearchPlan(keywords="blue stone", content_mode="exact_phrase")
    isolated_httpx = SimpleNamespace(AsyncClient=FakeMayanClient, HTTPError=httpx.HTTPError)
    with patch.object(smart_search_module, "upstream_access", upstream_access), patch.object(
        smart_search_module, "httpx", isolated_httpx
    ):
        result = asyncio.run(execute_search(object(), plan, 2))

    assert captured["url"] == "https://archive.example/api/v4/search/documents.documentsearchresult/"
    assert captured["params"]["page"] == 2
    assert captured["params"]["q"] == '"blue stone"'
    assert captured["authorization"] == "Token session-secret"
    assert captured["accept"] == "application/json"
    assert result.count == 1
    assert result.next_page == 3
    assert result.previous_page == 1
    assert result.results[0].id == 42
    assert result.results[0].label == "Blue Stone Excavation Report"
