from django.conf import settings
from django.db import models


class Caso(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="casos"
    )
    tipo = models.CharField(max_length=20, default="ubicacion")
    nombre = models.CharField(max_length=120)
    datos = models.JSONField()
    resultado = models.JSONField(null=True, blank=True)
    costo_total = models.DecimalField(max_digits=30, decimal_places=2, null=True, blank=True)
    # Código secreto del enlace público de solo lectura (None = no compartido)
    token_publico = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-actualizado", "-id"]

    def __str__(self):
        return f"{self.nombre} ({self.usuario})"
