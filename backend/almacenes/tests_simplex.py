import random

from django.core.cache import cache
from rest_framework.test import APITestCase

from . import simplex
from .esquema import ErrorDatos


class SimplexTests(APITestCase):
    def setUp(self):
        cache.clear()

    def resolver(self, datos):
        return self.client.post("/api/problemas/simplex/resolver", datos, format="json")

    def test_giapetto(self):
        r = self.resolver(simplex.EJEMPLO)
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d["estado"], "optimo")
        self.assertEqual(d["solucion"]["z"], "180")
        self.assertEqual([v["valor"] for v in d["solucion"]["valores"]], ["20", "60"])
        self.assertEqual(len(d["fases"]), 1)
        self.assertTrue(d["fases"][0]["iteraciones"][-1]["optimo"])
        g = d["grafico"]
        self.assertEqual(g["optimo"]["z"], 180)
        self.assertEqual(sum(1 for v in g["vertices"] if v["optimo"]), 1)
        self.assertEqual(len(g["poligono"]), 5)

    def test_minimizar_con_dos_fases(self):
        d = self.resolver(simplex.EJEMPLO_MIN).json()
        self.assertEqual(d["solucion"]["z"], "320")
        self.assertEqual([f["nombre"] for f in d["fases"]], ["Fase 1", "Fase 2"])

    def test_infactible_e_ilimitado(self):
        inf = {"objetivo": "maximizar", "variables": ["x"], "c": [1],
               "restricciones": [{"a": [1], "signo": "<=", "b": 1}, {"a": [1], "signo": ">=", "b": 2}]}
        self.assertEqual(self.resolver(inf).json()["estado"], "infactible")
        ilim = {"objetivo": "maximizar", "variables": ["x", "y"], "c": [1, 1],
                "restricciones": [{"a": [1, -1], "signo": "<=", "b": 1}]}
        d = self.resolver(ilim).json()
        self.assertEqual(d["estado"], "ilimitado")
        self.assertFalse(d["grafico"]["acotada"])

    def test_datos_invalidos(self):
        self.assertEqual(self.resolver({"x": 1}).status_code, 422)
        malo = {"objetivo": "maximizar", "variables": ["x", "y"], "c": [1],
                "restricciones": [{"a": [1, 1], "signo": "<=", "b": 1}]}
        self.assertEqual(self.resolver(malo).status_code, 422)
        self.assertEqual(self.client.get("/api/problemas/simplex/ejemplo").status_code, 200)

    def test_coincide_con_scipy(self):
        import numpy as np
        from scipy.optimize import linprog

        rnd = random.Random(5)
        for _ in range(120):
            n, m = rnd.randint(1, 3), rnd.randint(1, 4)
            datos = {
                "objetivo": rnd.choice(["maximizar", "minimizar"]),
                "variables": [f"x{i + 1}" for i in range(n)],
                "c": [rnd.randint(-5, 9) for _ in range(n)],
                "restricciones": [
                    {"a": [rnd.randint(-3, 6) for _ in range(n)], "signo": rnd.choice(["<=", "<=", ">=", "="]), "b": rnd.randint(-4, 30)}
                    for _ in range(m)
                ],
            }
            p = simplex.parsear(datos)
            r = simplex.resolver(p)
            c = np.array(p.c, float) * (1 if p.objetivo == "minimizar" else -1)
            aub, bub, aeq, beq = [], [], [], []
            for q in p.restricciones:
                if q.signo == "<=":
                    aub.append(q.a); bub.append(q.b)
                elif q.signo == ">=":
                    aub.append([-v for v in q.a]); bub.append(-q.b)
                else:
                    aeq.append(q.a); beq.append(q.b)
            ref = linprog(c, A_ub=aub or None, b_ub=bub or None, A_eq=aeq or None, b_eq=beq or None, bounds=[(0, None)] * n, method="highs")
            if ref.status == 0:
                self.assertEqual(r["estado"], "optimo")
                esperado = ref.fun * (1 if p.objetivo == "minimizar" else -1)
                self.assertAlmostEqual(r["solucion"]["z_num"], esperado, places=6)
            elif ref.status == 3:
                self.assertEqual(r["estado"], "ilimitado")
            elif ref.status == 2:
                self.assertIn(r["estado"], ("infactible", "ilimitado"))
