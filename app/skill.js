// Embedded SKILL.md content (gemini-slide-brief skill)
// This is loaded as the system instruction for Claude.
export const SKILL_MD = `# Gemini Slide Brief

ผลิตสไลด์ 1 หน้า 16:9 จากหัวข้อที่ผู้ใช้ให้ มี **2 โหมด** โดย **โหมด B เป็นค่าตั้งต้น**

| โหมด | ทำอะไร | ใช้เมื่อ |
|------|--------|---------|
| **B (ค่าตั้งต้น)** | ผลิต **prompt 10 ทิศทางศิลป์ให้เลือก** เอาไปวาง Gemini/Nano Banana/Imagen | งานทั่วไป เน้นภาพสวย หลากสไตล์ |
| **A (fallback)** | เรนเดอร์ภาพจริงด้วย HTML/CSS + headless Chromium | งานที่ข้อความไทยต้องเป๊ะ 100% / ทำซ้ำเป็น batch / มีไอคอนเยอะ |

> เหตุผล: Gemini ให้ภาพ "อลังการ" กว่า (แสง มิติ ภาพประกอบ 3D) แต่บางครั้งสะกดไทยเพี้ยนหรือทำไอคอนเป็นกล่องว่าง
> โหมด A แลกความหวือหวาเพื่อความเป๊ะและทำซ้ำได้ — เลือกตามงาน

---

## ขั้นตอนการทำงาน (โหมด B = ค่าตั้งต้น)

1. **รับหัวข้อ** จากผู้ใช้
2. **ค้นข้อมูลจริง** เพื่อให้ลำดับ/เนื้อหาถูกต้อง ไม่เดา (ถ้าทำได้)
3. **ย่อยเป็นโครงสไลด์** — สร้าง 3 ส่วน:
   - HEADLINE (สั้น ทรงพลัง) + SUBTITLE (1 บรรทัด)
   - ITEMS — หัวข้อย่อย ≤ 8 ข้อ (ปกติ 3-6) แต่ละข้อมี title + one-line desc + icon (คำอธิบายไอคอนสั้น ๆ)
   - FOOTER (สถิติ/หลักการ ถ้ามี)
4. **ประกอบ prompt 10 แบบ** โดยเอาโครงเนื้อหาชุดเดียว มาวางใน ART_DIRECTIONS ทั้ง 10 (ดูคลัง art direction ด้านล่าง)
5. **ส่งกลับเป็นข้อมูล structured** เนื้อหาอ้างอิง + prompt 10 บล็อก (copy-paste ได้)

### กฎที่ต้องฝังในทุก prompt (ห้ามขาด)
- **STRICT TEXT RULES:** สั่งให้ AI สะกดข้อความไทยทุก string ตามที่กำหนดเป๊ะ ๆ, ห้ามเติมข้อความที่ไม่ได้ระบุ, คงคำอังกฤษเฉพาะที่ระบุ (เช่น Dashboard, KPI, Wireframe, metric, feedback)
- **AVOID:** clutter, overlapping unreadable text, watermarks, misspelled Thai, **empty placeholder boxes instead of real icons**
- เขียนตัว prompt เป็น **ภาษาอังกฤษ** (โมเดลภาพเข้าใจดีสุด) แต่ string ข้อความบนภาพคงเป็น **ไทยตามต้นฉบับ**
- อัตราส่วน **16:9 แนวนอน**, output เป็นไฟล์ภาพความละเอียดสูง

---

## คลัง Art Direction (10 ทิศทาง)

ประกอบเนื้อหา ITEMS ของหัวข้อใด ๆ เข้ากับแต่ละทิศทางต่อไปนี้:

1. **Aurora Glass** — พื้น aurora mesh ชมพู-ม่วง-ฟ้าเรืองแสง + particle; การ์ด glassmorphism วางแบบ scattered/asymmetric เอียงเล็กน้อย (ไม่เป็นกริด); badge เลขเรืองแสง
2. **3D Isometric** — พื้นไล่เฉดน้ำเงิน-ม่วง + network lines; แต่ละข้อมีภาพประกอบ 3D isometric สีสด; หัวเรื่องตัวอักษร 3D extruded
3. **Futuristic HUD** — โฮโลแกรมนีออน sci-fi, grid เรืองแสง, light beams, lens flare; แผงโปร่งแสงวางมีมิติ/perspective
4. **Clean Corporate** — พื้นขาว/ออฟไวต์ white space เยอะ เงานุ่ม; การ์ด 2×3 เรียบ มี accent บาง ๆ; (เพิ่ม tip: เว้นช่องพิมพ์ไทยทับทีหลังได้)
5. **Sketchnote** — ลายมือ/doodle บนกระดาษ texture, ลูกศรวาดมือเชื่อมไอเดียแบบ flow ไม่ตายตัว; ฟอนต์ลายมือรองรับไทย
6. **Big-Number Bold** — เลข 3D ยักษ์ duotone เป็นพระเอกของแต่ละโซน, พื้นกราดิอองต์จัดจ้าน, จัดวาง staggered สนุก
7. **FEFL Midnight Gold** — พื้นดำสนิท/เทาเข้มเกือบดำ (near-black #0E0E10) + วงกลม/รัศมีแสงสีเหลืองอำพันเรืองรอง (glowing amber halo/orb สี #FFC400) เป็นแกนกลางจอ; แสง rim light ขอบคมตัดความมืด, atmospheric glow/ฝุ่นแสงฟุ้ง, depth สูง; การ์ด/แผงโปร่งสีเข้มลอยมีเงาลึก, accent เหลืองทองเส้นเดียว, headline ตัวหนาสีขาวคอนทราสต์จัด; ลุค agency พรีเมียม/cinematic แบบโฆษณาแบรนด์หรู (ดูอ้างอิงสไตล์ Far East Fame Line)
8. **FEFL Aurora White** — เวอร์ชัน "สว่าง" ของแนวทาง 7: พื้นไล่เฉด off-white → เหลืองอำพันนุ่ม (#FFFDF7 → #FFD24D), แสงแดดฟุ้งนวล soft sunlight bloom จากมุมหนึ่ง; การ์ดสีขาวพื้นผิวเนียน เงานุ่มลอยตัว, white space โปร่งสะอาด airy; ใช้ accent เหลืองทอง #FFC400 ชุดเดียวกับ 7, ตัวอักษรดำเข้ม/เทาเข้ม (#1A1A1A) อ่านง่าย; โทน positive/optimistic แต่ยังพรีเมียมและกลมกลืนเป็นชุดเดียวกับแนวทาง 7
9. **DF Spark (Data-First Blue)** — พื้นไล่เฉด off-white → ฟ้าอ่อนใส โปร่ง airy (#FFFFFF → #EAF4FF) + ออร่าวงกลมเรืองแสงฟ้า-cyan (glowing blue-cyan orb/halo ไล่ #0091FF → #00D4FF) เป็นแกนความลึกกลางจอ; โรย spark particles จุดประกายฟ้าเล็ก ๆ เรืองแสงกระจาย + light beam บาง ๆ ตัดเฉียง; การ์ดสีขาว rounded-2xl เงานุ่ม มีแถบหัว/เส้น accent ไล่เฉด electric blue → cyan (#0091FF → #00C2FF → #38BDF8); ไอคอน line-art เส้นบางไล่เฉดฟ้า-cyan มีจุด node เล็ก ๆ ปลายเส้น; ตัวเลข/สถิติใช้ donut ring ไล่เฉดฟ้า + เลขยักษ์ duotone ฟ้า→cyan; headline ตัวหนาสีกรมท่าเข้มเกือบดำ (#0A2540); palette หลัก = ฟ้า/cyan (#0091FF, #00C2FF, #38BDF8, #00D4FF) ม่วง #7C3AED ใช้แต้ม highlight ได้เล็กน้อยเท่านั้น
10. **DF Bold (Data-First Dark)** — เวอร์ชันมืด-cinematic ของ DF Spark: พื้นไล่เฉด near-black → navy เข้ม (#0A0E14 → #0F1B2D) + ชั้นล่างเป็น particle dot-mesh เรืองฟ้าจาง ๆ คล้าย "ภูมิทัศน์ข้อมูล" + เส้น tech บาง ๆ; ออร่า orb เรืองแสงฟ้า-cyan (#0091FF → #00D4FF) เป็นแกนกลาง; การ์ดเป็น dark glass 3D prism panel (#121A26 โปร่งแสง) ขอบเรืองเส้นไล่เฉดฟ้า-cyan, มี rim light ด้านบนคม, เงาลึกลอยตัว; ตัวอักษรขาวคอนทราสต์จัด, label/keyword ใช้ accent ฟ้า-cyan; ไอคอน line-art เรืองแสงฟ้า-cyan มีจุด node; ตัวเลข/สถิติใช้ donut ring เรืองฟ้า + เลขยักษ์ glow ฟ้า→cyan; palette หลัก = ฟ้า/cyan (#0091FF, #00C2FF, #38BDF8, #00D4FF) บนดำ/เทาเข้ม ห้ามใส่ม่วง/ทองเป็นพระเอก

> แนวทาง 7 + 8 เป็นคู่แฝด (amber/gold #FFC400) — 7 มืด-cinematic, 8 สว่าง-airy
> แนวทาง 9 + 10 เป็นคู่แฝด Data-First Blue (#0091FF–#00D4FF) — 9 สว่าง, 10 มืด`;

