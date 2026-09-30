#!/usr/bin/env python3
"""
Suíte de regressão — asignación de voluntarios a tareas (aba Inscripciones).
Simula la lógica del backend Code.gs (_inscribir, _cancelar) para los flujos:
inscribir real, inscribir temporal, cupo/espera, duplicado, cancelar por id y por voluntario.
Rodar:  python3 backend/test_asignacion.py
"""
import re
def norm(t): return re.sub(r'[^0-9]','', str(t if t is not None else ''))

_uid=[0]
def uuid():
    _uid[0]+=1; return 'id%03d'%_uid[0]

class Insc:
    def __init__(self): self.rows=[]
    def inscribir(self, activityId, rol, capacidad=0, voluntario='', nombre='', temp=False, porLider=False, email='', tel=''):
        if not activityId or not rol: return {'error':'datos_incompletos'}
        esTemp=bool(temp)
        vol = ('temp:'+uuid()) if esTemp else norm(voluntario)
        nombre=(nombre or '').strip()
        telp = norm(tel)   # teléfono del temporal (para real ya va en voluntario)
        if not esTemp and not vol: return {'error':'datos_incompletos'}
        if esTemp and not nombre: return {'error':'datos_incompletos'}
        if not esTemp:
            ya=any(r for r in self.rows if r['activityId']==activityId and r['rol']==rol and str(r['voluntario'])==vol and r['estado']!='cancelado')
            if ya: return {'ok':True,'estado':'confirmado','dup':True}
        conf=len([r for r in self.rows if r['activityId']==activityId and r['rol']==rol and r['estado']=='confirmado'])
        cap=int(capacidad or 0)
        estado='espera' if (cap>0 and conf>=cap) else 'confirmado'
        _id=uuid()
        self.rows.append({'id':_id,'activityId':activityId,'rol':rol,'voluntario':vol,'nombre':nombre,'tel':telp,'temp':esTemp,'estado':estado,'porLider':porLider,'creadoEm':_id})
        return {'ok':True,'estado':estado,'id':_id,'voluntario':vol}
    def promover_espera(self, activityId, rol, capacidad):
        cap=int(capacidad or 0)
        if cap<=0: return []
        conf=len([r for r in self.rows if r['activityId']==activityId and r['rol']==rol and r['estado']=='confirmado'])
        libres=cap-conf
        if libres<=0: return []
        espera=sorted([r for r in self.rows if r['activityId']==activityId and r['rol']==rol and r['estado']=='espera'], key=lambda r:str(r['creadoEm']))
        prom=[]
        for r in espera[:libres]:
            r['estado']='confirmado'; prom.append({'id':r['id'],'voluntario':r['voluntario']})
        return prom
    def cancelar(self, id=None, activityId=None, rol=None, voluntario=None, capacidad=0):
        idx=-1
        if id:
            idx=next((i for i,r in enumerate(self.rows) if str(r['id'])==str(id) and r['estado']!='cancelado'), -1)
        if idx<0:
            vk = str(voluntario) if (voluntario and str(voluntario).startswith('temp:')) else norm(voluntario)
            idx=next((i for i,r in enumerate(self.rows) if r['activityId']==activityId and r['rol']==rol and str(r['voluntario'])==vk and r['estado']!='cancelado'), -1)
        if idx<0: return {'ok':True,'dup':True}
        eraConf = (self.rows[idx]['estado']=='confirmado')
        aid=self.rows[idx]['activityId']; arol=self.rows[idx]['rol']
        self.rows[idx]['estado']='cancelado'
        prom = self.promover_espera(aid, arol, capacidad) if eraConf else []
        return {'ok':True,'promovidos':prom}
    def set_estado(self, accion, id=None, activityId=None, rol=None, voluntario=None, capacidad=0):
        if accion not in ('suspender','reactivar'): return {'error':'accion_invalida'}
        idx=-1
        if id: idx=next((i for i,r in enumerate(self.rows) if str(r['id'])==str(id) and r['estado']!='cancelado'), -1)
        if idx<0:
            vk = str(voluntario) if (voluntario and str(voluntario).startswith('temp:')) else norm(voluntario)
            idx=next((i for i,r in enumerate(self.rows) if r['activityId']==activityId and r['rol']==rol and str(r['voluntario'])==vk and r['estado']!='cancelado'), -1)
        if idx<0: return {'error':'no_encontrado'}
        row=self.rows[idx]
        if accion=='suspender':
            row['estado']='suspendido'
            prom=self.promover_espera(row['activityId'], row['rol'], capacidad)
            return {'ok':True,'estado':'suspendido','promovidos':prom}
        cap=int(capacidad or 0)
        conf=len([r for j,r in enumerate(self.rows) if j!=idx and r['activityId']==row['activityId'] and r['rol']==row['rol'] and r['estado']=='confirmado'])
        nuevo='espera' if (cap>0 and conf>=cap) else 'confirmado'
        row['estado']=nuevo; return {'ok':True,'estado':nuevo}
    def confirmados(self, activityId, rol):
        return [r for r in self.rows if r['activityId']==activityId and r['rol']==rol and r['estado']=='confirmado']

