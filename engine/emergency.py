"""
Multilingual Emergency Detection Engine for JanaDhwani
Detects medical emergencies in Kannada, English, Hindi, and Telugu.
Directs citizens immediately to Emergency Desk or 108 Helpline.
"""
from typing import Dict, Any, Tuple

# Emergency keywords & phrases mapped to canonical concepts
EMERGENCY_KEYWORDS = {
    # Kannada phrases
    "ಎದೆ ನೋವು": "CHEST_PAIN",
    "ede novu": "CHEST_PAIN",
    "ಹೃದಯಾಘಾತ": "HEART_ATTACK",
    "hrudayaghata": "HEART_ATTACK",
    "ರಕ್ತಸ್ರಾವ": "SEVERE_BLEEDING",
    "raktasrava": "SEVERE_BLEEDING",
    "ರಕ್ತ ಸುರಿಯುತ್ತಿದೆ": "SEVERE_BLEEDING",
    "ಪ್ರಜ್ಞೆ ತಪ್ಪಿದೆ": "UNCONSCIOUS",
    "prajne tappide": "UNCONSCIOUS",
    "ಅಪಘಾತ": "ACCIDENT",
    "apaghata": "ACCIDENT",
    "ಹಾವು ಕಡಿತ": "SNAKE_BITE",
    "havu kadita": "SNAKE_BITE",
    "ಹೆರಿಗೆ ನೋವು": "DELIVERY_PAIN",
    "herige novu": "DELIVERY_PAIN",
    "ಉಸಿರಾಟ ತೊಂದರೆ": "BREATHING_DIFFICULTY",
    "usirata tondare": "BREATHING_DIFFICULTY",
    "ಉಸಿರು ಕಟ್ಟಿದೆ": "BREATHING_DIFFICULTY",
    "ವಿಷ ಸೇವನೆ": "POISON",
    "visha": "POISON",
    "ತುರ್ತು": "EMERGENCY",
    "turtu": "EMERGENCY",

    # English phrases
    "chest pain": "CHEST_PAIN",
    "heart attack": "HEART_ATTACK",
    "severe bleeding": "SEVERE_BLEEDING",
    "bleeding heavily": "SEVERE_BLEEDING",
    "unconscious": "UNCONSCIOUS",
    "fainted": "UNCONSCIOUS",
    "accident": "ACCIDENT",
    "snake bite": "SNAKE_BITE",
    "snakebite": "SNAKE_BITE",
    "delivery pain": "DELIVERY_PAIN",
    "labor pain": "DELIVERY_PAIN",
    "labour pain": "DELIVERY_PAIN",
    "breathing difficulty": "BREATHING_DIFFICULTY",
    "cannot breathe": "BREATHING_DIFFICULTY",
    "cant breathe": "BREATHING_DIFFICULTY",
    "poison": "POISON",
    "cardiac arrest": "HEART_ATTACK",

    # Hindi phrases
    "सीने में दर्द": "CHEST_PAIN",
    "seene mein dard": "CHEST_PAIN",
    "दिल का दौरा": "HEART_ATTACK",
    "dil ka daura": "HEART_ATTACK",
    "खून बह रहा है": "SEVERE_BLEEDING",
    "khoon bahna": "SEVERE_BLEEDING",
    "बेहोश": "UNCONSCIOUS",
    "behosh": "UNCONSCIOUS",
    "दुर्घटना": "ACCIDENT",
    "durghatna": "ACCIDENT",
    "सांप का काटना": "SNAKE_BITE",
    "saanp kaatna": "SNAKE_BITE",
    "प्रसव पीड़ा": "DELIVERY_PAIN",
    "prasav peeda": "DELIVERY_PAIN",
    "सांस लेने में तकलीफ": "BREATHING_DIFFICULTY",
    "saans": "BREATHING_DIFFICULTY",

    # Telugu phrases
    "ఛాతీ నొప్పి": "CHEST_PAIN",
    "chati noppi": "CHEST_PAIN",
    "గుండెపోటు": "HEART_ATTACK",
    "gundepotu": "HEART_ATTACK",
    "రక్తస్రావం": "SEVERE_BLEEDING",
    "raktasravam": "SEVERE_BLEEDING",
    "స్పృహ తప్పడం": "UNCONSCIOUS",
    "spruha tappadam": "UNCONSCIOUS",
    "ప్రమాదం": "ACCIDENT",
    "pramadam": "ACCIDENT",
    "పాము కాటు": "SNAKE_BITE",
    "paamu kaatu": "SNAKE_BITE",
    "ప్రసవ నొప్పులు": "DELIVERY_PAIN",
    "prasava noppulu": "DELIVERY_PAIN",
}

def detect_emergency(text: str) -> Tuple[bool, Dict[str, Any]]:
    """
    Scans complaint text for emergency indicators.
    Returns (is_emergency, details_dict).
    """
    if not text:
        return False, {}

    normalized = text.lower().strip()

    for phrase, concept in EMERGENCY_KEYWORDS.items():
        if phrase in normalized:
            return True, {
                "is_emergency": True,
                "concept": concept,
                "detected_phrase": phrase,
                "helpline": "108",
                "message_kn": "ಇದು ಗಂಭೀರ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಾಗಿದೆ. ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ಆಸ್ಪತ್ರೆಯ ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗಕ್ಕೆ (Emergency / Casualty Desk) ತೆರಳಿ ಅಥವಾ 108 ಗೆ ಕರೆ ಮಾಡಿ!",
                "message_en": "This is a serious medical emergency. Please go directly to the hospital Emergency/Casualty Desk right now or call 108 immediately!",
                "message_hi": "यह एक गंभीर आपातकालीन स्थिति है। कृपया तुरंत अस्पताल के आपातकालीन डेस्क (Emergency Desk) पर जाएं या 108 पर कॉल करें!",
                "message_te": "ఇది తీవ్రమైన అత్యవసర పరిస్థితి. దయచేసి వెంటనే ఆసుపత్రి అత్యవసర విభాగానికి (Emergency Desk) వెళ్ళండి లేదా 108 కు కాల్ చేయండి!"
            }

    return False, {"is_emergency": False}
