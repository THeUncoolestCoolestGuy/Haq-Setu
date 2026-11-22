"""
HaqSetu (हक-सेतु) - Ambient Contextual Welfare Discovery Engine
Engineered for Codebenders ACE Builders Hackathon 2026.
Problem Statement 5: Claim What's Yours (Citizens and Public Services)
"""

import json
import os
import re
from typing import Dict, Any, List, Tuple
import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SCHEMES_FILE = os.path.join(os.path.dirname(__file__), "schemes.json")

def load_schemes() -> List[Dict[str, Any]]:
    """Loads editable scheme rules from JSON database."""
    if not os.path.exists(SCHEMES_FILE):
        return []
    with open(SCHEMES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_schemes(schemes: List[Dict[str, Any]]) -> bool:
    """Allows admins / officials to update scheme rules dynamically."""
    try:
        with open(SCHEMES_FILE, "w", encoding="utf-8") as f:
            json.dump(schemes, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving schemes: {e}")
        return False

# -------------------------------------------------------------
# 1. AMBIENT CONTEXTUAL SLOT EXTRACTOR
# -------------------------------------------------------------

def extract_slots_deterministic(text: str) -> Dict[str, Any]:
    """
    Fallback deterministic parser for Marathi, Hindi, and English.
    Extracts socio-economic ambient parameters without requiring an LLM API key.
    """
    t = text.lower()
    profile = {
        "input_text": text,
        "state": "Maharashtra", # Default target state
        "is_landholder_farmer": False,
        "is_farmer": False,
        "land_holding_acres": None,
        "annual_income": None,
        "gender": None,
        "age": None,
        "has_crop_loss": False,
        "has_notified_crop": False,
        "prior_subsidy_received": False,
        "has_no_prior_pond": True,
        "is_institutional_landowner": False,
        "family_members": None,
        "daughter_in_school": False,
        "is_destitute_widow_disabled": False,
        "financial_year": "2026-2027",
        "religion": "All",
        "caste_category": "General / All",
        "department": "All",
        "has_disability": False,
        "disability_type": "None",
        "missing_critical_fields": []
    }

    # Farmer / Agriculture indicators
    farmer_words = [
        "farmer", "kisan", "shetkari", "sheti", "kheti", "zameen", "land", 
        "crop", "fasal", "pik", "acre", "hektar", "बळीराजा", "शेतकरी", "शेती", 
        "जमीन", "पीक", "विमा", "सोयाबीन", "कापूस", "तूर", "कांदा"
    ]
    if any(w in t for w in farmer_words):
        profile["is_farmer"] = True
        profile["is_landholder_farmer"] = True
        profile["has_notified_crop"] = True

    # Land size extraction (acres / bigha / guntha / hectare)
    # e.g., "1.5 acre", "2 एकर", "3 एकड़", "5 bigha", "3 hectare"
    land_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:acre|acres|एकर|एकड़|हेक्टर|hectare|bigha|बीघा|गुंठा|guntha)', t)
    if land_match:
        val = float(land_match.group(1))
        # normalize: 1 hectare = 2.47 acres, 40 guntha = 1 acre
        if "हेक्टर" in t or "hectare" in t:
            val = val * 2.47
        elif "गुंठा" in t or "guntha" in t:
            val = val / 40.0
        profile["land_holding_acres"] = round(val, 2)
    elif profile["is_farmer"]:
        profile["land_holding_acres"] = 2.0 # Default marginal benchmark if unspecified

    # Income extraction
    # e.g., "income 1.2 lakh", "वार्षिक उत्पन्न १ लाख", "80 हजार", "income 80000"
    income_lakh_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|लाख)', t)
    income_thousand_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:thousand|thousands|हजार|हज़ार|k)', t)
    
    if income_lakh_match:
        profile["annual_income"] = int(float(income_lakh_match.group(1)) * 100000)
    elif income_thousand_match:
        profile["annual_income"] = int(float(income_thousand_match.group(1)) * 1000)
    else:
        income_num_match = re.search(r'(?:income|उत्पन्न|कमाई|आय|रुपये|rs\.?|inr)\s*[:=]?\s*(\d{4,7})', t)
        if income_num_match:
            profile["annual_income"] = int(income_num_match.group(1))
        else:
            # Contextual inference from low-income keywords
            if any(w in t for w in ["garib", "bpl", "poor", "गरीब", "अल्पभूधारक", "कामगार", "मजूर", "मजदूर"]):
                profile["annual_income"] = 90000

    # Gender & Family
    if any(w in t for w in ["mulgi", "beti", "daughter", "girl", "मुलगी", "लेक", "बेटी", "लड़की", "विद्यार्थिनी"]):
        profile["daughter_in_school"] = True
        profile["gender"] = "female"
    elif any(w in t for w in ["widow", "mahila", "aurat", "vidhva", "विधवा", "महिला", "स्त्री"]):
        profile["gender"] = "female"
        profile["is_destitute_widow_disabled"] = True

    # Destitute / Disability / Pension indicators
    if any(w in t for w in ["widow", "vidhva", "divyang", "apang", "disabled", "old age", "vridhha", "ज्येष्ठ नागरिक", "दिव्यांग", "अपंग", "निराधार"]):
        profile["is_destitute_widow_disabled"] = True
        if profile["annual_income"] is None:
            profile["annual_income"] = 40000
        if profile["age"] is None:
            profile["age"] = 66

    # Crop Loss / Calamity
    if any(w in t for w in ["loss", "damage", "paus", "drought", "nuksan", "nuksani", "barish", "नुकसान", "अवकाळी", "दुष्काळ", "खराब"]):
        profile["has_crop_loss"] = True

    # Disability indicators
    if any(w in t for w in ["divyang", "apang", "disabled", "disability", "दिव्यांग", "अपंग", "handicap"]):
        profile["has_disability"] = True
        profile["disability_type"] = "Benchmark / Physical"

    # Religion extraction
    if any(w in t for w in ["hindu", "हिंदू"]):
        profile["religion"] = "Hindu"
    elif any(w in t for w in ["muslim", "मुस्लिम", "मुसलमान"]):
        profile["religion"] = "Muslim"
    elif any(w in t for w in ["buddhist", "बौद्ध", "नवबौद्ध"]):
        profile["religion"] = "Buddhist"
    elif any(w in t for w in ["jain", "जैन"]):
        profile["religion"] = "Jain"
    elif any(w in t for w in ["christian", "ख्रिश्चन", "ईसाई"]):
        profile["religion"] = "Christian"
    elif any(w in t for w in ["sikh", "शीख"]):
        profile["religion"] = "Sikh"

    # Caste Category extraction
    if any(w in t for w in ["obc", "ओबीसी", "इतर मागास"]):
        profile["caste_category"] = "OBC"
    elif any(w in t for w in ["sc", "अनुसूचित जाती", "मातंग", "महार"]):
        profile["caste_category"] = "SC"
    elif any(w in t for w in ["st", "अनुसूचित जमाती", "आदिवासी", "tribal"]):
        profile["caste_category"] = "ST"
    elif any(w in t for w in ["vjnt", "विमुक्त", "भटक्या जमाती", "धनगर", "बंजारा"]):
        profile["caste_category"] = "VJNT"
    elif any(w in t for w in ["ews", "ईडब्ल्यूएस", "आर्थिक दुर्बल"]):
        profile["caste_category"] = "EWS"
    elif any(w in t for w in ["open", "general", "खुला प्रवर्ग"]):
        profile["caste_category"] = "General/Open"

    # Department interest extraction
    if any(w in t for w in ["कृषी", "शेती", "agri", "agriculture"]):
        profile["department"] = "Agriculture"
    elif any(w in t for w in ["सामाजिक न्याय", "social justice", "pension", "पेन्शन"]):
        profile["department"] = "Social Justice"
    elif any(w in t for w in ["आरोग्य", "health", "hospital", "दवाखाना"]):
        profile["department"] = "Public Health"

    # Gender extraction
    if re.search(r'\b(female|woman|girl|widow|महिला|मुलगी|स्त्री|विधवा|औरत|लड़की)\b', t):
        profile["gender"] = "female"
    elif re.search(r'\b(male|man|boy|पुरुष|मुलगा|आदमी|लड़का)\b', t):
        profile["gender"] = "male"

    # Identify critical missing fields for adaptive clarification
    if profile["is_farmer"] and profile["land_holding_acres"] is None:
        profile["missing_critical_fields"].append("land_holding_acres")
    if profile["annual_income"] is None:
        profile["missing_critical_fields"].append("annual_income")

    return profile

