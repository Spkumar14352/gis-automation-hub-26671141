"""
GIS Automation Hub - Python Backend Server

This FastAPI server provides the backend for the GIS Automation Hub web application.
It handles file browsing, script execution, and authentication for ArcPy-based GIS workflows.

Requirements:
- Python 3.9+
- FastAPI
- uvicorn
- arcpy (requires ArcGIS Pro license)
- PyJWT
- bcrypt
- SQLAlchemy

Install dependencies:
    pip install fastapi uvicorn python-multipart requests PyJWT bcrypt sqlalchemy

Run the server:
    uvicorn gis_backend:app --host 0.0.0.0 --port 8000 --reload

Configure the web app:
    Set PYTHON_BACKEND_URL to http://your-server:8000 in the Settings page
"""

import os
import glob
import json
import asyncio
import logging
import secrets
import hashlib
from pathlib import Path
from typing import Optional, List, Literal
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr

# JWT and Auth
import jwt
import bcrypt
from sqlalchemy import create_engine, Column, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Thread pool for running ArcPy operations (ArcPy is not async-compatible)
executor = ThreadPoolExecutor(max_workers=4)

# ============================================================================
# Database Configuration
# ============================================================================

# SQLite for local development - change to your SQL database connection string
# Examples:
#   SQLite: sqlite:///./gis_users.db
#   PostgreSQL: postgresql://user:password@localhost/dbname
#   MySQL: mysql+pymysql://user:password@localhost/dbname
#   SQL Server: mssql+pyodbc://user:password@server/database?driver=ODBC+Driver+17+for+SQL+Server
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./gis_users.db")

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ============================================================================
# User Model
# ============================================================================

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

# Create tables
Base.metadata.create_all(bind=engine)

