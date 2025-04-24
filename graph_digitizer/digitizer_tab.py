from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, 
                             QLineEdit, QListWidget, QFileDialog, QMessageBox, 
                             QFormLayout, QDoubleSpinBox, QComboBox, QColorDialog, 
                             QFontDialog, QGroupBox)
from PyQt5.QtGui import QPixmap, QPainter, QPen, QColor, QFont
from PyQt5.QtCore import Qt, QPointF
import json
from matplotlib.figure import Figure
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas

class GraphDigitizerTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self.points = []
        self.image_path = ""
        self.x_label = "Error in meters"
        self.y_label = "CDF"
        self.x_min = 0
        self.x_max = 12.5
        self.y_min = 0
        self.y_max = 1
        self.graph_name = "Manual Data"
        self.line_color = "#1f77b4"  # Default matplotlib blue
        self.marker_style = "o"      # Default marker style (circle)
        self.axis_font = {'family': 'sans-serif', 'size': 16}  # Default axis font
        self.title_font = {'family': 'sans-serif', 'size': 16, 'weight': 'bold'}  # Default title font
        self.init_ui()
        
    def get_graph_data(self):
        return {
            "name": self.graph_name,
            "points": self.points,
            "x_label": self.x_label_input.text(),
            "y_label": self.y_label_input.text(),
            "x_min": self.x_min_input.value(),
            "x_max": self.x_max_input.value(),
            "y_min": self.y_min_input.value(),
            "y_max": self.y_max_input.value(),
            "color": self.line_color,
            "marker": self.marker_style,
            "axis_font": self.axis_font,
            "title_font": self.title_font,
            "image_path": self.image_path
        }
        
    def init_ui(self):
        self.layout = QHBoxLayout(self)
        
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
        
        # Graph name group
        self.name_group = QGroupBox("Graph Title")
        self.name_layout = QHBoxLayout(self.name_group)
        
        self.name_input = QLineEdit(self.graph_name)
        self.name_input.setStyleSheet("font-weight: bold;")
        self.name_layout.addWidget(self.name_input)
        
        self.title_font_btn = QPushButton("Font")
        self.title_font_btn.clicked.connect(self.set_title_font)
        self.name_layout.addWidget(self.title_font_btn)
        
        self.right_layout.addWidget(self.name_group)
        
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
        
        # Add line style controls
        self.color_btn = QPushButton("Line Color")
        self.color_btn.clicked.connect(self.choose_line_color)
        self.color_btn.setStyleSheet(f"background-color: {self.line_color}; color: white;")
        
        self.marker_style_combo = QComboBox()
        self.marker_style_combo.addItems(["None", "Circle (o)", "Square (s)", "Triangle (^)", 
                                         "Diamond (D)", "Plus (+)", "Cross (x)"])
        self.marker_style_combo.setCurrentIndex(1)  # Default to circle
        self.marker_style_combo.currentIndexChanged.connect(self.update_marker_style)
        
        # Font buttons
        self.axis_font_btn = QPushButton("Axis Font")
        self.axis_font_btn.clicked.connect(self.set_axis_font)
        
        self.axis_layout.addRow("X Axis Label:", self.x_label_input)
        self.axis_layout.addRow("Y Axis Label:", self.y_label_input)
        self.axis_layout.addRow("X Min:", self.x_min_input)
        self.axis_layout.addRow("X Max:", self.x_max_input)
        self.axis_layout.addRow("Y Min:", self.y_min_input)
        self.axis_layout.addRow("Y Max:", self.y_max_input)
        self.axis_layout.addRow("Line Color:", self.color_btn)
        self.axis_layout.addRow("Marker Style:", self.marker_style_combo)
        self.axis_layout.addRow("Axis Font:", self.axis_font_btn)
        
        self.right_layout.addWidget(self.axis_controls)
        
        # Points list
        self.points_label = QLabel("Selected Points:")
        self.right_layout.addWidget(self.points_label)
        
        self.points_list = QListWidget()
        self.right_layout.addWidget(self.points_list)
        
        # Button panel
        self.button_panel = QWidget()
        self.button_layout = QHBoxLayout(self.button_panel)
        
        self.clear_btn = QPushButton("Clear Points")
        self.clear_btn.clicked.connect(self.clear_points)
        self.button_layout.addWidget(self.clear_btn)
        
        self.export_pdf_btn = QPushButton("Export PDF")
        self.export_pdf_btn.clicked.connect(self.export_to_pdf)
        self.button_layout.addWidget(self.export_pdf_btn)
        
        self.export_json_btn = QPushButton("Export JSON")
        self.export_json_btn.clicked.connect(self.export_to_json)
        self.button_layout.addWidget(self.export_json_btn)
        
        self.right_layout.addWidget(self.button_panel)
        
        # Add panels to main layout
        self.layout.addWidget(self.left_panel, 70)
        self.layout.addWidget(self.right_panel, 30)
        
        # Connect mouse click event
        self.graph_label.mousePressEvent = self.graph_clicked
    
    def set_title_font(self):
        font, ok = QFontDialog.getFont()
        if ok:
            self.title_font = {
                'family': font.family(),
                'size': font.pointSize(),
                'weight': 'bold' if font.bold() else 'normal'
            }
            self.name_input.setFont(font)
    
    def set_axis_font(self):
        font, ok = QFontDialog.getFont()
        if ok:
            self.axis_font = {
                'family': font.family(),
                'size': font.pointSize(),
                'weight': 'bold' if font.bold() else 'normal'
            }
    
    def choose_line_color(self):
        color = QColorDialog.getColor(QColor(self.line_color), self)
        if color.isValid():
            self.line_color = color.name()
            self.color_btn.setStyleSheet(f"background-color: {self.line_color}; color: white;")
    
    def update_marker_style(self, index):
        marker_map = {
            0: "None",
            1: "o",
            2: "s",
            3: "^",
            4: "D",
            5: "+",
            6: "x"
        }
        self.marker_style = marker_map.get(index, "o")
        
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
                    # Get current axis settings
                    x_min = self.x_min_input.value()
                    x_max = self.x_max_input.value()
                    y_min = self.y_min_input.value()
                    y_max = self.y_max_input.value()
                    
                    # Convert to data coordinates
                    x_data = x_min + (img_x / img_width) * (x_max - x_min)
                    y_data = y_max - (img_y / img_height) * (y_max - y_min)
                    
                    # Store the point (data coordinates)
                    self.points.append((x_data, y_data))
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
        
        # Get current axis settings
        x_min = self.x_min_input.value()
        x_max = self.x_max_input.value()
        y_min = self.y_min_input.value()
        y_max = self.y_max_input.value()
        
        img_width = pixmap.width()
        img_height = pixmap.height()
        
        for point in self.points:
            # Convert data coordinates back to image coordinates for display
            x_data, y_data = point
            img_x = (x_data - x_min) / (x_max - x_min) * img_width
            img_y = img_height - (y_data - y_min) / (y_max - y_min) * img_height
            
            painter.drawPoint(QPointF(img_x, img_y))
        
        painter.end()
        self.graph_label.setPixmap(pixmap)
    
    def update_points_list(self):
        self.points_list.clear()
        
        for i, (x, y) in enumerate(self.points):
            self.points_list.addItem(f"Point {i+1}: ({x:.2f}, {y:.2f})")
    
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
        graph_name = self.name_input.text()
        
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
            
            # Plot the points with selected style
            x_vals = [p[0] for p in self.points]
            y_vals = [p[1] for p in self.points]
            
            if self.marker_style == "None":
                line = ax.plot(x_vals, y_vals, color=self.line_color, linestyle='-', 
                            label=graph_name)
            else:
                line = ax.plot(x_vals, y_vals, color=self.line_color, 
                            marker=self.marker_style, linestyle='-', 
                            label=graph_name)
            
            # Set labels with font properties
            ax.set_xlabel(x_label, fontdict=self.axis_font)
            ax.set_ylabel(y_label, fontdict=self.axis_font)
            
            # Set tick labels with the same font properties
            for label in ax.get_xticklabels():
                label.set_fontproperties(self.axis_font)
            for label in ax.get_yticklabels():
                label.set_fontproperties(self.axis_font)
            
            ax.set_xlim(x_min, x_max)
            ax.set_ylim(y_min, y_max)
            
            # Set title with font properties
            #if graph_name:
            #    ax.set_title(graph_name, fontdict=self.title_font, pad=20)
            
            ax.grid(True)
            
            # Add legend to top right
            ax.legend(loc='upper left', bbox_to_anchor=(0, 1), 
                    framealpha=1, edgecolor='black',
                    prop={'size': self.axis_font['size'], 
                        'family': self.axis_font['family']})
            
            # Adjust layout to prevent clipping
            fig.tight_layout()
            
            # Save to PDF
            fig.savefig(file_name, bbox_inches='tight')
            QMessageBox.information(self, "Success", f"Graph exported to {file_name}")
            
    def export_to_json(self):
        if not self.points:
            QMessageBox.warning(self, "Warning", "No points to export.")
            return
            
        # Get current settings including the new properties
        data = {
            "name": self.name_input.text(),
            "points": self.points,
            "x_label": self.x_label_input.text(),
            "y_label": self.y_label_input.text(),
            "x_min": self.x_min_input.value(),
            "x_max": self.x_max_input.value(),
            "y_min": self.y_min_input.value(),
            "y_max": self.y_max_input.value(),
            "line_color": self.line_color,
            "marker_style": self.marker_style,
            "axis_font": self.axis_font,
            "title_font": self.title_font,
            "image_path": self.image_path
        }
        
        options = QFileDialog.Options()
        file_name, _ = QFileDialog.getSaveFileName(
            self, "Save JSON", "", 
            "JSON Files (*.json)", 
            options=options
        )
        
        if file_name:
            if not file_name.endswith('.json'):
                file_name += '.json'
                
            with open(file_name, 'w') as f:
                json.dump(data, f, indent=4)
                
            QMessageBox.information(self, "Success", f"Data exported to {file_name}")