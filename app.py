"""
분말 검사 시스템 - Flask 서버
Google Apps Script를 대체하는 로컬 웹서버
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime
from contextlib import closing

app = Flask(__name__)
CORS(app)

DATABASE = 'database.db'

# ============================================
# 데이터베이스 헬퍼 함수
# ============================================

def get_db():
    """데이터베이스 연결"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row  # 딕셔너리 형태로 반환
    return conn

def dict_from_row(row):
    """sqlite3.Row를 딕셔너리로 변환"""
    return dict(zip(row.keys(), row))

# ============================================
# 메인 페이지
# ============================================

@app.route('/')
def index():
    """메인 페이지 렌더링"""
    return render_template('index.html')

# ============================================
# API: 분말 목록
# ============================================

@app.route('/api/powder-list', methods=['GET'])
def get_powder_list():
    """분말 목록 조회 (category 파라미터로 필터링 가능)"""
    try:
        category = request.args.get('category', None)
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            if category:
                cursor.execute('SELECT powder_name FROM powder_spec WHERE category = ? ORDER BY powder_name', (category,))
            else:
                cursor.execute('SELECT powder_name FROM powder_spec ORDER BY powder_name')
            powders = [row[0] for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': powders})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 검사자 목록
# ============================================

@app.route('/api/inspector-list', methods=['GET'])
def get_inspector_list():
    """검사자 목록 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT name FROM inspector ORDER BY name')
            inspectors = [row[0] for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': inspectors})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 분말 사양 조회
# ============================================

@app.route('/api/powder-spec/<powder_name>', methods=['GET'])
def get_powder_spec(powder_name):
    """분말 사양 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM powder_spec WHERE powder_name = ?', (powder_name,))
            row = cursor.fetchone()
            if row:
                return jsonify({'success': True, 'data': dict_from_row(row)})
            else:
                return jsonify({'success': False, 'message': '분말 사양을 찾을 수 없습니다.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 입도분석 규격 조회
# ============================================

@app.route('/api/particle-size-spec/<powder_name>', methods=['GET'])
def get_particle_size_spec(powder_name):
    """입도분석 규격 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT mesh_size, min_value, max_value
                FROM particle_size
                WHERE powder_name = ?
                ORDER BY id
            ''', (powder_name,))
            specs = [dict_from_row(row) for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': specs})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 검사 항목 필터링
# ============================================

def get_inspection_items(powder_name, inspection_type):
    """검사 타입에 따라 필요한 검사 항목 반환"""
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM powder_spec WHERE powder_name = ?', (powder_name,))
        spec = cursor.fetchone()

        if not spec:
            return []

        spec = dict_from_row(spec)

        # 모든 검사 항목 정의
        all_items = [
            {'name': 'FlowRate', 'displayName': '유동도', 'unit': 's/50g',
             'min': spec['flow_rate_min'], 'max': spec['flow_rate_max'], 'type': spec['flow_rate_type']},

            {'name': 'ApparentDensity', 'displayName': '겉보기밀도', 'unit': 'g/cm³',
             'min': spec['apparent_density_min'], 'max': spec['apparent_density_max'], 'type': spec['apparent_density_type'],
             'isWeightBased': True},

            {'name': 'CContent', 'displayName': 'C함량', 'unit': '%',
             'min': spec['c_content_min'], 'max': spec['c_content_max'], 'type': spec['c_content_type']},

            {'name': 'CuContent', 'displayName': 'Cu함량', 'unit': '%',
             'min': spec['cu_content_min'], 'max': spec['cu_content_max'], 'type': spec['cu_content_type']},

            {'name': 'Moisture', 'displayName': '수분도', 'unit': '%',
             'min': spec['moisture_min'], 'max': spec['moisture_max'], 'type': spec['moisture_type'],
             'isWeightBased': True},

            {'name': 'Ash', 'displayName': '회분도', 'unit': '%',
             'min': spec['ash_min'], 'max': spec['ash_max'], 'type': spec['ash_type'],
             'isWeightBased': True},

            {'name': 'SinterChangeRate', 'displayName': '소결변화율', 'unit': '%',
             'min': spec['sinter_change_rate_min'], 'max': spec['sinter_change_rate_max'], 'type': spec['sinter_change_rate_type']},

            {'name': 'SinterStrength', 'displayName': '소결강도', 'unit': 'MPa',
             'min': spec['sinter_strength_min'], 'max': spec['sinter_strength_max'], 'type': spec['sinter_strength_type']},

            {'name': 'FormingStrength', 'displayName': '성형강도', 'unit': 'N',
             'min': spec['forming_strength_min'], 'max': spec['forming_strength_max'], 'type': spec['forming_strength_type']},

            {'name': 'FormingLoad', 'displayName': '성형하중', 'unit': 'MPa',
             'min': spec['forming_load_min'], 'max': spec['forming_load_max'], 'type': spec['forming_load_type']},
        ]

        # 검사 타입에 따라 필터링
        filtered_items = []
        for item in all_items:
            item_type = item['type']

            # 검사 타입 필터링
            if inspection_type == '일상점검' and item_type == '일상':
                if item['min'] is not None or item['max'] is not None:
                    filtered_items.append(item)
            elif inspection_type == '정기점검' and (item_type == '일상' or item_type == '정기'):
                if item['min'] is not None or item['max'] is not None:
                    filtered_items.append(item)

        # 입도분석 항목 추가
        if spec['particle_size_type']:
            cursor.execute('''
                SELECT mesh_size, min_value, max_value
                FROM particle_size
                WHERE powder_name = ?
            ''', (powder_name,))
            particle_specs = [dict_from_row(row) for row in cursor.fetchall()]

            if particle_specs:
                particle_item_type = spec['particle_size_type']

                if inspection_type == '일상점검' and particle_item_type == '일상':
                    filtered_items.append({
                        'name': 'ParticleSize',
                        'displayName': '입도분석',
                        'unit': '%',
                        'isParticleSize': True,
                        'particleSpecs': particle_specs
                    })
                elif inspection_type == '정기점검' and (particle_item_type == '일상' or particle_item_type == '정기'):
                    filtered_items.append({
                        'name': 'ParticleSize',
                        'displayName': '입도분석',
                        'unit': '%',
                        'isParticleSize': True,
                        'particleSpecs': particle_specs
                    })

        return filtered_items

# ============================================
# API: 검사 시작
# ============================================

@app.route('/api/start-inspection', methods=['POST'])
def start_inspection():
    """검사 시작 또는 기존 검사 이어하기"""
    try:
        data = request.json
        powder_name = data.get('powderName')
        lot_number = data.get('lotNumber')
        inspection_type = data.get('inspectionType')
        inspector = data.get('inspector')
        category = data.get('category', 'incoming')  # 기본값은 incoming

        if not all([powder_name, lot_number]):
            return jsonify({'success': False, 'message': '필수 입력 항목이 누락되었습니다.'})

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 1. 진행중인 검사 확인
            cursor.execute('''
                SELECT * FROM inspection_progress
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))
            progress_row = cursor.fetchone()

            if progress_row:
                # 기존 진행중 검사가 있음
                progress_data = dict_from_row(progress_row)
                items = get_inspection_items(powder_name, progress_data['inspection_type'])

                return jsonify({
                    'success': True,
                    'isExisting': True,
                    'data': {
                        'powderName': progress_data['powder_name'],
                        'lotNumber': progress_data['lot_number'],
                        'inspectionType': progress_data['inspection_type'],
                        'inspector': progress_data['inspector'],
                        'startTime': progress_data['start_time'],
                        'completedItems': json.loads(progress_data['completed_items'] or '[]'),
                        'totalItems': json.loads(progress_data['total_items'] or '[]'),
                        'progress': progress_data['progress']
                    },
                    'items': items
                })

            # 2. 완료된 검사 확인
            cursor.execute('''
                SELECT * FROM inspection_result
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))
            result_row = cursor.fetchone()

            if result_row:
                return jsonify({
                    'success': True,
                    'isExisting': True,
                    'data': {
                        'powderName': powder_name,
                        'lotNumber': lot_number,
                        'inspectionType': inspection_type,
                        'inspector': inspector,
                        'isCompleted': True,
                        'progress': '완료'
                    },
                    'items': []
                })

            # 3. 새 검사 시작
            items = get_inspection_items(powder_name, inspection_type)

            if not items:
                return jsonify({'success': False, 'message': '해당 분말의 검사 항목이 없습니다.'})

            item_names = [item['name'] for item in items]

            # 진행중검사 테이블에 추가
            cursor.execute('''
                INSERT INTO inspection_progress
                (powder_name, lot_number, inspection_type, inspector, completed_items, total_items, progress, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (powder_name, lot_number, inspection_type, inspector,
                  json.dumps([]), json.dumps(item_names), f'0/{len(item_names)}', category))

            conn.commit()

            return jsonify({
                'success': True,
                'isExisting': False,
                'data': {
                    'powderName': powder_name,
                    'lotNumber': lot_number,
                    'inspectionType': inspection_type,
                    'inspector': inspector,
                    'completedItems': [],
                    'totalItems': item_names
                },
                'items': items
            })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 미완료 검사 목록
# ============================================

@app.route('/api/incomplete-inspections', methods=['GET'])
def get_incomplete_inspections():
    """진행중인 검사 목록 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM inspection_progress ORDER BY start_time DESC')
            inspections = [dict_from_row(row) for row in cursor.fetchall()]

            # JSON 파싱
            for inspection in inspections:
                inspection['completedItems'] = json.loads(inspection['completed_items'] or '[]')
                inspection['totalItems'] = json.loads(inspection['total_items'] or '[]')

            return jsonify({'success': True, 'data': inspections})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 진행중인 검사 삭제
# ============================================

@app.route('/api/delete-incomplete-inspection/<powder_name>/<lot_number>', methods=['DELETE'])
def delete_incomplete_inspection(powder_name, lot_number):
    """진행중인 검사 삭제"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 진행중인 검사가 있는지 확인
            cursor.execute('''
                SELECT * FROM inspection_progress
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))

            if not cursor.fetchone():
                return jsonify({'success': False, 'message': '진행중인 검사를 찾을 수 없습니다.'})

            # 진행중인 검사만 삭제 (완료된 검사는 삭제하지 않음)
            cursor.execute('''
                DELETE FROM inspection_progress
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))

            conn.commit()

            return jsonify({'success': True, 'message': '진행중인 검사가 삭제되었습니다.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 검사 항목 저장
# ============================================

@app.route('/api/save-item', methods=['POST'])
def save_inspection_item():
    """검사 항목 저장"""
    try:
        data = request.json
        powder_name = data.get('powderName')
        lot_number = data.get('lotNumber')
        item_name = data.get('itemName')
        values = data.get('values')

        print(f"저장 요청: {powder_name}, {lot_number}, {item_name}, {values}")

        # 특수 항목 처리
        if item_name == 'ApparentDensity':
            return save_apparent_density(powder_name, lot_number, values)
        elif item_name == 'Moisture':
            return save_moisture(powder_name, lot_number, values)
        elif item_name == 'Ash':
            return save_ash(powder_name, lot_number, values)

        # 일반 항목 처리
        valid_values = [float(v) for v in values if v != '' and v is not None]

        if not valid_values:
            return jsonify({'success': False, 'message': '유효한 측정값이 없습니다.'})

        average = sum(valid_values) / len(valid_values)
        average = round(average, 2)

        # 규격 확인
        result = check_spec(powder_name, lot_number, item_name, average)

        # 데이터 저장
        save_to_result_table(powder_name, lot_number, item_name, values, average, result)
        update_progress(powder_name, lot_number, item_name)

        return jsonify({'success': True, 'average': f'{average:.2f}', 'result': result})

    except Exception as e:
        print(f"오류: {str(e)}")
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 입도분석 저장
# ============================================

@app.route('/api/save-particle-size', methods=['POST'])
def save_particle_size():
    """입도분석 데이터 저장"""
    try:
        data = request.json
        powder_name = data.get('powderName')
        lot_number = data.get('lotNumber')
        particle_data = data.get('particleData')

        # 전체 결과 판정
        overall_result = 'PASS'
        for mesh_id, mesh_data in particle_data.items():
            if mesh_data.get('result') == '불합격':
                overall_result = 'FAIL'

        # 데이터 저장
        save_particle_to_result_table(powder_name, lot_number, particle_data, overall_result)
        update_progress(powder_name, lot_number, 'ParticleSize')

        return jsonify({'success': True, 'result': overall_result})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 검사 결과 조회
# ============================================

@app.route('/api/search-results', methods=['GET'])
def search_inspection_results():
    """검사 결과 조회 (category, dateFrom, dateTo로 필터링 가능)"""
    try:
        category = request.args.get('category', '')
        powder_name = request.args.get('powderName', '')
        lot_number = request.args.get('lotNumber', '')
        date_from = request.args.get('dateFrom', '')
        date_to = request.args.get('dateTo', '')

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            query = 'SELECT * FROM inspection_result WHERE 1=1'
            params = []

            if category:
                query += ' AND category = ?'
                params.append(category)

            if powder_name:
                query += ' AND powder_name = ?'
                params.append(powder_name)

            if lot_number:
                query += ' AND lot_number = ?'
                params.append(lot_number)

            if date_from:
                query += ' AND inspection_time >= ?'
                params.append(date_from + ' 00:00:00')

            if date_to:
                query += ' AND inspection_time <= ?'
                params.append(date_to + ' 23:59:59')

            query += ' ORDER BY inspection_time DESC'

            cursor.execute(query, params)
            results = [dict_from_row(row) for row in cursor.fetchall()]

            # 완료된 검사만 필터링
            results = [r for r in results if r['final_result'] in ['PASS', 'FAIL']]

            return jsonify({'success': True, 'data': results})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 검사 상세 조회
# ============================================

@app.route('/api/inspection-detail/<powder_name>/<lot_number>', methods=['GET'])
def get_inspection_detail(powder_name, lot_number):
    """검사 상세 정보 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM inspection_result
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))

            row = cursor.fetchone()

            if not row:
                return jsonify({'success': False, 'message': '검사 결과를 찾을 수 없습니다.'})

            result = dict_from_row(row)

            # 분말 사양 추가
            cursor.execute('SELECT * FROM powder_spec WHERE powder_name = ?', (powder_name,))
            spec_row = cursor.fetchone()
            if spec_row:
                result['powderSpec'] = dict_from_row(spec_row)

            # 입도분석 규격 추가
            cursor.execute('''
                SELECT mesh_size, min_value, max_value
                FROM particle_size
                WHERE powder_name = ?
            ''', (powder_name,))
            particle_specs = [dict_from_row(r) for r in cursor.fetchall()]
            if particle_specs:
                result['particleSizeSpecs'] = particle_specs

            return jsonify({'success': True, 'data': result})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 검사 삭제
# ============================================

@app.route('/api/delete-inspection', methods=['POST'])
def delete_inspection():
    """검사 결과 삭제"""
    try:
        data = request.json
        powder_name = data.get('powderName')
        lot_number = data.get('lotNumber')

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 검사 결과 삭제
            cursor.execute('''
                DELETE FROM inspection_result
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))

            # 진행중 검사 삭제
            cursor.execute('''
                DELETE FROM inspection_progress
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))

            conn.commit()

            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# 헬퍼 함수들
