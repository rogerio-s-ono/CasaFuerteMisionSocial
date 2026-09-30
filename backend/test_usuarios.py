#!/usr/bin/env python3
"""
Suíte de testes de regressão — gestión de usuarios (aba Usuarios).
Simula FIELMENTE a lógica do backend Code.gs (_saveUsuario, _upsertVoluntario,
_delVoluntario, _permisos, login por teléfono) para provar/validar os fluxos
ANTES de fazer deploy. Rodar:  python3 backend/test_usuarios.py

Regras de identidade (best practice — chave estável + unicidade):
- telefono = CHAVE PRIMÁRIA do usuário (dígitos).
- email = OPCIONAL, mas se presente deve ser ÚNICO (não pode repetir entre usuários).
- esAdmin = flag; lider = lista de misiones. admin/líder exigem email.
- Nunca criar duplicado, nunca pisar/apagar outro usuário.
"""
import re, json

ADMIN_FALLBACK = ['rogerio.s.ono@gmail.com']

def norm(t): return re.sub(r'[^0-9]', '', str(t if t is not None else ''))
def es_admin_flag(v): return str(v).lower() in ('true','1','sí','si','yes') or v is True

class Backend:
    """Simulação do estado da aba Usuarios + ações do Code.gs."""
    def __init__(self, rows=None):
        # cada row: {telefono, nombre, email, esAdmin, lider(list), idioma}
        self.rows = rows or []

    def _find_by_tel(self, telnorm):
        for i,r in enumerate(self.rows):
            if norm(r['telefono'])==telnorm: return i
        return -1
    def _find_by_email(self, email):
        email=(email or '').lower().strip()
        if not email: return -1
        for i,r in enumerate(self.rows):
            if str(r.get('email','')).lower().strip()==email: return i
        return -1

    def permisos(self):
        admins=[]; lideres={}
        for r in self.rows:
            e=str(r.get('email','')).lower().strip()
            if not e: continue
            if es_admin_flag(r.get('esAdmin')): admins.append(e)
            mis=r.get('lider') or []
            if mis: lideres[e]=lideres.get(e,[])+list(mis)
        if not admins: admins=[e.lower() for e in ADMIN_FALLBACK]
        return {'admins':admins, 'lideres':lideres}

    def is_admin(self, email):
        if not email: return False
        return email.lower() in self.permisos()['admins']

    # ---- login por teléfono: ¿reconoce a un usuario existente? ----
    def login_por_telefono(self, full):
        idx=self._find_by_tel(norm(full))
        if idx>=0: return ('ENTRA', self.rows[idx]['nombre'])
        return ('PIDE_NOMBRE', None)

    # ---- upsert por login (auto-registro): no toca roles ----
    def upsert_voluntario(self, telefono, nombre, email_explicito='', email_verificado='', idioma='es'):
        """email_explicito = el que manda el cliente (dueño); email_verificado = del idToken (puede ser de otro)."""
        if not telefono or not nombre: return {'error':'datos_incompletos'}
        k=norm(telefono); idx=self._find_by_tel(k)
        ee=(email_explicito or '').lower().strip(); ev=(email_verificado or '').lower().strip()
        if idx>=0:
            fila=self.rows[idx]; nuevo=str(fila.get('email','')).lower().strip()
            if ee and ee==ev:
                otro=self._find_by_email(ee)
                if otro<0 or otro==idx: nuevo=ee
            fila.update({'nombre':nombre,'email':nuevo,'idioma':idioma})
        else:
            en = ee if (ee and ee==ev) else ''
            if en and self._find_by_email(en)>=0: en=''
            self.rows.append({'telefono':'+'+k,'nombre':nombre,'email':en,'esAdmin':False,'lider':[],'idioma':idioma})
        return {'ok':True}

    # ---- gestión admin: crear/editar ----
    def save_usuario(self, admin_email, telefono, nombre, email='', esAdmin=False, misiones=None, telefonoAnterior=None):
        if not self.is_admin(admin_email): return {'error':'forbidden_admin'}
        nombre=(nombre or '').strip(); telKey=norm(telefono); mail=(email or '').lower().strip()
        misiones=[m for m in (misiones or []) if m]
        esLider=len(misiones)>0
        if not telKey or not nombre: return {'error':'datos_incompletos'}
        if (esAdmin or esLider) and not mail: return {'error':'email_requerido'}

        telAnt=norm(telefonoAnterior) if telefonoAnterior else ''
        # localizar fila destino
        if telAnt:
            idx=self._find_by_tel(telAnt)
            if telAnt!=telKey:
                choque=self._find_by_tel(telKey)
                if choque>=0 and choque!=idx: return {'error':'telefono_en_uso'}
        else:
            idx=self._find_by_tel(telKey)

        # UNICIDADE DE EMAIL: se o email já é de OUTRO usuário, rejeitar
        if mail:
            eidx=self._find_by_email(mail)
            if eidx>=0 and eidx!=idx: return {'error':'email_en_uso'}

        # proteção do último admin: se estava admin e agora não, e é o único
        if idx>=0 and not esAdmin:
            was=self.rows[idx]
            if es_admin_flag(was.get('esAdmin')) and str(was.get('email','')).lower()==mail:
                admins=self.permisos()['admins']
                if len(admins)<=1 and mail in admins: return {'error':'last_admin'}

        rec={'telefono':'+'+telKey,'nombre':nombre,'email':mail,'esAdmin':bool(esAdmin),'lider':list(misiones),'idioma':'es'}
        if idx>=0: self.rows[idx]=rec
        else: self.rows.append(rec)
        return {'ok':True}

    def del_usuario(self, admin_email, telefono):
        if not self.is_admin(admin_email): return {'error':'forbidden_admin'}
        k=norm(telefono); idx=self._find_by_tel(k)
        if idx<0: return {'error':'sin_telefono'}
        r=self.rows[idx]
        if es_admin_flag(r.get('esAdmin')) and str(r.get('email','')).strip():
            admins=self.permisos()['admins']
            if len(admins)<=1 and str(r['email']).lower() in admins: return {'error':'last_admin'}
        self.rows=[x for i,x in enumerate(self.rows) if i!=idx]
        return {'ok':True}