# Security
security = HTTPBearer(auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = verify_token(credentials.credentials)
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User is deactivated")
    return user

app = FastAPI(
    title="GIS Automation Hub Backend",
    description="Python backend for GIS automation scripts with ArcPy",
    version="1.0.0"
)

# CORS configuration - adjust origins for your deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class BrowseRequest(BaseModel):
    path: str = ""
    type: Literal["gdb", "sde", "folder", "all"] = "all"


class FileItem(BaseModel):
    name: str
    path: str
    type: Literal["gdb", "sde", "folder", "file"]
    size: Optional[int] = None
    modified: Optional[str] = None


class BrowseResponse(BaseModel):
    current_path: str
    parent_path: Optional[str]
    items: List[FileItem]
    drives: Optional[List[str]] = None


class ExecuteRequest(BaseModel):
    jobId: str
    jobType: Literal["gdb_extraction", "sde_conversion", "comparison"]
    config: dict
    callbackUrl: str


class LogEntry(BaseModel):
    timestamp: str
    type: Literal["info", "success", "warning", "error"]
    message: str


# ============================================================================
# File Browser Endpoint
# ============================================================================

def get_available_drives() -> List[str]:
    """Get list of available drives on Windows"""
    drives = []
    if os.name == 'nt':  # Windows
        import string
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                drives.append(drive)
    else:  # Unix/Linux
        drives = ["/"]
    return drives


def is_geodatabase(path: str) -> bool:
    """Check if path is a file geodatabase"""
    return path.lower().endswith('.gdb') and os.path.isdir(path)


def is_sde_connection(path: str) -> bool:
    """Check if path is an SDE connection file"""
    return path.lower().endswith('.sde') and os.path.isfile(path)


@app.post("/browse", response_model=BrowseResponse)
async def browse_filesystem(request: BrowseRequest):
    """
    Browse the server filesystem for GDBs, SDEs, and folders.
    
    - If path is empty, returns available drives (Windows) or root (Unix)
    - Returns folders, GDBs, and SDE connection files based on type filter
    """
    path = request.path.strip()
    filter_type = request.type
    
    # If no path, return drives/root
    if not path:
        drives = get_available_drives()
        return BrowseResponse(
            current_path="",
            parent_path=None,
            items=[FileItem(name=d, path=d, type="folder") for d in drives],
            drives=drives
        )
    
    # Normalize path
    path = os.path.normpath(path)
    
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Path not found: {path}")
    
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail="Path must be a directory")
    
    items: List[FileItem] = []
    
    try:
        for entry in os.scandir(path):
            try:
                item_path = entry.path
                item_name = entry.name
                
                # Determine item type
                if is_geodatabase(item_path):
                    item_type = "gdb"
                elif is_sde_connection(item_path):
                    item_type = "sde"
                elif entry.is_dir():
                    item_type = "folder"
                else:
                    item_type = "file"
                    # Skip non-relevant files unless showing all
                    if filter_type != "all":
                        continue
                
                # Apply type filter
                if filter_type != "all" and item_type not in [filter_type, "folder"]:
                    continue
                
                # Get file stats
                try:
                    stat = entry.stat()
                    size = stat.st_size if not entry.is_dir() else None
                    modified = datetime.fromtimestamp(stat.st_mtime).isoformat()
                except:
                    size = None
                    modified = None
                
                items.append(FileItem(
                    name=item_name,
                    path=item_path,
                    type=item_type,
                    size=size,
                    modified=modified
                ))
                
            except PermissionError:
                continue
            except Exception as e:
                logger.warning(f"Error reading {entry.path}: {e}")
                continue
        
        # Sort: folders first, then by name
        items.sort(key=lambda x: (0 if x.type == "folder" else 1, x.name.lower()))
        
        # Get parent path
        parent = os.path.dirname(path)
        parent_path = parent if parent != path else None
        
        return BrowseResponse(
            current_path=path,
            parent_path=parent_path,
            items=items,
            drives=get_available_drives()
        )
        
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
    except Exception as e:
        logger.error(f"Browse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Script Execution Endpoint
# ============================================================================

async def send_callback(callback_url: str, job_id: str, status: str, 
                        logs: List[dict] = None, result: dict = None):
    """Send status update to the callback URL"""
    import requests
    
    payload = {
        "jobId": job_id,
        "status": status,
    }
    if logs:
        payload["logs"] = logs
    if result:
        payload["result"] = result
    
    try:
        response = requests.post(callback_url, json=payload, timeout=30)
        response.raise_for_status()
        logger.info(f"Callback sent for job {job_id}: {status}")
    except Exception as e:
        logger.error(f"Failed to send callback for job {job_id}: {e}")


def create_log(msg_type: str, message: str) -> dict:
    """Create a log entry"""
    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": msg_type,
        "message": message
    }


# ============================================================================
# GDB Extraction
# ============================================================================

def run_gdb_extraction(job_id: str, config: dict, callback_url: str):
    """
    Extract feature classes from a File Geodatabase to shapefiles.
    
    Config:
        - sourceGdbPath: Path to source .gdb
        - outputFolder: Path to output folder
    """
    import requests
    
    source_gdb = config.get("sourceGdbPath", "")
    output_folder = config.get("outputFolder", "")
    
    logs = [create_log("info", "Starting GDB extraction...")]
    
    try:
        # Import arcpy (requires ArcGIS Pro license)
        import arcpy
        
        logs.append(create_log("info", f"Source GDB: {source_gdb}"))
        logs.append(create_log("info", f"Output folder: {output_folder}"))
        
        # Validate paths
        if not os.path.exists(source_gdb):
            raise FileNotFoundError(f"Source GDB not found: {source_gdb}")
        
        os.makedirs(output_folder, exist_ok=True)
        
        # Set workspace
        arcpy.env.workspace = source_gdb
        
        # Get feature classes
        feature_classes = arcpy.ListFeatureClasses()
        logs.append(create_log("info", f"Found {len(feature_classes)} feature classes"))
        
        # Send running status
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "running",
            "logs": logs
        }, timeout=30)
        
        results = []
        
        for fc in feature_classes:
            try:
                logs.append(create_log("info", f"Extracting: {fc}"))
                
                # Count features
                count = int(arcpy.GetCount_management(fc)[0])
                
                # Export to shapefile
                output_path = os.path.join(output_folder, f"{fc}.shp")
                arcpy.conversion.FeatureClassToShapefile(fc, output_folder)
                
                logs.append(create_log("success", f"{fc}: {count} features extracted"))
                
                results.append({
                    "name": f"{fc}.shp",
                    "type": arcpy.Describe(fc).shapeType,
                    "features": count,
                    "size": os.path.getsize(output_path) if os.path.exists(output_path) else 0
                })
                
            except Exception as e:
                logs.append(create_log("error", f"Failed to extract {fc}: {str(e)}"))
        
        logs.append(create_log("success", f"Extraction complete! {len(results)} files created."))
        
        # Send success callback
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "success",
            "logs": logs,
            "result": {"files": results}
        }, timeout=30)
        
    except ImportError:
        logs.append(create_log("error", "ArcPy not available. Install ArcGIS Pro."))
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "failed",
            "logs": logs
        }, timeout=30)
        
    except Exception as e:
        logs.append(create_log("error", f"Extraction failed: {str(e)}"))
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "failed",
            "logs": logs
        }, timeout=30)


