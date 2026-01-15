// 분말 검사 시스템 - 메인 JavaScript

// API Base URL
const API_BASE = '';

// 현재 검사 데이터
let currentInspection = null;
let currentItems = [];
let currentSavedValues = {}; // 저장된 측정값
// 임시 판정 결과 저장
let pendingResults = {};

// 안전한 이벤트 리스너 추가 헬퍼 함수
function safeAddEventListener(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, handler);
        return true;
    }
    return false;
}

// 한국어 텍스트 매핑 함수
function t(key) {
    const ko = {
        // 사이드바
        appTitle: '배합공정 관리시스템',
        navDashboard: '대시보드',
        navIncoming: '수입검사',
        navMixing: '배합검사',
        navStartInspection: '새 검사 시작',
        navSearchResults: '검사결과 조회',
        navAdmin: '관리자 모드',

        // 대시보드
        dashboardTitle: '대시보드',
        ongoingInspections: '진행중인 검사',
        noOngoingInspections: '진행중인 검사가 없습니다',
        powderName: '분말명',
        lotNumber: 'LOT번호',
        inspectionType: '검사타입',
        inspector: '검사자',
        progress: '진행률',
        action: '작업',
        continue: '이어하기',
        category: '검사구분',
        incoming: '수입검사',
        mixing: '배합검사',
        all: '전체',

        // 검사 관련
        inspectionTime: '검사시간',
        finalResult: '최종결과',
        detail: '상세',
        view: '보기',
        noResults: '검색 결과가 없습니다',
        average: '평균',
        result: '결과',
        inspectionDetails: '검사 항목 상세',
        particleSize: '입도분석',

        // 검사 항목
        flowRate: '유동도',
        apparentDensity: '겉보기밀도',
        cContent: 'C함량',
        cuContent: 'Cu함량',
        moisture: '수분도',
        ash: '회분도',
        sinterChangeRate: '소결변화율',
        sinterStrength: '소결강도',
        formingStrength: '성형강도',
        formingLoad: '성형하중',

        // 삭제 확인
        deleteInspectionConfirm: '진행중인 검사를 삭제하시겠습니까?',
        deleteSuccess: '삭제되었습니다',
        deleteError: '삭제 실패',
        delete: '삭제',

        // 관리자
        noPowders: '등록된 분말이 없습니다',
        selectPowderPlaceholder: '분말을 선택하세요',
        meshSize: 'Mesh Size',
        minValue: '최소값',
        maxValue: '최대값',
        noParticleSpecs: '등록된 입도분석 규격이 없습니다',
        addParticleSpec: '입도분석 규격 추가',
        editParticleSpec: '입도분석 규격 수정',
        edit: '수정',
        inspectorName: '검사자 이름',
        noInspectors: '등록된 검사자가 없습니다',
        operatorName: '작업자 이름',
        noOperators: '등록된 작업자가 없습니다',
        addPowder: '새 분말 추가',
        editPowder: '분말 수정',
        selectPlaceholder: '선택하세요',

        // Recipe 관련
        noProducts: '등록된 제품이 없습니다',
        productCode: '제품 코드',
        ratio: '비율',
        tolerance: '허용 오차',
        totalRatio: '합계',
        addNewProduct: '+ 새 제품 추가',
        editProduct: '제품 수정',

        // 배합 작업
        calculatedWeight: '계산된 중량',

        // 라벨/바코드
        companyName: 'Johnson Electric Operations',
        labelPack: 'Pack',
        labelWeight: '중량',
        labelDate: '작업날짜',
        printLabel: '인쇄'
    };
    return ko[key] || key;
}

        // ============================================
        // 준비중 메뉴 안내
        // ============================================
        function showComingSoon(menuName) {
            const message = `"${menuName}" 기능은 현재 개발 중입니다.\n\n향후 업데이트에서 제공될 예정입니다.`;
            alert(message);
        }

        // ============================================
        // 페이지 전환
        // ============================================
        function showPage(pageName) {
            // 관리자 모드 접근 시 비밀번호 확인
            if (pageName === 'admin') {
                verifyAdminPassword();
                return;
            }

            // 바코드 라벨 패널 숨기기 (페이지 전환 시)
            if (pageName !== 'auto-input') {
                const labelPanel = document.getElementById('labelPanel');
                if (labelPanel) {
                    labelPanel.style.display = 'none';
                    labelPanel.setAttribute('aria-hidden', 'true');
                }
            }

            // 페이지 전환
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById(pageName).classList.add('active');

            // 네비게이션 active 상태 업데이트
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
            if (activeNav) {
                activeNav.classList.add('active');
            }

            // 페이지별 초기화
            if (pageName === 'dashboard') {
                loadIncompleteInspections();
            } else if (pageName === 'incoming') {
                loadPowderList('incoming');
                loadInspectorList('incoming');
                loadIncomingIncompleteInspections();

                // 수입검사 폼 초기화
                const incomingForm = document.getElementById('incomingForm');
                if (incomingForm) {
                    incomingForm.reset();
                    // 검사일을 오늘 날짜로 재설정
                    const incomingDateInput = document.getElementById('incomingInspectionDate');
                    if (incomingDateInput) {
                        const today = new Date().toISOString().split('T')[0];
                        incomingDateInput.value = today;
                    }
                }
            } else if (pageName === 'mixing') {
                // mixing 페이지는 완료된 배합작업 목록만 보여줌
                loadMixingPage();
            } else if (pageName === 'blending') {
                // hide form initially so only orders list shows
                hideBlendingForm();
                loadBlendingPage();
            } else if (pageName === 'search') {
                loadPowderListForSearch();
            } else if (pageName === 'blending-log') {
                loadMixingPowderListForFilter();
                loadBlendingWorks();
            } else if (pageName === 'blending-orders') {
                loadBlendingOrdersPage();
            } else if (pageName === 'traceability') {
                // 추적성 조회 페이지 초기화
                const resultsDiv = document.getElementById('traceabilityResults');
                if (resultsDiv) {
                    resultsDiv.innerHTML = '';
                }
                loadTraceabilityPowderList();
            }
        }

        // ============================================
        // 관리자 비밀번호 확인
        // ============================================
        async function verifyAdminPassword() {
            const password = prompt('관리자 비밀번호를 입력하세요:');

            if (password === null) {
                // 사용자가 취소를 클릭
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/admin/verify-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password: password })
                });

                const data = await response.json();

                if (data.success) {
                    // 비밀번호 확인 성공 - 관리자 페이지로 이동
                    showAdminPageDirect();
                } else {
                    alert('비밀번호가 일치하지 않습니다.');
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        function showAdminPageDirect() {
            // 비밀번호 확인 후 직접 관리자 페이지 표시
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById('admin').classList.add('active');

            // 네비게이션 active 상태 업데이트
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeNav = document.querySelector(`.nav-item[data-page="admin"]`);
            if (activeNav) {
                activeNav.classList.add('active');
            }

            // 관리자 페이지 로드
            loadAdminPage();
        }

        // ============================================
        // 관리자 페이지: 탭 전환
        // ============================================
        function showAdminTab(tabName) {
            // 탭 버튼 active 상태 변경
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.target.closest('.admin-tab').classList.add('active');

            // 탭 콘텐츠 전환
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabName}-tab`).classList.add('active');
        }

        // 분말 관리 탭 : 수입 / 배합 분말을 분리하여 같은 컨텐츠를 재사용
        let powderSpecMode = 'incoming';

        function showPowderManagement(mode) {
            // mode: 'incoming' or 'mixing'
            powderSpecMode = mode;

            // 폼이 열려있으면 닫기
            hidePowderForm();

            // 탭 버튼 처리 (active 토글)
            // 먼저 모든 admin-tab 버튼의 active 클래스 제거
            document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
            // 그 다음 선택된 탭만 active 추가
            if (mode === 'incoming') document.getElementById('adminTabIncoming').classList.add('active');
            else document.getElementById('adminTabMixing').classList.add('active');

            // 관리자 컨텐츠는 기존 powder-spec-tab 사용
            document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById('powder-spec-tab').classList.add('active');

            // 로드 및 필터링
            loadPowderSpecs(mode);
        }

        // ============================================
        // 대시보드: 진행중 검사 목록
        // ============================================
        async function loadIncompleteInspections() {
            try {
                const response = await fetch(`${API_BASE}/api/incomplete-inspections`);
                const data = await response.json();

                const listDiv = document.getElementById('incompleteList');

                if (data.success && data.data.length > 0) {
                    let html = `<table><tr><th>${t('category')}</th><th>${t('powderName')}</th><th>${t('lotNumber')}</th><th>${t('inspectionType')}</th><th>${t('inspector')}</th><th>${t('progress')}</th><th>${t('action')}</th></tr>`;

                    data.data.forEach(item => {
                        const categoryBadge = item.category === 'incoming'
                            ? `<span class="badge" style="background: #2196F3;">${t('incoming')}</span>`
                            : `<span class="badge" style="background: #FF9800;">${t('mixing')}</span>`;

                        html += `
                            <tr>
                                <td>${categoryBadge}</td>
                                <td>${item.powder_name}</td>
                                <td>${item.lot_number}</td>
                                <td>${item.inspection_type}</td>
                                <td>${item.inspector}</td>
                                <td>
                                    <button class="btn" onclick="continueInspection('${item.powder_name}', '${item.lot_number}', '${item.category}')" style="margin-right: 5px;">${t('continue')}</button>
                                    <button class="btn danger" onclick="deleteIncompleteInspection('${item.powder_name}', '${item.lot_number}')">${t('delete')}</button>
                                </td>
                            </tr>
                        `;
                    });

                    html += '</table>';
                    listDiv.innerHTML = html;
                } else {
                    listDiv.innerHTML = `<div class="empty-message">${t('noOngoingInspections')}</div>`;
                }
            } catch (error) {
                document.getElementById('incompleteList').innerHTML = `<div class="empty-message">오류: ${error.message}</div>`;
            }
        }

        // 진행중인 검사 삭제
        async function deleteIncompleteInspection(powderName, lotNumber) {
            if (!confirm(t('deleteInspectionConfirm'))) {
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/delete-incomplete-inspection/${encodeURIComponent(powderName)}/${encodeURIComponent(lotNumber)}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    alert(t('deleteSuccess'));
                    loadIncompleteInspections();  // 목록 새로고침
                    loadIncomingIncompleteInspections(); // 수입검사 페이지 목록도 새로고침
                } else {
                    alert(t('deleteError') + ': ' + data.message);
                }
            } catch (error) {
                alert(t('deleteError') + ': ' + error.message);
            }
        }

        // 수입검사 페이지: 진행 중인 검사 목록 (수입검사만 표시)
        async function loadIncomingIncompleteInspections() {
            try {
                const response = await fetch(`${API_BASE}/api/incomplete-inspections`);
                const data = await response.json();

                const listDiv = document.getElementById('incomingIncompleteList');
                if (!listDiv) return;

                // 수입검사만 필터링
                const incomingInspections = data.success && data.data
                    ? data.data.filter(item => item.category === 'incoming')
                    : [];

                if (incomingInspections.length > 0) {
                    let html = `<table><tr><th>검사일</th><th>${t('powderName')}</th><th>${t('lotNumber')}</th><th>${t('inspectionType')}</th><th>${t('inspector')}</th><th>${t('progress')}</th><th>${t('action')}</th></tr>`;

                    incomingInspections.forEach(item => {
                        // 진행률 계산: completedItems와 totalItems 배열 사용
                        const completedCount = (item.completedItems && item.completedItems.length) || 0;
                        const totalCount = (item.totalItems && item.totalItems.length) || 0;
                        const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                        const progressBar = `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="flex: 1; background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden;">
                                    <div style="width: ${progressPercent}%; background: #4CAF50; height: 100%; transition: width 0.3s;"></div>
                                </div>
                                <span style="font-size: 12px; font-weight: 600;">${progressPercent}%</span>
                            </div>
                        `;

                        // 검사일 포맷
                        const inspectionDate = item.inspection_date || '-';

                        html += `
                            <tr>
                                <td>${inspectionDate}</td>
                                <td>${item.powder_name}</td>
                                <td>${item.lot_number}</td>
                                <td>${item.inspection_type}</td>
                                <td>${item.inspector}</td>
                                <td>${progressBar}</td>
                                <td>
                                    <button class="btn" onclick="continueInspection('${item.powder_name}', '${item.lot_number}', '${item.category}')" style="margin-right: 5px;">검사 이어하기</button>
                                    <button class="btn danger" onclick="deleteIncompleteInspection('${item.powder_name}', '${item.lot_number}')">삭제</button>
                                </td>
                            </tr>
                        `;
                    });

                    html += '</table>';
                    listDiv.innerHTML = html;
                } else {
                    listDiv.innerHTML = `<div class="empty-message">진행 중인 검사가 없습니다</div>`;
                }
            } catch (error) {
                const listDiv = document.getElementById('incomingIncompleteList');
                if (listDiv) {
                    listDiv.innerHTML = `<div class="empty-message">오류: ${error.message}</div>`;
                }
            }
        }

        // ============================================
        // 검사 시작
        // ============================================
        async function loadPowderList(category = null) {
            try {
                const url = category
                    ? `${API_BASE}/api/powder-list?category=${category}`
                    : `${API_BASE}/api/powder-list`;
                const response = await fetch(url);
                const data = await response.json();

                const selectId = category ? `${category}PowderName` : 'powderName';
                const select = document.getElementById(selectId);
                if (!select) return;

                select.innerHTML = '<option value="">선택하세요</option>';

                if (data.success) {
                    data.data.forEach(powder => {
                        const option = document.createElement('option');
                        option.value = powder;
                        option.textContent = powder;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                alert('분말 목록 로딩 실패: ' + error.message);
            }
        }

        async function loadInspectorList(category = null) {
            try {
                const response = await fetch(`${API_BASE}/api/inspector-list`);
                const data = await response.json();

                const selectId = category ? `${category}Inspector` : 'inspector';
                const select = document.getElementById(selectId);
                if (!select) return;

                select.innerHTML = '<option value="">선택하세요</option>';

                if (data.success) {
                    data.data.forEach(inspector => {
                        const option = document.createElement('option');
                        option.value = inspector;
                        option.textContent = inspector;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                alert('검사자 목록 로딩 실패: ' + error.message);
            }
        }

        // 수입검사 폼 처리
        const incomingFormElement = document.getElementById('incomingForm');

        if (incomingFormElement) {
            // 검사일 기본값을 오늘 날짜로 설정
            const incomingDateInput = document.getElementById('incomingInspectionDate');
            if (incomingDateInput && !incomingDateInput.value) {
                const today = new Date().toISOString().split('T')[0];
                incomingDateInput.value = today;
            }

            incomingFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const powderName = document.getElementById('incomingPowderName').value;
            const lotNumber = document.getElementById('incomingLotNumber').value;
            const inspectionDate = document.getElementById('incomingInspectionDate').value;
            const inspectionType = document.getElementById('incomingInspectionType').value;
            const inspector = document.getElementById('incomingInspector').value;
            const category = 'incoming';

            await startInspection(powderName, lotNumber, inspectionType, inspector, category, inspectionDate);
        });
        }

        // 배합검사 폼 처리
        const mixingFormElement = document.getElementById('mixingForm');

        if (mixingFormElement) {

            mixingFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const powderName = document.getElementById('mixingPowderName').value;
            const lotNumber = document.getElementById('mixingLotNumber').value;
            const inspectionType = document.getElementById('mixingInspectionType').value;
            const inspector = document.getElementById('mixingInspector').value;
            const category = 'mixing';

            await startInspection(powderName, lotNumber, inspectionType, inspector, category);
        });
        }

        // 배합작업 조회에서 넘어온 경우 LOT 정보 자동 채우기
        function checkAndFillBlendingInspectionLot() {
            const batchLot = sessionStorage.getItem('blendingInspectionLot');
            const productName = sessionStorage.getItem('blendingInspectionProduct');

            if (batchLot && productName) {
                // LOT 정보 채우기 (배합 LOT는 제품명과 동일)
                setTimeout(() => {
                    const powderSelect = document.getElementById('mixingPowderName');
                    if (powderSelect) {
                        // 제품명을 분말명 선택에서 찾기
                        for (let option of powderSelect.options) {
                            if (option.value === productName) {
                                option.selected = true;
                                break;
                            }
                        }
                    }

                    const lotInput = document.getElementById('mixingLotNumber');
                    if (lotInput) {
                        lotInput.value = batchLot;
                    }

                    // sessionStorage 클리어
                    sessionStorage.removeItem('blendingInspectionLot');
                    sessionStorage.removeItem('blendingInspectionProduct');
                }, 300);  // 분말 목록 로딩 대기
            }
        }

        // 검사 시작 공통 함수
        async function startInspection(powderName, lotNumber, inspectionType, inspector, category, inspectionDate = null) {
            try {
                const response = await fetch(`${API_BASE}/api/start-inspection`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ powderName, lotNumber, inspectionType, inspector, category, inspectionDate })
                });

                const data = await response.json();

                if (data.success) {
                    if (data.isExisting && data.data.isCompleted) {
                        alert('이미 완료된 검사입니다.');
                        return;
                    }

                    currentInspection = data.data;
                    currentItems = data.items;

                    showInspectionPage();
                } else {
                    alert('검사 시작 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // ============================================
        // 검사 진행 페이지
        // ============================================
        async function continueInspection(powderName, lotNumber, category) {
            // Fetch existing inspection data
            try {
                const response = await fetch(`${API_BASE}/api/start-inspection`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ powderName, lotNumber, inspectionType: '', inspector: '', category })
                });

                const data = await response.json();

                if (data.success) {
                    currentInspection = data.data;
                    currentItems = data.items;
                    currentSavedValues = data.savedValues || {}; // 저장된 측정값
                    showInspectionPage();
                } else {
                    alert('검사 로딩 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        async function showInspectionPage() {
            document.getElementById('infoPowderName').textContent = currentInspection.powderName;
            document.getElementById('infoLotNumber').textContent = currentInspection.lotNumber;
            document.getElementById('infoInspectionDate').textContent = currentInspection.inspectionDate || '-';

            // 검사자 표시 영역 설정 (category에 따라 다르게)
            const inspectorDisplay = document.getElementById('inspectorDisplay');
            const category = currentInspection.category || 'incoming';

            if (category === 'incoming') {
                // 수입검사: 검사자를 표시만 (수정 불가)
                const inspectorName = currentInspection.inspector || '미지정';
                inspectorDisplay.innerHTML = `<p style="font-size: 1.1em; font-weight: 600; color: white;">${inspectorName}</p>`;
            } else if (category === 'mixing') {
                // 배합검사: 검사자를 선택할 수 있음
                // 먼저 select 요소 생성
                inspectorDisplay.innerHTML = `
                    <select id="infoInspector" onchange="updateInspector()" style="font-size: 1.1em; font-weight: 600; padding: 8px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #000; border-radius: 6px; cursor: pointer; width: 100%;">
                        <option value="">선택하세요</option>
                    </select>
                `;

                // select가 생성된 후 검사자 목록 로드
                await loadInspectorListForInspection();
                const inspectorSelect = document.getElementById('infoInspector');
                if (inspectorSelect && currentInspection.inspector) {
                    inspectorSelect.value = currentInspection.inspector;
                }
            }

            const completed = currentInspection.completedItems || [];
            const total = currentInspection.totalItems || [];
            document.getElementById('infoProgress').textContent = `${completed.length}/${total.length}`;

            renderInspectionItems();
            showPage('inspection');
        }

        // 검사 진행 화면용 검사자 목록 로드
        async function loadInspectorListForInspection() {
            try {
                const response = await fetch(`${API_BASE}/api/inspector-list`);
                const result = await response.json();

                const select = document.getElementById('infoInspector');
                if (!select) return;

                // 기존 옵션 유지하고 검사자 목록 추가
                select.innerHTML = '<option value="">선택하세요</option>';

                if (result.success && result.data) {
                    result.data.forEach(inspectorName => {
                        const option = document.createElement('option');
                        option.value = inspectorName;
                        option.textContent = inspectorName;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('검사자 목록 로딩 실패:', error);
            }
        }

        // 검사자 변경
        async function updateInspector() {
            const newInspector = document.getElementById('infoInspector').value;

            if (!newInspector) {
                alert('검사자를 선택하세요.');
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/update-inspector`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        powderName: currentInspection.powderName,
                        lotNumber: currentInspection.lotNumber,
                        inspector: newInspector,
                        category: currentInspection.category || 'incoming'
                    })
                });

                const data = await response.json();

                if (data.success) {
                    currentInspection.inspector = newInspector;
                    alert('검사자가 변경되었습니다.');
                } else {
                    alert('검사자 변경 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        function renderInspectionItems() {
            const container = document.getElementById('inspectionItems');
            container.innerHTML = '';

            const completed = currentInspection.completedItems || [];

            currentItems.forEach(item => {
                const isCompleted = completed.includes(item.name);

                const itemDiv = document.createElement('div');
                itemDiv.className = 'card';
                itemDiv.style.borderLeft = isCompleted ? '5px solid #4CAF50' : '5px solid #667eea';
                itemDiv.style.boxShadow = isCompleted ? '0 2px 8px rgba(76, 175, 80, 0.2)' : '0 2px 8px rgba(102, 126, 234, 0.2)';

                let html = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="margin: 0; color: #2c3e50; font-size: 1.3em;">${item.displayName}</h3>
                        ${isCompleted ? '<span class="badge pass" style="font-size: 1em; padding: 6px 12px;">✓ 완료</span>' : '<span class="badge progress" style="font-size: 1em; padding: 6px 12px;">진행중</span>'}
                    </div>
                    <div style="padding: 10px; background: #f5f7fa; border-radius: 5px; margin-bottom: 15px;">
                        <strong style="color: #667eea;">측정 단위:</strong> ${item.unit} |
                        <strong style="color: #667eea;">규격:</strong> ${item.min || '-'} ~ ${item.max || '-'} ${item.unit}
                    </div>
                `;

                if (!isCompleted) {
                    html += `<div id="item-${item.name}"></div>`;
                }

                itemDiv.innerHTML = html;
                container.appendChild(itemDiv);

                if (!isCompleted) {
                    renderItemInputs(item);
                }
            });
        }

        function renderItemInputs(item) {
            const container = document.getElementById(`item-${item.name}`);
            const savedValue = currentSavedValues[item.name] || {}; // 저장된 값 가져오기

            if (item.isParticleSize) {
                // 입도분석
                let html = '<h4 style="margin-bottom: 15px; color: #667eea;">📊 입도분석 측정</h4>';
                html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">';
                item.particleSpecs.forEach((spec, index) => {
                    // 저장된 값이 있으면 파싱 (JSON 형식으로 저장되어 있을 수 있음)
                    let val1 = '', val2 = '';
                    if (savedValue.value1) {
                        try {
                            const parsed = JSON.parse(savedValue.value1);
                            if (parsed[index]) {
                                val1 = parsed[index][0] || '';
                                val2 = parsed[index][1] || '';
                            }
                        } catch (e) {
                            // 파싱 실패시 무시
                        }
                    }
                    html += `
                        <div style="padding: 15px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="font-weight: 600; margin-bottom: 8px; color: #2c3e50;">${spec.mesh_size}</div>
                            <div style="font-size: 0.9em; color: #666; margin-bottom: 10px;">규격: ${spec.min_value}~${spec.max_value}%</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <input type="number" step="0.1" placeholder="1차" id="${item.name}_${index}_1" value="${val1}" style="padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                                <input type="number" step="0.1" placeholder="2차" id="${item.name}_${index}_2" value="${val2}" style="padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                html += `<div style="display: flex; gap:8px; margin-top: 20px;\"><button class="btn" onclick="judgeParticleSize('${item.name}')" style="flex:1; background:#FF9800;">🔎 판정</button><button class="btn" id="final-save-${item.name}" onclick="finalSaveParticleSize('${item.name}')" style="flex:1; background:#2196F3;" disabled>💾 최종저장</button></div>`;
                html += '<div class="result-display" id="result-' + item.name + '" style="display:none; margin-top: 15px;"></div>';
                container.innerHTML = html;

            } else if (item.isWeightBased) {
                // 중량 기반 항목 (겉보기밀도, 수분도, 회분도)
                let label1 = '', label2 = '';
                if (item.name === 'ApparentDensity') {
                    label1 = '빈컵중량';
                    label2 = '분말중량';
                } else if (item.name === 'Moisture') {
                    label1 = '초기중량';
                    label2 = '건조후중량';
                } else if (item.name === 'Ash') {
                    label1 = '초기중량';
                    label2 = '회분중량';
                }

                let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0;">';
                for (let i = 1; i <= 3; i++) {
                    // 저장된 값 가져오기
                    let val1 = '', val2 = '';
                    if (savedValue[`value${i}`]) {
                        try {
                            const parsed = JSON.parse(savedValue[`value${i}`]);
                            val1 = parsed[0] || '';
                            val2 = parsed[1] || '';
                        } catch (e) {
                            // 파싱 실패시 무시
                        }
                    }
                    html += `
                        <div style="padding: 15px; background: #f9f9f9; border-radius: 8px; border: 2px solid #e0e0e0;">
                            <div style="font-weight: 600; margin-bottom: 10px; text-align: center; color: #667eea;">${i}차 측정</div>
                            <div style="margin-bottom: 8px;">
                                <label style="font-size: 0.85em; color: #666;">${label1} (g)</label>
                                <input type="number" step="0.01" placeholder="${label1}" id="${item.name}_${label1}_${i}" value="${val1}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; margin-top: 4px;">
                            </div>
                            <div>
                                <label style="font-size: 0.85em; color: #666;">${label2} (g)</label>
                                <input type="number" step="0.01" placeholder="${label2}" id="${item.name}_${label2}_${i}" value="${val2}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; margin-top: 4px;">
                            </div>
                        </div>
                    `;
                }
                html += '</div>';
                html += `<div style="display: flex; gap:8px; margin-top: 10px;\"><button class="btn" onclick="judgeItem('${item.name}', true)" style="flex:1; background:#FF9800;">🔎 판정</button><button class="btn" id="final-save-${item.name}" onclick="finalSaveItem('${item.name}', true)" style="flex:1; background:#2196F3;" disabled>💾 최종저장</button></div>`;
                html += '<div class="result-display" id="result-' + item.name + '" style="display:none; margin-top: 15px;"></div>';
                container.innerHTML = html;

            } else {
                // 일반 항목
                let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0;">';
                for (let i = 1; i <= 3; i++) {
                    // 저장된 값 가져오기
                    const val = savedValue[`value${i}`] || '';
                    html += `
                        <div style="text-align: center;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #667eea;">${i}차 측정</label>
                            <input type="number" step="0.01" placeholder="값 입력" id="${item.name}_${i}" value="${val}" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1.1em; text-align: center;">
                        </div>
                    `;
                }
                html += '</div>';
                html += `<div style="display: flex; gap:8px; margin-top: 10px;\"><button class="btn" onclick="judgeItem('${item.name}', false)" style="flex:1; background:#FF9800;">🔎 판정</button><button class="btn" id="final-save-${item.name}" onclick="finalSaveItem('${item.name}', false)" style="flex:1; background:#2196F3;" disabled>💾 최종저장</button></div>`;
                html += '<div class="result-display" id="result-' + item.name + '" style="display:none; margin-top: 15px;"></div>';
                container.innerHTML = html;
            }
        }

        // 로컬 판정: 입력값으로 평균/판정 계산 후 화면에 표시만 하고, 최종 저장 버튼을 활성화
        function judgeItem(itemName, isWeightBased) {
            const item = currentItems.find(i => i.name === itemName);
            if (!item) return alert('항목 정보를 찾을 수 없습니다.');

            let values = [];
            let average = null;
            let result = 'PASS';

            if (isWeightBased) {
                let label1 = '', label2 = '';
                if (itemName === 'ApparentDensity') {
                    label1 = '빈컵중량';
                    label2 = '분말중량';
                } else if (itemName === 'Moisture') {
                    label1 = '초기중량';
                    label2 = '건조후중량';
                } else if (itemName === 'Ash') {
                    label1 = '초기중량';
                    label2 = '회분중량';
                }

                const calcVals = [];
                for (let i = 1; i <= 3; i++) {
                    const val1 = document.getElementById(`${itemName}_${label1}_${i}`).value;
                    const val2 = document.getElementById(`${itemName}_${label2}_${i}`).value;
                    values.push(val1 || '', val2 || '');

                    if (itemName === 'ApparentDensity') {
                        if (val1 && val2) {
                            const density = (parseFloat(val2) - parseFloat(val1)) / 25;
                            calcVals.push(density);
                        }
                    } else if (itemName === 'Moisture') {
                        if (val1 && val2) {
                            const m = ((parseFloat(val1) - parseFloat(val2)) / parseFloat(val1)) * 100;
                            calcVals.push(m);
                        }
                    } else if (itemName === 'Ash') {
                        if (val1 && val2) {
                            // Ash: use decrease rate like Moisture ((initial - ash)/initial)*100
                            const a = ((parseFloat(val1) - parseFloat(val2)) / parseFloat(val1)) * 100;
                            calcVals.push(a);
                        }
                    }
                }

                if (calcVals.length > 0) {
                    average = Math.round((calcVals.reduce((s, v) => s + v, 0) / calcVals.length) * 100) / 100;
                }

            } else {
                const vals = [];
                for (let i = 1; i <= 3; i++) {
                    const val = document.getElementById(`${itemName}_${i}`).value;
                    values.push(val || '');
                    if (val !== '') vals.push(parseFloat(val));
                }
                if (vals.length > 0) {
                    average = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
                }
            }

            // 규격 판정 (로컬)
            if (average !== null) {
                const min = item.min;
                const max = item.max;
                if ((min !== null && min !== undefined && average < min) || (max !== null && max !== undefined && average > max)) {
                    result = 'FAIL';
                } else {
                    result = 'PASS';
                }
            } else {
                return alert('유효한 측정값이 없습니다.');
            }

            // 결과 표시 및 임시저장
            const resultDiv = document.getElementById('result-' + itemName);
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `평균: ${average} | 결과: <span class="badge ${result === 'PASS' ? 'pass' : 'fail'}">${result}</span>`;

            pendingResults[itemName] = { values: values, average: average, result: result };

            // 최종 저장 버튼 활성화
            const finalBtn = document.getElementById(`final-save-${itemName}`);
            if (finalBtn) finalBtn.disabled = false;
        }

        // 서버에 실제 저장 (최종 저장)
        async function finalSaveItem(itemName, isWeightBased) {
            const pending = pendingResults[itemName];
            if (!pending) return alert('먼저 판정(검증)을 수행하세요.');

            try {
                const response = await fetch(`${API_BASE}/api/save-item`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        powderName: currentInspection.powderName,
                        lotNumber: currentInspection.lotNumber,
                        itemName: itemName,
                        values: pending.values
                    })
                });

                const data = await response.json();

                if (data.success) {
                    const resultDiv = document.getElementById('result-' + itemName);
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = `평균: ${data.average} | 결과: <span class="badge ${data.result === 'PASS' ? 'pass' : 'fail'}">${data.result}</span>`;

                    // 완료 항목에 추가
                    if (!currentInspection.completedItems.includes(itemName)) {
                        currentInspection.completedItems.push(itemName);
                    }

                    // pending 제거 및 버튼 비활성화
                    delete pendingResults[itemName];
                    const finalBtn = document.getElementById(`final-save-${itemName}`);
                    if (finalBtn) finalBtn.disabled = true;

                    // 검사 진행 상황 갱신
                    setTimeout(async () => {
                        await checkInspectionCompletion();
                        renderInspectionItems();
                    }, 500);
                } else {
                    alert('저장 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        async function checkInspectionCompletion() {
            // 모든 항목이 완료되었는지 확인
            const totalItems = currentInspection.totalItems || [];
            const completedItems = currentInspection.completedItems || [];

            if (completedItems.length === totalItems.length && totalItems.length > 0) {
                // 모든 검사항목 완료
                alert('모든 검사항목이 완료되었습니다!');
                // 검사 카테고리에 따라 적절한 페이지로 이동
                if (currentInspection.category === 'incoming') {
                    showPage('incoming');
                } else if (currentInspection.category === 'mixing') {
                    showPage('mixing');
                }
            }
        }

        async function saveParticleSize(itemName) {
            const item = currentItems.find(i => i.name === itemName);
            const particleData = {};

            const meshIds = ['180', '150', '106', '75', '45', '45M'];

                item.particleSpecs.forEach((spec, index) => {
                const val1 = document.getElementById(`${itemName}_${index}_1`).value;
                const val2 = document.getElementById(`${itemName}_${index}_2`).value;

                // Accept single measurement as valid: use whichever value is provided
                if (val1 || val2) {
                    const num1 = val1 ? parseFloat(val1) : null;
                    const num2 = val2 ? parseFloat(val2) : null;
                    let avg;
                    if (num1 !== null && num2 !== null) {
                        avg = ((num1 + num2) / 2).toFixed(1);
                    } else {
                        avg = (num1 !== null ? num1 : num2).toFixed(1);
                    }

                    const result = (parseFloat(avg) >= spec.min_value && parseFloat(avg) <= spec.max_value) ? '합격' : '불합격';

                    particleData[meshIds[index]] = {
                        val1: val1 || null,
                        val2: val2 || null,
                        avg: avg,
                        result: result
                    };
                }
            });

            try {
                const response = await fetch(`${API_BASE}/api/save-particle-size`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        powderName: currentInspection.powderName,
                        lotNumber: currentInspection.lotNumber,
                        particleData: particleData
                    })
                });

                const data = await response.json();

                if (data.success) {
                    const resultDiv = document.getElementById('result-' + itemName);
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = `결과: <span class="badge ${data.result === 'PASS' ? 'pass' : 'fail'}">${data.result}</span>`;

                    // 완료된 항목에 추가
                    if (!currentInspection.completedItems.includes(itemName)) {
                        currentInspection.completedItems.push(itemName);
                    }

                    // 저장 성공 후 검사 진행 상황 다시 로드
                    setTimeout(async () => {
                        await checkInspectionCompletion();
                        renderInspectionItems();
                    }, 1500);
                } else {
                    alert('저장 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // 입도분석 로컬 판정: 결과만 표시하고 최종저장 버튼 활성화
        function judgeParticleSize(itemName) {
            const item = currentItems.find(i => i.name === itemName);
            if (!item) return alert('항목 정보를 찾을 수 없습니다.');

            const particleData = {};
            const meshIds = ['180', '150', '106', '75', '45', '45M'];
            let overallResult = 'PASS';
            let anyMeasured = false;

            // Build detailed result HTML
            let detailHtml = '<div style="display:flex;flex-direction:column;gap:8px;">';

            item.particleSpecs.forEach((spec, index) => {
                const meshLabel = spec.mesh_size || meshIds[index] || (`mesh${index}`);
                const val1El = document.getElementById(`${itemName}_${index}_1`);
                const val2El = document.getElementById(`${itemName}_${index}_2`);
                const val1 = val1El ? val1El.value : '';
                const val2 = val2El ? val2El.value : '';

                if (val1 || val2) {
                    anyMeasured = true;
                    const num1 = val1 ? parseFloat(val1) : null;
                    const num2 = val2 ? parseFloat(val2) : null;
                    let avg;
                    if (num1 !== null && num2 !== null) {
                        avg = ((num1 + num2) / 2).toFixed(1);
                    } else {
                        avg = (num1 !== null ? num1 : num2).toFixed(1);
                    }

                    const meshResult = (parseFloat(avg) >= spec.min_value && parseFloat(avg) <= spec.max_value) ? '합격' : '불합격';
                    if (meshResult === '불합격') overallResult = 'FAIL';

                    particleData[meshIds[index]] = { val1: val1 || null, val2: val2 || null, avg: avg, result: meshResult };

                    detailHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#fff;border-radius:6px;border:1px solid #eee;">\
                        <div style="font-weight:600">${meshLabel}</div>\
                        <div style="font-size:0.95em;color:#444">평균: ${avg}%</div>\
                        <div><span class="badge ${meshResult === '합격' ? 'pass' : 'fail'}">${meshResult}</span></div>\
                    </div>`;
                } else {
                    // not measured
                    particleData[meshIds[index]] = { val1: val1 || null, val2: val2 || null, avg: null, result: '미측정' };
                    detailHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#fff;border-radius:6px;border:1px solid #eee;">\
                        <div style="font-weight:600">${meshLabel}</div>\
                        <div style="font-size:0.95em;color:#999">평균: -</div>\
                        <div><span class="badge" style="background:#bdbdbd;">미측정</span></div>\
                    </div>`;
                    overallResult = 'FAIL';
                }
            });

            detailHtml += '</div>';

            if (!anyMeasured) return alert('유효한 측정값이 없습니다.');

            const resultDiv = document.getElementById('result-' + itemName);
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `전체결과: <span class="badge ${overallResult === 'PASS' ? 'pass' : 'fail'}">${overallResult}</span><div style="margin-top:10px;">${detailHtml}</div>`;

            pendingResults[itemName] = { particleData: particleData, result: overallResult };
            const finalBtn = document.getElementById(`final-save-${itemName}`);
            if (finalBtn) finalBtn.disabled = (overallResult !== 'PASS');
        }

        // 입도분석 최종 저장
        async function finalSaveParticleSize(itemName) {
            const pending = pendingResults[itemName];
            if (!pending) return alert('먼저 판정(검증)을 수행하세요.');

            if (pending.result !== 'PASS') return alert('모든 항목이 합격일 때만 최종저장할 수 있습니다.');

            try {
                const response = await fetch(`${API_BASE}/api/save-particle-size`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        powderName: currentInspection.powderName,
                        lotNumber: currentInspection.lotNumber,
                        particleData: pending.particleData
                    })
                });

                const data = await response.json();

                if (data.success) {
                    const resultDiv = document.getElementById('result-' + itemName);
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = `결과: <span class="badge ${data.result === 'PASS' ? 'pass' : 'fail'}">${data.result}</span>`;

                    if (!currentInspection.completedItems.includes(itemName)) {
                        currentInspection.completedItems.push(itemName);
                    }

                    delete pendingResults[itemName];
                    const finalBtn = document.getElementById(`final-save-${itemName}`);
                    if (finalBtn) finalBtn.disabled = true;

                    setTimeout(async () => {
                        await checkInspectionCompletion();
                        renderInspectionItems();
                    }, 500);
                } else {
                    alert('저장 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // ============================================
        // 검사 결과 조회
        // ============================================
        async function loadPowderListForSearch(category = '') {
            try {
                const select = document.getElementById('searchPowderName');
                select.innerHTML = '<option value="">전체</option>';

                // 검사구분에 따라 다른 API 호출
                if (category === 'incoming') {
                    // 수입검사 -> 수입분말만
                    const response = await fetch(`${API_BASE}/api/powders`);
                    const data = await response.json();

                    if (data.success && data.powders) {
                        data.powders.forEach(powder => {
                            const option = document.createElement('option');
                            option.value = powder.powder_name;
                            option.textContent = powder.powder_name;
                            select.appendChild(option);
                        });
                    }
                } else if (category === 'mixing') {
                    // 배합검사 -> 배합분말(제품)만
                    const response = await fetch(`${API_BASE}/api/blending/products`);
                    const data = await response.json();

                    if (data.success && data.products) {
                        data.products.forEach(product => {
                            const option = document.createElement('option');
                            option.value = product.product_name;
                            option.textContent = product.product_name;
                            select.appendChild(option);
                        });
                    }
                } else {
                    // 전체 -> 수입분말 + 배합분말 모두
                    // 1. 수입분말
                    const powderResponse = await fetch(`${API_BASE}/api/powders`);
                    const powderData = await powderResponse.json();

                    if (powderData.success && powderData.powders) {
                        const incomingGroup = document.createElement('optgroup');
                        incomingGroup.label = '수입검사분말';

                        powderData.powders.forEach(powder => {
                            const option = document.createElement('option');
                            option.value = powder.powder_name;
                            option.textContent = powder.powder_name;
                            incomingGroup.appendChild(option);
                        });

                        if (incomingGroup.children.length > 0) {
                            select.appendChild(incomingGroup);
                        }
                    }

                    // 2. 배합분말
                    const productResponse = await fetch(`${API_BASE}/api/blending/products`);
                    const productData = await productResponse.json();

                    if (productData.success && productData.products) {
                        const blendingGroup = document.createElement('optgroup');
                        blendingGroup.label = '배합분말';

                        productData.products.forEach(product => {
                            const option = document.createElement('option');
                            option.value = product.product_name;
                            option.textContent = product.product_name;
                            blendingGroup.appendChild(option);
                        });

                        if (blendingGroup.children.length > 0) {
                            select.appendChild(blendingGroup);
                        }
                    }
                }

                // 검색 날짜 기본값 설정 (오늘 날짜)
                const today = new Date().toISOString().split('T')[0];
                const searchDateFromInput = document.getElementById('searchDateFrom');
                const searchDateToInput = document.getElementById('searchDateTo');
                if (searchDateFromInput && !searchDateFromInput.value) {
                    searchDateFromInput.value = today;
                }
                if (searchDateToInput && !searchDateToInput.value) {
                    searchDateToInput.value = today;
                }
            } catch (error) {
                console.error('분말 목록 로딩 실패:', error);
            }
        }

        // 검사구분 변경 시 분말명 목록 필터링
        const searchCategoryElement = document.getElementById('searchCategory');
        if (searchCategoryElement) {
            searchCategoryElement.addEventListener('change', (e) => {
                const category = e.target.value;
                loadPowderListForSearch(category);
            });
        }

        const searchFormElement = document.getElementById('searchForm');

        if (searchFormElement) {
            searchFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const category = document.getElementById('searchCategory').value;
            const powderName = document.getElementById('searchPowderName').value;
            const lotNumber = document.getElementById('searchLotNumber').value;
            const dateFrom = document.getElementById('searchDateFrom').value;
            const dateTo = document.getElementById('searchDateTo').value;

            try {
                const params = new URLSearchParams();
                if (category) params.append('category', category);
                if (powderName) params.append('powderName', powderName);
                if (lotNumber) params.append('lotNumber', lotNumber);
                if (dateFrom) params.append('dateFrom', dateFrom);
                if (dateTo) params.append('dateTo', dateTo);

                const response = await fetch(`${API_BASE}/api/search-results?${params}`);
                const data = await response.json();

                const resultsDiv = document.getElementById('searchResults');

                if (data.success && data.data.length > 0) {
                    let html = `<table><tr><th>${t('category')}</th><th>${t('powderName')}</th><th>${t('lotNumber')}</th><th>${t('inspector')}</th><th>${t('inspectionTime')}</th><th>${t('inspectionType')}</th><th>${t('finalResult')}</th><th>${t('detail')}</th></tr>`;

                    data.data.forEach(item => {
                        const badgeClass = item.final_result === 'PASS' ? 'pass' : 'fail';
                        const categoryBadge = item.category === 'incoming'
                            ? `<span class="badge" style="background: #2196F3;">${t('incoming')}</span>`
                            : `<span class="badge" style="background: #FF9800;">${t('mixing')}</span>`;

                        html += `
                            <tr>
                                <td>${categoryBadge}</td>
                                <td>${item.powder_name}</td>
                                <td>${item.lot_number}</td>
                                <td>${item.inspector}</td>
                                <td>${item.inspection_time}</td>
                                <td>${item.inspection_type}</td>
                                <td><span class="badge ${badgeClass}">${item.final_result}</span></td>
                                <td>
                                    <div style="display: flex; gap: 5px;">
                                        <button class="btn" onclick="viewDetail('${item.powder_name}', '${item.lot_number}')" style="padding: 6px 12px; font-size: 0.9em;">${t('view')}</button>
                                        <button class="btn danger" onclick="deleteInspectionResult('${item.powder_name}', '${item.lot_number}', '${item.category}')" style="padding: 6px 12px; font-size: 0.9em; background:#f44336; color:white;">삭제</button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    });

                    html += '</table>';
                    resultsDiv.innerHTML = html;
                } else {
                    resultsDiv.innerHTML = `<div class="empty-message">${t('noResults')}</div>`;
                }
            } catch (error) {
                document.getElementById('searchResults').innerHTML = `<div class="empty-message">오류: ${error.message}</div>`;
            }
        });
        }

        async function viewDetail(powderName, lotNumber) {
            try {
                const response = await fetch(`${API_BASE}/api/inspection-detail/${powderName}/${lotNumber}`);
                const data = await response.json();

                if (data.success) {
                    renderDetailPage(data.data);
                    showPage('detail');
                } else {
                    alert('상세 정보 로딩 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        async function deleteInspectionResult(powderName, lotNumber, category) {
            // 관리자 비밀번호 확인
            const password = prompt(`검사결과를 삭제하시겠습니까?\n분말명: ${powderName}\nLOT: ${lotNumber}\n\n관리자 비밀번호를 입력하세요:`);

            if (!password) {
                return; // 취소
            }

            try {
                const response = await fetch(`${API_BASE}/api/inspection-result/${encodeURIComponent(powderName)}/${encodeURIComponent(lotNumber)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword: password, category: category })
                });

                const data = await response.json();

                if (data.success) {
                    alert('검사 결과가 삭제되었습니다.');
                    // 검색 폼 다시 제출하여 목록 새로고침
                    document.getElementById('searchForm').dispatchEvent(new Event('submit'));
                } else {
                    alert('삭제 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        function renderDetailPage(detail) {
            const container = document.getElementById('detailContent');

            let html = `
                <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px;">
                    <h2 style="margin-bottom: 15px;">${detail.powder_name} - LOT ${detail.lot_number}</h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                        <div>
                            <p style="opacity: 0.9;">${t('inspector')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${detail.inspector}</p>
                        </div>
                        <div>
                            <p style="opacity: 0.9;">${t('inspectionTime')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${detail.inspection_time}</p>
                        </div>
                        <div>
                            <p style="opacity: 0.9;">${t('inspectionType')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${detail.inspection_type}</p>
                        </div>
                    </div>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
                        <p style="font-size: 1.1em; opacity: 0.9;">${t('finalResult')}</p>
                        <p style="font-size: 1.5em; font-weight: 700; margin-top: 5px;">${detail.final_result}</p>
                    </div>
                </div>
                <div class="card">
                    <div class="card-title">${t('inspectionDetails')}</div>
                    <div class="detail-grid">
            `;

            // 각 검사 항목 표시
            const items = [
                { nameKey: 'flowRate', prefix: 'flow_rate', unit: 's/50g' },
                { nameKey: 'apparentDensity', prefix: 'apparent_density', unit: 'g/cm³' },
                { nameKey: 'cContent', prefix: 'c_content', unit: '%' },
                { nameKey: 'cuContent', prefix: 'cu_content', unit: '%' },
                { nameKey: 'moisture', prefix: 'moisture', unit: '%' },
                { nameKey: 'ash', prefix: 'ash', unit: '%' },
                { nameKey: 'sinterChangeRate', prefix: 'sinter_change_rate', unit: '%' },
                { nameKey: 'sinterStrength', prefix: 'sinter_strength', unit: 'MPa' },
                { nameKey: 'formingStrength', prefix: 'forming_strength', unit: 'N' },
                { nameKey: 'formingLoad', prefix: 'forming_load', unit: 'MPa' }
            ];

            items.forEach(item => {
                const avg = detail[`${item.prefix}_avg`];
                const result = detail[`${item.prefix}_result`];

                if (avg !== null && avg !== undefined && avg !== '') {
                    const badgeClass = result === 'PASS' ? 'pass' : 'fail';
                    html += `
                        <div class="detail-item">
                            <h4>${t(item.nameKey)}</h4>
                            <p>${t('average')}: <strong>${avg} ${item.unit}</strong></p>
                            <p>${t('result')}: <span class="badge ${badgeClass}">${result}</span></p>
                        </div>
                    `;
                }
            });
            // 입도분석 표시 (있으면)
            if (detail.particleSizeSpecs && detail.particleSizeSpecs.length > 0) {
                html += `</div></div><div class="card" style="margin-top:16px;"><div class="card-title">${t('particleSize')}</div>`;
                html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">';

                // helper: mesh label -> column suffix
                const meshKey = (mesh) => {
                    if (!mesh) return mesh;
                    const s = mesh.toString().trim();
                    if (s.startsWith('-')) return '45m';
                    // extract digits
                    const m = s.match(/(\d+)/);
                    if (!m) return s.replace(/[^a-zA-Z0-9]/g, '');
                    const num = m[1];
                    if (num === '45' && s.startsWith('-')) return '45m';
                    return num;
                };

                detail.particleSizeSpecs.forEach((spec) => {
                    const key = meshKey(spec.mesh_size);
                    const avgField = `particle_size_${key}_avg`;
                    const resField = `particle_size_${key}_result`;

                    const avg = detail[avgField];
                    const res = detail[resField];
                    const displayRes = res === 'PASS' ? '합격' : (res === 'FAIL' ? '불합격' : (res || '-'));

                    html += `
                        <div style="padding:12px;border-radius:8px;background:#fafafa;border:1px solid #eee;">
                            <div style="font-weight:700;margin-bottom:6px;">${spec.mesh_size}</div>
                            <div style="font-size:0.95em;color:#444;">규격: ${spec.min_value}~${spec.max_value}%</div>
                            <div style="margin-top:8px;">평균: <strong>${avg !== null && avg !== undefined ? avg : '-' }%</strong></div>
                            <div>판정: <span class="badge ${res === 'PASS' ? 'pass' : (res === 'FAIL' ? 'fail' : '')}">${displayRes}</span></div>
                        </div>
                    `;
                });

                html += '</div></div>';
            } else {
                html += '</div></div>';
            }
            container.innerHTML = html;
        }

        // ============================================
        // 관리자 페이지 함수들
        // ============================================

        // 관리자 페이지 로드
        async function loadAdminPage() {
                    await loadPowderSpecs(powderSpecMode);
            // particlePowderSelect 관련 DOM이 없는 경우(템플릿에 미구현) 로딩 건너뛰기
            if (document.getElementById('particlePowderSelect')) {
                await loadParticlePowderList();
            }
            await loadInspectors();
            await loadOperators();
            await loadProductRecipes();
        }

        // ============================================
        // 분말 사양 관리
        // ============================================

        async function loadPowderSpecs(filterCategory = '') {
            try {
                const response = await fetch(`${API_BASE}/api/admin/powder-spec`);
                const data = await response.json();
                const namesDiv = document.getElementById('powderNamesList');
                if (data.success && data.data.length > 0) {
                    namesDiv.innerHTML = '';

                    let specs = data.data;

                    // 배합 분말 모드인 경우, 레시피에 등록된 제품명과 교차검증하여 표시
                    if (filterCategory === 'mixing') {
                        try {
                            const r = await fetch(`${API_BASE}/api/admin/recipes`);
                            const rdata = await r.json();
                            if (rdata.success && rdata.data.length > 0) {
                                const productNames = new Set(rdata.data.map(p => p.product_name));
                                specs = specs.filter(s => productNames.has(s.powder_name));
                            } else {
                                // 레시피가 없으면 빈 목록
                                specs = [];
                            }
                        } catch (err) {
                            console.error('레시피 로딩 실패:', err);
                            specs = [];
                        }
                    } else if (filterCategory) {
                        specs = specs.filter(s => s.category === filterCategory);
                    }

                    if (specs.length === 0) {
                        namesDiv.innerHTML = `<div class="empty-message">${t('noPowders')}</div>`;
                        const detailDiv = document.getElementById('powderSpecDetail');
                        if (detailDiv) detailDiv.innerHTML = `<div class="empty-message">${t('noPowders')}</div>`;
                        return;
                    }

                    specs.forEach(spec => {
                        const item = document.createElement('div');
                        item.className = 'powder-item';
                        item.dataset.specId = spec.id;
                        item.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">` +
                            `<div style="flex: 1;" class="powder-name-text"><strong>${spec.powder_name}</strong></div>` +
                            `<input type="checkbox" class="powder-checkbox" data-spec-id="${spec.id}" style="cursor: pointer; margin-left: 8px;">` +
                            `</div>`;

                        // 체크박스 클릭 시만 우측 화면 변경
                        const checkbox = item.querySelector('.powder-checkbox');
                        checkbox.addEventListener('change', (e) => {
                            // 다른 모든 체크박스 해제
                            document.querySelectorAll('.powder-checkbox').forEach(cb => {
                                if (cb !== checkbox) cb.checked = false;
                            });

                            // 체크된 경우에만 우측 화면 표시
                            if (checkbox.checked) {
                                showPowderSpecDetail(spec.id);
                            }
                        });

                        namesDiv.appendChild(item);
                    });

                    // 자동 선택: 첫 번째 체크박스 체크
                    const firstCheckbox = namesDiv.querySelector('.powder-checkbox');
                    if (firstCheckbox) {
                        firstCheckbox.checked = true;
                        const firstId = firstCheckbox.dataset.specId;
                        showPowderSpecDetail(parseInt(firstId));
                    }
                } else {
                    namesDiv.innerHTML = `<div class="empty-message">${t('noPowders')}</div>`;
                    const detailDiv = document.getElementById('powderSpecDetail');
                    if (detailDiv) detailDiv.innerHTML = `<div class="empty-message">${t('noPowders')}</div>`;
                }
            } catch (error) {
                console.error('분말 목록 로딩 실패:', error);
            }
        }

        let selectedPowderSpecId = null;

        async function showPowderSpecDetail(specId) {
            try {
                const response = await fetch(`${API_BASE}/api/admin/powder-spec`);
                const data = await response.json();
                if (!data.success) return;

                const spec = data.data.find(s => s.id === specId);
                if (!spec) return;

                selectedPowderSpecId = spec.id;

                const detailDiv = document.getElementById('powderSpecDetail');
                const headerDiv = document.getElementById('powderSpecHeader');

                // 헤더: 분말명(왼쪽) + 수정/삭제 버튼(오른쪽)
                headerDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0; color: #333; font-size: 1.3em;">${spec.powder_name}</h3>
                        <div>
                            <button class="btn secondary" id="specEditBtn" style="margin-right:6px; padding:5px 12px; font-size:0.85em;">수정</button>
                            <button class="btn danger" id="specDeleteBtn" style="padding:5px 12px; font-size:0.85em;">삭제</button>
                        </div>
                    </div>
                `;

                let html = `<div style="overflow-x: auto;">`;
                html += `<table id="specTable" style="width: 100%; border-collapse: collapse; font-size: 1em; table-layout: fixed;" data-spec-id="${spec.id}" data-powder-name="${spec.powder_name}" data-category="${spec.category}">`;
                html += `<thead>`;
                html += `<tr style="background: #f8f9fa;">`;
                html += `<th style="width: 22%; padding: 12px 14px; text-align: left; border: 1px solid #e0e0e0; font-weight: 600; font-size: 1em; color: #444; white-space: nowrap;">검사항목</th>`;
                html += `<th style="width: 15%; padding: 12px 14px; text-align: center; border: 1px solid #e0e0e0; font-weight: 600; font-size: 1em; color: #444; white-space: nowrap;">단위</th>`;
                html += `<th style="width: 18%; padding: 12px 14px; text-align: center; border: 1px solid #e0e0e0; font-weight: 600; font-size: 1em; color: #444; white-space: nowrap;">최소값</th>`;
                html += `<th style="width: 18%; padding: 12px 14px; text-align: center; border: 1px solid #e0e0e0; font-weight: 600; font-size: 1em; color: #444; white-space: nowrap;">최대값</th>`;
                html += `<th style="width: 27%; padding: 12px 14px; text-align: center; border: 1px solid #e0e0e0; font-weight: 600; font-size: 1em; color: #444; white-space: nowrap;">검사타입</th>`;
                html += `</tr>`;
                html += `</thead>`;
                html += `<tbody>`;

                // 각 검사항목을 행으로 추가
                const items = [
                    { name: '유동도', field: 'flow_rate', unit: 's/50g', min: spec.flow_rate_min, max: spec.flow_rate_max, type: spec.flow_rate_type },
                    { name: '겉보기밀도', field: 'apparent_density', unit: 'g/cm³', min: spec.apparent_density_min, max: spec.apparent_density_max, type: spec.apparent_density_type },
                    { name: 'C함량', field: 'c_content', unit: '%', min: spec.c_content_min, max: spec.c_content_max, type: spec.c_content_type },
                    { name: 'Cu함량', field: 'cu_content', unit: '%', min: spec.cu_content_min, max: spec.cu_content_max, type: spec.cu_content_type },
                    { name: '수분도', field: 'moisture', unit: '%', min: spec.moisture_min, max: spec.moisture_max, type: spec.moisture_type },
                    { name: '회분도', field: 'ash', unit: '%', min: spec.ash_min, max: spec.ash_max, type: spec.ash_type },
                    { name: '소결변화율', field: 'sinter_change_rate', unit: '%', min: spec.sinter_change_rate_min, max: spec.sinter_change_rate_max, type: spec.sinter_change_rate_type },
                    { name: '소결강도', field: 'sinter_strength', unit: 'MPa', min: spec.sinter_strength_min, max: spec.sinter_strength_max, type: spec.sinter_strength_type },
                    { name: '성형강도', field: 'forming_strength', unit: 'N', min: spec.forming_strength_min, max: spec.forming_strength_max, type: spec.forming_strength_type },
                    { name: '성형하중', field: 'forming_load', unit: 'MPa', min: spec.forming_load_min, max: spec.forming_load_max, type: spec.forming_load_type },
                    { name: '입도분석', field: 'particle_size', unit: '', min: '', max: '', type: spec.particle_size_type }
                ];

                items.forEach(item => {
                    const isInactive = item.type === '비활성' || !item.type;
                    const rowStyle = isInactive ? 'opacity: 0.45;' : '';
                    html += `<tr data-field="${item.field}" style="${rowStyle}">`;
                    html += `<td style="padding: 10px 14px; border: 1px solid #e8e8e8; white-space: nowrap;"><strong style="font-weight: 600;">${item.name}</strong></td>`;
                    html += `<td style="padding: 10px 14px; border: 1px solid #e8e8e8; text-align: center; white-space: nowrap;">${item.unit}</td>`;
                    html += `<td class="editable-min" style="padding: 10px 14px; border: 1px solid #e8e8e8; text-align: center; white-space: nowrap;" data-value="${item.min || ''}">${item.min || '-'}</td>`;
                    html += `<td class="editable-max" style="padding: 10px 14px; border: 1px solid #e8e8e8; text-align: center; white-space: nowrap;" data-value="${item.max || ''}">${item.max || '-'}</td>`;
                    html += `<td class="editable-type" style="padding: 10px 14px; border: 1px solid #e8e8e8; text-align: center; white-space: nowrap;" data-value="${item.type || '비활성'}">${item.type || '비활성'}</td>`;
                    html += `</tr>`;
                });

                html += `</tbody>`;
                html += `</table>`;
                html += `</div>`;

                // 입도분석 상세 정보 (활성화된 경우)
                if (spec.particle_size_type && spec.particle_size_type !== '비활성') {
                    // particle_size 테이블에서 데이터 가져오기
                    try {
                        const particleResponse = await fetch(`${API_BASE}/api/particle-size-spec/${spec.powder_name}`);
                        const particleData = await particleResponse.json();

                        if (particleData.success && particleData.data.length > 0) {
                            html += `<div id="particleDetailSection" style="margin-top: 14px; padding: 12px; background: #f8f9fb; border-radius: 6px; border: 1px solid #e5e7eb;">`;
                            html += `<h5 style="margin: 0 0 10px 0; color: #667eea; font-size: 0.95em; font-weight: 600;">📊 입도분석 상세</h5>`;
                            html += `<div id="particleGrid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">`;

                            // particle_size 테이블 데이터를 순회하며 표시
                            particleData.data.forEach(p => {
                                html += `<div class="particle-item" data-mesh="${p.mesh_size}" data-min="${p.min_value || ''}" data-max="${p.max_value || ''}" style="padding: 7px 9px; background: white; border-radius: 4px; font-size: 0.88em; border: 1px solid #e8e8e8;">`;
                                html += `<strong style="font-weight: 600;">${p.mesh_size}</strong>: `;
                                html += `<span class="particle-min">${p.min_value || '-'}</span> ~ <span class="particle-max">${p.max_value || '-'}</span> %`;
                                html += `</div>`;
                            });

                            html += `</div>`;
                            html += `</div>`;
                        }
                    } catch (err) {
                        console.error('입도분석 데이터 로딩 실패:', err);
                    }
                }

                detailDiv.innerHTML = html;

                const editBtn = document.getElementById('specEditBtn');
                const delBtn = document.getElementById('specDeleteBtn');
                if (editBtn) editBtn.onclick = () => toggleInlineEdit();
                if (delBtn) delBtn.onclick = () => deletePowderSpec(spec.id, spec.powder_name);

            } catch (error) {
                console.error('사양 상세 로딩 실패:', error);
            }
        }

        // 인라인 편집 모드 전역 변수
        let isInlineEditMode = false;

        function toggleInlineEdit() {
            const editBtn = document.getElementById('specEditBtn');
            if (!isInlineEditMode) {
                enableInlineEdit();
                editBtn.textContent = '저장';
                editBtn.classList.remove('secondary');
                editBtn.classList.add('primary');
                isInlineEditMode = true;
            } else {
                saveInlineEdit();
            }
        }

        function enableInlineEdit() {
            const table = document.getElementById('specTable');
            if (!table) return;

            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const minCell = row.querySelector('.editable-min');
                const maxCell = row.querySelector('.editable-max');
                const typeCell = row.querySelector('.editable-type');

                if (minCell) {
                    const minValue = minCell.dataset.value;
                    minCell.innerHTML = `<input type="number" step="0.01" value="${minValue}" style="width:100%; padding:4px; border:1px solid #ddd; border-radius:3px; text-align:center;">`;
                }

                if (maxCell) {
                    const maxValue = maxCell.dataset.value;
                    maxCell.innerHTML = `<input type="number" step="0.01" value="${maxValue}" style="width:100%; padding:4px; border:1px solid #ddd; border-radius:3px; text-align:center;">`;
                }

                if (typeCell) {
                    const typeValue = typeCell.dataset.value;
                    typeCell.innerHTML = `
                        <select style="width:100%; padding:4px; border:1px solid #ddd; border-radius:3px;">
                            <option value="일상" ${typeValue === '일상' ? 'selected' : ''}>일상</option>
                            <option value="정기" ${typeValue === '정기' ? 'selected' : ''}>정기</option>
                            <option value="비활성" ${typeValue === '비활성' ? 'selected' : ''}>비활성</option>
                        </select>
                    `;
                }
            });

            // 입도분석 항목도 편집 가능하게 만들기
            const particleItems = document.querySelectorAll('.particle-item');
            particleItems.forEach(item => {
                const minValue = item.dataset.min || '';
                const maxValue = item.dataset.max || '';
                const meshSize = item.dataset.mesh;

                const minSpan = item.querySelector('.particle-min');
                const maxSpan = item.querySelector('.particle-max');

                if (minSpan) {
                    minSpan.innerHTML = `<input type="number" step="0.01" value="${minValue}" style="width:60px; padding:2px; border:1px solid #ddd; border-radius:3px; text-align:center;">`;
                }

                if (maxSpan) {
                    maxSpan.innerHTML = `<input type="number" step="0.01" value="${maxValue}" style="width:60px; padding:2px; border:1px solid #ddd; border-radius:3px; text-align:center;">`;
                }
            });
        }

        async function saveInlineEdit() {
            const table = document.getElementById('specTable');
            if (!table) return;

            const specId = table.dataset.specId;
            const powderName = table.dataset.powderName;
            const category = table.dataset.category;
            const rows = table.querySelectorAll('tbody tr');

            const data = {
                id: specId,
                powder_name: powderName,
                category: category
            };

            rows.forEach(row => {
                const field = row.dataset.field;
                const minCell = row.querySelector('.editable-min input');
                const maxCell = row.querySelector('.editable-max input');
                const typeCell = row.querySelector('.editable-type select');

                if (minCell) data[`${field}_min`] = minCell.value || null;
                if (maxCell) data[`${field}_max`] = maxCell.value || null;
                if (typeCell) data[`${field}_type`] = typeCell.value;
            });

            try {
                // 1. 분말 사양 저장
                const response = await fetch(`${API_BASE}/api/admin/powder-spec/${specId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                if (!result.success) {
                    alert('저장 실패: ' + (result.message || '알 수 없는 오류'));
                    return;
                }

                // 2. 입도분석 데이터 저장 (있는 경우)
                const particleItems = document.querySelectorAll('.particle-item');
                if (particleItems.length > 0) {
                    const particleSpecs = [];
                    particleItems.forEach(item => {
                        const meshSize = item.dataset.mesh;
                        const minInput = item.querySelector('.particle-min input');
                        const maxInput = item.querySelector('.particle-max input');

                        if (minInput && maxInput) {
                            particleSpecs.push({
                                powder_name: powderName,
                                mesh_size: meshSize,
                                min_value: parseFloat(minInput.value) || 0,
                                max_value: parseFloat(maxInput.value) || 0
                            });
                        }
                    });

                    if (particleSpecs.length > 0) {
                        const particleResponse = await fetch(`${API_BASE}/api/admin/particle-size/bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                powder_name: powderName,
                                specs: particleSpecs
                            })
                        });

                        const particleResult = await particleResponse.json();
                        if (!particleResult.success) {
                            alert('입도분석 저장 실패: ' + (particleResult.message || '알 수 없는 오류'));
                            return;
                        }
                    }
                }

                alert('저장되었습니다.');
                isInlineEditMode = false;
                // 다시 로드
                showPowderSpecDetail(parseInt(specId));

            } catch (error) {
                console.error('저장 실패:', error);
                alert('저장 중 오류가 발생했습니다.');
            }
        }

        function showAddPowderForm() {
            document.getElementById('powderFormTitle').textContent = t('addPowder');
            document.getElementById('powderSpecId').value = '';
            document.getElementById('powderForm').reset();
            document.getElementById('adminPowderCategory').value = '';  // 선택하게 함
            document.getElementById('adminPowderNameInput').style.display = 'none';
            document.getElementById('adminPowderNameSelect').style.display = 'none';
            document.getElementById('adminPowderNameInput').removeAttribute('required');
            document.getElementById('adminPowderNameSelect').removeAttribute('required');

            // 폼 리셋 후 모든 검사 항목을 '비활성'으로 초기화하고 입도필드 표시여부 결정
            setTimeout(() => {
                // 타입을 모두 비활성으로 설정
                const typeIds = ['flowRateType','apparentDensityType','cContentType','cuContentType','moistureType','ashType','sinterChangeRateType','sinterStrengthType','formingStrengthType','formingLoadType','particleSizeType'];
                typeIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '비활성';
                });

                // 모든 min/max 입력 필드 초기화
                const fieldIds = ['flowRateMin','flowRateMax','apparentDensityMin','apparentDensityMax','cContentMin','cContentMax','cuContentMin','cuContentMax','moistureMin','moistureMax','ashMin','ashMax','sinterChangeRateMin','sinterChangeRateMax','sinterStrengthMin','sinterStrengthMax','formingStrengthMin','formingStrengthMax','formingLoadMin','formingLoadMax','particle_180_min','particle_180_max','particle_150_min','particle_150_max','particle_106_min','particle_106_max','particle_75_min','particle_75_max','particle_45_min','particle_45_max','particle_45m_min','particle_45m_max'];
                fieldIds.forEach(id => {
                    const f = document.getElementById(id);
                    if (f) f.value = '';
                });

                toggleParticleInputs();
            }, 0);

            document.getElementById('powderFormContainer').style.display = 'block';
            // 리스트 화면 숨기기
            const layoutDiv = document.querySelector('.admin-powder-layout');
            if (layoutDiv) layoutDiv.style.display = 'none';
        }

        function toggleParticleInputs() {
            const particleType = document.getElementById('particleSizeType').value;
            const particleInputs = document.getElementById('particleSizeInputs');

            if (particleType === '비활성') {
                particleInputs.style.display = 'none';
            } else {
                particleInputs.style.display = 'block';
            }
        }

        async function handlePowderCategoryChange() {
            const category = document.getElementById('adminPowderCategory').value;
            const inputField = document.getElementById('adminPowderNameInput');
            const selectField = document.getElementById('adminPowderNameSelect');

            if (category === 'incoming') {
                // 수입검사: 직접 입력
                inputField.style.display = 'block';
                selectField.style.display = 'none';
                inputField.setAttribute('required', 'required');
                selectField.removeAttribute('required');
                inputField.value = '';
            } else if (category === 'mixing') {
                // 배합검사: 배합규격서의 제품명에서 선택
                selectField.style.display = 'block';
                inputField.style.display = 'none';
                selectField.setAttribute('required', 'required');
                inputField.removeAttribute('required');

                // 배합규격서 제품명 목록 로드
                try {
                    const response = await fetch(`${API_BASE}/api/admin/recipes`);
                    const data = await response.json();

                    let options = '<option value="">' + t('selectPlaceholder') + '</option>';
                    if (data.success && data.data.length > 0) {
                        // 중복 제거를 위해 Set 사용
                        const productNames = [...new Set(data.data.map(p => p.product_name))];
                        productNames.forEach(name => {
                            options += `<option value="${name}">${name}</option>`;
                        });
                    }
                    selectField.innerHTML = options;
                } catch (error) {
                    console.error('Failed to load product names:', error);
                }
            } else {
                // 미선택 상태
                inputField.style.display = 'none';
                selectField.style.display = 'none';
                inputField.removeAttribute('required');
                selectField.removeAttribute('required');
            }
        }

        function hidePowderForm() {
            document.getElementById('powderFormContainer').style.display = 'none';
            document.getElementById('powderForm').reset();
            // 리스트 화면 다시 보이기
            const layoutDiv = document.querySelector('.admin-powder-layout');
            if (layoutDiv) layoutDiv.style.display = 'flex';
        }

        async function editPowderSpec(specId) {
            try {
                const response = await fetch(`${API_BASE}/api/admin/powder-spec`);
                const data = await response.json();

                if (data.success) {
                    const spec = data.data.find(s => s.id === specId);
                    if (spec) {
                        document.getElementById('powderFormTitle').textContent = t('editPowder');
                        document.getElementById('powderSpecId').value = spec.id;

                        // 검사구분 먼저 설정
                        document.getElementById('adminPowderCategory').value = spec.category || 'incoming';

                        // 검사구분에 따라 필드 변경
                        await handlePowderCategoryChange();

                        // 분말명 설정
                        if (spec.category === 'incoming') {
                            document.getElementById('adminPowderNameInput').value = spec.powder_name;
                        } else if (spec.category === 'mixing') {
                            document.getElementById('adminPowderNameSelect').value = spec.powder_name;
                        }

                        // 각 항목 값 채우기
                        document.getElementById('flowRateMin').value = spec.flow_rate_min || '';
                        document.getElementById('flowRateMax').value = spec.flow_rate_max || '';
                        document.getElementById('flowRateType').value = spec.flow_rate_type || '일상';

                        document.getElementById('apparentDensityMin').value = spec.apparent_density_min || '';
                        document.getElementById('apparentDensityMax').value = spec.apparent_density_max || '';
                        document.getElementById('apparentDensityType').value = spec.apparent_density_type || '일상';

                        document.getElementById('cContentMin').value = spec.c_content_min || '';
                        document.getElementById('cContentMax').value = spec.c_content_max || '';
                        document.getElementById('cContentType').value = spec.c_content_type || '일상';

                        document.getElementById('cuContentMin').value = spec.cu_content_min || '';
                        document.getElementById('cuContentMax').value = spec.cu_content_max || '';
                        document.getElementById('cuContentType').value = spec.cu_content_type || '일상';

                        document.getElementById('moistureMin').value = spec.moisture_min || '';
                        document.getElementById('moistureMax').value = spec.moisture_max || '';
                        document.getElementById('moistureType').value = spec.moisture_type || '일상';

                        document.getElementById('ashMin').value = spec.ash_min || '';
                        document.getElementById('ashMax').value = spec.ash_max || '';
                        document.getElementById('ashType').value = spec.ash_type || '일상';

                        document.getElementById('sinterChangeRateMin').value = spec.sinter_change_rate_min || '';
                        document.getElementById('sinterChangeRateMax').value = spec.sinter_change_rate_max || '';
                        document.getElementById('sinterChangeRateType').value = spec.sinter_change_rate_type || '일상';

                        document.getElementById('sinterStrengthMin').value = spec.sinter_strength_min || '';
                        document.getElementById('sinterStrengthMax').value = spec.sinter_strength_max || '';
                        document.getElementById('sinterStrengthType').value = spec.sinter_strength_type || '일상';

                        document.getElementById('formingStrengthMin').value = spec.forming_strength_min || '';
                        document.getElementById('formingStrengthMax').value = spec.forming_strength_max || '';
                        document.getElementById('formingStrengthType').value = spec.forming_strength_type || '일상';

                        document.getElementById('formingLoadMin').value = spec.forming_load_min || '';
                        document.getElementById('formingLoadMax').value = spec.forming_load_max || '';
                        document.getElementById('formingLoadType').value = spec.forming_load_type || '일상';

                        document.getElementById('particleSizeType').value = spec.particle_size_type || '일상';
                        toggleParticleInputs();

                        // 입도분석 규격 로드
                        if (spec.particle_size_type !== '비활성') {
                            const particleResponse = await fetch(`${API_BASE}/api/admin/particle-size?powder_name=${encodeURIComponent(spec.powder_name)}`);
                            const particleData = await particleResponse.json();

                            if (particleData.success && particleData.data.length > 0) {
                                particleData.data.forEach(ps => {
                                    let meshId = '';
                                    if (ps.mesh_size === '+180 um') meshId = '180';
                                    else if (ps.mesh_size === '+150 um') meshId = '150';
                                    else if (ps.mesh_size === '+106 um') meshId = '106';
                                    else if (ps.mesh_size === '+75 um') meshId = '75';
                                    else if (ps.mesh_size === '+45 um') meshId = '45';
                                    else if (ps.mesh_size === '-45 um') meshId = '45m';

                                    if (meshId) {
                                        document.getElementById(`particle_${meshId}_min`).value = ps.min_value || '';
                                        document.getElementById(`particle_${meshId}_max`).value = ps.max_value || '';
                                    }
                                });
                            }
                        }

                        document.getElementById('powderFormContainer').style.display = 'block';
                        // 리스트 화면 숨기기
                        const layoutDiv = document.querySelector('.admin-powder-layout');
                        if (layoutDiv) layoutDiv.style.display = 'none';
                    }
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        const powderFormElement = document.getElementById('powderForm');


        if (powderFormElement) {


            powderFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const specId = document.getElementById('powderSpecId').value;
            const category = document.getElementById('adminPowderCategory').value;

            // 검사구분에 따라 분말명 가져오기
            let powderName;
            if (category === 'incoming') {
                powderName = document.getElementById('adminPowderNameInput').value;
            } else if (category === 'mixing') {
                powderName = document.getElementById('adminPowderNameSelect').value;
            }

            const powderData = {
                powder_name: powderName,
                category: category,
                flow_rate_min: document.getElementById('flowRateMin').value || null,
                flow_rate_max: document.getElementById('flowRateMax').value || null,
                flow_rate_type: document.getElementById('flowRateType').value,
                apparent_density_min: document.getElementById('apparentDensityMin').value || null,
                apparent_density_max: document.getElementById('apparentDensityMax').value || null,
                apparent_density_type: document.getElementById('apparentDensityType').value,
                c_content_min: document.getElementById('cContentMin').value || null,
                c_content_max: document.getElementById('cContentMax').value || null,
                c_content_type: document.getElementById('cContentType').value,
                cu_content_min: document.getElementById('cuContentMin').value || null,
                cu_content_max: document.getElementById('cuContentMax').value || null,
                cu_content_type: document.getElementById('cuContentType').value,
                moisture_min: document.getElementById('moistureMin').value || null,
                moisture_max: document.getElementById('moistureMax').value || null,
                moisture_type: document.getElementById('moistureType').value,
                ash_min: document.getElementById('ashMin').value || null,
                ash_max: document.getElementById('ashMax').value || null,
                ash_type: document.getElementById('ashType').value,
                sinter_change_rate_min: document.getElementById('sinterChangeRateMin').value || null,
                sinter_change_rate_max: document.getElementById('sinterChangeRateMax').value || null,
                sinter_change_rate_type: document.getElementById('sinterChangeRateType').value,
                sinter_strength_min: document.getElementById('sinterStrengthMin').value || null,
                sinter_strength_max: document.getElementById('sinterStrengthMax').value || null,
                sinter_strength_type: document.getElementById('sinterStrengthType').value,
                forming_strength_min: document.getElementById('formingStrengthMin').value || null,
                forming_strength_max: document.getElementById('formingStrengthMax').value || null,
                forming_strength_type: document.getElementById('formingStrengthType').value,
                forming_load_min: document.getElementById('formingLoadMin').value || null,
                forming_load_max: document.getElementById('formingLoadMax').value || null,
                forming_load_type: document.getElementById('formingLoadType').value,
                particle_size_type: document.getElementById('particleSizeType').value
            };

            try {
                const url = specId ? `${API_BASE}/api/admin/powder-spec/${specId}` : `${API_BASE}/api/admin/powder-spec`;
                const method = specId ? 'PUT' : 'POST';

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(powderData)
                });

                const data = await response.json();

                if (data.success) {
                    // 입도분석 데이터 저장
                    const particleType = document.getElementById('particleSizeType').value;
                    if (particleType !== '비활성') {
                        const particleSpecs = [];
                        const meshSizes = [
                            { id: '180', name: '+180 um' },
                            { id: '150', name: '+150 um' },
                            { id: '106', name: '+106 um' },
                            { id: '75', name: '+75 um' },
                            { id: '45', name: '+45 um' },
                            { id: '45m', name: '-45 um' }
                        ];

                        meshSizes.forEach(mesh => {
                            const minVal = document.getElementById(`particle_${mesh.id}_min`).value;
                            const maxVal = document.getElementById(`particle_${mesh.id}_max`).value;
                            if (minVal && maxVal) {
                                particleSpecs.push({
                                    powder_name: powderName,
                                    mesh_size: mesh.name,
                                    min_value: parseFloat(minVal),
                                    max_value: parseFloat(maxVal)
                                });
                            }
                        });

                        // 입도분석 규격 저장
                        if (particleSpecs.length > 0) {
                            await fetch(`${API_BASE}/api/admin/particle-size/bulk`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    powder_name: powderName,
                                    specs: particleSpecs
                                })
                            });
                        }
                    }

                    alert('저장되었습니다.');
                    hidePowderForm();
                    loadPowderSpecs(powderSpecMode);
                    loadParticlePowderList();
                    // 검사 페이지의 분말 목록도 갱신
                    loadPowderList('incoming');
                    loadPowderList('mixing');
                } else {
                    alert('저장 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        });
        }

        async function deletePowderSpec(specId, powderName) {
            if (!confirm(`'${powderName}' 분말을 삭제하시겠습니까?`)) return;

            try {
                const response = await fetch(`${API_BASE}/api/admin/powder-spec/${specId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    alert('삭제되었습니다.');
                    loadPowderSpecs(powderSpecMode);
                    loadParticlePowderList();
                } else {
                    alert('삭제 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // ============================================
        // 입도분석 규격 관리
        // ============================================

        async function loadParticlePowderList() {
            try {
                const response = await fetch(`${API_BASE}/api/powder-list`);
                const data = await response.json();

                const select = document.getElementById('particlePowderSelect');
                if (!select) {
                    console.warn('particlePowderSelect 요소를 찾을 수 없습니다.');
                    return;
                }

                select.innerHTML = '<option value="">분말을 선택하세요</option>';

                if (data.success) {
                    data.data.forEach(powder => {
                        const option = document.createElement('option');
                        option.value = powder;
                        option.textContent = powder;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('분말 목록 로딩 실패:', error);
            }
        }

        async function loadParticleSpecs() {
            const powderName = document.getElementById('particlePowderSelect').value;

            if (!powderName) {
                document.getElementById('particleList').innerHTML = `<div class="empty-message">${t('selectPowderPlaceholder')}</div>`;
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/admin/particle-size/${powderName}`);
                const data = await response.json();

                const listDiv = document.getElementById('particleList');

                if (data.success && data.data.length > 0) {
                    let html = `<table><tr><th>${t('meshSize')}</th><th>${t('minValue')} (%)</th><th>${t('maxValue')} (%)</th><th>${t('action')}</th></tr>`;

                    data.data.forEach(spec => {
                        html += `
                            <tr>
                                <td>${spec.mesh_size}</td>
                                <td>${spec.min_value}</td>
                                <td>${spec.max_value}</td>
                                <td>
                                    <button class="btn secondary" onclick="editParticleSpec(${spec.id})" style="padding: 8px 12px; margin-right: 5px;">${t('edit')}</button>
                                    <button class="btn danger" onclick="deleteParticleSpec(${spec.id}, '${spec.mesh_size}')" style="padding: 8px 12px;">${t('delete')}</button>
                                </td>
                            </tr>
                        `;
                    });

                    html += '</table>';
                    listDiv.innerHTML = html;
                } else {
                    listDiv.innerHTML = `<div class="empty-message">${t('noParticleSpecs')}</div>`;
                }
            } catch (error) {
                console.error('입도분석 규격 로딩 실패:', error);
            }
        }

        function showAddParticleForm() {
            const powderName = document.getElementById('particlePowderSelect').value;
            if (!powderName) {
                alert('먼저 분말을 선택하세요.');
                return;
            }

            document.getElementById('particleFormTitle').textContent = t('addParticleSpec');
            document.getElementById('particleSpecId').value = '';
            document.getElementById('particleForm').reset();
            document.getElementById('particleFormContainer').style.display = 'block';
        }

        function hideParticleForm() {
            document.getElementById('particleFormContainer').style.display = 'none';
            document.getElementById('particleForm').reset();
        }

        async function editParticleSpec(specId) {
            try {
                const powderName = document.getElementById('particlePowderSelect').value;
                const response = await fetch(`${API_BASE}/api/admin/particle-size/${powderName}`);
                const data = await response.json();

                if (data.success) {
                    const spec = data.data.find(s => s.id === specId);
                    if (spec) {
                        document.getElementById('particleFormTitle').textContent = t('editParticleSpec');
                        document.getElementById('particleSpecId').value = spec.id;
                        document.getElementById('particleMeshSize').value = spec.mesh_size;
                        document.getElementById('particleMinValue').value = spec.min_value;
                        document.getElementById('particleMaxValue').value = spec.max_value;
                        document.getElementById('particleFormContainer').style.display = 'block';
                    }
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        const particleFormElement = document.getElementById('particleForm');


        if (particleFormElement) {


            particleFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const specId = document.getElementById('particleSpecId').value;
            const powderName = document.getElementById('particlePowderSelect').value;
            const particleData = {
                powder_name: powderName,
                mesh_size: document.getElementById('particleMeshSize').value,
                min_value: document.getElementById('particleMinValue').value,
                max_value: document.getElementById('particleMaxValue').value
            };

            try {
                const url = specId ? `${API_BASE}/api/admin/particle-size/${specId}` : `${API_BASE}/api/admin/particle-size`;
                const method = specId ? 'PUT' : 'POST';

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(particleData)
                });

                const data = await response.json();

                if (data.success) {
                    alert('저장되었습니다.');
                    hideParticleForm();
                    loadParticleSpecs();
                } else {
                    alert('저장 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        });
        }

        async function deleteParticleSpec(specId, meshSize) {
            if (!confirm(`'${meshSize}' 규격을 삭제하시겠습니까?`)) return;

            try {
                const response = await fetch(`${API_BASE}/api/admin/particle-size/${specId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    alert('삭제되었습니다.');
                    loadParticleSpecs();
                } else {
                    alert('삭제 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // ============================================
        // 검사자 관리
        // ============================================

        async function loadInspectors() {
            try {
                const response = await fetch(`${API_BASE}/api/admin/inspector`);
                const data = await response.json();

                const listDiv = document.getElementById('inspectorList');

                if (data.success && data.data.length > 0) {
                    let html = `<table><tr><th>${t('inspectorName')}</th><th>${t('action')}</th></tr>`;

                    data.data.forEach(inspector => {
                        html += `
                            <tr>
                                <td>${inspector.name}</td>
                                <td>
                                    <button class="btn danger" onclick="deleteInspector(${inspector.id}, '${inspector.name}')" style="padding: 8px 12px;">${t('delete')}</button>
                                </td>
                            </tr>
                        `;
                    });

                    html += '</table>';
                    listDiv.innerHTML = html;
                } else {
                    listDiv.innerHTML = `<div class="empty-message">${t('noInspectors')}</div>`;
                }
            } catch (error) {
                console.error('검사자 목록 로딩 실패:', error);
            }
        }

        async function addInspector() {
            const name = document.getElementById('newInspectorName').value.trim();

            if (!name) {
                alert('검사자 이름을 입력하세요.');
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/admin/inspector`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name })
                });

                const data = await response.json();

                if (data.success) {
                    alert('추가되었습니다.');
                    document.getElementById('newInspectorName').value = '';
                    loadInspectors();
                } else {
                    alert('추가 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        async function deleteInspector(inspectorId, name) {
            if (!confirm(`'${name}' 검사자를 삭제하시겠습니까?`)) return;

            try {
                const response = await fetch(`${API_BASE}/api/admin/inspector/${inspectorId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    alert('삭제되었습니다.');
                    loadInspectors();
                } else {
                    alert('삭제 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // ============================================
        // 작업자 관리
        // ============================================

        async function loadOperators() {
            try {
                const response = await fetch(`${API_BASE}/api/admin/operator`);
                const data = await response.json();

                const listDiv = document.getElementById('operatorList');

                if (data.success && data.data.length > 0) {
                    let html = `<table><tr><th>${t('operatorName')}</th><th>${t('action')}</th></tr>`;

                    data.data.forEach(operator => {
                        html += `
                            <tr>
                                <td>${operator.name}</td>
                                <td>
                                    <button class="btn danger" onclick="deleteOperator(${operator.id}, '${operator.name}')" style="padding: 8px 12px;">${t('delete')}</button>
                                </td>
                            </tr>
                        `;
                    });

                    html += '</table>';
                    listDiv.innerHTML = html;
                } else {
                    listDiv.innerHTML = `<div class="empty-message">${t('noOperators')}</div>`;
                }
            } catch (error) {
                console.error('작업자 목록 로딩 실패:', error);
            }
        }

        async function addOperator() {
            const name = document.getElementById('newOperatorName').value.trim();

            if (!name) {
                alert('작업자 이름을 입력하세요.');
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/admin/operator`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name })
                });

                const data = await response.json();

                if (data.success) {
                    alert('추가되었습니다.');
                    document.getElementById('newOperatorName').value = '';
                    loadOperators();
                } else {
                    alert('추가 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        async function deleteOperator(operatorId, name) {
            if (!confirm(`'${name}' 작업자를 삭제하시겠습니까?`)) return;

            try {
                const response = await fetch(`${API_BASE}/api/admin/operator/${operatorId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    alert('삭제되었습니다.');
                    loadOperators();
                } else {
                    alert('삭제 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // ============================================
        // Recipe(배합 규격서) 관리
        // ============================================

        let recipeLineCount = 0;

        async function loadProductRecipes() {
            try {
                const response = await fetch(`${API_BASE}/api/admin/recipes`);
                const data = await response.json();

                const listDiv = document.getElementById('productList');

                if (data.success && data.data.length > 0) {
                    let html = '<table class="data-table" style="width:100%"><thead><tr><th>제품명</th><th>제품코드</th><th>작업</th></tr></thead><tbody>';

                    data.data.forEach((product, index) => {
                        const totalRatio = product.recipes.reduce((sum, r) => sum + parseFloat(r.ratio || 0), 0);
                        const productNameEscaped = product.product_name.replace(/'/g, "\\'");

                        html += `
                            <tr>
                                <td style="padding: 12px;">${product.product_name}</td>
                                <td style="padding: 12px;">${product.product_code || '-'}</td>
                                <td style="padding: 12px;">
                                    <button class="btn" onclick="toggleProductDetail('${productNameEscaped}', ${index})" id="viewBtn_${index}" style="padding: 6px 12px; margin-right: 5px; background: #2196F3;">조회</button>
                                    <button class="btn primary" onclick="editProduct('${productNameEscaped}')" style="padding: 6px 12px; margin-right: 5px;">수정</button>
                                    <button class="btn danger" onclick="deleteProduct('${productNameEscaped}')" style="padding: 6px 12px;">삭제</button>
                                </td>
                            </tr>
                            <tr id="detailRow_${index}" style="display: none;">
                                <td colspan="3" style="padding: 0; background: #f8f9fa;">
                                    <div style="padding: 20px; border-left: 4px solid #667eea;">
                                        <h4 style="margin: 0 0 15px 0; color: #667eea;">배합 구성</h4>
                                        <table style="width: 100%; font-size: 0.9em;">
                                            <tr style="background: #e3f2fd;">
                                                <th style="padding: 10px;">${t('powderName')}</th>
                                                <th style="padding: 10px;">${t('category')}</th>
                                                <th style="padding: 10px;">${t('ratio')} (%)</th>
                                                <th style="padding: 10px;">${t('tolerance')} (%)</th>
                                                <th style="padding: 10px;">Main</th>
                                            </tr>`;

                        product.recipes.forEach(recipe => {
                            const categoryBadge = recipe.powder_category === 'incoming'
                                ? `<span class="badge" style="background: #2196F3;">${t('incoming')}</span>`
                                : `<span class="badge" style="background: #FF9800;">${t('mixing')}</span>`;

                            const isMainBadge = recipe.is_main
                                ? '<span style="color: #FF5722; font-weight: 600;">✓</span>'
                                : '-';

                            html += `
                                <tr>
                                    <td style="padding: 8px;">${recipe.powder_name}</td>
                                    <td style="padding: 8px;">${categoryBadge}</td>
                                    <td style="padding: 8px;">${formatTwo(recipe.ratio)}%</td>
                                    <td style="padding: 8px;">±${formatTwo(recipe.tolerance_percent)}%</td>
                                    <td style="padding: 8px; text-align: center;">${isMainBadge}</td>
                                </tr>`;
                        });

                        html += `
                                            <tr style="font-weight: bold; background: #f5f5f5;">
                                                <td style="padding: 10px;">${t('totalRatio')}</td>
                                                <td colspan="4" style="padding: 10px;">${totalRatio.toFixed(2)}%</td>
                                            </tr>
                                        </table>
                                    </div>
                                </td>
                            </tr>`;
                    });

                    html += '</tbody></table>';
                    listDiv.innerHTML = html;
                } else {
                    listDiv.innerHTML = `<div class="empty-message">${t('noProducts')}</div>`;
                }
            } catch (error) {
                console.error('Recipe 목록 로딩 실패:', error);
            }
        }

        function toggleProductDetail(productName, index) {
            const detailRow = document.getElementById(`detailRow_${index}`);
            const viewBtn = document.getElementById(`viewBtn_${index}`);

            if (detailRow.style.display === 'none') {
                detailRow.style.display = 'table-row';
                viewBtn.textContent = '닫기';
                viewBtn.style.background = '#FF5722';
            } else {
                detailRow.style.display = 'none';
                viewBtn.textContent = '조회';
                viewBtn.style.background = '#2196F3';
            }
        }

        async function showAddProductForm() {
            document.getElementById('productFormTitle').textContent = t('addNewProduct');
            document.getElementById('recipeProductName').value = '';
            document.getElementById('recipeProductName').readOnly = false; // 새 제품 추가 시 수정 가능
            document.getElementById('recipeProductCode').value = '';
            document.getElementById('recipeLines').innerHTML = '';
            recipeLineCount = 0;

            // 초기 Recipe 라인 1개 추가 (await로 분말 목록 로드 완료 대기)
            await addRecipeLine();

            document.getElementById('productFormContainer').style.display = 'block';
        }

        function hideProductForm() {
            document.getElementById('productFormContainer').style.display = 'none';
        }

        async function editProduct(productName) {
            try {
                // 제품의 Recipe 데이터 가져오기
                const response = await fetch(`${API_BASE}/api/admin/recipes?product_name=${encodeURIComponent(productName)}`);
                const data = await response.json();

                if (!data.success || !data.data || data.data.length === 0) {
                    alert('제품 정보를 찾을 수 없습니다.');
                    return;
                }

                const product = data.data[0]; // 첫 번째 제품 (제품명으로 필터링했으므로 1개만 있음)

                // 폼 제목 변경
                document.getElementById('productFormTitle').textContent = t('editProduct');

                // 제품 정보 입력
                document.getElementById('recipeProductName').value = product.product_name;
                document.getElementById('recipeProductName').readOnly = true; // 제품명은 수정 불가
                document.getElementById('recipeProductCode').value = product.product_code || '';

                // 기존 Recipe 라인 제거
                document.getElementById('recipeLines').innerHTML = '';
                recipeLineCount = 0;

                // 각 Recipe 라인 추가 및 데이터 채우기
                for (const recipe of product.recipes) {
                    await addRecipeLine();

                    // 방금 추가된 라인 (마지막 라인)
                    const lines = document.querySelectorAll('.recipe-line');
                    const lastLine = lines[lines.length - 1];

                    // 데이터 채우기
                    lastLine.querySelector('.recipe-powder-name').value = recipe.powder_name;
                    lastLine.querySelector('.recipe-ratio').value = formatTwo(recipe.ratio);
                    lastLine.querySelector('.recipe-tolerance').value = formatTwo(recipe.tolerance_percent);

                    // Main 분말 체크
                    if (recipe.is_main) {
                        lastLine.querySelector('.recipe-is-main').checked = true;
                    }
                }

                // 폼을 해당 제품 card 바로 아래로 이동
                const formContainer = document.getElementById('productFormContainer');
                const productCard = document.querySelector(`.product-card[data-product-name="${productName}"]`);

                if (productCard && formContainer) {
                    // 폼을 productCard 바로 다음에 삽입
                    productCard.insertAdjacentElement('afterend', formContainer);
                }

                // 폼 표시
                formContainer.style.display = 'block';

            } catch (error) {
                alert('오류: ' + error.message);
                console.error('Edit product error:', error);
            }
        }

        async function addRecipeLine() {
            const container = document.getElementById('recipeLines');
            const lineId = recipeLineCount++;

            // 수입검사용 분말 목록 가져오기
            let powderOptions = '<option value="">' + t('selectPlaceholder') + '</option>';
            try {
                const response = await fetch(`${API_BASE}/api/powders?category=incoming`);
                const data = await response.json();
                if (data.success && data.powders) {
                    data.powders.forEach(powder => {
                        powderOptions += `<option value="${powder.powder_name}">${powder.powder_name}</option>`;
                    });
                }
            } catch (error) {
                console.error('Failed to load powder list:', error);
            }

            const lineHtml = `
                <div class="recipe-line" data-line-id="${lineId}" style="display: grid; grid-template-columns: 2fr 1fr 1fr 80px 60px; gap: 10px; margin-bottom: 10px; padding: 10px; background: white; border-radius: 5px;">
                    <div class="form-group">
                        <label>${t('powderName')} *</label>
                        <select class="recipe-powder-name" required>
                            ${powderOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>${t('ratio')} (%) *</label>
                        <input type="number" step="0.01" class="recipe-ratio" required placeholder="60.00">
                    </div>
                    <div class="form-group">
                        <label>${t('tolerance')} (%) *</label>
                        <input type="number" step="0.01" class="recipe-tolerance" required placeholder="0.05" value="0.05">
                    </div>
                    <div class="form-group" style="display: flex; align-items: end;">
                        <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 0; cursor: pointer;">
                            <input type="checkbox" class="recipe-is-main" value="${lineId}">
                            <span style="font-size: 0.9em;">Main</span>
                        </label>
                    </div>
                    <div style="display: flex; align-items: end;">
                        <button type="button" class="btn danger" onclick="removeRecipeLine(${lineId})" style="padding: 10px; width: 100%;">×</button>
                    </div>
                </div>`;

            container.insertAdjacentHTML('beforeend', lineHtml);

            // 방금 추가된 체크박스에 이벤트 리스너 추가
            const newCheckbox = container.querySelector(`[data-line-id="${lineId}"] .recipe-is-main`);
            if (newCheckbox) {
                newCheckbox.addEventListener('change', function() {
                    const checkedBoxes = document.querySelectorAll('.recipe-is-main:checked');
                    if (checkedBoxes.length > 2) {
                        this.checked = false;
                        alert('Main 분말은 최대 2개까지만 선택할 수 있습니다.');
                    }
                });
            }
        }

        function removeRecipeLine(lineId) {
            const line = document.querySelector(`[data-line-id="${lineId}"]`);
            if (line) line.remove();
        }

        const productFormElement = document.getElementById('productForm');


        if (productFormElement) {


            productFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const productName = document.getElementById('recipeProductName').value.trim();
            const productCode = document.getElementById('recipeProductCode').value.trim();

            // 제품명 확인
            if (!productName) {
                alert('제품명을 입력하세요.');
                return;
            }

            // Recipe 라인 수집
            const lines = document.querySelectorAll('.recipe-line');

            // Recipe 라인 존재 확인
            if (lines.length === 0) {
                alert('배합 구성을 최소 1개 이상 추가하세요.');
                return;
            }

            const recipes = [];

            // Main 분말 확인 (체크박스로 변경, 최대 2개)
            const mainCheckboxes = document.querySelectorAll('.recipe-is-main:checked');
            const mainLineIds = Array.from(mainCheckboxes).map(cb => cb.value);

            lines.forEach(line => {
                const powderName = line.querySelector('.recipe-powder-name').value.trim();
                const ratio = line.querySelector('.recipe-ratio').value;
                const tolerance = line.querySelector('.recipe-tolerance').value;
                const lineId = line.getAttribute('data-line-id');
                const isMain = mainLineIds.includes(lineId);

                // 필수 항목 확인
                if (powderName && ratio && tolerance) {
                    recipes.push({
                        product_name: productName,
                        product_code: productCode,
                        powder_name: powderName,
                        powder_category: 'incoming',  // 항상 수입검사용 분말
                        ratio: parseFloat(ratio),
                        target_weight: null,
                        tolerance_percent: parseFloat(tolerance),
                        is_main: isMain
                    });
                }
            });

            // 유효한 Recipe가 있는지 확인
            if (recipes.length === 0) {
                alert('분말명과 비율을 입력하세요.');
                return;
            }

            // 비율 합계 확인
            const totalRatio = recipes.reduce((sum, r) => sum + r.ratio, 0);
            if (Math.abs(totalRatio - 100) > 0.1) {
                alert(`배합 비율의 합계가 100%가 아닙니다. 현재: ${totalRatio.toFixed(1)}%\n\n각 분말의 비율을 조정하여 합계가 100%가 되도록 해주세요.`);
                return;
            }

            try {
                // 수정 모드인지 확인 (제품명 필드가 readOnly이면 수정 모드)
                const isEditMode = document.getElementById('recipeProductName').readOnly;

                if (isEditMode) {
                    // 수정 모드: 기존 Recipe 삭제 후 새로 추가
                    const deleteResponse = await fetch(`${API_BASE}/api/admin/recipe/product/${encodeURIComponent(productName)}`, {
                        method: 'DELETE'
                    });

                    const deleteData = await deleteResponse.json();
                    if (!deleteData.success) {
                        throw new Error('기존 Recipe 삭제 실패: ' + deleteData.message);
                    }
                }

                // 각 Recipe를 개별적으로 저장
                for (const recipe of recipes) {
                    const response = await fetch(`${API_BASE}/api/admin/recipe`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(recipe)
                    });

                    const data = await response.json();
                    if (!data.success) {
                        throw new Error(data.message);
                    }
                }

                alert(isEditMode ? '수정되었습니다.' : '저장되었습니다.');
                hideProductForm();
                loadProductRecipes();
            } catch (error) {
                alert('저장 실패: ' + error.message);
            }
        });
        }

        async function deleteProduct(productName) {
            if (!confirm(`'${productName}' 제품의 모든 Recipe를 삭제하시겠습니까?`)) return;

            try {
                const response = await fetch(`${API_BASE}/api/admin/recipe/product/${encodeURIComponent(productName)}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    alert('삭제되었습니다.');
                    loadProductRecipes();
                } else {
                    alert('삭제 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // ============================================
        // 배합 작업 (Blending Work)
        // ============================================

        let currentRecipe = null;
        let currentProductCode = '';

        async function loadBlendingPage() {
            // 목록 먼저 보이도록 폼 숨김
            hideBlendingForm();

            await loadProductsForBlending();
            await loadOperatorList();
            await generateAndSetBatchLot();

                // 작업지시서에서 시작한 경우 정보 자동 입력
                checkAndFillBlendingOrderInfo();

                // 이 화면에서도 작업지시서 목록을 보여주고 작업 시작 가능
                if (typeof loadBlendingOrdersForBlending === 'function') {
                    await loadBlendingOrdersForBlending();
                }

                // 진행중인 배합작업 목록 로드
                await loadInProgressBlendingWorks();
        }

        // --------------------------------------------
        // 진행중인 배합작업 목록 로드
        // --------------------------------------------
        async function loadInProgressBlendingWorks() {
            try {
                const response = await fetch(`${API_BASE}/api/blending/works?status=in_progress`);
                const data = await response.json();

                const tbody = document.getElementById('inProgressBlendingWorks');
                if (!tbody) return;

                if (!data.success || !data.works || data.works.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="empty-message">진행중인 배합작업이 없습니다.</td></tr>';
                    return;
                }

                tbody.innerHTML = data.works.map(work => {
                    const startTime = work.start_time ? new Date(work.start_time).toLocaleString('ko-KR') : '-';

                    // 진행률 계산 (투입된 원재료 수 / 전체 원재료 수)
                    const progress = work.material_input_count || 0;
                    const total = work.total_materials || 0;
                    const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;

                    return `
                        <tr>
                            <td>${work.work_order || '-'}</td>
                            <td>${work.product_name}</td>
                            <td><strong>${work.batch_lot}</strong></td>
                            <td>${work.operator || '-'}</td>
                            <td>${startTime}</td>
                            <td>${progress}/${total} (${progressPercent}%)</td>
                            <td>
                                <button class="btn" onclick="loadAutoInputPage(${work.id}, 'blending')" style="padding: 6px 12px; font-size: 0.9em; background:#4CAF50; color:white; border:none; border-radius:4px; margin-right: 5px;">
                                    작업 계속
                                </button>
                                <button class="btn danger" onclick="deleteBlendingWork(${work.id}, '${work.batch_lot}')" style="padding: 6px 12px; font-size: 0.9em;">
                                    삭제
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            } catch (error) {
                console.error('진행중인 배합작업 로드 실패:', error);
                const tbody = document.getElementById('inProgressBlendingWorks');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="7" class="empty-message">오류 발생: ' + error.message + '</td></tr>';
                }
            }
        }

        // --------------------------------------------
        // 배합검사 페이지: 완료된 배합작업 목록 로드
        // --------------------------------------------
        async function loadMixingPage() {
            try {
                const response = await fetch(`${API_BASE}/api/blending/works?status=completed`);
                const data = await response.json();

                const container = document.getElementById('mixingCompletedList');
                if (!container) return;

                if (!data.success || !data.works || data.works.length === 0) {
                    container.innerHTML = '<div class="empty-message">완료된 배합작업이 없습니다.</div>';
                    return;
                }

                let html = '<table class="data-table" style="width:100%"><thead><tr><th>작업지시번호</th><th>제품명</th><th>배합 LOT</th><th>작업자</th><th>완료시간</th><th>작업</th></tr></thead><tbody>';

                data.works.forEach(work => {
                    const endTime = work.end_time ? new Date(work.end_time).toLocaleString('ko-KR') : '-';

                    // 검사 상태에 따라 버튼/아이콘 표시
                    let actionHtml = '';
                    if (work.inspection_status === 'completed') {
                        // 검사 완료된 경우
                        if (work.inspection_result === 'pass') {
                            actionHtml = '<span style="font-size:24px;color:#4CAF50;">✅</span> <span style="color:#4CAF50;font-weight:600;">합격</span>';
                        } else if (work.inspection_result === 'fail') {
                            actionHtml = '<span style="font-size:24px;color:#F44336;">❌</span> <span style="color:#F44336;font-weight:600;">불합격</span>';
                        } else {
                            actionHtml = '<span style="color:#666;">검사완료</span>';
                        }
                    } else if (work.inspection_status === 'in_progress') {
                        // 검사 진행 중 - 이어하기 버튼 표시
                        actionHtml = `<button class="btn" onclick="continueInspection('${work.product_name}', '${work.batch_lot}', 'mixing')" style="padding:6px 10px; background:#FFC107; color:#000;">⏳ 검사 이어하기</button>`;
                    } else {
                        // 검사 미시작
                        actionHtml = `<button class="btn primary" onclick="startBlendingInspectionFromMixing('${work.batch_lot}', '${work.product_name}')" style="padding:6px 10px;">🔧 배합검사</button>`;
                    }

                    html += `
                        <tr>
                            <td>${work.work_order || '-'}</td>
                            <td>${work.product_name}</td>
                            <td><strong>${work.batch_lot}</strong></td>
                            <td>${work.operator || '-'}</td>
                            <td>${endTime}</td>
                            <td>${actionHtml}</td>
                        </tr>
                    `;
                });

                html += '</tbody></table>';
                container.innerHTML = html;
            } catch (err) {
                console.error('mixing 목록 로딩 실패:', err);
                const container = document.getElementById('mixingCompletedList');
                if (container) container.innerHTML = '<div class="empty-message">목록을 불러올 수 없습니다.</div>';
            }
        }

        // 배합검사 시작 (mixing 페이지에서 클릭)
        function startBlendingInspectionFromMixing(batchLot, productName) {
            // 바로 검사 시작 API 호출과 검사 페이지 노출
            startInspection(productName, batchLot, '일상점검', '', 'mixing');
        }

        function checkAndFillBlendingOrderInfo() {
            const orderId = sessionStorage.getItem('blendingOrderId');
            const productName = sessionStorage.getItem('blendingOrderProduct');
            const workOrderNumber = sessionStorage.getItem('blendingOrderNumber');

            if (orderId && productName && workOrderNumber) {
                // 제품명 자동 선택 및 고정(선택 불가)
                const productSelect = document.getElementById('blendingProductName');
                if (productSelect) {
                    // 옵션에서 일치하는 값이 있으면 선택
                    let found = false;
                    for (let i = 0; i < productSelect.options.length; i++) {
                        if (productSelect.options[i].value === productName) {
                            productSelect.selectedIndex = i;
                            found = true;
                            break;
                        }
                    }
                    // 값이 없더라도 value에 설정
                    if (!found) {
                        productSelect.value = productName;
                    }

                    // 제품명을 고정하여 선택 기능 제거
                    productSelect.disabled = true;
                    productSelect.setAttribute('data-fixed', 'true');
                    productSelect.style.background = '#f0f0f0';

                    // change 이벤트 트리거 (레시피 로드)
                    productSelect.dispatchEvent(new Event('change', { bubbles: true }));

                    // 제품 선택 시 Recipe 자동 로드 (안전하게 호출)
                    if (typeof loadRecipeForProduct === 'function') {
                        loadRecipeForProduct();
                    }
                }

                // 작업지시번호 표시 (읽기 전용으로)
                const workOrderInput = document.getElementById('blendingWorkOrder');
                if (workOrderInput) {
                    workOrderInput.value = workOrderNumber;
                    workOrderInput.setAttribute('readonly', 'readonly');
                    workOrderInput.style.background = '#f0f0f0';
                }

                // sessionStorage 클리어 (한 번만 사용)
                // sessionStorage.removeItem('blendingOrderId');
                // sessionStorage.removeItem('blendingOrderProduct');
                // sessionStorage.removeItem('blendingOrderNumber');
            }
        }

        function hideBlendingForm() {
            const card = document.getElementById('blendingFormCard');
            if (card) card.style.display = 'none';

            // 목록 카드들 다시 표시
            const orderListCard = document.getElementById('blendingOrderListCard');
            const inProgressCard = document.getElementById('inProgressWorksCard');
            const backBtn = document.getElementById('backToOrderListBtn');

            if (orderListCard) orderListCard.style.display = 'block';
            if (inProgressCard) inProgressCard.style.display = 'block';
            if (backBtn) backBtn.style.display = 'none';
        }

        function showBlendingForm() {
            const card = document.getElementById('blendingFormCard');
            if (card) card.style.display = 'block';

            // 목록 카드들 숨기기
            const orderListCard = document.getElementById('blendingOrderListCard');
            const inProgressCard = document.getElementById('inProgressWorksCard');
            const backBtn = document.getElementById('backToOrderListBtn');

            if (orderListCard) orderListCard.style.display = 'none';
            if (inProgressCard) inProgressCard.style.display = 'none';
            if (backBtn) backBtn.style.display = 'block';
        }

        function showOrderListView() {
            // 폼 숨기고 목록 표시
            hideBlendingForm();
            // 폼 초기화
            const form = document.getElementById('blendingForm');
            if (form) form.reset();
        }

        async function loadProductsForBlending() {
            try {
                const response = await fetch(`${API_BASE}/api/blending/products`);
                const data = await response.json();

                const select = document.getElementById('blendingProductName');
                // 제품 목록 로드 시 잠금 해제(직접 선택 가능하게)
                select.disabled = false;
                select.removeAttribute('data-fixed');
                select.style.background = '';

                select.innerHTML = '<option value="">선택하세요</option>';

                if (data.success && data.data.length > 0) {
                    data.data.forEach(product => {
                        const option = document.createElement('option');
                        option.value = product.product_name;
                        option.dataset.productCode = product.product_code || '';
                        option.textContent = product.product_name;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('제품 목록 로딩 실패:', error);
            }
        }

        async function loadOperatorList() {
            try {
                const response = await fetch(`${API_BASE}/api/operator-list`);
                const data = await response.json();

                const select = document.getElementById('blendingOperator');
                select.innerHTML = '<option value="">선택하세요</option>';

                if (data.success) {
                    data.data.forEach(operator => {
                        const option = document.createElement('option');
                        option.value = operator;
                        option.textContent = operator;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('작업자 목록 로딩 실패:', error);
            }
        }

        async function generateAndSetBatchLot() {
            try {
                const response = await fetch(`${API_BASE}/api/blending/generate-lot`);
                const data = await response.json();

                if (data.success) {
                    document.getElementById('blendingBatchLot').value = data.batch_lot;
                }
            } catch (error) {
                console.error('배합 LOT 생성 실패:', error);
            }
        }

        async function loadRecipeForProduct() {
            const select = document.getElementById('blendingProductName');
            const productName = select.value;

            if (!productName) {
                document.getElementById('recipePreview').style.display = 'none';
                currentRecipe = null;
                return;
            }

            // 제품 코드 저장
            const selectedOption = select.options[select.selectedIndex];
            currentProductCode = selectedOption.dataset.productCode || '';

            try {
                const response = await fetch(`${API_BASE}/api/blending/recipe/${encodeURIComponent(productName)}`);
                const data = await response.json();

                if (data.success && data.data.length > 0) {
                    currentRecipe = data.data;
                    renderRecipePreview(data.data);
                } else {
                    alert('해당 제품의 Recipe가 없습니다.');
                    currentRecipe = null;
                }
            } catch (error) {
                alert('Recipe 로딩 실패: ' + error.message);
                currentRecipe = null;
            }
        }

        function renderRecipePreview(recipes) {
            const container = document.getElementById('recipePreviewContent');
            const blendingWeight = parseFloat(document.getElementById('blendingTargetWeight').value) || 0;

            // Main 분말들 찾기
            const mainRecipes = recipes.filter(r => r.is_main);

            // 총 Main 중량은 배합중량을 기준으로 함 (Option A)
            const totalMainWeight = blendingWeight;

            // Main 분말 비율 합계
            const totalMainRatio = mainRecipes.reduce((sum, r) => sum + r.ratio, 0);

            let html = '<table style="width: 100%; font-size: 0.9em;">';
            html += `<tr>
                <th>${t('powderName')}</th>
                <th>${t('category')}</th>
                <th>${t('ratio')} (%)</th>
                <th>${t('calculatedWeight')} (kg)</th>
            </tr>`;

            recipes.forEach(recipe => {
                let calculatedWeightDisplay = '-';

                if (mainRecipes.length > 0) {
                    // 메인 분말이 존재할 때
                    if (recipe.is_main) {
                        // main이 한 개면 전체 배합중량을 할당, 여러개면 ratio로 분배
                        if (mainRecipes.length === 1) {
                            recipe.calculated_weight = totalMainWeight;
                            calculatedWeightDisplay = formatNumber(totalMainWeight.toFixed(2));
                        } else if (totalMainRatio > 0) {
                            const w = totalMainWeight * (recipe.ratio / totalMainRatio);
                            recipe.calculated_weight = w;
                            calculatedWeightDisplay = formatNumber(w.toFixed(2));
                        }
                    } else {
                        // 비주 분말: 총 Main 중량(=배합중량)을 기준으로 비율대로 계산
                        if (totalMainRatio > 0) {
                            const w = totalMainWeight * (recipe.ratio / totalMainRatio);
                            recipe.calculated_weight = w;
                            calculatedWeightDisplay = formatNumber(w.toFixed(2));
                        }
                    }
                } else {
                    // Main 분말이 없을 때는 기존 방식 - 배합중량 기준 비율로 계산
                    const w = blendingWeight * (recipe.ratio / 100);
                    recipe.calculated_weight = w;
                    calculatedWeightDisplay = formatNumber(w.toFixed(2));
                }

                const categoryBadge = recipe.powder_category === 'incoming'
                    ? `<span class="badge" style="background: #2196F3;">${t('incoming')}</span>`
                    : `<span class="badge" style="background: #FF9800;">${t('mixing')}</span>`;

                const mainBadge = recipe.is_main ? ' <span class="badge" style="background: #FF5722; font-size: 0.75em;">MAIN</span>' : '';

                html += `<tr>
                    <td>${recipe.powder_name}${mainBadge}</td>
                    <td>${categoryBadge}</td>
                    <td>${formatTwo(recipe.ratio)}%</td>
                    <td>${calculatedWeightDisplay}</td>
                </tr>`;
            });

            html += '</table>';
            container.innerHTML = html;
            document.getElementById('recipePreview').style.display = 'block';

            // Note: start 폼에서는 Main 분말 중량을 별도 입력하지 않으므로, 상세 투입 화면에서 TOn 선택을 하도록 합니다.
        }

        function renderMainPowderWeightSelectors(mainRecipes) {
            const container = document.getElementById('mainPowderWeightsContainer');

            if (!mainRecipes || mainRecipes.length === 0) {
                container.style.display = 'none';
                container.innerHTML = '';
                return;
            }

            let html = '';
            mainRecipes.forEach((recipe, index) => {
                html += `
                    <div class="form-group">
                        <label>${recipe.powder_name} 중량 (ton) *</label>
                        <select id="mainPowderWeight_${index}" class="main-powder-weight-select" data-powder-name="${recipe.powder_name}" required>
                            <option value="">선택하세요</option>
                            <option value="1000">1 ton (1,000 kg)</option>
                            <option value="2000">2 ton (2,000 kg)</option>
                            <option value="3000">3 ton (3,000 kg)</option>
                            <option value="4000">4 ton (4,000 kg)</option>
                            <option value="5000">5 ton (5,000 kg)</option>
                        </select>
                    </div>
                `;
            });

            // 합계 검증 메시지 영역
            if (mainRecipes.length > 1) {
                html += `
                    <div id="mainPowderWeightValidation" style="padding: 10px; margin-bottom: 10px; background: #fff3cd; border-radius: 5px; font-size: 0.9em;">
                        <strong>⚠️ 중요:</strong> Main 분말 중량의 합계가 배합중량과 일치해야 합니다.
                        <div id="mainPowderWeightSum" style="margin-top: 5px; font-weight: bold;"></div>
                    </div>
                `;
            }

            container.innerHTML = html;
            container.style.display = 'block';

            // Main 분말 중량 변경 시 이벤트 리스너 추가
            const weightSelects = container.querySelectorAll('.main-powder-weight-select');
            weightSelects.forEach(select => {
                select.addEventListener('change', () => {
                    updateMainPowderWeightValidation(mainRecipes);
                    if (currentRecipe) {
                        renderRecipePreview(currentRecipe);
                    }
                });
            });

            updateMainPowderWeightValidation(mainRecipes);
        }

        function updateMainPowderWeightValidation(mainRecipes) {
            if (!mainRecipes || mainRecipes.length <= 1) return;

            const blendingWeight = parseFloat(document.getElementById('blendingTargetWeight').value) || 0;
            let totalMainWeight = 0;
            let allSelected = true;

            mainRecipes.forEach((recipe, index) => {
                const select = document.getElementById(`mainPowderWeight_${index}`);
                const weight = select ? parseFloat(select.value) || 0 : 0;
                totalMainWeight += weight;
                if (!select || !select.value) {
                    allSelected = false;
                }
            });

            const sumDiv = document.getElementById('mainPowderWeightSum');
            if (sumDiv && blendingWeight > 0 && allSelected) {
                const isValid = totalMainWeight === blendingWeight;
                sumDiv.innerHTML = `
                    Main 분말 합계: ${formatNumber(totalMainWeight)} kg / 배합중량: ${formatNumber(blendingWeight)} kg
                    ${isValid ? '<span style="color: green;">✓ 일치</span>' : '<span style="color: red;">✗ 불일치</span>'}
                `;
                sumDiv.style.color = isValid ? 'green' : 'red';
            } else if (sumDiv) {
                sumDiv.innerHTML = '';
            }
        }

        // 목표 총 중량 변경 시 Recipe 미리보기 업데이트
        const blendingTargetWeightElement = document.getElementById('blendingTargetWeight');

        if (blendingTargetWeightElement) {

            blendingTargetWeightElement.addEventListener('change', () => {
            if (currentRecipe) {
                const mainRecipes = currentRecipe.filter(r => r.is_main);
                updateMainPowderWeightValidation(mainRecipes);
                renderRecipePreview(currentRecipe);
            }
        });
        }

        // 배합 작업 폼 제출
        const blendingFormElement = document.getElementById('blendingForm');

        if (blendingFormElement) {

            blendingFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const productName = document.getElementById('blendingProductName').value;
            const workOrder = document.getElementById('blendingWorkOrder').value;
            const batchLot = document.getElementById('blendingBatchLot').value;
            const targetWeight = document.getElementById('blendingTargetWeight').value;
            const operator = document.getElementById('blendingOperator').value;

            // 작업지시서 ID 가져오기 (있는 경우)
            const orderId = sessionStorage.getItem('blendingOrderId');

            if (!currentRecipe || currentRecipe.length === 0) {
                alert('제품을 선택하고 레시피를 확인해주세요.');
                return;
            }

            // Main 분말 중량은 작업지시서 화면에서 입력하지 않도록 변경됨.
            // 배합 작업 시작 후 원재료 투입 화면에서 Main 분말을 1~5 ton 중 선택할 수 있습니다.
            const mainRecipes = currentRecipe.filter(r => r.is_main);
            let mainPowderWeights = {};

            // 만약 start 화면에 값이 존재하면 전송(선택적)
            for (let i = 0; i < mainRecipes.length; i++) {
                const select = document.getElementById(`mainPowderWeight_${i}`);
                if (select && select.value) {
                    const weight = parseFloat(select.value);
                    if (!isNaN(weight)) mainPowderWeights[mainRecipes[i].powder_name] = weight;
                }
            }

            try {
                const requestBody = {
                    product_name: productName,
                    product_code: currentProductCode,
                    batch_lot: batchLot,
                    target_total_weight: parseFloat(targetWeight),
                    operator: operator,
                    main_powder_weights: mainPowderWeights  // Main 분말 중량 정보 추가
                };

                // 작업지시서 ID 추가 (있는 경우)
                if (orderId) {
                    requestBody.work_order_id = parseInt(orderId);
                }

                // 작업지시 번호 추가 (있는 경우)
                if (workOrder && !workOrder.includes('(자동)')) {
                    requestBody.work_order = workOrder;
                }

                const response = await fetch(`${API_BASE}/api/blending/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                const data = await response.json();

                if (data.success) {
                    alert(`배합 작업이 시작되었습니다.\n배합 LOT: ${data.batch_lot}`);
                    // 자동입력 페이지로 이동하면서 work_id 저장
                    sessionStorage.setItem('currentWorkId', data.work_id);
                    loadAutoInputPage(data.work_id, 'blending');
                } else {
                    alert('작업 시작 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        });
        }


        // 라벨 생성/렌더링: 우측 라벨 패널 제어 함수들
        function renderLabelPanel(work) {
            if (!work) return alert('라벨 정보를 불러올 수 없습니다.');

            const panel = document.getElementById('labelPanel');
            const list = document.getElementById('labelList');
            if (!panel || !list) return;

            // 초기화
            list.innerHTML = '';

            const targetWeight = Number(work.target_total_weight) || 0;
            const packSize = 1000; // 1 ton = 1000 kg
            const totalPacks = Math.max(1, Math.ceil(targetWeight / packSize));

            for (let i = 1; i <= totalPacks; i++) {
                const isLast = (i === totalPacks);
                // 마지막 pack의 중량은 잔여중량
                let packWeight = packSize;
                if (isLast && (targetWeight % packSize) !== 0) {
                    const remainder = targetWeight - Math.floor(targetWeight / packSize) * packSize;
                    if (remainder > 0) packWeight = remainder;
                }

                const labelDiv = document.createElement('div');
                labelDiv.style.width = '150mm';
                labelDiv.style.height = '108mm';
                labelDiv.style.boxSizing = 'border-box';
                labelDiv.style.background = 'white';
                labelDiv.style.border = '2px solid #000';
                labelDiv.style.display = 'flex';
                labelDiv.style.flexDirection = 'column';
                labelDiv.style.justifyContent = 'space-between';
                labelDiv.style.padding = '10px';
                labelDiv.style.borderRadius = '4px';
                labelDiv.style.position = 'relative';

                const company = 'Johnson Electric Operations';
                const product = work.product_name || '';
                const batchLot = work.batch_lot || '';

                const infoHtml = `
                    <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
                        <!-- 상단: 회사명 -->
                        <div style="display:flex; justify-content:flex-start; align-items:flex-start; width:100%;">
                            <div style="font-weight:700; font-size:18px; text-align:left;">${company}</div>
                        </div>

                        <!-- 중앙: 분말명 -->
                        <div style="display:flex; align-items:center; justify-content:center; width:100%; flex:1;">
                            <div style="font-weight:800; font-size:66px; text-align:center; line-height:1;">${product}</div>
                        </div>

                        <!-- 하단: LOT, QR코드, Pack, Weight -->
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; width:100%;">
                            <div style="font-size:28px; color:#000; font-weight:700;">Lot No : ${batchLot}</div>
                            <div id="label-qrcode-${i}" style="display:flex; justify-content:center; align-items:center; margin:4px 0;"></div>
                            <div style="font-size:18px; color:#000; font-weight:600; display:flex; gap:40px; justify-content:center; width:100%;">
                                <span>Net Weight : ${formatNumber(packWeight)}kg</span>
                                <span>Pack : ${i}/${totalPacks}</span>
                            </div>
                            <div style="display:flex; gap:6px; justify-content:center; width:100%; margin-top:4px;">
                                <button class="btn" onclick="printLabel(${i})">인쇄</button>
                            </div>
                        </div>
                    </div>
                `;

                labelDiv.innerHTML = infoHtml;
                list.appendChild(labelDiv);

                // QR코드 생성: 전체 텍스트 사용 (제품명-LOT번호)
                // 예: JEO.06.254-261224-001
                const qrcodeValue = `${product}-${batchLot}`;

                // render QR code into div (DOM 렌더링 후 실행)
                setTimeout(() => {
                    try {
                        const qrcodeEl = document.getElementById(`label-qrcode-${i}`);
                        if (qrcodeEl && typeof QRCode === 'function') {
                            // 기존 내용 초기화
                            qrcodeEl.innerHTML = '';

                            new QRCode(qrcodeEl, {
                                text: qrcodeValue,
                                width: 113,
                                height: 113,
                                colorDark: "#000000",
                                colorLight: "#ffffff",
                                correctLevel: QRCode.CorrectLevel.H // 높은 오류 정정 레벨 (30mm x 30mm)
                            });
                            console.log('QR코드 생성 성공:', qrcodeValue);
                        } else {
                            console.error('QRCode를 찾을 수 없거나 div 요소가 없습니다.', qrcodeEl);
                            if (qrcodeEl) {
                                qrcodeEl.innerHTML = `<div style="font-size:10px; text-align:center;">${qrcodeValue}</div>`;
                            }
                        }
                    } catch (err) {
                        console.error('QR코드 렌더링 오류:', err);
                    }
                }, 100);
            }

            // show panel
            panel.style.display = 'block';
            panel.setAttribute('aria-hidden', 'false');
        }

        function showBarcodePanel() {
            const panel = document.getElementById('labelPanel');
            if (panel) {
                panel.style.display = 'block';
                panel.setAttribute('aria-hidden', 'false');

                // 라벨이 비어있으면 생성
                const labelList = document.getElementById('labelList');
                if (labelList && labelList.children.length === 0) {
                    // 완료된 작업의 라벨 재생성
                    if (currentBlendingWork && currentBlendingWork.status === 'completed') {
                        renderLabelPanel(currentBlendingWork);
                    }
                }
            }
        }

        function hideLabelPanel() {
            const panel = document.getElementById('labelPanel');
            if (panel) {
                panel.style.display = 'none';
                panel.setAttribute('aria-hidden', 'true');
            }
        }

        function printLabel(index) {
            // 개별 라벨 인쇄: 해당 라벨 DOM을 복사하여 새 창에서 인쇄
            const list = document.getElementById('labelList');
            const labelEl = list && list.children && list.children[index - 1];
            if (!labelEl) return alert('라벨을 찾을 수 없습니다.');

            // QR코드 div 요소에서 데이터 가져오기
            const qrcodeDiv = labelEl.querySelector('div[id^="label-qrcode-"]');
            const qrcodeImg = qrcodeDiv ? qrcodeDiv.querySelector('img') : null;
            const qrcodeDataUrl = qrcodeImg ? qrcodeImg.src : null;

            const content = labelEl.innerHTML;
            const w = window.open('', '_blank');
            if (!w) return alert('팝업 차단을 확인하세요.');

            const html = `
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>라벨 인쇄</title>
                    <style>
                        body { margin:0; padding:0; }
                        .label { width:150mm; height:108mm; display:flex; align-items:center; justify-content:center; }
                        .label > div { border: 2px solid #000; }
                        @media print {
                            body * { visibility: visible; }
                            .label, .label * { visibility: visible; }
                        }
                    </style>
                </head>
                <body>
                    <div class="label">${content}</div>
                    <script>
                        window.onload = function() {
                            // QR코드는 이미 img로 렌더링되어 있으므로 추가 작업 불필요
                            setTimeout(function(){ window.print(); window.close(); }, 500);
                        };
                    <\/script>
                </body>
                </html>
            `;

            w.document.open();
            w.document.write(html);
            w.document.close();
        }

        function printAllLabels() {
            const list = document.getElementById('labelList');
            if (!list || !list.children || list.children.length === 0) return alert('출력할 라벨이 없습니다.');

            // 간단한 방식: 개별 라벨을 순차적으로 인쇄 (브라우저가 팝업 차단을 할 수 있음)
            for (let i = 0; i < list.children.length; i++) {
                // 약간의 지연을 주어 연속 팝업/인쇄가 처리되도록 함
                setTimeout(() => { printLabel(i + 1); }, i * 700);
            }
        }

        // ============================================
        // 배합작업 조회 (Blending Work Log)
        // ============================================

        async function loadMixingPowderListForFilter() {
            // 배합작업 현황 조회 필터용 배합분말 목록 로드
            try {
                const response = await fetch(`${API_BASE}/api/admin/powder-spec?category=mixing`);
                const data = await response.json();

                const select = document.getElementById('filterProductName');
                if (!select) return;

                // 기존 옵션 유지하고 분말 목록 추가
                const currentValue = select.value;
                select.innerHTML = '<option value="">전체</option>';

                if (data.success && data.specs) {
                    data.specs.forEach(spec => {
                        const option = document.createElement('option');
                        option.value = spec.powder_name;
                        option.textContent = spec.powder_name;
                        select.appendChild(option);
                    });
                }

                // 이전 선택값 복원
                if (currentValue) {
                    select.value = currentValue;
                }
            } catch (error) {
                console.error('배합분말 목록 로딩 실패:', error);
            }
        }

        async function loadBlendingWorks() {
            try {
                const statusFilterEl = document.getElementById('blendingLogStatusFilter');
                const statusFilter = statusFilterEl ? statusFilterEl.value : 'completed';
                const completedDateFrom = document.getElementById('filterCompletedDateFrom') ? document.getElementById('filterCompletedDateFrom').value : '';
                const completedDateTo = document.getElementById('filterCompletedDateTo') ? document.getElementById('filterCompletedDateTo').value : '';
                const productName = document.getElementById('filterProductName') ? document.getElementById('filterProductName').value.trim() : '';
                const batchLot = document.getElementById('filterBatchLot') ? document.getElementById('filterBatchLot').value.trim() : '';

                let url = `${API_BASE}/api/blending/works?status=${encodeURIComponent(statusFilter)}`;
                if (completedDateFrom) url += `&completed_date_from=${encodeURIComponent(completedDateFrom)}`;
                if (completedDateTo) url += `&completed_date_to=${encodeURIComponent(completedDateTo)}`;
                if (productName) url += `&product_name=${encodeURIComponent(productName)}`;
                if (batchLot) url += `&batch_lot=${encodeURIComponent(batchLot)}`;

                const response = await fetch(url);
                const data = await response.json();

                const tbody = document.getElementById('blendingWorksTableBody');
                if (!tbody) return;

                if (!data.success || !data.works || data.works.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" class="empty-message">배합작업 내역이 없습니다.</td></tr>';
                    return;
                }

                tbody.innerHTML = data.works.map(work => {
                    const statusClass = work.status === 'completed' ? 'completed' : 'in-progress';
                    const statusText = work.status === 'completed' ? '완료' : '진행중';
                    const startTime = work.start_time ? new Date(work.start_time).toLocaleString('ko-KR') : '-';
                    const endTime = work.end_time ? new Date(work.end_time).toLocaleString('ko-KR') : '-';

                    return `
                        <tr>
                            <td>${work.work_order}</td>
                            <td>${work.product_name}</td>
                            <td><strong>${work.batch_lot}</strong></td>
                            <td>${work.operator || '-'}</td>
                            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                            <td>${startTime}</td>
                            <td>${endTime}</td>
                            <td>
                                ${work.status === 'completed' ?
                                    `<div style="display: flex; gap: 5px;">
                                        <button class="btn" onclick="loadAutoInputPage(${work.id}, 'blending-log')" style="padding: 6px 12px; font-size: 0.9em; background:#2196F3; color:white; border:none; border-radius:4px;">
                                            입력현황
                                        </button>
                                        <button class="btn danger" onclick="deleteBlendingWork(${work.id}, '${work.batch_lot}')" style="padding: 6px 12px; font-size: 0.9em; background:#f44336; color:white; border:none; border-radius:4px;">
                                            삭제
                                        </button>
                                    </div>` :
                                    `<div style="display: flex; gap: 5px;">
                                        <button class="btn" onclick="continueBlendingWork(${work.id})" style="padding: 6px 12px; font-size: 0.9em; background:#2196F3; color:white; border:none; border-radius:4px;">
                                            작업 계속
                                        </button>
                                        <button class="btn danger" onclick="deleteBlendingWork(${work.id}, '${work.batch_lot}')" style="padding: 6px 12px; font-size: 0.9em; background:#f44336; color:white; border:none; border-radius:4px;">
                                            삭제
                                        </button>
                                    </div>`
                                }
                            </td>
                            <td style="text-align: center;">
                                ${work.status === 'completed' ?
                                    `<button class="btn" onclick="showBlendingBarcodeFromLog(${work.id})" style="padding: 8px 16px; font-size: 1.2em; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer;" title="바코드 출력">
                                        📊
                                    </button>` :
                                    '-'
                                }
                            </td>
                        </tr>
                    `;
                }).join('');

            } catch (error) {
                console.error('배합작업 목록 로딩 실패:', error);
                document.getElementById('blendingWorksTableBody').innerHTML =
                    '<tr><td colspan="9" class="empty-message">오류 발생: ' + error.message + '</td></tr>';
            }
        }

        function startBlendingInspection(batchLot, productName) {
            // 배합검사 페이지로 이동하면서 LOT 정보 전달
            sessionStorage.setItem('blendingInspectionLot', batchLot);
            sessionStorage.setItem('blendingInspectionProduct', productName);
            showPage('mixing');
        }

        function resetBlendingFilters() {
            const dateFromEl = document.getElementById('filterCompletedDateFrom');
            const dateToEl = document.getElementById('filterCompletedDateTo');
            const prodEl = document.getElementById('filterProductName');
            const lotEl = document.getElementById('filterBatchLot');
            const statusEl = document.getElementById('blendingLogStatusFilter');
            if (dateFromEl) dateFromEl.value = '';
            if (dateToEl) dateToEl.value = '';
            if (prodEl) prodEl.value = '';
            if (lotEl) lotEl.value = '';
            if (statusEl) statusEl.value = 'in_progress';
            loadBlendingWorks();
        }

        async function deleteBlendingWork(workId, batchLot) {
            // 관리자 비밀번호 확인
            const password = prompt(`배합 LOT "${batchLot}"를 삭제하시겠습니까?\n\n관리자 비밀번호를 입력하세요:`);

            if (!password) {
                return; // 취소
            }

            try {
                const response = await fetch(`${API_BASE}/api/blending/work/${workId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword: password })
                });

                const data = await response.json();

                if (data.success) {
                    alert('배합 작업이 삭제되었습니다.');
                    loadBlendingWorks(); // 목록 새로고침
                    loadInProgressBlendingWorks(); // 진행중인 배합작업 목록도 새로고침
                } else {
                    alert('삭제 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        function continueBlendingWork(workId) {
            // 진행중인 배합 작업을 이어서 진행 (자동입력 페이지로 이동)
            if (!workId) {
                alert('유효한 작업 ID가 필요합니다.');
                return;
            }
            loadAutoInputPage(workId, 'blending');
        }

        async function showBlendingBarcodeFromLog(workId) {
            // 배합작업조회에서 바코드 아이콘 클릭 시 - 기존 라벨 패널 재사용
            try {
                // API로 work 데이터 가져오기
                const response = await fetch(`${API_BASE}/api/blending/work/${workId}`);
                const data = await response.json();

                if (!data.success || !data.work) {
                    alert('작업 정보를 불러올 수 없습니다.');
                    return;
                }

                const work = data.work;

                // 공통 모달 함수 호출
                showBarcodeModal(work);
            } catch (error) {
                console.error('바코드 조회 실패:', error);
                alert('바코드를 불러오는 중 오류가 발생했습니다: ' + error.message);
            }
        }

        function showBarcodeModal(work) {
            // 바코드를 모달 형태로 가운데 표시 (원재료 투입 완료 & 배합작업조회 공통 사용)
            if (!work) {
                alert('작업 정보가 없습니다.');
                return;
            }

            // 기존 renderLabelPanel 함수로 라벨 생성
            renderLabelPanel(work);

            // 라벨 패널을 모달 형태로 표시
            const panel = document.getElementById('labelPanel');
            if (panel) {
                // 모달 배경 추가
                const modalBackdrop = document.createElement('div');
                modalBackdrop.id = 'barcodeModalBackdrop';
                modalBackdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center;';

                // 닫기 버튼 추가 (배경 클릭 시)
                modalBackdrop.onclick = function(e) {
                    if (e.target === modalBackdrop) {
                        closeBarcodeModal();
                    }
                };

                // 패널을 모달 안에 넣기
                document.body.appendChild(modalBackdrop);

                // 패널 스타일 조정 - 크기 키우기
                panel.style.position = 'fixed';
                panel.style.top = '50%';
                panel.style.left = '50%';
                panel.style.transform = 'translate(-50%, -50%)';
                panel.style.zIndex = '10000';
                panel.style.width = '90vw'; // 화면의 90% 너비
                panel.style.maxWidth = '1400px'; // 최대 1400px
                panel.style.maxHeight = '90vh'; // 화면의 90% 높이
                panel.style.overflowY = 'auto';
                panel.style.display = 'block';
                panel.style.background = 'white';
                panel.style.padding = '20px';
                panel.style.borderRadius = '10px';
                panel.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
                panel.setAttribute('aria-hidden', 'false');

                // 닫기 버튼이 없으면 추가
                if (!panel.querySelector('.modal-close-btn')) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'modal-close-btn';
                    closeBtn.innerHTML = '&times;';
                    closeBtn.style.cssText = 'position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 32px; cursor: pointer; color: #666; z-index: 10001; width: 40px; height: 40px;';
                    closeBtn.onclick = closeBarcodeModal;
                    panel.insertBefore(closeBtn, panel.firstChild);
                }
            }
        }

        function closeBarcodeModal() {
            // 모달 배경 제거
            const backdrop = document.getElementById('barcodeModalBackdrop');
            if (backdrop) {
                backdrop.remove();
            }

            // 패널 원래대로 복원
            const panel = document.getElementById('labelPanel');
            if (panel) {
                panel.style.position = '';
                panel.style.top = '';
                panel.style.left = '';
                panel.style.transform = '';
                panel.style.zIndex = '';
                panel.style.width = '';
                panel.style.maxWidth = '';
                panel.style.maxHeight = '';
                panel.style.overflowY = '';
                panel.style.background = '';
                panel.style.padding = '';
                panel.style.borderRadius = '';
                panel.style.boxShadow = '';
                panel.style.display = 'none';
                panel.setAttribute('aria-hidden', 'true');

                // 닫기 버튼 제거
                const closeBtn = panel.querySelector('.modal-close-btn');
                if (closeBtn) {
                    closeBtn.remove();
                }
            }
        }

        // ============================================
        // 추적성 조회 (Traceability)
        // ============================================

        // 추적성 조회용 제품명 목록 로드
        async function loadTraceabilityPowderList() {
            try {
                const selectEl = document.getElementById('traceabilityPowderName');
                if (!selectEl) return;

                // 기본 옵션만 남기고 초기화
                selectEl.innerHTML = '<option value="">선택 안함 (배합 LOT만 검색)</option>';

                // 1. 수입분말 목록 가져오기
                const powderResponse = await fetch(`${API_BASE}/api/powders`);
                const powderData = await powderResponse.json();

                if (powderData.success && powderData.powders) {
                    const incomingGroup = document.createElement('optgroup');
                    incomingGroup.label = '수입검사분말';

                    powderData.powders.forEach(powder => {
                        const option = document.createElement('option');
                        option.value = powder.powder_name;
                        option.textContent = powder.powder_name;
                        incomingGroup.appendChild(option);
                    });

                    if (incomingGroup.children.length > 0) {
                        selectEl.appendChild(incomingGroup);
                    }
                }

                // 2. 배합분말(제품) 목록 가져오기
                const productResponse = await fetch(`${API_BASE}/api/blending/products`);
                const productData = await productResponse.json();

                if (productData.success && productData.products) {
                    const blendingGroup = document.createElement('optgroup');
                    blendingGroup.label = '배합분말';

                    productData.products.forEach(product => {
                        const option = document.createElement('option');
                        option.value = product.product_name;
                        option.textContent = product.product_name;
                        blendingGroup.appendChild(option);
                    });

                    if (blendingGroup.children.length > 0) {
                        selectEl.appendChild(blendingGroup);
                    }
                }

            } catch (error) {
                console.error('제품명 목록 로드 실패:', error);
            }
        }

        const traceabilityFormElement = document.getElementById('traceabilityForm');


        if (traceabilityFormElement) {


            traceabilityFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const lotNumber = document.getElementById('traceabilityLotNumber').value.trim();
            const powderName = document.getElementById('traceabilityPowderName').value.trim();

            if (!lotNumber) {
                alert('LOT 번호를 입력하세요.');
                return;
            }

            try {
                // 1. 먼저 LOT 유형 확인
                let searchUrl = `${API_BASE}/api/traceability/search?lot_number=${encodeURIComponent(lotNumber)}`;
                if (powderName) {
                    searchUrl += `&powder_name=${encodeURIComponent(powderName)}`;
                }
                const searchResponse = await fetch(searchUrl);
                const searchData = await searchResponse.json();

                if (!searchData.success) {
                    document.getElementById('traceabilityResults').innerHTML = `
                        <div class="card">
                            <div class="empty-message">${searchData.message}</div>
                        </div>
                    `;
                    return;
                }

                // 2. LOT 유형에 따라 적절한 추적 수행
                const foundAs = searchData.found_as;

                if (foundAs.includes('batch_lot')) {
                    // 배합 LOT로 추적 (Backward Traceability)
                    await traceByBatchLot(lotNumber);
                } else if (foundAs.includes('material_lot')) {
                    // 원재료 LOT로 추적 (Forward Traceability)
                    await traceByMaterialLot(lotNumber, powderName);
                }

            } catch (error) {
                alert('오류: ' + error.message);
            }
        });
        }

        async function traceByBatchLot(batchLot) {
            try {
                const response = await fetch(`${API_BASE}/api/traceability/batch/${encodeURIComponent(batchLot)}`);
                const data = await response.json();

                if (!data.success) {
                    alert(data.message);
                    return;
                }

                renderBackwardTrace(data);
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        async function traceByMaterialLot(materialLot, powderName = '') {
            try {
                let apiUrl = `${API_BASE}/api/traceability/material/${encodeURIComponent(materialLot)}`;
                if (powderName) {
                    apiUrl += `?powder_name=${encodeURIComponent(powderName)}`;
                }
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (!data.success) {
                    alert(data.message);
                    return;
                }

                renderForwardTrace(data);
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        function renderBackwardTrace(data) {
            const container = document.getElementById('traceabilityResults');
            const work = data.blending_work;
            const materials = data.material_inputs;

            const statusBadge = work.status === 'completed'
                ? '<span class="badge pass">완료</span>'
                : '<span class="badge" style="background: #FF9800;">진행중</span>';

            let html = `
                <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-top: 20px;">
                    <h3 style="margin: 0 0 15px 0;">🔗 ${t('backwardTrace')}</h3>
                    <h2 style="margin: 0 0 20px 0;">${t('batchLotNumber')}: ${work.batch_lot}</h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">${t('productName')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${work.product_name}</p>
                        </div>
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">${t('workOrderNumber')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${work.work_order}</p>
                        </div>
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">${t('operator')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${work.operator}</p>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px;">
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">${t('targetTotalWeight')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${work.target_total_weight} kg</p>
                        </div>
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">${t('actualTotalWeight')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${work.actual_total_weight || '-'} kg</p>
                        </div>
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">상태</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${statusBadge}</p>
                        </div>
                    </div>
                </div>

                <div class="card" style="margin-top: 20px;">
                    <h3 style="margin: 0 0 15px 0;">📦 ${t('materialInputHistory')}</h3>
                    <p style="color: #666; margin-bottom: 20px;">${t('materialInputHistoryDesc')}</p>
            `;

            materials.forEach((material, index) => {
                const inspection = material.incoming_inspection;
                const isValid = material.is_valid;
                const validationBadge = isValid
                    ? '<span class="badge pass">정상</span>'
                    : '<span class="badge fail">허용오차 초과</span>';

                html += `
                    <div style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 20px; margin-bottom: 15px; background: #fafafa;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h4 style="margin: 0; font-size: 1.1em;">${index + 1}. ${material.powder_name}</h4>
                            ${validationBadge}
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 15px; background: white; padding: 15px; border-radius: 5px;">
                            <div>
                                <p style="color: #666; margin-bottom: 5px; font-size: 0.9em;">${t('materialLot')}</p>
                                <p style="font-weight: 600;">${material.material_lot}</p>
                            </div>
                            <div>
                                <p style="color: #666; margin-bottom: 5px; font-size: 0.9em;">${t('targetWeight')}</p>
                                <p style="font-weight: 600;">${material.target_weight} kg</p>
                            </div>
                            <div>
                                <p style="color: #666; margin-bottom: 5px; font-size: 0.9em;">${t('actualWeight')}</p>
                                <p style="font-weight: 600;">${material.actual_weight} kg</p>
                            </div>
                            <div>
                                <p style="color: #666; margin-bottom: 5px; font-size: 0.9em;">${t('weightDeviation')}</p>
                                <p style="font-weight: 600; ${isValid ? 'color: #4CAF50;' : 'color: #f44336;'}">${material.weight_deviation}%</p>
                            </div>
                        </div>

                        ${!isValid ? `<p style="color: #f44336; margin-bottom: 15px; font-weight: 600;">⚠️ ${material.validation_message}</p>` : ''}

                        ${inspection ? `
                            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196F3;">
                                <h5 style="margin: 0 0 10px 0; color: #1976D2;">✓ ${t('incomingInspection')}</h5>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    <div>
                                        <p style="color: #666; margin-bottom: 3px; font-size: 0.85em;">${t('inspector')}</p>
                                        <p style="font-weight: 600; font-size: 0.95em;">${inspection.inspector}</p>
                                    </div>
                                    <div>
                                        <p style="color: #666; margin-bottom: 3px; font-size: 0.85em;">${t('inspectionTime')}</p>
                                        <p style="font-weight: 600; font-size: 0.95em;">${inspection.inspection_time}</p>
                                    </div>
                                    <div>
                                        <p style="color: #666; margin-bottom: 3px; font-size: 0.85em;">${t('finalResult')}</p>
                                        <p style="font-weight: 600; font-size: 0.95em;">
                                            <span class="badge ${inspection.final_result === 'PASS' ? 'pass' : 'fail'}">${inspection.final_result}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ` : '<p style="color: #f44336;">⚠️ 수입검사 기록 없음</p>'}
                    </div>
                `;
            });

            html += '</div>';
            container.innerHTML = html;
        }

        function renderForwardTrace(data) {
            const container = document.getElementById('traceabilityResults');
            const inspection = data.incoming_inspection;
            const usages = data.used_in_batches;

            const inspectionBadge = inspection.final_result === 'PASS'
                ? '<span class="badge pass">합격</span>'
                : '<span class="badge fail">불합격</span>';

            let html = `
                <div class="card" style="background: linear-gradient(135deg, #2196F3 0%, #00BCD4 100%); color: white; margin-top: 20px;">
                    <h3 style="margin: 0 0 15px 0;">🔗 ${t('forwardTrace')}</h3>
                    <h2 style="margin: 0 0 20px 0;">${t('materialLot')}: ${inspection.lot_number}</h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">${t('powderName')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${inspection.powder_name}</p>
                        </div>
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">${t('inspector')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${inspection.inspector}</p>
                        </div>
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 5px;">${t('inspectionTime')}</p>
                            <p style="font-size: 1.2em; font-weight: 600;">${inspection.inspection_time}</p>
                        </div>
                    </div>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.3);">
                        <p style="opacity: 0.9; margin-bottom: 5px;">${t('finalResult')}</p>
                        <p style="font-size: 1.3em; font-weight: 600;">${inspectionBadge}</p>
                    </div>
                </div>

                <div class="card" style="margin-top: 20px;">
                    <h3 style="margin: 0 0 15px 0;">🏭 ${t('usageHistory')}</h3>
                    <p style="color: #666; margin-bottom: 20px;">${t('usageHistoryDesc')}</p>
            `;

            if (usages.length === 0) {
                html += `<div class="empty-message">${t('noUsageHistory')}</div>`;
            } else {
                html += '<table style="width: 100%;"><tr><th>배합 LOT</th><th>제품명</th><th>작업지시</th><th>투입 중량</th><th>중량 편차</th><th>상태</th><th>작업일시</th></tr>';

                usages.forEach(usage => {
                    const statusBadge = usage.status === 'completed'
                        ? '<span class="badge pass">완료</span>'
                        : '<span class="badge" style="background: #FF9800;">진행중</span>';

                    const isValid = usage.is_valid;
                    const validationBadge = isValid
                        ? '<span class="badge pass">정상</span>'
                        : '<span class="badge fail">허용오차 초과</span>';

                    html += `
                        <tr>
                            <td><strong>${usage.batch_lot}</strong></td>
                            <td>${usage.product_name}</td>
                            <td>${usage.work_order}</td>
                            <td>${usage.actual_weight} kg</td>
                            <td>${usage.weight_deviation}% ${validationBadge}</td>
                            <td>${statusBadge}</td>
                            <td>${usage.start_time}</td>
                        </tr>
                    `;
                });

                html += '</table>';
            }

            html += '</div>';
            container.innerHTML = html;
        }

        // ============================================
        // 배합작업지시서 (Blending Orders)
        // ============================================

        function loadBlendingOrdersPage() {
            // 제품 목록 로드 (작업지시서 생성용)
            loadOrderProductList();
            // 작업일자 기본값 설정 (오늘 날짜)
            const today = new Date().toISOString().split('T')[0];
            const orderDateInput = document.getElementById('orderDate');
            if (orderDateInput) {
                orderDateInput.value = today;
            }
            // 작업지시서 목록 로드
            loadBlendingOrders();
        }

        async function loadOrderProductList() {
            try {
                const response = await fetch(`${API_BASE}/api/blending/products`);
                const data = await response.json();

                const select = document.getElementById('orderProductName');
                if (!select) return;

                select.innerHTML = '<option value="">제품 선택</option>';

                if (data.success && data.data && data.data.length > 0) {
                    data.data.forEach(product => {
                        select.innerHTML += `<option value="${product.product_name}">${product.product_name}</option>`;
                    });
                } else {
                    select.innerHTML += '<option value="" disabled>등록된 배합 레시피가 없습니다</option>';
                }
            } catch (error) {
                console.error('제품 목록 로딩 실패:', error);
            }
        }

        // 작업지시서용 Recipe 로드 (제품 선택 시)
        async function loadOrderRecipe() {
            const productName = document.getElementById('orderProductName')?.value;
            if (!productName) return;

            // 필요시 Recipe 정보를 표시할 수 있음
            // 현재는 제품 선택만 처리
        }

        // 작업지시서 생성 폼 제출
        const orderFormElement = document.getElementById('blendingOrderForm');
        if (orderFormElement) {
            orderFormElement.addEventListener('submit', async (e) => {
                e.preventDefault();

                const productName = document.getElementById('orderProductName').value;
                const totalWeight = document.getElementById('orderTotalWeight').value;
                const createdBy = document.getElementById('orderCreatedBy').value;
                const workDate = document.getElementById('orderDate') ? document.getElementById('orderDate').value : null;

                if (!productName || !totalWeight) {
                    alert('제품명과 총 목표중량을 입력하세요.');
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE}/api/blending-orders`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            product_name: productName,
                            total_target_weight: parseFloat(totalWeight),
                            created_by: createdBy || '미지정',
                            work_date: workDate || null
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        alert(`✓ ${data.message}`);
                        // 폼 초기화
                        e.target.reset();
                        // 목록 새로고침
                        loadBlendingOrders();
                    } else {
                        alert('작업지시서 생성 실패: ' + data.message);
                    }
                } catch (error) {
                    alert('오류: ' + error.message);
                }
            });
        }

        async function loadBlendingOrders() {
            try {
                const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
                const dateFrom = document.getElementById('orderDateFrom')?.value || '';
                const dateTo = document.getElementById('orderDateTo')?.value || '';

                let url = `${API_BASE}/api/blending-orders?status=${statusFilter}`;
                if (dateFrom) url += `&date_from=${encodeURIComponent(dateFrom)}`;
                if (dateTo) url += `&date_to=${encodeURIComponent(dateTo)}`;

                const response = await fetch(url);
                const data = await response.json();

                const container = document.getElementById('blendingOrdersList');
                if (!container) return;

                if (!data.success || !data.orders || data.orders.length === 0) {
                    container.innerHTML = '<div class="empty-message">작업지시서가 없습니다.</div>';
                    return;
                }

                let html = `
                    <table class="data-table" style="width: 100%;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                <th style="padding: 15px; text-align: center;">생성일</th>
                                <th style="padding: 15px; text-align: center;">작업지시번호</th>
                                <th style="padding: 15px; text-align: center;">제품명</th>
                                <th style="padding: 15px; text-align: center;">총중량 (kg)</th>
                                <th style="padding: 15px; text-align: center;">진도율</th>
                                <th style="padding: 15px; text-align: center;">상태/액션</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                data.orders.forEach(order => {
                    const progressPercent = order.progress_percent || 0;
                    const isCompleted = order.status === 'completed' || progressPercent >= 100;

                    // 진도(톤 단위) UI
                    const progressBar = renderTonProgress(order.total_target_weight, order.completed_weight);

                    const rowBg = isCompleted ? '#f0f8f0' : '#ffffff';

                    html += `
                        <tr style="background: ${rowBg}; border-bottom: 2px solid #eee;">
                            <td style="padding: 15px; text-align: center;">
                                ${order.created_date}
                            </td>
                            <td style="padding: 15px; text-align: center;">
                                ${order.work_order_number}
                            </td>
                            <td style="padding: 15px; text-align: center; font-weight: 600; font-size: 1.1em;">
                                ${order.product_name}
                            </td>
                            <td style="padding: 15px; text-align: center; font-size: 1.1em; font-weight: 600;">
                                ${formatNumber(order.total_target_weight)} kg
                            </td>
                            <td style="padding: 15px;">
                                ${progressBar}
                            </td>
                            <td style="padding: 15px; text-align: center;">
                                ${isCompleted
                                    ? '<span style="background: #4CAF50; color: white; padding: 8px 16px; border-radius: 5px; font-weight: 600;">✓ 완료</span>'
                                    : `<button onclick="deleteBlendingOrder(${order.id})" class="btn danger" style="padding: 8px 12px; border-radius:4px;">삭제</button>`
                                }
                            </td>
                        </tr>
                    `;
                });

                html += '</tbody></table>';
                container.innerHTML = html;

            } catch (error) {
                console.error('작업지시서 목록 로딩 실패:', error);
                const container = document.getElementById('blendingOrdersList');
                if (container) {
                    container.innerHTML = '<div class="empty-message">작업지시서 목록을 불러올 수 없습니다.</div>';
                }
            }
        }

        function resetOrderFilters() {
            const statusEl = document.getElementById('orderStatusFilter');
            const dateFromEl = document.getElementById('orderDateFrom');
            const dateToEl = document.getElementById('orderDateTo');

            if (statusEl) statusEl.value = 'in_progress';
            if (dateFromEl) dateFromEl.value = '';
            if (dateToEl) dateToEl.value = '';

            loadBlendingOrders();
        }

        // 배합 페이지에서 작업 시작을 위해 간단히 작업지시서 목록을 렌더링
        async function loadBlendingOrdersForBlending() {
            try {
                const response = await fetch(`${API_BASE}/api/blending-orders?status=in_progress`);
                const data = await response.json();

                const container = document.getElementById('blendingOrdersForBlending');
                if (!container) return;

                if (!data.success || !data.orders || data.orders.length === 0) {
                    container.innerHTML = '<div class="empty-message">진행중인 작업지시서가 없습니다.</div>';
                    return;
                }

                let html = '<table class="data-table" style="width:100%"><thead><tr><th>생성일</th><th>작업지시번호</th><th>제품명</th><th>총중량</th><th>진도</th><th>작업</th></tr></thead><tbody>';

                data.orders.forEach(order => {
                    const created = order.created_date || '-';
                    const workNo = order.work_order_number || '-';
                    const prod = order.product_name || '-';
                    const total = order.total_target_weight ? formatNumber(order.total_target_weight) + ' kg' : '-';
                    const prog = order.progress_percent || 0;

                    const progCell = renderTonProgress(order.total_target_weight, order.completed_weight);

                    html += `
                        <tr>
                            <td>${created}</td>
                            <td>${workNo}</td>
                            <td>${prod}</td>
                            <td>${total}</td>
                            <td>${progCell}</td>
                            <td>
                                <button class="btn primary" onclick="startBlendingFromOrder(${order.id}, '${escapeHtml(order.product_name || '')}', '${escapeHtml(order.work_order_number || '')}')" style="padding:6px 10px;">
                                    작업시작하기
                                </button>
                            </td>
                        </tr>`;
                });

                html += '</tbody></table>';
                container.innerHTML = html;

            } catch (err) {
                console.error('blending orders for blending 로딩 실패:', err);
                const container = document.getElementById('blendingOrdersForBlending');
                if (container) container.innerHTML = '<div class="empty-message">작업지시서 목록을 불러올 수 없습니다.</div>';
            }
        }

        // 간단한 HTML 이스케이프 (문자열을 속성/텍스트로 안전하게 사용)
        function escapeHtml(str) {
            if (!str && str !== 0) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        // 작업지시서 삭제
        async function deleteBlendingOrder(orderId) {
            if (!confirm('정말 해당 작업지시서를 삭제하시겠습니까?')) return;
            try {
                const resp = await fetch(`${API_BASE}/api/blending-orders/${orderId}`, { method: 'DELETE' });
                const data = await resp.json();
                if (!data.success) {
                    alert('삭제 실패: ' + (data.message || '알 수 없는 오류'));
                    return;
                }
                // 삭제 성공 시 목록 새로고침
                loadBlendingOrdersPage();
            } catch (error) {
                console.error('작업지시서 삭제 실패:', error);
                alert('작업지시서 삭제 중 오류가 발생했습니다. 콘솔을 확인하세요.');
            }
        }

        async function startBlendingFromOrder(orderId, productName, workOrderNumber) {
            // 배합작업 페이지로 이동 후 폼 표시 및 채우기
            showPage('blending');

            try {
                const resp = await fetch(`${API_BASE}/api/blending-orders/${orderId}`);
                const data = await resp.json();
                if (!data.success) {
                    alert('작업지시서 정보를 불러오지 못했습니다: ' + (data.message || ''));
                    return;
                }

                const order = data.order;

                // 제품 선택
                const productSelect = document.getElementById('blendingProductName');
                if (productSelect) {
                    // 시도해서 옵션을 선택, 없으면 값으로 설정
                    let found = false;
                    for (let i = 0; i < productSelect.options.length; i++) {
                        if (productSelect.options[i].value === order.product_name) {
                            productSelect.selectedIndex = i;
                            found = true;
                            break;
                        }
                    }
                    if (!found) productSelect.value = order.product_name;

                    // 제품명을 작업지시서 기준으로 고정(선택 불가)
                    productSelect.disabled = true;
                    productSelect.setAttribute('data-fixed', 'true');
                    productSelect.style.background = '#f0f0f0';

                    // change 이벤트 트리거 및 Recipe 로드
                    productSelect.dispatchEvent(new Event('change', { bubbles: true }));

                    // 세션에 작업지시 정보 저장(다른 경로에서 입장 시 활용)
                    try {
                        sessionStorage.setItem('blendingOrderId', String(order.id));
                        sessionStorage.setItem('blendingOrderProduct', String(order.product_name));
                        sessionStorage.setItem('blendingOrderNumber', String(order.work_order_number || ''));
                    } catch (e) { /* noop */ }
                }

                // 작업지시번호
                const workOrderInput = document.getElementById('blendingWorkOrder');
                if (workOrderInput) {
                    workOrderInput.value = order.work_order_number || '';
                    workOrderInput.setAttribute('readonly', 'readonly');
                    workOrderInput.style.background = '#f0f0f0';
                }

                // 목표중량은 항상 기본값(선택하세요)으로 설정
                const targetSelect = document.getElementById('blendingTargetWeight');
                if (targetSelect) {
                    targetSelect.value = '';
                }

                // operator 비워두기 (사용자가 선택)
                const opSelect = document.getElementById('blendingOperator');
                if (opSelect) opSelect.value = '';

                // batch lot은 새로 생성
                await generateAndSetBatchLot();

                // 보이기
                showBlendingForm();
            } catch (err) {
                console.error(err);
                alert('작업지시서 불러오기 중 오류가 발생했습니다.');
            }
        }

        // 숫자 포맷팅 함수 (천단위 콤마)
        function formatNumber(num) {
            if (num === null || num === undefined || num === '') return '';
            return Number(num).toLocaleString('ko-KR');
        }

        // 소수 둘째 자리 포맷(예: 60 -> "60.00")
        function formatTwo(num) {
            if (num === null || num === undefined || num === '') return '';
            const n = parseFloat(num);
            if (isNaN(n)) return '';
            return n.toFixed(2);
        }

        // 바코드 스캔 값 파싱 함수
        // 입력: "0636260115001" (숫자만)
        // 출력: { productDigits: "0636", lot: "260115-001", productNumber: "06.36" }
        // QR코드 파싱 함수 (전체 텍스트 사용으로 더 이상 필요 없음)
        // 이전 바코드(숫자만) 사용 시 필요했던 함수들
        // function parseBarcodeValue(barcodeValue) { ... }
        // async function findProductByNumber(productNumber) { ... }

        // 진도(톤 단위) 시각화: 네모칸으로 표현 (정수톤 기준, 소수 단위 미표시)
        function renderTonProgress(totalKg, completedKg) {
            const totalTons = Math.max(0, Math.ceil(Number(totalKg || 0) / 1000)); // 총 톤은 올림(작업계획에서 남는 부분도 칸으로 표시)
            const completedTons = Math.max(0, Math.floor(Number(completedKg || 0) / 1000)); // 완료는 정수톤 단위로만 채움

            // 최소 1칸 보장
            const totalBoxesRaw = Math.max(1, totalTons);
            const MAX_BOXES = 50; // 너무 많은 칸은 생략(표시 최대)
            const totalBoxes = Math.min(totalBoxesRaw, MAX_BOXES);

            // 표시할 채워진 박스 수 (정수톤 기준, 제한 반영)
            const fullBoxes = Math.min(totalBoxes, completedTons);

            let boxesHtml = '<div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">';
            for (let i = 0; i < totalBoxes; i++) {
                if (i < fullBoxes) {
                    boxesHtml += '<div style="width:18px;height:18px;border-radius:3px;background:#4CAF50;border:1px solid #ccc;"></div>';
                } else {
                    boxesHtml += '<div style="width:18px;height:18px;border-radius:3px;border:1px solid #ccc;background:#fff;"></div>';
                }
            }
            boxesHtml += '</div>';

            // 남은 톤: 소수점 표시는 하지 않음(올림으로 표시하여 안전하게 남은량을 보여줌)
            const remainingTonsInt = Math.max(0, Math.ceil((Number(totalKg || 0) / 1000) - (Number(completedKg || 0) / 1000)));
            const remainingText = `<div style="font-size:0.95em;font-weight:600;margin-top:6px;">남은: ${remainingTonsInt} ton</div>`;
            const note = totalBoxesRaw > MAX_BOXES ? `<div style="font-size:0.8em;color:#888;margin-top:4px;">(총 ${totalTons} ton, 표시 ${totalBoxes}칸)</div>` : '';

            return `<div style="display:flex;flex-direction:column;align-items:flex-start;">${boxesHtml}${remainingText}${note}</div>`;
        }

        // ============================================
        // 대시보드 함수
        // ============================================

        // 차트 객체 저장
        let charts = {
            workProgress: null,
            qualityRate: null,
            dailyTrend: null,
            powderStatus: null
        };

        // 대시보드 로드 (현재 비활성화 - 빈 화면)
        async function loadDashboard() {
            // 대시보드가 빈 화면이므로 로딩 건너뜀
            return;
        }

        // KPI 카드 로드
        async function loadDashboardKPI() {
            try {
                const response = await fetch(`${API_BASE}/api/dashboard/kpi`);
                const data = await response.json();

                if (data.success) {
                    document.getElementById('kpiTodayInspections').textContent = data.data.today_inspections;
                    document.getElementById('kpiWorkProgress').textContent = data.data.work_progress;
                    document.getElementById('kpiPassRate').textContent = data.data.pass_rate;
                    document.getElementById('kpiFailCount').textContent = data.data.fail_count;
                }
            } catch (error) {
                console.error('KPI 로드 실패:', error);
            }
        }

        // 작업지시 진도율 차트
        async function loadWorkProgressChart(filter = 'week') {
            try {
                const response = await fetch(`${API_BASE}/api/dashboard/work-progress?filter=${filter}`);
                const data = await response.json();

                if (data.success && data.data.length > 0) {
                    const categories = data.data.map(item => item.work_order);
                    const progressData = data.data.map(item => item.progress);
                    const targetData = data.data.map(item => item.target);
                    const completedData = data.data.map(item => item.completed);

                    const options = {
                        series: [{
                            name: '진도율',
                            data: progressData
                        }],
                        chart: {
                            type: 'bar',
                            height: 350,
                            toolbar: { show: false }
                        },
                        plotOptions: {
                            bar: {
                                horizontal: true,
                                borderRadius: 8,
                                dataLabels: {
                                    position: 'top'
                                }
                            }
                        },
                        dataLabels: {
                            enabled: true,
                            formatter: function (val) {
                                return val.toFixed(1) + '%';
                            },
                            offsetX: -10,
                            style: {
                                fontSize: '12px',
                                colors: ['#fff']
                            }
                        },
                        colors: ['#9C27B0'],
                        xaxis: {
                            categories: categories,
                            max: 100,
                            labels: {
                                formatter: function (val) {
                                    return val + '%';
                                }
                            }
                        },
                        yaxis: {
                            labels: {
                                style: {
                                    fontSize: '11px'
                                }
                            }
                        },
                        tooltip: {
                            custom: function({series, seriesIndex, dataPointIndex, w}) {
                                const target = targetData[dataPointIndex];
                                const completed = completedData[dataPointIndex];
                                const progress = progressData[dataPointIndex];
                                return `<div style="padding: 10px;">
                                    <strong>${categories[dataPointIndex]}</strong><br/>
                                    목표: ${target.toLocaleString()} kg<br/>
                                    완료: ${completed.toLocaleString()} kg<br/>
                                    진도율: ${progress.toFixed(1)}%
                                </div>`;
                            }
                        },
                        grid: {
                            borderColor: '#f1f1f1'
                        }
                    };

                    if (charts.workProgress) {
                        charts.workProgress.destroy();
                    }
                    charts.workProgress = new ApexCharts(document.querySelector("#chartWorkProgress"), options);
                    charts.workProgress.render();
                } else {
                    document.getElementById('chartWorkProgress').innerHTML =
                        '<div style="text-align:center;padding:50px;color:#999;">작업지시 데이터가 없습니다</div>';
                }
            } catch (error) {
                console.error('작업진도율 차트 로드 실패:', error);
            }
        }

        // 합격률 도넛 차트
        async function loadQualityRateChart() {
            try {
                const response = await fetch(`${API_BASE}/api/dashboard/quality-rate`);
                const data = await response.json();

                if (data.success) {
                    const passed = data.data.passed;
                    const failed = data.data.failed;
                    const inProgress = data.data.in_progress;

                    // 범례 업데이트
                    document.getElementById('legendPassCount').textContent = passed;
                    document.getElementById('legendFailCount').textContent = failed;
                    document.getElementById('legendInProgressCount').textContent = inProgress;

                    const options = {
                        series: [passed, failed, inProgress],
                        labels: ['합격', '불합격', '진행중'],
                        chart: {
                            type: 'donut',
                            height: 300
                        },
                        colors: ['#4CAF50', '#F44336', '#FFC107'],
                        dataLabels: {
                            enabled: true,
                            formatter: function (val, opts) {
                                return opts.w.config.series[opts.seriesIndex];
                            }
                        },
                        legend: {
                            show: false
                        },
                        plotOptions: {
                            pie: {
                                donut: {
                                    size: '65%',
                                    labels: {
                                        show: true,
                                        total: {
                                            show: true,
                                            label: '총 검사',
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            formatter: function (w) {
                                                return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    };

                    if (charts.qualityRate) {
                        charts.qualityRate.destroy();
                    }
                    charts.qualityRate = new ApexCharts(document.querySelector("#chartQualityRate"), options);
                    charts.qualityRate.render();
                }
            } catch (error) {
                console.error('합격률 차트 로드 실패:', error);
            }
        }

        // 일별 검사 추이 차트
        async function loadDailyTrendChart() {
            try {
                const response = await fetch(`${API_BASE}/api/dashboard/daily-trend`);
                const data = await response.json();

                if (data.success) {
                    const dates = data.data.map(item => {
                        const date = new Date(item.date);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                    });
                    const incomingData = data.data.map(item => item.incoming);
                    const mixingData = data.data.map(item => item.mixing);

                    const options = {
                        series: [{
                            name: '수입분말',
                            data: incomingData
                        }, {
                            name: '배합분말',
                            data: mixingData
                        }],
                        chart: {
                            type: 'line',
                            height: 300,
                            toolbar: { show: false }
                        },
                        colors: ['#2196F3', '#9C27B0'],
                        stroke: {
                            width: 3,
                            curve: 'smooth'
                        },
                        dataLabels: {
                            enabled: false
                        },
                        xaxis: {
                            categories: dates
                        },
                        yaxis: {
                            title: {
                                text: '검사 건수'
                            }
                        },
                        legend: {
                            position: 'top',
                            horizontalAlign: 'right'
                        },
                        grid: {
                            borderColor: '#f1f1f1'
                        },
                        markers: {
                            size: 4,
                            strokeWidth: 0,
                            hover: {
                                size: 7
                            }
                        }
                    };

                    if (charts.dailyTrend) {
                        charts.dailyTrend.destroy();
                    }
                    charts.dailyTrend = new ApexCharts(document.querySelector("#chartDailyTrend"), options);
                    charts.dailyTrend.render();
                }
            } catch (error) {
                console.error('일별 추이 차트 로드 실패:', error);
            }
        }

        // 분말별 검사 현황 차트
        async function loadPowderStatusChart() {
            try {
                const response = await fetch(`${API_BASE}/api/dashboard/powder-status`);
                const data = await response.json();

                if (data.success && data.data.length > 0) {
                    const categories = data.data.map(item => item.powder);
                    const passedData = data.data.map(item => item.passed);
                    const failedData = data.data.map(item => item.failed);

                    const options = {
                        series: [{
                            name: '합격',
                            data: passedData
                        }, {
                            name: '불합격',
                            data: failedData
                        }],
                        chart: {
                            type: 'bar',
                            height: 300,
                            stacked: true,
                            toolbar: { show: false }
                        },
                        colors: ['#4CAF50', '#F44336'],
                        plotOptions: {
                            bar: {
                                horizontal: true,
                                borderRadius: 6
                            }
                        },
                        dataLabels: {
                            enabled: true
                        },
                        xaxis: {
                            categories: categories
                        },
                        yaxis: {
                            labels: {
                                style: {
                                    fontSize: '11px'
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                            horizontalAlign: 'right'
                        },
                        grid: {
                            borderColor: '#f1f1f1'
                        }
                    };

                    if (charts.powderStatus) {
                        charts.powderStatus.destroy();
                    }
                    charts.powderStatus = new ApexCharts(document.querySelector("#chartPowderStatus"), options);
                    charts.powderStatus.render();
                } else {
                    document.getElementById('chartPowderStatus').innerHTML =
                        '<div style="text-align:center;padding:50px;color:#999;">검사 데이터가 없습니다</div>';
                }
            } catch (error) {
                console.error('분말별 현황 차트 로드 실패:', error);
            }
        }

        // 진도율 필터 변경 이벤트
        document.addEventListener('DOMContentLoaded', function() {
            const progressFilter = document.getElementById('progressDateFilter');
            if (progressFilter) {
                progressFilter.addEventListener('change', function() {
                    loadWorkProgressChart(this.value);
                });
            }
        });

        // ==========================================
        // 자동입력 작업 화면 관련 함수
        // ==========================================

        // work_id로 자동입력 페이지 로드 (DB 연동)
        let currentAutoInputWorkId = null;
        let currentAutoInputWork = null;
        let currentAutoInputRecipes = [];

        async function loadAutoInputPage(workId, sourcePage = 'blending') {
            try {
                // 캐시 초기화
                approvedLotsCache = {};
                lotRowCounters = {};

                // DB에서 배합작업 정보 가져오기
                const response = await fetch(`${API_BASE}/api/blending/work/${workId}`);
                const data = await response.json();

                if (!data.success) {
                    alert('배합 작업 로딩 실패: ' + data.message);
                    return;
                }

                currentAutoInputWorkId = workId;
                currentAutoInputWork = data.work;
                currentAutoInputRecipes = data.recipes;

                // 자동입력 페이지로 이동
                showPage('auto-input');

                // 작업 정보 표시
                document.getElementById('autoInputProductName').textContent = data.work.product_name;
                document.getElementById('autoInputBatchLot').textContent = data.work.batch_lot;
                document.getElementById('autoInputTargetWeight').textContent = parseFloat(data.work.target_total_weight).toLocaleString();

                // 원재료 목록 렌더링
                await renderAutoInputMaterialListFromDB(data.work, data.recipes, data.material_inputs || []);
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // 자동입력 모드 시작 (구버전 - 사용 안 함)
        async function startAutoInputMode() {
            // 배합작업 폼 검증
            const productName = document.getElementById('blendingProductName').value;
            const batchLot = document.getElementById('blendingBatchLot').value;
            const targetWeight = document.getElementById('blendingTargetWeight').value;
            const operator = document.getElementById('blendingOperator').value;

            if (!productName || !batchLot || !targetWeight || !operator) {
                alert('배합작업 정보를 먼저 입력해주세요.\n(제품명, 배합 LOT, 배합중량, 작업자)');
                return;
            }

            // Recipe 확인
            if (!currentRecipe || currentRecipe.length === 0) {
                alert('제품의 Recipe 정보가 없습니다.');
                return;
            }

            // 자동입력 페이지로 이동
            showPage('auto-input');

            // 작업 정보 표시
            document.getElementById('autoInputProductName').textContent = productName;
            document.getElementById('autoInputBatchLot').textContent = batchLot;
            document.getElementById('autoInputTargetWeight').textContent = parseFloat(targetWeight).toLocaleString();

            // 원재료 목록 렌더링
            await renderAutoInputMaterialList();
        }

        // DB에서 가져온 데이터로 자동입력 원재료 목록 렌더링
        async function renderAutoInputMaterialListFromDB(work, recipes, materialInputs) {
            const listContainer = document.getElementById('autoInputMaterialList');
            const targetWeight = parseFloat(work.target_total_weight);

            if (!recipes || recipes.length === 0) {
                listContainer.innerHTML = '<div class="empty-message">Recipe 정보가 없습니다.</div>';
                return;
            }

            // Main 분말 중량 정보 가져오기
            const mainWeights = {};
            recipes.forEach(item => {
                if (item.is_main == 1 || item.is_main === true) {
                    // work.main_powder_weights가 있으면 사용, 없으면 targetWeight를 Main 중량으로 사용
                    if (work.main_powder_weights && work.main_powder_weights[item.powder_name]) {
                        mainWeights[item.powder_name] = parseFloat(work.main_powder_weights[item.powder_name]);
                    } else {
                        mainWeights[item.powder_name] = targetWeight;
                    }
                }
            });

            // Main 분말들의 비율 합계 계산
            const mainRecipes = recipes.filter(r => r.is_main == 1 || r.is_main === true);
            const totalMainRatio = mainRecipes.reduce((sum, r) => sum + r.ratio, 0);

            // 전체 배합 총중량 계산: Main 중량 / (Main 비율 / 100)
            // 예: Main 2000kg, 비율 97.2% → 전체 = 2000 / 0.972 = 2057.61kg
            const mainTotalWeight = Object.values(mainWeights).reduce((sum, w) => sum + w, 0);
            const actualTotalWeight = totalMainRatio > 0 ? mainTotalWeight / (totalMainRatio / 100) : targetWeight;

            // 각 분말의 필요 중량 계산
            const materials = recipes.map((item, index) => {
                let calculatedWeight = 0;

                if (item.is_main == 1 || item.is_main === true) {
                    // Main 분말: 저장된 중량 또는 targetWeight 사용
                    calculatedWeight = mainWeights[item.powder_name] || targetWeight;
                } else {
                    // 첨가분말: 전체 총중량 × 비율로 계산
                    calculatedWeight = actualTotalWeight * item.ratio / 100;
                }

                // 허용 오차 범위 계산
                const tolerance = item.tolerance_percent !== undefined && item.tolerance_percent !== null ? item.tolerance_percent : 5;
                const minWeight = calculatedWeight * (1 - tolerance / 100);
                const maxWeight = calculatedWeight * (1 + tolerance / 100);

                return {
                    index: index,
                    powderName: item.powder_name,
                    ratio: item.ratio,
                    calculatedWeight: calculatedWeight.toFixed(2),
                    minWeight: minWeight,  // 정밀도 유지를 위해 toFixed 제거
                    maxWeight: maxWeight,  // 정밀도 유지를 위해 toFixed 제거
                    tolerance: tolerance,
                    category: item.powder_category,
                    isMain: item.is_main == 1 || item.is_main === true
                };
            });

            // 진행 상황 업데이트
            document.getElementById('autoInputProgress').textContent = `0/${materials.length}`;

            // HTML 생성
            let html = '';
            materials.forEach((material, idx) => {
                const rowClass = idx === 0 ? 'material-input-row active' : 'material-input-row';
                const statusBadge = idx === 0 ? '<span class="status-badge active">진행중</span>' : '<span class="status-badge waiting">대기</span>';

                html += `
                    <div class="${rowClass}" id="materialRow_${idx}" data-index="${idx}"
                         data-min-weight="${material.minWeight}"
                         data-max-weight="${material.maxWeight}"
                         data-tolerance="${material.tolerance}"
                         data-is-main="${material.isMain}"
                         data-powder-name="${material.powderName}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <h4 style="margin: 0 0 5px 0; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 1.3em; font-weight: 700; color: #333;">${material.powderName}</span>
                                    ${material.isMain ? '<span style="background: #2196F3; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600;">MAIN</span>' : ''}
                                    ${statusBadge}
                                </h4>
                                <p style="margin: 0; color: #666; font-size: 0.9em;">
                                    비율: ${material.ratio}% |
                                    목표 중량: ${material.isMain ? parseFloat(material.calculatedWeight).toLocaleString() + ' kg' : Math.round(parseFloat(material.calculatedWeight) * 1000).toLocaleString() + ' g'} |
                                    허용오차: ±${material.tolerance}%
                                </p>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button type="button" class="btn secondary" onclick="addLotRow(${idx})"
                                        id="addLotBtn_${idx}" ${idx !== 0 ? 'disabled' : ''}
                                        style="padding: 8px 16px; font-size: 0.9em;">
                                    ➕ LOT 추가
                                </button>
                                <button type="button" class="btn" onclick="activateMaterialRow(${idx})"
                                        id="activateBtn_${idx}" style="${idx === 0 ? 'display:none;' : ''}">
                                    작업 시작
                                </button>
                            </div>
                        </div>

                        <!-- LOT 입력 테이블 -->
                        <div style="background: #fafafa; border-radius: 8px; padding: 15px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #e0e0e0;">
                                        <th style="padding: 10px; text-align: left; width: 40%;">📱 LOT 번호</th>
                                        <th style="padding: 10px; text-align: center; width: 40%;">⚖️ 계량 중량 (${material.isMain ? 'kg' : 'g'})</th>
                                        <th style="padding: 10px; text-align: center; width: 20%;">작업</th>
                                    </tr>
                                </thead>
                                <tbody id="lotTableBody_${idx}">
                                    <!-- LOT 행들이 여기에 추가됨 -->
                                </tbody>
                            </table>

                            <!-- 합계 및 판정 영역 -->
                            <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 8px; border: 2px solid #2196F3;">
                                <div style="display: grid; grid-template-columns: 1fr auto 1fr 1fr; gap: 15px; align-items: center;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 0.85em; color: #666; margin-bottom: 5px;">합계 중량</div>
                                        <div style="font-size: 1.2em; font-weight: 700; color: #333;">
                                            <span id="totalWeight_${idx}">0</span> ${material.isMain ? 'kg' : 'g'}
                                        </div>
                                    </div>

                                    <!-- 허용 중량 범위 -->
                                    <div style="padding: 10px 15px; background: #f0f7ff; border: 2px solid #2196F3; border-radius: 8px; text-align: center; min-width: 180px;">
                                        <div style="font-size: 0.75em; color: #666; margin-bottom: 5px;">허용 중량 범위</div>
                                        <div style="font-weight: 700; color: #2196F3; font-size: 1.1em; line-height: 1.3;">
                                            ${material.isMain ? parseFloat(material.minWeight).toFixed(2) + ' ~ ' + parseFloat(material.maxWeight).toFixed(2) + ' kg' : Math.floor(parseFloat(material.minWeight) * 1000).toLocaleString() + ' ~ ' + Math.ceil(parseFloat(material.maxWeight) * 1000).toLocaleString() + ' g'}
                                        </div>
                                    </div>

                                    <!-- 판정 버튼 -->
                                    <div style="display: flex; gap: 10px; align-items: center;">
                                        <button type="button"
                                                class="btn"
                                                onclick="judgeMaterialWeight(${idx})"
                                                id="judgeBtn_${idx}"
                                                disabled
                                                style="padding: 10px 16px; font-size: 0.95em; background: #FF9800; color: white; border: none; min-width: 80px; opacity: 0.5;">
                                            🔍 판정
                                        </button>
                                        <div id="judgeResult_${idx}" style="font-weight: 700; font-size: 1em; min-width: 70px; text-align: center;">
                                        </div>
                                    </div>

                                    <!-- 완료 버튼 -->
                                    <div>
                                        <button type="button" class="btn" onclick="completeAutoInputMaterial(${idx})"
                                                id="completeMaterialBtn_${idx}" disabled style="opacity: 0.5; width: 100%;">
                                            ✓ 이 분말 투입 완료
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            listContainer.innerHTML = html;

            // materialInputs 처리: 이미 투입 완료된 분말 복원
            const completedMaterials = new Map();
            if (materialInputs && materialInputs.length > 0) {
                materialInputs.forEach(input => {
                    completedMaterials.set(input.powder_name, {
                        lots: input.material_lot.split(',').map(lot => lot.trim()),
                        weight: input.actual_weight
                    });
                });
            }

            let firstIncompleteIndex = -1;
            let completedCount = 0;

            // 각 분말에 대해 완료 상태 복원
            materials.forEach((material, idx) => {
                const materialRow = document.getElementById(`materialRow_${idx}`);
                const completedData = completedMaterials.get(material.powderName);

                if (completedData) {
                    // 완료된 분말: 데이터 복원 및 비활성화
                    completedCount++;

                    // 상태 변경
                    materialRow.classList.remove('active');
                    const statusBadge = materialRow.querySelector('.status-badge');
                    statusBadge.className = 'status-badge completed';
                    statusBadge.textContent = '완료';

                    // LOT 정보 표시 (읽기 전용)
                    const tableBody = document.getElementById(`lotTableBody_${idx}`);
                    const isMain = material.isMain;

                    completedData.lots.forEach((lotNumber, lotIdx) => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td style="padding: 10px;">
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <input type="text" value="${lotNumber}" readonly
                                           style="flex: 1; padding: 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px;">
                                    <div style="min-width: 60px; font-weight: 600; font-size: 0.9em; color: #4CAF50;">✓ 합격</div>
                                </div>
                            </td>
                            <td style="padding: 10px;">
                                <input type="text" value="${isMain && completedData.lots.length === 1 ? (completedData.weight).toLocaleString() : ''}" readonly
                                       style="width: 100%; padding: 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; text-align: center;">
                            </td>
                            <td style="padding: 10px; text-align: center;">
                                <span style="color: #999;">-</span>
                            </td>
                        `;
                        tableBody.appendChild(row);
                    });

                    // 합계 중량 표시 (Main은 kg, 첨가분말은 g)
                    const displayWeight = material.isMain ? completedData.weight.toFixed(2) : Math.round(completedData.weight * 1000).toLocaleString();
                    document.getElementById(`totalWeight_${idx}`).textContent = displayWeight;

                    // 판정 결과 표시
                    const judgeResult = document.getElementById(`judgeResult_${idx}`);
                    judgeResult.innerHTML = '<span style="color: #4CAF50; font-size: 1.1em;">⭕ 합격</span>';
                    judgeResult.dataset.result = 'pass';

                    // 버튼 비활성화
                    document.getElementById(`addLotBtn_${idx}`).disabled = true;
                    document.getElementById(`judgeBtn_${idx}`).disabled = true;
                    document.getElementById(`completeMaterialBtn_${idx}`).disabled = true;
                    const activateBtn = document.getElementById(`activateBtn_${idx}`);
                    if (activateBtn) activateBtn.style.display = 'none';
                } else {
                    // 미완료 분말: 첫 번째 미완료 분말 기록
                    if (firstIncompleteIndex === -1) {
                        firstIncompleteIndex = idx;
                    }
                }
            });

            // 진행 상황 업데이트
            document.getElementById('autoInputProgress').textContent = `${completedCount}/${materials.length}`;

            // 첫 번째 미완료 분말 활성화
            if (firstIncompleteIndex !== -1) {
                setTimeout(() => {
                    activateMaterialRow(firstIncompleteIndex);
                }, 100);
            }
        }

        // 자동입력 원재료 목록 렌더링 (구버전 - 사용 안 함)
        async function renderAutoInputMaterialList() {
            const listContainer = document.getElementById('autoInputMaterialList');
            const targetWeight = parseFloat(document.getElementById('blendingTargetWeight').value);

            if (!currentRecipe || currentRecipe.length === 0) {
                listContainer.innerHTML = '<div class="empty-message">Recipe 정보가 없습니다.</div>';
                return;
            }

            // Main 분말 중량 정보 가져오기
            const mainWeights = {};
            currentRecipe.forEach(item => {
                if (item.powder_category === 'main') {
                    const weightInput = document.getElementById(`mainWeight_${item.powder_name}`);
                    if (weightInput) {
                        mainWeights[item.powder_name] = parseFloat(weightInput.value) || 0;
                    }
                }
            });

            // 각 분말의 필요 중량 계산
            const materials = currentRecipe.map((item, index) => {
                let calculatedWeight = 0;

                if (item.powder_category === 'main') {
                    // Main은 직접 입력한 중량 사용
                    calculatedWeight = mainWeights[item.powder_name] || (targetWeight * item.ratio / 100);
                } else {
                    // Main 외 분말은 비율로 계산
                    calculatedWeight = targetWeight * item.ratio / 100;
                }

                // 허용 오차 범위 계산
                const tolerance = item.tolerance_percent !== undefined && item.tolerance_percent !== null ? item.tolerance_percent : 5;
                const minWeight = calculatedWeight * (1 - tolerance / 100);
                const maxWeight = calculatedWeight * (1 + tolerance / 100);

                return {
                    index: index,
                    powderName: item.powder_name,
                    ratio: item.ratio,
                    calculatedWeight: calculatedWeight.toFixed(2),
                    minWeight: minWeight,  // 정밀도 유지를 위해 toFixed 제거
                    maxWeight: maxWeight,  // 정밀도 유지를 위해 toFixed 제거
                    tolerance: tolerance,
                    category: item.powder_category,
                    isMain: item.powder_category === 'main'
                };
            });

            // 진행 상황 업데이트
            document.getElementById('autoInputProgress').textContent = `0/${materials.length}`;

            // HTML 생성
            let html = '';
            materials.forEach((material, idx) => {
                const rowClass = idx === 0 ? 'material-input-row active' : 'material-input-row';
                const statusBadge = idx === 0 ? '<span class="status-badge active">진행중</span>' : '<span class="status-badge waiting">대기</span>';

                html += `
                    <div class="${rowClass}" id="materialRow_${idx}" data-index="${idx}"
                         data-min-weight="${material.minWeight}"
                         data-max-weight="${material.maxWeight}"
                         data-tolerance="${material.tolerance}"
                         data-is-main="${material.isMain}"
                         data-powder-name="${material.powderName}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <h4 style="margin: 0 0 5px 0; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 1.3em; font-weight: 700; color: #333;">${material.powderName}</span>
                                    ${material.isMain ? '<span style="background: #2196F3; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600;">MAIN</span>' : ''}
                                    ${statusBadge}
                                </h4>
                                <p style="margin: 0; color: #666; font-size: 0.9em;">
                                    비율: ${material.ratio}% |
                                    목표 중량: ${material.isMain ? parseFloat(material.calculatedWeight).toLocaleString() + ' kg' : Math.round(parseFloat(material.calculatedWeight) * 1000).toLocaleString() + ' g'} |
                                    허용오차: ±${material.tolerance}%
                                </p>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button type="button" class="btn secondary" onclick="addLotRow(${idx})"
                                        id="addLotBtn_${idx}" ${idx !== 0 ? 'disabled' : ''}
                                        style="padding: 8px 16px; font-size: 0.9em;">
                                    ➕ LOT 추가
                                </button>
                                <button type="button" class="btn" onclick="activateMaterialRow(${idx})"
                                        id="activateBtn_${idx}" style="${idx === 0 ? 'display:none;' : ''}">
                                    작업 시작
                                </button>
                            </div>
                        </div>

                        <!-- LOT 입력 테이블 -->
                        <div style="background: #fafafa; border-radius: 8px; padding: 15px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #e0e0e0;">
                                        <th style="padding: 10px; text-align: left; width: 40%;">📱 LOT 번호</th>
                                        <th style="padding: 10px; text-align: center; width: 40%;">⚖️ 계량 중량 (${material.isMain ? 'kg' : 'g'})</th>
                                        <th style="padding: 10px; text-align: center; width: 20%;">작업</th>
                                    </tr>
                                </thead>
                                <tbody id="lotTableBody_${idx}">
                                    <!-- LOT 행들이 여기에 추가됨 -->
                                </tbody>
                            </table>

                            <!-- 합계 및 판정 영역 -->
                            <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 8px; border: 2px solid #2196F3;">
                                <div style="display: grid; grid-template-columns: 1fr auto 1fr 1fr; gap: 15px; align-items: center;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 0.85em; color: #666; margin-bottom: 5px;">합계 중량</div>
                                        <div style="font-size: 1.2em; font-weight: 700; color: #333;">
                                            <span id="totalWeight_${idx}">0</span> ${material.isMain ? 'kg' : 'g'}
                                        </div>
                                    </div>

                                    <!-- 허용 중량 범위 -->
                                    <div style="padding: 10px 15px; background: #f0f7ff; border: 2px solid #2196F3; border-radius: 8px; text-align: center; min-width: 180px;">
                                        <div style="font-size: 0.75em; color: #666; margin-bottom: 5px;">허용 중량 범위</div>
                                        <div style="font-weight: 700; color: #2196F3; font-size: 1.1em; line-height: 1.3;">
                                            ${material.isMain ? parseFloat(material.minWeight).toFixed(2) + ' ~ ' + parseFloat(material.maxWeight).toFixed(2) + ' kg' : Math.floor(parseFloat(material.minWeight) * 1000).toLocaleString() + ' ~ ' + Math.ceil(parseFloat(material.maxWeight) * 1000).toLocaleString() + ' g'}
                                        </div>
                                    </div>

                                    <!-- 판정 버튼 -->
                                    <div style="display: flex; gap: 10px; align-items: center;">
                                        <button type="button"
                                                class="btn"
                                                onclick="judgeMaterialWeight(${idx})"
                                                id="judgeBtn_${idx}"
                                                disabled
                                                style="padding: 10px 16px; font-size: 0.95em; background: #FF9800; color: white; border: none; min-width: 80px; opacity: 0.5;">
                                            🔍 판정
                                        </button>
                                        <div id="judgeResult_${idx}" style="font-weight: 700; font-size: 1em; min-width: 70px; text-align: center;">
                                        </div>
                                    </div>

                                    <!-- 완료 버튼 -->
                                    <div>
                                        <button type="button" class="btn" onclick="completeMaterialInput(${idx})"
                                                id="completeMaterialBtn_${idx}" disabled style="opacity: 0.5; width: 100%;">
                                            ✓ 이 분말 투입 완료
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            listContainer.innerHTML = html;

            // 첫 번째 분말에 LOT 행 하나 추가
            setTimeout(() => {
                addLotRow(0);
            }, 100);
        }

        // LOT 행 추가
        let lotRowCounters = {}; // 각 분말별 LOT 행 카운터
        let approvedLotsCache = {}; // 분말별 합격 LOT 캐시

        function addLotRow(materialIndex) {
            if (!lotRowCounters[materialIndex]) {
                lotRowCounters[materialIndex] = 0;
            }

            const lotIndex = lotRowCounters[materialIndex]++;
            const tableBody = document.getElementById(`lotTableBody_${materialIndex}`);
            const materialRow = document.getElementById(`materialRow_${materialIndex}`);
            const isMain = materialRow.dataset.isMain === 'true';
            const powderName = materialRow.dataset.powderName;

            // Main 분말은 선택 입력, 일반 분말은 숫자 입력
            let weightInputHtml = '';
            if (isMain) {
                weightInputHtml = `
                    <select id="weightInput_${materialIndex}_${lotIndex}"
                            class="auto-input-field weight-input"
                            style="width: 100%; padding: 8px;"
                            onchange="updateTotalWeight(${materialIndex})">
                        <option value="">선택하세요</option>
                        <option value="1000">1 ton (1,000 kg)</option>
                        <option value="2000">2 ton (2,000 kg)</option>
                        <option value="3000">3 ton (3,000 kg)</option>
                        <option value="4000">4 ton (4,000 kg)</option>
                        <option value="5000">5 ton (5,000 kg)</option>
                    </select>
                `;
            } else {
                weightInputHtml = `
                    <input type="number"
                           id="weightInput_${materialIndex}_${lotIndex}"
                           class="auto-input-field weight-input"
                           step="1"
                           style="width: 100%; padding: 8px;"
                           placeholder="중량 입력 (g)"
                           oninput="updateTotalWeight(${materialIndex})">
                `;
            }

            const newRow = document.createElement('tr');
            newRow.id = `lotRow_${materialIndex}_${lotIndex}`;
            newRow.innerHTML = `
                <td style="padding: 10px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="text"
                               id="lotInput_${materialIndex}_${lotIndex}"
                               class="auto-input-field lot-input"
                               placeholder="스캔 또는 수동입력"
                               style="flex: 1; padding: 8px;"
                               oninput="resetLotValidation(${materialIndex}, ${lotIndex})"
                               onblur="validateAutoInputLot(${materialIndex}, ${lotIndex}, '${powderName}')">
                        <div id="lotValidation_${materialIndex}_${lotIndex}" style="min-width: 60px; font-weight: 600; font-size: 0.9em;"></div>
                    </div>
                </td>
                <td style="padding: 10px;">
                    ${weightInputHtml}
                </td>
                <td style="padding: 10px; text-align: center;">
                    <button type="button"
                            class="btn secondary"
                            onclick="removeLotRow(${materialIndex}, ${lotIndex})"
                            style="padding: 6px 12px; font-size: 0.85em; background: #f44336; color: white;">
                        🗑️ 삭제
                    </button>
                </td>
            `;

            tableBody.appendChild(newRow);

            // 합격 LOT 목록 미리 로드
            loadApprovedLotsForMaterial(powderName);

            // 첫 번째 LOT 입력에 포커스
            setTimeout(() => {
                document.getElementById(`lotInput_${materialIndex}_${lotIndex}`).focus();
            }, 100);

            // 합계 업데이트
            updateTotalWeight(materialIndex);
        }

        // 합격 LOT 목록 로드 (캐싱)
        async function loadApprovedLotsForMaterial(powderName) {
            if (approvedLotsCache[powderName]) {
                return; // 이미 로드됨
            }

            try {
                const response = await fetch(`${API_BASE}/api/completed-lots?powder_name=${encodeURIComponent(powderName)}&category=incoming`);
                const data = await response.json();

                if (data.success && data.lots) {
                    approvedLotsCache[powderName] = data.lots.map(lot => lot.lot_number);
                } else {
                    approvedLotsCache[powderName] = [];
                }
            } catch (error) {
                console.error('합격 LOT 목록 로딩 실패:', error);
                approvedLotsCache[powderName] = [];
            }
        }

        // LOT 검증 상태 초기화 (입력 시)
        function resetLotValidation(materialIndex, lotIndex) {
            const lotInput = document.getElementById(`lotInput_${materialIndex}_${lotIndex}`);
            const validationDiv = document.getElementById(`lotValidation_${materialIndex}_${lotIndex}`);

            if (lotInput) {
                lotInput.style.borderColor = '#ddd';
                lotInput.style.borderWidth = '1px';
                lotInput.dataset.validated = '';
                lotInput.dataset.alertShown = 'false'; // 플래그 초기화
            }

            if (validationDiv) {
                validationDiv.innerHTML = '';
            }

            // 판정 버튼 비활성화
            updateJudgeButtonState(materialIndex);
        }

        // LOT 번호 검증
        async function validateAutoInputLot(materialIndex, lotIndex, powderName) {
            const lotInput = document.getElementById(`lotInput_${materialIndex}_${lotIndex}`);
            const validationDiv = document.getElementById(`lotValidation_${materialIndex}_${lotIndex}`);

            if (!lotInput || !validationDiv) return;

            const lotNumber = lotInput.value.trim();

            // 빈 값이면 검증 안 함
            if (!lotNumber) {
                validationDiv.innerHTML = '';
                lotInput.style.borderColor = '#ddd';
                return;
            }

            // 합격 LOT 목록 로드 (캐시 확인)
            if (!approvedLotsCache[powderName]) {
                validationDiv.innerHTML = '<span style="color: #999;">확인 중...</span>';
                await loadApprovedLotsForMaterial(powderName);
            }

            // 검증
            const approvedLots = approvedLotsCache[powderName] || [];
            const isApproved = approvedLots.includes(lotNumber);

            if (isApproved) {
                // 합격 LOT
                validationDiv.innerHTML = '<span style="color: #4CAF50;">✓ 합격</span>';
                lotInput.style.borderColor = '#4CAF50';
                lotInput.style.borderWidth = '2px';
                lotInput.dataset.validated = 'true';
                lotInput.dataset.alertShown = 'false'; // 플래그 초기화
            } else {
                // 불합격 또는 미검사 LOT
                validationDiv.innerHTML = '<span style="color: #f44336;">✗ 불가</span>';
                lotInput.style.borderColor = '#f44336';
                lotInput.style.borderWidth = '2px';
                lotInput.dataset.validated = 'false';

                // 경고 메시지 (한 번만 표시)
                if (lotInput.dataset.alertShown !== 'true') {
                    lotInput.dataset.alertShown = 'true';
                    setTimeout(() => {
                        alert(`⚠️ LOT 번호 검증 실패\n\n입력된 LOT: ${lotNumber}\n분말명: ${powderName}\n\n이 LOT는 수입검사 합격 목록에 없습니다.\n합격된 LOT만 사용할 수 있습니다.`);
                    }, 100);
                }
            }

            // 판정 버튼 활성화 상태 업데이트
            updateJudgeButtonState(materialIndex);
        }

        // 판정 버튼 활성화 상태 업데이트
        function updateJudgeButtonState(materialIndex) {
            const tableBody = document.getElementById(`lotTableBody_${materialIndex}`);
            const rows = tableBody.querySelectorAll('tr');
            let allLotsValid = true;
            let hasAnyLot = false;

            rows.forEach(row => {
                const lotInput = row.querySelector('[id^="lotInput_"]');
                if (lotInput && lotInput.value.trim()) {
                    hasAnyLot = true;
                    if (lotInput.dataset.validated !== 'true') {
                        allLotsValid = false;
                    }
                }
            });

            const judgeBtn = document.getElementById(`judgeBtn_${materialIndex}`);
            if (judgeBtn) {
                // 모든 LOT가 검증되고 중량이 입력되어야 판정 가능
                const totalWeight = parseFloat(document.getElementById(`totalWeight_${materialIndex}`).textContent);
                judgeBtn.disabled = !(allLotsValid && hasAnyLot && totalWeight > 0);
                judgeBtn.style.opacity = judgeBtn.disabled ? '0.5' : '1';
            }
        }

        // 합계 중량 업데이트
        function updateTotalWeight(materialIndex) {
            const tableBody = document.getElementById(`lotTableBody_${materialIndex}`);
            const rows = tableBody.querySelectorAll('tr');
            const materialRow = document.getElementById(`materialRow_${materialIndex}`);
            const isMain = materialRow.dataset.isMain === 'true';
            let total = 0;
            let hasAllWeights = rows.length > 0;

            rows.forEach(row => {
                const weightInput = row.querySelector('[id^="weightInput_"]');
                if (weightInput) {
                    const weight = parseFloat(weightInput.value);
                    if (weight && weight > 0) {
                        total += weight;
                    } else {
                        hasAllWeights = false;
                    }
                }
            });

            // 합계 중량 표시 (Main은 kg, 첨가분말은 g - 정수)
            const totalWeightSpan = document.getElementById(`totalWeight_${materialIndex}`);
            if (totalWeightSpan) {
                totalWeightSpan.textContent = isMain ? total.toFixed(2) : Math.round(total).toLocaleString();
            }

            // 판정 버튼 활성화 여부 (LOT 검증 포함)
            updateJudgeButtonState(materialIndex);

            // 판정 결과 초기화
            const judgeResult = document.getElementById(`judgeResult_${materialIndex}`);
            if (judgeResult) {
                judgeResult.innerHTML = '';
                judgeResult.dataset.result = '';
            }

            // 완료 버튼 비활성화
            const completeBtn = document.getElementById(`completeMaterialBtn_${materialIndex}`);
            if (completeBtn) {
                completeBtn.disabled = true;
                completeBtn.style.opacity = '0.5';
            }
        }

        // LOT 행 삭제
        function removeLotRow(materialIndex, lotIndex) {
            if (confirm('이 LOT를 삭제하시겠습니까?')) {
                const row = document.getElementById(`lotRow_${materialIndex}_${lotIndex}`);
                if (row) {
                    row.remove();
                }
                updateTotalWeight(materialIndex);
            }
        }

        // 분말 합계 중량 판정
        function judgeMaterialWeight(materialIndex) {
            const materialRow = document.getElementById(`materialRow_${materialIndex}`);
            const judgeResult = document.getElementById(`judgeResult_${materialIndex}`);
            const completeBtn = document.getElementById(`completeMaterialBtn_${materialIndex}`);
            const totalWeightSpan = document.getElementById(`totalWeight_${materialIndex}`);
            const isMain = materialRow.dataset.isMain === 'true';

            // 첨가분말은 g → kg 변환, Main은 그대로
            let totalWeight = parseFloat(totalWeightSpan.textContent.replace(/,/g, ''));
            if (!isMain) {
                totalWeight = totalWeight / 1000; // g → kg
            }

            const minWeight = parseFloat(materialRow.dataset.minWeight);
            const maxWeight = parseFloat(materialRow.dataset.maxWeight);

            // 모든 LOT 번호가 입력되고 검증되었는지 확인
            const tableBody = document.getElementById(`lotTableBody_${materialIndex}`);
            const rows = tableBody.querySelectorAll('tr');
            let allLotsHaveNumbers = true;
            let allLotsValidated = true;

            rows.forEach(row => {
                const lotInput = row.querySelector('[id^="lotInput_"]');
                if (!lotInput || !lotInput.value.trim()) {
                    allLotsHaveNumbers = false;
                } else if (lotInput.dataset.validated !== 'true') {
                    allLotsValidated = false;
                }
            });

            if (!allLotsHaveNumbers) {
                alert('모든 LOT 번호를 입력해주세요.');
                return;
            }

            if (!allLotsValidated) {
                alert('⚠️ 검증 실패\n\n모든 LOT가 수입검사 합격 상태여야 합니다.\n불합격 LOT는 사용할 수 없습니다.');
                return;
            }

            // 합부 판정
            if (totalWeight >= minWeight && totalWeight <= maxWeight) {
                // 합격
                judgeResult.innerHTML = '<span style="color: #4CAF50; font-size: 1.1em;">⭕ 합격</span>';
                judgeResult.dataset.result = 'pass';
                completeBtn.disabled = false;
                completeBtn.style.opacity = '1';

                // 모든 입력 필드 비활성화
                rows.forEach(row => {
                    const lotInput = row.querySelector('[id^="lotInput_"]');
                    const weightInput = row.querySelector('[id^="weightInput_"]');
                    if (lotInput) lotInput.disabled = true;
                    if (weightInput) weightInput.disabled = true;
                });

                // LOT 추가 및 판정 버튼 비활성화
                document.getElementById(`addLotBtn_${materialIndex}`).disabled = true;
                document.getElementById(`judgeBtn_${materialIndex}`).disabled = true;
            } else {
                // 불합격
                judgeResult.innerHTML = '<span style="color: #F44336; font-size: 1.1em;">❌ 불합격</span>';
                judgeResult.dataset.result = 'fail';
                completeBtn.disabled = true;
                completeBtn.style.opacity = '0.5';

                // 불합격 사유 표시
                let reason = '';
                if (totalWeight < minWeight) {
                    reason = `중량 부족 (${(minWeight - totalWeight).toFixed(2)} kg 부족)`;
                } else {
                    reason = `중량 초과 (+${(totalWeight - maxWeight).toFixed(2)} kg 초과)`;
                }
                alert(`불합격: ${reason}\n허용 범위: ${minWeight.toFixed(2)} ~ ${maxWeight.toFixed(2)} kg\n합계 중량: ${totalWeight.toFixed(2)} kg`);
            }
        }

        // 분말 투입 완료
        // 자동입력 페이지에서 분말 투입 완료 (DB 저장)
        async function completeAutoInputMaterial(materialIndex) {
            if (!currentAutoInputWorkId || !currentAutoInputWork) {
                alert('작업 정보가 없습니다.');
                return;
            }

            const materialRow = document.getElementById(`materialRow_${materialIndex}`);
            const powderName = materialRow.dataset.powderName;
            const isMain = materialRow.dataset.isMain === 'true';
            const minWeight = parseFloat(materialRow.dataset.minWeight);
            const maxWeight = parseFloat(materialRow.dataset.maxWeight);
            const tolerance = parseFloat(materialRow.dataset.tolerance) || 5;

            // LOT 정보 수집 및 검증
            const tableBody = document.getElementById(`lotTableBody_${materialIndex}`);
            const rows = tableBody.querySelectorAll('tr');
            const lots = [];
            let totalWeight = 0;
            let hasInvalidLot = false;

            rows.forEach(row => {
                const lotInput = row.querySelector('[id^="lotInput_"]');
                const weightInput = row.querySelector('[id^="weightInput_"]');
                if (lotInput && weightInput && lotInput.value && weightInput.value) {
                    let weight = parseFloat(weightInput.value);

                    // 첨가분말은 g → kg 변환
                    if (!isMain) {
                        weight = weight / 1000;
                    }

                    // LOT 검증 확인
                    if (lotInput.dataset.validated !== 'true') {
                        hasInvalidLot = true;
                    }

                    lots.push({
                        lotNumber: lotInput.value.trim(),
                        weight: weight,
                        validated: lotInput.dataset.validated === 'true'
                    });
                    totalWeight += weight;
                }
            });

            // 불합격 LOT가 있으면 저장 불가
            if (hasInvalidLot) {
                alert('⚠️ 검증 실패\n\n수입검사 합격되지 않은 LOT가 포함되어 있습니다.\n합격된 LOT만 사용할 수 있습니다.');
                return;
            }

            if (lots.length === 0) {
                alert('최소 1개의 LOT를 입력하세요.');
                return;
            }

            // 중량 판정 확인
            const judgeResult = document.getElementById(`judgeResult_${materialIndex}`);
            if (!judgeResult || judgeResult.dataset.result !== 'pass') {
                alert('중량 판정이 합격이어야 저장할 수 있습니다.\n판정 버튼을 먼저 클릭하세요.');
                return;
            }

            try {
                // 복수 LOT를 하나의 레코드로 저장 (LOT는 쉼표로 구분)
                const lotNumbers = lots.map(lot => lot.lotNumber).join(',');

                const response = await fetch(`${API_BASE}/api/blending/material-input`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        blending_work_id: currentAutoInputWorkId,
                        powder_name: powderName,
                        powder_category: isMain ? 'main' : 'sub',
                        material_lot: lotNumbers,
                        target_weight: (minWeight + maxWeight) / 2,
                        actual_weight: parseFloat(totalWeight.toFixed(3)), // 소수점 3자리
                        tolerance_percent: tolerance,
                        operator: currentAutoInputWork.operator
                    })
                });

                const data = await response.json();
                if (!data.success) {
                    alert(`저장 실패: ${data.message}`);
                    return;
                }

                alert(`✓ ${powderName} 투입이 기록되었습니다.`);

                // 현재 분말 비활성화 및 완료 표시
                materialRow.classList.remove('active');
                materialRow.querySelector('.status-badge').className = 'status-badge completed';
                materialRow.querySelector('.status-badge').textContent = '완료';

                // 모든 버튼 비활성화
                document.getElementById(`addLotBtn_${materialIndex}`).disabled = true;
                document.getElementById(`completeMaterialBtn_${materialIndex}`).disabled = true;

                // 진행 상황 업데이트
                const totalRows = document.querySelectorAll('.material-input-row').length;
                const completedRows = materialIndex + 1;
                document.getElementById('autoInputProgress').textContent = `${completedRows}/${totalRows}`;

                // 다음 분말이 있으면 활성화
                const nextIndex = materialIndex + 1;
                if (nextIndex < totalRows) {
                    setTimeout(() => {
                        activateMaterialRow(nextIndex);
                    }, 300);
                } else {
                    // 모든 작업 완료 - 배합작업 상태를 완료로 변경
                    await completeBlendingWork();
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        // 배합작업 완료 처리
        async function completeBlendingWork() {
            try {
                const response = await fetch(`${API_BASE}/api/blending/complete/${currentAutoInputWorkId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();
                if (data.success) {
                    alert('✓ 모든 원재료 투입이 완료되었습니다.\n배합작업이 완료되었습니다.\n바코드 라벨을 확인해 주세요.');

                    // 목록 갱신
                    try {
                        loadBlendingOrdersForBlending();
                    } catch (e) { /* noop */ }
                    try {
                        loadInProgressBlendingWorks();
                    } catch (e) { /* noop */ }

                    // 최신 작업 정보 가져오기
                    try {
                        const workResp = await fetch(`${API_BASE}/api/blending/work/${currentAutoInputWorkId}`);
                        const workData = await workResp.json();
                        if (workData.success && workData.work) {
                            currentAutoInputWork = workData.work;
                        }
                    } catch (err) {
                        console.warn('작업정보 재조회 실패:', err);
                    }

                    // 라벨 생성 및 모달로 표시
                    showBarcodeModal(currentAutoInputWork);

                    // 페이지는 유지하여 라벨 확인/인쇄 가능하도록 함
                } else {
                    alert('배합작업 완료 처리 실패: ' + data.message);
                }
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }

        function completeMaterialInput(materialIndex) {
            // 저장 처리 (향후 서버 전송 구현)
            const tableBody = document.getElementById(`lotTableBody_${materialIndex}`);
            const rows = tableBody.querySelectorAll('tr');
            const lots = [];

            rows.forEach(row => {
                const lotInput = row.querySelector('[id^="lotInput_"]');
                const weightInput = row.querySelector('[id^="weightInput_"]');
                if (lotInput && weightInput) {
                    lots.push({
                        lotNumber: lotInput.value,
                        weight: parseFloat(weightInput.value)
                    });
                }
            });

            console.log(`분말 ${materialIndex} 투입 완료:`, lots);

            // 현재 분말 비활성화 및 완료 표시
            const currentRow = document.getElementById(`materialRow_${materialIndex}`);
            currentRow.classList.remove('active');
            currentRow.querySelector('.status-badge').className = 'status-badge completed';
            currentRow.querySelector('.status-badge').textContent = '완료';

            // 모든 버튼 비활성화
            document.getElementById(`addLotBtn_${materialIndex}`).disabled = true;
            document.getElementById(`completeMaterialBtn_${materialIndex}`).disabled = true;

            // 진행 상황 업데이트
            const totalRows = document.querySelectorAll('.material-input-row').length;
            const completedRows = materialIndex + 1;
            document.getElementById('autoInputProgress').textContent = `${completedRows}/${totalRows}`;

            // 다음 분말이 있으면 활성화
            const nextIndex = materialIndex + 1;
            if (nextIndex < totalRows) {
                setTimeout(() => {
                    activateMaterialRow(nextIndex);
                }, 300);
            } else {
                // 모든 작업 완료
                setTimeout(() => {
                    if (confirm('모든 원재료 투입이 완료되었습니다.\n배합작업 페이지로 돌아가시겠습니까?')) {
                        showPage('blending');
                    }
                }, 500);
            }
        }

        // 원재료 행 활성화
        function activateMaterialRow(index) {
            // 모든 행 비활성화
            document.querySelectorAll('.material-input-row').forEach(row => {
                row.classList.remove('active');
                const badge = row.querySelector('.status-badge');
                if (badge && badge.textContent !== '완료') {
                    badge.className = 'status-badge waiting';
                    badge.textContent = '대기';
                }
            });

            // 해당 행 활성화
            const targetRow = document.getElementById(`materialRow_${index}`);
            targetRow.classList.add('active');
            targetRow.querySelector('.status-badge').className = 'status-badge active';
            targetRow.querySelector('.status-badge').textContent = '진행중';

            // 버튼 활성화
            document.getElementById(`addLotBtn_${index}`).disabled = false;
            document.getElementById(`activateBtn_${index}`).style.display = 'none';

            // 첫 LOT 행 추가
            const tableBody = document.getElementById(`lotTableBody_${index}`);
            if (tableBody.children.length === 0) {
                addLotRow(index);
            }
        }

        // 초기 로드
        window.onload = () => {
            loadDashboard();
        };
