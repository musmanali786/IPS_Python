#!/bin/bash

# IPS Python Project Build Script
# Usage: ./build.sh [option]
# Options: build, clean, rebuild, run, doctor, stop, help

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
GRAPH_DIGITIZER_DIR="$PROJECT_ROOT/graph_digitizer"
MOBILEAPP_DIR="$PROJECT_ROOT/mobileapp"  # Future: mobile app for scanning and testing

# Python environment
VENV_DIR="$PROJECT_ROOT/venv"
PYTHON_CMD="python3"

# PID files for running processes
BACKEND_PID_FILE="/tmp/ips_backend.pid"
FRONTEND_PID_FILE="/tmp/ips_frontend.pid"

# Helper functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if virtual environment exists
check_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        print_warning "Virtual environment not found at $VENV_DIR"
        print_info "Creating virtual environment..."
        $PYTHON_CMD -m venv "$VENV_DIR"
        print_success "Virtual environment created"
    fi
}

# Activate virtual environment
activate_venv() {
    source "$VENV_DIR/bin/activate"
    print_success "Virtual environment activated"
}

# Install Python dependencies
install_backend_deps() {
    print_info "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    pip install --upgrade pip setuptools wheel > /dev/null 2>&1
    pip install -r requirements.txt > /dev/null 2>&1
    print_success "Backend dependencies installed"
}

install_graph_digitizer_deps() {
    print_info "Installing graph digitizer dependencies..."
    cd "$GRAPH_DIGITIZER_DIR"
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt > /dev/null 2>&1
        print_success "Graph digitizer dependencies installed"
    else
        print_warning "No requirements.txt found for graph digitizer"
    fi
}

install_frontend_deps() {
    print_info "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    if command -v npm &> /dev/null; then
        npm install > /dev/null 2>&1
        print_success "Frontend dependencies installed"
    else
        print_error "npm is not installed. Please install Node.js and npm"
        return 1
    fi
}

# Build functions
build_backend() {
    print_header "Building Backend"
    check_venv
    activate_venv
    install_backend_deps
    install_graph_digitizer_deps
    print_success "Backend build completed"
}

build_frontend() {
    print_header "Building Frontend"
    install_frontend_deps
    cd "$FRONTEND_DIR"
    npm run build > /dev/null 2>&1
    print_success "Frontend build completed"
}

build_all() {
    print_header "Building All Components"
    build_backend
    build_frontend
    print_success "Full build completed"
}

# Clean functions
clean_backend() {
    print_info "Cleaning backend artifacts..."
    find "$BACKEND_DIR" -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
    find "$BACKEND_DIR" -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
    find "$BACKEND_DIR" -type d -name .egg-info -exec rm -rf {} + 2>/dev/null || true
    find "$BACKEND_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    print_success "Backend cleaned"
}

clean_frontend() {
    print_info "Cleaning frontend artifacts..."
    cd "$FRONTEND_DIR"
    rm -rf dist node_modules/.vite 2>/dev/null || true
    print_success "Frontend cleaned"
}

clean_venv() {
    print_info "Removing virtual environment..."
    rm -rf "$VENV_DIR" 2>/dev/null || true
    print_success "Virtual environment removed"
}

clean_all() {
    print_header "Cleaning All Artifacts"
    clean_backend
    clean_frontend
    print_success "Cleanup completed"
}

# Run functions
run_backend() {
    print_header "Starting Backend Server"
    check_venv
    activate_venv
    
    cd "$BACKEND_DIR"
    $PYTHON_CMD main.py &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$BACKEND_PID_FILE"
    
    print_success "Backend started (PID: $BACKEND_PID)"
    print_info "Backend running on http://localhost:8000"
}

run_frontend() {
    print_header "Starting Frontend Dev Server"
    cd "$FRONTEND_DIR"
    npm run dev &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$FRONTEND_PID_FILE"
    
    print_success "Frontend started (PID: $FRONTEND_PID)"
    print_info "Frontend available at http://localhost:5173"
}

run_all() {
    print_header "Starting All Services"
    run_backend
    sleep 2
    run_frontend
    print_success "All services started"
    print_info "Press Ctrl+C to stop all services"
}

# Stop functions
stop_backend() {
    if [ -f "$BACKEND_PID_FILE" ]; then
        PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            print_success "Backend stopped (PID: $PID)"
        else
            print_warning "Backend process not found"
        fi
        rm -f "$BACKEND_PID_FILE"
    else
        print_warning "Backend PID file not found"
    fi
}

