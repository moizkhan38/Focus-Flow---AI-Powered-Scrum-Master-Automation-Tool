import os
import json
from concurrent.futures import ThreadPoolExecutor
import requests
from datetime import datetime, date
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from slack_sdk import WebClient
from atlassian import Jira
from google import genai
from apscheduler.schedulers.background import BackgroundScheduler

load_dotenv()

app = Flask(__name__)

# Initialize Clients
slack_client = WebClient(token=os.environ.get("SLACK_BOT_TOKEN"))
gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
GEMINI_MODEL = 'gemini-2.5-flash-lite'
jira = Jira(
    url=os.environ.get("JIRA_URL"),
    username=os.environ.get("JIRA_EMAIL"),
    password=os.environ.get("JIRA_API_TOKEN"),
    cloud=True,
)

# Bounded pool for background standup processing — prevents unbounded thread
# creation under rapid /standup submissions.
background_executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix="standup-bg")


# --- Jira Actions ---


def verify_ticket_exists(ticket_id):
    """Check if a Jira ticket exists and user has access to it."""
    try:
        jira.issue(ticket_id)
        return True
    except Exception:
        return False


def get_ticket_assignee(ticket_id):
    """Get the assignee info of a Jira ticket. Returns (account_id, name)."""
    try:
        issue = jira.issue(ticket_id)
        assignee = issue["fields"].get("assignee")
        if assignee:
            return (
                assignee.get("accountId"),
                assignee.get("displayName", "Unknown"),
            )
        return None, None
    except Exception:
        return None, None


def get_jira_account_id(email):
    """Get the Jira account ID for an email address."""
    try:
        users = jira.user_find_by_user_string(query=email)
        if users:
            return users[0].get("accountId")
        return None
    except Exception:
        return None


def move_jira_ticket(ticket_id, status_name, user_account_id=None):
    """Transition a Jira ticket to the given status after ownership check."""
    try:
        ticket_id = ticket_id.upper().strip()

        if not verify_ticket_exists(ticket_id):
            return (
                f"[SKIPPED] {ticket_id}: "
                "Issue does not exist or you don't have permission"
            )

        # Check if ticket is assigned to the submitting user
        if user_account_id:
            assignee_id, assignee_name = get_ticket_assignee(ticket_id)
            if assignee_id is None:
                return (
                    f"[DENIED] {ticket_id}: "
                    "This ticket has no assignee"
                )
            if assignee_id != user_account_id:
                return (
                    f"[DENIED] {ticket_id}: "
                    f"This ticket is assigned to {assignee_name}, "
                    "so you cannot move it. Please update the ticket or contact the assignee."
                )

        jira.issue_transition(ticket_id, status_name)
        return f"[SUCCESS] Moved {ticket_id} to {status_name}"
    except Exception as e:
        return f"[ERROR] Could not move {ticket_id}: {str(e)}"


def create_blocker_ticket(summary, description, project_key=None):
    """Create a high-priority blocker ticket in Jira."""
    try:
        if not project_key:
            project_key = os.environ.get("JIRA_PROJECT_KEY")
        issue_dict = {
            "project": {"key": project_key},
            "summary": f"BLOCKER: {summary}",
            "description": description,
            "issuetype": {"name": "Task"},
            "priority": {"name": "High"},
        }
        new_issue = jira.create_issue(fields=issue_dict)
        return f"[BLOCKER] Created Blocker Ticket: {new_issue['key']}"
    except Exception as e:
        return f"[ERROR] Failed to create blocker: {e}"


# --- Background Logic ---


EXPRESS_DB_URL = os.environ.get("EXPRESS_DB_URL", "http://localhost:3003/api/db/standups")


