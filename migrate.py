import os
import sqlalchemy
from sqlalchemy import MetaData, create_engine
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.orm import Session
from neomodel import config, StructuredNode, StringProperty, IntegerProperty, FloatProperty, DateProperty, RelationshipTo, RelationshipFrom, StructuredRel, db
import pandas as pd
from datetime import datetime

# Database connection strings
POSTGRES_URL = 'postgresql://postgres:123456788@localhost:5432/northwind'
NEO4J_URL = 'neo4j+s://neo4j:u_K1KGM8AUAZnFYf_FpAnG3W5XYe9BUkLUvgebn4Dug@3e3d0346.databases.neo4j.io'

# Configure Neo4j connection
config.DATABASE_URL = NEO4J_URL

# Connect to PostgreSQL and inspect schema
engine = create_engine(POSTGRES_URL)
metadata = MetaData()
metadata.reflect(engine)

print(f"Discovered {len(metadata.tables)} tables in PostgreSQL Northwind database")
for table_name in metadata.tables:
    print(f"- {table_name}")

# Define Neo4j node models based on PostgreSQL schema
class Category(StructuredNode):
    category_id = IntegerProperty(unique_index=True)
    category_name = StringProperty()
    description = StringProperty()
    products = RelationshipTo('Product', 'CONTAINS')

class Supplier(StructuredNode):
    supplier_id = IntegerProperty(unique_index=True)
    company_name = StringProperty()
    contact_name = StringProperty()
    contact_title = StringProperty()
    address = StringProperty()
    city = StringProperty()
    region = StringProperty()
    postal_code = StringProperty()
    country = StringProperty()
    phone = StringProperty()
    fax = StringProperty()
    homepage = StringProperty()
    products = RelationshipTo('Product', 'SUPPLIES')

class Customer(StructuredNode):
    customer_id = StringProperty(unique_index=True)
    company_name = StringProperty()
    contact_name = StringProperty()
    contact_title = StringProperty()
    address = StringProperty()
    city = StringProperty()
    region = StringProperty()
    postal_code = StringProperty()
    country = StringProperty()
    phone = StringProperty()
    fax = StringProperty()
    orders = RelationshipTo('Order', 'PLACED')

class Employee(StructuredNode):
    employee_id = IntegerProperty(unique_index=True)
    last_name = StringProperty()
    first_name = StringProperty()
    title = StringProperty()
    title_of_courtesy = StringProperty()
    birth_date = DateProperty()
    hire_date = DateProperty()
    address = StringProperty()
    city = StringProperty()
    region = StringProperty()
    postal_code = StringProperty()
    country = StringProperty()
    home_phone = StringProperty()
    extension = StringProperty()
    notes = StringProperty()
    reports_to = RelationshipTo('Employee', 'REPORTS_TO')
    subordinates = RelationshipFrom('Employee', 'REPORTS_TO')
    orders = RelationshipTo('Order', 'PROCESSED')

class Product(StructuredNode):
    product_id = IntegerProperty(unique_index=True)
    product_name = StringProperty()
    supplier = RelationshipFrom('Supplier', 'SUPPLIES')
    category = RelationshipFrom('Category', 'CONTAINS')
    quantity_per_unit = StringProperty()
    unit_price = FloatProperty()
    units_in_stock = IntegerProperty()
    units_on_order = IntegerProperty()
    reorder_level = IntegerProperty()
    discontinued = IntegerProperty()
    order_details = RelationshipFrom('OrderDetail', 'CONTAINS')

class Order(StructuredNode):
    order_id = IntegerProperty(unique_index=True)
    customer = RelationshipFrom('Customer', 'PLACED')
    employee = RelationshipFrom('Employee', 'PROCESSED')
    order_date = DateProperty()
    required_date = DateProperty()
    shipped_date = DateProperty()
    ship_via = IntegerProperty()
    freight = FloatProperty()
    ship_name = StringProperty()
    ship_address = StringProperty()
    ship_city = StringProperty()
    ship_region = StringProperty()
    ship_postal_code = StringProperty()
    ship_country = StringProperty()
    order_details = RelationshipTo('OrderDetail', 'HAS')
    shipper = RelationshipTo('Shipper', 'SHIPPED_VIA')

class OrderDetail(StructuredNode):
    order = RelationshipFrom('Order', 'HAS')
    product = RelationshipTo('Product', 'CONTAINS')
    unit_price = FloatProperty()
    quantity = IntegerProperty()
    discount = FloatProperty()

class Shipper(StructuredNode):
    shipper_id = IntegerProperty(unique_index=True)
    company_name = StringProperty()
    phone = StringProperty()
    orders = RelationshipFrom('Order', 'SHIPPED_VIA')

# Migration functions
def clear_neo4j_database():
    """Clear all data in Neo4j database"""
    db.cypher_query("MATCH (n) DETACH DELETE n")
    print("Neo4j database cleared")

def convert_date(date_str):
    """Convert date string to datetime object or None"""
    if pd.isna(date_str):
        return None
    if isinstance(date_str, str):
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    return date_str.date() if hasattr(date_str, 'date') else date_str

def migrate_categories():
    """Migrate categories from PostgreSQL to Neo4j"""
    print("Migrating categories...")
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT * FROM categories"))
        for row in result:
            category = Category(
                category_id=row.category_id,
                category_name=row.category_name,
                description=row.description
            ).save()
    print("Categories migration completed")