# ============================================

def save_apparent_density(powder_name, lot_number, values):
    """겉보기밀도 저장"""
    try:
        # values: [emptyCup1, powderWeight1, emptyCup2, powderWeight2, emptyCup3, powderWeight3]
        densities = []
        for i in range(3):
            empty_cup = values[i * 2]
            powder_weight = values[i * 2 + 1]
            if empty_cup and powder_weight:
                density = (float(powder_weight) - float(empty_cup)) / 25
                densities.append(density)

        if not densities:
            return jsonify({'success': False, 'message': '유효한 측정값이 없습니다.'})

        average = round(sum(densities) / len(densities), 2)
        result = check_spec(powder_name, lot_number, 'ApparentDensity', average)

        save_to_result_table(powder_name, lot_number, 'ApparentDensity', values, average, result)
        update_progress(powder_name, lot_number, 'ApparentDensity')

        return jsonify({'success': True, 'average': f'{average:.2f}', 'result': result})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

def save_moisture(powder_name, lot_number, values):
    """수분도 저장"""
    try:
        # values: [initialWeight1, driedWeight1, initialWeight2, driedWeight2, initialWeight3, driedWeight3]
        moisture_values = []
        for i in range(3):
            initial = values[i * 2]
            dried = values[i * 2 + 1]
            if initial and dried:
                moisture = ((float(initial) - float(dried)) / float(initial)) * 100
                moisture_values.append(moisture)

        if not moisture_values:
            return jsonify({'success': False, 'message': '유효한 측정값이 없습니다.'})

        average = round(sum(moisture_values) / len(moisture_values), 2)
        result = check_spec(powder_name, lot_number, 'Moisture', average)

        save_to_result_table(powder_name, lot_number, 'Moisture', values, average, result)
        update_progress(powder_name, lot_number, 'Moisture')

        return jsonify({'success': True, 'average': f'{average:.2f}', 'result': result})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

