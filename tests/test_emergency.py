"""
Tests for Multilingual Emergency Detection Engine
"""
import pytest
from engine.emergency import detect_emergency

def test_emergency_kannada():
    is_em, details = detect_emergency("ನನಗೆ ಎದೆ ನೋವು ಬರುತ್ತಿದೆ ತಕ್ಷಣ ಬನ್ನಿ")
    assert is_em is True
    assert details["concept"] == "CHEST_PAIN"
    assert "108" in details["helpline"]

    is_em2, details2 = detect_emergency("ರೋಗಿಗೆ ತೀವ್ರ ರಕ್ತಸ್ರಾವ ಆಗುತ್ತಿದೆ")
    assert is_em2 is True
    assert details2["concept"] == "SEVERE_BLEEDING"

    is_em3, details3 = detect_emergency("ಮಹಿಳೆಗೆ ಹೆರಿಗೆ ನೋವು ಕಾಣಿಸಿಕೊಂಡಿದೆ")
    assert is_em3 is True
    assert details3["concept"] == "DELIVERY_PAIN"

def test_emergency_english():
    is_em, details = detect_emergency("Patient having severe chest pain and breathlessness")
    assert is_em is True
    assert details["concept"] == "CHEST_PAIN"

    is_em2, details2 = detect_emergency("Severe bleeding from accident head injury")
    assert is_em2 is True
    assert details2["concept"] == "SEVERE_BLEEDING"

    is_em3, details3 = detect_emergency("Person is unconscious and fainted near OPD")
    assert is_em3 is True
    assert details3["concept"] == "UNCONSCIOUS"

def test_emergency_hindi():
    is_em, details = detect_emergency("मरीज को सीने में दर्द हो रहा है")
    assert is_em is True
    assert details["concept"] == "CHEST_PAIN"

    is_em2, details2 = detect_emergency("सांप का काटना हुआ है जल्दी मदद करें")
    assert is_em2 is True
    assert details2["concept"] == "SNAKE_BITE"

def test_emergency_telugu():
    is_em, details = detect_emergency("రోగికి ఛాతీ నొప్పి వస్తోంది")
    assert is_em is True
    assert details["concept"] == "CHEST_PAIN"

    is_em2, details2 = detect_emergency("తీవ్రమైన రక్తస్రావం జరుగుతోంది")
    assert is_em2 is True
    assert details2["concept"] == "SEVERE_BLEEDING"

def test_non_emergency():
    is_em, _ = detect_emergency("ವಾರ್ಡ್‌ನಲ್ಲಿ ಕುಡಿಯುವ ನೀರಿಲ್ಲ ನಲ್ಲಿ ಮುರಿದಿದೆ")
    assert is_em is False

    is_em2, _ = detect_emergency("The floor in OPD is dirty and needs sweeping")
    assert is_em2 is False