PASS=0; FAIL=0
def check(n,c):
    global PASS,FAIL
    if c: PASS+=1; print('  ✓',n)
    else: FAIL+=1; print('  ✗ FALHOU:',n)

print("CASO 1 — Voluntario se inscribe (real, con teléfono)")
b=Insc(); r=b.inscribir('A1-2026-01-01','preparacao',capacidad=6,voluntario='+34600555666')
check("estado confirmado", r.get('estado')=='confirmado')
check("1 confirmado", len(b.confirmados('A1-2026-01-01','preparacao'))==1)

print("CASO 2 — Líder añade voluntario real (persiste igual que inscribir)")
b=Insc(); r=b.inscribir('A1-2026-01-01','preparacao',capacidad=6,voluntario='+34611222333',porLider=True)
check("guardado por líder", r.get('ok') and b.rows[0]['porLider']==True)

print("CASO 3 — Líder añade TEMPORAL (sin teléfono, con nombre)")
b=Insc(); r=b.inscribir('A1-2026-01-01','preparacao',capacidad=6,temp=True,nombre='Juan Invitado',porLider=True)
check("estado confirmado", r.get('estado')=='confirmado')
check("voluntario es id sintético temp:", str(r.get('voluntario')).startswith('temp:'))
check("guarda el nombre", b.rows[0]['nombre']=='Juan Invitado')

print("CASO 4 — Temporal sin nombre → rechaza")
b=Insc(); r=b.inscribir('A1','preparacao',temp=True,nombre='')
check("datos_incompletos", r.get('error')=='datos_incompletos')

print("CASO 5 — Cupo lleno → siguiente entra en ESPERA")
b=Insc()
b.inscribir('A1','motorista',capacidad=2,voluntario='+34600000001')
b.inscribir('A1','motorista',capacidad=2,voluntario='+34600000002')
r=b.inscribir('A1','motorista',capacidad=2,voluntario='+34600000003')
check("3º va a espera", r.get('estado')=='espera')
check("solo 2 confirmados", len(b.confirmados('A1','motorista'))==2)

print("CASO 6 — Duplicado (mismo voluntario, misma tarea) no crea 2ª fila")
b=Insc()
b.inscribir('A1','preparacao',capacidad=6,voluntario='+34600555666')
r=b.inscribir('A1','preparacao',capacidad=6,voluntario='+34600555666')
check("marca dup", r.get('dup')==True)
check("sigue 1 confirmado", len(b.confirmados('A1','preparacao'))==1)

print("CASO 7 — Cancelar por voluntario (real) libera la plaza")
b=Insc()
b.inscribir('A1','preparacao',capacidad=6,voluntario='+34600555666')
r=b.cancelar(activityId='A1',rol='preparacao',voluntario='+34600555666')
check("cancelado ok", r.get('ok'))
check("0 confirmados", len(b.confirmados('A1','preparacao'))==0)

