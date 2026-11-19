#!/usr/bin/env python3
"""
제품 상세 정보 엑셀 — 만들기(make) / 사이트에 넣기(import).

  python3 scripts/product-info-sheet.py make  LAGI_제품정보_입력.xlsx     # 빈 입력용 엑셀을 만든다 (옷 제품 전체)
  python3 scripts/product-info-sheet.py import LAGI_제품정보_입력.xlsx    # 채운 엑셀을 product.json 에 넣는다

채워진 칸만 들어가고(상태 VERIFIED, 출처 '사용자 제공 (날짜)'), 비어 있는 칸은 사이트에 '정보 준비 중'으로 남는다.
아무것도 추측해서 넣지 않는다.
"""
import json, glob, sys, datetime, os
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INFO = ['이 옷의 이야기', '라기가 고른 이유', '제조국', '만든 곳 (제조자/수입자)', '만드는 과정', '원단 (소재·혼용률)', '원단 특징', '색상',
        '세탁방법 및 취급시 주의사항', '제조연월', '품질보증기준', 'A/S 책임자와 전화번호', '판매 사이즈 (예: S, M, L)']
SIZE_COLS = ['총장', '어깨너비', '가슴단면', '소매길이', '허리단면', '엉덩이단면', '허벅지단면', '밑위', '밑단단면']
BLUE = PatternFill('solid', fgColor='1D5198')

def products():
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'public/products/*/product.json'))):
        p = json.load(open(f, encoding='utf-8'))
        if (p.get('category') or {}).get('value') in ('Top', 'Bottom', 'Set', 'Outer', 'Dress'):
            out.append((f, p))
    return out

