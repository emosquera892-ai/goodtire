from django.core.cache import cache
from rest_framework.test import APITestCase

from . import asignacion, transbordo, transporte


class SensibilidadTiposTests(APITestCase):
    def setUp(self):
        cache.clear()

    def analizar(self, tipo, datos):
        return self.client.post(f"/api/problemas/{tipo}/sensibilidad", datos, format="json")

    def test_transporte(self):
        r = self.analizar("transporte", transporte.EJEMPLO)
        self.assertEqual(r.status_code, 200, r.content)
        d = r.json()
        self.assertEqual(d["base"]["costo_total"], 1020)
        esc = {e["parametro"]: {v["pct"]: v for v in e["variaciones"]} for e in d["escenarios"]}
        # costos uniformes ±: mismo plan, costo proporcional
        self.assertAlmostEqual(esc["costos"][10]["cambio_pct"], 10.0)
        self.assertFalse(any(v["cambia_decision"] for v in esc["costos"].values()))
        # demanda +10 %: la oferta no alcanza
        self.assertFalse(esc["demanda"][10]["factible"])
        self.assertIn("Faltan", esc["demanda"][10]["nota"])
        self.assertEqual(len(d["alternativas"]), 6)
        self.assertTrue(all(a["cambio"] >= 0 for a in d["alternativas"] if a["factible"]))

    def test_transbordo(self):
        d = self.analizar("transbordo", transbordo.EJEMPLO).json()
        self.assertEqual(d["base"]["costo_total"], 5800)
        self.assertEqual([e["parametro"] for e in d["escenarios"]], ["costos", "oferta", "demanda"])  # sin capacidad: no hay intermedios con tope
        self.assertTrue(d["alternativas"])
        self.assertTrue(all("→" in a["etiqueta"] for a in d["alternativas"]))

    def test_asignacion(self):
        d = self.analizar("asignacion", asignacion.EJEMPLO).json()
        self.assertEqual(d["base"]["costo_total"], 15)
        self.assertEqual(d["escenarios"], [])
        alt = {a["etiqueta"]: a for a in d["alternativas"]}
        self.assertEqual(len(alt), 4)
        a = alt["Máquina 1 → Trabajo 2"]
        self.assertEqual(a["costo_actual"], 5)
        self.assertEqual(a["costo_total"], 16)
        self.assertEqual(a["limite"], 6)  # con costo 6 empata; más de 6 cambia la asignación
        self.assertTrue(any("frágil" in f for f in d["lectura"]))

    def test_errores(self):
        self.assertEqual(self.analizar("transporte", {"origenes": []}).status_code, 422)
        self.assertEqual(self.analizar("nada", {}).status_code, 404)
