🔍 BugLens AI - Intelligent Test Failure Analysis

A hackathon-first AI-powered platform that automatically analyzes test failures, identifies root causes, and provides actionable insights using Claude.

Test Failure → Screenshot + Logs → AI Analysis → Root Cause + Recommendation
⚡ Quick Start
1️⃣ Prerequisites
bash
# Check versions
python --version     # 3.9+
node --version       # 16+
docker --version     # 20.10+
2️⃣ Clone & Setup
bash
# Get the code
git clone https://github.com/your-org/buglens-ai.git
cd buglens-ai

# Set up environment
export ANTHROPIC_API_KEY="sk-ant-..."
cp .env.example .env
3️⃣ Start Services
bash
# Run everything with Docker
docker-compose up -d

# Wait for services
sleep 10

# Seed database
curl http://localhost:8000/api/seed

# Access applications:
# Frontend: http://localhost:3000
# Dashboard: http://localhost:3001
# API: http://localhost:8000
# AI Service: http://localhost:8002
4️⃣ Run Tests
bash
# Install test dependencies
pip install pytest pytest-asyncio playwright

# Run the test suite
pytest automation/tests/test_shopsphere.py -v

# Watch failures get analyzed in real-time
# Check http://localhost:3001 for results
🎯 What You'll See
Test Execution
bash
$ pytest automation/tests/ -v

test_cart_total_calculation FAILED
├─ Cart total: $999.99 (should be $2,999.97)
├─ BugLens AI analyzing...
└─ ✅ Analysis complete

Classification: APPLICATION_BUG
Severity:      HIGH
Confidence:    94%
Root Cause:    Missing multiplication in cart calculation
Component:     apps/shopsphere/backend/main.py:150
AI Analysis Output
json
{
  "test_name": "test_cart_total_calculation",
  "classification": "APPLICATION_BUG",
  "severity": "HIGH",
  "confidence": 0.94,
  "root_cause": "Cart total calculation multiplies price by 1 instead of quantity",
  "affected_component": "get_cart() function",
  "recommendations": [
    "Review line 150 in main.py",
    "Change total += product.price to total += product.price * item.quantity",
    "Add unit tests for cart calculations"
  ]
}
🏗️ Architecture
┌─────────────────────────────────────────────────────┐
│                  BugLens AI                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🎨 Frontend (React)                                │
│     ├─ ShopSphere (ecommerce being tested)         │
│     └─ Dashboard (see results)                      │
│                                                     │
│  🔧 Services (FastAPI)                              │
│     ├─ ShopSphere Backend (with 3 bugs)            │
│     ├─ Mock Payment API (failure simulator)        │
│     └─ AI Investigator (failure analyzer)          │
│                                                     │
│  🧪 Automation (Playwright)                         │
│     └─ Tests that trigger bugs                     │
│                                                     │
│  🧠 AI Analysis (Claude)                            │
│     ├─ Prompt engineering                          │
│     ├─ Root cause analysis                         │
│     └─ Recommendation generation                   │
│                                                     │
│  💾 Database (PostgreSQL)                           │
│     └─ Failure history & analysis                  │
│                                                     │
└─────────────────────────────────────────────────────┘
🐛 The Intentional Bugs

This is a working e-commerce application with 3 deliberately introduced bugs for testing:

Bug #1: Incorrect Cart Total 🔴 HIGH

File: apps/shopsphere/backend/main.py:150

python
# ❌ BUGGY CODE
total += product.price  # Missing * item.quantity

# ✅ SHOULD BE
total += product.price * item.quantity

Test: test_cart_total_calculation() Impact: Users see wrong totals, may abandon checkout

Bug #2: Payment API Failure with Coupon 🔴 HIGH

File: apps/shopsphere/payment-mock/main.py:45

python
# ❌ BUGGY CODE
if request.coupon_code:
    if random.random() < 0.6:  # 60% failure rate
        raise HTTPException(status_code=500)

