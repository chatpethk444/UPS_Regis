# Hugging Face Spaces (Docker) — รัน backend ถาวร ฟรี ไม่ใช้บัตร
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py database.py notifications.py ./

# รองรับทั้ง HF (7860) และ Koyeb/Render ($PORT) — default 7860
EXPOSE 7860
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"
