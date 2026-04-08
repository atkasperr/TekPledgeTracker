import os
from flask import Flask, render_template, request, jsonify, redirect, url_for
from dotenv import load_dotenv
from supabase import create_client
import base64
import json
from postgrest.exceptions import APIError

load_dotenv()

app = Flask(__name__)

# Initialize Supabase client using environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError('SUPABASE_URL and SUPABASE_KEY must be set in the environment')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def parse_jwt_payload(token):
    """Parse JWT payload without verification. Returns dict or None."""
    if not token or '.' not in token:
        return None
    try:
        parts = token.split('.')
        payload_b64 = parts[1]
        # pad base64
        padding = '=' * (-len(payload_b64) % 4)
        payload_b64 += padding
        payload_bytes = base64.urlsafe_b64decode(payload_b64.encode('utf-8'))
        payload = json.loads(payload_bytes.decode('utf-8'))
        return payload
    except Exception:
        return None


@app.context_processor
def inject_supabase_config():
    return {
        'supabase_url': SUPABASE_URL,
        'supabase_key': SUPABASE_KEY
    }


@app.route('/')
def index():
    return redirect(url_for('login'))


@app.route('/login')
def login():
    return render_template('login.html', hide_navbar=True)


@app.route('/session', methods=['POST', 'GET'])
def session_endpoint():
    # POST: receive access_token and set HttpOnly cookie
    if request.method == 'POST':
        payload = request.get_json() or {}
        token = payload.get('access_token')
        if not token:
            return jsonify({'status': 'error', 'message': 'missing access_token'}), 400
        parsed = parse_jwt_payload(token)
        if not parsed:
            return jsonify({'status': 'error', 'message': 'invalid token'}), 401
        # build minimal user info from token payload
        user = {
            'id': parsed.get('sub') or parsed.get('user_id') or parsed.get('id'),
            'email': parsed.get('email')
        }
        resp = jsonify({'status': 'ok', 'user': user})
        secure_flag = not app.debug
        resp.set_cookie('sb_access_token', token, httponly=True, secure=secure_flag, samesite='Lax', max_age=24*60*60)
        return resp

    # GET: return current user info based on HttpOnly cookie
    token = request.cookies.get('sb_access_token')
    if not token:
        return jsonify({'user': None}), 200
    parsed = parse_jwt_payload(token)
    if not parsed:
        resp = jsonify({'user': None})
        resp.delete_cookie('sb_access_token')
        return resp, 200
    user = {
        'id': parsed.get('sub') or parsed.get('user_id') or parsed.get('id'),
        'email': parsed.get('email')
    }
    return jsonify({'user': user}), 200


@app.route('/logout', methods=['POST', 'GET'])
def logout():
    # Clear the HttpOnly cookie and redirect to login
    resp = redirect(url_for('login'))
    resp.delete_cookie('sb_access_token')
    return resp


@app.route('/api/my-pledge', methods=['GET'])
def api_my_pledge():
    # Return the pledge row for the current user based on HttpOnly session cookie
    token = request.cookies.get('sb_access_token')
    if not token:
        return jsonify({'pledge': None}), 200
    parsed = parse_jwt_payload(token)
    if not parsed:
        resp = jsonify({'pledge': None})
        resp.delete_cookie('sb_access_token')
        return resp, 200
    email = parsed.get('email')
    if not email:
        return jsonify({'pledge': None}), 200
    try:
        res = supabase.table('pledges').select('*').eq('email', email).limit(1).execute()
        data = getattr(res, 'data', res)
        if data and isinstance(data, list) and len(data) > 0:
            return jsonify({'pledge': data[0]}), 200
        return jsonify({'pledge': None}), 200
    except Exception as e:
        return jsonify({'pledge': None, 'error': str(e)}), 200


@app.route('/signup')
def signup():
    return render_template('signup.html', hide_navbar=True)


@app.route('/reset-password')
def reset_password_page():
    return render_template('reset_password.html', hide_navbar=True)


@app.route('/home')
def home():
    return render_template('home.html')


@app.route('/coffee-chats')
def coffee_chats():
    return render_template('coffee_chats.html')


@app.route('/directory')
def directory():
    return render_template('directory.html')


@app.route('/tasks')
def tasks():
    return render_template('tasks.html')


@app.route('/calendar')
def calendar():
    return render_template('calendar.html')