# ✅ SHOULD PROCESS SUCCESSFULLY

Test: test_checkout_with_coupon() Impact: ~60% of coupon purchases fail with 500 error

Bug #3: Broken Error Handling 🔴 HIGH

File: apps/shopsphere/backend/main.py:196

python
# ❌ BUGGY CODE
except Exception as e:
    logger.error(f"Payment processing failed: {str(e)}")
    # Bug: Order status not set, cart cleared anyway

# ✅ SHOULD HANDLE PROPERLY

Test: test_checkout_payment_failure() Impact: Failed payments leave orders in inconsistent state

🚀 Key Features
🤖 Intelligent Failure Analysis
Analyzes stack traces, logs, and screenshots
Uses Claude to understand root causes
Classifies bugs by type and severity
📊 Classification
APPLICATION_BUG: Code defect in app
TEST_BUG: Issue with test itself
FLAKY: Intermittent failure
ENVIRONMENT: Missing setup/config
EXTERNAL_SERVICE: API/network failure
💡 Confidence Scoring
0.95-1.0: Stack trace clearly shows cause
0.80-0.94: Strong evidence
0.60-0.79: Reasonable inference
<0.60: Uncertain, needs more data
📈 Severity Levels
CRITICAL: Crash, data loss
HIGH: Core feature broken
MEDIUM: Feature partially broken
LOW: Cosmetic issue
📁 Project Structure
buglens-ai/
├── apps/
│   ├── shopsphere/
│   │   ├── backend/          ⭐ FastAPI app (with bugs)
│   │   ├── frontend/         🎨 React UI
│   │   └── payment-mock/     🔄 Failure simulator
│   └── dashboard/            📊 BugLens UI
│
├── automation/
│   └── tests/
│       └── test_shopsphere.py  🧪 Playwright tests
│
├── ai/
│   └── investigator/         🧠 Claude-powered analysis
│
├── data/
│   ├── failures/             📋 Captured failures
│   └── test_runs/            📈 Test reports
│
├── docker-compose.yml        🐳 All services
└── DEVELOPMENT_GUIDE.md      📖 Full setup guide
🛠️ Development Setup
Local Development (Recommended for iteration)
bash
# Terminal 1: Database
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=buglens_dev_pass \
  -p 5432:5432 \
  postgres:15-alpine

# Terminal 2: ShopSphere Backend
cd apps/shopsphere/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 3: AI Service
cd ai/investigator
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8002

# Terminal 4: ShopSphere Frontend
cd apps/shopsphere/frontend
npm install && npm start

# Terminal 5: Tests
cd automation
pip install pytest pytest-asyncio playwright
playwright install
pytest tests/ -v
Docker Development (Consistent environment)
bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Run tests in container
docker-compose exec shopsphere-backend pytest automation/tests/ -v

# Stop everything
docker-compose down
🧪 Running Tests
Execute All Tests
bash
pytest automation/tests/test_shopsphere.py -v
Run Specific Test Class
bash
pytest automation/tests/test_shopsphere.py::TestCart -v
Run Single Test
bash
pytest automation/tests/test_shopsphere.py::TestCart::test_cart_total_calculation -v
With Detailed Output
bash
pytest automation/tests/ -v -s --tb=short
Generate HTML Report
bash
pytest automation/tests/ --html=report.html --self-contained-html
🤖 Using the AI Service
Get Analysis of a Failure
bash
curl -X POST http://localhost:8002/api/analyze-failure \
  -H "Content-Type: application/json" \
  -d '{
    "test_name": "test_cart_total_calculation",
    "error": "AssertionError: Cart total should be $2999.97, but got $999.99",
    "stack_trace": "File test_shopsphere.py, line 120",
    "test_logs": "Added 3 laptops to cart",
    "app_logs": "",
    "screenshot_description": "Cart page with 3 items",
    "source_code": "total += product.price"
  }'
