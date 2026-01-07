#!/usr/bin/env python
"""
Feature Class Comparison Script - Compares schema, attributes, or spatial properties.
Usage: python comparison.py '<config_json>'
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

def compare_feature_classes(config):
    """Compare two feature classes."""
    source_fc = config.get("sourceFeatureClass", "")
    target_fc = config.get("targetFeatureClass", "")
    comparison_type = config.get("comparisonType", "schema")  # schema, attributes, spatial
    
    if not source_fc or not target_fc:
        log("error", "Source and target feature classes are required")
        return False
    
    log("info", f"Source: {source_fc}")
    log("info", f"Target: {target_fc}")
    log("info", f"Comparison type: {comparison_type}")
    
    try:
        import arcpy
        
        # Verify both feature classes exist
        if not arcpy.Exists(source_fc):
            log("error", f"Source feature class does not exist: {source_fc}")
            return False
        if not arcpy.Exists(target_fc):
            log("error", f"Target feature class does not exist: {target_fc}")
            return False
        
        differences = []
        
        if comparison_type in ["schema", "all"]:
            log("info", "Comparing schemas...")
            differences.extend(compare_schemas(source_fc, target_fc))
        
        if comparison_type in ["attributes", "all"]:
            log("info", "Comparing attribute counts...")
            differences.extend(compare_attributes(source_fc, target_fc))
        
        if comparison_type in ["spatial", "all"]:
            log("info", "Comparing spatial properties...")
            differences.extend(compare_spatial(source_fc, target_fc))
        
        # Report results
        if differences:
            log("warning", f"Found {len(differences)} differences:")
            for diff in differences:
                log("warning", f"  - {diff}")
        else:
            log("info", "✓ No differences found")
        
        return True
        
    except ImportError:
        log("warning", "ArcPy not available - running in simulation mode")
        
        # Simulate comparison
        log("info", "[SIMULATED] Comparing schemas...")
        import time
        time.sleep(0.3)
        log("info", "[SIMULATED] Comparing attributes...")
        time.sleep(0.3)
        log("info", "[SIMULATED] Comparing spatial properties...")
        time.sleep(0.3)
        
        # Simulated differences
        log("warning", "[SIMULATED] Found 2 differences:")
        log("warning", "  - Field 'OWNER_NAME' missing in target")
        log("warning", "  - Feature count mismatch: source=15420, target=15418")
        
        return True

def compare_schemas(source_fc, target_fc):
    """Compare field schemas between two feature classes."""
    import arcpy
    
    differences = []
    
    source_fields = {f.name: f for f in arcpy.ListFields(source_fc)}
    target_fields = {f.name: f for f in arcpy.ListFields(target_fc)}
    
    # Find missing fields
    for name in source_fields:
        if name not in target_fields:
            differences.append(f"Field '{name}' missing in target")
    
    for name in target_fields:
        if name not in source_fields:
            differences.append(f"Field '{name}' missing in source")
    
    # Compare common fields
    for name in source_fields:
        if name in target_fields:
            sf = source_fields[name]
            tf = target_fields[name]
            if sf.type != tf.type:
                differences.append(f"Field '{name}' type mismatch: {sf.type} vs {tf.type}")
            if sf.length != tf.length and sf.type == "String":
                differences.append(f"Field '{name}' length mismatch: {sf.length} vs {tf.length}")
    
    return differences

def compare_attributes(source_fc, target_fc):
    """Compare record counts."""
    import arcpy
    
    differences = []
    
    source_count = int(arcpy.GetCount_management(source_fc)[0])
    target_count = int(arcpy.GetCount_management(target_fc)[0])
    
    if source_count != target_count:
        differences.append(f"Feature count mismatch: source={source_count}, target={target_count}")
    
    return differences

def compare_spatial(source_fc, target_fc):
    """Compare spatial properties."""
    import arcpy
    
    differences = []
    
    source_desc = arcpy.Describe(source_fc)
    target_desc = arcpy.Describe(target_fc)
    
    if source_desc.shapeType != target_desc.shapeType:
        differences.append(f"Shape type mismatch: {source_desc.shapeType} vs {target_desc.shapeType}")
    
    source_sr = source_desc.spatialReference
    target_sr = target_desc.spatialReference
    
    if source_sr.name != target_sr.name:
        differences.append(f"Spatial reference mismatch: {source_sr.name} vs {target_sr.name}")
    
    return differences

if __name__ == "__main__":
    if len(sys.argv) < 2:
        log("error", "Config JSON required")
        sys.exit(1)
    
    try:
        config = json.loads(sys.argv[1])
        success = compare_feature_classes(config)
        sys.exit(0 if success else 1)
    except json.JSONDecodeError as e:
        log("error", f"Invalid JSON config: {str(e)}")
        sys.exit(1)
    except Exception as e:
        log("error", f"Unexpected error: {str(e)}")
        sys.exit(1)