def extract_slots_with_gemini(text: str, api_key: str) -> Dict[str, Any]:
    """
    Extracts structured slots via Gemini API if an API key is provided.
    Falls back cleanly to deterministic parser if API is unavailable.
    """
    if not api_key or not api_key.strip():
        return extract_slots_deterministic(text)

    prompt = f"""
You are an expert Government Welfare Eligibility Assessor for Maharashtra, India.
Analyze the citizen's unstructured vernacular speech/text (Marathi/Hindi/English) and extract their socio-economic profile into a JSON object.

Input text from citizen:
"{text}"

Guardrails:
- Never collect or output Aadhaar numbers or bank account numbers.
- Return ONLY valid raw JSON with keys:
  - state (string, default "Maharashtra")
  - is_farmer (boolean)
  - is_landholder_farmer (boolean)
  - land_holding_acres (float or null, convert bigha/guntha/hectares to acres)
  - annual_income (integer in INR or null)
  - gender (male/female/other/null)
  - age (integer or null)
  - has_crop_loss (boolean)
  - has_notified_crop (boolean)
  - daughter_in_school (boolean)
  - is_destitute_widow_disabled (boolean)
  - summary (1 sentence summary in English of who this person is)
"""
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=8)
        if resp.status_code == 200:
            result_json = resp.json()
            raw_text = result_json["candidates"][0]["content"]["parts"][0]["text"]
            data = json.loads(raw_text)
            # Merge with defaults
            base = extract_slots_deterministic(text)
            for k, v in data.items():
                if v is not None:
                    base[k] = v
            return base
    except Exception as e:
        print(f"Gemini API fallback triggered due to: {e}")
    
    return extract_slots_deterministic(text)