# ============================================================================
# SDE to SDE Conversion
# ============================================================================

def run_sde_conversion(job_id: str, config: dict, callback_url: str):
    """
    Migrate feature classes between Enterprise Geodatabases.
    
    Config:
        - sourceConnection: Source SDE connection string/path
        - targetConnection: Target SDE connection string/path
        - selectedFeatureClasses: List of feature class IDs to migrate
    """
    import requests
    
    source_conn = config.get("sourceConnection", "")
    target_conn = config.get("targetConnection", "")
    selected_fcs = config.get("selectedFeatureClasses", [])
    
    logs = [create_log("info", "Starting SDE to SDE migration...")]
    
    try:
        import arcpy
        
        logs.append(create_log("info", f"Source: {source_conn}"))
        logs.append(create_log("info", f"Target: {target_conn}"))
        logs.append(create_log("info", f"Selected feature classes: {len(selected_fcs)}"))
        
        # Send running status
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "running",
            "logs": logs
        }, timeout=30)
        
        arcpy.env.workspace = source_conn
        feature_classes = arcpy.ListFeatureClasses()
        
        results = []
        
        for fc in feature_classes:
            fc_id = fc.lower().replace(" ", "_")
            if selected_fcs and fc_id not in selected_fcs:
                continue
                
            try:
                logs.append(create_log("info", f"Migrating: {fc}"))
                
                source_count = int(arcpy.GetCount_management(fc)[0])
                
                # Copy to target
                target_fc = os.path.join(target_conn, fc)
                arcpy.conversion.FeatureClassToFeatureClass(
                    fc, target_conn, fc
                )
                
                target_count = int(arcpy.GetCount_management(target_fc)[0])
                
                status = "success" if source_count == target_count else "warning"
                logs.append(create_log(status, f"{fc}: {source_count} → {target_count} rows"))
                
                results.append({
                    "name": fc,
                    "sourceCount": source_count,
                    "targetCount": target_count,
                    "status": status
                })
                
            except Exception as e:
                logs.append(create_log("error", f"Failed to migrate {fc}: {str(e)}"))
                results.append({
                    "name": fc,
                    "sourceCount": 0,
                    "targetCount": 0,
                    "status": "error"
                })
        
        logs.append(create_log("success", f"Migration complete! {len(results)} feature classes processed."))
        
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "success",
            "logs": logs,
            "result": {"migrations": results}
        }, timeout=30)
        
    except ImportError:
        logs.append(create_log("error", "ArcPy not available. Install ArcGIS Pro."))
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "failed",
            "logs": logs
        }, timeout=30)
        
    except Exception as e:
        logs.append(create_log("error", f"Migration failed: {str(e)}"))
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "failed",
            "logs": logs
        }, timeout=30)


# ============================================================================
# Feature Class Comparison
# ============================================================================

