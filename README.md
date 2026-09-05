# UPS Regis — ระบบลงทะเบียนวิชาผ่านมือถือ

> **Demo ทางวิชาการเท่านั้น** — "UPS" เป็นสถาบันสมมติ ไม่มีส่วนเกี่ยวข้องกับมหาวิทยาลัยจริง
> ไม่ได้ใช้งานจริงในการลงทะเบียนของสถาบันใด

แอปมือถือ (React Native / Expo) สำหรับนักศึกษา: ค้นหาวิชา, วางแผนตารางด้วย AI,
ตะกร้าลงทะเบียน, ซิงค์กับกลุ่มเพื่อน, เข้าคิววิชาที่เต็ม (Waitlist) พร้อมแจ้งเตือน —
และจอแอดมินสำหรับเปิด/ปิดรอบลงทะเบียนและโหมดปรับปรุงระบบ

## สารบัญ

- [สถาปัตยกรรม](#สถาปัตยกรรม)
- [เทคโนโลยีที่ใช้](#เทคโนโลยีที่ใช้)
- [สิ่งที่ต้องมีก่อนเริ่ม](#สิ่งที่ต้องมีก่อนเริ่ม)
- [เริ่มต้นใช้งานด่วน](#เริ่มต้นใช้งานด่วน)
- [ตั้งค่า Backend](#ตั้งค่า-backend)
- [ตั้งค่าฐานข้อมูล](#ตั้งค่าฐานข้อมูล)
- [ตั้งค่า Frontend](#ตั้งค่า-frontend)
- [ตัวแปรแวดล้อมและ Secrets](#ตัวแปรแวดล้อมและ-secrets)
- [วิธีใช้งานตามบทบาท](#วิธีใช้งานตามบทบาท)
- [API โดยย่อ](#api-โดยย่อ)
- [บัญชีทดสอบ](#บัญชีทดสอบ)
- [สคริปต์ช่วยงาน](#สคริปต์ช่วยงาน)
- [การ Deploy ขึ้น Production](#การ-deploy-ขึ้น-production)
- [แก้ปัญหาเบื้องต้น](#แก้ปัญหาเบื้องต้น)
- [หมายเหตุด้านความปลอดภัย](#หมายเหตุด้านความปลอดภัย)
- [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)

## สถาปัตยกรรม

```text
┌──────────────┐   HTTPS/JSON   ┌──────────────┐   SQL (pooler :6543)   ┌──────────────┐
│  Expo App    │ ────────────► │   FastAPI    │ ─────────────────────► │  Supabase    │
│ (11 screens) │ ◄──────────── │  (main.py)   │                        │  Postgres    │
└──────────────┘  BASE_URL     └──────────────┘                        └──────────────┘
      │ push ลงทะเบียนผ่าน usePushNotifications → POST /students/{id}/push-token
      │ แจ้งเตือนขาออกผ่าน Expo Push Service (exponent_server_sdk)
```

- **Routing ฝั่งแอป:** state-based (`App.js` สลับ `view`) ไม่ใช้ React Navigation
- **Navbar:** component กลาง `NavBar` ใน `components/shared.js` ใช้เหมือนกัน 9 จอ
- **Backend:** process เดียว + APScheduler 2 jobs (หมดอายุสิทธิ์ waitlist / จัดสรรที่นั่ง ทุก 1 นาที)

## เทคโนโลยีที่ใช้

| ชั้น | เทคโนโลยี | เวอร์ชัน |
|---|---|---|
| Mobile | Expo SDK / React Native / React | ~54 / 0.81 / 19.1 |
| ภาษาแอป | JavaScript (React) | — |
| Backend | FastAPI / Uvicorn / SQLAlchemy / APScheduler | 0.135 / 0.42 / 2.0 / 3.11 |
| Database | Supabase Postgres (pooler) | — |
| Auth/Push | bcrypt hash / Expo Notifications | — |
| Hosting ปัจจุบัน | Faable (HTTPS) | — |
| Dev build | EAS development client | — |

## สิ่งที่ต้องมีก่อนเริ่ม

- Node.js LTS + npm (`node --version`)
- Python 3.11 (`python --version`)
- บัญชี Supabase (1 project) และ connection string แบบ **pooler `:6543`**
- แอป Expo Go (เทสทั่วไป) หรือ dev build APK (เทส push)
- Windows PowerShell (สคริปต์ `scripts/*.ps1`)

## เริ่มต้นใช้งานด่วน

```powershell
# 1) Frontend
npm install
npx expo start            # สแกน QR ด้วย Expo Go / dev build

# 2) Backend (อีก terminal, workdir backend\)
pip install -r backend\requirements.txt
copy backend\.env.example backend\.env   # แล้วใส่ DATABASE_URL จริง
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

เปิด `http://localhost:8000/admin/config` ต้องได้ `{"registration_open":true}`

> มือถือจริงต้องอยู่ใน Wi-Fi เดียวกันและ `api.js` ชี้ `BASE_URL` ไป IP/URL ที่มือถือเข้าถึงได้
> (ห้ามใช้ `localhost` บนมือถือ)

## ตั้งค่า Backend

```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1   # แนะนำ
pip install -r requirements.txt
```

สร้าง `backend/.env` (ไฟล์นี้ถูก gitignore ห้าม commit):

```env
DATABASE_URL=postgresql://postgres.<REF>:<PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

ข้อบังคับของ connection string:

- ใช้ **pooler `:6543`** เท่านั้น ห้ามใช้ direct `db.xxx:5432` (IPv6-only ต่อไม่ติด)
- user ต้องมี `.REF` ต่อท้าย (`postgres.<REF>`) สำหรับ pooler
- แก้ `.env` แล้วต้อง **รีสตาร์ท uvicorn** (reloader ไม่ตามไฟล์ `.env`)

## ตั้งค่าฐานข้อมูล

รันใน Supabase Dashboard → SQL Editor ตามลำดับ (project ใหม่ที่ว่าง):

1. `backend/supabase/migrations/0001_schema_v2.sql` — สร้าง 14 ตาราง + type + index + config เริ่มต้น
2. `backend/supabase/migrations/0002_seed_demo.sql` — ข้อมูล demo (รันซ้ำได้)

ตรวจหลังรัน:

```sql
SELECT count(*) FROM student;        -- 10
SELECT count(*) FROM course;         -- 12
SELECT count(*) FROM class_section;  -- 22
SELECT * FROM system_config;         -- registration_open=true, maintenance_mode=false
```

รายละเอียดคอลัมน์สำคัญ:

- `student.password_hash` — bcrypt (`$2a$`/`$2b$`) ไม่เก็บรหัสจริง
- `course.credits` — SMALLINT
- `class_section.section_type` (`T`/`L`) — คอลัมน์จริง (คอลัมน์ `room` ยังมี `(ท)/(ป)` ไว้เพื่อ compat)
- `enrollment` มี UNIQUE `(student_id, course_id, section_type)` กันลงซ้ำระดับ DB
- สูตรคงยอดที่นั่ง: `enrolled_seats = จำนวน enrollment + hold ที่ ALLOCATED`

## ตั้งค่า Frontend

```powershell
npm install
```

แก้ `api.js` บรรทัด `BASE_URL` ให้ตรง backend ที่จะใช้ (มีที่เดียว `usePushNotifications` ดึงจากที่นี่):

| สถานการณ์ | ค่า |
|---|---|
| Backend production (Faable) | `https://ups-regis-k49tx.faable.link` |
| Backend บนคอม + เทสผ่าน Expo Go/มือถือ | `http://<IP-คอม>:8000` |
| Expo web บนคอม | `http://localhost:8000` |

รัน:

```powershell
npx expo start                 # Expo Go (push ใช้ไม่ได้บน SDK 53+)
npx expo start --dev-client    # dev build (push ใช้ได้)
```

Build dev client Android:

```powershell
eas build --profile development --platform android
```

> Push notification ต้องมี `google-services.json` (Firebase, package `com.chatpeth.RegistrationApp`)
> วางที่ root แล้ว build ใหม่ — ไม่มีไฟล์นี้จะขอ token ไม่ได้ทุกเครื่อง

## ตัวแปรแวดล้อมและ Secrets

| ที่อยู่ | ชื่อ | ใช้ทำอะไร |
|---|---|---|
| `backend/.env` (local, ห้าม commit) | `DATABASE_URL` | backend ต่อ Postgres |
| Faable/Replit Secrets | `DATABASE_URL` (หรือ `APP_DATABASE_URL` บน Replit) | backend บน host |
| `api.js` | `BASE_URL` | แอปชี้ backend |
| Supabase | DB password | เปลี่ยนที่ Project Settings → Database |

## วิธีใช้งานตามบทบาท

**นักศึกษา** (`MENU` → 4 แท็บหลัก: หน้าแรก / รายวิชา / ตะกร้า / ตารางเรียน)

1. Login ด้วยรหัสนักศึกษา + รหัสผ่าน
2. `รายวิชา` — ค้นหา/เลือก section เอง หรือใช้ AI จัดแผนไม่ชน (สูงสุด 10 วิชา/10 แผน)
3. `ลงทะเบียนยกภาค` — batch เพิ่มวิชาบังคับ (ข้ามวิชาที่มีแล้ว เลือกกลุ่มที่ว่าง)
4. `ตะกร้า` — ตรวจชนเวลา → ยืนยัน (วิชาเต็มไม่เททั้งตะกร้า ระบบลงวิชาที่ได้และค้างวิชาที่เต็มไว้พร้อมเหตุผล)
5. `เพื่อนช่วยลง` — สร้าง/เข้ากลุ่ม (สูงสุด 5 คน) หัวหน้า sync ตะกร้าและกดลงทะเบียนให้ทั้งกลุ่ม
6. `Waitlist` — เข้าคิววิชาที่เต็ม ได้สิทธิ์แล้วต้องยืนยันใน **30 นาที** (เกินเวลาสิทธิ์หลุด)
7. `Profile` — ดูเกรด/CGPA, เปลี่ยนรหัสผ่าน, ออกจากระบบ

**แอดมิน** (`ADMIN_HOME` หลัง login ด้วยรหัส admin)

- เปิด/ปิดรอบลงทะเบียน, เปิด/ปิด maintenance mode (ตอนปิด ทุก endpoint เขียนตอบ 403 เหลือแต่อ่าน)
- ค้นหานักศึกษา (สูงสุด 20 รายการ) ดูตารางเรียน/คิว/เกรด
- ซ่อมตัวนับที่นั่งราย section (`POST /admin/recount-seats`)

## API โดยย่อ

Base: `https://ups-regis-k49tx.faable.link` (หรือ `http://<host>:8000` ตอน dev)

| กลุ่ม | Endpoints |
|---|---|
| Auth | `POST /login` (เช็ค bcrypt + rate limit ผิด 5 ครั้ง/15 นาที → 429) |
| Courses | `GET /courses/available/{id}`, `/courses/suggested/{id}`, `/sections/{code}`, `/courses/{id}/sections`, `/z-options/{id}/{z}` |
| AI | `POST /ai-suggest` |
| Cart | `POST /cart/add`, `GET /cart/{id}`, `POST /cart/batch_add_with_check`, `POST /cart/remove`, `POST /cart/confirm/{id}` (partial: `success/partial/failed`) |
| Group | `POST /group/create|join|ready|sync|approve|register-all|mark-seen-registered`, `DELETE /group/leave|delete`, `GET /group/my/{id}` |
| Enroll | `GET /enroll/my/{id}`, `POST /enrollment/withdraw` |
| Waitlist | `POST /waitlist/join|confirm|cancel`, `GET /waitlist/status/{id}` |
| Student | `POST /students/{id}/push-token`, `POST /students/{id}/change-password` |
| Admin | `GET /admin/config|maintenance-status|students/search`, `POST /admin/toggle-registration|toggle-maintenance|recount-seats` |

Interactive docs (ตอนรัน local): `http://localhost:8000/docs`

## บัญชีทดสอบ

รหัสผ่านเริ่มต้นทุกบัญชี: `123456` (ควรเปลี่ยนหลัง login ครั้งแรกผ่านหน้า Profile)

| รหัส | บทบาท | หมายเหตุ |
|---|---|---|
| `68100001`–`68100004` | นศ. CPE ปี 1 | ใช้งานทั่วไป |
| `68100101` | นศ. ICT ปี 1 | — |
| `67100001` | นศ. CPE ปี 2 | มีเกรดตัวอย่าง |
| `66100001` | นศ. CPE ปี 3 | — |
| `68300001` / `67300001` | นศ. LSM ปี 1/2 | — |
| `ADM001` | แอดมิน | จอ admin |
| GEN101 กลุ่ม 2 | — | เต็ม 60/60 ไว้ทดสอบ waitlist |

## สคริปต์ช่วยงาน

`scripts/*.ps1` (คลิกขวา → Run with PowerShell):

- `start-all.ps1` — รัน backend + tunnel เบื้องหลัง + sync `BASE_URL` อัตโนมัติ
- `sync-baseurl.ps1` — อ่าน URL tunnel ล่าสุดมาใส่ `api.js`
- `stop-all.ps1` — หยุดทั้งหมด
- `common.ps1` — ค่ารวม (ไม่ต้องรันตรง)

สำรอง DB เก่า: `python backend/backup_old_db.py` (ต้องตั้ง `OLD_DATABASE_URL` ก่อน ผลลัพธ์อยู่ `backend/supabase/backup/` ซึ่งถูก gitignore)

## การ Deploy ขึ้น Production

- **Backend ปัจจุบัน:** Faable (free) — push `main` แล้ว deploy อัตโนมัติ ตั้ง secret `DATABASE_URL` ใน dashboard
- **ทางเลือกที่เคยลอง:** Render (ต้องยืนยันบัตร), Hugging Face Spaces (ต้อง PRO สำหรับ Docker), Koyeb (ปิดรับใหม่), Cloudflare Tunnel (ชั่วคราว ต้องเปิดคอม)
- **Replit fallback:** มี `.replit` แล้ว ใช้ secret ชื่อ `APP_DATABASE_URL` (ชื่อ `DATABASE_URL` ถูกระบบจอง)

## แก้ปัญหาเบื้องต้น

| อาการ | สาเหตุ/ทางแก้ |
|---|---|
| `password authentication failed` | รหัสใน `.env`/secret ผิด → reset ใน Supabase แล้วแก้ทั้ง 2 ที่ + รีสตาร์ท backend |
| `could not translate host name db.xxx` | ใช้ direct `:5432` → เปลี่ยนเป็น pooler `:6543` |
| แก้ `.env` แล้วไม่หาย | reloader ไม่ตาม `.env` → Ctrl+C แล้วรันใหม่ |
| มือถือต่อ backend ไม่ติด | ใช้ LAN IP ไม่ใช่ `localhost` + รัน uvicorn ด้วย `--host 0.0.0.0` + Wi-Fi เดียวกัน |
| Alert โชว์ HTML | backend ล่ม/suspend → `api.js` ดักไว้แล้ว จะบอกให้ตรวจ backend แทน |
| Login 429 | ผิดเกิน 5 ครั้งใน 15 นาที → รอ หรือรีสตาร์ท backend (ล้างตัวนับ memory) |
| `Invalid Date` / นับถอยหลังค้าง | อัปเดตโค้ด WaitlistScreen ล่าสุด (แก้ parse ISO `+00:00` แล้ว) |
| Push ไม่เข้า | ต้อง dev build + `google-services.json` + เครื่องจริง (emulator ไม่มี FCM token) |
| Faable build `paired builder` | ปัญหาฝั่ง platform → Redeploy, ไม่หายทัก support พร้อม deployment id |

## หมายเหตุด้านความปลอดภัย

- รหัสผ่านเก็บแบบ bcrypt hash ไม่เก็บตัวจริง ส่งผ่าน HTTPS ใน production
- Login มี rate limit (in-memory ต่อ instance — รีสตาร์ทแล้วหาย)
- Admin endpoints ตรวจว่าเป็น admin ใน DB ก่อน toggle
- CORS จำกัดเฉพาะ local/LAN (native app ไม่โดน CORS อยู่แล้ว)
- ห้าม commit `backend/.env`, ไฟล์ `*.csv` backup, token ส่วนตัว

## โครงสร้างโปรเจกต์

```text
├── App.js                  # state router + global alert modal
├── api.js                  # BASE_URL + apiFetch + API functions (single source)
├── usePushNotifications.js # ลงทะเบียน Expo push token
├── screens/                # 11 จอ (Login/Menu/Manual/AI/Cart/Schedule/GroupSync/...)
├── components/shared.js    # NavBar กลาง + header/card ร่วม
├── backend/
│   ├── main.py             # FastAPI 36 endpoints + scheduler
│   ├── database.py         # SQLAlchemy models (อ่าน env, ไม่ hardcode secret)
│   ├── requirements.txt
│   └── supabase/migrations/# 0001 schema v2 + 0002 seed demo
├── scripts/                # สคริปต์รัน backend/tunnel เบื้องหลัง (Windows)
├── faable.json + requirements.txt + runtime.txt  # config deploy Faable
└── assets/                 # โลโก้ UPS (demo)
```
