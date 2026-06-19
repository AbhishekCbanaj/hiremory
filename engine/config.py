"""
Central config for the HR Job Application Automation.
Edit the values here — everything else reads from this file.
"""

# ---- WHO IS SENDING ----
SENDER_NAME = "Abhishek Banaj"
SENDER_EMAIL = "abhishekbanaj01@gmail.com"
SENDER_PHONE = "+91 9172533709"
SENDER_LINKEDIN = "https://www.linkedin.com/in/abhishekbanaj/"
SENDER_GITHUB = "https://github.com/AbhishekCbanaj"
SENDER_LOCATION = "Bengaluru"

# ---- SENDING SAFETY (Gmail spam-protection) ----
DAILY_BATCH_SIZE = 40
SECONDS_BETWEEN_EMAILS = 45

# ---- ROLES TARGETED ----
TARGET_ROLES = [
    "Data Analyst", "Business Analyst", "Product Analyst",
    "Junior Data Scientist", "Junior AI/ML Engineer",
]

# ---- FIRST-EMAIL STRATEGY ----
# False = first email is an INQUIRY (asks if they're hiring, offers to send
#         the resume if there's a fit). No attachment. Recommended for cold
#         outreach where you don't know what roles are open.
# True  = attach the resume to the first email (direct application).
ATTACH_RESUME = False

# ---- RESUME TO ATTACH ----
DEFAULT_RESUME = "resumes/Abhishek_Banaj_da.pdf"  # general Data Analyst master
ROLE_RESUME_MAP = {
    "data scientist": "resumes/Abhishek_Banaj_ds.pdf",
    "data science":   "resumes/Abhishek_Banaj_ds.pdf",
    "ml":             "resumes/Abhishek_Banaj_ml.pdf",
    "ai engineer":    "resumes/Abhishek_Banaj_ml.pdf",
    "business analyst": "resumes/Abhishek_Banaj_ba.pdf",
    "data analyst":   "resumes/Abhishek_Banaj_da.pdf",
}

# ---- FOLLOW-UPS ----
FOLLOWUP_DAYS = 6          # send a nudge this many days after no reply
MAX_FOLLOWUPS = 1          # how many follow-ups before giving up

# ---- AUTO-RESUME ON POSITIVE REPLY ----
# If a reply contains any positive cue and none of the negative ones, the
# role-matched resume is sent back automatically in the same thread.
POSITIVE_CUES = [
    "send", "share", "yes", "sure", "please", "forward", "attach",
    "resume", "cv", "profile", "interested", "go ahead", "do send",
]
NEGATIVE_CUES = [
    "no opening", "no openings", "not hiring", "no vacancy", "no vacancies",
    "not looking", "no current", "unsubscribe", "do not", "don't contact",
    "no requirement", "not relevant", "no positions",
]

# ---- LIST CLEANUP ----
# Drop role-less / shared inboxes (low reply value, hurt deliverability).
GENERIC_LOCALPARTS = {
    "hr", "info", "jobs", "careers", "career", "recruitment", "recruiter",
    "qa", "payable", "adops", "hrd", "img", "first", "solution.head",
    "inventum.recruiter", "asta_onboarding", "head.hr", "hr.orbit",
    "hr.mumbai", "o2finfo", "o2f",
}
DEDUPE_BY_COMPANY = True    # keep only one contact per company

# ---- FILES ----
SENT_LOG = "data/sent_log.csv"
CONTACTS_CSV = "data/contacts.csv"
