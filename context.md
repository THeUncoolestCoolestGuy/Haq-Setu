# 🌐 Ambient Contextual Engineering (ACE) System Blueprint: HaqSetu

> **Platform**: Codebenders IDE  
> **Framework**: Ambient Contextual Engineering (ACE)  
> **Domain**: Public Services & Welfare Delivery (Problem Statement 5)

---

## 1. What is Ambient Contextual Engineering (ACE) in HaqSetu?

Traditional government welfare discovery engines (including apps like *Haqdarshak*) rely on **Explicit Parametric Ingestion**—forcing users to manually fill out 20 to 30 dropdown inputs (caste categories, land registry sub-codes, income tiers). This introduces severe user drop-off, form fatigue, and digital exclusion among semi-literate rural citizens.

**HaqSetu (हक-सेतु)** applies **Ambient Contextual Engineering (ACE)**:
Instead of asking repetitive questions, the system infers the ambient socio-economic context from **unstructured vernacular speech** (in Marathi, Hindi, or English).

```
[Ambient Signal]                 [Contextual Inference]              [Regulatory Schema]
Spoken Vernacular Audio   ──►   Multilingual Slot Extractor   ──►   Decoupled schemes.json
(e.g., "1.5 acre shet,           (land=1.5, farmer=true,             (Evaluates mathematical
 soybean nuksan, mulgi 12vi")     crop_loss=true, girl_child=true)    rules with zero hallucination)
```

---

## 2. The Four Pillars of ACE in this Codebase

### Pillar 1: Acoustic & Vernacular Ambient Ingestion
* Uses client-side Web Speech API running at the edge for instant transcription in **Marathi (`mr-IN`)**, **Hindi (`hi-IN`)**, and **English (`en-IN`)**.
* Eliminates server audio latency and expensive external transcription APIs.

### Pillar 2: Contextual Disambiguation & Adaptive Probing
* Rather than asking a battery of 20 questions, the engine calculates the *Information Gain* of missing slots.
* If a citizen omits their landholding or income, it generates **only 1 adaptive follow-up prompt** in plain language.

### Pillar 3: Decoupled Dynamic Rule Graph
* **Zero Hardcoded Logic**: Government welfare rules change with each budget cycle. All criteria are stored in `schemes.json` as an editable data schema.
* The rule engine performs strict deterministic evaluations (`<=`, `==`, `>=`) to ensure **100% explainability** and eliminate LLM hallucinations on statutory welfare numbers.

### Pillar 4: The Prerequisite Document Ladder
* Tackles the root cause of welfare failure in India: citizens lack the prerequisite certificates to apply.
* The engine builds a 2-tier document roadmap:
  * **Level 1 (Foundation)**: Identity proofs you already carry (Ration card, Voter ID).
  * **Level 2 (Derived)**: Official revenue certificates (Tahsildar Income Certificate, 7/12 Land Extract) complete with official statutory fees (₹15–₹33 on Aaple Sarkar) to protect citizens from middleman extortion.

---

## 3. Privacy by Design (Zero-PII Compliance)

* **No Aadhaar Collection**: The system does not solicit, collect, or persist 12-digit Aadhaar numbers or confidential identity tokens.
* Any accidental 12-digit entry in user input is intercepted and blocked at both the client and server levels.
* All outputs strictly use the non-guaranteed statutory label: **"Likely Eligible (पात्रतेची दाट शक्यता)"**.
