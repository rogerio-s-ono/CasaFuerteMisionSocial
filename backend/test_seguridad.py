#!/usr/bin/env python3
"""
Suíte de segurança — espelha a lógica do Code.gs (sem rodar GAS):
_isLider, gates de líder/admin, _maskPull (token opaco), _verifyTelefono.
"""
import hashlib

PASS = 0; FAIL = 0
def check(n, c):
    global PASS, FAIL
    if c: PASS += 1; print('  \u2713', n)
    else: FAIL += 1; print('  \u2717 FALHOU:', n)

def norm_tel(t): return ''.join(ch for ch in str(t or '') if ch.isdigit())

# ---- permisos: admins + lideres{email:[mis]} ----
PERM = {'admins': ['admin@x.com'], 'lideres': {'lider@x.com': ['mercamadrid']}}
def is_admin(email): return bool(email) and email.lower() in PERM['admins']
def is_lider(email, mision=None):
    if not email: return False
    email = email.lower()
    if is_admin(email): return True
    mis = PERM['lideres'].get(email, [])
    if not mis: return False
    if not mision: return True
    return str(mision) in mis
def mision_de_activity(aid):
    s = str(aid or ''); c = s.find(':'); return s[:c] if c > 0 else ''

# espelha _telToken: 'v_'+12 hex de sha256('cfms:'+telnorm)
def tel_token(tel):
    k = norm_tel(tel)
    if not k: return ''
    h = hashlib.sha256(('cfms:'+k).encode()).hexdigest()
    return 'v_' + h[:12]

print("CASO 1 — _isLider")
check("admin é líder de tudo", is_lider('admin@x.com', 'banco') is True)
check("líder da missão certa", is_lider('lider@x.com', 'mercamadrid') is True)
check("líder NÃO de outra missão", is_lider('lider@x.com', 'banco') is False)
check("voluntário não é líder", is_lider('vol@x.com', 'mercamadrid') is False)
check("anônimo (sem email) não é líder", is_lider(None, 'mercamadrid') is False)
check("líder de alguma (sem missão)", is_lider('lider@x.com') is True)

print("CASO 2 — mision de activityId")
check("extrai misionId do activityId", mision_de_activity('mercamadrid:TMPL-2026-01-01') == 'mercamadrid')
check("activityId sem ':' → vazio", mision_de_activity('A1') == '')

print("CASO 3 — gate de ações de líder (checklist/suspender/cancelar)")
def gate_lider(email, activityId, misionId=None):
    mis = misionId or mision_de_activity(activityId)
    return 'ok' if is_lider(email, mis) else 'forbidden_lider'
check("admin passa", gate_lider('admin@x.com', 'banco:TMPL-x') == 'ok')
check("líder da missão passa", gate_lider('lider@x.com', 'mercamadrid:TMPL-x') == 'ok')
check("líder de outra missão barrado", gate_lider('lider@x.com', 'banco:TMPL-x') == 'forbidden_lider')
check("voluntário barrado", gate_lider('vol@x.com', 'mercamadrid:TMPL-x') == 'forbidden_lider')
check("anônimo barrado", gate_lider(None, 'mercamadrid:TMPL-x') == 'forbidden_lider')

print("CASO 4 — gate de inscribir (porLider/temp exige líder; auto-inscrição não)")
def gate_inscribir(email, porLider, temp, misionId):
    if porLider or temp:
        return 'ok' if is_lider(email, misionId) else 'forbidden_lider'
    return 'ok'  # auto-inscrição (fase 1) não exige
check("porLider sem ser líder → barrado", gate_inscribir('vol@x.com', True, False, 'mercamadrid') == 'forbidden_lider')
check("temp sem ser líder → barrado", gate_inscribir('vol@x.com', False, True, 'mercamadrid') == 'forbidden_lider')
check("líder inscreve terceiro → ok", gate_inscribir('lider@x.com', True, False, 'mercamadrid') == 'ok')
check("auto-inscrição → ok", gate_inscribir('vol@x.com', False, False, 'mercamadrid') == 'ok')

print("CASO 5 — _maskPull: líder/admin vê número real; voluntário vê token; próprio vê o seu")
def mask_pull(voluntarios, inscripciones, email):
    if is_lider(email):
        return voluntarios, inscripciones  # sem máscara
    me = (email or '').lower().strip()
    mi_tel = ''
    for r in voluntarios:
        if (r.get('email') or '').lower().strip() == me: mi_tel = norm_tel(r.get('telefono'))
    def keep(t): return bool(mi_tel) and norm_tel(t) == mi_tel
    vol2 = [dict(r, telefono=(r['telefono'] if keep(r.get('telefono')) else tel_token(r.get('telefono')))) for r in voluntarios]
    ins2 = []
    for r in inscripciones:
        v = r.get('voluntario','')
        nv = v if (str(v).startswith('temp:') or keep(v)) else tel_token(v)
        ins2.append(dict(r, voluntario=nv))
    return vol2, ins2

vols = [
    {'telefono':'34600111222','nombre':'Ana','email':'ana@x.com'},
    {'telefono':'34600333444','nombre':'Luis','email':'lider@x.com'},
]
inscr = [{'voluntario':'34600111222','rol':'prep'}, {'voluntario':'temp:abc','nombre':'Invitado','rol':'prep'}]

# líder → números reais
vL, iL = mask_pull(vols, inscr, 'lider@x.com')
check("líder vê telefono real", vL[0]['telefono'] == '34600111222')
check("líder vê voluntario real na inscrição", iL[0]['voluntario'] == '34600111222')

# voluntário Ana (logada) → vê o SEU número, mas o de Luis vem como token
vV, iV = mask_pull(vols, inscr, 'ana@x.com')
check("Ana vê o PRÓPRIO número", vV[0]['telefono'] == '34600111222')
check("Ana vê Luis como TOKEN", vV[1]['telefono'].startswith('v_') and vV[1]['telefono'] != '34600333444')
check("inscrição de Ana (própria) real", iV[0]['voluntario'] == '34600111222')
check("temp não é tokenizado", iV[1]['voluntario'] == 'temp:abc')

# anônimo → tudo token
vA, iA = mask_pull(vols, inscr, None)
check("anônimo: Ana vem como token", vA[0]['telefono'].startswith('v_'))
check("anônimo: nenhum número cru", all(not v['telefono'].isdigit() for v in vA))
check("token é ESTÁVEL (mesmo tel → mesmo token)", tel_token('34600111222') == tel_token('+34 600 111 222'))

print("CASO 6 — _verifyTelefono: existe/não existe sem expor lista")
def verify_tel(tel, usuarios):
    k = norm_tel(tel)
    if not k: return {'ok':False,'error':'sin_telefono'}
    for r in usuarios:
        if norm_tel(r['telefono']) == k:
            return {'ok':True,'existe':True,'nombre':r['nombre'],'token':tel_token(k),'email':r.get('email','')}
    return {'ok':True,'existe':False}
r1 = verify_tel('+34 600 111 222', vols)
check("existe → nombre certo", r1['existe'] and r1['nombre']=='Ana')
check("existe → token estável", r1['token'] == tel_token('34600111222'))
check("não existe → existe:false", verify_tel('34699999999', vols).get('existe') is False)
check("sem telefone → erro", verify_tel('', vols).get('error') == 'sin_telefono')

print(f"\n===== RESULTADO: {PASS} passaram, {FAIL} falharam =====")
import sys; sys.exit(1 if FAIL else 0)