def save_standup_to_json(user_id, project_key, yesterday, today, blocker, analysis):
    """Save standup to Postgres via Express backend; fall back to JSON on failure."""
    full_text = f"Yesterday: {yesterday}. Today: {today}. Blockers: {blocker}"
    blocker_details = None
    if analysis.get("is_blocker"):
        blocker_details = {
            "type": analysis.get("blocker_type", "Unknown"),
            "impact": analysis.get("impact", "Unknown"),
            "recommendation": analysis.get("blocker_summary", ""),
        }

    new_entry = {
        "user_id": user_id,
        "project_key": project_key,
        "timestamp": datetime.now().isoformat(),
        "full_text": full_text,
        "yesterday": yesterday,
        "today": today,
        "blocker": blocker,
        "is_blocker": analysis.get("is_blocker", False),
        "blocker_details": blocker_details,
        "sentiment": analysis.get("sentiment", "Neutral"),
        "finished_tickets": analysis.get("finished_tickets", []),
        "today_tickets": analysis.get("today_tickets", []),
        "raw_analysis": analysis,
    }

    # Primary: write to Postgres via Express
    try:
        resp = requests.post(EXPRESS_DB_URL, json=new_entry, timeout=5)
        if resp.ok:
            print(f"[SUCCESS] Saved standup to DB for {user_id}")
            return new_entry
        print(f"[WARN] DB save returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[WARN] DB save failed, falling back to JSON: {e}")

    # Fallback: append to local JSON so data isn't lost if Express/DB is down
    try:
        try:
            with open("standup_data.json", "r") as f:
                standup_data = json.load(f)
        except FileNotFoundError:
            standup_data = []
        standup_data.append(new_entry)
        with open("standup_data.json", "w") as f:
            json.dump(standup_data, f, indent=4)
        print(f"[FALLBACK] Saved standup to JSON for {user_id}")
        return new_entry
    except Exception as e:
        print(f"[ERROR] Failed to save standup anywhere: {e}")
        return None


def send_to_standup_analyzer(standup_entry):
    """Send standup data to analyzer endpoint."""
    try:
        analyzer_url = os.environ.get("STANDUP_ANALYZER_URL")
        if not analyzer_url:
            print("[WARNING] STANDUP_ANALYZER_URL not configured")
            return

        response = requests.post(
            analyzer_url, json=standup_entry, timeout=3
        )
        if response.status_code == 200:
            print("[SUCCESS] Sent standup data to analyzer")
        else:
            print(
                f"[WARNING] Analyzer responded with status "
                f"{response.status_code}"
            )
    except Exception as e:
        print(f"[ERROR] Failed to send to analyzer: {e}")


def process_standup_logic(user_id, project_key, yesterday, today, blocker):
    """Core standup processing: AI analysis, Jira updates, Slack report."""
    print(f"[BACKGROUND] Analyzing standup for {user_id} ({project_key})...")

    full_text = (
        f"What have you done yesterday: {yesterday}. "
        f"What will you do today: {today}. "
        f"Have you faced any blockers: {blocker}"
    )
    prompt = f"""Analyze this standup. Respond ONLY with JSON.

    RULES for Jira IDs:
    - ALWAYS convert ticket IDs to UPPERCASE (e.g., 'scrum-1' becomes 'SCRUM-1').
    - ALWAYS ensure there is a dash between the letters and numbers.
    - 'finished_tickets': Jira IDs mentioned in Yesterday's work.
    - 'today_tickets': Jira IDs mentioned in Today's work.

    JSON Structure:
    - "is_blocker": boolean,
    - "blocker_summary": string or null,
    - "blocker_type": "Technical", "Resource", "Dependency", or "Other" (only if is_blocker is true),
    - "impact": string describing the risk or delay impact (only if is_blocker is true),
    - "finished_tickets": array of strings,
    - "today_tickets": array of strings,
    - "sentiment": "Positive", "Neutral", "Negative"

    Text: {full_text}"""

    try:
        response = gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        raw_text = response.text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()
        analysis = json.loads(raw_text)

        # Get the user's Jira account ID for ownership check
        jira_email = os.environ.get("JIRA_EMAIL")
        try:
            user_info = slack_client.users_info(user=user_id)
            user_profile = user_info["user"]["profile"]
            user_email = user_profile.get("email", jira_email)
        except Exception:
            user_email = jira_email
        user_account_id = get_jira_account_id(user_email)

        # Jira execution
        results = []

        for tid in analysis.get("finished_tickets", []):
            res = move_jira_ticket(tid, "Done", user_account_id)
            results.append(res)

        for tid in analysis.get("today_tickets", []):
            res = move_jira_ticket(tid, "In Progress", user_account_id)
            results.append(res)

        if analysis.get("is_blocker"):
            res = create_blocker_ticket(
                analysis.get("blocker_summary"), blocker, project_key
            )
            results.append(res)

        # Save standup data
        standup_entry = save_standup_to_json(
            user_id, project_key, yesterday, today, blocker, analysis
        )

        # Get user's real name (reuse user_info from above)
        try:
            user_name = user_info["user"]["real_name"]
        except Exception:
            user_name = user_id

        # Build detailed report
        jira_report = (
            "\n".join(results) if results else "- No Jira actions needed."
        )

        finished = ", ".join(
            analysis.get("finished_tickets", [])
        ) or "None"
        today_tickets = ", ".join(
            analysis.get("today_tickets", [])
        ) or "None"

        blocker_section = ""
        if analysis.get("is_blocker"):
            blocker_section = (
                "\n\n*Blocker Detected:*\n"
                f"- *Type:* {analysis.get('blocker_type', 'Unknown')}\n"
                f"- *Impact:* {analysis.get('impact', 'Unknown')}\n"
                f"- *Details:* {analysis.get('blocker_summary', 'N/A')}"
            )

        slack_client.chat_postMessage(
            channel=user_id,
            text=(
                f"*Standup Report -- {user_name}*\n"
                f"*Project:* {project_key}\n"
                f"----------------------------------------\n\n"
                f"*Yesterday:* {yesterday}\n"
                f"*Today:* {today}\n"
                f"*Blockers:* {blocker}\n\n"
                f"----------------------------------------\n"
                f"*AI Analysis*\n"
                f"- *Sentiment:* {analysis.get('sentiment')}\n"
                f"- *Finished Tickets:* {finished}\n"
                f"- *Today's Tickets:* {today_tickets}\n"
                f"{blocker_section}\n\n"
                f"*Jira Actions:*\n{jira_report}\n\n"
                f"_Standup data saved and sent to analyzer._"
            ),
        )

        # Send to analyzer in background (non-critical)
        if standup_entry:
            background_executor.submit(send_to_standup_analyzer, standup_entry)

    except Exception as e:
        print(f"[ERROR] Logic Error: {e}")
        slack_client.chat_postMessage(
            channel=user_id,
            text="[WARNING] AI Analysis failed (check credits/billing).",
        )


