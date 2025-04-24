import sys
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QLabel, QPushButton, QLineEdit, QListWidget, QFileDialog, 
                             QMessageBox, QFormLayout, QDoubleSpinBox)
from PyQt5.QtGui import QPixmap, QPainter, QPen, QColor
from PyQt5.QtCore import Qt, QPointF
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import matplotlib.pyplot as plt
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
from PIL import Image


class GraphDigitizer(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Graph Digitizer")
        self.setGeometry(100, 100, 1000, 600)
        
        # Data storage
        self.points = []
        self.image_path = ""
        self.x_label = "X Axis"
        self.y_label = "Y Axis"
        self.x_min = 0
        self.x_max = 10
        self.y_min = 0
        self.y_max = 10
        
        # Main widget and layout
        self.main_widget = QWidget()
        self.setCentralWidget(self.main_widget)
        self.layout = QHBoxLayout(self.main_widget)
        
        # Left panel (graph display)
        self.left_panel = QWidget()
        self.left_layout = QVBoxLayout(self.left_panel)
        
        # Graph display area
        self.graph_label = QLabel()
        self.graph_label.setAlignment(Qt.AlignCenter)
        self.graph_label.setStyleSheet("background-color: white; border: 1px solid black;")
        self.left_layout.addWidget(self.graph_label)
        
        # Upload button
        self.upload_btn = QPushButton("Upload Graph Image")
        self.upload_btn.clicked.connect(self.upload_image)
        self.left_layout.addWidget(self.upload_btn)
        
        # Right panel (controls and points list)
        self.right_panel = QWidget()
        self.right_layout = QVBoxLayout(self.right_panel)
        
        # Axis controls
        self.axis_controls = QWidget()
        self.axis_layout = QFormLayout(self.axis_controls)
        
        self.x_label_input = QLineEdit(self.x_label)
        self.y_label_input = QLineEdit(self.y_label)
        
        self.x_min_input = QDoubleSpinBox()
        self.x_min_input.setRange(-1e9, 1e9)
        self.x_min_input.setValue(self.x_min)
        
        self.x_max_input = QDoubleSpinBox()
        self.x_max_input.setRange(-1e9, 1e9)
        self.x_max_input.setValue(self.x_max)
        
        self.y_min_input = QDoubleSpinBox()
        self.y_min_input.setRange(-1e9, 1e9)
        self.y_min_input.setValue(self.y_min)
        
        self.y_max_input = QDoubleSpinBox()
        self.y_max_input.setRange(-1e9, 1e9)
        self.y_max_input.setValue(self.y_max)
        
        self.axis_layout.addRow("X Axis Label:", self.x_label_input)
        self.axis_layout.addRow("Y Axis Label:", self.y_label_input)
        self.axis_layout.addRow("X Min:", self.x_min_input)
        self.axis_layout.addRow("X Max:", self.x_max_input)
        self.axis_layout.addRow("Y Min:", self.y_min_input)
        self.axis_layout.addRow("Y Max:", self.y_max_input)
        
        self.right_layout.addWidget(self.axis_controls)
        
        # Points list
        self.points_label = QLabel("Selected Points:")
        self.right_layout.addWidget(self.points_label)
        
        self.points_list = QListWidget()
        self.right_layout.addWidget(self.points_list)
        
        # Clear points button
        self.clear_btn = QPushButton("Clear Points")
        self.clear_btn.clicked.connect(self.clear_points)
        self.right_layout.addWidget(self.clear_btn)
        
        # Export PDF button
        self.export_btn = QPushButton("Export to PDF")
        self.export_btn.clicked.connect(self.export_to_pdf)
        self.right_layout.addWidget(self.export_btn)
        
        # Add panels to main layout
        self.layout.addWidget(self.left_panel, 70)
        self.layout.addWidget(self.right_panel, 30)
        
        # Connect mouse click event
        self.graph_label.mousePressEvent = self.graph_clicked
        
    def upload_image(self):
        options = QFileDialog.Options()
        file_name, _ = QFileDialog.getOpenFileName(
            self, "Open Graph Image", "", 
            "Image Files (*.png *.jpg *.jpeg *.bmp *.gif)", 
            options=options
        )
        
        if file_name:
            self.image_path = file_name
            pixmap = QPixmap(file_name)
            self.graph_label.setPixmap(pixmap.scaled(
                self.graph_label.width(), 
                self.graph_label.height(), 
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation
            ))
            self.points = []
            self.update_points_list()
    
    def graph_clicked(self, event):
        if not self.image_path:
            QMessageBox.warning(self, "Warning", "Please upload a graph image first.")
            return
            
        if event.button() == Qt.LeftButton:
            # Get click position relative to the label
            pos = event.pos()
            pixmap = self.graph_label.pixmap()
            if pixmap:
                # Calculate position within the actual image
                img_width = pixmap.width()
                img_height = pixmap.height()
                
                label_width = self.graph_label.width()
                label_height = self.graph_label.height()
                
                x_offset = (label_width - img_width) // 2
                y_offset = (label_height - img_height) // 2
                
                # Adjust for image centering in the label
                img_x = pos.x() - x_offset
                img_y = pos.y() - y_offset
                
                if 0 <= img_x <= img_width and 0 <= img_y <= img_height:
                    # Store the point (image coordinates)
                    self.points.append((img_x, img_y))
                    self.update_points_list()
                    self.draw_points_on_image()
    
    def draw_points_on_image(self):
        if not self.image_path or not self.points:
            return
            
        pixmap = QPixmap(self.image_path)
        pixmap = pixmap.scaled(
            self.graph_label.width(), 
            self.graph_label.height(), 
            Qt.KeepAspectRatio,
            Qt.SmoothTransformation
        )
        
        painter = QPainter(pixmap)
        painter.setPen(QPen(QColor(255, 0, 0), 5))  # Red pen, 5px width
        
        for point in self.points:
            painter.drawPoint(QPointF(point[0], point[1]))
        
        painter.end()
        self.graph_label.setPixmap(pixmap)
    
    def update_points_list(self):
        self.points_list.clear()
        
        # Get current axis settings
        x_min = self.x_min_input.value()
        x_max = self.x_max_input.value()
        y_min = self.y_min_input.value()
        y_max = self.y_max_input.value()
        
        # Get image dimensions
        pixmap = self.graph_label.pixmap()
        if not pixmap:
            return
            
        img_width = pixmap.width()
        img_height = pixmap.height()
        
        for i, (img_x, img_y) in enumerate(self.points):
            # Convert image coordinates to data coordinates
            x_data = x_min + (img_x / img_width) * (x_max - x_min)
            y_data = y_max - (img_y / img_height) * (y_max - y_min)  # Y axis is inverted
            
            self.points_list.addItem(f"Point {i+1}: ({x_data:.2f}, {y_data:.2f})")
    
    def clear_points(self):
        self.points = []
        self.update_points_list()
        if self.image_path:
            pixmap = QPixmap(self.image_path)
            self.graph_label.setPixmap(pixmap.scaled(
                self.graph_label.width(), 
                self.graph_label.height(), 
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation
            ))
    
    def export_to_pdf(self):
        if not self.points:
            QMessageBox.warning(self, "Warning", "No points to export.")
            return
            
        # Get current settings
        x_label = self.x_label_input.text()
        y_label = self.y_label_input.text()
        x_min = self.x_min_input.value()
        x_max = self.x_max_input.value()
        y_min = self.y_min_input.value()
        y_max = self.y_max_input.value()
        
        # Get image dimensions
        pixmap = self.graph_label.pixmap()
        if not pixmap:
            return
            
        img_width = pixmap.width()
        img_height = pixmap.height()
        
        # Convert points to data coordinates
        data_points = []
        for img_x, img_y in self.points:
            x_data = x_min + (img_x / img_width) * (x_max - x_min)
            y_data = y_max - (img_y / img_height) * (y_max - y_min)
            data_points.append((x_data, y_data))
        
        # Create a PDF
        options = QFileDialog.Options()
        file_name, _ = QFileDialog.getSaveFileName(
            self, "Save PDF", "", 
            "PDF Files (*.pdf)", 
            options=options
        )
        
        if file_name:
            if not file_name.endswith('.pdf'):
                file_name += '.pdf'
                
            # Create matplotlib figure
            fig = Figure(figsize=(8, 6))
            ax = fig.add_subplot(111)
            
            # Plot the points
            x_vals = [p[0] for p in data_points]
            y_vals = [p[1] for p in data_points]
            ax.plot(x_vals, y_vals, 'ro-')
            
            # Set labels and limits
            ax.set_xlabel(x_label)
            ax.set_ylabel(y_label)
            ax.set_xlim(x_min, x_max)
            ax.set_ylim(y_min, y_max)
            ax.grid(True)
            
            # Save to PDF
            fig.savefig(file_name, bbox_inches='tight')
            QMessageBox.information(self, "Success", f"Graph exported to {file_name}")


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = GraphDigitizer()
    window.show()
    sys.exit(app.exec_())