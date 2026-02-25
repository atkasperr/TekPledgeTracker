from flask import Flask, render_template

app = Flask(__name__)

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

from flask import request, jsonify

# Example REST API endpoints
@app.route('/api/coffee-chats', methods=['GET', 'POST'])
def api_coffee_chats():
    if request.method == 'GET':
        # Return example coffee chats
        return jsonify([
            {'id': 1, 'brother': 'John Doe', 'date': '2026-02-20'},
            {'id': 2, 'brother': 'Jane Smith', 'date': '2026-02-22'}
        ])
    elif request.method == 'POST':
        # Accept new coffee chat submission
        data = request.json
        return jsonify({'status': 'success', 'data': data}), 201

@app.route('/api/directory', methods=['GET'])
def api_directory():
    # Return example directory
    return jsonify([
        {'id': 1, 'name': 'John Doe', 'email': 'john@example.com'},
        {'id': 2, 'name': 'Jane Smith', 'email': 'jane@example.com'}
    ])

@app.route('/api/tasks', methods=['GET', 'POST'])
def api_tasks():
    if request.method == 'GET':
        # Return example tasks
        return jsonify([
            {'id': 1, 'task': 'Attend meeting', 'completed': False},
            {'id': 2, 'task': 'Submit project', 'completed': True}
        ])
    elif request.method == 'POST':
        # Accept new task submission
        data = request.json
        return jsonify({'status': 'success', 'data': data}), 201

if __name__ == '__main__':
    app.run(debug=True)
