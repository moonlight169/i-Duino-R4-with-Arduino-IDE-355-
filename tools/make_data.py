# แปลง data/questions.json -> site/data/questions.js (ให้เปิด index.html ได้โดยไม่ต้องมีเซิร์ฟเวอร์)
# รัน: python site/tools/make_data.py   (จากโฟลเดอร์โปรเจกต์)
import json, pathlib

root = pathlib.Path(__file__).resolve().parents[2]
src = root / "data" / "questions.json"
dst = root / "site" / "data" / "questions.js"

data = json.loads(src.read_text(encoding="utf-8"))
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(
    "// สร้างอัตโนมัติจาก data/questions.json ด้วย site/tools/make_data.py — อย่าแก้ไฟล์นี้โดยตรง\n"
    "window.EXAM_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print(f"{dst}: {len(data)} บท, {sum(len(c['questions']) for c in data)} ข้อ")