stop_webapp() {
    if [ -f "$WEBAPP_PID_FILE" ]; then
        PID=$(cat "$WEBAPP_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            print_success "Webapp stopped (PID: $PID)"
        else
            print_warning "Webapp process not found"
        fi
        rm -f "$WEBAPP_PID_FILE"
    else
        print_warning "Webapp PID file not found"
    fi
}

stop_frontend() {
    if [ -f "$FRONTEND_PID_FILE" ]; then
        PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            print_success "Frontend stopped (PID: $PID)"
        else
            print_warning "Frontend process not found"
        fi
        rm -f "$FRONTEND_PID_FILE"
    else
        print_warning "Frontend PID file not found"
    fi
}

stop_all() {
    print_header "Stopping All Services"
    stop_backend
    stop_frontend
    print_success "All services stopped"
}

# Doctor function - check project health
doctor() {
    print_header "Project Health Check"
    
    local issues=0
    
    # Check Python
    if command -v $PYTHON_CMD &> /dev/null; then
        PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
        print_success "Python: $PYTHON_VERSION"
    else
        print_error "Python is not installed"
        ((issues++))
    fi
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js: $NODE_VERSION"
    else
        print_warning "Node.js is not installed (required for frontend)"
        ((issues++))
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm: $NPM_VERSION"
    else
        print_warning "npm is not installed (required for frontend)"
        ((issues++))
    fi
    
    # Check git
    if command -v git &> /dev/null; then
        print_success "Git is installed"
    else
        print_error "Git is not installed"
        ((issues++))
    fi
    
    # Check virtual environment
    if [ -d "$VENV_DIR" ]; then
        print_success "Virtual environment exists"
    else
        print_warning "Virtual environment not found"
    fi
    
    # Check backend files
    if [ -f "$BACKEND_DIR/requirements.txt" ]; then
        print_success "Backend requirements.txt found"
    else
        print_error "Backend requirements.txt not found"
        ((issues++))
    fi
    
    # Check frontend files
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        print_success "Frontend package.json found"
    else
        print_error "Frontend package.json not found"
        ((issues++))
    fi
    
    # Check project structure
    if [ -d "$BACKEND_DIR" ] && [ -d "$FRONTEND_DIR" ]; then
        print_success "Project structure is valid"
    else
        print_error "Missing project directories"
        ((issues++))
    fi
    
    echo ""
    if [ $issues -eq 0 ]; then
        print_success "All checks passed! Project is ready to build."
    else
        print_warning "Found $issues issue(s). Please address them before building."
    fi
}

# Rebuild function
rebuild() {
    print_header "Rebuilding Project"
    clean_all
    build_all
    print_success "Rebuild completed"
}

# Help function
show_help() {
    cat << EOF
${BLUE}IPS Python Project Build Script${NC}

${YELLOW}Usage:${NC}
    ./build.sh [option]

${YELLOW}Options:${NC}
    ${GREEN}build${NC}        Build backend and frontend (install dependencies)
    ${GREEN}clean${NC}        Clean build artifacts
    ${GREEN}rebuild${NC}      Clean and rebuild everything
    ${GREEN}run${NC}          Start all services (backend, frontend)
    ${GREEN}stop${NC}         Stop all running services
    ${GREEN}doctor${NC}       Check project health and dependencies
    ${GREEN}help${NC}         Show this help message
    
${YELLOW}Advanced Options:${NC}
    ${GREEN}build-backend${NC}     Build backend only
    ${GREEN}build-frontend${NC}    Build frontend only
    ${GREEN}run-backend${NC}       Start backend server only
    ${GREEN}run-frontend${NC}      Start frontend dev server only
    ${GREEN}stop-backend${NC}      Stop backend server
    ${GREEN}stop-frontend${NC}     Stop frontend server
    ${GREEN}clean-backend${NC}     Clean backend artifacts only
    ${GREEN}clean-frontend${NC}    Clean frontend artifacts only
    ${GREEN}clean-venv${NC}        Remove virtual environment

${YELLOW}Examples:${NC}
    ./build.sh build           # Install all dependencies
    ./build.sh rebuild         # Clean and rebuild
    ./build.sh run             # Start all services
    ./build.sh doctor          # Check project health
    ./build.sh stop            # Stop all services

${YELLOW}Note:${NC}
    Mobile app support coming soon for scanning and testing IPS

EOF
}

# Main script logic
main() {
    case "${1:-help}" in
        build)
            build_all
            ;;
        build-backend)
            build_backend
            ;;
        build-frontend)
            build_frontend
            ;;
        clean)
            clean_all
            ;;
        clean-backend)
            clean_backend
            ;;
        clean-frontend)
            clean_frontend
            ;;
        clean-venv)
            clean_venv
            ;;
        rebuild)
            rebuild
            ;;
        run)
            run_all
            ;;
        run-backend)
            run_backend
            ;;
        run-frontend)
            run_frontend
            ;;
        stop)
            stop_all
            ;;
        stop-backend)
            stop_backend
            ;;
        stop-frontend)
            stop_frontend
            ;;
        doctor)
            doctor
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