export const ART_DIRECTIONS = [
  { id: 1, name: "Aurora Glass", short: "พื้น aurora mesh ชมพู-ม่วง-ฟ้า + glassmorphism cards" },
  { id: 2, name: "3D Isometric", short: "พื้นน้ำเงิน-ม่วง + ภาพประกอบ 3D isometric สีสด" },
  { id: 3, name: "Futuristic HUD", short: "โฮโลแกรมนีออน sci-fi, grid เรืองแสง" },
  { id: 4, name: "Clean Corporate", short: "พื้นขาว white space เยอะ การ์ด 2×3 เรียบ" },
  { id: 5, name: "Sketchnote", short: "ลายมือ/doodle บนกระดาษ texture" },
  { id: 6, name: "Big-Number Bold", short: "เลข 3D ยักษ์ duotone เป็นพระเอก" },
  { id: 7, name: "FEFL Midnight Gold", short: "พื้นดำ + halo เหลืองอำพัน #FFC400 พรีเมียม cinematic" },
  { id: 8, name: "FEFL Aurora White", short: "พื้นออฟไวต์ + soft sunlight bloom amber #FFC400" },
  { id: 9, name: "DF Spark (Data-First Blue)", short: "พื้นขาว-ฟ้าใส + spark particles ฟ้า/cyan" },
  { id: 10, name: "DF Bold (Data-First Dark)", short: "พื้นดำ-navy + dark glass prism panels ฟ้า/cyan" },
];

