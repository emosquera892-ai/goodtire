import re

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from .cuentas import ENLACE_INVALIDO, MENSAJE_ENVIO

User = get_user_model()
CLAVE = "Clave-segura-123"


class CuentasBase(APITestCase):
    def setUp(self):
        cache.clear()

    def crear(self, usuario="ana", correo="ana@ejemplo.com"):
        r = self.client.post("/api/auth/registro", {"username": usuario, "email": correo, "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def pedir(self, correo):
        return self.client.post("/api/auth/recuperar", {"email": correo}, format="json")

    def enlace(self):
        cuerpo = mail.outbox[-1].body
        m = re.search(r"uid=([^&\s]+)&token=([^\s]+)", cuerpo)
        return m.group(1), m.group(2)

    def restablecer(self, uid, token, password):
        return self.client.post("/api/auth/restablecer", {"uid": uid, "token": token, "password": password}, format="json")


class RegistroConCorreoTests(CuentasBase):
    def test_el_correo_es_obligatorio(self):
        r = self.client.post("/api/auth/registro", {"username": "ana", "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_correo_invalido(self):
        for malo in ["", "sin-arroba", "a@", "@x.com", "a b@x.com"]:
            r = self.client.post("/api/auth/registro", {"username": "u" + str(len(malo)), "email": malo, "password": CLAVE}, format="json")
            self.assertEqual(r.status_code, 400, malo)

    def test_correo_unico_sin_importar_mayusculas(self):
        self.crear("ana", "ana@ejemplo.com")
        r = self.client.post("/api/auth/registro", {"username": "otra", "email": "ANA@Ejemplo.com", "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_se_guarda_en_minusculas(self):
        self.crear("ana", "Ana@Ejemplo.COM")
        self.assertEqual(User.objects.get(username="ana").email, "ana@ejemplo.com")


class RecuperarTests(CuentasBase):
    def test_correo_registrado_recibe_enlace_con_usuario(self):
        self.crear()
        r = self.pedir("ana@ejemplo.com")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["detail"], MENSAJE_ENVIO)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ana@ejemplo.com"])
        self.assertIn("Tu usuario es: ana", mail.outbox[0].body)
        self.assertIn("/restablecer?uid=", mail.outbox[0].body)

    def test_mayusculas_no_importan(self):
        self.crear()
        self.pedir("ANA@EJEMPLO.COM")
        self.assertEqual(len(mail.outbox), 1)

    def test_correo_desconocido_misma_respuesta_y_sin_correo(self):
        self.crear()
        conocido = self.pedir("ana@ejemplo.com")
        mail.outbox.clear()
        desconocido = self.pedir("nadie@ejemplo.com")
        self.assertEqual(desconocido.status_code, conocido.status_code)
        self.assertEqual(desconocido.json(), conocido.json())
        self.assertEqual(len(mail.outbox), 0)

    def test_cuenta_inactiva_no_recibe(self):
        self.crear()
        User.objects.filter(username="ana").update(is_active=False)
        self.pedir("ana@ejemplo.com")
        self.assertEqual(len(mail.outbox), 0)

    def test_correo_mal_escrito(self):
        self.assertEqual(self.pedir("no-es-correo").status_code, 400)
        self.assertEqual(self.client.post("/api/auth/recuperar", {}, format="json").status_code, 400)

    def test_limite_de_solicitudes(self):
        for _ in range(5):
            self.assertEqual(self.pedir("nadie@ejemplo.com").status_code, 200)
        self.assertEqual(self.pedir("nadie@ejemplo.com").status_code, 429)

    def test_cuenta_sin_correo_no_rompe(self):
        User.objects.create_user("vieja", password=CLAVE)  # cuenta anterior, sin correo
        self.assertEqual(self.pedir("vieja@ejemplo.com").status_code, 200)
        self.assertEqual(len(mail.outbox), 0)


class RestablecerTests(CuentasBase):
    def test_flujo_completo(self):
        self.crear()
        self.pedir("ana@ejemplo.com")
        uid, token = self.enlace()
        r = self.restablecer(uid, token, "Nueva-clave-789")
        self.assertEqual(r.status_code, 200, r.content)
        viejo = self.client.post("/api/auth/token", {"username": "ana", "password": CLAVE}, format="json")
        nuevo = self.client.post("/api/auth/token", {"username": "ana", "password": "Nueva-clave-789"}, format="json")
        self.assertEqual(viejo.status_code, 401)
        self.assertEqual(nuevo.status_code, 200)

    def test_el_enlace_sirve_una_sola_vez(self):
        self.crear()
        self.pedir("ana@ejemplo.com")
        uid, token = self.enlace()
        self.assertEqual(self.restablecer(uid, token, "Nueva-clave-789").status_code, 200)
        r = self.restablecer(uid, token, "Otra-clave-456")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["detail"], [ENLACE_INVALIDO])

    def test_token_alterado_o_uid_ajeno(self):
        self.crear("ana", "ana@ejemplo.com")
        self.crear("beto", "beto@ejemplo.com")
        self.pedir("ana@ejemplo.com")
        uid, token = self.enlace()
        self.assertEqual(self.restablecer(uid, token[:-1] + ("a" if token[-1] != "a" else "b"), "Nueva-clave-789").status_code, 400)
        self.pedir("beto@ejemplo.com")
        uid_beto, _ = self.enlace()
        self.assertEqual(self.restablecer(uid_beto, token, "Nueva-clave-789").status_code, 400)  # token de Ana con uid de Beto
        self.assertEqual(self.restablecer("basura", "x", "Nueva-clave-789").status_code, 400)

    def test_contrasena_debil_se_rechaza_y_el_enlace_sigue_valido(self):
        self.crear()
        self.pedir("ana@ejemplo.com")
        uid, token = self.enlace()
        for debil in ["12345678", "password", "ana@ejemplo.com"]:
            self.assertEqual(self.restablecer(uid, token, debil).status_code, 400, debil)
        self.assertEqual(self.restablecer(uid, token, "Nueva-clave-789").status_code, 200)

    def test_enlace_vencido(self):
        from django.test import override_settings

        self.crear()
        self.pedir("ana@ejemplo.com")
        uid, token = self.enlace()
        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            self.assertEqual(self.restablecer(uid, token, "Nueva-clave-789").status_code, 400)

    def test_faltan_campos(self):
        self.assertEqual(self.client.post("/api/auth/restablecer", {"uid": "x"}, format="json").status_code, 400)


class MiCuentaTests(CuentasBase):
    def entrar(self, usuario="ana"):
        self.crear(usuario, f"{usuario}@ejemplo.com")
        t = self.client.post("/api/auth/token", {"username": usuario, "password": CLAVE}, format="json").json()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {t['access']}")

    def test_requiere_sesion(self):
        for ruta in ["cuenta", "cambiar-clave", "cambiar-correo", "eliminar-cuenta"]:
            r = self.client.get(f"/api/auth/{ruta}") if ruta == "cuenta" else self.client.post(f"/api/auth/{ruta}", {}, format="json")
            self.assertEqual(r.status_code, 401, ruta)

    def test_ver_cuenta(self):
        self.entrar()
        self.assertEqual(self.client.get("/api/auth/cuenta").json(), {"username": "ana", "email": "ana@ejemplo.com"})

    def test_cambiar_clave(self):
        self.entrar()
        malo = self.client.post("/api/auth/cambiar-clave", {"password": "otra-mala-123", "nueva": "Nueva-clave-456"}, format="json")
        self.assertEqual(malo.status_code, 400)
        debil = self.client.post("/api/auth/cambiar-clave", {"password": CLAVE, "nueva": "12345678"}, format="json")
        self.assertEqual(debil.status_code, 400)
        ok = self.client.post("/api/auth/cambiar-clave", {"password": CLAVE, "nueva": "Nueva-clave-456"}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.client.credentials()
        viejo = self.client.post("/api/auth/token", {"username": "ana", "password": CLAVE}, format="json")
        nuevo = self.client.post("/api/auth/token", {"username": "ana", "password": "Nueva-clave-456"}, format="json")
        self.assertEqual((viejo.status_code, nuevo.status_code), (401, 200))

    def test_cambiar_correo(self):
        self.entrar()
        self.crear("beto", "beto@ejemplo.com")
        malo = self.client.post("/api/auth/cambiar-correo", {"password": "x" * 9, "email": "nuevo@ejemplo.com"}, format="json")
        self.assertEqual(malo.status_code, 400)
        repetido = self.client.post("/api/auth/cambiar-correo", {"password": CLAVE, "email": "BETO@ejemplo.com"}, format="json")
        self.assertEqual(repetido.status_code, 400)
        ok = self.client.post("/api/auth/cambiar-correo", {"password": CLAVE, "email": "Nuevo@Ejemplo.com"}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(User.objects.get(username="ana").email, "nuevo@ejemplo.com")
        propio = self.client.post("/api/auth/cambiar-correo", {"password": CLAVE, "email": "nuevo@ejemplo.com"}, format="json")
        self.assertEqual(propio.status_code, 200)

    def test_eliminar_cuenta_borra_sus_casos(self):
        from .models import Caso

        self.entrar()
        u = User.objects.get(username="ana")
        Caso.objects.create(usuario=u, nombre="c", datos={})
        malo = self.client.post("/api/auth/eliminar-cuenta", {"password": "otra-mala-123"}, format="json")
        self.assertEqual(malo.status_code, 400)
        self.assertTrue(User.objects.filter(username="ana").exists())
        ok = self.client.post("/api/auth/eliminar-cuenta", {"password": CLAVE}, format="json")
        self.assertEqual(ok.status_code, 204)
        self.assertFalse(User.objects.filter(username="ana").exists())
        self.assertEqual(Caso.objects.count(), 0)

    def test_admin_no_se_elimina(self):
        self.entrar()
        User.objects.filter(username="ana").update(is_staff=True)
        r = self.client.post("/api/auth/eliminar-cuenta", {"password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertTrue(User.objects.filter(username="ana").exists())
