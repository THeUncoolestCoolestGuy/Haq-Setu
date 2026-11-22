"""
HaqSetu (हक-सेतु) - Comprehensive Automated Test Suite
Codebenders ACE Builders Hackathon 2026

Tests:
1. Scheme Schema & JSON Integrity
2. Multilingual Vernacular Slot Extractor (Marathi, Hindi, English)
3. Deterministic Rule Evaluator & Explainability Graph
4. Monetary Value Descending Order Sorting
5. Zero-PII Privacy Guardrail (Aadhaar Rejection)
6. SQLite Database & Role-Based Authentication (Shrey Paunwala Admin + Citizen)
7. Weekly Government Gazette Sync Engine (sync_engine.py)
8. End-to-End Flask API Endpoints
9. Schemes Sliding Drawer & Government Portal URLs
10. UI Guardrails & Negative Content Interception
11. Multilingual Voice Buffer & Drawer Assets
12. Multi-Persona E2E Analysis (Widow, Farmer, Tractor Mechanization)
13. Background Placeholder Guardrail (Zero Foreground Injection)
14. Raw Prompt Log Integrity & Cross-Directory Parity
15. Futuristic 4-Stage Discovery Pipeline & OpenAI Integration
16. MahaDBT Demographics & Inclusive Baseline Assumptions
"""

import unittest
import json
import os
import sys
import tempfile

# Ensure path is configured
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database
import engine
import sync_engine
import app

class TestHaqSetuSuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Initializes database and test client."""
        database.init_db()
        app.app.config['TESTING'] = True
        cls.client = app.app.test_client()

    # -------------------------------------------------------------
    # 1. SCHEME SCHEMA & JSON INTEGRITY
    # -------------------------------------------------------------
    def test_01_schemes_json_validity(self):
        """Verifies schemes.json is well-formed and meets all required guardrails."""
        schemes = engine.load_schemes()
        self.assertIsInstance(schemes, list)
        self.assertGreaterEqual(len(schemes), 6, "Must contain at least 6 flagship schemes")

        for s in schemes:
            self.assertIn("scheme_id", s)
            self.assertIn("scheme_name", s)
            self.assertIn("department", s)
            self.assertIn("benefit_amount", s)
            self.assertIn("monetary_value_inr", s)
            self.assertIsInstance(s["monetary_value_inr"], int)
            self.assertIn("official_fee_inr", s)
            self.assertIn("source_url", s)
            self.assertTrue(s["source_url"].startswith("https://"), "Source URL must be secure HTTPS")
            self.assertIn("last_verified_date", s)
            self.assertIn("eligibility_rules", s)
            self.assertIn("required_documents", s)

            # Test Document Hierarchy (Level 1 Foundation vs Level 2 Derived)
            for doc in s["required_documents"]:
                self.assertIn("doc_id", doc)
                self.assertIn("level", doc)
                self.assertIn(doc["level"], [1, 2], "Doc level must be 1 (foundation) or 2 (derived)")

    # -------------------------------------------------------------
    # 2. MULTILINGUAL VERNACULAR SLOT EXTRACTOR
    # -------------------------------------------------------------
    def test_02_marathi_slot_extraction(self):
        """Verifies extraction of land, crop damage, and education from Marathi text."""
        marathi_text = "माझं १.५ एकर कोरडवाहू शेत आहे, सोयाबीनचं नुकसान झालंय, मुलगी १२वी शिकतेय."
        slots = engine.extract_slots_deterministic(marathi_text)
        self.assertEqual(slots["state"], "Maharashtra")
        self.assertTrue(slots["is_farmer"])
        self.assertEqual(slots["land_holding_acres"], 1.5)
        self.assertTrue(slots["has_crop_loss"])
        self.assertTrue(slots["daughter_in_school"])

    def test_03_hindi_slot_extraction(self):
        """Verifies extraction of land size, income, and crop loss from Hindi text."""
        hindi_text = "हम विदर्भ से हैं, 3 एकड़ जमीन है, भारी बारिश से फसल खराब हो गई, आय 80 हजार है"
        slots = engine.extract_slots_deterministic(hindi_text)
        self.assertTrue(slots["is_farmer"])
        self.assertEqual(slots["land_holding_acres"], 3.0)
        self.assertTrue(slots["has_crop_loss"])
        self.assertEqual(slots["annual_income"], 80000)

    def test_04_english_slot_extraction(self):
        """Verifies extraction from English input."""
        en_text = "I am a small farmer with 4 acres of land and annual income 1.8 lakhs."
        slots = engine.extract_slots_deterministic(en_text)
        self.assertTrue(slots["is_farmer"])
        self.assertEqual(slots["land_holding_acres"], 4.0)
        self.assertEqual(slots["annual_income"], 180000)

    # -------------------------------------------------------------
    # 3. RULE EVALUATION & EXPLAINABILITY
    # -------------------------------------------------------------
    def test_05_explainable_rule_matching(self):
        """Verifies that rule engine generates transparent, auditable reasoning."""
        profile = {
            "state": "Maharashtra",
            "is_farmer": True,
            "is_landholder_farmer": True,
            "land_holding_acres": 1.5,
            "annual_income": 100000,
            "daughter_in_school": True,
            "gender": "female",
            "has_crop_loss": True,
            "has_notified_crop": True
        }
        results = engine.match_schemes(profile)
        self.assertGreater(results["total_matched"], 0)
        
        # Guardrail test: Never say "guaranteed", always "likely eligible"
        for item in results["matched_schemes"]:
            self.assertIn("Likely Eligible", item["status"])
            self.assertNotIn("guaranteed", item["status"].lower())
            self.assertGreater(len(item["passed_rules"]), 0)
            # Ensure explainability reason is present
            for rule in item["passed_rules"]:
                self.assertIn("Matched", rule["reason"])

    # -------------------------------------------------------------
    # 4. MONETARY VALUE DESCENDING ORDER
    # -------------------------------------------------------------
    def test_06_descending_order_monetary_sort(self):
        """Verifies schemes are strictly sorted by monetary_value_inr in descending order."""
        profile = {
            "state": "Maharashtra",
            "is_farmer": True,
            "is_landholder_farmer": True,
            "land_holding_acres": 2.0,
            "annual_income": 90000,
            "daughter_in_school": True,
            "gender": "female",
            "has_crop_loss": True,
            "has_notified_crop": True
        }
        results = engine.match_schemes(profile)
        matched = results["matched_schemes"]
        self.assertGreaterEqual(len(matched), 2)

        # Verify strict descending order
        monetary_values = [item["scheme"]["monetary_value_inr"] for item in matched]
        self.assertEqual(monetary_values, sorted(monetary_values, reverse=True), "Must be sorted in descending order!")

        # Verify top benefit flag
        self.assertTrue(matched[0].get("is_highest_benefit"), "Top scheme must be marked as highest benefit")
        
        # Verify cumulative total benefit calculation
        expected_total = sum(monetary_values)
        self.assertEqual(results["total_potential_benefit_inr"], expected_total)
        self.assertGreater(results["total_potential_benefit_inr"], 0)

    # -------------------------------------------------------------
    # 5. ZERO-PII PRIVACY GUARDRAIL (AADHAAR REJECTION)
    # -------------------------------------------------------------
    def test_07_aadhaar_pii_interception(self):
        """Verifies that any 12-digit Aadhaar pattern is blocked immediately."""
        aadhaar_payloads = [
            {"text": "My Aadhaar is 1234 5678 9012, please give me farmer scheme"},
            {"text": "Farmer in Solapur with ID 987654321098 and 2 acres"}
        ]
        for payload in aadhaar_payloads:
            res = self.client.post("/api/analyze", json=payload)
            self.assertEqual(res.status_code, 400)
            data = res.get_json()
            self.assertIn("Aadhaar", data["error"])
            self.assertIn("Privacy Guardrail", data["error"])

    # -------------------------------------------------------------
    # 6. DATABASE & AUTHENTICATION (SHREY PAUNWALA ADMIN + CITIZEN)
    # -------------------------------------------------------------
    def test_08_shrey_paunwala_admin_authentication(self):
        """Verifies admin credentials for Shrey Paunwala."""
        admin = database.authenticate_user("9999999999", "Password123")
        self.assertIsNotNone(admin)
        self.assertEqual(admin["role"], "admin")
        self.assertIn("Shrey Paunwala", admin["name"])

    def test_09_citizen_registration_and_auth(self):
        """Verifies citizen registration without collecting Aadhaar."""
        import time
        test_phone = f"91{int(time.time() * 100) % 100000000:08d}"
        # Register new citizen
        user = database.register_user(
            name="Anand Shinde", 
            phone=test_phone, 
            district="Nashik", 
            password="securepwd123", 
            taluka="Dindori"
        )
        self.assertIsNotNone(user)
        self.assertEqual(user["district"], "Nashik")

        # Authenticate
        auth = database.authenticate_user(test_phone, "securepwd123")
        self.assertIsNotNone(auth)
        self.assertEqual(auth["role"], "citizen")

    def test_10_application_stage_tracking(self):
        """Verifies advancing application stages in SQLite database."""
        # Authenticate demo citizen Ramesh Patil (id=1)
        u = database.authenticate_user("9876543210", "demo123")
        user_id = u["id"]

        # Advance stage
        scheme_id = "mh_namo_shetkari_2026"
        success = database.update_scheme_stage(user_id, scheme_id, "Submitted at CSC")
        self.assertTrue(success)

        schemes = database.get_user_schemes(user_id)
        target = next((s for s in schemes if s["scheme_id"] == scheme_id), None)
        self.assertIsNotNone(target)
        self.assertEqual(target["application_stage"], "Submitted at CSC")

    # -------------------------------------------------------------
    # 7. WEEKLY GOVERNMENT GAZETTE SYNC ENGINE
    # -------------------------------------------------------------
    def test_11_weekly_gazette_sync_engine(self):
        """Verifies automated polling of Maharashtra portals and log recording."""
        result = sync_engine.run_weekly_portal_sync(triggered_by="Unit Test Runner")
        self.assertTrue(result["success"])
        self.assertGreaterEqual(result["schemes_checked"], 6)
        self.assertIn("Gazette Check", result["gazette_bulletin"])

        # Verify sync_logs table has record
        history = sync_engine.get_sync_history()
        self.assertGreater(len(history), 0)
        self.assertEqual(history[0]["status"], "SUCCESS")

    # -------------------------------------------------------------
    # 8. END-TO-END FLASK API ENDPOINTS
    # -------------------------------------------------------------
    def test_12_flask_routes_e2e(self):
        """Verifies core HTTP routes and role-based permissions."""
        # 1. Home page renders
        r_home = self.client.get("/")
        self.assertEqual(r_home.status_code, 200)

        # 2. Public analysis API
        r_analyze = self.client.post("/api/analyze", json={
            "text": "माझं १.५ एकर शेत आहे, सोयाबीन पिकवतो, उत्पन्न १ लाख आहे"
        })
        self.assertEqual(r_analyze.status_code, 200)
        data = r_analyze.get_json()
        self.assertGreater(data["total_matched"], 0)
        self.assertIn("total_potential_benefit_inr", data)

        # 3. Admin login endpoint
        r_login = self.client.post("/api/auth/login", json={
            "phone": "9999999999",
            "password": "Password123"
        })
        self.assertEqual(r_login.status_code, 200)
        self.assertEqual(r_login.get_json()["user"]["role"], "admin")

        # 4. Admin Overview endpoint (Authorized)
        r_admin_view = self.client.get("/api/admin/overview")
        self.assertEqual(r_admin_view.status_code, 200)
        self.assertIn("citizens", r_admin_view.get_json())

        # 5. Admin Gazette Sync Trigger endpoint
        r_sync_trigger = self.client.post("/api/admin/sync-schemes")
        self.assertEqual(r_sync_trigger.status_code, 200)
        self.assertTrue(r_sync_trigger.get_json()["success"])

        # 6. Logout
        r_logout = self.client.post("/api/auth/logout")
        self.assertEqual(r_logout.status_code, 200)

        # 7. Admin Overview endpoint (Unauthorized after logout)
        r_unauth = self.client.get("/api/admin/overview")
        self.assertEqual(r_unauth.status_code, 401)

    def test_13_schemes_sliding_drawer_and_portal_urls(self):
        """Verifies schemes drawer data, portal URLs, and monetary value descending ordering."""
        r = self.client.get("/api/schemes")
        self.assertEqual(r.status_code, 200)
        schemes = r.get_json()
        self.assertGreaterEqual(len(schemes), 8)

        # Check all schemes have official government application portal URLs
        for s in schemes:
            self.assertTrue(s["portal_apply_url"].startswith("http"), f"Invalid portal URL for {s['scheme_id']}")
            self.assertIn("official_fee_inr", s)
            self.assertIn("monetary_value_inr", s)
            self.assertGreaterEqual(s["monetary_value_inr"], 0)

        # Check top scheme has the highest monetary benefit (MJPJAY Health Cover: Rs 5,00,000)
        sorted_schemes = sorted(schemes, key=lambda x: x.get("monetary_value_inr", 0), reverse=True)
        self.assertEqual(sorted_schemes[0]["monetary_value_inr"], 500000)
        self.assertIn("mjpjay", sorted_schemes[0]["scheme_id"])

    # -------------------------------------------------------------
    # 9. UI GUARDRAILS & CLEAN INTERFACE VERIFICATION
    # -------------------------------------------------------------
    def test_14_clean_ui_guardrails_and_negative_checks(self):
        """Verifies clean UI requirements, centered branding, sliding drawer, and absence of clunky meta labels."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")

        # 1. Positive checks: Brand, centered aura, right-side sliding drawer & multilingual tabs
        self.assertIn("HaqSetu", html)
        self.assertIn("हक-सेतु", html)
        self.assertIn("schemesDrawerTab", html)
        self.assertIn("schemesDrawer", html)
        self.assertIn("drawerLangMr", html)
        self.assertIn("drawerLangHi", html)
        self.assertIn("drawerLangEn", html)
        self.assertIn("voiceLanguage", html)

        # 2. Strict negative checks (User explicitly asked to remove all of these):
        self.assertNotIn("1-Click", html, "Must not contain '1-Click' shortcuts")
        self.assertNotIn("Judge Shortcut", html, "Must not contain 'Judge Shortcut'")
        self.assertNotIn("ACE 2026", html, "Must not contain 'ACE 2026'")
        self.assertNotIn("Zero PII: No Aadhaar Collected", html, "Must not contain 'Zero PII: No Aadhaar Collected'")
        self.assertNotIn("rules.json", html, "Must not expose internal 'rules.json'")
        self.assertNotIn("Problem Statement 5: Claim What's Yours", html, "Must not contain raw hackathon problem statement")
        self.assertNotIn("shield-check", html, "Must not contain old trustify shield-check emblem")

    # -------------------------------------------------------------
    # 10. MULTILINGUAL APP ASSETS & VOICE BUFFER VERIFICATION
    # -------------------------------------------------------------
    def test_15_multilingual_voice_and_drawer_assets(self):
        """Verifies trilingual translation dictionaries and cumulative voice loop in app.js."""
        app_js_path = os.path.join(os.path.dirname(__file__), "static", "app.js")
        with open(app_js_path, "r", encoding="utf-8") as f:
            js = f.read()

        # Check speech recognition loop runs from index 0 across all results (preventing forgotten phrases)
        self.assertIn("for (let i = 0; i < event.results.length; i++)", js)
        self.assertIn("speechSessionBase", js)

        # Check multilingual dictionary entries
        self.assertIn("SCHEME_MULTILINGUAL_CRITERIA", js)
        self.assertIn("mr-IN", js)
        self.assertIn("hi-IN", js)
        self.assertIn("en-IN", js)
        self.assertIn("DRAWER_UI_TEXTS", js)
        self.assertIn("PREDEFINED_LANGUAGE_SAMPLES", js)

    # -------------------------------------------------------------
    # 11. END-TO-END PERSONA ANALYSIS ACROSS MULTIPLE SCHEMES
    # -------------------------------------------------------------
    def test_16_multilingual_persona_matching_e2e(self):
        """Tests multiple diverse user personas (Farmer, Widow, Mechanization) through live analysis."""
        # Persona A: Senior destitute widow (Marathi)
        res_widow = self.client.post("/api/analyze", json={
            "text": "मी ६८ वर्षांची निराधार विधवा महिला आहे, उत्पन्न ५० हजारांपेक्षा कमी आहे, पेन्शन हवी."
        })
        self.assertEqual(res_widow.status_code, 200)
        data_widow = res_widow.get_json()
        widow_schemes = [m["scheme"]["scheme_id"] for m in data_widow["matched_schemes"]]
        self.assertIn("mh_sanjay_gandhi_niradhar_2026", widow_schemes)
        self.assertIn("mh_mjpjay_health_2026", widow_schemes)

        # Persona B: Vidarbha Cotton farmer with crop loss (Hindi)
        res_cotton = self.client.post("/api/analyze", json={
            "text": "हम विदर्भ से हैं, 3 एकड़ जमीन है, भारी बारिश से फसल खराब हो गई, आय 80 हजार है"
        })
        self.assertEqual(res_cotton.status_code, 200)
        data_cotton = res_cotton.get_json()
        cotton_schemes = [m["scheme"]["scheme_id"] for m in data_cotton["matched_schemes"]]
        self.assertIn("mh_pm_fasal_bima_1re", cotton_schemes)
        self.assertIn("mh_namo_shetkari_2026", cotton_schemes)

        # Persona C: Tractor buyer (English)
        res_tractor = self.client.post("/api/analyze", json={
            "text": "I am a farmer with 4 acres land looking for tractor and rotavator equipment subsidy."
        })
        self.assertEqual(res_tractor.status_code, 200)
        data_tractor = res_tractor.get_json()
        tractor_schemes = [m["scheme"]["scheme_id"] for m in data_tractor["matched_schemes"]]
        self.assertIn("mh_krishi_yantrikikaran_2026", tractor_schemes)

    # -------------------------------------------------------------
    # 12. BACKGROUND PLACEHOLDER & PROMPT LOG INTEGRITY
    # -------------------------------------------------------------
    def test_17_background_placeholder_guardrail(self):
        """Verifies that the citizen input box renders the sample text purely in the background (placeholder), not foreground."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")
        
        # In HTML, textarea must have placeholder and empty inner HTML
        import re
        m = re.search(r'<textarea[^>]*id=["\']citizenInput["\'][^>]*>(.*?)</textarea>', html, re.DOTALL)
        self.assertIsNotNone(m, "citizenInput textarea must exist")
        self.assertEqual(m.group(1).strip(), "", "citizenInput must NOT have foreground text by default")
        self.assertIn('placeholder="माझं १.५ एकर', html)

        # In JS, dynamic updates must assign to .placeholder and keep .value empty
        app_js_path = os.path.join(os.path.dirname(__file__), "static", "app.js")
        with open(app_js_path, "r", encoding="utf-8") as f:
            js = f.read()
        self.assertIn("inputElem.placeholder = sample.placeholder;", js)
        self.assertIn("inputElem.value = '';", js)

    def test_18_prompt_log_formatting_integrity(self):
        """Verifies that USER_PROMPTS_LOG.txt contains zero Turn/Prompt headers and matches across paths."""
        log_path = os.path.join(os.path.dirname(__file__), "USER_PROMPTS_LOG.txt")
        self.assertTrue(os.path.exists(log_path), "USER_PROMPTS_LOG.txt must exist")
        with open(log_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Must not contain any turn or prompt labels
        self.assertNotIn("Turn 1", content)
        self.assertNotIn("Turn 2", content)
        self.assertNotIn("[Turn", content)
        self.assertNotIn("Prompt:", content)
        self.assertNotIn("User Prompt:", content)

        # Must contain recent verbatim queries
        self.assertIn("mahimasharma03", content)
        self.assertIn("is our test suite up to date?", content)

    # -------------------------------------------------------------
    # 13. FUTURISTIC PIPELINE & OPENAI INTEGRATION
    # -------------------------------------------------------------
    def test_19_pipeline_visualization_and_openai_integration(self):
        """Verifies futuristic 4-stage pipeline metadata, UI conduit nodes, and OpenAI .env readiness."""
        # 1. Verify .env exists and has OPENAI_API_KEY
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        self.assertTrue(os.path.exists(env_path), ".env file must exist for OpenAI key")
        with open(env_path, "r", encoding="utf-8") as f:
            env_content = f.read()
        self.assertIn("OPENAI_API_KEY=", env_content)

        # 2. Verify API response contains pipeline_metadata with all 4 stages
        res = self.client.post("/api/analyze", json={
            "text": "1.5 acre land, soybean crop damage, annual income 1 lakh"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("pipeline_metadata", data)
        meta = data["pipeline_metadata"]
        self.assertIn("engine_used", meta)
        self.assertIn("execution_time_ms", meta)
        self.assertIn("stages", meta)
        self.assertEqual(len(meta["stages"]), 4, "Must contain all 4 pipeline stages")

        # 3. Verify UI contains the 4 connected conduit nodes and pipeline audit card
        res_ui = self.client.get("/")
        html = res_ui.data.decode("utf-8")
        self.assertIn("pipeStep1", html)
        self.assertIn("pipeStep2", html)
        self.assertIn("pipeStep3", html)
        self.assertIn("pipeStep4", html)
        self.assertIn("pipelineAuditCard", html)
        self.assertIn("pipelineLiveStatus", html)

    # -------------------------------------------------------------
    # 14. DEMOGRAPHIC CRITERIA & ADAPTIVE PROBING PROMPT
    # -------------------------------------------------------------
    def test_20_demographic_criteria_and_adaptive_probing_system_prompt(self):
        """Verifies MahaDBT demographic extraction, inclusive baseline assumptions, and UI refiners."""
        # 1. Base slots contain default inclusive assumptions
        slots = engine.extract_slots_deterministic("माझं १.५ एकर शेत आहे, सोयाबीन पिकवतो.")
        self.assertEqual(slots["financial_year"], "2026-2027")
        self.assertEqual(slots["religion"], "All")
        self.assertEqual(slots["caste_category"], "General / All")
        self.assertEqual(slots["department"], "All")
        self.assertFalse(slots["has_disability"])

        # 2. Extracts explicit demographic criteria when mentioned
        slots_explicit = engine.extract_slots_deterministic("मी ओबीसी शेतकरी आहे, दिव्यांग व्यक्ती आहे, 2026-2027 मध्ये कृषी योजना हवी.")
        self.assertEqual(slots_explicit["caste_category"], "OBC")
        self.assertTrue(slots_explicit["has_disability"])
        self.assertEqual(slots_explicit["department"], "Agriculture")

        # 3. HTML UI contains the 6 MahaDBT selector dropdowns
        res_ui = self.client.get("/")
        html = res_ui.data.decode("utf-8")
        self.assertIn("selFinancialYear", html)
        self.assertIn("selReligion", html)
        self.assertIn("selCasteCategory", html)
        self.assertIn("selAnnualIncome", html)
        self.assertIn("selDepartment", html)
        self.assertIn("selDisability", html)
        self.assertIn("--Select Financial Year--", html)
        self.assertIn("--Select--", html)

        # 4. API endpoint supports demographic dictionary overrides without blocking
        res_api = self.client.post("/api/analyze", json={
            "text": "Farmer looking for crop insurance",
            "demographics": {
                "financial_year": "2026-2027",
                "caste_category": "OBC",
                "religion": "Hindu",
                "annual_income": "120000"
            }
        })
        self.assertEqual(res_api.status_code, 200)
        data = res_api.get_json()
        self.assertEqual(data["profile"]["caste_category"], "OBC")
        self.assertEqual(data["profile"]["annual_income"], 120000)
        self.assertGreater(data["total_matched"], 0)


def run_tests():
    """Runs the test suite with formatted summary."""
    print("\n" + "="*60)
    print("🧪 HAQSETU (हक-सेतु) AUTOMATED TEST SUITE")
    print("="*60)
    suite = unittest.TestLoader().loadTestsFromTestCase(TestHaqSetuSuite)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    print("="*60)
    if result.wasSuccessful():
        print(f"🎉 ALL {result.testsRun} TESTS PASSED SUCCESSFULLY! 100% COMPLIANT.")
    else:
        print(f"❌ {len(result.failures)} FAILURES, {len(result.errors)} ERRORS DETECTED.")
    print("="*60 + "\n")
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