# --- Standup Analyzer Endpoint ---


@app.route("/analyze/standup", methods=["POST"])
def analyze_standup():
    """Receive and analyze standup data."""
    try:
        data = request.get_json()
        print(f"[ANALYZER] Received standup data from {data.get('user_id')}")
        print(f"  Sentiment: {data.get('sentiment')}")
        print(f"  Blocker: {data.get('is_blocker')}")

        return jsonify({
            "status": "success",
            "message": "Standup data received and analyzed",
        }), 200
    except Exception as e:
        print(f"[ERROR] Analyzer Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# --- Slack Endpoints ---


@app.route("/slack/command", methods=["POST"])
def slash_command():
    """Handle the /standup slash command and open the modal form."""
    trigger_id = request.form.get("trigger_id")

    # Fetch all Jira projects for the dropdown
    try:
        projects = jira.get("rest/api/3/project")
        project_options = [
            {
                "text": {
                    "type": "plain_text",
                    "text": f"{p['name']} ({p['key']})",
                },
                "value": p["key"],
            }
            for p in projects
        ]
    except Exception:
        project_options = []

    if not project_options:
        default_key = os.environ.get("JIRA_PROJECT_KEY", "SCRUM")
        project_options = [
            {
                "text": {
                    "type": "plain_text",
                    "text": default_key,
                },
                "value": default_key,
            }
        ]

    modal = {
        "type": "modal",
        "callback_id": "st_sub",
        "title": {"type": "plain_text", "text": "Focus Flow"},
        "submit": {"type": "plain_text", "text": "Submit"},
        "blocks": [
            {
                "type": "input",
                "block_id": "p_b",
                "element": {
                    "type": "static_select",
                    "action_id": "p_i",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select a project",
                    },
                    "options": project_options,
                },
                "label": {
                    "type": "plain_text",
                    "text": "Which project is this standup for?",
                },
            },
            {
                "type": "input",
                "block_id": "y_b",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "y_i",
                    "multiline": True,
                },
                "label": {
                    "type": "plain_text",
                    "text": "What have you done yesterday?",
                },
            },
            {
                "type": "input",
                "block_id": "t_b",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "t_i",
                    "multiline": True,
                },
                "label": {
                    "type": "plain_text",
                    "text": "What will you do today?",
                },
            },
            {
                "type": "input",
                "block_id": "b_b",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "b_i",
                    "multiline": True,
                },
                "label": {
                    "type": "plain_text",
                    "text": "Have you faced any blockers?",
                },
                "optional": True,
            },
        ],
    }
    slack_client.views_open(trigger_id=trigger_id, view=modal)
    return "", 200


@app.route("/slack/events", methods=["POST"])
def interactions():
    """Handle Slack interactive events (modal submissions)."""
    payload = json.loads(request.form.get("payload"))
    if payload.get("type") == "view_submission":
        user_id = payload["user"]["id"]
        values = payload["view"]["state"]["values"]
        project_key = values["p_b"]["p_i"]["selected_option"]["value"]
        yesterday = values["y_b"]["y_i"]["value"]
        today = values["t_b"]["t_i"]["value"]
        blocker = values["b_b"]["b_i"]["value"] or "None"

        background_executor.submit(
            process_standup_logic, user_id, project_key, yesterday, today, blocker
        )
        return jsonify({"response_action": "clear"}), 200
    return "", 200


