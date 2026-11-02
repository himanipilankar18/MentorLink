# MentorConnect Python Recommendation Engine

This directory contains the selectable Python recommendation engine and its
FastAPI service. The existing JavaScript frontend and Express application remain
the application-facing layers.

## Architecture and defaults

```text
Browser
  -> Vite frontend (development port 5173)
  -> Express backend (port 5000)
  -> MongoDB
  -> Python recommendation service (port 8000, optional)
```

When `RECOMMENDATION_SERVICE_URL` is not set, Express uses the existing
JavaScript recommendation engine. When it is set, the recommendation routes
POST the seeker, candidate, interaction, and mentorship data to the Python
service. The frontend and Express response contract are unchanged.

The supported version selector values are:

```text
v1, v2.0, v2.1, v2.2, v2.3, v2.4, v3, v4
```

## Prerequisites

These are the repository's tested or declared assumptions:

- Windows PowerShell, macOS, or Linux.
- Python 3.13 is the current development interpreter. Python 3.10+ may work,
  but is **unverified**.
- Node.js 18+ and npm. The frontend currently uses Vite 7 and React 19; Node.js
  20 LTS is recommended.
- A running MongoDB server or MongoDB Atlas database. Express refuses to start
  when `MONGODB_URI` is missing or MongoDB is unreachable.
- Git is required only to clone/update the repository; it is not required at
  runtime.
- Network access to install npm/Python packages.
- For V2.4, scikit-learn is required.
- For V4, XGBoost and SHAP are required, plus a trained model. Installing the
  packages alone does not provide a trained model.
- SMTP settings are optional for local recommendation testing but are needed
  for email verification and password-reset flows.

## 1. Open the project and create the Python environment

### Windows PowerShell

```powershell
# Terminal: PowerShell, from any directory
git clone https://github.com/himanipilankar18/MentorLink.git MentorLink
Set-Location .\MentorLink

# Terminal: repository root
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python --version
```

If `py` is unavailable but Python is installed:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use the current shell's policy override:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### macOS/Linux

```bash
# Terminal: shell, from any directory
git clone https://github.com/himanipilankar18/MentorLink.git MentorLink
cd MentorLink

# Terminal: repository root
python3 -m venv .venv
source .venv/bin/activate
python --version
```

## 2. Install dependencies

### Python dependencies

Run from the repository root with `.venv` activated:

```powershell
# Windows PowerShell
python -m pip install --upgrade pip
python -m pip install -r recommender_python\requirements.txt
python -c "import fastapi, numpy, sklearn, xgboost, shap; print('Python dependencies OK')"
```

```bash
# macOS/Linux
python -m pip install --upgrade pip
python -m pip install -r recommender_python/requirements.txt
python -c "import fastapi, numpy, sklearn, xgboost, shap; print('Python dependencies OK')"
```

The dependency-import command is verified against the declared modules. Package
installation itself is environment/network dependent.

### Node.js dependencies

Run from the repository root:

```powershell
# Windows PowerShell
npm install
Set-Location .\frontend
npm install
Set-Location ..
```

```bash
# macOS/Linux
npm install
cd frontend
npm install
cd ..
```

Verify Node and npm:

```text
node --version
npm --version
```

## 3. Environment variables

The backend loads `.env` from the repository root through `dotenv`.

Create a local environment file:

```powershell
# Windows PowerShell, repository root
Copy-Item .env.example .env
```

```bash
# macOS/Linux, repository root
cp .env.example .env
```

Replace placeholders without committing `.env`.

### Backend variables

