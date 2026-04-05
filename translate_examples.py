#!/usr/bin/env python3
"""
翻译 words.json 中的 example 字段，追加 example_zh
使用 MiniMax API
"""
import json, os, time, urllib.request, urllib.parse

INPUT_FILE = "words.json"
OUTPUT_FILE = "words.json"
BATCH_SIZE = 20  # 每批翻译词数
MAX_RETRIES = 3
WAIT_SECONDS = 0.5

API_KEY = os.environ.get("MINIMAX_API_KEY", "")
BASE_URL = os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.chat").rstrip("/")

def translate_batch(pairs: list[dict]) -> list[dict]:
    """翻译一批 (en, example) 返回 [(en, example_zh), ...]"""
    if not API_KEY:
        print("错误: 请设置 MINIMAX_API_KEY 环境变量")
        exit(1)

    # 构造 prompt
    items_text = "\n".join([f"[{i}] EN: {p['en']}\n    例句: {p['example']}" for i, p in enumerate(pairs)])
    prompt = (
        "你是一个专业的软件英文翻译。请将以下英文例句翻译成中文（简洁专业，适合软件/程序员阅读）。"
        "只输出翻译结果，格式为 [序号] 中文翻译，不要解释。\n\n"
        + items_text
    )

    payload = json.dumps({
        "model": "MiniMax-Text-01",
        "messages": [{"role": "user", "content": prompt}]
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/v1/text/chatcompletion_v2",
        data=payload,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST"
    )

    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                content = result["choices"][0]["message"]["content"]
                # 解析返回
                translations = {}
                for line in content.split("\n"):
                    line = line.strip()
                    if line and "]" in line:
                        idx_str = line.split("]")[0].replace("[", "").strip()
                        zh_text = line.split("]", 1)[1].strip()
                        try:
                            idx = int(idx_str)
                            translations[idx] = zh_text
                        except ValueError:
                            pass
                return [translations.get(i, pairs[i]["example"]) for i in range(len(pairs))]
        except Exception as e:
            print(f"  请求失败 (attempt {attempt+1}): {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
            else:
                # 最后一次失败则返回原文
                return [p["example"] for p in pairs]

def main():
    # 加载
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    words = data["words"]

    # 找出需要翻译的
    needs_translate = [w for w in words if w.get("example") and not w.get("example_zh")]
    already_done = sum(1 for w in words if w.get("example_zh"))

    print(f"总词数: {len(words)}, 已有翻译: {already_done}, 需翻译: {len(needs_translate)}")

    if not needs_translate:
        print("没有需要翻译的词。")
        return

    # 批量处理
    total = len(needs_translate)
    for batch_start in range(0, total, BATCH_SIZE):
        batch = needs_translate[batch_start:batch_start + BATCH_SIZE]
        pairs = [{"en": w["en"], "example": w["example"]} for w in batch]
        translations = translate_batch(pairs)

        for w, zh in zip(batch, translations):
            w["example_zh"] = zh

        done = min(batch_start + BATCH_SIZE, total)
        print(f"  进度: {done}/{total} ({done*100//total}%)")

        if batch_start + BATCH_SIZE < total:
            time.sleep(WAIT_SECONDS)

    # 保存
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"完成！已翻译 {total} 条，文件已更新。")
    # 顺便更新缓存版本
    cache_file = INPUT_FILE  # 实际上 words.json 就是源，用不到 cache

if __name__ == "__main__":
    main()
