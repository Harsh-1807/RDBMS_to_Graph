import os
import sqlalchemy
from sqlalchemy import MetaData, create_engine, inspect, Table, Column
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.orm import Session
from neomodel import config, StructuredNode, StringProperty, IntegerProperty, FloatProperty, DateProperty, RelationshipTo, RelationshipFrom, StructuredRel, db
import pandas as pd
from datetime import datetime
import re
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database connection strings
POSTGRES_URLP = 'postgresql://postgres:123456788@localhost:5432/northwind'
NEO4J_URL = 'neo4j+s://neo4j:u_K1KGM8AUAZnFYf_FpAnG3W5XYe9BUkLUvgebn4Dug@3e3d0346.databases.neo4j.io'

# Configure Neo4j connection
config.DATABASE_URL = NEO4J_URL

# Connect to PostgreSQL and inspect schema
engine = create_engine(POSTGRES_URL)
metadata = MetaData()
metadata.reflect(engine)
inspector = inspect(engine)

logger.info(f"Discovered {len(metadata.tables)} tables in PostgreSQL Northwind database")

# Dictionary to store dynamically created Neo4j node classes
node_classes = {}

# Dictionary to store relationships between tables
relationships = {}

# Dictionary to track original column names to sanitized ones
column_name_mapping = {}

# List of Neo4j reserved keywords and internal names
NEO4J_RESERVED_NAMES = {'id', 'labels', 'properties', 'type', 'start', 'end'}

# Function to sanitize column names for Neo4j compatibility
def sanitize_column_name(table_name, column_name):
    """
    Sanitize column names to avoid conflicts with Neo4j internal names
    
    Args:
        table_name: Name of the table (used for tracking mappings)
        column_name: Original column name
        
    Returns:
        Sanitized column name
    """
    lower_name = column_name.lower()
    
    # Replace reserved names
    if lower_name in NEO4J_RESERVED_NAMES:
        sanitized_name = f"{lower_name}_prop"
        logger.info(f"Renamed column '{column_name}' to '{sanitized_name}' to avoid Neo4j naming conflict")
    else:
        sanitized_name = lower_name
    
    # Track the mapping for this table
    if table_name not in column_name_mapping:
        column_name_mapping[table_name] = {}
    
    column_name_mapping[table_name][column_name] = sanitized_name
    return sanitized_name

# Function to convert SQL table name to a proper class name
def table_to_class_name(table_name):
    # Convert snake_case to CamelCase and singularize (naive approach)
    parts = table_name.lower().split('_')
    class_name = ''.join(part.capitalize() for part in parts)
    # Naive singularize - just remove trailing 's' if it exists
    if class_name.endswith('s') and not class_name.endswith('ss'):
        class_name = class_name[:-1]
    return class_name

# Function to get appropriate Property type based on SQLAlchemy column type
def get_property_type(column, is_primary_key=False):
    """Get the appropriate neomodel property type based on SQLAlchemy column type
    
    Args:
        column: SQLAlchemy column
        is_primary_key: Whether this column is a primary key (for unique_index)
        
    Returns:
        neomodel property instance
    """
    if str(column.type).startswith(('INTEGER', 'BIGINT', 'SMALLINT')):
        return IntegerProperty(unique_index=is_primary_key)
    elif str(column.type).startswith(('DECIMAL', 'NUMERIC', 'FLOAT', 'REAL')):
        return FloatProperty(unique_index=is_primary_key)
    elif str(column.type).startswith(('DATE', 'TIMESTAMP')):
        return DateProperty(unique_index=is_primary_key)
    else:
        return StringProperty(unique_index=is_primary_key)

# Function to convert date string to datetime object or None
def convert_date(date_str):
    """Convert date string to datetime object or None"""
    if pd.isna(date_str):
        return None
    if isinstance(date_str, str):
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    return date_str.date() if hasattr(date_str, 'date') else date_str




