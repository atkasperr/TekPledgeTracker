import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from supabase import create_client
from postgrest.exceptions import APIError

load_dotenv()

app = Flask(__name__)

# Initialize Supabase client using environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError('SUPABASE_URL and SUPABASE_KEY must be set in the environment')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@app.context_processor
def inject_supabase_config():
    return {
        'supabase_url': SUPABASE_URL,
        'supabase_key': SUPABASE_KEY
    }


@app.route('/')
def landing():
    return render_template('landing.html')


@app.route('/login')
def login():
    return render_template('login.html')


@app.route('/signup')
def signup():
    return render_template('signup.html')


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
        # basic validation: ensure referenced pledge and brother exist
        pledge_key = payload.get('pledge_uniq')
        brother_key = payload.get('brother_uniq')
        if pledge_key:
            pledge_check = supabase.table('pledges').select('uniquename').eq('uniquename', pledge_key).limit(1).execute()
            pledge_data = getattr(pledge_check, 'data', pledge_check)
            if not pledge_data:
                return jsonify({'status': 'error', 'message': f'pledge_uniq "{pledge_key}" not found in pledges'}), 400
        if brother_key:
            brother_check = supabase.table('brothers').select('uniquename').eq('uniquename', brother_key).limit(1).execute()
            brother_data = getattr(brother_check, 'data', brother_check)
            if not brother_data:
                return jsonify({'status': 'error', 'message': f'brother_uniq "{brother_key}" not found in brothers'}), 400

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
