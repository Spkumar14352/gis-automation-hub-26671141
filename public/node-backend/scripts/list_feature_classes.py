#!/usr/bin/env python
"""
List feature classes in a geodatabase.
Usage: python list_feature_classes.py <gdb_path>
"""

import sys
import json

def list_feature_classes(gdb_path):
    """List all feature classes and tables in a geodatabase."""
    try:
        import arcpy
        arcpy.env.workspace = gdb_path
        
        feature_classes = []
        tables = []
        
        # List feature classes
        for fc in arcpy.ListFeatureClasses() or []:
            try:
                count = int(arcpy.GetCount_management(fc)[0])
                desc = arcpy.Describe(fc)
                feature_classes.append({
                    "name": fc,
                    "type": desc.shapeType,
                    "count": count
                })
            except:
                feature_classes.append({
                    "name": fc,
                    "type": "Unknown",
                    "count": 0
                })
        
        # List tables
        for table in arcpy.ListTables() or []:
            try:
                count = int(arcpy.GetCount_management(table)[0])
                tables.append({
                    "name": table,
                    "type": "Table",
                    "count": count
                })
            except:
                tables.append({
                    "name": table,
                    "type": "Table",
                    "count": 0
                })
        
        return {
            "featureClasses": feature_classes,
            "tables": tables,
            "arcpyAvailable": True
        }
    
    except ImportError:
        # ArcPy not available - return mock data for testing
        return {
            "featureClasses": [
                {"name": "Parcels", "type": "Polygon", "count": 15420},
                {"name": "Roads", "type": "Polyline", "count": 8350},
                {"name": "Buildings", "type": "Polygon", "count": 12800},
                {"name": "Hydrants", "type": "Point", "count": 2150}
            ],
            "tables": [
                {"name": "Owners", "type": "Table", "count": 14200},
                {"name": "Permits", "type": "Table", "count": 5600}
            ],
            "arcpyAvailable": False,
            "message": "ArcPy not available - showing sample data"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "GDB path required"}))
        sys.exit(1)
    
    result = list_feature_classes(sys.argv[1])
    print(json.dumps(result))