| Variable | Required | Meaning |
|---|---:|---|
| `PORT` | No | Express port. Default: `5000`. |
| `NODE_ENV` | No | Express environment label. Use `development` locally. |
| `MONGODB_URI` | Yes | Local or Atlas MongoDB connection string. |
| `JWT_SECRET` | Yes for auth | Secret used by JWT authentication. Use a long random value. |
| `JWT_EXPIRE` | No | JWT lifetime. Existing example uses `7d`. |
| `ALLOWED_DOMAINS` | Required for normal registration | Comma-separated allowed institute email domains. |
| `ATLAS_TLS_INSECURE` | No | Set to `1` only for local Atlas TLS troubleshooting. Do not use in production. |
| `SMTP_HOST` | Optional | SMTP host for email flows. |
| `SMTP_PORT` | Optional | SMTP port, commonly `587`. |
| `SMTP_USER` | Optional | SMTP username. |
| `SMTP_PASS` | Optional | SMTP password/app password. |
| `EMAIL_FROM` | Optional | Sender address. |
| `UPLOADS_DIR` | Optional | Alternate uploads directory. |
| `BOOTSTRAP_ADMIN_NAME` | Script-only | First-admin bootstrap name. |
| `BOOTSTRAP_ADMIN_EMAIL` | Script-only | First-admin bootstrap email. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Script-only | First-admin bootstrap password. |
| `BOOTSTRAP_ADMIN_DEPARTMENT` | Script-only | First-admin department. |

### Python integration variables

| Variable | Required | Meaning |
|---|---:|---|
| `RECOMMENDATION_SERVICE_URL` | No | Base URL of the Python service, for example `http://127.0.0.1:8000`. If absent, Express uses JavaScript. |
| `RECOMMENDATION_ENGINE_VERSION` | No | Version sent to Python. Default: `v1`. |
| `RECOMMENDATION_SERVICE_TIMEOUT_MS` | No | Express-to-Python request timeout in milliseconds. Default: `15000`; increase it if V4 cold-start model loading exceeds this value. |
| `DEMO_RECOMMENDATIONS` | No | Must remain `false` for production. When `true`, explicitly marked fictional mentoring evidence is included for demos only. |
| `RECOMMENDATION_MODEL_PATH` | Required for V4 | Absolute or working-directory-relative path to a saved `.json`, `.ubj`, `.model`, or `.bin` XGBoost ranker. |
| `RECOMMENDATION_MODEL_MAX_BYTES` | No | Maximum model size accepted by the loader. Default: 512 MiB. |

V4 loads the model on each V4 request from `RECOMMENDATION_MODEL_PATH`. The
loader checks that the file exists, uses an accepted XGBoost extension, stays
under `RECOMMENDATION_MODEL_MAX_BYTES`, and can be loaded by `XGBRanker`.
Missing, invalid, incompatible, or unavailable models return an explicit HTTP
400 error; V4 never falls back to another version.

### Frontend variable

The React landing page reads:

```env
VITE_API_URL=http://localhost:5000
```

The Vite development proxy also forwards `/api` to `http://localhost:5000`.
This variable is optional for the default local backend.

### Safe `.env.example`

The repository root contains a placeholder-only [.env.example](../.env.example).
It must never contain real passwords, tokens, Atlas credentials, or SMTP
credentials.

## 4. Start the system

Use four terminals. Keep the repository root as the working directory unless a
command says otherwise.

### Terminal 1 - MongoDB

For a local MongoDB installation, start the MongoDB service using the method
provided by that installation. Examples:

```powershell
# Windows service installation; verify the service name in Services first.
Start-Service MongoDB
```

```bash
# macOS Homebrew installation
brew services start mongodb-community
```

These local-service commands are platform/install dependent and are **not
verified in this repository**. For MongoDB Atlas, no local process is needed;
set `MONGODB_URI`, allow the development IP in Atlas Network Access, and
URL-encode special characters in the database password.

Verify the backend's database connectivity from the repository root:

```powershell
node test-connection.js
```

Success is a successful Mongoose connection message and process completion.
The exact output depends on the MongoDB deployment.

### Terminal 2 - Python recommendation service

Windows PowerShell:

```powershell
Set-Location C:\path\to\MentorLink
.\.venv\Scripts\Activate.ps1
python -m uvicorn recommender_python.service:app --host 127.0.0.1 --port 8000
```

