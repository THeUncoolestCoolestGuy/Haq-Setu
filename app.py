"""
HaqSetu (हक-सेतु) - Flask Application Server
Codebenders ACE Builders Hackathon 2026
Problem Statement 5: Claim What's Yours
Includes SQLite Database Persistence, Citizen Authentication & Application Tracking.
"""

import os
import json
import re
import time
from flask import Flask, render_template, request, jsonify, session
from engine import (
    extract_slots,
    extract_slots_deterministic, 
    extract_slots_with_gemini, 
    extract_slots_with_openai,
    match_schemes, 
    load_schemes, 
    save_schemes
)
import database
import sync_engine

app = Flask(__name__)
app.config['SECRET_KEY'] = 'haqsetu-codebenders-ace-2026'

# Gemini API Key configuration (can be provided via environment or later via UI)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

@app.route("/")
def index():
    """Renders the main ambient discovery dashboard."""
    schemes = load_schemes()
    user = None
    if "user_id" in session:
        user = database.get_user_by_id(session["user_id"])
    return render_template("index.html", initial_schemes_count=len(schemes), user=user, gemini_configured=bool(GEMINI_API_KEY))

# -------------------------------------------------------------
# 1. CITIZEN AUTHENTICATION & PROFILE PERSISTENCE (ZERO PII)
# -------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    """Registers a new citizen with Name, Phone, District (Zero Aadhaar)."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    phone = data.get("phone", "").strip()
    district = data.get("district", "Maharashtra").strip()
    password = data.get("password", "").strip()
    taluka = data.get("taluka", "").strip()

    if not name or not phone or not password:
        return jsonify({"error": "Name, 10-digit mobile number, and password are required."}), 400

    # Basic phone validation (10 digits)
    if not re.match(r'^\d{10}$', phone):
        return jsonify({"error": "Please provide a valid 10-digit Indian mobile number."}), 400

    user = database.register_user(name, phone, district, password, taluka)
    if not user:
        return jsonify({"error": "A user with this mobile number is already registered. Please Sign In."}), 400

    session["user_id"] = user["id"]
    return jsonify({"success": True, "user": user, "message": "Registration successful!"})

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """Authenticates citizen via phone and password."""
    data = request.get_json() or {}
    phone = data.get("phone", "").strip()
    password = data.get("password", "").strip()

    user = database.authenticate_user(phone, password)
    if not user:
        return jsonify({"error": "Invalid mobile number or password."}), 401

    session["user_id"] = user["id"]
    return jsonify({"success": True, "user": user, "message": f"Welcome back, {user['name']}!"})

@app.route("/api/auth/demo-login", methods=["POST"])
def auth_demo_login():
    """1-Click Demo Login for Hackathon Judges (Ramesh Patil - Solapur)."""
    user = database.authenticate_user("9876543210", "demo123")
    if user:
        session["user_id"] = user["id"]
        return jsonify({"success": True, "user": user, "message": "Logged in as Demo Citizen: Ramesh Patil (Solapur)"})
    return jsonify({"error": "Demo profile unavailable"}), 500

@app.route("/api/auth/admin-login", methods=["POST"])
def auth_admin_login():
    """1-Click Government Admin / Nodal Officer Login for Hackathon Judges."""
    user = database.authenticate_user("9999999999", "Password123")
    if user:
        session["user_id"] = user["id"]
        return jsonify({"success": True, "user": user, "message": "Logged in as Govt Admin: Shrey Paunwala (Nodal Officer, Mantralaya)"})
    return jsonify({"error": "Admin profile unavailable"}), 500

