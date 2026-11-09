from django.core.cache import cache

from .models import Caso
from .tests_casos import BaseAuth


class CompartirTests(BaseAuth):
    def setUp(self):
        super().setUp()
        self.ana = self.registrar("ana")
        self.beto = self.registrar("beto")
        self.como(self.ana)
        self.caso = self.client.post("/api/casos", {"nombre": "Mi caso", "datos": self.ej}, format="json").json()

    def compartir(self):
        r = self.client.post(f"/api/casos/{self.caso['id']}/compartir")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["token"]

    def test_no_compartido_por_defecto(self):
        self.assertIsNone(self.caso["token_publico"])
        self.assertEqual(self.client.get("/api/compartido/abcdefghijklmnop").status_code, 404)

    def test_compartir_y_ver_sin_sesion(self):
        token = self.compartir()
        self.assertEqual(self.compartir(), token)  # idempotente
        self.anonimo()
        r = self.client.get(f"/api/compartido/{token}")
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d["nombre"], "Mi caso")
        self.assertEqual(d["tipo"], "ubicacion")
        self.assertIn("almacenes_abiertos", d["resultado"])
        self.assertNotIn("usuario", d)
        self.assertEqual(r["X-Robots-Tag"], "noindex, nofollow")

    def test_se_ve_el_estado_actual_y_el_resumen_trae_el_token(self):
        token = self.compartir()
        self.client.patch(f"/api/casos/{self.caso['id']}", {"nombre": "Nuevo nombre"}, format="json")
        lista = self.client.get("/api/casos").json()["results"]
        self.assertEqual(lista[0]["token_publico"], token)
        self.anonimo()
        self.assertEqual(self.client.get(f"/api/compartido/{token}").json()["nombre"], "Nuevo nombre")

    def test_dejar_de_compartir_invalida_el_enlace(self):
        token = self.compartir()
        r = self.client.delete(f"/api/casos/{self.caso['id']}/compartir")
        self.assertEqual(r.status_code, 204)
        self.anonimo()
        self.assertEqual(self.client.get(f"/api/compartido/{token}").status_code, 404)
        self.como(self.ana)
        self.assertNotEqual(self.compartir(), token)  # al volver a compartir, enlace nuevo

    def test_solo_el_dueno_comparte(self):
        self.como(self.beto)
        self.assertEqual(self.client.post(f"/api/casos/{self.caso['id']}/compartir").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/casos/{self.caso['id']}/compartir").status_code, 404)
        self.anonimo()
        self.assertEqual(self.client.post(f"/api/casos/{self.caso['id']}/compartir").status_code, 401)

    def test_token_malformado_da_404(self):
        for t in ["corto", "con espacios largos aqui", "a" * 80, "ñandú-ñandú-ñandú"]:
            self.assertEqual(self.client.get(f"/api/compartido/{t}").status_code, 404, t)

    def test_duplicar_no_copia_el_enlace(self):
        self.compartir()
        copia = self.client.post(f"/api/casos/{self.caso['id']}/duplicar").json()
        self.assertIsNone(copia["token_publico"])

    def test_copiar_a_mi_cuenta(self):
        token = self.compartir()
        self.anonimo()
        self.assertEqual(self.client.post(f"/api/compartido/{token}/copiar").status_code, 401)
        self.como(self.beto)
        r = self.client.post(f"/api/compartido/{token}/copiar")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["nombre"], "Mi caso (copia)")
        self.assertIsNone(r.json()["token_publico"])
        self.assertEqual(self.client.get("/api/casos").json()["count"], 1)
        # el original sigue siendo de ana
        self.assertEqual(Caso.objects.filter(nombre="Mi caso").count(), 1)

    def test_cada_enlace_es_distinto(self):
        otro = self.client.post("/api/casos", {"nombre": "Otro", "datos": self.ej}, format="json").json()
        t1 = self.compartir()
        t2 = self.client.post(f"/api/casos/{otro['id']}/compartir").json()["token"]
        self.assertNotEqual(t1, t2)
        self.assertGreaterEqual(len(t1), 20)
