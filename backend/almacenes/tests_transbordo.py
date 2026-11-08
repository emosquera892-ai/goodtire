import copy

from django.core.cache import cache
from rest_framework.test import APITestCase

from .tests_casos import BaseAuth
from .transbordo import EJEMPLO


def cadena(direct=10, cap=None, oferta=10, demanda=10):
    """O -> H -> D, con ruta directa opcional O -> D."""
    return {
        "nodos": [
            {"nombre": "O", "tipo": "origen", "cantidad": oferta},
            {"nombre": "H", "tipo": "intermedio", "cantidad": cap},
            {"nombre": "D", "tipo": "destino", "cantidad": demanda},
        ],
        "costos": [[None, 2, direct], [None, None, 3], [None, None, None]],
    }


class TransbordoApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def resolver(self, datos):
        return self.client.post("/api/problemas/transbordo/resolver", datos, format="json")

    def test_ejemplo(self):
        ej = self.client.get("/api/problemas/transbordo/ejemplo").json()
        d = self.resolver(ej).json()
        self.assertEqual(d["costo_total"], 5800)
        self.assertTrue(d["balanceado"])
        self.assertTrue(d["cubierta"])
        for n in d["detalle_nodos"]:
            if n["tipo"] == "destino":
                self.assertAlmostEqual(n["entra"] - n["sale"], n["cantidad"])
            if n["tipo"] == "intermedio":
                self.assertAlmostEqual(n["entra"], n["sale"])

    def test_usa_el_intermedio_cuando_conviene(self):
        d = self.resolver(cadena(direct=10)).json()
        self.assertEqual(d["costo_total"], 50)
        self.assertEqual({(f["desde"], f["hasta"]) for f in d["flujos"]}, {("O", "H"), ("H", "D")})

    def test_va_directo_cuando_es_mas_barato(self):
        d = self.resolver(cadena(direct=4)).json()
        self.assertEqual(d["costo_total"], 40)
        self.assertEqual([(f["desde"], f["hasta"]) for f in d["flujos"]], [("O", "D")])

    def test_capacidad_del_intermedio_limita_el_paso(self):
        d = self.resolver(cadena(direct=10, cap=4)).json()
        self.assertEqual(d["costo_total"], 4 * 5 + 6 * 10)
        h = next(n for n in d["detalle_nodos"] if n["nombre"] == "H")
        self.assertAlmostEqual(h["entra"], 4)

    def test_capacidad_insuficiente_deja_faltante(self):
        # el único camino pasa por H, que admite 4: llegan 4 y faltan 6
        d = self.resolver(cadena(direct=None, cap=4)).json()
        self.assertFalse(d["cubierta"])
        self.assertAlmostEqual(d["faltante_total"], 6)
        self.assertEqual(d["costo_total"], 4 * 5)
        dest = next(n for n in d["detalle_nodos"] if n["nombre"] == "D")
        self.assertAlmostEqual(dest["faltante"], 6)

    def test_oferta_mayor_deja_sobrante(self):
        d = self.resolver(cadena(oferta=25)).json()
        self.assertFalse(d["balanceado"])
        self.assertEqual(d["costo_total"], 50)
        o = next(n for n in d["detalle_nodos"] if n["nombre"] == "O")
        self.assertAlmostEqual(o["sale"], 10)

    def test_oferta_menor_entrega_lo_posible(self):
        d = self.resolver(cadena(oferta=5)).json()
        self.assertFalse(d["cubierta"])
        self.assertAlmostEqual(d["faltante_total"], 5)
        self.assertAlmostEqual(d["entregado_total"], 5)
        self.assertEqual(d["costo_total"], 25)

    def test_faltante_se_asigna_donde_sale_mas_caro(self):
        e = {
            "nodos": [
                {"nombre": "O", "tipo": "origen", "cantidad": 10},
                {"nombre": "X", "tipo": "destino", "cantidad": 8},
                {"nombre": "Y", "tipo": "destino", "cantidad": 8},
            ],
            "costos": [[None, 1, 3], [None, None, None], [None, None, None]],
        }
        d = self.resolver(e).json()
        self.assertEqual(d["costo_total"], 14)
        falta = {n["nombre"]: n["faltante"] for n in d["detalle_nodos"]}
        self.assertEqual(falta["X"], 0)
        self.assertEqual(falta["Y"], 6)

    def test_destino_sin_rutas_de_llegada(self):
        e = cadena()
        e["costos"][0][2] = None
        e["costos"][1][2] = None
        r = self.resolver(e)
        self.assertEqual(r.status_code, 422)
        self.assertIn("Ninguna ruta llega", " ".join(r.json()["detail"]))

    def test_la_diagonal_se_ignora(self):
        e = cadena(direct=10)
        e["costos"][0][0] = 0
        e["costos"][1][1] = 0
        self.assertEqual(self.resolver(e).json()["costo_total"], 50)

    def test_ciclos_gratis_no_cambian_el_costo(self):
        e = copy.deepcopy(EJEMPLO)
        # ruta de vuelta con costo 0 entre bodegas: no debe abaratar ni romper
        e["costos"][2][3] = 0
        e["costos"][3][2] = 0
        d = self.resolver(e).json()
        self.assertLessEqual(d["costo_total"], 5800)

    def test_validaciones(self):
        casos = {
            "origen_sin_oferta": lambda e: e["nodos"][0].__setitem__("cantidad", None),
            "destino_sin_demanda": lambda e: e["nodos"][2].__setitem__("cantidad", None),
            "sin_origen": lambda e: e["nodos"][0].__setitem__("tipo", "intermedio"),
            "sin_destino": lambda e: e["nodos"][2].__setitem__("tipo", "intermedio"),
            "repetidos": lambda e: e["nodos"][1].__setitem__("nombre", "O"),
            "dimension": lambda e: e["costos"].pop(),
            "fila": lambda e: e["costos"][0].pop(),
            "costo_negativo": lambda e: e["costos"][0].__setitem__(1, -2),
            "tipo_invalido": lambda e: e["nodos"][1].__setitem__("tipo", "otro"),
            "pocos_nodos": lambda e: (e.__setitem__("nodos", e["nodos"][:1]), e.__setitem__("costos", [[None]])),
            "cantidad_negativa": lambda e: e["nodos"][0].__setitem__("cantidad", -5),
        }
        for nombre, cambio in casos.items():
            e = cadena()
            cambio(e)
            self.assertEqual(self.resolver(e).status_code, 422, nombre)

    def test_cuerpo_no_objeto(self):
        self.assertEqual(self.resolver([1]).status_code, 422)


class CasosTransbordoTests(BaseAuth):
    def test_guardar_abrir_duplicar(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"tipo": "transbordo", "nombre": "Mi red", "datos": EJEMPLO}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        c = r.json()
        self.assertEqual(c["tipo"], "transbordo")
        self.assertEqual(c["costo_total"], 5800)
        lista = self.client.get("/api/casos").json()["results"][0]
        self.assertIn("rutas activas", lista["resumen"])
        copia = self.client.post(f"/api/casos/{c['id']}/duplicar")
        self.assertEqual(copia.json()["tipo"], "transbordo")

    def test_datos_de_otro_tipo_se_rechazan(self):
        from .transporte import EJEMPLO as TRANSPORTE

        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"tipo": "transbordo", "nombre": "x", "datos": TRANSPORTE}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/casos", {"tipo": "transporte", "nombre": "x", "datos": EJEMPLO}, format="json")
        self.assertEqual(r.status_code, 400)
