from unittest import mock

from django.core.cache import cache
from rest_framework.test import APITestCase


class BaseAuth(APITestCase):
    def setUp(self):
        cache.clear()
        self.ej = self.client.get("/api/ejemplo").json()

    def registrar(self, usuario, password="Clave-segura-123"):
        r = self.client.post("/api/auth/registro", {"username": usuario, "email": f"{usuario}@ejemplo.com", "password": password}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        t = self.client.post("/api/auth/token", {"username": usuario, "password": password}, format="json")
        self.assertEqual(t.status_code, 200, t.content)
        return t.json()["access"]

    def como(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def anonimo(self):
        self.client.credentials()


class UsuariosTests(BaseAuth):
    def test_registro_y_login(self):
        token = self.registrar("ana")
        self.assertTrue(token)

    def test_registro_rechaza_password_debil_o_corto(self):
        for pwd in ["12345678", "abc", "password"]:
            r = self.client.post("/api/auth/registro", {"username": "x" + pwd, "email": f"x{pwd}@ejemplo.com", "password": pwd}, format="json")
            self.assertEqual(r.status_code, 400, pwd)

    def test_registro_rechaza_usuario_duplicado(self):
        self.registrar("ana")
        r = self.client.post("/api/auth/registro", {"username": "ana", "email": "otra@ejemplo.com", "password": "Otra-clave-456"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_login_con_credenciales_malas(self):
        self.registrar("ana")
        r = self.client.post("/api/auth/token", {"username": "ana", "password": "incorrecta"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_casos_exige_login(self):
        self.assertEqual(self.client.get("/api/casos").status_code, 401)
        self.assertEqual(self.client.post("/api/casos", {}, format="json").status_code, 401)

    def test_resolver_sigue_siendo_publico(self):
        r = self.client.post("/api/resolver", self.ej, format="json")
        self.assertEqual(r.status_code, 200)


class CasosTests(BaseAuth):
    def crear(self, nombre="Caso 1", datos=None):
        return self.client.post("/api/casos", {"nombre": nombre, "datos": datos or self.ej}, format="json")

    def test_crear_y_leer_caso(self):
        self.como(self.registrar("ana"))
        r = self.crear()
        self.assertEqual(r.status_code, 201, r.content)
        j = r.json()
        self.assertEqual(j["costo_total"], 422540.0)
        self.assertEqual(j["resultado"]["almacenes_abiertos"], ["Cleveland", "Chicago", "Trenton", "Louisville"])
        detalle = self.client.get(f"/api/casos/{j['id']}").json()
        self.assertEqual(detalle["nombre"], "Caso 1")

    def test_lista_paginada_y_resumida(self):
        self.como(self.registrar("ana"))
        self.crear("A")
        self.crear("B")
        j = self.client.get("/api/casos").json()
        self.assertEqual(j["count"], 2)
        self.assertNotIn("datos", j["results"][0])
        self.assertIn("almacenes_abiertos", j["results"][0])

    def test_datos_invalidos_no_se_guardan(self):
        self.como(self.registrar("ana"))
        malos = {**self.ej, "demanda": [-1] + self.ej["demanda"][1:]}
        r = self.crear(datos=malos)
        self.assertEqual(r.status_code, 400)
        self.assertIn("datos", r.json())
        self.assertEqual(self.client.get("/api/casos").json()["count"], 0)

    def test_aislamiento_entre_usuarios(self):
        self.como(self.registrar("ana"))
        cid = self.crear().json()["id"]
        self.como(self.registrar("beto"))
        self.assertEqual(self.client.get("/api/casos").json()["count"], 0)
        self.assertEqual(self.client.get(f"/api/casos/{cid}").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/casos/{cid}").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/casos/{cid}", {"nombre": "hack"}, format="json").status_code, 404)
        self.assertEqual(self.client.post(f"/api/casos/{cid}/duplicar").status_code, 404)

    def test_renombrar_no_vuelve_a_resolver(self):
        self.como(self.registrar("ana"))
        cid = self.crear().json()["id"]
        r = self.client.patch(f"/api/casos/{cid}", {"nombre": "Nuevo"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["nombre"], "Nuevo")
        self.assertEqual(r.json()["costo_total"], 422540.0)

    def test_editar_datos_recalcula(self):
        self.como(self.registrar("ana"))
        cid = self.crear().json()["id"]
        nuevos = {**self.ej, "forzar_abiertos": self.ej["almacenes"]}
        r = self.client.patch(f"/api/casos/{cid}", {"datos": nuevos}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["costo_total"], 427850.0)

    def test_usuario_no_puede_forzar_resultado(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"nombre": "X", "datos": self.ej, "costo_total": 1, "resultado": {"a": 1}}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["costo_total"], 422540.0)
        self.assertIn("almacenes_abiertos", r.json()["resultado"])

    def test_duplicar_y_borrar(self):
        self.como(self.registrar("ana"))
        cid = self.crear("Original").json()["id"]
        d = self.client.post(f"/api/casos/{cid}/duplicar")
        self.assertEqual(d.status_code, 201)
        self.assertEqual(d.json()["nombre"], "Original (copia)")
        self.assertEqual(self.client.get("/api/casos").json()["count"], 2)
        self.assertEqual(self.client.delete(f"/api/casos/{cid}").status_code, 204)
        self.assertEqual(self.client.get(f"/api/casos/{cid}").status_code, 404)

    def test_limite_de_casos_por_usuario(self):
        self.como(self.registrar("ana"))
        with mock.patch("almacenes.casos.MAX_CASOS_POR_USUARIO", 2):
            self.assertEqual(self.crear("1").status_code, 201)
            self.assertEqual(self.crear("2").status_code, 201)
            self.assertEqual(self.crear("3").status_code, 400)
