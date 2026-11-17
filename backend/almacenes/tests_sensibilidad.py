from django.core.cache import cache
from rest_framework.test import APITestCase

from .views import EJEMPLO_GOOD_TIRE


class SensibilidadTests(APITestCase):
    def setUp(self):
        cache.clear()

    def analizar(self, datos=None):
        return self.client.post("/api/problemas/ubicacion/sensibilidad", datos or EJEMPLO_GOOD_TIRE, format="json")

    def test_caso_good_tire(self):
        r = self.analizar()
        self.assertEqual(r.status_code, 200, r.content)
        d = r.json()
        self.assertEqual(d["base"]["costo_total"], 422540)
        self.assertEqual(sorted(d["base"]["abiertos"]), ["Chicago", "Cleveland", "Louisville", "Trenton"])
        self.assertFalse(d["incompleto"])
        self.assertEqual([e["parametro"] for e in d["escenarios"]], ["costo_fijo", "transporte", "demanda", "capacidad"])
        for e in d["escenarios"]:
            self.assertEqual([v["pct"] for v in e["variaciones"]], [-30, -20, -10, 10, 20, 30])

    def test_resultados_conocidos(self):
        d = self.analizar().json()
        esc = {e["parametro"]: {v["pct"]: v for v in e["variaciones"]} for e in d["escenarios"]}
        # costos fijos -30 %: conviene abrir los 5 almacenes
        self.assertTrue(esc["costo_fijo"][-30]["cambia_decision"])
        self.assertFalse(esc["costo_fijo"][10]["cambia_decision"])
        # el transporte más caro o barato no cambia la decisión
        self.assertFalse(any(v["cambia_decision"] for v in esc["transporte"].values()))
        # demanda +30 %: supera la capacidad total
        self.assertFalse(esc["demanda"][30]["factible"])
        # más demanda siempre cuesta más
        self.assertGreater(esc["demanda"][10]["costo_total"], 422540)

    def test_forzar_almacenes(self):
        d = self.analizar().json()
        alm = {a["almacen"]: a for a in d["almacenes"]}
        self.assertEqual(alm["Harrisburg"]["accion"], "abrir")
        self.assertGreater(alm["Harrisburg"]["cambio"], 0)
        self.assertEqual(alm["Louisville"]["accion"], "cerrar")
        self.assertTrue(alm["Louisville"]["factible"])
        # sin Cleveland (capacidad 80) no alcanza a cubrir la demanda
        self.assertFalse(alm["Cleveland"]["factible"])
        self.assertTrue(any("indispensable" in f for f in d["lectura"]))

    def test_datos_invalidos(self):
        malo = {**EJEMPLO_GOOD_TIRE, "demanda": [1]}
        self.assertEqual(self.analizar(malo).status_code, 422)
