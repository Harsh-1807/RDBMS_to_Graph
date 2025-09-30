# SQL to Neo4j Aura Migration Tool and Graph Explorer

This project consists of two parts:

1. A migration tool to transfer data from PostgreSQL Northwind database to Neo4j Aura
2. A web application for exploring and visualizing the data in Neo4j Aura
 <img width="512" height="393" alt="ER" src="https://github.com/user-attachments/assets/c36ea96e-aa25-42e1-b965-4e1efe728ad1" />


## Part 1: Migration Tool

The migration tool extracts data from a PostgreSQL Northwind database and loads it into Neo4j Aura, maintaining all relationships.

### Requirements

- Python 3.8+
- PostgreSQL with Northwind database
- Neo4j Aura account

### Setup

1. Install the required packages:
```
pip install -r requirements.txt
```

2. Configure the database connection strings in `migrate.py`:
```python
POSTGRES_URL = 'postgresql://postgres:123456788@localhost:5432/northwind'
NEO4J_URL = 'neo4j+s://neo4j:u_K1KGM8AUAZnFYf_FpAnG3WYe9BUkLUvgebn4Dug@3e3d0346.databases.neo4j.io'
```

### Running the Migration

Simply run the migration script:
```
python migrate.py
```

## Part 2: Web Application

A React-based web application that allows users to query the Neo4j Aura database using natural language and visualize the results as an interactive graph.

### Features

- Convert natural language queries to Cypher
- Interactive graph visualization of Neo4j data
- Tabular view of query results
- Color-coded nodes by entity type

### Setup

1. Navigate to the web app directory:
```
cd web-app
```

2. Install dependencies:
```
npm install
```

3. Start the development server:
```
npm run dev
```

4. Open your browser to http://localhost:3000

### Usage

1. Type a natural language query in the search box, such as:
   - "Show me all products"
   - "Show products in category Beverages"
   - "Show customer orders for ALFKI"
   - "Show order details for order 10248"

2. Toggle between graph and table views
3. Click on nodes in the graph to focus on them

## Data Model

The Neo4j graph model created by the migration includes:

### Nodes
- Category
- Supplier
- Customer
- Employee
- Product
- Order
- OrderDetail
- Shipper

### Relationships
- (Category)-[CONTAINS]->(Product)
- (Supplier)-[SUPPLIES]->(Product)
- (Customer)-[PLACED]->(Order)
- (Employee)-[PROCESSED]->(Order)
- (Employee)-[REPORTS_TO]->(Employee)
- (Order)-[HAS]->(OrderDetail)
- (OrderDetail)-[CONTAINS]->(Product)
- (Order)-[SHIPPED_VIA]->(Shipper)

## Configuration

Update the database connection details in:
- `migrate.py` for the migration tool
- `web-app/src/App.jsx` for the web application

## Customization

You can modify the Neo4j model classes in `migrate.py` to change the graph structure according to your needs. 





<img width="1911" height="1002" alt="image" src="https://github.com/user-attachments/assets/7009f9e4-124c-4ffc-935e-61dc95ba2a50" />