def save_ash(powder_name, lot_number, values):
    """회분도 저장"""
    try:
        # values: [initialWeight1, ashWeight1, initialWeight2, ashWeight2, initialWeight3, ashWeight3]
        ash_values = []
        for i in range(3):
            initial = values[i * 2]
            ash = values[i * 2 + 1]
            if initial and ash:
                ash_percent = (float(ash) / float(initial)) * 100
                ash_values.append(ash_percent)

        if not ash_values:
            return jsonify({'success': False, 'message': '유효한 측정값이 없습니다.'})

        average = round(sum(ash_values) / len(ash_values), 2)
        result = check_spec(powder_name, lot_number, 'Ash', average)

        save_to_result_table(powder_name, lot_number, 'Ash', values, average, result)
        update_progress(powder_name, lot_number, 'Ash')

        return jsonify({'success': True, 'average': f'{average:.2f}', 'result': result})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

def check_spec(powder_name, lot_number, item_name, average):
    """규격 확인하여 PASS/FAIL 판정"""
    with closing(get_db()) as conn:
        cursor = conn.cursor()

        # 검사 타입 확인
        cursor.execute('''
            SELECT inspection_type FROM inspection_progress
            WHERE powder_name = ? AND lot_number = ?
        ''', (powder_name, lot_number))
        progress_row = cursor.fetchone()

        if not progress_row:
            cursor.execute('''
                SELECT inspection_type FROM inspection_result
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))
            progress_row = cursor.fetchone()

        if not progress_row:
            return 'PASS'

        inspection_type = progress_row[0]
        items = get_inspection_items(powder_name, inspection_type)

        for item in items:
            if item['name'] == item_name:
                min_val = item.get('min')
                max_val = item.get('max')

                if min_val is not None and average < min_val:
                    return 'FAIL'
                if max_val is not None and average > max_val:
                    return 'FAIL'

        return 'PASS'

def save_to_result_table(powder_name, lot_number, item_name, values, average, result):
    """검사 결과 테이블에 저장"""
    with closing(get_db()) as conn:
        cursor = conn.cursor()

        # 기존 행 확인
        cursor.execute('''
            SELECT id FROM inspection_result
            WHERE powder_name = ? AND lot_number = ?
        ''', (powder_name, lot_number))
        existing = cursor.fetchone()

        # 컬럼명 매핑
        column_map = {
            'FlowRate': ['flow_rate_1', 'flow_rate_2', 'flow_rate_3', 'flow_rate_avg', 'flow_rate_result'],
            'ApparentDensity': [
                'apparent_density_empty_cup_1', 'apparent_density_powder_weight_1', 'apparent_density_1',
                'apparent_density_empty_cup_2', 'apparent_density_powder_weight_2', 'apparent_density_2',
                'apparent_density_empty_cup_3', 'apparent_density_powder_weight_3', 'apparent_density_3',
                'apparent_density_avg', 'apparent_density_result'
            ],
            'CContent': ['c_content_1', 'c_content_2', 'c_content_3', 'c_content_avg', 'c_content_result'],
            'CuContent': ['cu_content_1', 'cu_content_2', 'cu_content_3', 'cu_content_avg', 'cu_content_result'],
            'Moisture': [
                'moisture_initial_weight_1', 'moisture_dried_weight_1', 'moisture_1',
                'moisture_initial_weight_2', 'moisture_dried_weight_2', 'moisture_2',
                'moisture_initial_weight_3', 'moisture_dried_weight_3', 'moisture_3',
                'moisture_avg', 'moisture_result'
            ],
            'Ash': [
                'ash_initial_weight_1', 'ash_ash_weight_1', 'ash_1',
                'ash_initial_weight_2', 'ash_ash_weight_2', 'ash_2',
                'ash_initial_weight_3', 'ash_ash_weight_3', 'ash_3',
                'ash_avg', 'ash_result'
            ],
            'SinterChangeRate': ['sinter_change_rate_1', 'sinter_change_rate_2', 'sinter_change_rate_3', 'sinter_change_rate_avg', 'sinter_change_rate_result'],
            'SinterStrength': ['sinter_strength_1', 'sinter_strength_2', 'sinter_strength_3', 'sinter_strength_avg', 'sinter_strength_result'],
            'FormingStrength': ['forming_strength_1', 'forming_strength_2', 'forming_strength_3', 'forming_strength_avg', 'forming_strength_result'],
            'FormingLoad': ['forming_load_1', 'forming_load_2', 'forming_load_3', 'forming_load_avg', 'forming_load_result']
        }

        if existing:
            # 기존 행 업데이트
            columns = column_map.get(item_name, [])

            if item_name in ['ApparentDensity', 'Moisture', 'Ash']:
                # 특수 항목 (계산값 포함)
                update_special_item(cursor, existing[0], item_name, columns, values, average, result)
            else:
                # 일반 항목
                update_parts = []
                update_values = []

                if len(values) >= 1 and values[0]:
                    update_parts.append(f'{columns[0]} = ?')
                    update_values.append(float(values[0]))
                if len(values) >= 2 and values[1]:
                    update_parts.append(f'{columns[1]} = ?')
                    update_values.append(float(values[1]))
                if len(values) >= 3 and values[2]:
                    update_parts.append(f'{columns[2]} = ?')
                    update_values.append(float(values[2]))

                update_parts.append(f'{columns[3]} = ?')
                update_values.append(average)

                update_parts.append(f'{columns[4]} = ?')
                update_values.append(result)

                update_values.append(existing[0])

                query = f"UPDATE inspection_result SET {', '.join(update_parts)} WHERE id = ?"
                cursor.execute(query, update_values)

        else:
            # 새 행 생성
            cursor.execute('''
                SELECT inspection_type, inspector FROM inspection_progress
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))
            progress_data = cursor.fetchone()

            inspection_type = progress_data[0] if progress_data else '일상점검'
            inspector = progress_data[1] if progress_data else '미지정'

            cursor.execute('''
                INSERT INTO inspection_result (powder_name, lot_number, inspection_type, inspector)
                VALUES (?, ?, ?, ?)
            ''', (powder_name, lot_number, inspection_type, inspector))

            new_id = cursor.lastrowid

            # 방금 생성한 행에 데이터 업데이트
            columns = column_map.get(item_name, [])

            if item_name in ['ApparentDensity', 'Moisture', 'Ash']:
                update_special_item(cursor, new_id, item_name, columns, values, average, result)
            else:
                update_parts = []
                update_values = []

                if len(values) >= 1 and values[0]:
                    update_parts.append(f'{columns[0]} = ?')
                    update_values.append(float(values[0]))
                if len(values) >= 2 and values[1]:
                    update_parts.append(f'{columns[1]} = ?')
                    update_values.append(float(values[1]))
                if len(values) >= 3 and values[2]:
                    update_parts.append(f'{columns[2]} = ?')
                    update_values.append(float(values[2]))

                update_parts.append(f'{columns[3]} = ?')
                update_values.append(average)

                update_parts.append(f'{columns[4]} = ?')
                update_values.append(result)

                update_values.append(new_id)

                query = f"UPDATE inspection_result SET {', '.join(update_parts)} WHERE id = ?"
                cursor.execute(query, update_values)

        conn.commit()