macOS/Linux:

```bash
cd /path/to/MentorLink
source .venv/bin/activate
python -m uvicorn recommender_python.service:app --host 127.0.0.1 --port 8000
```

The documented FastAPI command is based on the checked-in `service.py`; it is
not run automatically by npm.

Open Swagger UI at:

```text
http://127.0.0.1:8000/docs
```

Health check:

```powershell
# Windows PowerShell
Invoke-RestMethod http://127.0.0.1:8000/health
```

```bash
# macOS/Linux
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

### Terminal 3 - Express backend

Windows PowerShell:

```powershell
Set-Location C:\path\to\MentorLink
$env:RECOMMENDATION_SERVICE_URL = "http://127.0.0.1:8000"
$env:RECOMMENDATION_ENGINE_VERSION = "v1"
npm start
```

macOS/Linux:

```bash
cd /path/to/MentorLink
export RECOMMENDATION_SERVICE_URL=http://127.0.0.1:8000
export RECOMMENDATION_ENGINE_VERSION=v1
npm start
```

Alternatively put those variables in the root `.env`. Express first connects
to MongoDB and then listens on `http://localhost:5000`.

Backend health check:

```text
http://localhost:5000/api/health
```

Expected response has `success: true` and
`message: "MentorLink API is running"`.

If `RECOMMENDATION_SERVICE_URL` is omitted, the backend still works through the
existing JavaScript recommendation engine.

### Terminal 4 - React/Vite frontend

Run from the repository root:

```powershell
# Windows PowerShell
Set-Location C:\path\to\MentorLink
npm run dev
```

```bash
# macOS/Linux
cd /path/to/MentorLink
npm run dev
```

The root script delegates to `frontend/`; it does not require manually changing
directories. Vite is configured for port `5173`.

Open:

```text
http://localhost:5173
```

The backend also serves the authenticated HTML application from `public/` at
the backend URL.

## 5. Selecting versions

Set `RECOMMENDATION_ENGINE_VERSION`, then restart Express so the new environment
value is loaded. The Python service itself does not need restarting because the
version is selected per request.

```text
RECOMMENDATION_ENGINE_VERSION=v1
RECOMMENDATION_ENGINE_VERSION=v2.0
RECOMMENDATION_ENGINE_VERSION=v2.1
RECOMMENDATION_ENGINE_VERSION=v2.2
RECOMMENDATION_ENGINE_VERSION=v2.3
RECOMMENDATION_ENGINE_VERSION=v2.4
RECOMMENDATION_ENGINE_VERSION=v3
RECOMMENDATION_ENGINE_VERSION=v4
```

| Version | Behavior | Model/restart notes |
|---|---|---|
| V1 | Frozen hybrid baseline behavior and K-Means. | No trained model. Restart Express after changing the selector. |
| V2.0 | Deterministic seeded K-Means, missing-data handling, confirmed analytics, normalized scoring, technical tokenization. | No trained model. |
| V2.1 | Directional needs/offers matching when structured fields are supplied. | No trained model. |
| V2.2 | Department-independent scoring. | No trained model. |
| V2.3 | Additive component contributions for explanations. | No trained model. |
| V2.4 | NMF topic discovery through scikit-learn. | Requires installed scikit-learn. |
| V3 | Enriched profile matching and exposure-aware re-ranking. | No trained model. |
| V4 | XGBoost ranking and TreeSHAP explanation path. | Requires a saved compatible model and `RECOMMENDATION_MODEL_PATH`. Missing or invalid models fail explicitly. |

V4 must not be described as production-ready or superior without independent
research evaluation.

### Train and save a V4 model

The training helper requires caller-supplied feature rows, labels, and query
groups. It does not create production labels. A minimal script using a real
research feature file is:

