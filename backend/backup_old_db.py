"""
Backup script สำหรับ DB เก่า (Supabase Postgres).
รันบนเครื่องที่มี Python + psycopg2-binary:
    pip install psycopg2-binary
    set OLD_DATABASE_URL=postgresql://... (ห้าม commit ลง git)
    python backend/backup_old_db.py

สิ่งที่ทำ:
1. SELECT count(*) ทุกตาราง -> print + save JSON
2. COPY แต่ละตารางออกเป็น CSV ใน backend/supabase/backup/
"""
import csv
import json
import os
import sys
from datetime import datetime, timezone

TABLES = [
    "student", "admin", "instructor", "course", "curriculum_course",
    "class_section", "enrollment_cart", "enrollment",
    "study_group", "group_member", "grade_record",
    "waitlist", "system_config", "system_log",
]

def main():
    try:
        import psycopg2
    except ImportError:
        print("ต้องลง psycopg2-binary ก่อน: pip install psycopg2-binary")
        sys.exit(1)

    dsn = os.getenv("OLD_DATABASE_URL")
    if not dsn:
        print("ตั้ง env OLD_DATABASE_URL ก่อน (ใช้ connection string ของ project เก่า)")
        sys.exit(1)

    out_dir = os.path.join("backend", "supabase", "backup", datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"))
    os.makedirs(out_dir, exist_ok=True)

    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    counts = {}
    for tbl in TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
            n = cur.fetchone()[0]
            counts[tbl] = n
            print(f"{tbl}: {n} rows")
            # export CSV
            cur.execute(f'SELECT * FROM "{tbl}"')
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            with open(os.path.join(out_dir, f"{tbl}.csv"), "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(cols)
                w.writerows(rows)
        except Exception as e:
            counts[tbl] = f"ERROR: {e}"
            print(f"{tbl}: ERROR {e}")
            conn.rollback()
        else:
            conn.rollback()

    with open(os.path.join(out_dir, "row_counts.json"), "w", encoding="utf-8") as f:
        json.dump(counts, f, ensure_ascii=False, indent=2)

    cur.close()
    conn.close()
    print(f"Backup เสร็จ: {out_dir}")
    print("เช็ค row_counts.json ก่อนล้าง/ย้าย project ใหม่")

if __name__ == "__main__":
    main()