def extract_slots_with_openai(text: str, api_key: str = None) -> Tuple[Dict[str, Any], str]:
    """
    Extracts structured slots via OpenAI (e.g. gpt-4o-mini) with zero-hallucination structured JSON.
    Returns (profile_dict, engine_name).
    Falls back cleanly to extract_slots_deterministic if key is absent or invalid.
    """
    key = (api_key or os.getenv("OPENAI_API_KEY", "")).strip()
    if not key:
        return extract_slots_deterministic(text), "Deterministic Ambient Engine (Local)"

    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
        
        system_prompt = (
            "You are an expert Government Welfare Eligibility Assessor for Maharashtra, India.\n"
            "Analyze the citizen's vernacular speech/text (Marathi, Hindi, or English) "
            "and extract their socio-economic profile into a strict JSON object based on MahaDBT criteria.\n\n"
            "MahaDBT & Welfare Parameters to extract:\n"
            "- financial_year: (string, e.g. '2026-2027', default '2026-2027')\n"
            "- religion: ('Hindu', 'Muslim', 'Christian', 'Buddhist', 'Jain', 'Sikh', 'Other', or 'All')\n"
            "- caste_category: ('General/Open', 'OBC', 'SC', 'ST', 'VJNT', 'SBC', 'EWS', or 'General / All')\n"
            "- annual_income: Family Annual Income integer in INR or null\n"
            "- gender: ('male', 'female', 'transgender', or null)\n"
            "- department: ('Agriculture', 'Social Justice & Special Assistance', 'Public Health', 'Tribal Development', 'Women & Child Development', or 'All')\n"
            "- has_disability: boolean (true if any disability or divyang status mentioned, else false)\n"
            "- disability_type: ('Physical/Locomotor', 'Visual', 'Hearing', 'Intellectual', '40%+ Benchmark', or 'None')\n"
            "- state: 'Maharashtra'\n"
            "- is_farmer: boolean\n"
            "- is_landholder_farmer: boolean\n"
            "- land_holding_acres: float or null (normalize 1 hectare = 2.47 acres, 40 guntha = 1 acre)\n"
            "- has_crop_loss: boolean\n"
            "- has_notified_crop: boolean\n"
            "- daughter_in_school: boolean\n"
            "- is_destitute_widow_disabled: boolean\n"
            "- has_no_prior_pond: boolean\n"
            "- is_institutional_landowner: boolean\n"
            "- adaptive_follow_up: (string) A polite, natural question in citizen's vernacular language asking for any unmentioned core criteria (Family Income, Caste Category, Religion, Gender, Disability status, Department, or Financial Year).\n"
            "- vernacular_summary: (string) A 1-2 sentence empathetic summary in citizen's vernacular language explaining what was understood and assumed.\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. PROBING QUESTION: If any of Family Annual Income, Religion, Caste Category, Gender, Disability status, Department, or Financial Year are unmentioned, ask for them politely in 'adaptive_follow_up'.\n"
            "2. RESILIENT BASELINE ASSUMPTIONS: If the citizen does NOT provide some of these details, DO NOT BLOCK them. Provide sensible, inclusive baseline assumptions (financial_year='2026-2027', religion='All', caste_category='General / All', has_disability=false, department='All') so they can immediately discover all eligible schemes.\n"
            "3. ZERO-PII: Strictly never output Aadhaar or personal identification numbers."
        )

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        
        base = extract_slots_deterministic(text)
        for k, v in data.items():
            if v is not None:
                base[k] = v
        return base, f"OpenAI ({model})"
    except Exception as e:
        print(f"OpenAI extraction fallback triggered: {e}")
        return extract_slots_deterministic(text), "Deterministic Ambient Engine (Local Fallback)"

