import { useState, useCallback, useRef } from 'react'
import { Graph3D } from './components/Graph3D'
import neo4j from 'neo4j-driver'
import { QueryInput } from './components/QueryInput'
import { GraphControls } from './components/GraphControls'
import { ResultTable } from './components/ResultTable'

// Neo4j connection details
const NEO4J_URI = 'neo4j+s://3e3d0346.databases.neo4j.io'
const NEO4J_USER = 'neo4j'
const NEO4J_PASSWORD = 'u_K1KGM8AUAZnFYf_FpAnG3W5XYe9BUkLUvgebn4Dug'

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tableData, setTableData] = useState([])
  const [viewMode, setViewMode] = useState('graph') // 'graph' or 'table'
  const graphRef = useRef()

  const nodeColors = {
    Category: '#FF5733',
    Product: '#33FF57',
    Supplier: '#3357FF',
    Customer: '#F033FF',
    Employee: '#FF33A8',
    Order: '#33FFF5',
    OrderDetail: '#FFD133',
    Shipper: '#B533FF'
  }

  // Function to convert natural language to Cypher query
  // This is a simplified version. In a real app, you might use an AI service
  const naturalLanguageToCypher = (nlQuery) => {
    // Simple pattern matching for common queries
    const nlQueryLower = nlQuery.toLowerCase()
    
    if (nlQueryLower.includes('all products')) {
      return 'MATCH (p:Product) RETURN p LIMIT 100'
    }
    if (nlQueryLower.includes('all categories')) {
      return 'MATCH (c:Category) RETURN c LIMIT 100'
    }
    if (nlQueryLower.includes('all customers')) {
      return 'MATCH (c:Customer) RETURN c LIMIT 100'
    }
    if (nlQueryLower.includes('all suppliers')) {
      return 'MATCH (s:Supplier) RETURN s LIMIT 100'
    }
    if (nlQueryLower.includes('products in category')) {
      const categoryMatch = nlQuery.match(/in category\s+['"]?([^'"]+)['"]?/i)
      const categoryName = categoryMatch ? categoryMatch[1] : 'Beverages' // Default if no category specified
      return `MATCH (c:Category {category_name: "${categoryName}"})-[:CONTAINS]->(p:Product) RETURN c, p`
    }
    if (nlQueryLower.includes('customer orders')) {
      const customerMatch = nlQuery.match(/customer\s+['"]?([^'"]+)['"]?/i)
      const customerId = customerMatch ? customerMatch[1] : 'ALFKI' // Default if no customer specified
      return `MATCH (c:Customer {customer_id: "${customerId}"})-[:PLACED]->(o:Order) RETURN c, o`
    }
    if (nlQueryLower.includes('order details')) {
      const orderMatch = nlQuery.match(/order\s+(\d+)/i)
      const orderId = orderMatch ? parseInt(orderMatch[1]) : 10248 // Default if no order specified
      return `MATCH (o:Order {order_id: ${orderId}})-[:HAS]->(od:OrderDetail)-[:CONTAINS]->(p:Product) RETURN o, od, p`
    }
    
    // Default query if no patterns match
    return 'MATCH (n) RETURN n LIMIT 25'
  }

  const executeQuery = useCallback(async (nlQuery) => {
    setLoading(true)
    setError(null)
    
    try {
      const cypherQuery = naturalLanguageToCypher(nlQuery)
      console.log('Executing Cypher query:', cypherQuery)
      
      const driver = neo4j.driver(
        NEO4J_URI, 
        neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
      )
      
      const session = driver.session()
      
      try {
        const result = await session.run(cypherQuery)
        
        // Process results for graph visualization
        const nodes = new Map()
        const links = []
        
        // Extract nodes and relationships from the result
        result.records.forEach(record => {
          record.forEach(value => {
            if (neo4j.isNode(value)) {
              if (!nodes.has(value.identity.toString())) {
                nodes.set(value.identity.toString(), {
                  id: value.identity.toString(),
                  label: value.labels[0],
                  properties: value.properties,
                  color: nodeColors[value.labels[0]] || '#CCCCCC'
                })
              }
            } else if (neo4j.isRelationship(value)) {
              links.push({
                source: value.startNodeIdentity.toString(),
                target: value.endNodeIdentity.toString(),
                label: value.type,
                properties: value.properties
              })
            } else if (value instanceof neo4j.Path) {
              // Handle paths
              value.segments.forEach(segment => {
                const startNode = segment.start
                const endNode = segment.end
                const relationship = segment.relationship
                
                if (!nodes.has(startNode.identity.toString())) {
                  nodes.set(startNode.identity.toString(), {
                    id: startNode.identity.toString(),
                    label: startNode.labels[0],
                    properties: startNode.properties,
                    color: nodeColors[startNode.labels[0]] || '#CCCCCC'
                  })
                }
                
                if (!nodes.has(endNode.identity.toString())) {
                  nodes.set(endNode.identity.toString(), {
                    id: endNode.identity.toString(),
                    label: endNode.labels[0],
                    properties: endNode.properties,
                    color: nodeColors[endNode.labels[0]] || '#CCCCCC'
                  })
                }
                
                links.push({
                  source: startNode.identity.toString(),
                  target: endNode.identity.toString(),
                  label: relationship.type,
                  properties: relationship.properties
                })
              })
            }
          })
        })
        
        // Set graph data
        setGraphData({
          nodes: Array.from(nodes.values()),
          links
        })
        
        // Also prepare tabular data
        const tableRows = result.records.map(record => {
          const row = {}
          record.keys.forEach(key => {
            const value = record.get(key)
            if (neo4j.isNode(value)) {
              row[key] = `${value.labels[0]}: ${JSON.stringify(value.properties)}`
            } else if (neo4j.isRelationship(value)) {
              row[key] = `${value.type}: ${JSON.stringify(value.properties)}`
            } else {
              row[key] = value
            }
          })
          return row
        })
        
        setTableData(tableRows)
      } finally {
        await session.close()
        await driver.close()
      }
    } catch (err) {
      console.error('Error executing query:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleNodeClick = useCallback(node => {
    console.log('Node clicked:', node)
    alert(`Node: ${node.label}\nProperties: ${JSON.stringify(node.properties, null, 2)}`)
  }, [])

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.label
    const fontSize = 12/globalScale
    ctx.font = `${fontSize}px Sans-Serif`
    
    // Node circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false)
    ctx.fillStyle = node.color || '#CCCCCC'
    ctx.fill()
    
    // Node label
    const textWidth = ctx.measureText(label).width
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2)
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(
      node.x - bckgDimensions[0] / 2,
      node.y - bckgDimensions[1] / 2 - 10,
      bckgDimensions[0],
      bckgDimensions[1]
    )
    
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'white'
    ctx.fillText(label, node.x, node.y - 10)
    
    // Property display for primary property (e.g., name)
    let primaryProperty = ''
    if (node.properties) {
      if (node.properties.name) {
        primaryProperty = node.properties.name
      } else if (node.properties.product_name) {
        primaryProperty = node.properties.product_name
      } else if (node.properties.company_name) {
        primaryProperty = node.properties.company_name
      } else if (node.properties.category_name) {
        primaryProperty = node.properties.category_name
      } else if (node.properties.customer_id) {
        primaryProperty = node.properties.customer_id
      }
    }
    
    if (primaryProperty && globalScale > 0.5) {
      const propTextWidth = ctx.measureText(primaryProperty).width
      const propBckgDimensions = [propTextWidth, fontSize].map(n => n + fontSize * 0.2)
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(
        node.x - propBckgDimensions[0] / 2,
        node.y + propBckgDimensions[1] / 2,
        propBckgDimensions[0],
        propBckgDimensions[1]
      )
      
      ctx.fillStyle = 'white'
      ctx.fillText(primaryProperty, node.x, node.y + fontSize)
    }
  }, [])

  const linkCanvasObject = useCallback((link, ctx) => {
    // Draw link label at the middle of the link
    if (link.label) {
      const start = link.source
      const end = link.target
      
      const fontSize = 4
      ctx.font = `${fontSize}px Sans-Serif`
      
      const label = link.label
      const textWidth = ctx.measureText(label).width
      
      const midX = start.x + (end.x - start.x) / 2
      const midY = start.y + (end.y - start.y) / 2
      
      // Background for text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(
        midX - textWidth / 2,
        midY - fontSize / 2,
        textWidth,
        fontSize
      )
      
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'white'
      ctx.fillText(label, midX, midY)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="container mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-center">Northwind Graph Explorer</h1>
          <p className="text-center text-gray-400">
            Ask questions about the Northwind database in natural language
          </p>
        </header>
        
        <QueryInput onSubmit={executeQuery} loading={loading} />
        
        {error && (
          <div className="p-4 mb-6 bg-red-800 text-white rounded">
            <h3 className="font-bold">Error</h3>
            <p>{error}</p>
          </div>
        )}
        
        <GraphControls 
          viewMode={viewMode} 
          onViewModeChange={setViewMode} 
        />
        
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            {viewMode === 'graph' && graphData.nodes.length > 0 ? (
              <div className="h-[600px] relative">
                <Graph3D
                  data={graphData}
                  onNodeClick={handleNodeClick}
                />
                <div className="absolute bottom-4 left-4 bg-gray-900 p-2 rounded opacity-80">
                  <h3 className="font-bold mb-1">Legend</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(nodeColors).map(([label, color]) => (
                      <div key={label} className="flex items-center">
                        <span 
                          className="inline-block w-3 h-3 mr-1 rounded-full" 
                          style={{ backgroundColor: color }}
                        ></span>
                        <span className="text-xs">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : viewMode === 'table' && tableData.length > 0 ? (
              <ResultTable data={tableData} />
            ) : (
              <div className="flex justify-center items-center h-96 p-4">
                <p className="text-gray-400 text-center">
                  {graphData.nodes.length === 0 
                    ? "No data to display. Try running a query above."
                    : "Switch to table view to see tabular results."}
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-8 text-gray-400 text-sm text-center">
          <p>Example queries: "Show me all products", "Show products in category Beverages", "Show customer orders for ALFKI"</p>
        </div>
      </div>
    </div>
  )
}

export default App 