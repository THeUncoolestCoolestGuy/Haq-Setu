# 🏛️ HaqSetu (हक-सेतु) — Ambient Contextual Welfare Discovery

> **Built for Codebenders ACE Builders Hackathon 2026**  
> **Problem Statement 5: Citizens and Public Services — "Claim What's Yours"**  
> *Target State: Maharashtra | Target Demographic: Small & Marginal Farmers, Farm Labourers & Rural Families*

---

## 🌟 Overview & Why HaqSetu Exists

India has hundreds of central and state government schemes offering pensions, crop insurance, equipment subsidies, and scholarships. Yet, millions of eligible rural families miss out because:

1. Information is scattered across fragmented portals (e.g., *MahaDBT* for applications vs. *Aaple Sarkar* for revenue certificates).
2. Traditional apps force semi-literate citizens through **intimidating 25-question forms**.
3. Local middlemen (*dalals*) exploit citizens by charging ₹500 to ₹1,500 for services that are **legally free (₹0)**.

**HaqSetu (हक-सेतु)** solves this through **Ambient Contextual Engineering (ACE)**:
  Instead of asking 25 questions, a citizen speaks or types **one natural sentence in Marathi, Hindi, or English**. The engine extracts ambient socio-economic context, evaluates it against dynamic state regulatory schemas   (`schemes.json`), explains the exact reasoning behind every match, and produces a 1-page **Anti-Middleman Action Dossier**.

---

## 🚀 Key Features

* **🎙️ Zero-Latency Edge Voice Recognition**: Built-in Web Speech API supporting **मराठी (`mr-IN`)**, **हिंदी (`hi-IN`)**, and **English (`en-IN`)** running 100% on the client device.
  
* **💾 SQLite Database Persistence (`haqsetu.db`)**: Real SQL database storing citizen accounts, socio-economic profiles, and tracked application lifecycles.
  
* **🛡️ Government Nodal Officer Admin Console**: Dedicated admin role (`Shrey Paunwala`) with real-time audit tables, citizen distribution metrics, and live rule editors.
  
* **🔄 Weekly Government Portal Sync Engine (`sync_engine.py`)**: Automated polling of `krishi.maharashtra.gov.in` and `mahadbt.maharashtra.gov.in` to track Government Resolutions (GRs), verify deadlines, and audit rules weekly.
  
* **🔑 Zero-PII Citizen Authentication**: Secure Sign In / Register without asking for Aadhaar or confidential documents (Name, Mobile, District only).

* **📋 Real-Time Application Stage Tracker**: Tracks progress through 4 verified stages: *Discovered* $\to$ *Documents Pending* $\to$ *Submitted at CSC / Setu* $\to$ *DBT Credited*.
  
* **🧠 Explainable Rule Matching (Not a Black Box)**: Every matched scheme displays the exact criteria met (e.g., *"Matched: Landholding 1.5 acres is $\le$ 5.0 acres"*).
  
* **🪜 Document Readiness Ladder**: Solves the #1 reason welfare fails by distinguishing between *Foundational Documents You Have* (Level 1) and *Derived Certificates to Acquire First* (Level 2) with official government statutory fees.
  
* **🛡️ Strict Zero-PII Architecture**: Explicit guardrail—**No Aadhaar or sensitive ID numbers are ever collected or stored**. Built-in regex filters intercept and scrub accidental 12-digit entries.
  
* **⚠️ "Likely Eligible" Guardrail**: All results explicitly maintain non-guaranteed statutory language.
  
* **📝 Dynamic, Editable Scheme Rules (`schemes.json`)**: An interactive admin modal lets officials update income ceilings or deadlines without touching code.
  
* **📄 Anti-Middleman 1-Page Kiosk Action Dossier**: A 1-click printable / WhatsApp summary that prominently displays: **OFFICIAL GOVT FEE: ₹0 (FREE)**, preventing CSC tout extortion.

---

## ⚙️ Architecture & Ambient Contextual Engineering (ACE)

```
[Citizen Spoken / Typed Input (Marathi / Hindi / English)]
                         │
                         ▼
        [Ambient Contextual Slot Extractor]
      (Infers Land, Income, Crop Loss, Family slots)
                         │
                         ▼
       [Deterministic Rule Evaluator & Comparator]
           (Evaluates against schemes.json)
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
[Explainable Matches] [Doc Readiness Ladder] [1-Page Action Dossier]
 ("Likely Eligible")  (Level 1 vs Level 2)   (Print / WhatsApp)
```

---

## 🛠️ Quick Start Guide

### 1. Requirements
* Python 3.10+
* Dependencies: `Flask`, `requests`, `python-dotenv`

### 2. Run the Application
```bash
python app.py
```
Open your browser and navigate to:  
👉 `http://127.0.0.1:5000`

---

## 📜 Publicly Verified Government Sources
* [MahaDBT Portal](https://mahadbt.maharashtra.gov.in)
* [Department of Agriculture, GoM](https://krishi.maharashtra.gov.in)
* [Aaple Sarkar G2C Portal](https://aaplesarkar.mahaonline.gov.in)
* [Social Justice & Special Assistance Dept](https://sjsa.maharashtra.gov.in)
* [PM Fasal Bima Yojana Portal](https://pmfby.gov.in)