def run_comparison(job_id: str, config: dict, callback_url: str):
    """
    Compare schema, attributes, or spatial properties between datasets.
    
    Config:
        - sourceConnection: Source feature class path
        - targetConnection: Target feature class path
        - comparisonType: 'schema', 'attribute', or 'spatial'
    """
    import requests
    
    source = config.get("sourceConnection", "")
    target = config.get("targetConnection", "")
    comparison_type = config.get("comparisonType", "schema")
    
    logs = [create_log("info", f"Starting {comparison_type} comparison...")]
    
    try:
        import arcpy
        
        logs.append(create_log("info", f"Source: {source}"))
        logs.append(create_log("info", f"Target: {target}"))
        
        # Send running status
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "running",
            "logs": logs
        }, timeout=30)
        
        # Get feature counts
        source_count = int(arcpy.GetCount_management(source)[0])
        target_count = int(arcpy.GetCount_management(target)[0])
        
        logs.append(create_log("success", f"Source: {source_count} features"))
        logs.append(create_log("success", f"Target: {target_count} features"))
        
        if source_count != target_count:
            diff = target_count - source_count
            sign = "+" if diff > 0 else ""
            logs.append(create_log("warning", f"Feature count mismatch ({sign}{diff})"))
        
        results = []
        
        if comparison_type == "schema":
            # Compare field definitions
            source_fields = {f.name: f for f in arcpy.ListFields(source)}
            target_fields = {f.name: f for f in arcpy.ListFields(target)}
            
            all_fields = set(source_fields.keys()) | set(target_fields.keys())
            
            for field_name in all_fields:
                src_field = source_fields.get(field_name)
                tgt_field = target_fields.get(field_name)
                
                if src_field and tgt_field:
                    src_type = f"{src_field.type}({src_field.length})" if src_field.length else src_field.type
                    tgt_type = f"{tgt_field.type}({tgt_field.length})" if tgt_field.length else tgt_field.type
                    
                    match = src_type == tgt_type
                    diff = None if match else "Type differs"
                    
                    results.append({
                        "field": field_name,
                        "sourceValue": src_type,
                        "targetValue": tgt_type,
                        "match": match,
                        "difference": diff
                    })
                elif src_field:
                    results.append({
                        "field": field_name,
                        "sourceValue": src_field.type,
                        "targetValue": "N/A",
                        "match": False,
                        "difference": "Missing in target"
                    })
                else:
                    results.append({
                        "field": field_name,
                        "sourceValue": "N/A",
                        "targetValue": tgt_field.type,
                        "match": False,
                        "difference": "Missing in source"
                    })
            
            match_count = sum(1 for r in results if r["match"])
            logs.append(create_log("success", f"Schema: {match_count}/{len(results)} fields match"))
        
        logs.append(create_log("success", "Comparison complete!"))
        
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "success",
            "logs": logs,
            "result": {"comparisons": results}
        }, timeout=30)
        
    except ImportError:
        logs.append(create_log("error", "ArcPy not available. Install ArcGIS Pro."))
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "failed",
            "logs": logs
        }, timeout=30)
        
    except Exception as e:
        logs.append(create_log("error", f"Comparison failed: {str(e)}"))
        requests.post(callback_url, json={
            "jobId": job_id,
            "status": "failed",
            "logs": logs
        }, timeout=30)


@app.post("/execute")
async def execute_script(request: ExecuteRequest, background_tasks: BackgroundTasks):
    """
    Execute a GIS automation script.
    
    The script runs in the background and sends status updates via callback.
    """
    job_id = request.jobId
    job_type = request.jobType
    config = request.config
    callback_url = request.callbackUrl
    
    logger.info(f"Received job {job_id} of type {job_type}")
    
    # Map job types to functions
    job_handlers = {
        "gdb_extraction": run_gdb_extraction,
        "sde_conversion": run_sde_conversion,
        "comparison": run_comparison,
    }
    
    handler = job_handlers.get(job_type)
    if not handler:
        raise HTTPException(status_code=400, detail=f"Unknown job type: {job_type}")
    
    # Run in background thread (ArcPy is blocking)
    def run_job():
        handler(job_id, config, callback_url)
    
    background_tasks.add_task(lambda: executor.submit(run_job))
    
    return {"status": "accepted", "jobId": job_id}


# ============================================================================
# Authentication Endpoints
# ============================================================================

class SignUpRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class SignInRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    user: dict
    token: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    created_at: str

