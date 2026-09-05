# UPS Regis — ระบบลงทะเบียนเรียนผ่านแอปพลิเคชันมือถือ**

> **เอกสารประกอบผลงานทางวิชาการ (Demonstration Only)**
> "UPS" เป็นสถาบันการศึกษาสมมติ จัดทำขึ้นเพื่อการสาธิตระบบเท่านั้น ไม่มีส่วนเกี่ยวข้องกับสถาบันการศึกษาใด และไม่ได้เปิดใช้งานในระบบลงทะเบียนจริง

แอปพลิเคชันลงทะเบียนเรียนสำหรับนักศึกษา พัฒนาด้วย **React Native / Expo** มาพร้อมฟีเจอร์ครบวงจร อาทิ การค้นหารายวิชา, ระบบจัดตารางเรียนอัจฉริยะด้วย AI, ตะกร้าลงทะเบียน, การซิงค์ข้อมูลกลุ่มเพื่อน, ระบบคิวสำรอง (Waitlist) พร้อมแจ้งเตือนแบบเรียลไทม์ และแผงควบคุมสำหรับผู้ดูแลระบบ (Admin) เพื่อบริหารจัดการรอบลงทะเบียนและสถานะการปรับปรุงระบบ

---

#### **สารบัญ**

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

---

#### **สถาปัตยกรรมระบบ**

```text
┌──────────────┐   HTTPS/JSON   ┌──────────────┐   SQL (Pooler :6543)   ┌──────────────┐
│  Expo App    │ ────────────► │   FastAPI    │ ─────────────────────► │  Supabase    │
│ (11 screens) │ ◄──────────── │  (main.py)   │                        │  Postgres    │
└──────────────┘  BASE_URL     └──────────────┘                        └──────────────┘
      │ ลงทะเบียน Push Token ผ่าน usePushNotifications → POST /students/{id}/push-token
      │ ส่งการแจ้งเตือนขาออกผ่าน Expo Push Service (exponent_server_sdk)

```

* **Frontend Navigation:** ใช้การสลับหน้าจอตามสเตต (`App.js` ควบคุม `view`) โดยไม่ผ่าน React Navigation
* **Global Navigation Bar:** คอมโพเนนต์ `NavBar` ใน `components/shared.js` ถูกใช้งานร่วมกันใน 9 หน้าจอหลัก
* **Backend Processing:** ประมวลผลแบบ Single Process ทำงานร่วมกับ **APScheduler** จำนวน 2 งาน (ยกเลิกสิทธิ์ Waitlist ที่หมดอายุ และจัดสรรที่นั่งว่าง ตรวจสอบทุก 1 นาที)

---

#### **เทคโนโลยีที่ใช้**

| เลเยอร์ | เทคโนโลยี / ไลบรารี | เวอร์ชัน |
| --- | --- | --- |
| **Mobile App** | Expo SDK / React Native / React | ~54 / 0.81 / 19.1 |
| **Language** | JavaScript (React) | — |
| **Backend Services** | FastAPI / Uvicorn / SQLAlchemy / APScheduler | 0.135 / 0.42 / 2.0 / 3.11 |
| **Database** | Supabase Postgres (ผ่าน Connection Pooler) | — |
| **Auth & Push** | bcrypt hashing / Expo Notifications | — |
| **Hosting Service** | Faable (HTTPS) | — |
| **Dev Environment** | EAS development client | — |

---

#### **ข้อกำหนดก่อนการติดตั้ง**

* **Node.js LTS + npm** (ตรวจสอบด้วย `node --version`)
* **Python 3.11** (ตรวจสอบด้วย `python --version`)
* **Supabase Project** พร้อมข้อความเชื่อมต่อ (Connection String) แบบ **Pooler พอร์ต `:6543**`
* **Expo Go** (สำหรับการทดสอบทั่วไป) หรือ **Dev Build APK** (สำหรับการทดสอบ Push Notification)
* **Windows PowerShell** (สำหรับรันสคริปต์ประเภท `scripts/*.ps1`)

---

#### **คู่มือการติดตั้งและใช้งาน**