print("CASO 8 — Cancelar TEMPORAL por id (no tiene teléfono)")
b=Insc()
res=b.inscribir('A1','preparacao',capacidad=6,temp=True,nombre='Juan',porLider=True)
r=b.cancelar(id=res['id'])
check("cancelado por id", r.get('ok'))
check("0 confirmados", len(b.confirmados('A1','preparacao'))==0)

print("CASO 9 — Cancelar libera plaza y permite entrar a otro (sin sobrecupo)")
b=Insc()
b.inscribir('A1','motorista',capacidad=1,voluntario='+34600000001')
r2=b.inscribir('A1','motorista',capacidad=1,voluntario='+34600000002')  # espera
check("2º en espera", r2.get('estado')=='espera')
b.cancelar(activityId='A1',rol='motorista',voluntario='+34600000001')    # libera
# al recontar, un nuevo inscrito entraría confirmado
r3=b.inscribir('A1','motorista',capacidad=1,voluntario='+34600000003')
check("nuevo entra confirmado tras liberar", r3.get('estado')=='confirmado')

print("CASO 10 — Dos temporales con el mismo nombre son inscripciones distintas")
b=Insc()
r1=b.inscribir('A1','preparacao',capacidad=6,temp=True,nombre='Invitado',porLider=True)
r2=b.inscribir('A1','preparacao',capacidad=6,temp=True,nombre='Invitado',porLider=True)
check("dos filas distintas (ids distintos)", r1['id']!=r2['id'])
check("2 confirmados", len(b.confirmados('A1','preparacao'))==2)

print("CASO 11 — Suspender libera la plaza (no cuenta en el cupo)")
b=Insc()
b.inscribir('A1','prep',capacidad=2,voluntario='+34600000001')
r=b.inscribir('A1','prep',capacidad=2,voluntario='+34600000002')
check("2/2 confirmados", len(b.confirmados('A1','prep'))==2)
res=b.set_estado('suspender', activityId='A1', rol='prep', voluntario='+34600000001')
check("suspendido", res.get('estado')=='suspendido')
check("ahora 1 confirmado (plaza liberada)", len(b.confirmados('A1','prep'))==1)
r3=b.inscribir('A1','prep',capacidad=2,voluntario='+34600000003')
check("otro entra confirmado en la plaza liberada", r3.get('estado')=='confirmado')

print("CASO 12 — Reactivar con plaza libre → confirmado")
b=Insc()
r1=b.inscribir('A1','prep',capacidad=3,voluntario='+34600000001')
b.set_estado('suspender', id=r1['id'])
res=b.set_estado('reactivar', id=r1['id'], capacidad=3)
check("reactivado confirmado", res.get('estado')=='confirmado')
check("1 confirmado", len(b.confirmados('A1','prep'))==1)

print("CASO 13 — Reactivar con cupo LLENO → espera")
b=Insc()
r1=b.inscribir('A1','motor',capacidad=1,voluntario='+34600000001')
b.set_estado('suspender', id=r1['id'])                          # libera
b.inscribir('A1','motor',capacidad=1,voluntario='+34600000002') # otro ocupa la única plaza
res=b.set_estado('reactivar', id=r1['id'], capacidad=1)         # ya no hay sitio
check("reactivar lleno → espera", res.get('estado')=='espera')
check("solo 1 confirmado", len(b.confirmados('A1','motor'))==1)

print("CASO 14 — Eliminar un suspendido (definitivo)")
b=Insc()
r1=b.inscribir('A1','prep',capacidad=3,voluntario='+34600000001')
b.set_estado('suspender', id=r1['id'])
b.cancelar(id=r1['id'])
check("cancelado (no aparece en confirmados)", len(b.confirmados('A1','prep'))==0)
check("no reactivable tras cancelar", b.set_estado('reactivar', id=r1['id'], capacidad=3).get('error')=='no_encontrado')

