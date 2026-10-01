#!/usr/bin/env python3
"""
Suíte de regressão — checklist persistente (aba Checklists, Fase 4).
Simula la lógica del backend Code.gs (_setChecklistItem UPSERT, _delChecklistItem)
y la fusión por fecha del frontend (mergeChecklistsFromServer), sin ejecutar GAS.

Modelo de la aba Checklists (una fila por activityId+itemId):
  activityId, itemId, texto, hecho, hechoPor, asignado(JSON), suelto, actualizadoEm
"""
import json, itertools

PASS = 0; FAIL = 0
def check(n, c):
    global PASS, FAIL
    if c: PASS += 1; print('  \u2713', n)
    else: FAIL += 1; print('  \u2717 FALHOU:', n)

_clock = itertools.count(1)
def _now():
    return '2026-10-01T00:00:%02dZ' % next(_clock)   # ISO monótono para el merge por fecha

# ---------- Backend: aba Checklists ----------
class Chk:
    def __init__(self): self.rows = []
    def _idx(self, activityId, itemId):
        return next((i for i, r in enumerate(self.rows)
                     if r['activityId'] == activityId and r['itemId'] == itemId), -1)
    def set_item(self, item):
        c = item or {}
        if not c.get('activityId') or not c.get('itemId'):
            return {'ok': False, 'error': 'datos_incompletos'}
        rec = {
            'activityId': c['activityId'], 'itemId': c['itemId'], 'texto': c.get('texto', ''),
            'hecho': bool(c.get('hecho')), 'hechoPor': c.get('hechoPor', ''),
            'asignado': json.dumps(c.get('asignado')), 'suelto': bool(c.get('suelto')),
            'na': bool(c.get('na')), 'comentario': c.get('comentario', ''),
            'actualizadoEm': _now(),
        }
        idx = self._idx(c['activityId'], c['itemId'])
        if idx >= 0: self.rows[idx] = rec
        else: self.rows.append(rec)
        return {'ok': True}
    def del_item(self, item):
        c = item or {}
        if not c.get('activityId') or not c.get('itemId'):
            return {'ok': False, 'error': 'datos_incompletos'}
        idx = self._idx(c['activityId'], c['itemId'])
        if idx < 0: return {'ok': True, 'dup': True}   # idempotente
        self.rows.pop(idx)
        return {'ok': True}
    def pull(self): return list(self.rows)

# ---------- Frontend: merge por actualizadoEm ----------
def _row_to_item(r):
    try: asg = json.loads(r['asignado']) if r.get('asignado') else None
    except Exception: asg = None
    return {'id': str(r['itemId']), 'texto': r.get('texto', ''),
            'done': bool(r.get('hecho')), 'doneBy': r.get('hechoPor') or None,
            'asignado': asg, 'suelto': bool(r.get('suelto')),
            'na': bool(r.get('na')), 'comentario': r.get('comentario', ''),
            'actualizadoEm': r.get('actualizadoEm', '')}

def merge_from_server(CHK, rows):
    srv = {}
    for r in rows:
        if not r.get('activityId') or not r.get('itemId'): continue
        srv.setdefault(r['activityId'], []).append(_row_to_item(r))
    for actId, sitems in srv.items():
        by = {it['id']: it for it in CHK.get(actId, {}).get('items', [])}
        for sit in sitems:
            lit = by.get(sit['id'])
            if lit is None: by[sit['id']] = sit
            elif (sit['actualizadoEm'] or '') >= (lit['actualizadoEm'] or ''): by[sit['id']] = sit
        CHK[actId] = {'items': list(by.values())}
    return CHK

print("CASO 1 — Upsert crea la fila")
b = Chk(); b.set_item({'activityId': 'A1', 'itemId': 't1', 'texto': 'Cargar furgoneta', 'hecho': False})
check("1 fila", len(b.pull()) == 1)
check("no hecho", b.pull()[0]['hecho'] is False)

print("CASO 2 — Upsert actualiza (no duplica) el mismo activityId+itemId")
b.set_item({'activityId': 'A1', 'itemId': 't1', 'texto': 'Cargar furgoneta', 'hecho': True, 'hechoPor': 'Rogerio'})
check("sigue 1 fila", len(b.pull()) == 1)
check("ahora hecho", b.pull()[0]['hecho'] is True)
check("hechoPor guardado", b.pull()[0]['hechoPor'] == 'Rogerio')

print("CASO 3 — Asignado se serializa como JSON")
b.set_item({'activityId': 'A1', 'itemId': 't1', 'asignado': {'name': 'Ana', 'temp': False}})
check("asignado JSON parseable", json.loads(b.pull()[0]['asignado'])['name'] == 'Ana')

print("CASO 4 — Item suelto")
b.set_item({'activityId': 'A1', 'itemId': 'x99', 'texto': 'Comprar hielo', 'suelto': True})
check("2 filas", len(b.pull()) == 2)
check("marcado suelto", [r for r in b.pull() if r['itemId'] == 'x99'][0]['suelto'] is True)

print("CASO 5 — Delete elimina la fila")
r = b.del_item({'activityId': 'A1', 'itemId': 'x99'})
check("delete ok", r.get('ok') is True)
check("1 fila tras borrar", len(b.pull()) == 1)

