# Northwind Graph Explorer

A web-based visualization tool for exploring the Northwind database in Neo4j Aura using natural language queries.

## Features

- Convert natural language queries to Cypher
- Interactive graph visualization of Neo4j data
- Tabular view of query results
- Color-coded nodes by entity type
- Node and relationship details on hover

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to http://localhost:3000

## Usage

1. Type a natural language query in the search box, such as:
   - "Show me all products"
   - "Show products in category Beverages"
   - "Show customer orders for ALFKI"
   - "Show order details for order 10248"

2. Toggle between graph and table views
3. Click on nodes in the graph to focus on them

## Connection Configuration

The Neo4j connection details are configured in `src/App.jsx`:

```javascript
const NEO4J_URI = 'neo4j+s://3e3d0346.databases.neo4j.io'
const NEO4J_USER = 'neo4j'
const NEO4J_PASSWORD = 'u_K1KGM8AUAZnFYf_FpAnG3W5XYe9BUkLUvgebn4Dug'
```

## Build for Production

```bash
npm run build
```

The build files will be generated in the `dist` directory. 