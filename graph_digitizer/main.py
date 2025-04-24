import sys
from PyQt5.QtWidgets import (QApplication, QMainWindow, QTabWidget, QPushButton)
from digitizer_tab import GraphDigitizerTab
from preview_tab import PreviewTab

class GraphDigitizer(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Graph Digitizer")
        self.setGeometry(100, 100, 1200, 800)
        self.init_ui()
        
    def init_ui(self):
        self.tabs = QTabWidget()
        self.setCentralWidget(self.tabs)
        
        # Add first digitizer tab
        self.add_digitizer_tab()
        
        # Add preview tab
        self.preview_tab = PreviewTab(self)
        self.tabs.addTab(self.preview_tab, "Preview")
        
        # Add button to add new tabs
        self.add_tab_btn = QPushButton("+ Add New Tab")
        self.add_tab_btn.clicked.connect(self.add_digitizer_tab)
        self.tabs.setCornerWidget(self.add_tab_btn)
    
    def add_digitizer_tab(self):
        tab = GraphDigitizerTab(self)
        tab_index = self.tabs.addTab(tab, f"Graph {self.tabs.count()}")
        self.tabs.setCurrentIndex(tab_index)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = GraphDigitizer()
    window.show()
    sys.exit(app.exec_())