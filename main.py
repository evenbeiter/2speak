from fastapi import FastAPI, Query
from pydantic import BaseModel
from datetime import datetime
import random

app = FastAPI()

# 模擬語料庫資料（實作時請改成連線或讀檔）
sample_data = {
    "FFN": [
        {"zh": "我們今天需要開會。", "en": "We need to have a meeting today."},
        {"zh": "這項報告很重要。", "en": "This report is important."}
    ],
    "TranslateFX": [
        {"zh": "請提交最新的財報。", "en": "Please submit the latest financial report."},
        {"zh": "股市今天上漲了。", "en": "The stock market went up today."}
    ]
}

class SentenceResponse(BaseModel):
    zh: str
    en: str
    source: str
    template: str
    parsed: dict
    similar: list

def mock_analyze(en: str):
    # 模擬句型解析和模板
    return {
        "template": "Subject + Verb + Object",
        "parsed": {
            "subject": en.split(" ")[0],
            "verb": en.split(" ")[1] if len(en.split(" ")) > 1 else "",
            "object": " ".join(en.split(" ")[2:])
        }
    }

@app.get("/sentence", response_model=SentenceResponse)
def get_sentence(source: str = Query(...), topic: str = Query(...)):
    # 隨機選一句（未依據 topic 過濾）
    if source not in sample_data:
        return {"error": "Unknown source"}

    sentence = random.choice(sample_data[source])
    analysis = mock_analyze(sentence["en"])

    return {
        "zh": sentence["zh"],
        "en": sentence["en"],
        "source": source,
        "template": analysis["template"],
        "parsed": analysis["parsed"],
        "similar": []  # 後續會補上
    }