def update_special_item(cursor, row_id, item_name, columns, values, average, result):
    """특수 항목 (겉보기밀도, 수분도, 회분도) 업데이트"""

    if item_name == 'ApparentDensity':
        # 겉보기밀도: 원본 데이터 + 계산값 저장
        update_parts = []
        update_values = []

        for i in range(3):
            empty_cup = values[i * 2] if i * 2 < len(values) else None
            powder_weight = values[i * 2 + 1] if i * 2 + 1 < len(values) else None

            if empty_cup:
                update_parts.append(f'{columns[i * 3]} = ?')
                update_values.append(float(empty_cup))

            if powder_weight:
                update_parts.append(f'{columns[i * 3 + 1]} = ?')
                update_values.append(float(powder_weight))

            if empty_cup and powder_weight:
                density = (float(powder_weight) - float(empty_cup)) / 25
                update_parts.append(f'{columns[i * 3 + 2]} = ?')
                update_values.append(round(density, 2))

        update_parts.append(f'{columns[9]} = ?')
        update_values.append(average)

        update_parts.append(f'{columns[10]} = ?')
        update_values.append(result)

        update_values.append(row_id)

        query = f"UPDATE inspection_result SET {', '.join(update_parts)} WHERE id = ?"
        cursor.execute(query, update_values)

    elif item_name in ['Moisture', 'Ash']:
        # 수분도/회분도: 원본 데이터 + 계산값 저장
        update_parts = []
        update_values = []

        for i in range(3):
            val1 = values[i * 2] if i * 2 < len(values) else None
            val2 = values[i * 2 + 1] if i * 2 + 1 < len(values) else None

            if val1:
                update_parts.append(f'{columns[i * 3]} = ?')
                update_values.append(float(val1))

            if val2:
                update_parts.append(f'{columns[i * 3 + 1]} = ?')
                update_values.append(float(val2))

            if val1 and val2:
                if item_name == 'Moisture':
                    calc_val = ((float(val1) - float(val2)) / float(val1)) * 100
                else:  # Ash
                    calc_val = (float(val2) / float(val1)) * 100

                update_parts.append(f'{columns[i * 3 + 2]} = ?')
                update_values.append(round(calc_val, 2))

        update_parts.append(f'{columns[9]} = ?')
        update_values.append(average)

        update_parts.append(f'{columns[10]} = ?')
        update_values.append(result)

        update_values.append(row_id)

        query = f"UPDATE inspection_result SET {', '.join(update_parts)} WHERE id = ?"
        cursor.execute(query, update_values)

def save_particle_to_result_table(powder_name, lot_number, particle_data, overall_result):
    """입도분석 결과 저장"""
    with closing(get_db()) as conn:
        cursor = conn.cursor()

        # 기존 행 확인
        cursor.execute('''
            SELECT id FROM inspection_result
            WHERE powder_name = ? AND lot_number = ?
        ''', (powder_name, lot_number))
        existing = cursor.fetchone()

        mesh_mapping = {
            '180': 'particle_size_180',
            '150': 'particle_size_150',
            '106': 'particle_size_106',
            '75': 'particle_size_75',
            '45': 'particle_size_45',
            '45M': 'particle_size_45m'
        }

        update_parts = []
        update_values = []

        for mesh_id, prefix in mesh_mapping.items():
            data = particle_data.get(mesh_id, {})
            val1 = data.get('val1')
            val2 = data.get('val2')
            avg = data.get('avg')
            mesh_result = 'PASS' if data.get('result') == '합격' else 'FAIL'

            if val1:
                update_parts.append(f'{prefix}_1 = ?')
                update_values.append(float(val1))
            if val2:
                update_parts.append(f'{prefix}_2 = ?')
                update_values.append(float(val2))
            if avg:
                update_parts.append(f'{prefix}_avg = ?')
                update_values.append(float(avg))
            update_parts.append(f'{prefix}_result = ?')
            update_values.append(mesh_result)

        update_parts.append('particle_size_result = ?')
        update_values.append(overall_result)

        if existing:
            update_values.append(existing[0])
            query = f"UPDATE inspection_result SET {', '.join(update_parts)} WHERE id = ?"
            cursor.execute(query, update_values)
        else:
            cursor.execute('''
                SELECT inspection_type, inspector FROM inspection_progress
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))
            progress_data = cursor.fetchone()

            inspection_type = progress_data[0] if progress_data else '일상점검'
            inspector = progress_data[1] if progress_data else '미지정'

            cursor.execute('''
                INSERT INTO inspection_result (powder_name, lot_number, inspection_type, inspector)
                VALUES (?, ?, ?, ?)
            ''', (powder_name, lot_number, inspection_type, inspector))

            new_id = cursor.lastrowid
            update_values.append(new_id)

            query = f"UPDATE inspection_result SET {', '.join(update_parts)} WHERE id = ?"
            cursor.execute(query, update_values)

        conn.commit()

def update_progress(powder_name, lot_number, item_name):
    """진행중 검사 업데이트"""
    with closing(get_db()) as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT completed_items, total_items FROM inspection_progress
            WHERE powder_name = ? AND lot_number = ?
        ''', (powder_name, lot_number))
        progress_row = cursor.fetchone()

        if not progress_row:
            # 완료된 검사인 경우 최종 결과만 업데이트
            update_final_result(powder_name, lot_number)
            return

        completed_items = json.loads(progress_row[0] or '[]')
        total_items = json.loads(progress_row[1] or '[]')

        if item_name not in completed_items:
            completed_items.append(item_name)

        progress = f'{len(completed_items)}/{len(total_items)}'

        cursor.execute('''
            UPDATE inspection_progress
            SET completed_items = ?, progress = ?
            WHERE powder_name = ? AND lot_number = ?
        ''', (json.dumps(completed_items), progress, powder_name, lot_number))

        # 모든 항목 완료 시 진행중 검사에서 제거
        if len(completed_items) == len(total_items):
            cursor.execute('''
                DELETE FROM inspection_progress
                WHERE powder_name = ? AND lot_number = ?
            ''', (powder_name, lot_number))

            update_final_result(powder_name, lot_number)

        conn.commit()