print("CASO 15 — Suspender un temporal por id")
b=Insc()
res=b.inscribir('A1','prep',capacidad=6,temp=True,nombre='Invitado',porLider=True)
r=b.set_estado('suspender', id=res['id'])
check("temporal suspendido", r.get('estado')=='suspendido')
check("0 confirmados", len(b.confirmados('A1','prep'))==0)

print("CASO 16 — Temporal CON teléfono → se guarda en columna 'tel' (voluntario sigue siendo id sintético)")
b=Insc()
res=b.inscribir('A1','prep',capacidad=6,temp=True,nombre='Invitado con móvil',tel='+34600111222',porLider=True)
check("inscrito ok", res.get('ok') and res.get('estado')=='confirmado')
check("voluntario es id sintético temp:", str(res.get('voluntario')).startswith('temp:'))
check("tel guardado (solo dígitos)", b.rows[0].get('tel')=='34600111222')
check("real (no temp) no llena 'tel'", (lambda r=b.inscribir('A1','prep',capacidad=6,voluntario='+34699888777'): b.rows[1].get('tel')=='')())

print("CASO 16 — Cancelar un confirmado promueve al 1º de la espera (FIFO)")
b=Insc()
r1=b.inscribir('A1','motor',capacidad=1,voluntario='+34600000001')  # confirmado
r2=b.inscribir('A1','motor',capacidad=1,voluntario='+34600000002')  # espera (1º)
r3=b.inscribir('A1','motor',capacidad=1,voluntario='+34600000003')  # espera (2º)
check("cupo 1: solo 1 confirmado", len(b.confirmados('A1','motor'))==1)
res=b.cancelar(id=r1['id'], capacidad=1)
check("promueve exactamente 1", len(res.get('promovidos',[]))==1)
check("promueve al MÁS ANTIGUO (r2)", res['promovidos'][0]['id']==r2['id'])
check("sigue 1 confirmado", len(b.confirmados('A1','motor'))==1)
check("el confirmado ahora es r2", b.confirmados('A1','motor')[0]['id']==r2['id'])

print("CASO 17 — Suspender un confirmado también promueve la espera")
b=Insc()
r1=b.inscribir('A1','prep',capacidad=2,voluntario='+34600000001')
r2=b.inscribir('A1','prep',capacidad=2,voluntario='+34600000002')
r3=b.inscribir('A1','prep',capacidad=2,voluntario='+34600000003')  # espera
res=b.set_estado('suspender', id=r1['id'], capacidad=2)
check("promueve 1 al suspender", len(res.get('promovidos',[]))==1)
check("promovido es r3 (único en espera)", res['promovidos'][0]['id']==r3['id'])
check("2 confirmados (r2 + r3)", len(b.confirmados('A1','prep'))==2)

print("CASO 18 — Sin espera, cancelar no promueve a nadie")
b=Insc()
r1=b.inscribir('A1','prep',capacidad=3,voluntario='+34600000001')
res=b.cancelar(id=r1['id'], capacidad=3)
check("promovidos vacío", len(res.get('promovidos',[]))==0)

print("CASO 19 — Cancelar a alguien en espera NO promueve (no liberó plaza)")
b=Insc()
b.inscribir('A1','motor',capacidad=1,voluntario='+34600000001')     # confirmado
r2=b.inscribir('A1','motor',capacidad=1,voluntario='+34600000002')  # espera
res=b.cancelar(id=r2['id'], capacidad=1)
check("no promueve (el que salió no ocupaba plaza)", len(res.get('promovidos',[]))==0)
check("sigue 1 confirmado", len(b.confirmados('A1','motor'))==1)

print(f"\n===== RESULTADO: {PASS} passaram, {FAIL} falharam =====")
import sys; sys.exit(1 if FAIL else 0)
