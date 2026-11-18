import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location("configure_access", ROOT / "configure_access.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.policy = json.loads((ROOT / "roles.json").read_text())

    def test_five_roles_and_no_system_privilege_escalation(self):
        entries = module.validate_policy(self.policy)
        self.assertEqual(len(entries), 5)
        self.assertEqual(entries[0]["permissions"], [])

    def test_document_global_grant_rejected(self):
        self.policy["roles"][-1]["permissions"].append("View documents")
        with self.assertRaises(ValueError):
            module.validate_policy(self.policy)

    def test_duplicate_role_or_group_rejected(self):
        for key in ("name", "group"):
            policy = copy.deepcopy(self.policy)
            policy["roles"][1][key] = policy["roles"][0][key]
            with self.assertRaises(ValueError):
                module.validate_policy(policy)

    def test_unknown_missing_and_ambiguous_permission_fail_closed(self):
        with self.assertRaises(ValueError):
            module.resolve_permissions(["View tags"], [])
        with self.assertRaises(ValueError):
            module.resolve_permissions(["View tags"], [{"label": "View tags"}, {"label": "View tags"}])
        with self.assertRaises(ValueError):
            module.resolve_permissions(["View tags"], [{"label": "View tags and edit"}])

    def test_explicit_alias_only(self):
        self.assertEqual(module.resolve_permissions(["Create new tags"], [{"label": "Create tags", "id": "installed.id"}])[0]["id"], "installed.id")

    def test_rerun_has_no_permission_additions(self):
        self.assertEqual(module.permission_delta(["a", "b"], ["b", "a"]), [])

    def test_preexisting_broad_role_rejected(self):
        with self.assertRaises(ValueError):
            module.permission_delta(["view"], ["view", "manage_roles"])

    def test_viewer_exact_eight_removals_preserve_navigation(self):
        viewer = module.validate_policy(self.policy)[-1]
        removals = viewer["remove_permissions"]
        self.assertEqual(len(removals), 8)
        retained = ["documents_types.document_type_view", "tags.tag_view"]
        additions, removed = module.permission_changes(
            retained + ["search.id"], retained + removals, removals
        )
        self.assertEqual(additions, ["search.id"])
        self.assertEqual(removed, sorted(removals))

    def test_removal_rerun_is_noop(self):
        self.assertEqual(module.permission_changes(["view"], ["view"], ["old"]), ([], []))

    def test_unapproved_removal_in_policy_rejected(self):
        self.policy["roles"][-1]["remove_permissions"].append("tags.tag_view")
        with self.assertRaises(ValueError):
            module.validate_policy(self.policy)

    def test_removal_cannot_be_applied_to_other_role(self):
        self.policy["roles"][1]["remove_permissions"] = ["documents.document_view"]
        with self.assertRaises(ValueError):
            module.validate_policy(self.policy)

    def test_additional_unapproved_grant_still_blocks(self):
        with self.assertRaises(ValueError):
            module.permission_changes(["view"], ["view", "old", "manage_roles"], ["old"])

    def test_conflicting_add_and_remove_rejected(self):
        with self.assertRaises(ValueError):
            module.permission_changes(["view"], ["view"], ["view"])


class MethodCompatibilityTests(unittest.TestCase):
    def test_mayan_user_argument_avoids_missing_request_user(self):
        class MixinRole:
            def change(self, queryset, user=None):
                self.received = (queryset, user or self.user)

        role, actor, queryset = MixinRole(), object(), object()
        module.role_method(role, "change", queryset, actor)
        self.assertFalse(hasattr(role, "received"))
        module.role_method(role, "change", queryset, actor, execute=True)
        self.assertEqual(role.received, (queryset, actor))

    def test_queryset_only_and_actor_keyword_signatures(self):
        class CurrentRole:
            def change(self, queryset):
                self.received = (queryset, self._event_actor)

        class LegacyRole:
            def change(self, queryset, _event_actor=None):
                self.received = (queryset, _event_actor)

        for role in (CurrentRole(), LegacyRole()):
            with self.subTest(role=type(role).__name__):
                actor, queryset = object(), object()
                module.role_method(role, "change", queryset, actor)
                self.assertFalse(hasattr(role, "received"))
                self.assertFalse(hasattr(role, "_event_actor"))
                module.role_method(role, "change", queryset, actor, execute=True)
                self.assertEqual(role.received, (queryset, actor))

    def test_unsupported_signature_fails_before_execution(self):
        class UnsupportedRole:
            def change(self, queryset, required_argument):
                raise AssertionError("Must not execute")

        role = UnsupportedRole()
        with self.assertRaises(TypeError):
            module.role_method(role, "change", [], object(), execute=True)
        self.assertFalse(hasattr(role, "_event_actor"))

    def test_method_error_is_not_retried(self):
        class FailingRole:
            calls = 0

            def change(self, queryset):
                self.calls += 1
                raise TypeError("Internal method failure")

        role = FailingRole()
        with self.assertRaisesRegex(TypeError, "Internal method failure"):
            module.role_method(role, "change", [], object(), execute=True)
        self.assertEqual(role.calls, 1)


if __name__ == "__main__":
    unittest.main()
