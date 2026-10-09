import hmac, json, os, re
from pathlib import Path
import pymysql
from pymysql.cursors import DictCursor
from flask import Flask, g, jsonify, render_template, request, session, url_for

BASE = Path(__file__).parent
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin@123")
DB_CFG = dict(
    host=os.environ.get("DB_HOST", "127.0.0.1"),
    port=int(os.environ.get("DB_PORT", "3306")),
    user=os.environ.get("DB_USER", "root"),
    password=os.environ.get("DB_PASSWORD", "admin@123"),
    charset="utf8mb4",
    cursorclass=DictCursor,
)
DB_NAME = os.environ.get("DB_NAME", "profile_site")
if not re.fullmatch(r"[A-Za-z0-9_]+", DB_NAME):
    raise SystemExit("DB_NAME may only contain letters, digits and underscores")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")


def db():
    if "db" not in g:
        g.db = pymysql.connect(database=DB_NAME, **DB_CFG)
    return g.db


@app.teardown_appcontext
def close_db(_):
    conn = g.pop("db", None)
    if conn:
        conn.close()


def init_db():
    
    conn = pymysql.connect(**DB_CFG)
    try:
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4")
            cur.execute(f"USE `{DB_NAME}`")
            cur.execute((BASE / "schema.sql").read_text())
        conn.commit()
    finally:
        conn.close()


def row_to_dict(r):
    tags = r["tags"]
    return {"id": r["id"], "title": r["title"], "description": r["description"],
            "tags": json.loads(tags) if isinstance(tags, (str, bytes)) else tags,
            "link": r["link"], "created_at": str(r["created_at"])}


def admin_only(fn):
    def wrapper(*a, **kw):
        if not session.get("admin"):
            return jsonify(error="Admin login required"), 401
        return fn(*a, **kw)
    wrapper.__name__ = fn.__name__
    return wrapper


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/me")
def me():
    return jsonify(admin=bool(session.get("admin")))


@app.post("/api/login")
def login():
    pw = (request.get_json(silent=True) or {}).get("password", "")
    if not ADMIN_PASSWORD or not hmac.compare_digest(str(pw), ADMIN_PASSWORD):
        return jsonify(error="Wrong password (or ADMIN_PASSWORD not set)"), 401
    session["admin"] = True
    return jsonify(ok=True)


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/projects")
def list_projects():
    with db().cursor() as cur:
        cur.execute("SELECT * FROM projects ORDER BY created_at DESC, id DESC")
        return jsonify([row_to_dict(r) for r in cur.fetchall()])


@app.post("/api/projects")
@admin_only
def add_project():
    d = request.get_json(silent=True) or {}
    title = str(d.get("title", "")).strip()[:80]
    if not title:
        return jsonify(error="Title is required"), 400
    link = str(d.get("link", "")).strip()[:500]
    if link and not link.startswith(("http://", "https://")):
        return jsonify(error="Link must start with http:// or https://"), 400
    raw_tags = d.get("tags", [])
    tags = [str(t).strip()[:30] for t in raw_tags if str(t).strip()][:10] if isinstance(raw_tags, list) else []
    with db().cursor() as cur:
        cur.execute(
            "INSERT INTO projects (title, description, tags, link) VALUES (%s, %s, %s, %s)",
            (title, str(d.get("description", "")).strip()[:300], json.dumps(tags), link))
        new_id = cur.lastrowid
    db().commit()
    return jsonify(id=new_id), 201


@app.delete("/api/projects/<int:pid>")
@admin_only
def delete_project(pid):
    with db().cursor() as cur:
        cur.execute("DELETE FROM projects WHERE id = %s", (pid,))
    db().commit()
    return jsonify(ok=True)


if __name__ == "__main__":
    if not ADMIN_PASSWORD:
        print("WARNING: set ADMIN_PASSWORD to enable admin login.")
    init_db()
    app.run(debug=False, port=5000)
