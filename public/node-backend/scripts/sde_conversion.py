#!/usr/bin/env python
"""
SDE Conversion Script - Migrates feature classes between Enterprise Geodatabases.
Usage: python sde_conversion.py '<config_json>'
"""

import sys
import json
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

def convert_sde(config):
    """Convert feature classes from source SDE to target SDE."""
    source_connection = config.get("sourceConnection", "")
    target_connection = config.get("targetConnection", "")
    feature_classes = config.get("featureClasses", [])
    truncate_first = config.get("truncateFirst", False)
    
    if not source_connection or not target_connection:
        log("error", "Source and target connections are required")
        return False
    
    log("info", f"Source SDE: {source_connection}")
    log("info", f"Target SDE: {target_connection}")
    log("info", f"Truncate before load: {truncate_first}")
    log("info", f"Feature classes to convert: {len(feature_classes)}")
    
    try:
        import arcpy
        
        arcpy.env.overwriteOutput = True
        
        converted = 0
        for fc in feature_classes:
            try:
                source_fc = f"{source_connection}\\{fc}"
                target_fc = f"{target_connection}\\{fc}"
                
                log("info", f"Processing: {fc}")
                
                # Truncate target if requested
                if truncate_first:
                    try:
                        arcpy.management.TruncateTable(target_fc)
                        log("info", f"  Truncated target: {fc}")
                    except:
                        log("warning", f"  Could not truncate {fc} (may not exist)")
                
                # Check if target exists
                if not arcpy.Exists(target_fc):
                    # Copy schema and data
                    arcpy.conversion.FeatureClassToFeatureClass(
                        source_fc,
                        target_connection,
                        fc
                    )
                    log("info", f"  Created and populated: {fc}")
                else:
                    # Append data
                    arcpy.management.Append(source_fc, target_fc, "NO_TEST")
                    log("info", f"  Appended to: {fc}")
                
                count = int(arcpy.GetCount_management(target_fc)[0])
                log("info", f"✓ Completed {fc} ({count} features)")
                converted += 1
                
            except Exception as e:
                log("error", f"Failed to convert {fc}: {str(e)}")
        
        log("info", f"Conversion complete: {converted}/{len(feature_classes)} feature classes")
        return True
        
    except ImportError:
        log("warning", "ArcPy not available - running in simulation mode")
        
        # Simulate conversion
        for fc in feature_classes or ["Parcels", "Roads", "Utilities"]:
            log("info", f"[SIMULATED] Processing: {fc}")
            import time
            time.sleep(0.5)
            if truncate_first:
                log("info", f"  [SIMULATED] Truncated target: {fc}")
            log("info", f"✓ [SIMULATED] Completed {fc}")
        
        log("info", "[SIMULATED] Conversion complete")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        log("error", "Config JSON required")
        sys.exit(1)
    
    try:
        config = json.loads(sys.argv[1])
        success = convert_sde(config)
        sys.exit(0 if success else 1)
    except json.JSONDecodeError as e:
        log("error", f"Invalid JSON config: {str(e)}")
        sys.exit(1)
    except Exception as e:
        log("error", f"Unexpected error: {str(e)}")
        sys.exit(1)
