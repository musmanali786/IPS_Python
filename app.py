import sys
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QLabel, QPushButton, QListWidget, QLineEdit, QDoubleSpinBox, 
                             QFileDialog, QMessageBox)
from PyQt5.QtGui import QPixmap, QPainter, QPen, QColor
from PyQt5.QtCore import Qt
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import matplotlib.pyplot as plt
import numpy as np

class GraphDigitizerApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Graph Digitizer")
        self.setGeometry(100, 100, 1000, 600)
        
        # Initialize variables
        self.image_path = None
        self.points = []
        self.original_pixmap = None
        
        # Create main widget and layout
        self.main_widget = QWidget()
        self.setCentralWidget(self.main_widget)
        self.main_layout = QHBoxLayout(self.main_widget)
        
        # Left side - image display
        self.left_widget = QWidget()
        self.left_layout = QVBoxLayout(self.left_widget)
        
        self.image_label = QLabel()
        self.image_label.setAlignment(Qt.AlignCenter)
        self.image_label.setStyleSheet("background-color: white; border: 1px solid black;")
        self.image_label.mousePressEvent = self.image_clicked
        
        self.upload_button = QPushButton("Upload Graph Image")
        self.upload_button.clicked.connect(self.upload_image)
        
        self.left_layout.addWidget(self.upload_button)
        self.left_layout.addWidget(self.image_label)
        
        # Right side - controls and points list
        self.right_widget = QWidget()
        self.right_layout = QVBoxLayout(self.right_widget)
        
        # Axis labels
        self.axis_label = QLabel("Axis Settings")
        self.axis_label.setStyleSheet("font-weight: bold;")
        
        self.x_label_layout = QHBoxLayout()
        self.x_label_text = QLabel("X-axis Label:")
        self.x_label_input = QLineEdit("X")
        self.x_label_layout.addWidget(self.x_label_text)
        self.x_label_layout.addWidget(self.x_label_input)
        
        self.y_label_layout = QHBoxLayout()
        self.y_label_text = QLabel("Y-axis Label:")
        self.y_label_input = QLineEdit("Y")
        self.y_label_layout.addWidget(self.y_label_text)
        self.y_label_layout.addWidget(self.y_label_input)
        
        # Axis limits
        self.x_limits_layout = QHBoxLayout()
        self.x_min_text = QLabel("X min:")
        self.x_min_input = QDoubleSpinBox()
        self.x_min_input.setRange(-1e9, 1e9)
        self.x_min_input.setValue(0)
        self.x_max_text = QLabel("X max:")
        self.x_max_input = QDoubleSpinBox()
        self.x_max_input.setRange(-1e9, 1e9)
        self.x_max_input.setValue(100)
        self.x_limits_layout.addWidget(self.x_min_text)
        self.x_limits_layout.addWidget(self.x_min_input)
        self.x_limits_layout.addWidget(self.x_max_text)
        self.x_limits_layout.addWidget(self.x_max_input)
        
        self.y_limits_layout = QHBoxLayout()
        self.y_min_text = QLabel("Y min:")
        self.y_min_input = QDoubleSpinBox()
        self.y_min_input.setRange(-1e9, 1e9)
        self.y_min_input.setValue(0)
        self.y_max_text = QLabel("Y max:")
        self.y_max_input = QDoubleSpinBox()
        self.y_max_input.setRange(-1e9, 1e9)
        self.y_max_input.setValue(100)
        self.y_limits_layout.addWidget(self.y_min_text)
        self.y_limits_layout.addWidget(self.y_min_input)
        self.y_limits_layout.addWidget(self.y_max_text)
        self.y_limits_layout.addWidget(self.y_max_input)
        
        # Points list
        self.points_label = QLabel("Selected Points")
        self.points_label.setStyleSheet("font-weight: bold;")
        
        self.points_list = QListWidget()
        
        self.clear_button = QPushButton("Clear Points")
        self.clear_button.clicked.connect(self.clear_points)
        
        # Generate PDF button
        self.generate_button = QPushButton("Generate PDF Graph")
        self.generate_button.clicked.connect(self.generate_pdf)
        
        # Add widgets to right layout
        self.right_layout.addWidget(self.axis_label)
        self.right_layout.addLayout(self.x_label_layout)
        self.right_layout.addLayout(self.y_label_layout)
        self.right_layout.addLayout(self.x_limits_layout)
        self.right_layout.addLayout(self.y_limits_layout)
        self.right_layout.addWidget(self.points_label)
        self.right_layout.addWidget(self.points_list)
        self.right_layout.addWidget(self.clear_button)
        self.right_layout.addWidget(self.generate_button)
        self.right_layout.addStretch()
        
        # Add left and right widgets to main layout
        self.main_layout.addWidget(self.left_widget, 70)
        self.main_layout.addWidget(self.right_widget, 30)
    
    def upload_image(self):
        options = QFileDialog.Options()
        file_name, _ = QFileDialog.getOpenFileName(self, "Open Graph Image", "", 
                                                  "Image Files (*.png *.jpg *.jpeg *.bmp *.gif)", 
                                                  options=options)
        if file_name:
            self.image_path = file_name
            self.original_pixmap = QPixmap(file_name)
            self.display_image()
            self.clear_points()
    
    def display_image(self):
        if self.original_pixmap:
            # Scale the pixmap to fit the label while maintaining aspect ratio
            scaled_pixmap = self.original_pixmap.scaled(
                self.image_label.width(), self.image_label.height(), 
                Qt.KeepAspectRatio, Qt.SmoothTransformation
            )
            self.image_label.setPixmap(scaled_pixmap)
    
    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.display_image()
    
    def image_clicked(self, event):
        if self.image_path:
            x = event.pos().x() * (self.x_max_input.value() - self.x_min_input.value()) / self.image_label.width() + self.x_min_input.value()
            y = (self.image_label.height() - event.pos().y()) * (self.y_max_input.value() - self.y_min_input.value()) / self.image_label.height() + self.y_min_input.value()
            point = (x, y)
            self.points.append(point)
            self.update_points_list()
            self.draw_point_on_image(point)
            self.display_image()
    def draw_point_on_image(self, point):
        if self.original_pixmap:
            painter = QPainter(self.original_pixmap)
            pen = QPen(QColor(255, 0, 0), 5)
            painter.setPen(pen) # Set the pen color to red  
            