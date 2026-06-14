# SlidePro

เว็บแอปสำหรับสร้าง **prompt 10 รูปแบบ** สำหรับนำไปใช้กับ Gemini / Nano Banana / Imagen เพื่อสร้างภาพสไลด์ 1 หน้า 16:9

ขับเคลื่อนด้วย Claude API + `gemini-slide-brief` skill ที่ฝังไว้เป็น system prompt

## Features

- รับ input เป็น **ข้อความ** หรือ **รูปภาพ** (หรือทั้งสอง)
- AI สรุปเป็นโครงสไลด์ (headline / subtitle / items / footer)
- สร้าง prompt 10 ทิศทางศิลป์: Aurora Glass, 3D Isometric, Futuristic HUD, Clean Corporate, Sketchnote, Big-Number Bold, FEFL Midnight Gold, FEFL Aurora White, DF Spark, DF Bold
- กดปุ่ม **Copy prompt** เพื่อคัดลอกไปวางใน Gemini ได้ทันที
- หน้า Settings สำหรับใส่ Claude API Key (เก็บใน `localStorage` ของเบราว์เซอร์เท่านั้น)
- เลือก model ได้: Opus 4.8 / Sonnet 4.6 (default) / Haiku 4.5

## วิธีรัน

ต้องเปิดผ่าน HTTP server (ES module ใช้ `file://` ไม่ได้)

```bash
cd app
python3 -m http.server 8000
# เปิด http://localhost:8000
```

หรือใช้ static host เช่น GitHub Pages, Netlify, Vercel ก็ได้ — มีแค่ HTML/CSS/JS ไม่ต้อง build

## ตั้งค่าก่อนใช้ครั้งแรก

1. กดไอคอน ⚙️ มุมขวาบน
2. ใส่ Claude API Key (สร้างได้ที่ [console.anthropic.com](https://console.anthropic.com/settings/keys))
3. เลือก model ที่ต้องการ
4. กด บันทึก

## โครงสร้าง

```
app/
├── index.html      # UI
├── styles.css      # Dark theme (Data-First Blue)
├── app.js          # เรียก Claude API + จัดการ UI
└── skill.js        # ฝัง SKILL.md + รายการ art directions
```

## หมายเหตุด้านความปลอดภัย

- ใช้ `anthropic-dangerous-direct-browser-access: true` เพื่อเรียก API จากเบราว์เซอร์โดยตรง
- เหมาะสำหรับใช้ส่วนตัวเท่านั้น — ถ้าจะ deploy public ให้ทำ backend proxy เพื่อไม่ให้ API key รั่ว
- API Key เก็บใน `localStorage` ไม่ถูกส่งไปที่ไหนนอกจาก `api.anthropic.com`
