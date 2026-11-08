import copy

from django.core.cache import cache
from rest_framework.test import APITestCase

from .tests_casos import BaseAuth
from .transporte import EJEMPLO


class TransporteApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def resolver(self, datos):
        return self.client.post("/api/problemas/transporte/resolver", datos, format="json")

    def test_ejemplo_es_el_de_powerco(self):
        ej = self.client.get("/api/problemas/transporte/ejemplo").json()
        self.assertEqual(ej["oferta"], [35, 50, 40])
        r = self.resolver(ej)
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d["costo_total"], 1020)
        self.assertTrue(d["balanceado"])
        for dest in d["detalle_destinos"]:
            self.assertAlmostEqual(dest["recibido"], dest["demanda"])

    def test_oferta_mayor_deja_sobrante(self):
        e = copy.deepcopy(EJEMPLO)
        e["oferta"] = [50, 50, 50]
        d = self.resolver(e).json()
        self.assertFalse(d["balanceado"])
        self.assertAlmostEqual(sum(o["sobrante"] for o in d["detalle_origenes"]), 25)
        self.assertLessEqual(d["costo_total"], 1020)

    def test_demanda_mayor_que_oferta_entrega_lo_posible(self):
        e = copy.deepcopy(EJEMPLO)
        e["demanda"] = [45, 20, 30, 40]  # demanda 135 > oferta 125
        d = self.resolver(e).json()
        self.assertFalse(d["cubierta"])
        self.assertAlmostEqual(d["faltante_total"], 10)
        self.assertAlmostEqual(d["entregado_total"], 125)
        self.assertAlmostEqual(sum(o["sobrante"] for o in d["detalle_origenes"]), 0)

    def test_faltante_se_asigna_donde_sale_mas_caro(self):
        # A ofrece 10; X cuesta 1, Y cuesta 3 y cada uno pide 8: se sirve todo X y 2 de Y
        e = {"origenes": ["A"], "destinos": ["X", "Y"], "oferta": [10], "demanda": [8, 8],
             "costos": [[1, 3]]}
        d = self.resolver(e).json()
        self.assertEqual(d["costo_total"], 14)
        faltas = {x["destino"]: x["faltante"] for x in d["detalle_destinos"]}
        self.assertEqual(faltas, {"X": 0, "Y": 6})
        self.assertAlmostEqual(d["faltante_total"], 6)

    def test_sin_faltante_cuando_alcanza(self):
        d = self.resolver(EJEMPLO).json()
        self.assertTrue(d["cubierta"])
        self.assertEqual(d["faltante_total"], 0)

    def test_ruta_bloqueada_se_respeta(self):
        e = copy.deepcopy(EJEMPLO)
        e["costos"][1][0] = None  # la ruta usada para Ciudad 1 desde Planta 2
        d = self.resolver(e).json()
        self.assertGreater(d["costo_total"], 1020)
        self.assertFalse(any(x["origen"] == "Planta 2" and x["destino"] == "Ciudad 1" for x in d["envios"]))

    def test_destino_sin_rutas_se_rechaza(self):
        e = copy.deepcopy(EJEMPLO)
        for f in e["costos"]:
            f[0] = None
        r = self.resolver(e)
        self.assertEqual(r.status_code, 422)
        self.assertIn("rutas están bloqueadas", " ".join(r.json()["detail"]))

    def test_rutas_insuficientes_dejan_faltante(self):
        e = {"origenes": ["A", "B"], "destinos": ["X", "Y"], "oferta": [10, 10], "demanda": [15, 5],
             "costos": [[1, None], [None, 1]]}
        d = self.resolver(e).json()
        self.assertEqual(d["costo_total"], 15)
        faltas = {x["destino"]: x["faltante"] for x in d["detalle_destinos"]}
        self.assertEqual(faltas, {"X": 5, "Y": 0})

    def test_validaciones(self):
        casos = {
            "negativo": lambda e: e["oferta"].__setitem__(0, -1),
            "dimension": lambda e: e["costos"].pop(),
            "fila": lambda e: e["costos"][0].pop(),
            "repetidos": lambda e: e["origenes"].__setitem__(1, "Planta 1"),
            "costo_negativo": lambda e: e["costos"][0].__setitem__(0, -3),
            "texto": lambda e: e["demanda"].__setitem__(0, "mucho"),
            "vacio": lambda e: e.__setitem__("origenes", []),
        }
        for nombre, cambio in casos.items():
            e = copy.deepcopy(EJEMPLO)
            cambio(e)
            self.assertEqual(self.resolver(e).status_code, 422, nombre)

    def test_tipo_desconocido(self):
        self.assertEqual(self.client.get("/api/problemas/otro/ejemplo").status_code, 404)
        self.assertEqual(self.client.post("/api/problemas/otro/resolver", {}, format="json").status_code, 404)

    def test_cuerpo_no_objeto(self):
        self.assertEqual(self.client.post("/api/problemas/transporte/resolver", [1, 2], format="json").status_code, 422)

    def test_valores_enormes_no_rompen(self):
        e = copy.deepcopy(EJEMPLO)
        e["oferta"] = [1e12] * 3
        e["demanda"] = [1e12] * 4 if False else [1e11] * 4
        e["costos"] = [[1e12] * 4 for _ in range(3)]
        self.assertIn(self.resolver(e).status_code, (200, 422))


class CasosPorTipoTests(BaseAuth):
    def test_guardar_y_abrir_caso_de_transporte(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"tipo": "transporte", "nombre": "Powerco", "datos": EJEMPLO}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        c = r.json()
        self.assertEqual(c["tipo"], "transporte")
        self.assertEqual(c["costo_total"], 1020)
        self.assertEqual(c["resultado"]["costo_total"], 1020)
        lista = self.client.get("/api/casos").json()["results"][0]
        self.assertEqual(lista["tipo"], "transporte")
        self.assertIn("rutas activas", lista["resumen"])

    def test_tipo_por_defecto_es_ubicacion(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"nombre": "GT", "datos": self.ej}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["tipo"], "ubicacion")
        lista = self.client.get("/api/casos").json()["results"][0]
        self.assertTrue(lista["resumen"].startswith("Abre:"))

    def test_datos_de_un_tipo_no_valen_para_otro(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"tipo": "transporte", "nombre": "x", "datos": self.ej}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/casos", {"tipo": "ubicacion", "nombre": "x", "datos": EJEMPLO}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_tipo_invalido(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"tipo": "magia", "nombre": "x", "datos": EJEMPLO}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_actualizar_usa_el_tipo_del_caso_y_no_permite_cambiarlo(self):
        self.como(self.registrar("ana"))
        id_ = self.client.post("/api/casos", {"tipo": "transporte", "nombre": "P", "datos": EJEMPLO}, format="json").json()["id"]
        nuevo = copy.deepcopy(EJEMPLO)
        nuevo["oferta"] = [50, 50, 50]
        r = self.client.patch(f"/api/casos/{id_}", {"datos": nuevo}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["tipo"], "transporte")
        r = self.client.patch(f"/api/casos/{id_}", {"tipo": "ubicacion"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_duplicar_conserva_el_tipo(self):
        self.como(self.registrar("ana"))
        id_ = self.client.post("/api/casos", {"tipo": "transporte", "nombre": "P", "datos": EJEMPLO}, format="json").json()["id"]
        r = self.client.post(f"/api/casos/{id_}/duplicar")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["tipo"], "transporte")
