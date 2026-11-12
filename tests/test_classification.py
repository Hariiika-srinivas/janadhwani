"""
Tests for Multilingual Classification Engine (Health & Police)
"""
import pytest
from engine.classify import classify_grievance, detect_language

def test_language_detection():
    assert detect_language("ಕುಡಿಯುವ ನೀರಿಲ್ಲ") == "kn"
    assert detect_language("Water tap broken") == "en"
    assert detect_language("दवाई खत्म हो गई") == "hi"
    assert detect_language("మంచి నీరు లేదు") == "te"

def test_health_kannada_classification():
    # Water & Sanitation
    res = classify_grievance("ಹೆರಿಗೆ ವಾರ್ಡ್‌ನಲ್ಲಿ ಕುಡಿಯುವ ನೀರು ಇಲ್ಲ", "HEALTH")
    assert res["category_name"] == "Drinking Water/Sanitation"
    assert res["detected_language"] == "kn"

    # Medicine
    res2 = classify_grievance("ಔಷಧಾಲಯದಲ್ಲಿ ಬಿಪಿ ಮಾತ್ರೆಗಳು ಸಿಗುತ್ತಿಲ್ಲ", "HEALTH")
    assert res2["category_name"] == "Medicine Shortage"

    # Hygiene
    res3 = classify_grievance("ಶೌಚಾಲಯ ಗಲೀಜಾಗಿದೆ ತುಂಬಾ ವಾಸನೆ ಬರುತ್ತಿದೆ", "HEALTH")
    assert res3["category_name"] == "Hygiene/Cleanliness"

    # Doctor Absent
    res4 = classify_grievance("ವೈದ್ಯರು ಬಂದಿಲ್ಲ ರೋಗಿಗಳು ಕಾಯುತ್ತಿದ್ದಾರೆ", "HEALTH")
    assert res4["category_name"] == "Doctor/Staff Absent"

def test_health_english_classification():
    res = classify_grievance("No doctor available in pediatric ward for hours", "HEALTH")
    assert res["category_name"] == "Doctor/Staff Absent"

    res2 = classify_grievance("Broken taps and dirty washrooms in general ward", "HEALTH")
    assert res2["category_name"] in ("Drinking Water/Sanitation", "Hygiene/Cleanliness")

def test_police_classification():
    # Cybercrime
    res = classify_grievance("ನನ್ನ ಬ್ಯಾಂಕ್ ಖಾತೆಯಿಂದ ಆನ್‌ಲೈನ್ ಮೂಲಕ ಓಟಿಪಿ ಪಡೆದು ಹಣ ಕದ್ದಿದ್ದಾರೆ", "POLICE")
    assert res["category_name"] == "Cybercrime & Online Fraud"
    assert res["department_code"] == "POLICE"

    # Lost property
    res2 = classify_grievance("I lost my mobile phone and wallet in the central bus stand", "POLICE")
    assert res2["category_name"] == "Lost Property"

    # Traffic
    res3 = classify_grievance("Illegal parking on main road causing severe traffic jam", "POLICE")
    assert res3["category_name"] == "Traffic & Public Safety"
