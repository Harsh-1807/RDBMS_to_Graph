import os
import sys
import subprocess
import webbrowser
import time

def check_prerequisites():
    """Check if all prerequisites are installed"""
    print("Checking prerequisites...")
    
    # Check Python packages
    try:
        import sqlalchemy
        import neomodel
        import pandas
        print("✓ Python packages are installed")
    except ImportError as e:
        print(f"✗ Missing Python package: {e}")
        print("Please run: pip install -r requirements.txt")
        return False
    
    # Check Node.js
    try:
        node_version = subprocess.run(["node", "--version"], 
                                     stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE,
                                     text=True,
                                     check=True)
        print(f"✓ Node.js is installed ({node_version.stdout.strip()})")
    except (subprocess.SubprocessError, FileNotFoundError):
        print("✗ Node.js is not installed")
        print("Please install Node.js: https://nodejs.org/")
        return False
    
    return True

def run_migration():
    """Run the migration script"""
    print("\n=== Running Northwind Migration ===\n")
    try:
        subprocess.run([sys.executable, "migrate.py"], check=True)
        print("\n✓ Migration completed successfully")
        return True
    except subprocess.SubprocessError as e:
        print(f"\n✗ Migration failed: {e}")
        return False

def setup_web_app():
    """Setup the web application"""
    print("\n=== Setting up Web Application ===\n")
    os.chdir("web-app")
    
    # Check if node_modules exists, if not run npm install
    if not os.path.exists("node_modules"):
        print("Installing dependencies...")
        try:
            subprocess.run(["npm", "install"], check=True)
            print("✓ Dependencies installed")
        except subprocess.SubprocessError as e:
            print(f"✗ Failed to install dependencies: {e}")
            return False
    else:
        print("✓ Dependencies already installed")
    
    return True

def start_web_app():
    """Start the web application"""
    print("\n=== Starting Web Application ===\n")
    
    # Start npm in a new process
    process = subprocess.Popen(["npm", "run", "dev"], 
                              stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE,
                              text=True)
    
    # Wait for server to start
    print("Starting development server...")
    time.sleep(5)
    
    # Open browser
    print("Opening web browser...")
    webbrowser.open("http://localhost:3000")
    
    print("\n✓ Web application started")
    print("\nPress Ctrl+C to stop the server")
    
    try:
        # Keep the script running
        process.communicate()
    except KeyboardInterrupt:
        process.kill()
        print("\nWeb application stopped")

def main():
    """Main function to run the entire project"""
    print("=== Northwind SQL to Neo4j Aura Project ===\n")
    
    if not check_prerequisites():
        return
    
    # Ask user what to run
    print("\nWhat would you like to do?")
    print("1. Run migration only (PostgreSQL to Neo4j)")
    print("2. Run web application only")
    print("3. Run both migration and web application")
    print("4. Exit")
    
    choice = input("\nEnter your choice (1-4): ")
    
    if choice == "1":
        run_migration()
    elif choice == "2":
        if setup_web_app():
            start_web_app()
    elif choice == "3":
        if run_migration():
            if setup_web_app():
                start_web_app()
    else:
        print("Exiting...")

if __name__ == "__main__":
    main() 