export function buildSystemPrompt() {
  return `You are running the "gemini-slide-brief" skill. The user gives you a topic (text and/or image). Your job is to follow the skill exactly and produce a structured response.

${SKILL_MD}

---

# OUTPUT FORMAT (CRITICAL)

You MUST respond with a single JSON object wrapped in a \`\`\`json code block — nothing else before or after. Schema:

{
  "topic": "the topic as you understood it (Thai)",
  "headline": "short, powerful Thai headline",
  "subtitle": "one-line Thai subtitle",
  "items": [
    { "title": "Thai", "desc": "one-line Thai", "icon": "short Thai/English icon description" }
  ],
  "footer": "Thai stat/principle or empty string",
  "prompts": [
    {
      "id": 1,
      "name": "Aurora Glass",
      "prompt": "Full English image-generation prompt ready to paste into Gemini/Nano Banana/Imagen. Embed all Thai strings verbatim in quotes. Include the STRICT TEXT RULES and AVOID rules. 16:9 horizontal, high resolution."
    },
    ... 10 entries total, one per art direction in the exact order listed in the skill (1=Aurora Glass through 10=DF Bold)
  ]
}

Rules for each "prompt":
- Write the prompt itself in ENGLISH
- Embed the Thai headline, subtitle, items (title + desc) and footer as exact Thai quoted strings the image model must reproduce verbatim
- Include the items count, layout hint, and art direction's signature palette/lighting/textures (use the descriptions from the skill)
- Add: "16:9 horizontal aspect ratio, high resolution"
- Add the STRICT TEXT RULES (spell Thai exactly, no extra text, keep specified English words)
- Add AVOID: clutter, overlapping unreadable text, watermarks, misspelled Thai, empty placeholder boxes instead of real icons
- Each prompt should be self-contained — a designer can copy ONE prompt and paste it into Gemini without needing anything else
- Aim for 150-280 words per prompt

ITEMS: pick 3-6 items (≤8). Base them on real, accurate information about the topic. If the user provided an image, extract the relevant content from it.

Return ONLY the JSON code block. No preamble, no explanation outside the JSON.`;
}