##### **การเริ่มต้นใช้งานด่วน**

```powershell
# 1. ติดตั้งและเริ่มทำงาน Frontend
npm install
npx expo start            # สแกน QR Code ด้วย Expo Go หรือ Dev Build

# 2. ติดตั้งและเริ่มทำงาน Backend (เปิด Terminal ใหม่ ในโฟลเดอร์ backend\)
pip install -r backend\requirements.txt
copy backend\.env.example backend\.env   # คัดลอกและระบุค่า DATABASE_URL
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

```

ตรวจสอบการทำงานโดยเปิด `http://localhost:8000/admin/config` ระบบต้องแสดงผล `{"registration_open":true}`

> **ข้อควรระวัง:** การทดสอบผ่านอุปกรณ์จริง ต้องเชื่อมต่อ Wi-Fi เดียวกับเซิร์ฟเวอร์ และตั้งค่า `BASE_URL` ใน `api.js` เป็น IP หรือ URL ที่อุปกรณ์เข้าถึงได้ (ห้ามกำหนดเป็น `localhost`)

##### **การตั้งค่า Backend**

```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1   # สื่อสารผ่าน Virtual Environment
pip install -r requirements.txt

```

สร้างไฟล์ `backend/.env` (ไฟล์นี้ถูกยกเว้นการส่งขึ้น Git):

```env
DATABASE_URL=postgresql://postgres.<REF>:<PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

```

**เงื่อนไขสำคัญของ Connection String:**

* กำหนดใช้ **Pooler พอร์ต `:6543**` เท่านั้น (ห้ามใช้ Direct Connection พอร์ต `:5432` เนื่องจากรองรับเฉพาะ IPv6)
* ต้องระบุ `.<REF>` ต่อท้าย Username เพื่อการใช้งานผ่าน Pooler
* เมื่อแก้ไขไฟล์ `.env` จำเป็นต้อง **รีสตาร์ท Uvicorn** ทุกครั้ง

##### **การตั้งค่าฐานข้อมูล**

ดำเนินการรันคำสั่งบน Supabase Dashboard → SQL Editor ตามลำดับ:

1. `backend/supabase/migrations/0001_schema_v2.sql` — สร้าง 14 ตารางหลัก, ประเภทข้อมูล, ดรรชนี และการตั้งค่าเริ่มต้น
2. `backend/supabase/migrations/0002_seed_demo.sql` — นำเข้าข้อมูลตัวอย่างสำหรับทดสอบ

**การตรวจสอบความถูกต้อง:**

```sql
SELECT count(*) FROM student;        -- จำนวนต้องเท่ากับ 10
SELECT count(*) FROM course;         -- จำนวนต้องเท่ากับ 12
SELECT count(*) FROM class_section;  -- จำนวนต้องเท่ากับ 22
SELECT * FROM system_config;         -- registration_open=true, maintenance_mode=false

```

**โครงสร้างข้อมูลสำคัญ:**

* `student.password_hash` — จัดเก็บด้วยรหัส bcrypt (`$2a$`/`$2b$`)
* `course.credits` — กำหนดเป็น SMALLINT
* `class_section.section_type` (`T` = ทฤษฎี, `L` = ปฏิบัติ) — แยกคอลัมน์ชัดเจน
* `enrollment` — ตั้งค่า UNIQUE `(student_id, course_id, section_type)` ป้องกันการลงทะเบียนซ้ำซ้อน
* **การคำนวณที่นั่ง:** `enrolled_seats = ยอดลงทะเบียนสำเร็จ + จำนวนสิทธิ์สำรองชั่วคราว (ALLOCATED)`

##### **การตั้งค่า Frontend**

```powershell
npm install

```

ระบุค่า `BASE_URL` ในไฟล์ `api.js` ให้สอดคล้องกับสภาพแวดล้อมการทำงาน:

| สภาพแวดล้อม | การตั้งค่า `BASE_URL` |
| --- | --- |
| Production (Faable) | `[https://ups-regis-k49tx.faable.link](https://ups-regis-k49tx.faable.link)` |
| Local Server (ทดสอบผ่านมือถือ) | `http://<IP-คอมพิวเตอร์>:8000` |
| Local Server (ทดสอบผ่าน Web) | `http://localhost:8000` |

