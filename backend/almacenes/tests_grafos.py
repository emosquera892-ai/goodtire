import copy

from django.core.cache import cache
from rest_framework.test import APITestCase

from .grafos import EJEMPLO
from .tests_casos import BaseAuth

FLUJO = {
    "algoritmo": "flujo",
    "nodos": ["Planta", "A", "B", "C", "D", "Cliente"],
    "aristas": [
        {"de": "Planta", "a": "A", "valor": 10},
        {"de": "Planta", "a": "B", "valor": 8},
        {"de": "A", "a": "B", "valor": 2},
        {"de": "A", "a": "C", "valor": 5},
        {"de": "A", "a": "D", "valor": 8},
        {"de": "B", "a": "D", "valor": 5},
        {"de": "C", "a": "Cliente", "valor": 7},
        {"de": "D", "a": "C", "valor": 3},
        {"de": "D", "a": "Cliente", "valor": 10},
    ],
    "origen": "Planta",
    "destino": "Cliente",
}
ARBOL = {**EJEMPLO, "algoritmo": "arbol", "origen": None, "destino": None}


class GrafosApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def resolver(self, datos):
        return self.client.post("/api/problemas/grafos/resolver", datos, format="json")

    def test_ruta_mas_corta(self):
        r = self.resolver(EJEMPLO).json()
        self.assertEqual(r["costo_total"], 450)
        self.assertEqual(r["camino"], ["Cleveland", "Detroit", "Chicago"])

    def test_ruta_dirigida_sin_camino(self):
        d = {**EJEMPLO, "dirigido": True, "origen": "Chicago", "destino": "Cleveland"}
        r = self.resolver(d).json()
        self.assertFalse(r["hay_ruta"])
        self.assertEqual(r["costo_total"], 0)

    def test_flujo_maximo(self):
        r = self.resolver(FLUJO).json()
        self.assertEqual(r["costo_total"], 15)
        for x in r["flujos"]:
            self.assertLessEqual(x["flujo"], x["capacidad"])

    def test_arbol_minimo(self):
        r = self.resolver(ARBOL).json()
        self.assertEqual(r["costo_total"], 935)
        self.assertTrue(r["conexo"])
        self.assertEqual(len(r["elegidas"]), 5)

    def test_arbol_no_conexo(self):
        d = copy.deepcopy(ARBOL)
        d["nodos"].append("Isla")
        r = self.resolver(d).json()
        self.assertFalse(r["conexo"])

    def test_validaciones(self):
        for cambio in (
            {"nodos": ["A", "A"]},
            {"origen": "Nada"},
            {"destino": "Cleveland"},
            {"aristas": []},
            {"algoritmo": "otro"},
        ):
            self.assertEqual(self.resolver({**EJEMPLO, **cambio}).status_code, 422, cambio)
        malo = copy.deepcopy(EJEMPLO)
        malo["aristas"][0]["valor"] = -1
        self.assertEqual(self.resolver(malo).status_code, 422)
        malo = copy.deepcopy(EJEMPLO)
        malo["aristas"][0]["a"] = "Cleveland"
        self.assertEqual(self.resolver(malo).status_code, 422)

    def test_ejemplo_endpoint(self):
        ej = self.client.get("/api/problemas/grafos/ejemplo").json()
        self.assertEqual(self.resolver(ej).status_code, 200)


class GrafosCasosTests(BaseAuth):
    def test_guardar_listar_compartir(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"tipo": "grafos", "nombre": "Mi red", "datos": FLUJO}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        caso = r.json()
        self.assertEqual(caso["costo_total"], 15)
        lista = self.client.get("/api/casos").json()
        fila = lista["results"][0]
        self.assertEqual(fila["tipo"], "grafos")
        self.assertIn("Flujo máximo", fila["resumen"])
        tok = self.client.post(f"/api/casos/{caso['id']}/compartir").json()["token"]
        self.client.credentials()
        pub = self.client.get(f"/api/compartido/{tok}").json()
        self.assertEqual(pub["tipo"], "grafos")
        self.assertEqual(pub["datos"]["algoritmo"], "flujo")
