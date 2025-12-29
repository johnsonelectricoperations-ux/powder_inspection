#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
데이터베이스 마이그레이션: inspection_date 컬럼 추가
기존 데이터를 유지하면서 스키마만 변경
"""

import sqlite3
import os

# 데이터베이스 파일 경로
DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def migrate():
    """inspection_date 컬럼을 inspection_progress와 inspection_result 테이블에 추가"""

    if not os.path.exists(DB_PATH):
        print(f"❌ 데이터베이스 파일을 찾을 수 없습니다: {DB_PATH}")
        return False

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        print("=" * 50)
        print("데이터베이스 마이그레이션 시작")
        print("=" * 50)

        # inspection_progress 테이블에 inspection_date 컬럼 추가
        try:
            cursor.execute('ALTER TABLE inspection_progress ADD COLUMN inspection_date DATE')
            print("✅ inspection_progress 테이블에 inspection_date 컬럼 추가 완료")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("ℹ️  inspection_progress 테이블에 inspection_date 컬럼이 이미 존재합니다")
            else:
                raise

        # inspection_result 테이블에 inspection_date 컬럼 추가
        try:
            cursor.execute('ALTER TABLE inspection_result ADD COLUMN inspection_date DATE')
            print("✅ inspection_result 테이블에 inspection_date 컬럼 추가 완료")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("ℹ️  inspection_result 테이블에 inspection_date 컬럼이 이미 존재합니다")
            else:
                raise

        conn.commit()

        # 변경 사항 확인
        print("\n" + "=" * 50)
        print("마이그레이션 완료 - 테이블 구조 확인")
        print("=" * 50)

        # inspection_progress 테이블 구조 확인
        cursor.execute("PRAGMA table_info(inspection_progress)")
        columns = cursor.fetchall()
        print("\n[inspection_progress 테이블]")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

        # inspection_result 테이블 구조 확인
        cursor.execute("PRAGMA table_info(inspection_result)")
        columns = cursor.fetchall()
        print("\n[inspection_result 테이블]")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

        conn.close()

        print("\n" + "=" * 50)
        print("✅ 마이그레이션 성공!")
        print("=" * 50)
        print("기존 데이터는 그대로 유지되었습니다.")
        print("Flask 서버를 재시작하세요.")

        return True

    except Exception as e:
        print(f"\n❌ 마이그레이션 실패: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == '__main__':
    migrate()
