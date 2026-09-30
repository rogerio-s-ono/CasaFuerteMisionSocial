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
    def inscribir(self, activityId, rol, capacidad=0, voluntario='', nombre='', temp=False, porLider=False, email=''):
        if not activityId or not rol: return {'error':'datos_incompletos'}
        esTemp=bool(temp)
        vol = ('temp:'+uuid()) if esTemp else norm(voluntario)
        nombre=(nombre or '').strip()
        if not esTemp and not vol: return {'error':'datos_incompletos'}
        if esTemp and not nombre: return {'error':'datos_incompletos'}
        if not esTemp:
            ya=any(r for r in self.rows if r['activityId']==activityId and r['rol']==rol and str(r['voluntario'])==vol and r['estado']!='cancelado')
            if ya: return {'ok':True,'estado':'confirmado','dup':True}
        conf=len([r for r in self.rows if r['activityId']==activityId and r['rol']==rol and r['estado']=='confirmado'])
        cap=int(capacidad or 0)
        estado='espera' if (cap>0 and conf>=cap) else 'confirmado'
        _id=uuid()
        self.rows.append({'id':_id,'activityId':activityId,'rol':rol,'voluntario':vol,'nombre':nombre,'temp':esTemp,'estado':estado,'porLider':porLider})
        return {'ok':True,'estado':estado,'id':_id,'voluntario':vol}
    def cancelar(self, id=None, activityId=None, rol=None, voluntario=None):
        idx=-1
        if id:
            idx=next((i for i,r in enumerate(self.rows) if str(r['id'])==str(id) and r['estado']!='cancelado'), -1)
        if idx<0:
            vk = str(voluntario) if (voluntario and str(voluntario).startswith('temp:')) else norm(voluntario)
            idx=next((i for i,r in enumerate(self.rows) if r['activityId']==activityId and r['rol']==rol and str(r['voluntario'])==vk and r['estado']!='cancelado'), -1)
        if idx<0: return {'ok':True,'dup':True}
        self.rows[idx]['estado']='cancelado'
        return {'ok':True}
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
            row['estado']='suspendido'; return {'ok':True,'estado':'suspendido'}
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

print(f"\n===== RESULTADO: {PASS} passaram, {FAIL} falharam =====")
import sys; sys.exit(1 if FAIL else 0)