def update_final_result(powder_name, lot_number):
    """최종 결과 업데이트"""
    with closing(get_db()) as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM inspection_result
            WHERE powder_name = ? AND lot_number = ?
        ''', (powder_name, lot_number))
        result_row = cursor.fetchone()

        if not result_row:
            return

        result_data = dict_from_row(result_row)

        # 모든 _result 컬럼 확인
        final_result = 'PASS'
        for key, value in result_data.items():
            if key.endswith('_result') and key != 'final_result':
                if value == 'FAIL':
                    final_result = 'FAIL'
                    break

        cursor.execute('''
            UPDATE inspection_result
            SET final_result = ?
            WHERE powder_name = ? AND lot_number = ?
        ''', (final_result, powder_name, lot_number))

        conn.commit()

# ============================================
# 관리자 API
# ============================================

# --------------------------------------------
# 분말 목록 조회 (카테고리별)
# --------------------------------------------

@app.route('/api/powders', methods=['GET'])
def get_powders_by_category():
    """카테고리별 분말 목록 조회"""
    try:
        category = request.args.get('category')

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            if category:
                cursor.execute('SELECT powder_name, category FROM powder_spec WHERE category = ? ORDER BY powder_name', (category,))
            else:
                cursor.execute('SELECT powder_name, category FROM powder_spec ORDER BY powder_name')

            powders = [{'powder_name': row[0], 'category': row[1]} for row in cursor.fetchall()]
            return jsonify({'success': True, 'powders': powders})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# --------------------------------------------
# 분말 사양 관리
# --------------------------------------------

@app.route('/api/admin/powder-spec', methods=['GET'])
def admin_get_all_powder_specs():
    """모든 분말 사양 조회 (관리자용)"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM powder_spec ORDER BY powder_name')
            specs = [dict_from_row(row) for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': specs})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/powder-spec', methods=['POST'])
def admin_add_powder_spec():
    """분말 사양 추가"""
    try:
        data = request.json

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 중복 확인
            cursor.execute('SELECT id FROM powder_spec WHERE powder_name = ?', (data['powder_name'],))
            if cursor.fetchone():
                return jsonify({'success': False, 'message': '이미 존재하는 분말명입니다.'})

            # 삽입
            cursor.execute('''
                INSERT INTO powder_spec (
                    powder_name,
                    flow_rate_min, flow_rate_max, flow_rate_type,
                    apparent_density_min, apparent_density_max, apparent_density_type,
                    c_content_min, c_content_max, c_content_type,
                    cu_content_min, cu_content_max, cu_content_type,
                    moisture_min, moisture_max, moisture_type,
                    ash_min, ash_max, ash_type,
                    sinter_change_rate_min, sinter_change_rate_max, sinter_change_rate_type,
                    sinter_strength_min, sinter_strength_max, sinter_strength_type,
                    forming_strength_min, forming_strength_max, forming_strength_type,
                    forming_load_min, forming_load_max, forming_load_type,
                    particle_size_type,
                    category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data.get('powder_name'),
                data.get('flow_rate_min'), data.get('flow_rate_max'), data.get('flow_rate_type'),
                data.get('apparent_density_min'), data.get('apparent_density_max'), data.get('apparent_density_type'),
                data.get('c_content_min'), data.get('c_content_max'), data.get('c_content_type'),
                data.get('cu_content_min'), data.get('cu_content_max'), data.get('cu_content_type'),
                data.get('moisture_min'), data.get('moisture_max'), data.get('moisture_type'),
                data.get('ash_min'), data.get('ash_max'), data.get('ash_type'),
                data.get('sinter_change_rate_min'), data.get('sinter_change_rate_max'), data.get('sinter_change_rate_type'),
                data.get('sinter_strength_min'), data.get('sinter_strength_max'), data.get('sinter_strength_type'),
                data.get('forming_strength_min'), data.get('forming_strength_max'), data.get('forming_strength_type'),
                data.get('forming_load_min'), data.get('forming_load_max'), data.get('forming_load_type'),
                data.get('particle_size_type'),
                data.get('category', 'incoming')
            ))

            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/powder-spec/<int:spec_id>', methods=['PUT'])
def admin_update_powder_spec(spec_id):
    """분말 사양 수정"""
    try:
        data = request.json

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE powder_spec SET
                    powder_name = ?,
                    flow_rate_min = ?, flow_rate_max = ?, flow_rate_type = ?,
                    apparent_density_min = ?, apparent_density_max = ?, apparent_density_type = ?,
                    c_content_min = ?, c_content_max = ?, c_content_type = ?,
                    cu_content_min = ?, cu_content_max = ?, cu_content_type = ?,
                    moisture_min = ?, moisture_max = ?, moisture_type = ?,
                    ash_min = ?, ash_max = ?, ash_type = ?,
                    sinter_change_rate_min = ?, sinter_change_rate_max = ?, sinter_change_rate_type = ?,
                    sinter_strength_min = ?, sinter_strength_max = ?, sinter_strength_type = ?,
                    forming_strength_min = ?, forming_strength_max = ?, forming_strength_type = ?,
                    forming_load_min = ?, forming_load_max = ?, forming_load_type = ?,
                    particle_size_type = ?,
                    category = ?
                WHERE id = ?
            ''', (
                data.get('powder_name'),
                data.get('flow_rate_min'), data.get('flow_rate_max'), data.get('flow_rate_type'),
                data.get('apparent_density_min'), data.get('apparent_density_max'), data.get('apparent_density_type'),
                data.get('c_content_min'), data.get('c_content_max'), data.get('c_content_type'),
                data.get('cu_content_min'), data.get('cu_content_max'), data.get('cu_content_type'),
                data.get('moisture_min'), data.get('moisture_max'), data.get('moisture_type'),
                data.get('ash_min'), data.get('ash_max'), data.get('ash_type'),
                data.get('sinter_change_rate_min'), data.get('sinter_change_rate_max'), data.get('sinter_change_rate_type'),
                data.get('sinter_strength_min'), data.get('sinter_strength_max'), data.get('sinter_strength_type'),
                data.get('forming_strength_min'), data.get('forming_strength_max'), data.get('forming_strength_type'),
                data.get('forming_load_min'), data.get('forming_load_max'), data.get('forming_load_type'),
                data.get('particle_size_type'),
                data.get('category', 'incoming'),
                spec_id
            ))

            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/powder-spec/<int:spec_id>', methods=['DELETE'])
def admin_delete_powder_spec(spec_id):
    """분말 사양 삭제"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM powder_spec WHERE id = ?', (spec_id,))
            conn.commit()
            return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# --------------------------------------------
# 입도분석 규격 관리
# --------------------------------------------

@app.route('/api/admin/particle-size', methods=['GET'])
def admin_get_all_particle_sizes():
    """모든 입도분석 규격 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM particle_size ORDER BY powder_name, id')
            specs = [dict_from_row(row) for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': specs})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/particle-size/<powder_name>', methods=['GET'])
def admin_get_particle_size_by_powder(powder_name):
    """특정 분말의 입도분석 규격 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM particle_size WHERE powder_name = ? ORDER BY id', (powder_name,))
            specs = [dict_from_row(row) for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': specs})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/particle-size', methods=['POST'])
def admin_add_particle_size():
    """입도분석 규격 추가"""
    try:
        data = request.json

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 중복 확인
            cursor.execute('''
                SELECT id FROM particle_size
                WHERE powder_name = ? AND mesh_size = ?
            ''', (data['powder_name'], data['mesh_size']))

            if cursor.fetchone():
                return jsonify({'success': False, 'message': '이미 존재하는 규격입니다.'})

            cursor.execute('''
                INSERT INTO particle_size (powder_name, mesh_size, min_value, max_value)
                VALUES (?, ?, ?, ?)
            ''', (data['powder_name'], data['mesh_size'], data['min_value'], data['max_value']))

            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/particle-size/<int:spec_id>', methods=['PUT'])
def admin_update_particle_size(spec_id):
    """입도분석 규격 수정"""
    try:
        data = request.json

        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE particle_size SET
                    powder_name = ?, mesh_size = ?, min_value = ?, max_value = ?
                WHERE id = ?
            ''', (data['powder_name'], data['mesh_size'], data['min_value'], data['max_value'], spec_id))

            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/particle-size/<int:spec_id>', methods=['DELETE'])
