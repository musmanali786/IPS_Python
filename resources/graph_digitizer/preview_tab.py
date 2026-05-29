import json
from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QPushButton, 
                            QFileDialog, QListWidget, QMessageBox, QInputDialog,
                            QDialog, QFormLayout, QLineEdit, QDoubleSpinBox,
                            QComboBox, QColorDialog, QDialogButtonBox)
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QColor

class PreviewTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self.graph_data = []
        self.init_ui()
        
    def init_ui(self):
        self.layout = QVBoxLayout(self)
        
        # Canvas for preview
        self.figure = Figure(figsize=(8, 6))
        self.canvas = FigureCanvas(self.figure)
        self.layout.addWidget(self.canvas)
        
        # Controls
        self.controls = QHBoxLayout()
        
        self.load_json_btn = QPushButton("Load JSON")
        self.load_json_btn.clicked.connect(self.load_json)
        self.controls.addWidget(self.load_json_btn)
        
        self.clear_btn = QPushButton("Clear All")
        self.clear_btn.clicked.connect(self.clear_all)
        self.controls.addWidget(self.clear_btn)
        
        self.properties_btn = QPushButton("Change Graph Properties")
        self.properties_btn.clicked.connect(self.change_graph_properties)
        self.controls.addWidget(self.properties_btn)
        
        self.export_btn = QPushButton("Export Combined PDF")
        self.export_btn.clicked.connect(self.export_combined_pdf)
        self.controls.addWidget(self.export_btn)
        
        self.layout.addLayout(self.controls)
        
        # Loaded graphs list
        self.graphs_list = QListWidget()
        self.graphs_list.setSelectionMode(QListWidget.SingleSelection)
        self.graphs_list.itemDoubleClicked.connect(self.change_graph_properties)
        self.layout.addWidget(self.graphs_list)
    
    def load_json(self):
        options = QFileDialog.Options()
        files, _ = QFileDialog.getOpenFileNames(
            self, "Open JSON Files", "", 
            "JSON Files (*.json)", 
            options=options
        )
        
        for file in files:
            try:
                with open(file, 'r') as f:
                    data = json.load(f)
                    self.graph_data.append(data)
                    self.graphs_list.addItem(data.get("name", "Unnamed Graph"))
            except Exception as e:
                QMessageBox.warning(self, "Error", f"Failed to load {file}: {str(e)}")
        
        self.update_preview()
    
    def change_graph_properties(self):
        selected_items = self.graphs_list.selectedItems()
        if not selected_items:
            QMessageBox.warning(self, "Warning", "Please select a graph to modify.")
            return
            
        selected_item = selected_items[0]
        row = self.graphs_list.row(selected_item)
        data = self.graph_data[row]
        
        # Create properties dialog
        dialog = QDialog(self)
        dialog.setWindowTitle("Graph Properties")
        layout = QVBoxLayout()
        
        # Form for properties
        form = QFormLayout()
        
        # Graph name
        name_input = QLineEdit(data.get("name", "Unnamed Graph"))
        form.addRow("Graph Name:", name_input)
        
        # X-axis properties
        x_label_input = QLineEdit(data.get("x_label", "X Axis"))
        x_min_input = QDoubleSpinBox()
        x_min_input.setRange(-1e9, 1e9)
        x_min_input.setValue(data.get("x_min", 0))
        x_max_input = QDoubleSpinBox()
        x_max_input.setRange(-1e9, 1e9)
        x_max_input.setValue(data.get("x_max", 10))
        
        form.addRow("X Axis Label:", x_label_input)
        form.addRow("X Min:", x_min_input)
        form.addRow("X Max:", x_max_input)
        
        # Y-axis properties
        y_label_input = QLineEdit(data.get("y_label", "Y Axis"))
        y_min_input = QDoubleSpinBox()
        y_min_input.setRange(-1e9, 1e9)
        y_min_input.setValue(data.get("y_min", 0))
        y_max_input = QDoubleSpinBox()
        y_max_input.setRange(-1e9, 1e9)
        y_max_input.setValue(data.get("y_max", 10))
        
        form.addRow("Y Axis Label:", y_label_input)
        form.addRow("Y Min:", y_min_input)
        form.addRow("Y Max:", y_max_input)
        
        # Line properties
        color_btn = QPushButton("Line Color")
        current_color = data.get("line_color", data.get("color", "#1f77b4"))
        color_btn.setStyleSheet(f"background-color: {current_color}; color: white;")
        color_btn.clicked.connect(lambda: self.choose_color(color_btn))
        
        marker_style_combo = QComboBox()
        marker_style_combo.addItems(["None", "Circle (o)", "Square (s)", "Triangle (^)", 
                                   "Diamond (D)", "Plus (+)", "Cross (x)"])
        current_marker = data.get("marker_style", "o")
        marker_map = {"None": 0, "o": 1, "s": 2, "^": 3, "D": 4, "+": 5, "x": 6}
        marker_style_combo.setCurrentIndex(marker_map.get(current_marker, 1))
        
        form.addRow("Line Color:", color_btn)
        form.addRow("Marker Style:", marker_style_combo)
        self.line_color = current_color
        
        layout.addLayout(form)
        
        # Dialog buttons
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(dialog.accept)
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)
        
        dialog.setLayout(layout)
        
        if dialog.exec_() == QDialog.Accepted:
            # Update graph data with new properties
            data["name"] = name_input.text()
            data["x_label"] = x_label_input.text()
            data["y_label"] = y_label_input.text()
            data["x_min"] = x_min_input.value()
            data["x_max"] = x_max_input.value()
            data["y_min"] = y_min_input.value()
            data["y_max"] = y_max_input.value()
            data["line_color"] = self.line_color
            data["marker_style"] = ["None", "o", "s", "^", "D", "+", "x"][marker_style_combo.currentIndex()]
            
            # Update list item
            selected_item.setText(data["name"])
            self.update_preview()
    
    def choose_color(self, button):
        color = QColorDialog.getColor(QColor(button.palette().button().color()), self)
        if color.isValid():
            button.setStyleSheet(f"background-color: {color.name()}; color: white;")
            #button.property("color", color.name())
            self.line_color = color.name()
    
    def clear_all(self):
        self.graph_data = []
        self.graphs_list.clear()
        self.update_preview()
    
    def update_preview(self):
        self.figure.clear()
        ax = self.figure.add_subplot(111)
        
        for data in self.graph_data:
            if not data.get("points"):
                continue
                
            x_vals = [p[0] for p in data["points"]]
            y_vals = [p[1] for p in data["points"]]
            
            # Get styling from data or use defaults
            color = data.get("line_color", data.get("color", "#1f77b4"))
            marker = data.get("marker_style", "o")
            linestyle = '-'  # Default line style
            
            # Get font properties or use defaults
            axis_font = data.get("axis_font", {'family': 'sans-serif', 'size': 11})
            title_font = data.get("title_font", {'family': 'sans-serif', 'size': 12, 'weight': 'bold'})
            
            # Plot with the specified style
            if marker.lower() == "none":
                ax.plot(x_vals, y_vals, 
                       color=color, 
                       linestyle=linestyle,
                       label=data.get("name", "Unnamed Graph"))
            else:
                ax.plot(x_vals, y_vals, 
                       color=color, 
                       marker=marker,
                       linestyle=linestyle,
                       label=data.get("name", "Unnamed Graph"))
        if self.graph_data:
            first_data = self.graph_data[0]
            
            # Set labels with font properties
            ax.set_xlabel(first_data.get("x_label", "X Axis"), fontdict=axis_font)
            ax.set_ylabel(first_data.get("y_label", "Y Axis"), fontdict=axis_font)
            
            # Set tick labels with the same font properties
            for label in ax.get_xticklabels():
                label.set_fontproperties(axis_font)
            for label in ax.get_yticklabels():
                label.set_fontproperties(axis_font)
            
            ax.set_xlim(first_data.get("x_min", 0), first_data.get("x_max", 10))
            ax.set_ylim(first_data.get("y_min", 0), first_data.get("y_max", 10))
            
            # Set title if available
            if "name" in first_data:
                ax.set_title(first_data["name"], fontdict=title_font, pad=20)
        
        ax.grid(True)
        
        # Add legend with consistent font
        if self.graph_data:
            axis_font = self.graph_data[0].get("axis_font", {'family': 'sans-serif', 'size': 11})
            ax.legend(loc='upper right', 
                     prop={'family': axis_font['family'], 
                           'size': axis_font['size']})
        
        self.canvas.draw()
    
    def export_combined_pdf(self):
        if not self.graph_data:
            QMessageBox.warning(self, "Warning", "No graphs to export.")
            return
            
        options = QFileDialog.Options()
        file_name, _ = QFileDialog.getSaveFileName(
            self, "Save Combined PDF", "", 
            "PDF Files (*.pdf)", 
            options=options
        )
        
        if file_name:
            if not file_name.endswith('.pdf'):
                file_name += '.pdf'
                
            fig = Figure(figsize=(8, 6))
            ax = fig.add_subplot(111)
            
            for data in self.graph_data:
                if not data.get("points"):
                    continue
                    
                x_vals = [p[0] for p in data["points"]]
                y_vals = [p[1] for p in data["points"]]
                
                # Get styling from data or use defaults
                color = data.get("line_color", data.get("color", "#1f77b4"))
                marker = data.get("marker_style", "o")
                linestyle = '-'  # Default line style
                
                # Get font properties or use defaults
                axis_font = data.get("axis_font", {'family': 'sans-serif', 'size': 11})
                title_font = data.get("title_font", {'family': 'sans-serif', 'size': 12, 'weight': 'bold'})
                
                # Plot with the specified style
                if marker.lower() == "none":
                    ax.plot(x_vals, y_vals, 
                           color=color, 
                           linestyle=linestyle,
                           label=data.get("name", "Unnamed Graph"))
                else:
                    ax.plot(x_vals, y_vals, 
                           color=color, 
                           marker=marker,
                           linestyle=linestyle,
                           label=data.get("name", "Unnamed Graph"))
            
            if self.graph_data:
                first_data = self.graph_data[0]
                
                # Set labels with font properties
                ax.set_xlabel(first_data.get("x_label", "X Axis"), fontdict=axis_font)
                ax.set_ylabel(first_data.get("y_label", "Y Axis"), fontdict=axis_font)
                
                # Set tick labels with the same font properties
                for label in ax.get_xticklabels():
                    label.set_fontproperties(axis_font)
                for label in ax.get_yticklabels():
                    label.set_fontproperties(axis_font)
                
                ax.set_xlim(first_data.get("x_min", 0), first_data.get("x_max", 10))
                ax.set_ylim(first_data.get("y_min", 0), first_data.get("y_max", 10))
                
                # Set title if available
                #if "name" in first_data:
                #    ax.set_title(first_data["name"], fontdict=title_font, pad=20)
            
            ax.grid(True)
            
            # Add legend with consistent font
            if self.graph_data:
                axis_font = self.graph_data[0].get("axis_font", {'family': 'sans-serif', 'size': 11})
                ax.legend(loc='lower right', 
                         bbox_to_anchor=(1, 0),
                         framealpha=1,
                         edgecolor='black',
                         prop={'family': axis_font['family'], 
                               'size': axis_font['size']})
            
            # Adjust layout to prevent clipping
            fig.tight_layout()
            
            fig.savefig(file_name, bbox_inches='tight')
            QMessageBox.information(self, "Success", f"Combined graph exported to {file_name}")