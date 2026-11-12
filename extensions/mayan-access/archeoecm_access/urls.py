from django.urls import path
from .views import DocumentAccessView

urlpatterns = []
api_urls = [path('archeoecm/documents/<int:document_id>/access/', DocumentAccessView.as_view())]