@app.route("/api/admin/overview", methods=["GET"])
def admin_overview():
    """Returns analytics and registered citizen audit data for admins."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    current = database.get_user_by_id(session["user_id"])
    if not current or current.get("role") != "admin":
        return jsonify({"error": "Admin privileges required"}), 403
    
    stats = database.get_admin_overview()
    stats["schemes_count"] = len(load_schemes())
    stats["recent_syncs"] = sync_engine.get_sync_history()
    return jsonify(stats)

@app.route("/api/admin/sync-schemes", methods=["POST"])
def admin_sync_schemes():
    """Triggers an on-demand audit and sync against official Maharashtra government portals."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    current = database.get_user_by_id(session["user_id"])
    if not current or current.get("role") != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    admin_name = current.get("name", "Shrey Paunwala (Govt Admin)")
    result = sync_engine.run_weekly_portal_sync(triggered_by=f"Admin Manual Trigger ({admin_name})")
    return jsonify(result)

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    """Logs out current citizen."""
    session.pop("user_id", None)
    return jsonify({"success": True, "message": "Logged out successfully."})

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    """Returns currently authenticated citizen profile."""
    if "user_id" in session:
        user = database.get_user_by_id(session["user_id"])
        if user:
            user_schemes = database.get_user_schemes(user["id"])
            return jsonify({"logged_in": True, "user": user, "saved_schemes": user_schemes})
    return jsonify({"logged_in": False, "user": None, "saved_schemes": []})

# -------------------------------------------------------------
# 2. ELIGIBILITY ANALYSIS & AUTOMATIC PROFILE SAVING
# -------------------------------------------------------------

@app.route("/api/analyze", methods=["POST"])
def analyze_eligibility():
    """
    Ingests plain language (typed or voice-transcribed) in Marathi, Hindi, or English.
    Processes query through the 4-stage Discovery Pipeline:
    1. Zero-PII Ingestion & Sanitization
    2. LLM Context Perception & Vernacular Slot Extractor (OpenAI gpt-4o-mini / Local)
    3. Deterministic Government Rule Matrix & haqsetu.db
    4. Descending Monetary Benefit Optimization & Action Dossier
    Automatically persists to SQLite database if user is logged in.
    """
    start_time = time.time()
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    api_key_override = data.get("api_key", "").strip() or GEMINI_API_KEY

    if not text:
        return jsonify({"error": "Please provide your situation in plain speech or text."}), 400

    # Guardrail: Check for accidental Aadhaar entry (12-digit numbers)
    # Strictly do not collect or process sensitive PII
    if re.search(r'\b\d{4}\s?\d{4}\s?\d{4}\b', text):
        return jsonify({
            "error": "Privacy Guardrail: Aadhaar numbers or personal IDs are strictly NOT collected. Please remove ID numbers and describe only your general situation."
        }), 400

    # Pipeline Stage 2: Ambient / LLM Contextual Slot Extraction
    profile, engine_used = extract_slots(text, api_key_override)
    profile["input_text"] = text

    # Merge explicit demographic refiners if provided by user
    demographics = data.get("demographics") or {}
    for k in ["financial_year", "religion", "caste_category", "gender", "department", "disability_type"]:
        val = demographics.get(k)
        if val and val.strip() and not val.startswith("--Select"):
            profile[k] = val.strip()
    if demographics.get("annual_income"):
        try:
            profile["annual_income"] = int(demographics["annual_income"])
        except (ValueError, TypeError):
            pass
    if demographics.get("disability_type"):
        dt = demographics.get("disability_type")
        if dt and dt != "None" and not dt.startswith("--Select"):
            profile["has_disability"] = True
            profile["disability_type"] = dt
        elif dt == "None":
            profile["has_disability"] = False
            profile["disability_type"] = "None"
    if demographics.get("has_disability") is not None:
        profile["has_disability"] = bool(demographics["has_disability"])

    # Pipeline Stage 3: Deterministic Rule Evaluation against editable schemes.json
    results = match_schemes(profile)
    results["input_text"] = text

    # Pipeline Stage 4: Execution Metadata & Audit Trail
    elapsed_ms = round((time.time() - start_time) * 1000, 1)
    schemes_count = len(load_schemes())
    results["pipeline_metadata"] = {
        "engine_used": engine_used,
        "pii_scanned": True,
        "pii_status": "Clean (Zero-PII compliant)",
        "rules_evaluated": schemes_count,
        "execution_time_ms": elapsed_ms,
        "vernacular_summary": profile.get("vernacular_summary", ""),
        "stages": [
            {"id": 1, "name": "Zero-PII Ingestion", "status": "Clean", "detail": "Aadhaar scanner verified zero sensitive identifiers."},
            {"id": 2, "name": "LLM Context Engine", "status": "Resolved", "detail": f"Processed via {engine_used}."},
            {"id": 3, "name": "Rule Matrix & DB", "status": "Audited", "detail": f"Evaluated mathematical criteria across {schemes_count} schemes in schemes.json."},
            {"id": 4, "name": "Benefit Optimization", "status": "Unlocked", "detail": f"Sorted {results['total_matched']} eligible schemes in descending order ({results['total_potential_benefit_formatted']})."}
        ]
    }

    # If citizen is logged in, automatically persist profile and matched schemes to database!
    if "user_id" in session:
        user_id = session["user_id"]
        database.save_user_profile(user_id, profile, raw_text=text)
        for item in results.get("matched_schemes", []):
            database.save_user_scheme(user_id, item["scheme"], status="Likely Eligible", stage="Discovered")
        results["persisted_to_database"] = True
    else:
        results["persisted_to_database"] = False

    return jsonify(results)