def admin_delete_particle_size(spec_id):
    """입도분석 규격 삭제"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM particle_size WHERE id = ?', (spec_id,))
            conn.commit()
            return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/particle-size/bulk', methods=['POST'])
def admin_bulk_save_particle_size():
    """입도분석 규격 일괄 저장"""
    try:
        data = request.json
        powder_name = data.get('powder_name')
        specs = data.get('specs', [])

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 기존 입도분석 규격 삭제
            cursor.execute('DELETE FROM particle_size WHERE powder_name = ?', (powder_name,))

            # 새 규격 추가
            for spec in specs:
                cursor.execute('''
                    INSERT INTO particle_size (powder_name, mesh_size, min_value, max_value)
                    VALUES (?, ?, ?, ?)
                ''', (spec['powder_name'], spec['mesh_size'], spec['min_value'], spec['max_value']))

            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# --------------------------------------------
# 검사자 관리
# --------------------------------------------

@app.route('/api/admin/inspector', methods=['GET'])
def admin_get_all_inspectors():
    """모든 검사자 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM inspector ORDER BY name')
            inspectors = [dict_from_row(row) for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': inspectors})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/inspector', methods=['POST'])
def admin_add_inspector():
    """검사자 추가"""
    try:
        data = request.json
        name = data.get('name', '').strip()

        if not name:
            return jsonify({'success': False, 'message': '검사자 이름을 입력하세요.'})

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 중복 확인
            cursor.execute('SELECT id FROM inspector WHERE name = ?', (name,))
            if cursor.fetchone():
                return jsonify({'success': False, 'message': '이미 존재하는 검사자입니다.'})

            cursor.execute('INSERT INTO inspector (name) VALUES (?)', (name,))
            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/inspector/<int:inspector_id>', methods=['DELETE'])
def admin_delete_inspector(inspector_id):
    """검사자 삭제"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM inspector WHERE id = ?', (inspector_id,))
            conn.commit()
            return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 작업자 관리 (Operator Management)
# ============================================

@app.route('/api/operator-list', methods=['GET'])
def get_operator_list():
    """작업자 목록 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT name FROM operator ORDER BY name')
            operators = [row[0] for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': operators})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/operator', methods=['GET'])
def admin_get_all_operators():
    """모든 작업자 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM operator ORDER BY name')
            operators = [dict_from_row(row) for row in cursor.fetchall()]
            return jsonify({'success': True, 'data': operators})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/operator', methods=['POST'])
def admin_add_operator():
    """작업자 추가"""
    try:
        data = request.json
        name = data.get('name', '').strip()

        if not name:
            return jsonify({'success': False, 'message': '작업자 이름을 입력하세요.'})

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 중복 확인
            cursor.execute('SELECT id FROM operator WHERE name = ?', (name,))
            if cursor.fetchone():
                return jsonify({'success': False, 'message': '이미 존재하는 작업자입니다.'})

            cursor.execute('INSERT INTO operator (name) VALUES (?)', (name,))
            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/operator/<int:operator_id>', methods=['DELETE'])
def admin_delete_operator(operator_id):
    """작업자 삭제"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM operator WHERE id = ?', (operator_id,))
            conn.commit()
            return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: Recipe(배합 규격서) 관리
# ============================================

@app.route('/api/admin/recipes', methods=['GET'])
def admin_get_recipes():
    """Recipe 목록 조회 (제품별 그룹핑)"""
    try:
        product_name = request.args.get('product_name', None)

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            if product_name:
                # 특정 제품의 Recipe만 조회
                cursor.execute('''
                    SELECT * FROM recipe
                    WHERE product_name = ? AND is_active = 1
                    ORDER BY id
                ''', (product_name,))
            else:
                # 모든 Recipe 조회
                cursor.execute('''
                    SELECT * FROM recipe
                    WHERE is_active = 1
                    ORDER BY product_name, id
                ''')

            recipes = [dict_from_row(row) for row in cursor.fetchall()]

            # 제품별 그룹핑
            products = {}
            for recipe in recipes:
                pname = recipe['product_name']
                if pname not in products:
                    products[pname] = {
                        'product_name': pname,
                        'product_code': recipe['product_code'],
                        'recipes': []
                    }
                products[pname]['recipes'].append(recipe)

            return jsonify({
                'success': True,
                'data': list(products.values()),
                'total_products': len(products),
                'total_recipes': len(recipes)
            })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/recipe', methods=['POST'])
def admin_add_recipe():
    """Recipe 추가"""
    try:
        data = request.json

        required_fields = ['product_name', 'powder_name', 'ratio']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'message': '필수 항목이 누락되었습니다.'})

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO recipe (
                    product_name, product_code, powder_name, powder_category,
                    ratio, target_weight, tolerance_percent, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['product_name'],
                data.get('product_code', ''),
                data['powder_name'],
                data.get('powder_category', 'incoming'),
                data['ratio'],
                data.get('target_weight', None),
                data.get('tolerance_percent', 5.0),
                data.get('created_by', '관리자')
            ))

            conn.commit()
            return jsonify({'success': True, 'recipe_id': cursor.lastrowid})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/recipe/<int:recipe_id>', methods=['PUT'])
def admin_update_recipe(recipe_id):
    """Recipe 수정"""
    try:
        data = request.json

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE recipe SET
                    product_name = ?,
                    product_code = ?,
                    powder_name = ?,
                    powder_category = ?,
                    ratio = ?,
                    target_weight = ?,
                    tolerance_percent = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                data['product_name'],
                data.get('product_code', ''),
                data['powder_name'],
                data.get('powder_category', 'incoming'),
                data['ratio'],
                data.get('target_weight', None),
                data.get('tolerance_percent', 5.0),
                recipe_id
            ))

            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/recipe/<int:recipe_id>', methods=['DELETE'])