# ================= TESTES =================
PASS=0; FAIL=0
def check(nome, cond):
    global PASS,FAIL
    if cond: PASS+=1; print(f"  ✓ {nome}")
    else: FAIL+=1; print(f"  ✗ FALHOU: {nome}")

ADMIN='rogerio.s.ono@gmail.com'

print("CASO 1 — Login por teléfono reconoce usuario creado por Admin")
b=Backend([{'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
b.save_usuario(ADMIN, '+34600555666', 'María', email='', esAdmin=False, misiones=[])
check("María creada sin email (voluntaria)", b._find_by_tel('34600555666')>=0)
check("María entra por teléfono (no pide nombre)", b.login_por_telefono('+34600555666')[0]=='ENTRA')

print("CASO 2 — Crear voluntario solo con nombre y teléfono (sin email) NO debe fallar")
b=Backend([{'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
r=b.save_usuario(ADMIN, '+34611222333', 'Ana', email='', esAdmin=False, misiones=[])
check("guarda OK sin email", r.get('ok')==True)

print("CASO 3 — Email obligatorio si Admin o Líder")
b=Backend([{'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
r=b.save_usuario(ADMIN, '+34611222333', 'Ana', email='', esAdmin=False, misiones=['banco'])
check("líder sin email → email_requerido", r.get('error')=='email_requerido')

print("CASO 4 — Editar NO debe crear duplicado (misma clave)")
b=Backend([{'telefono':'+34600555666','nombre':'María','email':'','esAdmin':False,'lider':[],'idioma':'es'},
           {'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
b.save_usuario(ADMIN,'+34600555666','María González', email='', telefonoAnterior='+34600555666')
check("sigue habiendo 2 filas (no duplicó)", len(b.rows)==2)
check("nombre actualizado", b.rows[0]['nombre']=='María González')

print("CASO 5 — Cambiar el teléfono de un usuario persiste y NO apaga otro")
b=Backend([{'telefono':'+34600555666','nombre':'María','email':'','esAdmin':False,'lider':[],'idioma':'es'},
           {'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
r=b.save_usuario(ADMIN,'+34611000000','María', email='', telefonoAnterior='+34600555666')
check("guarda OK", r.get('ok')==True)
check("María ahora tiene el nuevo número", b._find_by_tel('34611000000')>=0)
check("el número viejo ya no existe", b._find_by_tel('34600555666')<0)
check("Rogério (otro usuario) sigue intacto", b._find_by_tel('34999888777')>=0)
check("siguen siendo 2 usuarios", len(b.rows)==2)

print("CASO 6 — Cambiar a un teléfono que ya es de otro → rechaza")
b=Backend([{'telefono':'+34600555666','nombre':'María','email':'','esAdmin':False,'lider':[],'idioma':'es'},
           {'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
r=b.save_usuario(ADMIN,'+34999888777','María', email='', telefonoAnterior='+34600555666')
check("rechaza con telefono_en_uso", r.get('error')=='telefono_en_uso')
check("nada cambió (2 usuarios intactos)", len(b.rows)==2 and b._find_by_tel('34600555666')>=0)

print("CASO 7 — BUG REPORTADO: poner el email del Admin en OTRO usuario NO debe duplicar identidad")
b=Backend([{'telefono':'+34600555666','nombre':'María','email':'','esAdmin':False,'lider':[],'idioma':'es'},
           {'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
r=b.save_usuario(ADMIN,'+34600555666','María', email=ADMIN, telefonoAnterior='+34600555666')
check("rechaza con email_en_uso (el email ya es del Admin)", r.get('error')=='email_en_uso')
p=b.permisos()
check("sigue habiendo UN solo admin con ese email", p['admins'].count(ADMIN)==1)

print("CASO 8 — No dejar 0 admins (quitar admin al único)")
b=Backend([{'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
r=b.save_usuario(ADMIN,'+34999888777','Rogério', email=ADMIN, esAdmin=False, telefonoAnterior='+34999888777')
check("rechaza con last_admin", r.get('error')=='last_admin')

print("CASO 9 — Login (auto-registro) no pisa roles existentes")
b=Backend([{'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':['banco'],'idioma':'es'}])
b.upsert_voluntario('+34999888777','Rogério Ono', email_explicito=ADMIN, email_verificado=ADMIN)
check("sigue siendo admin tras login", es_admin_flag(b.rows[0]['esAdmin']))
check("sigue siendo líder de banco tras login", b.rows[0]['lider']==['banco'])

print("CASO 11 — BUG REPORTADO: login por teléfono de OTRA persona con idToken del Admin en sesión NO estampa el email del Admin")
# María fue creada por el Admin (sin email). El Admin dejó su idToken en sesión (mf_idtoken).
# María loga por su número y completa su nombre → upsertVoluntario llega con email_verificado=Admin.
b=Backend([{'telefono':'+34600555666','nombre':'María','email':'','esAdmin':False,'lider':[],'idioma':'es'},
           {'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
# el cliente NO manda email explícito de María (ella no entró con Google), pero el token verificado es del Admin
b.upsert_voluntario('+34600555666','María', email_explicito='', email_verificado=ADMIN)
check("María NO recibió el email del Admin", str(b.rows[0].get('email','')).strip()=='')
check("María sigue NO siendo admin", not es_admin_flag(b.rows[0]['esAdmin']))
check("sigue habiendo UN solo admin (Rogério)", b.permisos()['admins']==[ADMIN])

print("CASO 12 — Login Google del PROPIO dueño sí fija su email (si no choca)")
b=Backend([{'telefono':'+34600555666','nombre':'María','email':'','esAdmin':False,'lider':[],'idioma':'es'}])
b.upsert_voluntario('+34600555666','María', email_explicito='maria@gmail.com', email_verificado='maria@gmail.com')
check("María fija su propio email", str(b.rows[0].get('email','')).lower()=='maria@gmail.com')
check("María NO se volvió admin por eso", not es_admin_flag(b.rows[0]['esAdmin']))

print("CASO 10 — Admin acumula roles (admin + líder + voluntario) en 1 fila")
b=Backend([{'telefono':'+34999888777','nombre':'Rogério','email':ADMIN,'esAdmin':True,'lider':[],'idioma':'es'}])
b.save_usuario(ADMIN,'+34999888777','Rogério', email=ADMIN, esAdmin=True, misiones=['banco','mercamadrid'], telefonoAnterior='+34999888777')
check("1 sola fila", len(b.rows)==1)
p=b.permisos()
check("es admin", ADMIN in p['admins'])
check("es líder de 2 misiones", sorted(p['lideres'].get(ADMIN,[]))==['banco','mercamadrid'])

print(f"\n===== RESULTADO: {PASS} passaram, {FAIL} falharam =====")
import sys; sys.exit(1 if FAIL else 0)
