from django.urls import include, path
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views
from .casos import CasoViewSet, LoginView, RegistroView

router = SimpleRouter(trailing_slash=False)
router.register("casos", CasoViewSet, basename="caso")

urlpatterns = [
    path("salud", views.salud),
    path("reglas", views.reglas),
    path("ejemplo", views.ejemplo),
    path("resolver", views.ResolverView.as_view()),
    path("auth/registro", RegistroView.as_view()),
    path("auth/token", LoginView.as_view()),
    path("auth/token/refresh", TokenRefreshView.as_view()),
    path("", include(router.urls)),
]