# -------------------------------------------------------------
# 3. SAVED SCHEMES & APPLICATION TRACKER API
# -------------------------------------------------------------

@app.route("/api/user/schemes", methods=["GET", "POST"])
def manage_user_schemes():
    """Gets or updates tracked schemes for the authenticated citizen."""
    if "user_id" not in session:
        return jsonify({"error": "Please log in to track your applications."}), 401

    user_id = session["user_id"]

    if request.method == "POST":
        data = request.get_json() or {}
        scheme_data = data.get("scheme", {})
        status = data.get("status", "Likely Eligible")
        stage = data.get("stage", "Discovered")
        database.save_user_scheme(user_id, scheme_data, status=status, stage=stage)
        return jsonify({"success": True, "message": "Scheme saved to your profile tracker."})

    schemes = database.get_user_schemes(user_id)
    return jsonify({"schemes": schemes})

@app.route("/api/user/schemes/stage", methods=["POST"])
def update_stage():
    """Updates application progress stage (e.g. Discovered -> Documents Pending -> Submitted at CSC -> Approved)."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    scheme_id = data.get("scheme_id")
    new_stage = data.get("new_stage")

    if not scheme_id or not new_stage:
        return jsonify({"error": "scheme_id and new_stage required"}), 400

    success = database.update_scheme_stage(session["user_id"], scheme_id, new_stage)
    return jsonify({"success": success})

# -------------------------------------------------------------
# 4. SCHEME RULES MANAGEMENT (GUARDRAIL: EDITABLE DATA)
# -------------------------------------------------------------

@app.route("/api/schemes", methods=["GET", "POST"])
def manage_schemes():
    """
    Guardrail: Store scheme rules as editable data because they change often.
    Allows viewing and live editing of scheme rules.
    """
    if request.method == "POST":
        payload = request.get_json()
        if not payload or not isinstance(payload, list):
            return jsonify({"error": "Invalid scheme list payload"}), 400
        success = save_schemes(payload)
        return jsonify({"success": success, "message": "Scheme rules successfully updated."})
    
    return jsonify(load_schemes())

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n=======================================================")
    print(f"🚀 HaqSetu (हक-सेतु) Server Running on http://127.0.0.1:{port}")
    print(f"Database: SQLite (haqsetu.db) Active")
    print(f"Citizen Auth & Application Tracker Enabled")
    print(f"=======================================================\n")
    app.run(host="0.0.0.0", port=port, debug=True)