def extract_slots(text: str, api_key_override: str = None) -> Tuple[Dict[str, Any], str]:
    """
    Unified extraction entry point:
    Prioritizes OpenAI if key is configured, then Gemini, else falls back cleanly to local deterministic engine.
    """
    openai_key = (api_key_override or os.getenv("OPENAI_API_KEY", "")).strip()
    if openai_key:
        profile, engine_name = extract_slots_with_openai(text, openai_key)
        if "Fallback" not in engine_name:
            return profile, engine_name

    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key:
        profile = extract_slots_with_gemini(text, gemini_key)
        return profile, "Gemini 1.5 Flash"

    return extract_slots_deterministic(text), "Deterministic Ambient Engine (Local)"

# -------------------------------------------------------------
# 2. DETERMINISTIC RULE EVALUATION & EXPLAINABILITY ENGINE
# -------------------------------------------------------------

def evaluate_rule(field_value: Any, operator: str, expected_value: Any) -> bool:
    """Evaluates an individual criterion rule safely."""
    if field_value is None:
        return None # Inconclusive / unverified
    
    if operator == "==":
        if isinstance(field_value, str) and isinstance(expected_value, str):
            return field_value.strip().lower() == expected_value.strip().lower()
        return field_value == expected_value
    elif operator == "in":
        if isinstance(expected_value, list):
            f_str = str(field_value).strip().lower()
            return any(f_str == str(v).strip().lower() for v in expected_value)
        return False
    elif operator == "<=":
        return float(field_value) <= float(expected_value)
    elif operator == ">=":
        return float(field_value) >= float(expected_value)
    elif operator == "<":
        return float(field_value) < float(expected_value)
    elif operator == ">":
        return float(field_value) > float(expected_value)
    elif operator == "!=":
        return field_value != expected_value
    return False

