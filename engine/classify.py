"""
Multilingual Grievance Classifier for JanaDhwani
Supports Health and Police departments.
Uses keyword rules with fallback, plus optional LLM classification.
"""
import re
import json
import sqlite3
from typing import Dict, Any, Optional
from app.config import GEMINI_API_KEY, DB_PATH

# Multilingual keywords dictionary for Health & Police
CATEGORY_RULES = {
    # HEALTH CATEGORIES
    "Hygiene/Cleanliness": {
        "dept": "HEALTH",
        "keywords": [
            "ಸ್ವಚ್ಛತೆ", "ಕಸ", "ಗಲೀಜು", "ವಾಸನೆ", "ದುರ್ನಾತ", "ಕೊಳಕು", "ಕ್ರಿಮಿ", "ಜಿರಳೆ", "ಸೊಳ್ಳೆ",
            "cleanliness", "hygiene", "dirty", "garbage", "trash", "smell", "stinking", "odor", "waste", "cockroach", "mosquitoes",
            "सफाई", "कचरा", "गंदगी", "बदबू",
            "శుభ్రత", "చెత్త", "దుర్వాసన"
        ],
        "default_summary": "Unhygienic ward condition and trash accumulation",
        "weight": 65,
        "urgency": "MEDIUM"
    },
    "Drinking Water/Sanitation": {
        "dept": "HEALTH",
        "keywords": [
            "ನೀರು", "ಕುಡಿಯುವ ನೀರು", "ನೀರಿಲ್ಲ", "ನಲ್ಲಿ", "ಫಿಲ್ಟರ್", "ನಲ್ಲಿ ನೀರು",
            "water", "drinking water", "no water", "tap", "filter", "ro plant", "washroom", "restroom", "latrine",
            "पानी", "पीने का पानी", "नल",
            "నీరు", "మంచి నీరు", "టాయిలెట్", "మరుగుదొడ్డి"
        ],
        "default_summary": "Drinking water supply or sanitation failure reported",
        "weight": 70,
        "urgency": "HIGH"
    },
    "Doctor/Staff Absent": {
        "dept": "HEALTH",
        "keywords": [
            "ಡಾಕ್ಟರ್", "ವೈದ್ಯರು", "ಗೈರುಹಾಜರಿ", "ಬಂದಿಲ್ಲ", "ಸಿಬ್ಬಂದಿ ಇಲ್ಲ", "ನರ್ಸ್ ಇಲ್ಲ", "ಯಾರೂ ಇಲ್ಲ",
            "doctor absent", "doctor not available", "no doctor", "staff missing", "nurse missing", "doctor late", "absent", "doctor",
            "डॉक्टर नहीं है", "कर्मचारी नहीं है", "अनुपस्थित",
            "డాక్టర్ లేరు", "వైద్యుడు లేడు"
        ],
        "default_summary": "Doctor or medical staff absent during duty hours",
        "weight": 85,
        "urgency": "HIGH"
    },
    "Medicine Shortage": {
        "dept": "HEALTH",
        "keywords": [
            "ಔಷಧಿ", "ಮಾತ್ರೆ", "ಇಂಜೆಕ್ಷನ್", "ಔಷಧಾಲಯ", "ಮೆಡಿಸಿನ್ ಇಲ್ಲ", "ಕೊರತೆ", "ಖಾಲಿಯಾಗಿದೆ",
            "medicine", "tablet", "injection", "pharmacy closed", "out of stock", "no medicine", "shortage", "syrup", "pharmacy",
            "दवा", "दवाई नहीं है", "इंजेक्शन",
            "మందులు", "ఇంజక్షన్", "మందులు లేవు"
        ],
        "default_summary": "Prescribed medicine shortage or pharmacy unavailable",
        "weight": 75,
        "urgency": "HIGH"
    },
    "Beds/Facilities": {
        "dept": "HEALTH",
        "keywords": [
            "ಹಾಸಿಗೆ", "ಬೆಡ್ ಇಲ್ಲ", "ಮಲಗಲು ಜಾಗವಿಲ್ಲ", "ವೀಲ್‌ಚೇರ್", "ಸ್ಟ್ರೆಚರ್", "ಫ್ಯಾನ್", "ಬೆಳಕು ಇಲ್ಲ",
            "bed", "no bed", "wheelchair", "stretcher", "fan not working", "ac not working", "sheet dirty",
            "बिस्तर", "बेड नहीं है", "व्हीलचेयर", "स्ट्रेचर",
            "మంచం", "బెడ్ లేదు", "వీల్‌చైర్"
        ],
        "default_summary": "Inadequate patient bed or essential facility shortage",
        "weight": 60,
        "urgency": "MEDIUM"
    },
    "Infrastructure Maintenance": {
        "dept": "HEALTH",
        "keywords": [
            "ಕಟ್ಟಡ", "ಗೋಡೆ", "ವಿದ್ಯುತ್", "ಲೈಟ್", "ಸೋರುತ್ತಿದೆ", "ಬಾಗಿಲು", "ಕಿಟಕಿ", "ಲಿಫ್ಟ್",
            "building", "electricity", "lift broken", "leakage", "broken door", "light fused", "maintenance",
            "बिजली", "लिफ्ट खराब", "छत टपकना",
            "భవనం", "విద్యుత్", "లిఫ్ట్ పని చేయడం లేదు"
        ],
        "default_summary": "Hospital physical infrastructure maintenance breakdown",
        "weight": 45,
        "urgency": "NORMAL"
    },
    "Staff Behaviour": {
        "dept": "HEALTH",
        "keywords": [
            "ವರ್ತನೆ", "ದುರ್ವರ್ತನೆ", "ಬೈದರು", "ಲಂಚ", "ಹಣ ಕೇಳಿದರು", "ಅವಮಾನ", "ನಿರ್ಲಕ್ಷ್ಯ",
            "behavior", "rude", "bribe", "money demanded", "harassment", "insult", "shouted", "neglect",
            "बुरा व्यवहार", "रिश्वत", "अपमान",
            "దురుసు ప్రవర్తన", "లంచం"
        ],
        "default_summary": "Unprofessional conduct or bribe demand reported by citizen",
        "weight": 70,
        "urgency": "HIGH"
    },

    # POLICE CATEGORIES
    "Cybercrime & Online Fraud": {
        "dept": "POLICE",
        "keywords": [
            "ಸೈಬರ್", "ಆನ್‌ಲೈನ್ ವಂಚನೆ", "ಓಟಿಪಿ", "ಖಾತೆಯಿಂದ ಹಣ", "ಲಿಂಕ್ ಕ್ಲಿಕ್", "ಫಿಶಿಂಗ್", "ಹಣ ಕದ್ದಿದ್ದಾರೆ",
            "cyber", "online fraud", "otp scam", "hacked", "phishing", "upi fraud", "bank account debited", "atm fraud", "online", "otp",
            "साइबर अपराध", "ऑनलाइन फ्रॉड", "ओटीपी",
            "సైబర్ క్రైమ్", "ఆన్‌లైన్ మోసం", "ఓటీపీ"
        ],
        "default_summary": "Cyber incident / unauthorized online financial deduction",
        "weight": 80,
        "urgency": "HIGH"
    },
    "Financial Fraud": {
        "dept": "POLICE",
        "keywords": [
            "ಹಣಕಾಸು ವಂಚನೆ", "ಚೀಟಿ ಫಂಡ್", "ಹಣ ಮೋಸ", "ಸಾಲದ ವಂಚನೆ", "ಬ್ಯಾಂಕ್ ವಂಚನೆ",
            "financial fraud", "cheating", "money scam", "chit fund", "loan scam", "forgery",
            "वित्तीय धोखाधड़ी", "धोखा",
            "ఆర్థిక మోసం", "చీటింగ్"
        ],
        "default_summary": "Financial cheating or fraudulent transaction dispute",
        "weight": 70,
        "urgency": "MEDIUM"
    },
    "Lost Property": {
        "dept": "POLICE",
        "keywords": [
            "ಕಳೆದುಹೋಗಿದೆ", "ಕಳೆದುಹೋದ", "ಮೊಬೈಲ್", "ಪರ್ಸ್", "ದಾಖಲೆ", "ಬ್ಯಾಗ್", "ಐಡಿ ಕಾರ್ಡ್",
            "lost", "missing", "wallet", "phone", "purse", "documents", "valuables", "bag",
            "मोबाइल खो गया", "पर्स खो गया", "दस्तावेज़ खो गए", "खो गया",
            "మొబైల్ పోయింది", "వాలెట్ పోయింది", "పోయిన"
        ],
        "default_summary": "Citizen report of lost valuable property or official document",
        "weight": 40,
        "urgency": "NORMAL"
    },
    "Traffic & Public Safety": {
        "dept": "POLICE",
        "keywords": [
            "ಟ್ರಾಫಿಕ್", "ಸಿಗ್ನಲ್", "ಅಡ್ಡಾದಿಡ್ಡಿ ಪಾರ್ಕಿಂಗ್", "ರಸ್ತೆ ತಡೆ", "ಅತಿವೇಗ", "ಧ್ವನಿವರ್ಧಕ", "ಪಾರ್ಕಿಂಗ್",
            "traffic", "parking", "signal", "reckless driving", "loudspeaker", "road blocked",
            "ट्रैफिक", "अवैध पार्किंग", "लाउडस्पीकर",
            "ట్రాఫిక్", "అక్రమ పార్కింగ్"
        ],
        "default_summary": "Public safety or persistent traffic obstruction concern",
        "weight": 50,
        "urgency": "NORMAL"
    },
    "Complaint Against Individual": {
        "dept": "POLICE",
        "keywords": [
            "ಜಗಳ", "ಬೆದರಿಕೆ", "ಹಲ್ಲೆ", "ಕಿರುಕುಳ", "ಗಲಾಟೆ", "ವೈಯಕ್ತಿಕ ದೂರು",
            "quarrel", "threat", "harassment", "assault threat", "fight", "nuisance neighbour", "dispute",
            "लड़ाई", "धमकी", "झगड़ा",
            "గొడవ", "బెదిరింపు"
        ],
        "default_summary": "Dispute or non-cognizable complaint against individual",
        "weight": 65,
        "urgency": "MEDIUM"
    }
}