**การรันแอปพลิเคชัน:**

```powershell
npx expo start                 # สำหรับ Expo Go (ไม่รองรับ Push ใน SDK 53+)
npx expo start --dev-client    # สำหรับ Dev Build (รองรับ Push Notification)

```

**การสร้าง Dev Build (Android):**

```powershell
eas build --profile development --platform android

```

> **คำแนะนำ:** การใช้งาน Push Notification ต้องวางไฟล์ `google-services.json` (Package Name: `com.chatpeth.RegistrationApp`) ไว้ที่ตำแหน่ง Root ก่อนสั่ง Build

##### **การจัดการตัวแปรแวดล้อม (Environment Variables)**

| รายการ | ชื่อตัวแปร | รายละเอียด |
| --- | --- | --- |
| `backend/.env` | `DATABASE_URL` | สายอักขระเชื่อมต่อ Postgres สำหรับ Local |
| Hosting Secrets | `DATABASE_URL` / `APP_DATABASE_URL` | สายอักขระเชื่อมต่อ Postgres บนเซิร์ฟเวอร์ |
| `api.js` | `BASE_URL` | URL สำหรับการเรียกใช้ API จากฝั่ง Frontend |
| Supabase | DB Password | รหัสผ่านฐานข้อมูล (จัดการผ่าน Project Settings) |

---

#### **การใช้งานตามบทบาทผู้ใช้**

**ส่วนนักศึกษา** (เข้าถึงผ่านเมนูหลัก 4 ส่วน: หน้าแรก / รายวิชา / ตะกร้า / ตารางเรียน)

1. เข้าสู่ระบบด้วยรหัสนักศึกษาและรหัสผ่าน
2. **ระบบเลือกวิชา:** เลือกกลุ่มเรียนด้วยตนเอง หรือใช้ระบบ AI ช่วยวางแผนตารางเรียนที่ไม่ซ้อนทับกัน (จัดชุดวิชาได้สูงสุด 10 วิชา/10 รูปแบบ)
3. **ระบบลงทะเบียนยกภาค:** เพิ่มวิชาบังคับแบบกลุ่มอัตโนมัติ โดยระบบจะคัดเลือกเฉพาะกลุ่มเรียนที่ยังมีที่นั่งว่าง
4. **การยืนยันการลงทะเบียน:** ระบบตรวจสอบการชนของเวลา หากมีบางวิชาเต็ม ระบบจะลงทะเบียนวิชาที่ว่างให้สำเร็จ และคงวิชาที่เต็มไว้ในตะกร้าพร้อมแสดงเหตุผล
5. **ระบบกลุ่มเรียน (Friend Sync):** รองรับกลุ่มละไม่เกิน 5 คน โดยหัวหน้ากลุ่มสามารถซิงค์ตะกร้าและดำเนินการลงทะเบียนแทนสมาชิกในกลุ่มได้
6. **ระบบคิวสำรอง (Waitlist):** เมื่อได้รับสิทธิ์ลงทะเบียนในวิชาที่เต็ม ต้องทำการยืนยันสิทธิ์ภายใน **30 นาที**
7. **ส่วนตัวบุคคล (Profile):** ตรวจสอบเกรดเฉลี่ย (CGPA), เปลี่ยนรหัสผ่าน และออกจากระบบ

**ส่วนผู้ดูแลระบบ (Admin)** (เข้าใช้งานผ่านสิทธิ์ Admin)

* ควบคุมการเปิด-ปิดระบบลงทะเบียน และการเปิดโหมดปรับปรุงระบบ (Maintenance Mode)
* ตรวจสอบข้อมูลนักศึกษา (ค้นหาได้สูงสุด 20 รายการ) ทั้งตารางเรียน, สถานะคิว และผลการเรียน
* คำนวณและปรับปรุงยอดสรุปที่นั่งของแต่ละกลุ่มเรียน (`POST /admin/recount-seats`)