def match_schemes(profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates citizen's profile against the editable schemes.json rules.
    Outputs transparent reasoning, match scores, and document trees.
    """
    schemes = load_schemes()
    matched_results = []
    near_miss_results = []

    for scheme in schemes:
        rules = scheme.get("eligibility_rules", [])
        passed_rules = []
        failed_rules = []
        unverified_rules = []

        for r in rules:
            field = r["field"]
            op = r["operator"]
            expected = r["expected_value"]
            label = r["label"]
            desc = r["rule_description"]

            user_val = profile.get(field)
            res = evaluate_rule(user_val, op, expected)

            if res is True:
                passed_rules.append({
                    "rule": label,
                    "reason": f"Matched: Your stated '{field}' ({user_val}) satisfies requirement {op} {expected}.",
                    "status": "PASS"
                })
            elif res is False:
                failed_rules.append({
                    "rule": label,
                    "reason": f"Criterion Not Met: '{field}' is {user_val}, but requirement is {op} {expected}.",
                    "status": "FAIL"
                })
            else:
                unverified_rules.append({
                    "rule": label,
                    "reason": f"Self-Verification Required: Please verify {desc}",
                    "status": "UNVERIFIED"
                })

        total_rules = len(rules)
        passed_count = len(passed_rules)
        failed_count = len(failed_rules)
        unverified_count = len(unverified_rules)

        # Eligibility calculation with strict hackathon guardrail: "Likely Eligible", never guaranteed
        if failed_count == 0 and passed_count >= 1:
            match_confidence = round((passed_count / (passed_count + unverified_count)) * 100)
            status_text = "Likely Eligible (पात्रतेची दाट शक्यता)"
            matched_results.append({
                "scheme": scheme,
                "status": status_text,
                "confidence_score": match_confidence,
                "passed_rules": passed_rules,
                "unverified_rules": unverified_rules,
                "failed_rules": failed_rules,
                "is_likely_eligible": True
            })
        elif failed_count == 1 and passed_count >= 2:
            # Near Miss (e.g. income was slightly higher or land boundary)
            near_miss_results.append({
                "scheme": scheme,
                "status": "Near Miss (अटींची पडताळणी आवश्यक)",
                "passed_rules": passed_rules,
                "failed_rules": failed_rules,
                "unverified_rules": unverified_rules,
                "is_likely_eligible": False
            })

    # Sort matched schemes by monetary benefit value in DESCENDING order (Highest value first!)
    matched_results.sort(key=lambda x: x["scheme"].get("monetary_value_inr", 0), reverse=True)

    # Mark top monetary scheme
    if matched_results:
        matched_results[0]["is_highest_benefit"] = True

    # Calculate total potential monetary entitlement unlocked
    total_benefit_inr = sum(item["scheme"].get("monetary_value_inr", 0) for item in matched_results)

    # Compile Unified Document Readiness Ladder
    doc_ladder = build_document_ladder(matched_results)

    # Adaptive follow-up question if any critical parameters are missing
    follow_up_question = generate_adaptive_followup(profile, matched_results, input_text=profile.get("input_text", ""))

    return {
        "profile": profile,
        "matched_schemes": matched_results,
        "near_miss_schemes": near_miss_results,
        "document_ladder": doc_ladder,
        "adaptive_follow_up": follow_up_question,
        "total_matched": len(matched_results),
        "total_potential_benefit_inr": total_benefit_inr,
        "total_potential_benefit_formatted": f"₹{total_benefit_inr:,}"
    }

# -------------------------------------------------------------
# 3. DOCUMENT READINESS LADDER & ACTION DOSSIER
# -------------------------------------------------------------

def build_document_ladder(matched_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Builds a two-tier document hierarchy:
    Level 1: Foundational documents you already carry (Ration card, Voter ID)
    Level 2: Derived certificates to acquire (Income Cert, 7/12) with official govt fees
    """
    level1_docs = {}
    level2_docs = {}

    for item in matched_items:
        docs = item["scheme"].get("required_documents", [])
        for d in docs:
            doc_id = d["doc_id"]
            entry = {
                "name": d["name"],
                "official_cost_inr": d.get("official_cost_inr", 0),
                "how_to_get": d.get("how_to_get", "Consult Talathi or Seva Kendra"),
                "prerequisites": d.get("prerequisites", []),
                "needed_for_schemes": [item["scheme"]["scheme_name"]]
            }
            if d.get("level", 1) == 1:
                if doc_id in level1_docs:
                    level1_docs[doc_id]["needed_for_schemes"].append(item["scheme"]["scheme_name"])
                else:
                    level1_docs[doc_id] = entry
            else:
                if doc_id in level2_docs:
                    level2_docs[doc_id]["needed_for_schemes"].append(item["scheme"]["scheme_name"])
                else:
                    level2_docs[doc_id] = entry

    return {
        "level1_foundation": list(level1_docs.values()),
        "level2_derived": list(level2_docs.values())
    }

def generate_adaptive_followup(profile: Dict[str, Any], matched: List[Dict[str, Any]], input_text: str = "") -> str:
    """
    Generates a natural-language follow-up question asking for missing MahaDBT criteria
    (Family Income, Caste Category, Religion, Gender, Disability of any type, Department, Financial Year)
    in the citizen's own language (English, Marathi, or Hindi), while assuming inclusive defaults if unprovided.
    """
    if profile.get("adaptive_follow_up"):
        return profile["adaptive_follow_up"]

    t = (input_text or profile.get("input_text", "")).lower()
    has_devanagari = any('\u0900' <= char <= '\u097f' for char in t)
    is_marathi = has_devanagari and any(w in t for w in ["आहे", "माझं", "शेत", "मुलगी", "पाहिजे", "हवे", "होते", "झालं", "उत्पन्न", "मुलगा", "शिकत", "वर्ग", "जात"])
    is_hindi = has_devanagari and not is_marathi

    missing_fields = []
    if profile.get("caste_category") in [None, "General / All", "All", ""]:
        missing_fields.append("caste")
    if profile.get("religion") in [None, "All", ""]:
        missing_fields.append("religion")
    if profile.get("gender") in [None, ""]:
        missing_fields.append("gender")
    if not profile.get("has_disability") and not profile.get("is_destitute_widow_disabled") and profile.get("disability_type") in [None, "None", ""]:
        missing_fields.append("disability")
    if profile.get("annual_income") is None:
        missing_fields.append("income")

    if not missing_fields:
        return None

    if not has_devanagari:
        # User input is in English
        parts = []
        if "caste" in missing_fields: parts.append("Caste Category (General / OBC / SC / ST / EWS)")
        if "religion" in missing_fields: parts.append("Religion (Hindu, Muslim, Buddhist, Christian, Jain, etc.)")
        if "gender" in missing_fields: parts.append("Gender (Male / Female)")
        if "disability" in missing_fields: parts.append("Disability status (Divyang)")
        if "income" in missing_fields: parts.append("Family Annual Income")
        joined = ", ".join(parts)
        return (
            f"To check targeted scholarships and department benefits: Please specify your {joined}. "
            f"(Proceeding with inclusive General/Open defaults so you can explore eligible schemes below)."
        )
    elif is_hindi:
        # User input is in Hindi
        parts = []
        if "caste" in missing_fields: parts.append("जाति वर्ग (Caste: General / OBC / SC / ST / EWS)")
        if "religion" in missing_fields: parts.append("धर्म (Religion)")
        if "gender" in missing_fields: parts.append("लिंग (Gender: Male / Female)")
        if "disability" in missing_fields: parts.append("दिव्यांगता (Disability)")
        if "income" in missing_fields: parts.append("पारिवारिक वार्षिक आय")
        joined = ", ".join(parts)
        return (
            f"सटीक छात्रवृत्ति व विशेष योजनाओं के लिए: कृपया {joined} स्पष्ट करें। "
            f"(जानकारी न होने पर सभी के लिए सामान्य योजनाएं नीचे दिखाई गई हैं)।"
        )
    else:
        # User input is in Marathi
        parts = []
        if "caste" in missing_fields: parts.append("जात प्रवर्ग (Caste: General / OBC / SC / ST / EWS)")
        if "religion" in missing_fields: parts.append("धर्म (Religion)")
        if "gender" in missing_fields: parts.append("लिंग (Gender: Male / Female)")
        if "disability" in missing_fields: parts.append("दिव्यांगत्व (Disability)")
        if "income" in missing_fields: parts.append("कुटुंबाचे वार्षिक उत्पन्न")
        joined = ", ".join(parts)
        return (
            f"अधिक अचूक शिष्यवृत्ती व विशेष सवलतींसाठी: कृपया {joined} स्पष्ट करा. "
            f"(माहिती न दिल्यास सर्वसमावेशक गृहीत धरून योजना खाली दाखवल्या आहेत)."
        )
