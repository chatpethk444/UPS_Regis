# UPS Regis — Database v2 (Supabase project ใหม่)

## ลำดับรัน (Supabase Dashboard -> SQL Editor -> New query)
1. Backup เก่าก่อน (เครื่องที่มี psycopg2):
   ```
   set OLD_DATABASE_URL=postgresql://postgres.OLD_REF:[PASS]@...pooler.supabase.com:6543/postgres
   python backend/backup_old_db.py
   ```
   เช็ค `backend/supabase/backup/<timestamp>/row_counts.json`
2. สร้าง Supabase project ใหม่ (region แนะนำ `ap-southeast-1`)
   จด `SUPABASE_URL / anon key / service_role / pooler URL`
3. รัน `0001_schema_v2.sql` ทั้งไฟล์ใน SQL Editor (สร้าง 14 tables + type + index + config เริ่มต้น)
4. รัน `0002_seed_demo.sql` ทั้งไฟล์ (admin/student/course/section/grade demo)
5. ตรวจ:
   ```sql
   SELECT count(*) FROM student;        -- ต้องได้ 10
   SELECT count(*) FROM course;         -- ต้องได้ 12
   SELECT count(*) FROM class_section;  -- ต้องได้ 22
   SELECT * FROM system_config;         -- registration_open=true, maintenance_mode=false
   ```
6. ต่อ backend:
   ```
   copy backend\.env.example backend\.env
   # แก้ DATABASE_URL เป็นของ project ใหม่
   pip install -r backend\requirements.txt
   set DATABASE_URL=postgresql://... (หรือใส่ใน backend\.env)
   uvicorn main:app --reload  (workdir backend/)
   ```
7. ต่อแอป: เปลี่ยน `api.js BASE_URL` เป็น backend ใหม่ (Render หรือ local IP)

## Login demo (password 123456 ทั้งหมด)
- นศ.ปี1 CPE: 68100001 / 68100002 / 68100003 / 68100004
- ICT ปี1: 68100101 | LSM ปี1: 68300001
- รุ่นพี่: 67100001 (CPE ปี2, มีเกรด), 67100101, 66100001, 67300001
- Admin: ADM001

## หมายเหตุ compat
- `section_type` คอลัมน์จริงแล้ว แต่ `room` ยังมี `(ท)/(ป)` ให้โค้ดเก่า fallback ได้
- `section_number` เป็น INT หมดแล้ว API ส่ง String มาก็ coerce ได้
- `credits` เป็น SMALLINT frontend `parseFloat`/template string รองรับ
- `password_hash` ใช้ `crypt('123456', gen_salt('bf'))` ต้องเปิด `pgcrypto` (0001 ทำให้แล้ว)
  backend ขั้นถัดไป: login ต้องเช็ค hash ด้วย bcrypt (ยังไม่ทำในรอบนี้)