def migrate_suppliers():
    """Migrate suppliers from PostgreSQL to Neo4j"""
    print("Migrating suppliers...")
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT * FROM suppliers"))
        for row in result:
            supplier = Supplier(
                supplier_id=row.supplier_id,
                company_name=row.company_name,
                contact_name=row.contact_name,
                contact_title=row.contact_title,
                address=row.address,
                city=row.city,
                region=row.region if row.region else "",
                postal_code=row.postal_code if row.postal_code else "",
                country=row.country,
                phone=row.phone,
                fax=row.fax if row.fax else "",
                homepage=row.homepage if row.homepage else ""
            ).save()
    print("Suppliers migration completed")

def migrate_customers():
    """Migrate customers from PostgreSQL to Neo4j"""
    print("Migrating customers...")
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT * FROM customers"))
        for row in result:
            customer = Customer(
                customer_id=row.customer_id,
                company_name=row.company_name,
                contact_name=row.contact_name,
                contact_title=row.contact_title,
                address=row.address,
                city=row.city,
                region=row.region if row.region else "",
                postal_code=row.postal_code if row.postal_code else "",
                country=row.country,
                phone=row.phone,
                fax=row.fax if row.fax else ""
            ).save()
    print("Customers migration completed")

def migrate_employees():
    """Migrate employees from PostgreSQL to Neo4j"""
    print("Migrating employees...")
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT * FROM employees"))
        for row in result:
            employee = Employee(
                employee_id=row.employee_id,
                last_name=row.last_name,
                first_name=row.first_name,
                title=row.title,
                title_of_courtesy=row.title_of_courtesy if row.title_of_courtesy else "",
                birth_date=convert_date(row.birth_date),
                hire_date=convert_date(row.hire_date),
                address=row.address,
                city=row.city,
                region=row.region if row.region else "",
                postal_code=row.postal_code if row.postal_code else "",
                country=row.country,
                home_phone=row.home_phone,
                extension=row.extension if row.extension else "",
                notes=row.notes
            ).save()

    # Set up employee reporting relationships
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT employee_id, reports_to FROM employees WHERE reports_to IS NOT NULL"))
        for row in result:
            if row.reports_to:
                employee = Employee.nodes.get(employee_id=row.employee_id)
                manager = Employee.nodes.get(employee_id=row.reports_to)
                employee.reports_to.connect(manager)
    print("Employees migration completed")

def migrate_products():
    """Migrate products from PostgreSQL to Neo4j"""
    print("Migrating products...")
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT * FROM products"))
        for row in result:
            product = Product(
                product_id=row.product_id,
                product_name=row.product_name,
                quantity_per_unit=row.quantity_per_unit,
                unit_price=float(row.unit_price) if row.unit_price else 0.0,
                units_in_stock=row.units_in_stock,
                units_on_order=row.units_on_order,
                reorder_level=row.reorder_level,
                discontinued=row.discontinued
            ).save()
            
            # Connect product to supplier
            if row.supplier_id:
                supplier = Supplier.nodes.get(supplier_id=row.supplier_id)
                supplier.products.connect(product)
            
            # Connect product to category
            if row.category_id:
                category = Category.nodes.get(category_id=row.category_id)
                category.products.connect(product)
    print("Products migration completed")

def migrate_shippers():
    """Migrate shippers from PostgreSQL to Neo4j"""
    print("Migrating shippers...")
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT * FROM shippers"))
        for row in result:
            shipper = Shipper(
                shipper_id=row.shipper_id,
                company_name=row.company_name,
                phone=row.phone
            ).save()
    print("Shippers migration completed")

def migrate_orders():
    """Migrate orders from PostgreSQL to Neo4j"""
    print("Migrating orders...")
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT * FROM orders"))
        for row in result:
            order = Order(
                order_id=row.order_id,
                order_date=convert_date(row.order_date),
                required_date=convert_date(row.required_date),
                shipped_date=convert_date(row.shipped_date),
                ship_via=row.ship_via,
                freight=float(row.freight) if row.freight else 0.0,
                ship_name=row.ship_name,
                ship_address=row.ship_address,
                ship_city=row.ship_city,
                ship_region=row.ship_region if row.ship_region else "",
                ship_postal_code=row.ship_postal_code if row.ship_postal_code else "",
                ship_country=row.ship_country if row.ship_country else ""
            ).save()
            
            # Connect order to customer
            if row.customer_id:
                customer = Customer.nodes.get(customer_id=row.customer_id)
                customer.orders.connect(order)
            
            # Connect order to employee
            if row.employee_id:
                employee = Employee.nodes.get(employee_id=row.employee_id)
                employee.orders.connect(order)
                
            # Connect order to shipper
            if row.ship_via:
                shipper = Shipper.nodes.get(shipper_id=row.ship_via)
                order.shipper.connect(shipper)
    print("Orders migration completed")

def migrate_order_details():
    """Migrate order details from PostgreSQL to Neo4j"""
    print("Migrating order details...")
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT * FROM order_details"))
        for row in result:
            order_detail = OrderDetail(
                unit_price=float(row.unit_price) if row.unit_price else 0.0,
                quantity=row.quantity,
                discount=row.discount
            ).save()
            
            # Connect order detail to order
            order = Order.nodes.get(order_id=row.order_id)
            order.order_details.connect(order_detail)
            
            # Connect order detail to product
            product = Product.nodes.get(product_id=row.product_id)
            order_detail.product.connect(product)
    print("Order details migration completed")

def run_migration():
    """Run the complete migration process"""
    print("Starting migration from PostgreSQL to Neo4j...")
    
    # Clear Neo4j database
    clear_neo4j_database()
    
    # Migrate all entities
    migrate_categories()
    migrate_suppliers()
    migrate_customers()
    migrate_employees()
    migrate_shippers()
    migrate_products()
    migrate_orders()
    migrate_order_details()
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration() 