---

#### **ภาพรวม API (API Overview)**

**Base URL:** `[https://ups-regis-k49tx.faable.link](https://ups-regis-k49tx.faable.link)` (หรือ `http://<host>:8000` สำหรับการพัฒนา)

| หมวดหมู่ | รายการ Endpoints |
| --- | --- |
| **Authentication** | `POST /login` (จำกัดการลองผิดเกิน 5 ครั้ง/15 นาที) |
| **Courses** | `GET /courses/available/{id}`, `/courses/suggested/{id}`, `/sections/{code}`, `/courses/{id}/sections`, `/z-options/{id}/{z}` |
| **AI Planner** | `POST /ai-suggest` |
| **Cart System** | `POST /cart/add`, `GET /cart/{id}`, `POST /cart/batch_add_with_check`, `POST /cart/remove`, `POST /cart/confirm/{id}` |
| **Group Sync** | `POST /group/create |
| **Enrollment** | `GET /enroll/my/{id}`, `POST /enrollment/withdraw` |
| **Waitlist** | `POST /waitlist/join |
| **Student Info** | `POST /students/{id}/push-token`, `POST /students/{id}/change-password` |
| **Administration** | `GET /admin/config |

*สามารถเข้าชม Swagger API Interactive Documentation ได้ที่ `http://localhost:8000/docs` ขณะเปิดใช้งาน Local Server*

---

#### **ข้อมูลบัญชีสำหรับทดสอบ**

> **รหัสผ่านเริ่มต้นสำหรับทุกบัญชี:** `123456` (แนะนำให้เปลี่ยนรหัสผ่านหลังการเข้าสู่ระบบครั้งแรก)

| รหัสผู้ใช้ | บทบาท | หมายเหตุ |
| --- | --- | --- |
| `68100001` – `68100004` | นักศึกษา CPE ชั้นปีที่ 1 | บัญชีทดสอบทั่วไป |
| `68100101` | นักศึกษา ICT ชั้นปีที่ 1 | บัญชีทดสอบทั่วไป |
| `67100001` | นักศึกษา CPE ชั้นปีที่ 2 | มีข้อมูลประวัติการเรียนตัวอย่าง |
| `66100001` | นักศึกษา CPE ชั้นปีที่ 3 | บัญชีทดสอบทั่วไป |
| `68300001` / `67300001` | นักศึกษา LSM ชั้นปีที่ 1 / 2 | บัญชีทดสอบทั่วไป |
| `ADM001` | ผู้ดูแลระบบ (Admin) | สิทธิ์เข้าถึงแผงควบคุมระบบ |
| `GEN101` (Section 2) | รายวิชาทดสอบ | ตั้งค่าจำนวนผู้เรียนเต็ม (60/60) เพื่อทดสอบระบบ Waitlist |

---

#### **สคริปต์ช่วยการทำงาน**

สคริปต์อำนวยความสะดวกในโฟลเดอร์ `scripts/*.ps1` (สั่งงานผ่าน PowerShell):

* `start-all.ps1` — เริ่มการทำงานของ Backend, เปิดใช้ Tunnel และซิงค์ `BASE_URL` โดยอัตโนมัติ
* `sync-baseurl.ps1` — ดึงค่า Tunnel URL ล่าสุดเพื่ออัปเดตลงใน `api.js`
* `stop-all.ps1` — ยุติการทำงานของกระบวนการทั้งหมด
* `common.ps1` — รวบรวมค่าตัวแปรส่วนกลาง

สคริปต์สำรองข้อมูล: `python backend/backup_old_db.py` (ต้องกำหนดค่า `OLD_DATABASE_URL` ข้อมูลจะถูกจัดเก็บที่ `backend/supabase/backup/`)

---

#### **การปรับใช้บนเซิร์ฟเวอร์จริง (Production Deployment)**

* **Backend Service:** ดำเนินการผ่าน **Faable** โดยระบบจะทำการ Build และ Deploy อัตโนมัติเมื่อมีการ Push ไปยังสาขา `main` (ต้องกำหนดค่า `DATABASE_URL` ใน Environment Variables)
* **ทางเลือกอื่นที่รองรับ:** Replit (ผ่านการตั้งค่าไฟล์ `.replit` โดยกำหนดชื่อ Secret เป็น `APP_DATABASE_URL`)