View All Analyses
bash
curl http://localhost:8002/api/analyses
View Specific Analysis
bash
curl http://localhost:8002/api/analyses/1
Get Statistics
bash
curl http://localhost:8002/api/statistics
🔑 Environment Variables

Create .env file:

env
# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=          # Optional

# Database
DATABASE_URL=postgresql://buglens:buglens_dev_pass@localhost:5432/buglens_db

# Services
PAYMENT_API_URL=http://payment-mock:8001
ENVIRONMENT=development

# Frontend
REACT_APP_API_URL=http://localhost:8000
REACT_APP_AI_URL=http://localhost:8002

# Testing
SHOPSPHERE_URL=http://localhost:3000
AI_SERVICE_URL=http://localhost:8002
📊 Database Schema
failure_analyses
sql
CREATE TABLE failure_analyses (
  id INTEGER PRIMARY KEY,
  test_name VARCHAR,
  error_message VARCHAR,
  classification VARCHAR,      -- APPLICATION_BUG, TEST_BUG, etc.
  severity VARCHAR,            -- CRITICAL, HIGH, MEDIUM, LOW
  confidence FLOAT,            -- 0.0 - 1.0
  root_cause VARCHAR,
  affected_component VARCHAR,
  recommendations JSON[],
  analysis_data JSON,
  created_at DATETIME
);
🚀 Roadmap
Phase 1: ✅ Foundation (Done)
 ShopSphere app with bugs
 Playwright tests
 AI failure analysis
 Basic dashboard
Phase 2: 📊 Analytics
 Failure trend tracking
 Bug severity scoring
 Impact analysis
Phase 3: 🧠 ML
 Failure classification model
 Anomaly detection
 Pattern recognition
Phase 4: 🔄 Automation
 Test generation
 Self-healing tests
 Flaky test detection
Phase 5: 🎯 Intelligence
 Root cause correlation
 Risk prediction
 Recommended fixes
🐛 Troubleshooting
Port Already in Use
bash
# Find and kill process
lsof -i :8000
kill -9 <PID>
Database Connection Error
bash
# Check PostgreSQL
docker-compose ps
docker-compose logs postgres

# Restart
docker-compose restart postgres
API Key Issues
bash
# Verify key
echo $ANTHROPIC_API_KEY

# Update .env and restart
docker-compose restart ai-service
Tests Won't Connect
bash
# Check services running
curl http://localhost:8000/health
curl http://localhost:3000/
curl http://localhost:8002/health

See DEVELOPMENT_GUIDE.md for more troubleshooting.

💡 Key Concepts
Prompt Template

The AI service uses a carefully crafted prompt to analyze failures:

1. Examine ALL evidence
2. Classify into category
3. Follow stack trace
4. Assess confidence
5. Recommend fixes

See buglens-prompt-template.md for full template.

Test-Driven Bug Discovery
Write test that should pass
Run test (it fails due to bug)
AI analyzes failure
AI provides root cause
Developer fixes bug
Test passes ✅
Failure Evidence Chain
Test Execution
    ↓
Capture: Error message
         Stack trace
         Screenshots
         Console logs
         Source code
    ↓
Send to AI
    ↓
Claude Analysis
    ↓
Classification + Confidence
    ↓
Stored in Database
🤝 Contributing
Create feature branch: git checkout -b feature/xyz
Make changes
Add tests
Update prompt templates if needed
Submit PR
📖 Documentation
DEVELOPMENT_GUIDE.md - Complete setup & development
buglens-prompt-template.md - AI prompt engineering
API Docs - http://localhost:8000/docs (automatic Swagger)
📞 Support
Check DEVELOPMENT_GUIDE.md troubleshooting section
Review inline code comments
Check service logs: docker-compose logs -f <service>
⚖️ License

MIT

🎉 Built for Hackathons

This is a hackathon-first prototype designed to be:

✅ Quick to setup
✅ Easy to understand
✅ Simple to extend
✅ Ready to demo

Perfect for testing the idea before building production-grade features.