```python
from pathlib import Path
from recommender_python.training import save_v4_ranker, train_v4_ranker

feature_rows = ...  # load feature rows from your approved research dataset
labels = ...        # supplied or explicitly simulated offline labels
groups = ...        # query-group sizes; sum(groups) == len(labels)
model = train_v4_ranker(feature_rows, labels, groups, seed=11)
save_v4_ranker(model, Path("research/models/v4-ranker.json"))
```

Run it from the repository root with `.venv` active:

```powershell
python path\to\your_training_script.py
```

This command is a template because the repository contains no approved
training dataset or label-generation script. Do not replace the ellipses with
invented research data.

### Start integrated V4

```powershell
$env:RECOMMENDATION_SERVICE_URL = "http://127.0.0.1:8000"
$env:RECOMMENDATION_ENGINE_VERSION = "v4"
$env:RECOMMENDATION_MODEL_PATH = (Resolve-Path .\research\models\v4-ranker.json).Path
python -m uvicorn recommender_python.service:app --host 127.0.0.1 --port 8000
```

In another terminal, start Express with the same `RECOMMENDATION_*` values.
The model is loaded when a V4 request arrives. A missing or incompatible model
returns an explicit error and does not fall back to V3 or V1.

## 6. Testing

### Python unit tests

From the repository root with the virtual environment active:

```powershell
# Windows PowerShell
python -m unittest discover -s recommender_python -p "test_*.py" -v
```

```bash
# macOS/Linux
python -m unittest discover -s recommender_python -p 'test_*.py' -v
```

Success is `OK` with all tests passing.

### Python syntax/compilation

```powershell
# Windows PowerShell
$files = Get-ChildItem recommender_python -Filter *.py | ForEach-Object { $_.FullName }
python -m py_compile $files
```

```bash
# macOS/Linux
python -m compileall recommender_python
```

### Python health endpoint

With Terminal 2 running:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

### Direct recommendation API request

The checked-in FastAPI endpoint accepts a JSON object with `seeker`,
`candidates`, `interactions`, `mentorships`, `version`, and `options`.

```powershell
$body = @{
  seeker = @{
    _id = "seeker-1"
    department = "CSE"
    year = 2
    availability = "weekdays"
    role = "junior"
    mentorshipIntent = "seeking"
    skills = @("javascript", "node.js")
    interests = @("web")
    bio = "Interested in web engineering."
    projects = @()
  }
  candidates = @(
    @{
      _id = "mentor-1"
      department = "CSE"
      year = 4
      availability = "weekdays"
      role = "senior"
      mentorshipIntent = "offering"
      skills = @("javascript", "node.js")
      interests = @("web")
      bio = "Experienced JavaScript and Node.js mentor."
      projects = @()
    }
  )
  interactions = @()
  mentorships = @()
  version = "v2.0"
  options = @{
    seed = 11
    now = "2026-01-01T00:00:00+00:00"
    limit = 10
    weightProfile = "internal"
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri http://127.0.0.1:8000/recommend `
  -Method Post -ContentType "application/json" -Body $body
