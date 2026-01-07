# GIS Automation Hub - Node.js Backend

A hybrid Node.js + Python backend for GIS automation. Node.js handles the API server while Python scripts execute ArcPy operations.

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or with auto-reload
npm run dev
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | HTTP server port |
| `ARCPY_PYTHON_PATH` | python | Path to Python with ArcPy |

### ArcGIS Pro Python Path

For ArcPy operations, set the `ARCPY_PYTHON_PATH` environment variable:

**Windows (PowerShell):**
```powershell
$env:ARCPY_PYTHON_PATH = "C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe"
npm start
```

**Windows (Command Prompt):**
```cmd
set ARCPY_PYTHON_PATH=C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe
npm start
```

**Linux/macOS:**
```bash
export ARCPY_PYTHON_PATH=/path/to/arcgis/python
npm start
```

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

## Docker Configuration

The included `Dockerfile` and `docker-compose.yml` provide:
- Node.js 20 runtime
- Python 3 for script execution
- Health checks
- Volume mounts for data access

### Customizing Docker

Edit `docker-compose.yml` to mount your data directories:

```yaml
volumes:
  - /path/to/your/data:/data:ro
```

## Job Types

1. **gdb_extraction** - Extract feature classes from File GDB to shapefiles
2. **sde_conversion** - Migrate data between Enterprise Geodatabases
3. **comparison** - Compare feature class schemas/attributes/spatial properties

## Scripts

Python scripts in the `scripts/` directory:
- `list_feature_classes.py` - List GDB contents
- `gdb_extraction.py` - Extract feature classes to shapefiles
- `sde_conversion.py` - SDE to SDE migration
- `comparison.py` - Feature class comparison

Each script includes simulation mode when ArcPy is unavailable.

## Troubleshooting

### Connection Refused
- Ensure the server is running on the correct port
- Check firewall settings

### ArcPy Not Found
- Set `ARCPY_PYTHON_PATH` to your ArcGIS Pro Python executable
- Verify ArcGIS Pro is installed

### Permission Denied
- Run with appropriate file system permissions
- Check Docker volume mount permissions