import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = ROOT / "MentorLink .csv"
OUTPUT_FILE = ROOT / "MentorLink_500_synthetic.csv"
TARGET_ROWS = 500

random.seed(42)


def read_seed_data(path):
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        headers = reader.fieldnames
    return headers, rows


def clean_value(value):
    if value is None:
        return ""
    return str(value).strip()


def choose_weighted(options):
    values = [x[0] for x in options]
    weights = [x[1] for x in options]
    return random.choices(values, weights=weights, k=1)[0]


def gen_timestamp(start, end):
    span = int((end - start).total_seconds())
    offset = random.randint(0, span)
    dt = start + timedelta(seconds=offset)
    return dt.strftime("%Y/%m/%d %I:%M:%S %p GMT+5:30")


def passout_from_year(current_year):
    mapping = {
        "1st year": "2029",
        "2nd year": "2028",
        "3rd year": "2027",
        "4th year": "2026",
    }
    return mapping.get(current_year, "2029")


def gen_name(first_names, last_names):
    return f"{random.choice(first_names)} {random.choice(last_names)}"


def gen_emails(name, year):
    first, last = name.lower().split(" ", 1)
    year_code = {
        "1st year": "25",
        "2nd year": "24",
        "3rd year": "23",
        "4th year": "22",
    }.get(year, "25")

    roll = random.randint(1, 999)
    college_email = f"{first}.{last}{year_code}{roll:03d}@spit.ac.in"

    personal_domains = ["gmail.com", "outlook.com", "yahoo.com", "proton.me"]
    personal_email = f"{first}{last}{random.randint(10,9999)}@{random.choice(personal_domains)}"
    return college_email, personal_email


def maybe_na(value, p=0.3):
    return value if random.random() > p else random.choice(["NA", "N/A", "-"])


def join_choices(pool, min_k, max_k):
    k = random.randint(min_k, min(max_k, len(pool)))
    return ";".join(random.sample(pool, k))


def generate_project_details(no_projects_bucket):
    topics = [
        "Smart attendance tracker", "Campus navigation app", "Doubt solving forum", "Exam prep planner",
        "Canteen preorder system", "Portfolio website", "Hostel issue tracker", "Student engagement dashboard",
        "Threat detection prototype", "Resume screening assistant", "Community event app", "Library recommender"
    ]
    tech_stacks = [
        "React, Node.js, MongoDB", "Spring Boot, MySQL", "Python, Flask, SQLite",
        "React Native, Firebase", "Django, PostgreSQL", "Next.js, Express"
    ]

    if no_projects_bucket == "1-3":
        count = random.randint(1, 2)
    elif no_projects_bucket == "3-8":
        count = random.randint(2, 4)
    else:
        count = random.randint(4, 6)

    lines = []
    for i in range(1, count + 1):
        lines.append(f"Project {i}: {random.choice(topics)} - {random.choice(tech_stacks)}")
    return " | ".join(lines)


