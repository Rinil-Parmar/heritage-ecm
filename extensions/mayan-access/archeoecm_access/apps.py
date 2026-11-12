from mayan.apps.app_manager.apps import MayanAppConfig


class ArcheoECMAccessApp(MayanAppConfig):
    name = 'archeoecm_access'
    app_namespace = 'archeoecm_access'
    app_url = 'archeoecm-access'
    has_rest_api = True
    verbose_name = 'ArcheoECM access'