@app.route('/api/standup', methods=['POST'])
def api_standup():
    """Accept a standup payload from the frontend and run analysis."""
    data = request.get_json(silent=True) or {}
    project_key = data.get('project_key') or os.environ.get('JIRA_PROJECT_KEY', 'SCRUM')
    yesterday = data.get('yesterday')
    today = data.get('today')
    blocker = data.get('blocker', 'None')
    user_id = data.get('user_id')

    if not yesterday or not today:
        return jsonify({
            'status': 'error',
            'error': 'Both yesterday and today fields are required.'
        }), 400

    try:
        background_executor.submit(
            process_standup_logic, user_id, project_key, yesterday, today, blocker
        )

        return jsonify({
            'status': 'processing',
            'message': 'Standup analysis started successfully.'
        }), 202
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def api_health():
    return jsonify({'status': 'running', 'service': 'Focus Flow Standup', 'port': 3000}), 200


@app.route('/api/standup/history', methods=['GET'])
def api_standup_history():
    """Return standup history for the manager dashboard."""
    try:
        with open("standup_data.json", "r") as f:
            standup_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        standup_data = []

    project_key = request.args.get('project_key')
    if project_key:
        standup_data = [s for s in standup_data if s.get('project_key') == project_key]

    # Enrich with Slack display names where possible
    for entry in standup_data:
        if entry.get('user_id') and not entry.get('user_name'):
            try:
                info = slack_client.users_info(user=entry['user_id'])
                entry['user_name'] = info['user']['real_name']
                entry['avatar'] = info['user']['profile'].get('image_72', '')
            except Exception:
                entry['user_name'] = entry['user_id']
                entry['avatar'] = ''

    standup_data.reverse()
    return jsonify({'success': True, 'standups': standup_data})


# --- Proactive Blocker Scanner ---


def check_for_proactive_blockers():
    """Scan Jira for stale and pending tasks across all projects."""
    print("[SCAN] Checking for stale and pending tasks...")

    # Fetch all projects dynamically
    try:
        projects = jira.get("rest/api/3/project")
        project_keys = [p["key"] for p in projects]
    except Exception:
        project_keys = [os.environ.get("JIRA_PROJECT_KEY", "SCRUM")]

    for project_key in project_keys:
        checks = [
            {
                "jql": (
                    'status = "In Progress" AND updated < -1d'
                    f' AND project = "{project_key}"'
                ),
                "message": (
                    "*Stale Task Alert:* [{project}] Ticket *{key}* "
                    "({summary}) is In Progress but hasn't been "
                    "updated in over 24 hours. Are you blocked? "
                    "Type `/standup` if you need help!"
                ),
            },
            {
                "jql": (
                    'status = "To Do" AND assignee IS NOT EMPTY'
                    f' AND project = "{project_key}"'
                ),
                "message": (
                    "*Pending Task Reminder:* [{project}] Ticket "
                    "*{key}* ({summary}) is assigned to you and "
                    "still in To Do. Please start working on it "
                    "or update its status."
                ),
            },
        ]

        for check in checks:
            try:
                issues = jira.jql(check["jql"])["issues"]
                print(f"[SCAN] {project_key}: Found {len(issues)} issues for JQL: {check['jql']}")

                for issue in issues:
                    key = issue["key"]
                    assignee = issue["fields"].get("assignee")
                    if not assignee:
                        print(f"[SCAN] {key}: No assignee, skipping")
                        continue
                    assignee_email = assignee.get("emailAddress")
                    if not assignee_email:
                        print(f"[SCAN] {key}: Assignee has no email (privacy settings), skipping")
                        continue
                    summary = issue["fields"]["summary"]
                    status = issue["fields"]["status"]["name"]

                    try:
                        user_info = slack_client.users_lookupByEmail(
                            email=assignee_email
                        )
                        user_id = user_info["user"]["id"]

                        nudge_text = check["message"].format(
                            key=key,
                            summary=summary,
                            status=status,
                            project=project_key,
                        )
                        slack_client.chat_postMessage(
                            channel=user_id, text=nudge_text
                        )
                        print(
                            f"[SUCCESS] Nudged {assignee_email} "
                            f"regarding {key} ({status})"
                        )
                    except Exception as e:
                        print(
                            f"[WARNING] Could not notify Slack user "
                            f"{assignee_email} for {key}: {e}"
                        )

            except Exception as e:
                print(f"[ERROR] Scan Error for {project_key}: {e}")


