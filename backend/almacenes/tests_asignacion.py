import copy
import itertools

from django.core.cache import cache
from rest_framework.test import APITestCase

from .asignacion import EJEMPLO
from .tests_casos import BaseAuth
from .transporte import EJEMPLO as EJEMPLO_TRANSPORTE


def fuerza_bruta(costos, objetivo):
    """Mejor valor probando todas las asignaciones posibles (A <= T o A >= T)."""
    A, T = len(costos), len(costos[0])
    mejor = None
    if A <= T:
        opciones = (list(zip(range(A), cols)) for cols in itertools.permutations(range(T), A))
    else:
        opciones = (list(zip(filas, range(T))) for filas in itertools.permutations(range(A), T))
    for par in opciones:
        if any(costos[i][j] is None for i, j in par):
            continue
        v = sum(costos[i][j] for i, j in par)
        if mejor is None or (v < mejor if objetivo == "minimizar" else v > mejor):
            mejor = v
    return mejor


class AsignacionApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def resolver(self, datos):
        return self.client.post("/api/problemas/asignacion/resolver", datos, format="json")

    def test_ejemplo_machineco(self):
        ej = self.client.get("/api/problemas/asignacion/ejemplo").json()
        d = self.resolver(ej).json()
        self.assertEqual(d["costo_total"], 15)
        self.assertEqual(d["costo_total"], fuerza_bruta(ej["costos"], "minimizar"))
        self.assertTrue(d["equilibrado"])
        self.assertEqual(len(d["asignaciones"]), 4)
        self.assertEqual(len({a["agente"] for a in d["asignaciones"]}), 4)
        self.assertEqual(len({a["tarea"] for a in d["asignaciones"]}), 4)

    def test_maximizar_coincide_con_fuerza_bruta(self):
        e = copy.deepcopy(EJEMPLO)
        e["objetivo"] = "maximizar"
        d = self.resolver(e).json()
        self.assertEqual(d["costo_total"], fuerza_bruta(e["costos"], "maximizar"))
        self.assertEqual(d["objetivo"], "maximizar")

    def test_mas_tareas_que_agentes(self):
        e = {"agentes": ["A", "B", "C"], "tareas": ["1", "2", "3", "4"],
             "costos": [[9, 2, 7, 8], [6, 4, 3, 7], [5, 8, 1, 8]], "objetivo": "minimizar"}
        d = self.resolver(e).json()
        self.assertEqual(d["costo_total"], fuerza_bruta(e["costos"], "minimizar"))
        self.assertEqual(len(d["asignaciones"]), 3)
        self.assertEqual(len(d["tareas_sin_agente"]), 1)
        self.assertEqual(d["agentes_sin_tarea"], [])
        self.assertFalse(d["equilibrado"])

    def test_mas_agentes_que_tareas(self):
        e = {"agentes": ["A", "B", "C", "D"], "tareas": ["1", "2", "3"],
             "costos": [[9, 2, 7], [6, 4, 3], [5, 8, 1], [7, 6, 9]], "objetivo": "minimizar"}
        d = self.resolver(e).json()
        self.assertEqual(d["costo_total"], fuerza_bruta(e["costos"], "minimizar"))
        self.assertEqual(len(d["asignaciones"]), 3)
        self.assertEqual(len(d["agentes_sin_tarea"]), 1)
        self.assertEqual(d["tareas_sin_agente"], [])

    def test_prohibidas_se_respetan(self):
        e = copy.deepcopy(EJEMPLO)
        e["costos"][3][0] = None
        e["costos"][1][0] = None
        d = self.resolver(e).json()
        self.assertEqual(d["costo_total"], fuerza_bruta(e["costos"], "minimizar"))
        self.assertGreater(d["costo_total"], 15)
        self.assertFalse(any(a["tarea"] == "Trabajo 1" and a["agente"] in ("Máquina 2", "Máquina 4") for a in d["asignaciones"]))

    def test_infactible_por_prohibidas(self):
        e = {"agentes": ["A", "B"], "tareas": ["1", "2"], "costos": [[1, None], [2, None]]}
        r = self.resolver(e)
        self.assertEqual(r.status_code, 422)

    def test_fila_o_columna_vacia(self):
        e = copy.deepcopy(EJEMPLO)
        e["costos"][0] = [None] * 4
        r = self.resolver(e)
        self.assertEqual(r.status_code, 422)
        self.assertIn("ninguna tarea permitida", " ".join(r.json()["detail"]))
        e = copy.deepcopy(EJEMPLO)
        for f in e["costos"]:
            f[2] = None
        r = self.resolver(e)
        self.assertEqual(r.status_code, 422)
        self.assertIn("nadie", " ".join(r.json()["detail"]))

    def test_validaciones(self):
        casos = {
            "negativo": lambda e: e["costos"][0].__setitem__(0, -1),
            "dimension": lambda e: e["costos"].pop(),
            "fila": lambda e: e["costos"][0].pop(),
            "repetidos": lambda e: e["agentes"].__setitem__(1, "Máquina 1"),
            "texto": lambda e: e["costos"][0].__setitem__(0, "x"),
            "objetivo": lambda e: e.__setitem__("objetivo", "empatar"),
            "vacio": lambda e: e.__setitem__("tareas", []),
        }
        for nombre, cambio in casos.items():
            e = copy.deepcopy(EJEMPLO)
            cambio(e)
            self.assertEqual(self.resolver(e).status_code, 422, nombre)

    def test_un_solo_agente_y_tarea(self):
        d = self.resolver({"agentes": ["A"], "tareas": ["1"], "costos": [[7]]}).json()
        self.assertEqual(d["costo_total"], 7)


class CasosAsignacionTests(BaseAuth):
    def test_guardar_abrir_duplicar(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"tipo": "asignacion", "nombre": "Machineco", "datos": EJEMPLO}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        c = r.json()
        self.assertEqual(c["tipo"], "asignacion")
        self.assertEqual(c["costo_total"], 15)
        lista = self.client.get("/api/casos").json()["results"][0]
        self.assertIn("asignaciones", lista["resumen"])
        copia = self.client.post(f"/api/casos/{c['id']}/duplicar")
        self.assertEqual(copia.json()["tipo"], "asignacion")

    def test_datos_de_otro_tipo_se_rechazan(self):
        self.como(self.registrar("ana"))
        r = self.client.post("/api/casos", {"tipo": "asignacion", "nombre": "x", "datos": EJEMPLO_TRANSPORTE}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/casos", {"tipo": "transporte", "nombre": "x", "datos": EJEMPLO}, format="json")
        self.assertEqual(r.status_code, 400)
