"""
HaqSetu (हक-सेतु) - SQLite Database Layer
Stores user accounts, socio-economic profiles, and saved scheme applications.
Guardrail Compliant: No Aadhaar or sensitive ID numbers stored.
"""

import sqlite3
import os
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, List

DB_PATH = os.path.join(os.path.dirname(__file__), "haqsetu.db")

def get_connection():
    """Returns a connection to the SQLite database with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    """Hashes password with SHA-256 and salt."""
    salt = "haqsetu_salt_2026"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def init_db():
    """Initializes tables if they do not exist."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Users Table (Zero PII - Name, Phone, District only)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        district TEXT NOT NULL,
        taluka TEXT,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'citizen',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Citizen Socio-Economic Profiles Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS citizen_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        state TEXT DEFAULT 'Maharashtra',
        land_holding_acres REAL,
        annual_income INTEGER,
        is_farmer BOOLEAN DEFAULT 1,
        daughter_in_school BOOLEAN DEFAULT 0,
        has_crop_loss BOOLEAN DEFAULT 0,
        raw_speech_text TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # 3. Saved Schemes & Application Tracker Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_schemes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        scheme_id TEXT NOT NULL,
        scheme_name TEXT NOT NULL,
        benefit_amount TEXT,
        official_fee_inr INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Likely Eligible',
        application_stage TEXT DEFAULT 'Discovered',
        portal_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, scheme_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    conn.commit()

    # Pre-seed a sample demo citizen profile for hackathon judges
    cursor.execute("SELECT id FROM users WHERE phone = '9876543210'")
    if not cursor.fetchone():
        demo_pwd = hash_password("demo123")
        cursor.execute("""
        INSERT INTO users (name, phone, district, taluka, password_hash, role)
        VALUES ('Ramesh Patil (रमेश पाटील)', '9876543210', 'Solapur', 'Pandharpur', ?, 'citizen')
        """, (demo_pwd,))
        user_id = cursor.lastrowid

        cursor.execute("""
        INSERT INTO citizen_profiles (user_id, state, land_holding_acres, annual_income, is_farmer, daughter_in_school, has_crop_loss, raw_speech_text)
        VALUES (?, 'Maharashtra', 1.5, 100000, 1, 1, 1, 'माझं १.५ एकर कोरडवाहू शेत आहे, सोयाबीनचं नुकसान झालंय, मुलगी १२वी शिकतेय.')
        """, (user_id,))

        cursor.execute("""
        INSERT INTO user_schemes (user_id, scheme_id, scheme_name, benefit_amount, official_fee_inr, status, application_stage, portal_url)
        VALUES 
        (?, 'mh_namo_shetkari_2026', 'Namo Shetkari Mahasanman Nidhi Yojana', '₹6,000 / year', 0, 'Likely Eligible', 'Documents Pending', 'https://mahadbt.maharashtra.gov.in'),
        (?, 'mh_pm_fasal_bima_1re', 'PM Fasal Bima Yojana (₹1 Token Scheme)', 'Full Risk Cover', 1, 'Likely Eligible', 'Discovered', 'https://pmfby.gov.in')
        """, (user_id, user_id))

        conn.commit()

    # Pre-seed or Update Government Admin User for Hackathon Evaluation
    admin_pwd = hash_password("Password123")
    cursor.execute("SELECT id FROM users WHERE phone = '9999999999'")
    existing_admin = cursor.fetchone()
    if not existing_admin:
        cursor.execute("""
        INSERT INTO users (name, phone, district, taluka, password_hash, role)
        VALUES ('Shrey Paunwala (Govt Admin / Nodal Officer)', '9999999999', 'Mumbai (Mantralaya HQ)', 'Secretariat', ?, 'admin')
        """, (admin_pwd,))
    else:
        cursor.execute("""
        UPDATE users 
        SET name = 'Shrey Paunwala (Govt Admin / Nodal Officer)', password_hash = ?
        WHERE phone = '9999999999'
        """, (admin_pwd,))
    conn.commit()

    conn.close()

# -------------------------------------------------------------
# User Auth Queries
# -------------------------------------------------------------

def register_user(name: str, phone: str, district: str, password: str, taluka: str = "") -> Optional[Dict[str, Any]]:
    """Registers a new citizen user."""
    conn = get_connection()
    cursor = conn.cursor()
    pwd_hash = hash_password(password)
    try:
        cursor.execute("""
        INSERT INTO users (name, phone, district, taluka, password_hash)
        VALUES (?, ?, ?, ?, ?)
        """, (name, phone, district, taluka, pwd_hash))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return {"id": user_id, "name": name, "phone": phone, "district": district}
    except sqlite3.IntegrityError:
        conn.close()
        return None

