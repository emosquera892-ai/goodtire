from django.core.cache import cache
from rest_framework.test import APITestCase


class ResolverTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.ej = self.client.get("/api/ejemplo").json()

    def test_salud_y_reglas(self):
        self.assertEqual(self.client.get("/api/salud").json(), {"ok": True})
        self.assertIn("limites", self.client.get("/api/reglas").json())

    def test_caso_good_tire_optimo(self):
        r = self.client.post("/api/resolver", self.ej, format="json")
        self.assertEqual(r.status_code, 200)
        j = r.json()
        self.assertEqual(j["almacenes_abiertos"], ["Cleveland", "Chicago", "Trenton", "Louisville"])
        self.assertEqual(j["costo_total"], 422540.0)
        self.assertEqual(j["costo_fijo_total"], 115000.0)

    def test_cinco_almacenes_coincide_con_el_libro(self):
        datos = {**self.ej, "forzar_abiertos": self.ej["almacenes"]}
        j = self.client.post("/api/resolver", datos, format="json").json()
        self.assertEqual(j["costo_transporte_total"], 292850.0)
        self.assertEqual(j["costo_total"], 427850.0)

    def test_comparacion_tiene_cinco_combinaciones(self):
        j = self.client.post("/api/resolver", self.ej, format="json").json()
        self.assertEqual(len(j["comparacion"]), 5)

    def test_varias_plantas_con_capacidad(self):
        datos = {
            "plantas": ["P1", "P2"],
            "almacenes": ["A1", "A2"],
            "clientes": ["C1", "C2"],
            "capacidad_plantas": [10, 10],
            "capacidad_almacenes": [20, 20],
            "costo_fijo": [100, 100],
            "demanda": [8, 8],
            "costo_planta_almacen": [[1, 5], [5, 1]],
            "costo_almacen_cliente": [[1, 5], [5, 1]],
            "factor_unidades": 1,
        }
        j = self.client.post("/api/resolver", datos, format="json").json()
        self.assertEqual(j["costo_total"], 188.0)
        self.assertEqual(len(j["detalle_plantas"]), 2)

    def test_rechaza_negativos(self):
        datos = {**self.ej, "demanda": [-1] + self.ej["demanda"][1:]}
        r = self.client.post("/api/resolver", datos, format="json")
        self.assertEqual(r.status_code, 422)
        self.assertIn("demanda.0", r.json()["detail"][0])

    def test_rechaza_capacidad_insuficiente(self):
        datos = {**self.ej, "forzar_cerrados": ["Cleveland", "Chicago"]}
        r = self.client.post("/api/resolver", datos, format="json")
        self.assertEqual(r.status_code, 422)

    def test_rechaza_nombre_inexistente_y_dimensiones(self):
        r = self.client.post("/api/resolver", {**self.ej, "forzar_abiertos": ["X"]}, format="json")
        self.assertEqual(r.status_code, 422)
        r = self.client.post("/api/resolver", {**self.ej, "demanda": [1, 2]}, format="json")
        self.assertEqual(r.status_code, 422)

    def test_infactible_por_restricciones(self):
        r = self.client.post("/api/resolver", {**self.ej, "max_almacenes": 3}, format="json")
        self.assertEqual(r.status_code, 422)

    def test_json_invalido(self):
        r = self.client.post("/api/resolver", [1, 2], format="json")
        self.assertEqual(r.status_code, 422)
