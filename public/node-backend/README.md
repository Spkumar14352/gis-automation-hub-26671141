# GIS Automation Hub - Node.js Backend

A hybrid Node.js + Python backend for GIS automation. Node.js handles the API server while Python scripts execute ArcPy operations.

## Quick Start

### 1. Install Node.js Dependencies

```bash
cd public/node-backend
npm install
```

### 2. Configure Python Path (Optional)

If using ArcGIS Pro's Python environment, set the environment variable:

**Windows (PowerShell):**
```powershell
$env:ARCPY_PYTHON_PATH = "C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe"
```

**Windows (Command Prompt):**
```cmd
set ARCPY_PYTHON_PATH=C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe
```

If not set, the server uses the default `python` command.

### 3. Start the Server

```bash
npm start
```

Server runs at `http://localhost:5000`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| POST | `/browse` | Browse filesystem |
| POST | `/list-feature-classes` | List feature classes in a GDB |
| POST | `/execute` | Execute a GIS job |
| GET | `/jobs/:jobId` | Get job status |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Frontend  │────▶│  Node.js API    │────▶│  Python/ArcPy   │
│   (React App)   │◀────│  (Express)      │◀────│  Scripts        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Node.js**: Handles HTTP requests, file browsing, job management
- **Python Scripts**: Execute ArcPy operations (spawn on demand)

## Job Types

1. **gdb_extraction** - Extract feature classes from File GDB to shapefiles
2. **sde_conversion** - Migrate data between Enterprise Geodatabases
3. **comparison** - Compare feature class schemas/attributes/spatial properties

## Example Requests

### Browse Filesystem
```bash
curl -X POST http://localhost:5000/browse \
  -H "Content-Type: application/json" \
  -d '{"path": "C:\\Data", "type": "gdb"}'
```

### Execute Job
```bash
curl -X POST http://localhost:5000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "gdb_extraction",
    "config": {
      "sourcePath": "C:\\Data\\MyGDB.gdb",
      "outputFolder": "C:\\Output",
      "featureClasses": ["Parcels", "Roads"]
    }
  }'
```

## Simulation Mode

If ArcPy is not available, scripts run in simulation mode with mock data. This allows testing the full workflow without ArcGIS installed.