---

#### **การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)**

* **`password authentication failed`:** ตรวจสอบและแก้ไขรหัสผ่านในไฟล์ `.env` หรือ Secrets บนเซิร์ฟเวอร์ให้ถูกต้อง แล้วทำการรีสตาร์ท Backend
* **`could not translate host name db.xxx`:** เปลี่ยนการเชื่อมต่อจาก Direct Connection (`:5432`) มาใช้ Connection Pooler (`:6543`)
* **แก้ไข `.env` แล้วระบบไม่อัปเดต:** สั่งยุติการทำงานของ Uvicorn (`Ctrl+C`) แล้วเปิดใหม่อีกครั้ง
* **อุปกรณ์เคลื่อนที่ ไม่สามารถเชื่อมต่อ Backend ได้:** ตรวจสอบว่าใช้อินเทอร์เน็ตวงเดียวกัน, กำหนด IP ให้ถูกต้อง และเปิดใช้งาน Uvicorn ด้วยคำสั่ง `--host 0.0.0.0`
* **การแจ้งเตือนแสดงผลเป็น HTML:** ตรวจสอบสถานะการทำงานของเซิร์ฟเวอร์ Backend
* **การเข้าสู่ระบบขึ้นข้อความ 429:** มีการเข้าสู่ระบบผิดพลาดเกินจำนวนที่กำหนด ให้รอ 15 นาที หรือรีสตาร์ท Backend เพื่อล้างค่า
* **Push Notification ไม่ทำงาน:** ต้องทดสอบผ่านอุปกรณ์จริงที่รันด้วย Dev Build และติดตั้งไฟล์ `google-services.json` เรียบร้อยแล้ว

---

#### **มาตรฐานความปลอดภัย**

* เข้ารหัสรหัสผ่านด้วยอัลกอริทึม **bcrypt** และสื่อสารผ่านโปรโตคอล **HTTPS**
* มีระบบ **Rate Limiting** ป้องกันการสุ่มรหัสผ่าน (Brute-force Protection)
* กำหนดสิทธิ์การเข้าถึง API สำหรับผู้ดูแลระบบ โดยตรวจสอบสถานะจากฐานข้อมูลทุกครั้ง
* จำกัดขอบเขตการเข้าถึง (CORS Policy) ให้รองรับเฉพาะโดเมนและเครือข่ายที่กำหนด
* ยกเว้นการ Commit ข้อมูลความลับ เช่น ไฟล์ `.env`, ไฟล์สำรองข้อมูล และ Access Token เข้าสู่ระบบควบคุมเวอร์ชัน (Git)

---

#### **โครงสร้างโปรเจกต์**

```text
├── App.js                  # State Router หลัก และระบบการแสดงผล Alert Modal
├── api.js                  # จุดจัดการการเชื่อมต่อ API ส่วนกลาง (Single Source of Truth)
├── usePushNotifications.js # ฟังก์ชันจัดการ Push Token ของ Expo
├── screens/                # ส่วนแสดงผลหน้าจอทั้งหมด 11 หน้า
├── components/shared.js    # คอมโพเนนต์ส่วนกลาง (NavBar, Header, Card)
├── backend/
│   ├── main.py             # แอปพลิเคชัน FastAPI (36 Endpoints) และบริการตั้งเวลา (Scheduler)
│   ├── database.py         # โครงสร้างฐานข้อมูล (SQLAlchemy Models)
│   ├── requirements.txt
│   └── supabase/migrations/# สคริปต์สำหรับการจัดการ Schema และข้อมูลตัวอย่าง
├── scripts/                # สคริปต์ระบบสำหรับการทำงานบน Windows
├── faable.json             # ไฟล์การตั้งค่าสำหรับการ Deploy บน Faable
└── assets/                 # ทรัพยากรไฟล์ภาพและสื่อของโปรเจกต์

```