# REST API endpoints wired to Supabase
@app.route('/api/coffee-chats', methods=['GET', 'POST'])
def api_coffee_chats():
    if request.method == 'GET':
        res = supabase.table('coffee_chat').select('*').execute()
        data = getattr(res, 'data', res)
        return jsonify(data)
    else:
        payload = request.json or {}
        # basic validation: ensure referenced pledge exists and brother_fullname is provided
        pledge_key = payload.get('pledge_uniq')
        brother_name = payload.get('brother_fullname')
        if pledge_key:
            pledge_check = supabase.table('pledges').select('uniquename').eq('uniquename', pledge_key).limit(1).execute()
            pledge_data = getattr(pledge_check, 'data', pledge_check)
            if not pledge_data:
                return jsonify({'status': 'error', 'message': f'pledge_uniq "{pledge_key}" not found in pledges'}), 400
        # brother_fullname is required by the coffee_chat table schema
        if not brother_name:
            return jsonify({'status': 'error', 'message': 'brother_fullname is required'}), 400

        try:
            res = supabase.table('coffee_chat').insert(payload).execute()
            data = getattr(res, 'data', res)
            return jsonify({'status': 'success', 'data': data}), 201
        except APIError as e:
            return jsonify({'status': 'error', 'message': str(e)}), 400


@app.route('/api/directory', methods=['GET'])
def api_directory():
    res = supabase.table('brothers').select('*').execute()
    data = getattr(res, 'data', res)
    return jsonify(data)


@app.route('/api/tasks', methods=['GET', 'POST'])
def api_tasks():
    if request.method == 'GET':
        res = supabase.table('tasks').select('*').execute()
        data = getattr(res, 'data', res)
        return jsonify(data)
    else:
        payload = request.json or {}
        res = supabase.table('tasks').insert(payload).execute()
        data = getattr(res, 'data', res)
        return jsonify({'status': 'success', 'data': data}), 201


@app.route('/api/pledges', methods=['GET', 'POST'])
def api_pledges():
    if request.method == 'GET':
        res = supabase.table('pledges').select('*').execute()
        data = getattr(res, 'data', res)
        return jsonify(data)
    else:
        payload = request.json or {}

        # Only allow columns that the signup form sends.
        # This avoids Supabase/PostgREST errors when extra keys (like `role`) aren't present in the table schema.
        allowed_fields = {'uniquename', 'name', 'email', 'phone', 'year', 'major', 'pc', 'tasks_per_week'}
        payload = {k: v for k, v in payload.items() if k in allowed_fields}

        # Normalize empty strings and trim whitespace.
        for k, v in list(payload.items()):
            if isinstance(v, str):
                v = v.strip()
                payload[k] = v if v else None

        # require uniquename
        uniq = payload.get('uniquename')
        if not uniq:
            return jsonify({'status': 'error', 'message': 'uniquename is required'}), 400

        # Normalize year to integer if present.
        if payload.get('year') is not None:
            try:
                payload['year'] = int(payload['year'])
            except (TypeError, ValueError):
                return jsonify({'status': 'error', 'message': 'year must be a number'}), 400

        if payload.get('tasks_per_week') is not None:
            try:
                n = int(payload['tasks_per_week'])
            except (TypeError, ValueError):
                return jsonify({'status': 'error', 'message': 'tasks_per_week must be a number'}), 400
            if n < 0 or n > 50:
                return jsonify({'status': 'error', 'message': 'tasks_per_week must be between 0 and 50'}), 400
            payload['tasks_per_week'] = n

        try:
            res = supabase.table('pledges').insert(payload).execute()
            data = getattr(res, 'data', res)
            return jsonify({'status': 'success', 'data': data}), 201
        except APIError as e:
            return jsonify({
                'status': 'error',
                'message': str(e),
                'payload_keys': list(payload.keys())
            }), 400


@app.route('/api/brothers', methods=['GET', 'POST'])
def api_brothers():
    if request.method == 'GET':
        res = supabase.table('brothers').select('*').execute()
        data = getattr(res, 'data', res)
        return jsonify(data)
    else:
        payload = request.json or {}

        # Only allow columns that the signup form sends.
        allowed_fields = {'uniquename', 'name', 'email', 'phone', 'year', 'major', 'pc'}
        payload = {k: v for k, v in payload.items() if k in allowed_fields}

        # Normalize empty strings and trim whitespace.
        for k, v in list(payload.items()):
            if isinstance(v, str):
                v = v.strip()
                payload[k] = v if v else None

        # require uniquename
        uniq = payload.get('uniquename')
        if not uniq:
            return jsonify({'status': 'error', 'message': 'uniquename is required'}), 400

        # Normalize year to integer if present.
        if payload.get('year') is not None:
            try:
                payload['year'] = int(payload['year'])
            except (TypeError, ValueError):
                return jsonify({'status': 'error', 'message': 'year must be a number'}), 400

        try:
            res = supabase.table('brothers').insert(payload).execute()
            data = getattr(res, 'data', res)
            return jsonify({'status': 'success', 'data': data}), 201
        except APIError as e:
            return jsonify({
                'status': 'error',
                'message': str(e),
                'payload_keys': list(payload.keys())
            }), 400


if __name__ == '__main__':
    app.run(debug=True)