print("CASO 6 — Delete idempotente (borrar lo inexistente no falla)")
r = b.del_item({'activityId': 'A1', 'itemId': 'noexiste'})
check("ok + dup", r.get('ok') is True and r.get('dup') is True)

print("CASO 7 — datos incompletos")
check("set sin itemId falla", b.set_item({'activityId': 'A1'}).get('error') == 'datos_incompletos')
check("del sin activityId falla", b.del_item({'itemId': 't1'}).get('error') == 'datos_incompletos')

print("CASO 8 — Merge: servidor gana cuando es más reciente")
srv = Chk()
srv.set_item({'activityId': 'A1', 'itemId': 't1', 'hecho': True, 'hechoPor': 'Servidor'})
CHK = {'A1': {'items': [{'id': 't1', 'texto': 'x', 'done': False, 'doneBy': None,
                          'asignado': None, 'suelto': False, 'actualizadoEm': '2026-09-01T00:00:00Z'}]}}
merge_from_server(CHK, srv.pull())
it = CHK['A1']['items'][0]
check("servidor reciente gana (done=True)", it['done'] is True)
check("doneBy del servidor", it['doneBy'] == 'Servidor')

print("CASO 9 — Merge: local más reciente se mantiene (edición offline no pisada)")
srv2 = Chk()
srv2.rows.append({'activityId': 'A1', 'itemId': 't1', 'texto': 'x', 'hecho': False, 'hechoPor': '',
                  'asignado': 'null', 'suelto': False, 'actualizadoEm': '2026-09-01T00:00:00Z'})
CHK2 = {'A1': {'items': [{'id': 't1', 'texto': 'x', 'done': True, 'doneBy': 'Yo offline',
                           'asignado': None, 'suelto': False, 'actualizadoEm': '2026-12-31T23:59:59Z'}]}}
merge_from_server(CHK2, srv2.pull())
it2 = CHK2['A1']['items'][0]
check("local reciente se mantiene (done=True)", it2['done'] is True)
check("doneBy local intacto", it2['doneBy'] == 'Yo offline')

print("CASO 10 — Merge: item nuevo del servidor se añade")
srv3 = Chk(); srv3.set_item({'activityId': 'B1', 'itemId': 'n1', 'texto': 'Nuevo', 'hecho': False})
CHK3 = {}
merge_from_server(CHK3, srv3.pull())
check("item del servidor incorporado", CHK3.get('B1', {}).get('items', [{}])[0].get('id') == 'n1')

print("CASO 11 — N/A se persiste")
b = Chk(); b.set_item({'activityId': 'A1', 'itemId': 't1', 'texto': 'x', 'na': True})
check("na=True guardado", b.pull()[0]['na'] is True)

print("CASO 12 — N/A y hecho mutuamente excluyentes (lógica del toggle N/A)")
# simula chkToggleNA: al marcar na, se limpia hecho
def toggle_na(item):
    item['na'] = not item.get('na')
    if item['na']: item['done'] = False; item['doneBy'] = None
    return item
it = {'id': 't1', 'done': True, 'doneBy': 'Ana', 'na': False}
toggle_na(it)
check("na activado quita done", it['done'] is False and it['na'] is True)
check("doneBy limpiado", it['doneBy'] is None)

print("CASO 13 — Comentario se persiste")
b = Chk(); b.set_item({'activityId': 'A1', 'itemId': 't1', 'texto': 'x', 'comentario': 'Traer guantes'})
check("comentario guardado", b.pull()[0]['comentario'] == 'Traer guantes')
b.set_item({'activityId': 'A1', 'itemId': 't1', 'texto': 'x', 'comentario': 'Editado'})
check("comentario editable (upsert)", b.pull()[0]['comentario'] == 'Editado')

print("CASO 14 — Progreso ignora N/A (feitos / (total - na))")
def progreso(items):
    aplican = [i for i in items if not i.get('na')]
    done = len([i for i in aplican if i.get('done')])
    return (done, len(aplican))
items = [
    {'id': '1', 'done': True,  'na': False},
    {'id': '2', 'done': False, 'na': False},
    {'id': '3', 'done': False, 'na': True},   # N/A → fuera del conteo
]
d, t = progreso(items)
check("1 hecho de 2 aplicables (no 3)", d == 1 and t == 2)
# todos N/A → total 0 (no divide por cero en el front)
d2, t2 = progreso([{'id': 'x', 'done': False, 'na': True}])
check("todos N/A → total 0", t2 == 0)

print("CASO 15 — Merge trae na y comentario del servidor")
srvN = Chk(); srvN.set_item({'activityId': 'A1', 'itemId': 't1', 'na': True, 'comentario': 'desde servidor'})
CHKn = {}
merge_from_server(CHKn, srvN.pull())
itn = CHKn['A1']['items'][0]
check("na del servidor en merge", itn['na'] is True)
check("comentario del servidor en merge", itn['comentario'] == 'desde servidor')

print(f"\n===== RESULTADO: {PASS} passaram, {FAIL} falharam =====")
import sys; sys.exit(1 if FAIL else 0)
