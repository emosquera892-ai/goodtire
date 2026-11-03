from django.contrib import admin
from .models import Caso


@admin.register(Caso)
class CasoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "usuario", "costo_total", "actualizado")
    list_filter = ("usuario",)
    search_fields = ("nombre", "usuario__username")
    readonly_fields = ("creado", "actualizado")
