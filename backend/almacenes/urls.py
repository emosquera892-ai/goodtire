from django.urls import path
from . import views

urlpatterns = [
    path("salud", views.salud),
    path("reglas", views.reglas),
    path("ejemplo", views.ejemplo),
    path("resolver", views.ResolverView.as_view()),
]