def make(path):
    wb = Workbook()
    ws = wb.active; ws.title = '제품 정보'
    head = ['제품 ID (수정 금지)', '제품명', '구성'] + INFO
    ws.append(head)
    for _, p in products():
        ws.append([p['id'], p['name']['value'], ' + '.join(p.get('setItems') or [])] + [''] * len(INFO))
    sz = wb.create_sheet('사이즈표')
    sz.append(['제품 ID (수정 금지)', '제품명', '부위 (상의/하의)', '사이즈'] + SIZE_COLS)
    for _, p in products():
        parts = ['상의', '하의'] if p['category']['value'] == 'Set' else ['상의' if p['category']['value'] != 'Bottom' else '하의']
        for part in parts:
            for s in ('S', 'M', 'L'):
                sz.append([p['id'], p['name']['value'], part, s] + [''] * len(SIZE_COLS))
    guide = wb.create_sheet('작성 방법')
    for line in ['1. "제품 정보" 시트: 아는 것만 적으세요. 모르는 칸은 비워 두면 사이트에 "정보 준비 중"으로 나옵니다.',
                 '2. "사이즈표" 시트: 단위는 cm, 숫자만 적으세요. 사이즈가 S·M·L이 아니면 사이즈 칸을 고치고 줄을 늘리거나 지우세요. 해당 없는 부위(예: 상의의 밑위)는 비워 두세요.',
                 '3. 상품 정보 제공 고시(법정 필수): 원단(소재·혼용률), 색상, 치수(판매 사이즈), 만든 곳, 제조국, 세탁방법, 제조연월, 품질보증기준, A/S 책임자와 전화번호.',
                 '   품질보증기준 예: "관련 법 및 소비자분쟁해결기준에 따라 보상합니다."',
                 '4. 제품 ID와 제품명 칸은 고치지 마세요.']:
        guide.append([line])
    for w in (ws, sz):
        for c in w[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = BLUE; c.alignment = Alignment(wrap_text=True, vertical='center')
        for i in range(1, w.max_column + 1): w.column_dimensions[get_column_letter(i)].width = 14 if w is sz else 26
        w.freeze_panes = 'C2' if w is ws else 'E2'
    ws.column_dimensions['A'].width = 30; sz.column_dimensions['A'].width = 30
    guide.column_dimensions['A'].width = 140
    wb.save(path); print('written', path)

def v(x, src):
    return {'value': str(x).strip(), 'status': 'VERIFIED', 'source': src}

def num(x):
    if x is None or str(x).strip() == '': return None
    try:
        f = float(str(x).strip()); return int(f) if f.is_integer() else f
    except ValueError:
        return str(x).strip()

def imp(path):
    wb = load_workbook(path, data_only=True); src = f'사용자 제공 ({datetime.date.today().isoformat()})'
    rows = {r[0]: r for r in wb['제품 정보'].iter_rows(min_row=2, values_only=True) if r and r[0]}
    charts = {}
    for r in wb['사이즈표'].iter_rows(min_row=2, values_only=True):
        if not r or not r[0] or not r[3]: continue
        vals = [num(x) for x in r[4:4 + len(SIZE_COLS)]]
        if all(x is None for x in vals): continue
        charts.setdefault(r[0], []).append((r[2] or '', str(r[3]).strip(), vals))
    n = 0
    for f, p in products():
        r = rows.get(p['id']); ch = charts.get(p['id'])
        if not r and not ch: continue
        before = json.dumps(p, ensure_ascii=False, sort_keys=True)
        d = dict(zip(INFO, r[3:3 + len(INFO)])) if r else {}
        has = lambda k: d.get(k) not in (None, '')
        if has('이 옷의 이야기'): p['story'] = v(d['이 옷의 이야기'], src)
        if has('라기가 고른 이유'): p['lagiSelectionReason'] = v(d['라기가 고른 이유'], src)
        mk = p.get('making') or {}
        if has('제조국'): mk['country'] = v(d['제조국'], src)
        if has('만든 곳 (제조자/수입자)'): mk['maker'] = v(d['만든 곳 (제조자/수입자)'], src)
        if has('만드는 과정'): mk['how'] = v(d['만드는 과정'], src)
        if mk: p['making'] = mk
        if has('원단 (소재·혼용률)'):
            p['materials'] = [{'name': v(d['원단 (소재·혼용률)'], src), 'characteristics': v(d['원단 특징'], src) if has('원단 특징') else {'value': None, 'status': 'CONTENT_REQUIRED'},
                               'productLocation': {'value': None, 'status': 'CONTENT_REQUIRED'}, 'reasonForUse': {'value': None, 'status': 'CONTENT_REQUIRED'}}]
        if has('세탁방법 및 취급시 주의사항'): p['care'] = v(d['세탁방법 및 취급시 주의사항'], src)
        notice = p.get('notice') or {}
        for key, col in [('제품 소재', '원단 (소재·혼용률)'), ('색상', '색상'), ('치수', '판매 사이즈 (예: S, M, L)'), ('제조자 / 수입자', '만든 곳 (제조자/수입자)'), ('제조국', '제조국'),
                         ('세탁방법 및 취급시 주의사항', '세탁방법 및 취급시 주의사항'), ('제조연월', '제조연월'), ('품질보증기준', '품질보증기준'), ('A/S 책임자와 전화번호', 'A/S 책임자와 전화번호')]:
            if has(col): notice[key] = v(d[col], src)
        if notice: p['notice'] = notice
        if has('판매 사이즈 (예: S, M, L)'):
            sizes = [s.strip() for s in str(d['판매 사이즈 (예: S, M, L)']).replace('/', ',').split(',') if s.strip()]
            p['variants'] = [{'id': f"{p['id']}-{s.lower()}", 'size': s, 'color': None, 'stock': None} for s in sizes]
        if ch:
            used = [i for i in range(len(SIZE_COLS)) if any(row[2][i] is not None for row in ch)]
            multi = len({row[0] for row in ch}) > 1
            p['sizeChart'] = {'unit': 'cm', 'columns': [SIZE_COLS[i] for i in used],
                              'rows': [{'size': (f'{row[0]} ' if multi else '') + row[1], 'values': [row[2][i] for i in used]} for row in ch], 'source': src}
        if json.dumps(p, ensure_ascii=False, sort_keys=True) == before: continue
        json.dump(p, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2); open(f, 'a').write('\n'); n += 1
        print('updated', p['id'])
    print(n, 'product(s) updated')

if __name__ == '__main__':
    {'make': make, 'import': imp}[sys.argv[1]](sys.argv[2])
