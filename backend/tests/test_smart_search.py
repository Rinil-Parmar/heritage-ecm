from datetime import date

from app.sessions import SessionStore
from app.smart_search import (
    MetadataCriterion, SearchPlan, response_text, search_params,
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