```

Success is a JSON object containing `version`, `recommendations`, and
`clustering`. Recommendation entries contain fields such as `id`, `score`,
`matchScore`, `scoreComponents`, `mentor`, and `cluster`.

### Node.js syntax checks

```powershell
node --check routes\recommendations.js
node --check utils\recommendationEngine.js
```

### JavaScript-to-Python parity check

The repository contains Python unit coverage and a manual V1 parity procedure.
Use a fixed seeker/candidate fixture and identical seed, timestamp, interactions,
and mentorship inputs. Compare ranking IDs and rounded scores between:

- `recommender/versions/v1/index.js`
- `recommender_python.engine.recommend(..., version="v1")`

This comparison is verified for the fixed fixture used during implementation.
There is no npm script for a full automated parity suite.

### Existing application tests

The root `package.json` test script intentionally exits with
`Error: no test specified`. Therefore:

```powershell
npm test
```

is not a passing application test suite. Use the targeted checks above.

## 7. Research evaluation

The reusable metric and artifact functions are in
[evaluation.py](./evaluation.py). They can calculate Hit@K, NDCG@K, MRR,
Kendall tau, top-10 overlap, stability, exposure Gini, ARI, NMI, and
explanation faithfulness from supplied run data.

The executable runner is
[experiment_runner.py](./experiment_runner.py). It runs the same supplied
populations through V1, V2.0, V2.1, V2.2, V2.3, V2.4, V3, and V4, using fixed
seeds, and writes rankings, scores, version status, metrics, and outputs.

The runner accepts a JSON file with this shape:

```json
{
  "populations": [
    {
      "now": "2026-01-01T00:00:00+00:00",
      "weightProfile": "internal",
      "seekers": [],
      "candidates": [],
      "interactions": [],
      "mentorships": [],
      "relevantBySeeker": {}
    }
  ]
}
```

`seekers`, `candidates`, `interactions`, `mentorships`, and relevance labels
must come from the approved evaluation dataset. The runner does not generate
profiles, labels, or metrics.

Required research inputs must be supplied by the researcher and kept outside
live MongoDB documents. Recommended locations are:

```text
research/data/ds1.json
research/data/ds2.json
research/data/ds3.json
research/data/r.json
```

These filenames are conventions for organizing inputs. Run one dataset at a
time:

```powershell
# Windows PowerShell, repository root, virtual environment active
python -m recommender_python.experiment_runner `
  --dataset research\data\ds1.json `
  --output-dir research\out\python\ds1 `
  --seeds 11,23,37,41,59

python -m recommender_python.experiment_runner `
  --dataset research\data\ds2.json `
  --output-dir research\out\python\ds2 `
  --seeds 11,23,37,41,59

python -m recommender_python.experiment_runner `
  --dataset research\data\ds3.json `
  --output-dir research\out\python\ds3 `
  --seeds 11,23,37,41,59

python -m recommender_python.experiment_runner `
  --dataset research\data\r.json `
  --output-dir research\out\python\r `
  --seeds 11,23,37,41,59
```

macOS/Linux uses the same module command with `/` paths and `\` removed as
PowerShell continuation characters. Each completed run writes
`experiment-results.json` and `experiment-results.csv`. The JSON records each
version as `completed` or `unavailable`; missing datasets return an unavailable
status and a non-zero exit code. No charts are generated by this runner yet;
the existing `evaluation.write_artifacts` helper can generate a chart when
called by a separate analysis script.

For reproducibility, pass fixed seeds in `options.seed` and fixed timestamps in
`options.now`. Compare versions by running the same supplied profiles, labels,
candidate pools, seeds, and clock values through each version, then write the
returned rankings and metric rows with `write_artifacts(...)`.

V4 training is exposed as the Python helper `training.train_v4_ranker`. It
requires explicit feature rows, supplied or explicitly simulated offline
labels, query groups, and a fixed seed. Save with `save_v4_ranker`, configure
`RECOMMENDATION_MODEL_PATH`, and the FastAPI endpoint loads the model for V4
requests.

## 8. Troubleshooting

### `python` or `py` is not recognized

Install Python 3.13, reopen PowerShell, and verify:

```powershell
py -3.13 --version
python --version
```

Use the full interpreter path if necessary:

```powershell
& "C:\Program Files\Python313\python.exe" -m venv .venv
```

### Virtual-environment activation fails

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Recreate the environment only if it is corrupted:

```powershell
Remove-Item -Recurse -Force .venv
py -3.13 -m venv .venv
```

### Packages are missing

Activate `.venv` and reinstall:

```powershell
python -m pip install --upgrade pip
python -m pip install -r recommender_python\requirements.txt
```

Check the selected interpreter:

```powershell
python -c "import sys; print(sys.executable)"
```

### Port already in use

Find the process:

```powershell
Get-NetTCPConnection -LocalPort 8000,5000,5173 -ErrorAction SilentlyContinue
```

Stop only a specifically identified process:

```powershell
Stop-Process -Id <PID>
```

If changing ports, also update the corresponding service URL, Vite proxy, or
frontend `VITE_API_URL`.

### MongoDB connection failure

- Confirm MongoDB is running or Atlas is reachable.
- Confirm `MONGODB_URI` exists in the root `.env`.
- URL-encode special characters in Atlas credentials.
- Add the development IP to the Atlas Network Access list.
- Run `node test-connection.js`.
- Do not commit the connection string.

### Python service unavailable

- Confirm Terminal 2 is still running.
- Test `http://127.0.0.1:8000/health`.
- Confirm `RECOMMENDATION_SERVICE_URL` has no trailing route path; use the base
  URL `http://127.0.0.1:8000`.