# --- Standup Reminders ---


def get_all_slack_members():
    """Get all real (non-bot, non-deleted) Slack workspace members."""
    members = []
    try:
        result = slack_client.users_list()
        for member in result["members"]:
            if (
                not member.get("is_bot")
                and not member.get("deleted")
                and member.get("id") != "USLACKBOT"
            ):
                members.append({
                    "id": member["id"],
                    "name": member["profile"].get("real_name", "Unknown"),
                })
    except Exception as e:
        print(f"[ERROR] Failed to fetch Slack members: {e}")
    return members


def send_standup_reminder():
    """Send a morning reminder to all users to submit their standup."""
    print("[REMINDER] Sending standup reminders...")
    members = get_all_slack_members()
    print(f"[REMINDER] Found {len(members)} members: {[m['name'] for m in members]}")

    if not members:
        print("[REMINDER] ERROR: No members found! Check SLACK_BOT_TOKEN and users:read scope.")
        return

    for member in members:
        try:
            slack_client.chat_postMessage(
                channel=member["id"],
                text=(
                    "*Daily Standup Reminder*\n"
                    "Good morning! Time to submit your daily standup.\n"
                    "Type `/standup` to get started."
                ),
            )
            print(f"[SUCCESS] Reminder sent to {member['name']}")
        except Exception as e:
            print(f"[WARNING] Could not remind {member['name']}: {e}")


def check_missing_standups():
    """Check who hasn't submitted a standup today and send a follow-up."""
    print("[FOLLOWUP] Checking for missing standups...")

    today_str = date.today().isoformat()

    # Get today's submissions from standup_data.json
    submitted_users = set()
    try:
        with open("standup_data.json", "r") as f:
            standup_data = json.load(f)
        for entry in standup_data:
            if entry.get("timestamp", "").startswith(today_str):
                submitted_users.add(entry.get("user_id"))
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # Get all workspace members and find who hasn't submitted
    members = get_all_slack_members()
    missing = [m for m in members if m["id"] not in submitted_users]

    if not missing:
        print("[FOLLOWUP] All members have submitted their standups.")
        return

    for member in missing:
        try:
            slack_client.chat_postMessage(
                channel=member["id"],
                text=(
                    "*Standup Follow-Up*\n"
                    "You haven't submitted your standup today.\n"
                    "Please type `/standup` to submit it now."
                ),
            )
            print(f"[SUCCESS] Follow-up sent to {member['name']}")
        except Exception as e:
            print(f"[WARNING] Could not follow up {member['name']}: {e}")

    print(
        f"[FOLLOWUP] {len(missing)}/{len(members)} members "
        "haven't submitted yet."
    )


# --- Test Endpoints ---


@app.route("/test/reminder", methods=["GET"])
def test_reminder():
    """Manually trigger standup reminder for testing with diagnostics."""
    results = {"members_found": 0, "sent": [], "failed": [], "errors": []}

    try:
        members = get_all_slack_members()
        results["members_found"] = len(members)

        if not members:
            results["errors"].append("No members returned. Check SLACK_BOT_TOKEN and users:read scope.")
            return jsonify(results), 200

        for member in members:
            try:
                slack_client.chat_postMessage(
                    channel=member["id"],
                    text=(
                        "*Daily Standup Reminder*\n"
                        "Good morning! Time to submit your daily standup.\n"
                        "Type `/standup` to get started."
                    ),
                )
                results["sent"].append(member["name"])
            except Exception as e:
                results["failed"].append({"name": member["name"], "error": str(e)})

    except Exception as e:
        results["errors"].append(str(e))

    return jsonify(results), 200


@app.route("/test/followup", methods=["GET"])
def test_followup():
    """Manually trigger missing standup follow-up for testing."""
    check_missing_standups()
    return "Missing standup follow-up sent!", 200


@app.route("/test/stale", methods=["GET"])
def test_stale():
    """Manually trigger stale/pending task check for testing."""
    check_for_proactive_blockers()
    return "Stale/pending task check complete! Check console for results.", 200


# --- Scheduler ---
scheduler = BackgroundScheduler()
scheduler.add_job(check_for_proactive_blockers, "interval", days=1)
scheduler.add_job(send_standup_reminder, "interval", days=1)
scheduler.add_job(check_missing_standups, "interval", days=1)
scheduler.start()

if __name__ == "__main__":
    app.run(port=3000)
