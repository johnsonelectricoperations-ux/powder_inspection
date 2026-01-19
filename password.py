#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
분말 검사 시스템 - 관리자 비밀번호 변경 스크립트
프롬프트에서 실행하여 관리자 모드 비밀번호를 변경합니다.
"""

import hashlib
import os
import getpass

def change_password():
    """관리자 비밀번호 변경"""

    print("=" * 60)
    print("분말 검사 시스템 - 관리자 비밀번호 변경")
    print("=" * 60)
    print()

    # 비밀번호 파일 경로
    script_dir = os.path.dirname(os.path.abspath(__file__))
    password_file = os.path.join(script_dir, 'password.txt')

    # 현재 비밀번호 확인
    if os.path.exists(password_file):
        print("1단계: 현재 비밀번호 확인")
        current_password = getpass.getpass("현재 비밀번호를 입력하세요: ")

        # 저장된 해시 읽기
        with open(password_file, 'r') as f:
            stored_hash = f.read().strip()

        # 입력된 비밀번호 해시화
        current_hash = hashlib.sha256(current_password.encode()).hexdigest()

        # 비교
        if current_hash != stored_hash:
            print("\n❌ 오류: 현재 비밀번호가 일치하지 않습니다.")
            print("프로그램을 종료합니다.")
            return

        print("✓ 현재 비밀번호 확인 완료")
        print()
    else:
        print("⚠️  비밀번호 파일이 없습니다. 새로운 비밀번호를 설정합니다.")
        print()

    # 새 비밀번호 입력
    print("2단계: 새 비밀번호 설정")
    while True:
        new_password = getpass.getpass("새 비밀번호를 입력하세요: ")

        if len(new_password) < 4:
            print("❌ 비밀번호는 최소 4자 이상이어야 합니다.")
            continue

        confirm_password = getpass.getpass("새 비밀번호를 다시 입력하세요: ")

        if new_password != confirm_password:
            print("❌ 비밀번호가 일치하지 않습니다. 다시 입력해주세요.")
            continue

        break

    # 새 비밀번호 해시화 및 저장
    new_hash = hashlib.sha256(new_password.encode()).hexdigest()

    with open(password_file, 'w') as f:
        f.write(new_hash)

    print()
    print("=" * 60)
    print("✅ 비밀번호가 성공적으로 변경되었습니다!")
    print("=" * 60)
    print()
    print("📝 참고사항:")
    print("  - 비밀번호는 암호화되어 저장됩니다.")
    print("  - 비밀번호 파일: password.txt")
    print("  - 비밀번호를 잊어버린 경우 이 스크립트를 실행하여")
    print("    password.txt 파일을 삭제하고 다시 실행하면 초기화됩니다.")
    print()


def reset_password():
    """비밀번호 초기화 (password.txt 파일 삭제 후 기본값으로)"""

    print("=" * 60)
    print("분말 검사 시스템 - 관리자 비밀번호 초기화")
    print("=" * 60)
    print()

    confirm = input("⚠️  비밀번호를 초기 상태(1234)로 리셋하시겠습니까? (yes/no): ")

    if confirm.lower() != 'yes':
        print("취소되었습니다.")
        return

    # 비밀번호 파일 경로
    script_dir = os.path.dirname(os.path.abspath(__file__))
    password_file = os.path.join(script_dir, 'password.txt')

    # 초기 비밀번호 설정
    default_password = "1234"
    hashed = hashlib.sha256(default_password.encode()).hexdigest()

    with open(password_file, 'w') as f:
        f.write(hashed)

    print()
    print("=" * 60)
    print("✅ 비밀번호가 초기화되었습니다!")
    print("=" * 60)
    print()
    print("초기 비밀번호: 1234")
    print("보안을 위해 즉시 비밀번호를 변경하시기 바랍니다.")
    print()


def main():
    """메인 함수"""

    print()
    print("관리자 비밀번호 관리")
    print()
    print("1. 비밀번호 변경")
    print("2. 비밀번호 초기화 (기본값 1234로 리셋)")
    print("3. 종료")
    print()

    choice = input("선택하세요 (1-3): ")

    if choice == '1':
        change_password()
    elif choice == '2':
        reset_password()
    elif choice == '3':
        print("프로그램을 종료합니다.")
    else:
        print("잘못된 선택입니다.")


if __name__ == '__main__':
    main()