- Restart Express after changing the environment variable.

### Express cannot connect to Python

The bridge has a configurable request timeout (15 seconds by default) and returns to the JavaScript
engine only when the service URL is not configured; an unavailable configured
service produces an error response. Start Python first, verify `/health`, then
start Express.

### CORS errors

The Express backend enables CORS. Prefer sending browser requests through the
Vite `/api` proxy or use `VITE_API_URL=http://localhost:5000`. Do not call
MongoDB or the Python service directly from browser code.

### Invalid or missing environment variables

Check the root `.env`, remove spaces around `=`, ensure `MONGODB_URI`,
`JWT_SECRET`, and `ALLOWED_DOMAINS` are set, and restart the process after every
change.

### XGBoost model missing

Set `RECOMMENDATION_MODEL_PATH` to an existing saved XGBoost ranker. The path
must use `.json`, `.ubj`, `.model`, or `.bin`. Packages alone are insufficient.
The service returns an explicit 400 error for missing, invalid, oversized, or
incompatible models.

### NMF/scikit-learn dependency issue

Install the requirements inside the active virtual environment:

```powershell
python -m pip install "scikit-learn>=1.5,<2"
```

Then rerun the Python tests.

### Frontend API errors

- Confirm Express responds at `http://localhost:5000/api/health`.
- Confirm `frontend/vite.config.js` still proxies `/api` to port 5000.
- Check `VITE_API_URL` if the backend is not on port 5000.
- Check browser developer tools and the Express terminal for authentication or
  MongoDB errors.

## 9. Clean shutdown and restart

In each service terminal, press `Ctrl+C`:

1. Stop Vite.
2. Stop Express.
3. Stop FastAPI.
4. Stop local MongoDB only if you started it for this session.

Restart in the order MongoDB, Python, Express, frontend. The virtual environment
does not need to be recreated for normal restarts. Reactivate it in a new
terminal.

After changing `requirements.txt`, update safely:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade -r recommender_python\requirements.txt
python -m unittest discover -s recommender_python -p "test_*.py"
```

Do not upgrade production dependencies without running the tests and recording
the resulting versions.

## 10. Final verification checklist

- [ ] MongoDB or MongoDB Atlas is reachable.
- [ ] Root `.env` exists and contains safe, valid local values.
- [ ] Python 3.13 virtual environment is activated.
- [ ] Python dependencies are installed.
- [ ] `GET http://127.0.0.1:8000/health` returns `{"status":"ok"}`.
- [ ] FastAPI is running on `127.0.0.1:8000`.
- [ ] Express starts after MongoDB connects.
- [ ] `GET http://localhost:5000/api/health` succeeds.
- [ ] `RECOMMENDATION_SERVICE_URL` points to the Python service when Python
  integration is intended.
- [ ] The frontend starts on port 5173.
- [ ] The application loads in the browser.
- [ ] Authenticated mentor recommendations return through the existing API.
- [ ] V1–V3 and V2.4 are selected with `RECOMMENDATION_ENGINE_VERSION` and
  tested with the appropriate dependencies.
- [ ] V4 is not enabled unless a valid trained XGBoost model-loading path has
  been configured and independently validated.