# Dynamically create Neo4j node models based on PostgreSQL schema
def create_node_models():
    logger.info("Creating Neo4j node models for all tables...")
    
    try:
        # First pass: create basic node classes without relationships
        for table_name, table in metadata.tables.items():
            class_name = table_to_class_name(table_name)
            attrs = {
                '__name__': class_name,
            }
            
            # Add properties based on columns
            for column in table.columns:
                # Sanitize column name to avoid conflicts with Neo4j internals
                prop_name = sanitize_column_name(table_name, column.name)
                # Pass is_primary_key flag to get_property_type
                attrs[prop_name] = get_property_type(column, is_primary_key=column.primary_key)
            
            # Create the node class dynamically
            NodeClass = type(class_name, (StructuredNode,), attrs)
            node_classes[table_name] = NodeClass
            logger.info(f"Created node model for table: {table_name} -> {class_name}")
        
        # Second pass: add relationships based on foreign keys
        for table_name, table in metadata.tables.items():
            # Get foreign keys
            fks = inspector.get_foreign_keys(table_name)
            for fk in fks:
                source_table = table_name
                target_table = fk['referred_table']
                source_cols = fk['constrained_columns']
                target_cols = fk['referred_columns']
                
                if source_table in node_classes and target_table in node_classes:
                    # Create relationship name based on tables
                    rel_name = f"HAS_{target_table.upper()}"
                    
                    # Add outgoing relationship to source class
                    source_class = node_classes[source_table]
                    target_class = node_classes[target_table]
                    rel_attr = RelationshipTo(target_class.__name__, rel_name)
                    setattr(source_class, f"{target_table}_rel", rel_attr)
                    
                    # Add incoming relationship to target class
                    rev_rel_name = f"BELONGS_TO_{source_table.upper()}"
                    rev_rel_attr = RelationshipFrom(source_class.__name__, rev_rel_name)
                    setattr(target_class, f"{source_table}_rel", rev_rel_attr)
                    
                    # Store relationship info for later use during migration
                    if source_table not in relationships:
                        relationships[source_table] = []
                    
                    # Map the sanitized column names for relationships
                    sanitized_source_cols = [column_name_mapping[source_table].get(col, col.lower()) for col in source_cols]
                    sanitized_target_cols = [column_name_mapping[target_table].get(col, col.lower()) for col in target_cols]
                    
                    relationships[source_table].append({
                        'source_table': source_table,
                        'target_table': target_table,
                        'source_cols': source_cols,
                        'target_cols': target_cols,
                        'sanitized_source_cols': sanitized_source_cols,
                        'sanitized_target_cols': sanitized_target_cols,
                        'rel_name': rel_name
                    })
                    
                    logger.info(f"Added relationship: {source_table}.{source_cols} -> {target_table}.{target_cols}")
    except Exception as e:
        logger.error(f"Error creating node models: {str(e)}")
        raise

