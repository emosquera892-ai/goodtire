from django.urls import include, path
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views
from .casos import CasoViewSet, LoginView, RegistroView
from .cuentas import RecuperarView, RestablecerView

router = SimpleRouter(trailing_slash=False)
router.register("casos", CasoViewSet, basename="caso")

urlpatterns = [
    path("salud", views.salud),
    path("reglas", views.reglas),
    path("ejemplo", views.ejemplo),
    path("resolver", views.ResolverView.as_view()),
    path("problemas/simplex/ejemplo", views.ejemplo_simplex),
    path("problemas/simplex/resolver", views.ResolverSimplexView.as_view()),
    path("problemas/<str:tipo>/ejemplo", views.ejemplo_tipo),
    path("problemas/<str:tipo>/resolver", views.ResolverTipoView.as_view()),
    path("problemas/transporte/pasos", views.PasosTransporteView.as_view()),
    path("problemas/ubicacion/pasos", views.PasosUbicacionView.as_view()),
    path("problemas/asignacion/pasos", views.PasosAsignacionView.as_view()),
    path("problemas/transbordo/pasos", views.PasosTransbordoView.as_view()),
    path("auth/registro", RegistroView.as_view()),
    path("auth/recuperar", RecuperarView.as_view()),
    path("auth/restablecer", RestablecerView.as_view()),
    path("auth/token", LoginView.as_view()),
    path("auth/token/refresh", TokenRefreshView.as_view()),
    path("", include(router.urls)),
]