def admin_delete_recipe(recipe_id):
    """Recipe 삭제 (소프트 삭제)"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 실제 삭제 대신 is_active = 0으로 변경
            cursor.execute('''
                UPDATE recipe SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (recipe_id,))

            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/recipe/product/<product_name>', methods=['DELETE'])
def admin_delete_product_recipes(product_name):
    """제품의 모든 Recipe 삭제 (소프트 삭제)"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE recipe SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE product_name = ?
            ''', (product_name,))

            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 배합 작업 (Blending Work)
# ============================================

@app.route('/api/blending/products', methods=['GET'])
def get_blending_products():
    """배합 가능한 제품 목록 조회 (Recipe가 있는 제품만)"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                SELECT DISTINCT product_name, product_code
                FROM recipe
                WHERE is_active = 1
                ORDER BY product_name
            ''')

            products = [dict_from_row(row) for row in cursor.fetchall()]

            return jsonify({'success': True, 'data': products})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/blending/recipe/<product_name>', methods=['GET'])
def get_blending_recipe(product_name):
    """특정 제품의 Recipe 조회"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM recipe
                WHERE product_name = ? AND is_active = 1
                ORDER BY id
            ''', (product_name,))

            recipes = [dict_from_row(row) for row in cursor.fetchall()]

            return jsonify({'success': True, 'data': recipes})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/blending/start', methods=['POST'])
def start_blending_work():
    """배합 작업 시작"""
    try:
        data = request.json

        required_fields = ['work_order', 'product_name', 'batch_lot', 'target_total_weight', 'operator']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'message': '필수 항목이 누락되었습니다.'})

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 중복 확인 (work_order 또는 batch_lot)
            cursor.execute('''
                SELECT id FROM blending_work
                WHERE work_order = ? OR batch_lot = ?
            ''', (data['work_order'], data['batch_lot']))

            if cursor.fetchone():
                return jsonify({'success': False, 'message': '이미 존재하는 작업지시 번호 또는 배합 LOT입니다.'})

            # 배합 작업 레코드 생성
            cursor.execute('''
                INSERT INTO blending_work (
                    work_order, product_name, product_code, batch_lot,
                    target_total_weight, operator, status
                ) VALUES (?, ?, ?, ?, ?, ?, 'in_progress')
            ''', (
                data['work_order'],
                data['product_name'],
                data.get('product_code', ''),
                data['batch_lot'],
                data['target_total_weight'],
                data['operator']
            ))

            work_id = cursor.lastrowid
            conn.commit()

            return jsonify({
                'success': True,
                'work_id': work_id,
                'batch_lot': data['batch_lot']
            })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/blending/generate-lot', methods=['GET'])
def generate_batch_lot():
    """배합 LOT 번호 자동 생성"""
    try:
        # BATCH-YYYYMMDD-XXX 형식
        today = datetime.now().strftime('%Y%m%d')
        prefix = f'BATCH-{today}-'

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 오늘 생성된 배치 중 마지막 번호 조회
            cursor.execute('''
                SELECT batch_lot FROM blending_work
                WHERE batch_lot LIKE ?
                ORDER BY batch_lot DESC
                LIMIT 1
            ''', (f'{prefix}%',))

            row = cursor.fetchone()

            if row:
                # 마지막 번호에서 1 증가
                last_lot = row[0]
                last_num = int(last_lot.split('-')[-1])
                next_num = last_num + 1
            else:
                # 오늘 첫 번째
                next_num = 1

            new_lot = f'{prefix}{next_num:03d}'

            return jsonify({'success': True, 'batch_lot': new_lot})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/blending/work/<int:work_id>', methods=['GET'])
def get_blending_work(work_id):
    """배합 작업 상세 조회 (Recipe 포함)"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 배합 작업 정보 조회
            cursor.execute('''
                SELECT * FROM blending_work
                WHERE id = ?
            ''', (work_id,))

            work_row = cursor.fetchone()

            if not work_row:
                return jsonify({'success': False, 'message': '배합 작업을 찾을 수 없습니다.'})

            work = dict_from_row(work_row)

            # Recipe 조회
            cursor.execute('''
                SELECT * FROM recipe
                WHERE product_name = ? AND is_active = 1
                ORDER BY id
            ''', (work['product_name'],))

            recipes = [dict_from_row(row) for row in cursor.fetchall()]

            # 이미 투입된 원재료 조회
            cursor.execute('''
                SELECT * FROM material_input
                WHERE blending_work_id = ?
                ORDER BY id
            ''', (work_id,))

            material_inputs = [dict_from_row(row) for row in cursor.fetchall()]

            # 각 Recipe에 목표 중량 계산
            for recipe in recipes:
                recipe['calculated_weight'] = (work['target_total_weight'] * recipe['ratio'] / 100) if work['target_total_weight'] else 0

            return jsonify({
                'success': True,
                'work': work,
                'recipes': recipes,
                'material_inputs': material_inputs
            })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/blending/validate-lot/<lot_number>', methods=['GET'])