# Dynamically migrate a table from PostgreSQL to Neo4j
def migrate_table(table_name):
    logger.info(f"Migrating table: {table_name}...")
    
    if table_name not in node_classes:
        logger.error(f"No node class found for table: {table_name}")
        return
    
    try:
        NodeClass = node_classes[table_name]
        table = metadata.tables[table_name]
        
        # Get data from PostgreSQL
        with engine.connect() as conn:
            result = conn.execute(sqlalchemy.text(f"SELECT * FROM {table_name}"))
            
            # Process each row
            for row in result:
                # Create node properties
                props = {}
                for column in table.columns:
                    original_col_name = column.name
                    # Get the sanitized column name
                    sanitized_col_name = column_name_mapping[table_name].get(original_col_name, original_col_name.lower())
                    value = getattr(row, original_col_name)
                    
                    # Handle different types
                    if value is not None:
                        if str(column.type).startswith(('DATE', 'TIMESTAMP')):
                            props[sanitized_col_name] = convert_date(value)
                        elif str(column.type).startswith(('DECIMAL', 'NUMERIC', 'FLOAT', 'REAL')):
                            props[sanitized_col_name] = float(value)
                        else:
                            props[sanitized_col_name] = value
                    else:
                        # For string properties, use empty string instead of None
                        if isinstance(column.type, sqlalchemy.String):
                            props[sanitized_col_name] = ""
                        else:
                            props[sanitized_col_name] = None
                
                try:
                    # Try to find existing node first
                    primary_keys = {}
                    for col in table.primary_key.columns:
                        original_col_name = col.name
                        sanitized_col_name = column_name_mapping[table_name].get(original_col_name, original_col_name.lower())
                        if sanitized_col_name in props:
                            primary_keys[sanitized_col_name] = props[sanitized_col_name]
                    
                    # If we have primary keys, try to get existing node
                    if primary_keys:
                        try:
                            # Check if node already exists
                            existing_node = NodeClass.nodes.get(**primary_keys)
                            logger.info(f"Node already exists for {table_name} with keys {primary_keys}")
                            # Update existing node with new properties if needed
                            for key, value in props.items():
                                if key not in primary_keys:  # Don't update primary keys
                                    setattr(existing_node, key, value)
                            existing_node.save()
                        except (NodeClass.DoesNotExist, Exception):
                            # Node doesn't exist, create new one
                            new_node = NodeClass(**props).save()
                    else:
                        # No primary keys, create new node
                        new_node = NodeClass(**props).save()
                        
                except Exception as e:
                    logger.error(f"Error creating/updating node for {table_name}: {str(e)}")
                    continue
        
        logger.info(f"Completed migrating table: {table_name}")
    except Exception as e:
        logger.error(f"Error migrating table {table_name}: {str(e)}")

# Create relationships between nodes
def create_relationships():
    logger.info("Creating relationships between nodes...")
    
    try:
        for source_table, rels in relationships.items():
            for rel_info in rels:
                target_table = rel_info['target_table']
                source_cols = rel_info['source_cols']
                target_cols = rel_info['target_cols']
                sanitized_source_cols = rel_info.get('sanitized_source_cols', source_cols)
                sanitized_target_cols = rel_info.get('sanitized_target_cols', target_cols)
                rel_name = rel_info['rel_name']
                
                SourceClass = node_classes[source_table]
                TargetClass = node_classes[target_table]
                
                logger.info(f"Creating {rel_name} relationships: {source_table} -> {target_table}")
                
                # For each source node, find and connect to target nodes
                for source_node in SourceClass.nodes.all():
                    # Get source key values
                    source_keys = {}
                    for i, col in enumerate(source_cols):
                        sanitized_col = sanitized_source_cols[i]
                        source_keys[col] = getattr(source_node, sanitized_col)
                    
                    # Find target nodes with matching keys
                    target_filters = {}
                    for i, col in enumerate(target_cols):
                        source_col = source_cols[i]
                        sanitized_target_col = sanitized_target_cols[i]
                        target_filters[sanitized_target_col] = source_keys[source_col]
                    
                    try:
                        target_nodes = TargetClass.nodes.filter(**target_filters)
                        for target_node in target_nodes:
                            # Get the relationship attribute
                            rel_attr = getattr(source_node, f"{target_table}_rel")
                            # Connect the nodes
                            rel_attr.connect(target_node)
                    except Exception as e:
                        logger.error(f"Error creating relationship {source_table} -> {target_table}: {str(e)}")
    except Exception as e:
        logger.error(f"Error creating relationships: {str(e)}")

# Main migration function
def run_dynamic_migration(clear_database=False):
    """Run the complete dynamic migration process
    
    Args:
        clear_database (bool): Whether to clear the Neo4j database before migration
    """
    logger.info("Starting dynamic migration from PostgreSQL to Neo4j...")
    
    try:
        # Create node models based on database schema
        create_node_models()
        
        # Migrate all tables
        for table_name in metadata.tables:
            migrate_table(table_name)
        
        # Create relationships between nodes
        create_relationships()
        
        logger.info("Dynamic migration completed successfully!")
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        raise

if __name__ == "__main__":
    # Run without clearing the database
    run_dynamic_migration(clear_database=False)
