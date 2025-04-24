from flask import Flask, render_template, request, send_file, redirect, url_for, flash, session
import os
from werkzeug.utils import secure_filename
import matplotlib.pyplot as plt
import matplotlib.backends.backend_pdf as pdf_backend
from io import BytesIO
from PIL import Image

app = Flask(__name__)
app.secret_key = 'secret_key'  # For flash messages and session
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Function to check if the file extension is allowed
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Function to convert image coordinates to graph coordinates
def convert_coordinates(x_image, y_image, x_start_val, x_end_val, y_start_val, y_end_val, image_width, image_height):
    x_graph = x_start_val + (x_image / image_width) * (x_end_val - x_start_val)
    y_graph = y_start_val + ((image_height - y_image) / image_height) * (y_end_val - y_start_val)  # Invert y
    return x_graph, y_graph

@app.route('/', methods=['GET', 'POST'])
def index():
    """
    Handles the main page of the web application.
    GET: Renders the form for uploading the image and selecting points.
    POST: Processes the uploaded image, stores the data in the session, and prepares the form for point selection.
    """
    if request.method == 'POST':
        # Check if a file was uploaded
        if 'image' not in request.files:
            flash('No file part')
            return redirect(request.url)
        file = request.files['image']

        # If the user does not select a file, the browser submits an
        # empty file without a filename.
        if file.filename == '':
            flash('No image selected')
            return redirect(request.url)

        # If the file is present and has an allowed extension, save it
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            # Store the filename and initial point data in the session.
            session['image_path'] = filepath
            session['points'] = []
            session['image_filename'] = filename  # Store for display
            return render_template('index.html', image_filename=filename, points=session.get('points', []))  # Pass points to template
        else:
            flash('Invalid file type. Please upload a png, jpg, jpeg, or bmp image.')
            return redirect(request.url)

    # Clear session data on initial load or refresh.  Use get() to avoid KeyError.
    image_filename = session.get('image_filename', None)
    points = session.get('points', [])
    return render_template('index.html', image_filename=image_filename, points=points) # Pass variables

@app.route('/add_point', methods=['POST'])
def add_point():
    """
    Handles adding points to the graph.
    POST: Adds the x, y coordinates of a selected point to the session.
    """
    x = float(request.form['x'])
    y = float(request.form['y'])
    point = {'x': x, 'y': y}
    if 'points' not in session:
        session['points'] = []
    session['points'].append(point)
    session.modified = True  # Important:  Tell Flask that the session has changed.
    return {'status': 'success', 'message': 'Point added successfully'} # Return JSON

@app.route('/get_points', methods=['GET'])
def get_points():
    """
    Returns the points stored in the session.
    GET: returns the list of points.
    """
    points = session.get('points', [])
    return {'points': points}  # Return the points as JSON

@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    """
    Generates a PDF from the uploaded image and selected points.
    POST: Creates a matplotlib plot, saves it to a PDF in memory, and sends the PDF as a response.
    """
    if 'image_path' not in session:
        flash('No image uploaded. Please upload an image first.')
        return redirect(url_for('index'))

    if 'points' not in session or not session['points']:
        flash('No points selected. Please select points on the graph.')
        return redirect(url_for('index'))

    image_path = session['image_path']
    points = session['points']

    x_label = request.form['x_label']
    y_label = request.form['y_label']
    x_start = request.form['x_start']
    x_end = request.form['x_end']
    y_start = request.form['y_start']
    y_end = request.form['y_end']

    # Load the image
    try:
        img = Image.open(image_path)
    except Exception as e:
        flash(f"Error opening image: {e}")
        return redirect(url_for('index'))
    image_width, image_height = img.size

     # Get axis limits
    try:
        x_start_val = float(x_start) if x_start else 0
        x_end_val = float(x_end) if x_end else image_width
        y_start_val = float(y_start) if y_start else 0
        y_end_val = float(y_end) if y_end else image_height
    except ValueError:
        flash("Invalid axis limits.  Please provide numeric values.")
        return redirect(url_for('index'))

    # Convert image coordinates to graph coordinates
    x_graph_points = []
    y_graph_points = []
    for point in points:
        x_image, y_image = point['x'], point['y']
        x_graph, y_graph = convert_coordinates(x_image, y_image, x_start_val, x_end_val, y_start_val, y_end_val, image_width, image_height)
        x_graph_points.append(x_graph)
        y_graph_points.append(y_graph)

    # Create the plot
    plt.figure(figsize=(8, 6))
    plt.imshow(img)  # Use PIL image object
    plt.axis('off')  # Turn off the axis numbers and ticks
    plt.plot(x_graph_points, y_graph_points, 'ro')  # Plot the converted points

    # Set labels and limits
    plt.xlabel(x_label)
    plt.ylabel(y_label)
    if x_start or x_end:
        plt.xlim(x_start_val, x_end_val)
    if y_start or y_end:
        plt.ylim(y_start_val, y_end_val)
    plt.gca().invert_yaxis()

    # Save the plot to a PDF in memory
    output = BytesIO()
    pdf_pages = pdf_backend.PdfPages(output)
    plt.savefig(pdf_pages, format='pdf')
    pdf_pages.close()
    plt.close()

    output.seek(0)  # Reset the buffer position to the beginning

    # Clear the session data after generating the PDF
    session.pop('image_path', None)
    session.pop('points', None)
    session.pop('image_filename', None)

    # Send the PDF file
    return send_file(output, download_name='graph.pdf', as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