def validate_material_lot(lot_number):
    """원재료 LOT 검증 (수입검사 완료 여부 확인)"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 수입검사 결과에서 LOT 조회
            cursor.execute('''
                SELECT powder_name, lot_number, final_result, inspection_time
                FROM inspection_result
                WHERE lot_number = ? AND category = 'incoming'
            ''', (lot_number,))

            row = cursor.fetchone()

            if not row:
                return jsonify({
                    'success': False,
                    'valid': False,
                    'message': f'LOT {lot_number}는 수입검사 기록이 없습니다.'
                })

            result = dict_from_row(row)

            if result['final_result'] != 'PASS':
                return jsonify({
                    'success': False,
                    'valid': False,
                    'message': f'LOT {lot_number}는 수입검사에서 불합격 처리되었습니다.'
                })

            return jsonify({
                'success': True,
                'valid': True,
                'powder_name': result['powder_name'],
                'lot_number': result['lot_number'],
                'inspection_time': result['inspection_time']
            })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/blending/material-input', methods=['POST'])
def save_material_input():
    """원재료 투입 기록 저장"""
    try:
        data = request.json

        required_fields = ['blending_work_id', 'powder_name', 'material_lot', 'target_weight', 'actual_weight']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'message': '필수 항목이 누락되었습니다.'})

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 1. 이종분말 검증 (material_lot의 분말명이 recipe의 분말명과 일치하는지)
            cursor.execute('''
                SELECT powder_name FROM inspection_result
                WHERE lot_number = ? AND category = 'incoming'
            ''', (data['material_lot'],))

            lot_row = cursor.fetchone()

            if not lot_row:
                return jsonify({
                    'success': False,
                    'message': f'LOT {data["material_lot"]}의 수입검사 기록을 찾을 수 없습니다.'
                })

            actual_powder = lot_row[0]

            if actual_powder != data['powder_name']:
                return jsonify({
                    'success': False,
                    'message': f'이종분말 검출! 투입하려는 분말({data["powder_name"]})과 LOT의 실제 분말({actual_powder})이 다릅니다.',
                    'is_wrong_material': True
                })

            # 2. 중량 편차 계산
            target_weight = float(data['target_weight'])
            actual_weight = float(data['actual_weight'])
            weight_deviation = ((actual_weight - target_weight) / target_weight * 100) if target_weight > 0 else 0
            weight_deviation = round(weight_deviation, 2)

            # 3. 허용 오차 확인
            tolerance = float(data.get('tolerance_percent', 5.0))
            is_valid = abs(weight_deviation) <= tolerance

            validation_message = None
            if not is_valid:
                validation_message = f'중량 편차({abs(weight_deviation):.2f}%)가 허용 오차({tolerance}%)를 초과했습니다.'

            # 4. material_input 테이블에 저장
            cursor.execute('''
                INSERT INTO material_input (
                    blending_work_id, powder_name, powder_category, material_lot,
                    target_weight, actual_weight, weight_deviation, is_valid,
                    validation_message, input_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['blending_work_id'],
                data['powder_name'],
                data.get('powder_category', 'incoming'),
                data['material_lot'],
                target_weight,
                actual_weight,
                weight_deviation,
                1 if is_valid else 0,
                validation_message,
                data.get('operator', '미지정')
            ))

            material_input_id = cursor.lastrowid

            # 5. 배합 작업의 실제 총 중량 업데이트
            cursor.execute('''
                SELECT COALESCE(SUM(actual_weight), 0) FROM material_input
                WHERE blending_work_id = ?
            ''', (data['blending_work_id'],))

            total_actual_weight = cursor.fetchone()[0]

            cursor.execute('''
                UPDATE blending_work
                SET actual_total_weight = ?
                WHERE id = ?
            ''', (total_actual_weight, data['blending_work_id']))

            conn.commit()

            return jsonify({
                'success': True,
                'material_input_id': material_input_id,
                'weight_deviation': weight_deviation,
                'is_valid': is_valid,
                'validation_message': validation_message
            })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/blending/complete/<int:work_id>', methods=['PUT'])
def complete_blending_work(work_id):
    """배합 작업 완료 처리"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 모든 원재료가 투입되었는지 확인
            cursor.execute('''
                SELECT COUNT(*) FROM recipe
                WHERE product_name = (
                    SELECT product_name FROM blending_work WHERE id = ?
                ) AND is_active = 1
            ''', (work_id,))

            expected_count = cursor.fetchone()[0]

            cursor.execute('''
                SELECT COUNT(*) FROM material_input
                WHERE blending_work_id = ?
            ''', (work_id,))

            actual_count = cursor.fetchone()[0]

            if actual_count < expected_count:
                return jsonify({
                    'success': False,
                    'message': f'아직 모든 원재료가 투입되지 않았습니다. ({actual_count}/{expected_count})'
                })

            # 배합 작업 상태를 완료로 변경
            cursor.execute('''
                UPDATE blending_work
                SET status = 'completed', end_time = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (work_id,))

            conn.commit()

            return jsonify({'success': True, 'message': '배합 작업이 완료되었습니다.'})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# API: 추적성 (Traceability)
# ============================================

@app.route('/api/traceability/batch/<batch_lot>', methods=['GET'])
def trace_by_batch_lot(batch_lot):
    """배합 LOT로 추적 (Backward Traceability): 배합 → 원재료 → 수입검사"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 1. 배합 작업 정보 조회
            cursor.execute('''
                SELECT * FROM blending_work
                WHERE batch_lot = ?
            ''', (batch_lot,))

            work_row = cursor.fetchone()

            if not work_row:
                return jsonify({
                    'success': False,
                    'message': f'배합 LOT {batch_lot}를 찾을 수 없습니다.'
                })

            work = dict_from_row(work_row)

            # 2. 원재료 투입 이력 조회
            cursor.execute('''
                SELECT * FROM material_input
                WHERE blending_work_id = ?
                ORDER BY id
            ''', (work['id'],))

            material_inputs = [dict_from_row(row) for row in cursor.fetchall()]

            # 3. 각 원재료의 수입검사 결과 조회
            for material in material_inputs:
                cursor.execute('''
                    SELECT powder_name, lot_number, inspection_type, inspector,
                           inspection_time, final_result
                    FROM inspection_result
                    WHERE lot_number = ? AND category = 'incoming'
                ''', (material['material_lot'],))

                inspection_row = cursor.fetchone()
                if inspection_row:
                    material['incoming_inspection'] = dict_from_row(inspection_row)
                else:
                    material['incoming_inspection'] = None

            return jsonify({
                'success': True,
                'trace_type': 'backward',
                'batch_lot': batch_lot,
                'blending_work': work,
                'material_inputs': material_inputs
            })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/traceability/material/<material_lot>', methods=['GET'])
def trace_by_material_lot(material_lot):
    """원재료 LOT로 추적 (Forward Traceability): 수입검사 → 사용된 배합들"""
    try:
        with closing(get_db()) as conn:
            cursor = conn.cursor()

            # 1. 수입검사 결과 조회
            cursor.execute('''
                SELECT * FROM inspection_result
                WHERE lot_number = ? AND category = 'incoming'
            ''', (material_lot,))

            inspection_row = cursor.fetchone()

            if not inspection_row:
                return jsonify({
                    'success': False,
                    'message': f'원재료 LOT {material_lot}의 수입검사 기록을 찾을 수 없습니다.'
                })

            inspection = dict_from_row(inspection_row)

            # 2. 이 LOT이 사용된 모든 배합 작업 조회
            cursor.execute('''
                SELECT
                    mi.*,
                    bw.work_order,
                    bw.product_name,
                    bw.batch_lot,
                    bw.target_total_weight,
                    bw.actual_total_weight,
                    bw.operator,
                    bw.status,
                    bw.start_time,
                    bw.end_time
                FROM material_input mi
                JOIN blending_work bw ON mi.blending_work_id = bw.id
                WHERE mi.material_lot = ?
                ORDER BY bw.start_time DESC
            ''', (material_lot,))

            usages = [dict_from_row(row) for row in cursor.fetchall()]

            return jsonify({
                'success': True,
                'trace_type': 'forward',
                'material_lot': material_lot,
                'incoming_inspection': inspection,
                'used_in_batches': usages
            })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/traceability/search', methods=['GET'])
def search_traceability():
    """통합 추적성 검색"""
    try:
        lot_number = request.args.get('lot_number', '')

        if not lot_number:
            return jsonify({'success': False, 'message': 'LOT 번호를 입력하세요.'})

        with closing(get_db()) as conn:
            cursor = conn.cursor()

            result = {
                'success': True,
                'lot_number': lot_number,
                'found_as': []
            }

            # 1. 배합 LOT로 검색
            cursor.execute('''
                SELECT COUNT(*) FROM blending_work
                WHERE batch_lot = ?
            ''', (lot_number,))

            if cursor.fetchone()[0] > 0:
                result['found_as'].append('batch_lot')

            # 2. 원재료 LOT로 검색
            cursor.execute('''
                SELECT COUNT(*) FROM inspection_result
                WHERE lot_number = ? AND category = 'incoming'
            ''', (lot_number,))

            if cursor.fetchone()[0] > 0:
                result['found_as'].append('material_lot')

            if not result['found_as']:
                return jsonify({
                    'success': False,
                    'message': f'LOT {lot_number}를 찾을 수 없습니다.'
                })

            return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# ============================================
# 서버 실행
# ============================================

if __name__ == '__main__':
    print("=" * 50)
    print("분말 검사 시스템 서버 시작")
    print("=" * 50)
    print("접속 주소: http://localhost:5000")
    print("내부 네트워크 접속: http://<이 PC의 IP>:5000")
    print("종료: Ctrl+C")
    print("=" * 50)

    app.run(host='0.0.0.0', port=5000, debug=True)
