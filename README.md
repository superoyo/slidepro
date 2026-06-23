# SlidePro

เว็บแอปสำหรับสร้าง **prompt 10 รูปแบบ** + ภาพสไลด์ 1 หน้า 16:9 ขับเคลื่อนด้วย Claude API + `gemini-slide-brief` skill ที่ฝังไว้เป็น system prompt และ Gemini image gen (Nano Banana / Imagen 4)

## Features

- รับ input เป็น **ข้อความ** หรือ **รูปภาพ** (หรือทั้งสอง)
- AI สรุปเป็นโครงสไลด์ (headline / subtitle / items / footer)
- สร้าง prompt 10 ทิศทางศิลป์: Aurora Glass, 3D Isometric, Futuristic HUD, Clean Corporate, Sketchnote, Big-Number Bold, FEFL Midnight Gold, FEFL Aurora White, DF Spark, DF Bold
- Toggle เลือกได้: สร้างเฉพาะ prompt (default · ไม่เสีย Gemini cost) หรือ gen ภาพอัตโนมัติด้วย
- Lightbox: คลิกการ์ดดูภาพเต็ม + prompt + ปุ่ม Copy / Download / Regenerate
- Toolbar เหนือ grid: เปลี่ยน image model + Generate ใหม่ทั้งหมด (ใช้ prompt เดิม ไม่เปลืองค่า Claude)

## ตั้งค่า API Key — 2 วิธี

### วิธีที่ 1 (แนะนำสำหรับ Railway/server deployment) · ใช้ env var
ตั้ง environment variable บน Railway / Render / Fly / etc. — server จะอ่านและใช้อัตโนมัติ key ไม่หลุดไปเบราว์เซอร์เลย:

| Service | ชื่อ env (รับหลายชื่อ) |
|---------|---------|
| Claude  | `CLAUDE_API_KEY` หรือ `ANTHROPIC_API_KEY` หรือ `CLAUDE_API` |
| Gemini  | `GEMINI_API_KEY` หรือ `GOOGLE_API_KEY` หรือ `GEMINI_API` |

หน้าเว็บจะขึ้น status "Claude · ใช้ค่าจาก Railway" ทันที

### วิธีที่ 2 · กรอกใน Settings เอง
กดไอคอน ⚙️ มุมขวาบน → กรอก API key → save ไปที่ `localStorage` ของเบราว์เซอร์
- รับ Claude key: [platform.claude.com/settings/billing](https://platform.claude.com/settings/billing)
- รับ Gemini key (ฟรี): [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)

## วิธีรัน local

```bash
npm install
npm start
# เปิด http://localhost:3000
```

ถ้ามี env var ก็ใส่ตอนรันได้: `CLAUDE_API_KEY=sk-... npm start`

## โครงสร้าง

```
├── server.js       # Express backend: proxy + /api/config
├── index.html      # UI
├── styles.css      # Light theme + blue aura
├── app.js          # Frontend logic
├── skill.js        # ฝัง SKILL.md + รายการ art directions
└── package.json    # express dependency
```

## ความปลอดภัย

- ถ้าใช้ env var → API key อยู่บน server เท่านั้น เบราว์เซอร์เรียก `/api/claude` / `/api/gemini-image` แบบไม่ต้องส่ง key มา → key ไม่หลุดให้ inspect ใน DevTools
- ถ้าใช้ Settings → key เก็บใน `localStorage` และส่งไปกับ request ผ่าน `x-user-claude-key` / `x-user-gemini-key` header → จะมีให้เห็นใน Network tab เฉพาะของผู้ใช้คนนั้นเอง
