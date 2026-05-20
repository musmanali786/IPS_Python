from flask import Flask, render_template, request, redirect, url_for, send_file
import os
from werkzeug.utils import secure_filename
import matplotlib.pyplot as plt
from io import BytesIO
import base64
from PIL import Image
import numpy as np

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Global variables to store app state
app_state = {
    'image_path': '',
    'points': [],
    'x_label': 'X Axis',
    'y_label': 'Y Axis',
    'x_min': 0,
    'x_max': 10,
    'y_min': 0,
    'y_max': 10,
    'image_size': (0, 0)  # (width, height)
}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    return render_template('index.html', state=app_state)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return redirect(request.url)
    
    file = request.files['file']
    if file.filename == '':
        return redirect(request.url)
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Update app state
        app_state['image_path'] = filepath
        app_state['points'] = []
        
        # Get image dimensions
        with Image.open(filepath) as img:
            app_state['image_size'] = img.size
        
        return redirect(url_for('index'))
    
    return redirect(request.url)

@app.route('/add_point', methods=['POST'])
def add_point():
    if not app_state['image_path']:
        return {'status': 'error', 'message': 'No image loaded'}, 400
    
    try:
        x = float(request.form['x'])
        y = float(request.form['y'])
        
        # Convert from image coordinates to data coordinates
        img_width, img_height = app_state['image_size']
        
        x_data = app_state['x_min'] + (x / img_width) * (app_state['x_max'] - app_state['x_min'])
        y_data = app_state['y_max'] - (y / img_height) * (app_state['y_max'] - app_state['y_min'])
        
        app_state['points'].append((x_data, y_data))
        
        return {'status': 'success', 'points': app_state['points']}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 400

@app.route('/update_settings', methods=['POST'])
def update_settings():
    try:
        app_state['x_label'] = request.form['x_label']
        app_state['y_label'] = request.form['y_label']
        app_state['x_min'] = float(request.form['x_min'])
        app_state['x_max'] = float(request.form['x_max'])
        app_state['y_min'] = float(request.form['y_min'])
        app_state['y_max'] = float(request.form['y_max'])
        
        return {'status': 'success'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 400

@app.route('/clear_points', methods=['POST'])
def clear_points():
    app_state['points'] = []
    return {'status': 'success'}

@app.route('/export_pdf')
def export_pdf():
    if not app_state['points']:
        return {'status': 'error', 'message': 'No points to export'}, 400
    
    # Create plot
    plt.figure(figsize=(8, 6))
    x_vals = [p[0] for p in app_state['points']]
    y_vals = [p[1] for p in app_state['points']]
    plt.plot(x_vals, y_vals, 'ro-')
    plt.xlabel(app_state['x_label'])
    plt.ylabel(app_state['y_label'])
    plt.xlim(app_state['x_min'], app_state['x_max'])
    plt.ylim(app_state['y_min'], app_state['y_max'])
    plt.grid(True)
    
    # Save to bytes buffer
    buf = BytesIO()
    plt.savefig(buf, format='pdf', bbox_inches='tight')
    plt.close()
    buf.seek(0)
    
    return send_file(
        buf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='graph.pdf'
    )

if __name__ == '__main__':
    app.run(debug=True)
    