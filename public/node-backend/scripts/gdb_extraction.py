#!/usr/bin/env python
"""
GDB Extraction Script - Extracts feature classes from a File Geodatabase.
Usage: python gdb_extraction.py '<config_json>'
"""

import sys
import json
import os
from datetime import datetime

def log(log_type, message):
    """Output a log entry as JSON."""
    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": log_type,
        "message": message
    }
    print(json.dumps(entry))
    sys.stdout.flush()

def extract_feature_classes(config):
    """Extract feature classes from GDB to shapefiles."""
    source_path = config.get("sourcePath", "")
    output_folder = config.get("outputFolder", "")
    feature_classes = config.get("featureClasses", [])
    
    if not source_path or not output_folder:
        log("error", "Source path and output folder are required")
        return False
    
    log("info", f"Starting extraction from: {source_path}")
    log("info", f"Output folder: {output_folder}")
    log("info", f"Feature classes to extract: {len(feature_classes)}")
    
    try:
        import arcpy
        
        # Create output folder if it doesn't exist
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            log("info", f"Created output folder: {output_folder}")
        
        arcpy.env.workspace = source_path
        arcpy.env.overwriteOutput = True
        
        # If no feature classes specified, extract all
        if not feature_classes:
            feature_classes = arcpy.ListFeatureClasses() or []
            log("info", f"No feature classes specified, extracting all {len(feature_classes)} found")
        
        extracted = 0
        for fc in feature_classes:
            try:
                log("info", f"Extracting: {fc}")
                output_path = os.path.join(output_folder, f"{fc}.shp")
                arcpy.conversion.FeatureClassToShapefile(fc, output_folder)
                
                # Get feature count
                count = int(arcpy.GetCount_management(fc)[0])
                log("info", f"✓ Extracted {fc} ({count} features)")
                extracted += 1
            except Exception as e:
                log("error", f"Failed to extract {fc}: {str(e)}")
        
        log("info", f"Extraction complete: {extracted}/{len(feature_classes)} feature classes")
        return True
        
    except ImportError:
        log("warning", "ArcPy not available - running in simulation mode")
        
        # Simulate extraction
        for i, fc in enumerate(feature_classes or ["Parcels", "Roads", "Buildings"]):
            log("info", f"[SIMULATED] Extracting: {fc}")
            import time
            time.sleep(0.5)
            log("info", f"✓ [SIMULATED] Extracted {fc}")
        
        log("info", "[SIMULATED] Extraction complete")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        log("error", "Config JSON required")
        sys.exit(1)
    
    try:
        config = json.loads(sys.argv[1])
        success = extract_feature_classes(config)
        sys.exit(0 if success else 1)
    except json.JSONDecodeError as e:
        log("error", f"Invalid JSON config: {str(e)}")
        sys.exit(1)
    except Exception as e:
        log("error", f"Unexpected error: {str(e)}")
        sys.exit(1)