@app.post("/auth/signup", response_model=AuthResponse)
async def signup(request: SignUpRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate email format
    if "@" not in request.email or "." not in request.email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Validate password length
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Create user
    user_id = secrets.token_hex(16)
    user = User(
        id=user_id,
        email=request.email,
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        created_at=datetime.utcnow()
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_token(user.id, user.email)
    
    return AuthResponse(
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "created_at": user.created_at.isoformat()
        },
        token=token
    )

@app.post("/auth/signin", response_model=AuthResponse)
async def signin(request: SignInRequest, db: Session = Depends(get_db)):
    """Sign in an existing user"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    token = create_token(user.id, user.email)
    
    return AuthResponse(
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "created_at": user.created_at.isoformat()
        },
        token=token
    )

@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        created_at=current_user.created_at.isoformat()
    )

@app.post("/auth/signout")
async def signout():
    """Sign out (client-side token removal)"""
    return {"message": "Signed out successfully"}


# ============================================================================
# Feature Class Listing Endpoint
# ============================================================================

class FeatureClassItem(BaseModel):
    name: str
    type: str  # Point, Polyline, Polygon, etc.
    feature_count: int
    spatial_reference: Optional[str] = None

class FeatureClassListResponse(BaseModel):
    gdb_path: str
    feature_classes: List[FeatureClassItem]
    tables: List[str]

@app.post("/list-feature-classes", response_model=FeatureClassListResponse)
async def list_feature_classes(path: str):
    """
    List all feature classes and tables in a geodatabase.
    """
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")
    
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Path not found: {path}")
    
    if not is_geodatabase(path):
        raise HTTPException(status_code=400, detail="Path must be a geodatabase (.gdb)")
    
    try:
        import arcpy
        
        arcpy.env.workspace = path
        
        feature_classes = []
        for fc in arcpy.ListFeatureClasses() or []:
            try:
                desc = arcpy.Describe(fc)
                count = int(arcpy.GetCount_management(fc)[0])
                sr = desc.spatialReference.name if desc.spatialReference else "Unknown"
                
                feature_classes.append(FeatureClassItem(
                    name=fc,
                    type=desc.shapeType,
                    feature_count=count,
                    spatial_reference=sr
                ))
            except Exception as e:
                logger.warning(f"Error reading feature class {fc}: {e}")
        
        tables = arcpy.ListTables() or []
        
        return FeatureClassListResponse(
            gdb_path=path,
            feature_classes=feature_classes,
            tables=list(tables)
        )
        
    except ImportError:
        # Mock data for testing without ArcPy
        logger.warning("ArcPy not available, returning mock data")
        return FeatureClassListResponse(
            gdb_path=path,
            feature_classes=[
                FeatureClassItem(name="Parcels", type="Polygon", feature_count=12456, spatial_reference="WGS 1984"),
                FeatureClassItem(name="Roads", type="Polyline", feature_count=8234, spatial_reference="WGS 1984"),
                FeatureClassItem(name="Buildings", type="Polygon", feature_count=15678, spatial_reference="WGS 1984"),
                FeatureClassItem(name="Utilities", type="Polyline", feature_count=4521, spatial_reference="WGS 1984"),
                FeatureClassItem(name="Zoning", type="Polygon", feature_count=2345, spatial_reference="WGS 1984"),
            ],
            tables=["LandUse", "Metadata", "AttributeLookup"]
        )
    except Exception as e:
        logger.error(f"Error listing feature classes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    arcpy_available = False
    try:
        import arcpy
        arcpy_available = True
    except ImportError:
        pass
    
    return {
        "status": "healthy",
        "arcpy_available": arcpy_available,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "GIS Automation Hub Backend",
        "version": "1.0.0",
        "endpoints": {
            "/browse": "Browse server filesystem for GDBs/SDEs",
            "/execute": "Execute GIS automation scripts",
            "/health": "Health check",
            "/auth/signup": "Register new user",
            "/auth/signin": "Sign in user",
            "/auth/me": "Get current user",
            "/list-feature-classes": "List feature classes in a GDB"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
