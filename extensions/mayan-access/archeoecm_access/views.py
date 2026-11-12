from django.apps import apps
from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from mayan.apps.acls.models import AccessControlList
from mayan.apps.permissions.classes import Permission


def allowed(user, obj, identifier):
    try:
        AccessControlList.objects.check_access(
            obj=obj, permission=Permission.get(pk=identifier), user=user
        )
        return True
    except (PermissionDenied, KeyError):
        return False


class DocumentAccessView(APIView):
    """Only the authenticated caller's access; never arbitrary user impersonation."""
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'head', 'options']

    def get(self, request, document_id):
        Document = apps.get_model('documents', 'Document')
        document = get_object_or_404(AccessControlList.objects.restrict_queryset(
            permission=Permission.get(pk='documents.document_view'),
            queryset=Document.valid.all(), user=request.user
        ), pk=document_id)
        checks = {
            'edit_details': ['documents.document_properties_edit'],
            'edit_metadata': ['metadata.metadata_document_add', 'metadata.metadata_document_edit', 'metadata.metadata_document_remove'],
            'upload_version': ['documents.document_file_new'],
            'add_comment': ['comments.comment_create'],
            'download': ['document_downloads.document_file_download'],
        }
        result = {key: all(allowed(request.user, document, permission) for permission in permissions)
                  for key, permissions in checks.items()}
        # A bounded ID list is returned, not role names, ACLs, or other users.
        for kind, model, view_permission, add_permission, remove_permission in [
            ('tags', apps.get_model('tags', 'Tag'), 'tags.tag_view', 'tags.tag_attach', 'tags.tag_remove'),
            ('cabinets', apps.get_model('cabinets', 'Cabinet'), 'cabinets.cabinet_view', 'cabinets.cabinet_add_document', 'cabinets.cabinet_remove_document'),
        ]:
            visible = AccessControlList.objects.restrict_queryset(
                permission=Permission.get(pk=view_permission), queryset=model.objects.all(), user=request.user)
            for action, permission in [('add', add_permission), ('remove', remove_permission)]:
                permitted = AccessControlList.objects.restrict_queryset(
                    permission=Permission.get(pk=permission), queryset=visible, user=request.user)
                ids = list(permitted.order_by('pk').values_list('pk', flat=True)[:5001])
                if len(ids) > 5000:
                    return Response({'detail': 'Too many organization targets for access evaluation.'}, status=503)
                if not allowed(request.user, document, permission):
                    ids = []
                result[f'{kind}_{action}'] = ids
        return Response({'schema_version': 1, **result}, headers={'Cache-Control': 'no-store'})
