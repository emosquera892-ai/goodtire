import copy
import random

from django.core.cache import cache
from rest_framework.test import APITestCase

from . import pasos_transporte, transporte
from .esquema import ErrorDatos
from .transporte import EJEMPLO


class PasosTransporteTests(APITestCase):
    def setUp(self):
        cache.clear()

    def pedir(self, datos, metodo):
        return self.client.post("/api/problemas/transporte/pasos", {"datos": datos, "metodo": metodo}, format="json")

    def test_powerco_los_tres_metodos(self):
        esperado = {"esquina_noroeste": 1180, "costo_minimo": 1080, "vogel": 1020}
        for metodo, inicial in esperado.items():
            r = self.pedir(EJEMPLO, metodo)
            self.assertEqual(r.status_code, 200)
            d = r.json()
            self.assertEqual(d["inicial"]["costo"], inicial)
            self.assertEqual(d["resultado"]["costo_total"], 1020)
            self.assertTrue(d["optimizacion"]["iteraciones"][-1]["optimo"])

    def test_metodo_invalido_y_datos_invalidos(self):
        self.assertEqual(self.pedir(EJEMPLO, "otro").status_code, 422)
        self.assertEqual(self.pedir({"x": 1}, "vogel").status_code, 422)
        self.assertEqual(self.client.post("/api/problemas/transporte/pasos", [], format="json").status_code, 422)

    def test_balanceo_con_ficticios(self):
        e = copy.deepcopy(EJEMPLO)
        e["oferta"] = [50, 50, 50]
        self.assertEqual(self.pedir(e, "vogel").json()["balanceo"]["ficticio"], "destino")
        e["oferta"] = [10, 10, 10]
        d = self.pedir(e, "vogel").json()
        self.assertEqual(d["balanceo"]["ficticio"], "origen")
        self.assertGreater(d["resultado"]["sin_cubrir"], 0)

    def test_coincide_con_el_solver_en_casos_aleatorios(self):
        rnd = random.Random(7)
        for _ in range(60):
            no, nd = rnd.randint(1, 4), rnd.randint(1, 4)
            datos = {
                "origenes": [f"o{i}" for i in range(no)],
                "destinos": [f"d{j}" for j in range(nd)],
                "oferta": [rnd.randint(0, 40) for _ in range(no)],
                "demanda": [rnd.randint(0, 40) for _ in range(nd)],
                "costos": [[rnd.randint(1, 15) if rnd.random() < 0.8 else None for _ in range(nd)] for _ in range(no)],
            }
            try:
                p = transporte.parsear(datos)
            except ErrorDatos:
                continue
            ref = transporte.resolver(p)
            for metodo in pasos_transporte.METODOS:
                r = pasos_transporte.generar(p, metodo)["resultado"]
                self.assertAlmostEqual(r["costo_total"], ref["costo_total"], places=6)
                self.assertAlmostEqual(r["sin_cubrir"], ref.get("faltante_total", 0), places=6)


class PasosUbicacionTests(APITestCase):
    def setUp(self):
        cache.clear()

    def pedir(self, datos):
        return self.client.post("/api/problemas/ubicacion/pasos", {"datos": datos}, format="json")

    def test_good_tire_coincide_con_el_solver(self):
        from .solver import resolver
        from .esquema import parsear
        from .views import EJEMPLO_GOOD_TIRE

        r = self.pedir(EJEMPLO_GOOD_TIRE)
        self.assertEqual(r.status_code, 200)
        d = r.json()
        ref = resolver(parsear(EJEMPLO_GOOD_TIRE))
        self.assertAlmostEqual(d["resultado"]["costo_total"], ref["costo_total"], places=2)
        self.assertEqual(sorted(d["resultado"]["almacenes"]), sorted(ref["almacenes_abiertos"]))
        self.assertEqual(d["resultado"]["evaluadas"] + d["resultado"]["descartadas"], 2 ** 5 - 1)
        self.assertEqual(sum(1 for e in d["evaluaciones"] if e["es_optima"]), 1)

    def test_restricciones_descartan_combinaciones(self):
        from .views import EJEMPLO_GOOD_TIRE

        e = copy.deepcopy(EJEMPLO_GOOD_TIRE)
        e["forzar_abiertos"] = ["Cleveland"]
        d = self.pedir(e).json()
        self.assertTrue(all("Cleveland" in x["almacenes"] for x in d["evaluaciones"]))
        self.assertTrue(any("debe estar abierto" in x["motivo"] for x in d["descartes"]))

    def test_demasiados_almacenes_y_datos_malos(self):
        from .views import EJEMPLO_GOOD_TIRE

        e = copy.deepcopy(EJEMPLO_GOOD_TIRE)
        for i in range(4):
            e["almacenes"].append(f"X{i}")
            e["capacidad_almacenes"].append(50)
            e["costo_fijo"].append(1000)
            e["costo_planta_almacen"][0].append(1)
            e["costo_almacen_cliente"].append([1] * len(e["clientes"]))
        self.assertEqual(self.pedir(e).status_code, 422)
        self.assertEqual(self.pedir({"x": 1}).status_code, 422)