def detect_language(text: str) -> str:
    """Detects primary language: kn, en, hi, te, ur."""
    # Unicode ranges
    has_kannada = bool(re.search(r"[\u0C80-\u0CFF]", text))
    if has_kannada:
        return "kn"
    has_hindi = bool(re.search(r"[\u0900-\u097F]", text))
    if has_hindi:
        return "hi"
    has_telugu = bool(re.search(r"[\u0C00-\u0C7F]", text))
    if has_telugu:
        return "te"
    has_urdu = bool(re.search(r"[\u0600-\u06FF]", text))
    if has_urdu:
        return "ur"
    return "en"

def classify_grievance(text: str, department_code: str = "HEALTH") -> Dict[str, Any]:
    """
    Classifies grievance text into appropriate category, summary, urgency, and sentiment.
    Respects the selected department ('HEALTH' or 'POLICE').
    """
    cleaned = text.lower().strip()
    detected_lang = detect_language(text)

    # 1. First search department-specific categories
    best_category = None
    best_score = 0
    matched_rule = None

    for cat_name, rule in CATEGORY_RULES.items():
        if rule["dept"] != department_code:
            continue
        score = 0
        for kw in rule["keywords"]:
            if kw.lower() in cleaned:
                score += 1
        if score > best_score:
            best_score = score
            best_category = cat_name
            matched_rule = rule

    # Fallback to default if no keyword matched
    if not best_category:
        if department_code == "HEALTH":
            best_category = "Drinking Water/Sanitation"
            matched_rule = CATEGORY_RULES[best_category]
        else:
            best_category = "Complaint Against Individual"
            matched_rule = CATEGORY_RULES[best_category]

    # Query DB to get matching category record ID if database exists
    cat_id = 1
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM categories WHERE name = ? AND department_code = ?", (best_category, department_code))
        row = cursor.fetchone()
        if row:
            cat_id = row[0]
        conn.close()
    except Exception:
        pass

    # Sentiment analysis
    sentiment = "NEGATIVE"
    urgent_words = ["urgent", "immediately", "severe", "critical", "ತಕ್ಷಣ", "ಗಂಭೀರ", "ತುರ್ತು", "jaldi", "turant"]
    if any(w in cleaned for w in urgent_words):
        sentiment = "URGENT"

    # English summary generation
    if detected_lang == "en" and len(text) < 150:
        english_summary = text.strip()
    else:
        english_summary = f"{matched_rule['default_summary']}. Reported issue: {text[:90]}"

    return {
        "category_name": best_category,
        "category_id": cat_id,
        "department_code": department_code,
        "english_summary": english_summary,
        "sentiment": sentiment,
        "urgency": matched_rule["urgency"],
        "weight": matched_rule["weight"],
        "detected_language": detected_lang
    }