def authenticate_user(phone: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticates citizen by phone and password."""
    conn = get_connection()
    cursor = conn.cursor()
    pwd_hash = hash_password(password)
    cursor.execute("""
    SELECT id, name, phone, district, taluka, role FROM users
    WHERE phone = ? AND password_hash = ?
    """, (phone, pwd_hash))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Fetches user details by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, phone, district, taluka, role FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

# -------------------------------------------------------------
# Profile & Application Tracking Queries
# -------------------------------------------------------------

def save_user_profile(user_id: int, profile_data: Dict[str, Any], raw_text: str = ""):
    """Saves or updates citizen's contextual profile."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO citizen_profiles (user_id, state, land_holding_acres, annual_income, is_farmer, daughter_in_school, has_crop_loss, raw_speech_text, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
        state = excluded.state,
        land_holding_acres = excluded.land_holding_acres,
        annual_income = excluded.annual_income,
        is_farmer = excluded.is_farmer,
        daughter_in_school = excluded.daughter_in_school,
        has_crop_loss = excluded.has_crop_loss,
        raw_speech_text = excluded.raw_speech_text,
        updated_at = CURRENT_TIMESTAMP
    """, (
        user_id,
        profile_data.get("state", "Maharashtra"),
        profile_data.get("land_holding_acres"),
        profile_data.get("annual_income"),
        profile_data.get("is_farmer", True),
        profile_data.get("daughter_in_school", False),
        profile_data.get("has_crop_loss", False),
        raw_text
    ))
    conn.commit()
    conn.close()

def save_user_scheme(user_id: int, scheme_data: Dict[str, Any], status: str = "Likely Eligible", stage: str = "Discovered"):
    """Saves or updates a scheme for a citizen's application tracker."""
    conn = get_connection()
    cursor = conn.cursor()
    s = scheme_data
    cursor.execute("""
    INSERT INTO user_schemes (user_id, scheme_id, scheme_name, benefit_amount, official_fee_inr, status, application_stage, portal_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, scheme_id) DO UPDATE SET
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    """, (
        user_id,
        s.get("scheme_id"),
        s.get("scheme_name"),
        s.get("benefit_amount"),
        s.get("official_fee_inr", 0),
        status,
        stage,
        s.get("portal_apply_url", "")
    ))
    conn.commit()
    conn.close()

def get_user_schemes(user_id: int) -> List[Dict[str, Any]]:
    """Retrieves all tracked schemes for a citizen."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, scheme_id, scheme_name, benefit_amount, official_fee_inr, status, application_stage, portal_url, created_at, updated_at
    FROM user_schemes
    WHERE user_id = ?
    ORDER BY id DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_scheme_stage(user_id: int, scheme_id: str, new_stage: str) -> bool:
    """Updates application progress stage (e.g. Discovered -> Documents Gathered -> Submitted at CSC)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE user_schemes
    SET application_stage = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND scheme_id = ?
    """, (new_stage, user_id, scheme_id))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0

# -------------------------------------------------------------
# Admin Queries
# -------------------------------------------------------------

def get_admin_overview() -> Dict[str, Any]:
    """Returns analytics, registered citizens, and applications for government admins."""
    conn = get_connection()
    cursor = conn.cursor()

    # Total Citizens
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'citizen'")
    total_citizens = cursor.fetchone()["count"]

    # Total Tracked Applications
    cursor.execute("SELECT COUNT(*) as count FROM user_schemes")
    total_applications = cursor.fetchone()["count"]

    # District Breakdown
    cursor.execute("""
    SELECT district, COUNT(*) as count 
    FROM users 
    WHERE role = 'citizen' 
    GROUP BY district
    """)
    district_rows = cursor.fetchall()
    districts = {r["district"]: r["count"] for r in district_rows}

    # Citizen details with their profile
    cursor.execute("""
    SELECT u.id, u.name, u.phone, u.district, u.taluka, u.created_at,
           p.land_holding_acres, p.annual_income, p.is_farmer,
           COUNT(s.id) as saved_schemes_count
    FROM users u
    LEFT JOIN citizen_profiles p ON u.id = p.user_id
    LEFT JOIN user_schemes s ON u.id = s.user_id
    WHERE u.role = 'citizen'
    GROUP BY u.id
    ORDER BY u.id DESC
    """)
    citizens = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "total_citizens": total_citizens,
        "total_applications": total_applications,
        "district_distribution": districts,
        "citizens": citizens
    }

# Initialize database on module load
init_db()