def main():
    headers, seed_rows = read_seed_data(SOURCE_FILE)

    first_names = [
        "Aarav", "Vivaan", "Aditya", "Ananya", "Ishita", "Riya", "Krish", "Yash", "Sana", "Neha",
        "Pranav", "Vedant", "Mihika", "Aditi", "Kunal", "Rohit", "Sarthak", "Tanish", "Bhumi", "Suraj"
    ]
    last_names = [
        "Shah", "Patil", "Jadhav", "Nair", "Rane", "Joshi", "Kulkarni", "Anand", "Kale", "Rathod",
        "Kanase", "Salvi", "Mathpati", "Deshpande", "Mehta", "Pawar", "Kadam", "Iyer", "Gupta", "Mishra"
    ]

    year_options = [
        ("1st year", 0.52),
        ("2nd year", 0.12),
        ("3rd year", 0.32),
        ("4th year", 0.04),
    ]

    branch_options = [
        ("Computer Engineering", 0.62),
        ("Computer Science and Engineering", 0.35),
        ("Information Technology", 0.03),
    ]

    hsm_pool = ["Psychology", "Sociology", "Ethics", "Economics", "Professional Communication", "NA"]
    pec_pool = [
        "NLP / DL", "Artificial Intelligence", "Cloud Computing", "Cyber Security", "Data Analytics", "Software Testing", "NA"
    ]
    mdm_pool = ["UI/UX", "Banking Technology", "IOT", "Entrepreneurship", "Financial Literacy", "NA"]
    cc_pool = [
        "Yoga", "AOL", "Design Thinking", "Theatre", "Sports", "Fire safety", "Abhyudaya Mentoring", "NA"
    ]

    skills_pool = [
        "C", "C++", "Java", "Python", "JavaScript", "React", "MongoDB", "SQL",
        "Machine Learning", "Deep learning", "App / Web development", "DevOps", "Cybersecurity", "IOT"
    ]
    interests_pool = [
        "Web Development", "App development", "AI/ML", "Data Science", "CyberSecurity",
        "UI/UX design", "DevOps", "Competitive Programming", "Blockchain"
    ]

    goals_pool = [
        "Aiming for strong backend and system design skills.",
        "Interested in internships where I can work on real products.",
        "Want to contribute to open-source and improve DSA consistency.",
        "Focused on building impactful AI projects and research exposure.",
        "Planning to explore cybersecurity competitions this year.",
        "Working on communication and leadership along with tech skills.",
        "Preparing for product-based company placements.",
        "Trying to balance academics, projects, and hackathons better.",
        "Looking for mentorship in career direction and project depth.",
        "Interested in full-stack development and scalable systems."
    ]

    support_need_pool = [
        "Data analytics", "System design", "DSA", "Machine Learning", "Web Development",
        "Project planning", "Interview prep", "Career guidance", "NA"
    ]

    start_dt = datetime(2026, 4, 5, 9, 0, 0)
    end_dt = datetime(2026, 4, 21, 21, 30, 0)

    synthetic_rows = []

    for _ in range(TARGET_ROWS):
        current_year = choose_weighted(year_options)
        branch = choose_weighted(branch_options)
        no_projects = choose_weighted([
            ("1-3", 0.7 if current_year in ("1st year", "2nd year") else 0.3),
            ("3-8", 0.25 if current_year in ("1st year", "2nd year") else 0.55),
            ("8-15", 0.05 if current_year in ("1st year", "2nd year") else 0.15),
        ])

        name = gen_name(first_names, last_names)
        college_email, personal_email = gen_emails(name, current_year)

        row = {
            "Timestamp": gen_timestamp(start_dt, end_dt),
            "Full Name ": name,
            "College Email ": college_email,
            "Personal Email id ": personal_email,
            "Current Year of study": current_year,
            "Course": "B.Tech",
            "Branch": branch,
            "Passout Year ": passout_from_year(current_year),
            "HSM (Humanities & Management) subjects you have taken (if any)  ": maybe_na(random.choice(hsm_pool), p=0.35),
            "PEC (Program Elective) subjects you have taken (if any)": maybe_na(random.choice(pec_pool), p=0.30),
            "MDM (Multidisciplinary Minor) courses you have taken (if any)": maybe_na(random.choice(mdm_pool), p=0.35),
            "CC / LLC (Co-curricular) courses you have taken (if any)": maybe_na(random.choice(cc_pool), p=0.20),
            "Skills (Select upto 8)": join_choices(skills_pool, 3, 9),
            "Interests (Select top 3)": join_choices(interests_pool, 3, 5),
            "No of Projects Built": no_projects,
            "Project Details (Eg. Project 1. ToDo List App- React, Node.js, JS)": generate_project_details(no_projects),
            "Anything you want to share ? (Carrer goals, Achievements)": maybe_na(random.choice(goals_pool), p=0.2),
            "": maybe_na(random.choice(support_need_pool), p=0.25),
        }

        synthetic_rows.append(row)

    with OUTPUT_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(synthetic_rows)

    print(f"Generated {len(synthetic_rows)} rows at: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
