import { useState, useCallback, useRef, useEffect } from 'react'
import { Graph3D } from './components/Graph3D'
import neo4j from 'neo4j-driver'
import { QueryInput } from './components/QueryInput'
import { GraphControls } from './components/GraphControls'
import { ResultTable } from './components/ResultTable'
import { translateToCypher, clearConversationContext } from './nlp/CypherTranslator'

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
  const [cypherQuery, setCypherQuery] = useState('') // Store generated Cypher query
  const [queryIntent, setQueryIntent] = useState(null) // Store query understanding
  const [selectedNode, setSelectedNode] = useState(null) // Add state for selected node details
  const [relatedNodes, setRelatedNodes] = useState([]) // Add state for nodes related to selection
  const graphRef = useRef()
  
  // Clear conversation context on component mount
  useEffect(() => {
    clearConversationContext();
  }, []);

  const nodeColors = {
    Category: '#FF9671',
    Product: '#00D2FC',
    Supplier: '#D65DB1',
    Customer: '#91E25A',
    Employee: '#FFC75F',
    Order: '#845EC2',
    OrderDetail: '#0089BA',
    Shipper: '#C34A36'
  }

  const executeQuery = useCallback(async (nlQuery) => {
    setLoading(true)
    setError(null)
    // Clear any previously selected node when running a new query
    setSelectedNode(null)
    setRelatedNodes([])
    
    // Clear conversation context for new topic
    if (nlQuery.toLowerCase().includes('start over') || 
        nlQuery.toLowerCase().includes('reset') || 
        nlQuery.toLowerCase().includes('new topic')) {
      clearConversationContext();
      setError("Conversation reset. Please try a new query.");
      setLoading(false);
      return;
    }
    
    try {
      // Use our semantic translator with Mistral
      // translateToCypher is now async so we need to await it
      const generatedCypherQuery = await translateToCypher(nlQuery);
      
      setCypherQuery(generatedCypherQuery) // Store the generated Cypher query
      console.log('Executing Cypher query:', generatedCypherQuery)
      
      // Store and display query understanding
      captureQueryIntent(nlQuery);
      
      const driver = neo4j.driver(
        NEO4J_URI, 
        neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
      )
      
      const session = driver.session()
      
      try {
        const result = await session.run(generatedCypherQuery)
        
        // Process results for graph visualization
        const nodes = new Map()
        const links = []
        
        // Extract nodes and relationships from the result
        result.records.forEach(record => {
          record.forEach(value => {
            if (neo4j.isNode(value)) {
              // Make sure value and value.identity are defined before calling toString()
              if (value && value.identity && !nodes.has(value.identity.toString())) {
                nodes.set(value.identity.toString(), {
                  id: value.identity.toString(),
                  label: value.labels && value.labels.length > 0 ? value.labels[0] : 'Unknown',
                  properties: value.properties || {},
                  color: value.labels && value.labels.length > 0 ? (nodeColors[value.labels[0]] || '#CCCCCC') : '#CCCCCC'
                })
              }
            } else if (neo4j.isRelationship(value)) {
              // Only process relationships if all required properties exist
              if (value && value.startNodeIdentity && value.endNodeIdentity) {
                links.push({
                  source: value.startNodeIdentity.toString(),
                  target: value.endNodeIdentity.toString(),
                  label: value.type || 'Unknown',
                  properties: value.properties || {}
                })
              }
            } else if (value instanceof neo4j.Path) {
              // Handle paths with added safety checks
              if (value && value.segments) {
                value.segments.forEach(segment => {
                  if (!segment || !segment.start || !segment.end || !segment.relationship) {
                    return; // Skip invalid segments
                  }
                  
                  const startNode = segment.start
                  const endNode = segment.end
                  const relationship = segment.relationship
                  
                  // Make sure start node has valid identity and data
                  if (startNode.identity && !nodes.has(startNode.identity.toString())) {
                    nodes.set(startNode.identity.toString(), {
                      id: startNode.identity.toString(),
                      label: startNode.labels && startNode.labels.length > 0 ? startNode.labels[0] : 'Unknown',
                      properties: startNode.properties || {},
                      color: startNode.labels && startNode.labels.length > 0 ? 
                          (nodeColors[startNode.labels[0]] || '#CCCCCC') : '#CCCCCC'
                    })
                  }
                  
                  // Make sure end node has valid identity and data
                  if (endNode.identity && !nodes.has(endNode.identity.toString())) {
                    nodes.set(endNode.identity.toString(), {
                      id: endNode.identity.toString(),
                      label: endNode.labels && endNode.labels.length > 0 ? endNode.labels[0] : 'Unknown',
                      properties: endNode.properties || {},
                      color: endNode.labels && endNode.labels.length > 0 ? 
                          (nodeColors[endNode.labels[0]] || '#CCCCCC') : '#CCCCCC'
                    })
                  }
                  
                  // Only add links if both nodes have valid identities
                  if (startNode.identity && endNode.identity) {
                    links.push({
                      source: startNode.identity.toString(),
                      target: endNode.identity.toString(),
                      label: relationship.type || 'Unknown',
                      properties: relationship.properties || {}
                    })
                  }
                })
              }
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
            if (value === null || value === undefined) {
              row[key] = 'N/A'; // Handle null values
            } else if (neo4j.isNode(value)) {
              if (value.labels && value.labels.length > 0) {
                row[key] = `${value.labels[0]}: ${JSON.stringify(value.properties || {})}`
              } else {
                row[key] = `Node: ${JSON.stringify(value.properties || {})}`
              }
            } else if (neo4j.isRelationship(value)) {
              row[key] = `${value.type || 'Relationship'}: ${JSON.stringify(value.properties || {})}`
            } else if (typeof value === 'object') {
              // Handle other complex objects
              try {
                row[key] = JSON.stringify(value)
              } catch (e) {
                row[key] = 'Complex Value'
              }
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

  const handleNodeClick = useCallback(async (node) => {
    console.log('Node clicked:', node)
    setSelectedNode(node)
    
    // Fetch related nodes for the selected node
    try {
      const driver = neo4j.driver(
        NEO4J_URI, 
        neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
      )
      
      const session = driver.session()
      
      // Construct a query to find related nodes based on node type
      let relationshipQuery
      if (node.label === 'Product') {
        relationshipQuery = `MATCH (p:Product {product_id: ${node.properties.product_id}})-[r]-(related)
                            RETURN type(r) AS relationship, labels(related)[0] AS nodeType, 
                            COUNT(related) AS count
                            ORDER BY count DESC`
      } else if (node.label === 'Category') {
        relationshipQuery = `MATCH (c:Category {category_id: ${node.properties.category_id}})-[r]-(related)
                            RETURN type(r) AS relationship, labels(related)[0] AS nodeType, 
                            COUNT(related) AS count
                            ORDER BY count DESC`
      } else if (node.label === 'Customer') {
        relationshipQuery = `MATCH (c:Customer {customer_id: "${node.properties.customer_id}"})-[r]-(related)
                            RETURN type(r) AS relationship, labels(related)[0] AS nodeType, 
                            COUNT(related) AS count
                            ORDER BY count DESC`
      } else if (node.label === 'Order') {
        relationshipQuery = `MATCH (o:Order {order_id: ${node.properties.order_id}})-[r]-(related)
                            RETURN type(r) AS relationship, labels(related)[0] AS nodeType, 
                            COUNT(related) AS count
                            ORDER BY count DESC`
      } else if (node.label === 'Supplier') {
        relationshipQuery = `MATCH (s:Supplier {supplier_id: ${node.properties.supplier_id}})-[r]-(related)
                            RETURN type(r) AS relationship, labels(related)[0] AS nodeType, 
                            COUNT(related) AS count
                            ORDER BY count DESC`
      } else if (node.label === 'Employee') {
        relationshipQuery = `MATCH (e:Employee {employee_id: ${node.properties.employee_id}})-[r]-(related)
                            RETURN type(r) AS relationship, labels(related)[0] AS nodeType, 
                            COUNT(related) AS count
                            ORDER BY count DESC`
      } else {
        relationshipQuery = `MATCH (n)-[r]-(related) 
                            WHERE ID(n) = ${node.id}
                            RETURN type(r) AS relationship, labels(related)[0] AS nodeType, 
                            COUNT(related) AS count
                            ORDER BY count DESC`
      }
      
      try {
        const result = await session.run(relationshipQuery)
        
        const relationships = result.records.map(record => ({
          relationship: record.get('relationship'),
          nodeType: record.get('nodeType'),
          count: record.get('count').toNumber()
        }))
        
        setRelatedNodes(relationships)
      } catch (err) {
        console.error('Error fetching related nodes:', err)
      } finally {
        await session.close()
        await driver.close()
      }
    } catch (err) {
      console.error('Error establishing database connection:', err)
    }
  }, [])

  const captureQueryIntent = (nlQuery) => {
    setQueryIntent({
      query: nlQuery,
      timestamp: new Date().toLocaleTimeString()
    })
  }

  // Format property values for display
  const formatPropertyValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      // Format currency if it looks like a price
      if (String(value).includes('.') && value < 10000) {
        return `$${value.toFixed(2)}`;
      }
      return value.toString();
    }
    // Format date string if it's a date
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return new Date(value).toLocaleDateString();
      } catch (e) {
        return value;
      }
    }
    return String(value);
  }

  // Get a human-readable title for a node
  const getNodeTitle = (node) => {
    if (!node) return '';
    
    const props = node.properties;
    
    if (node.label === 'Product' && props.product_name) {
      return props.product_name;
    } else if (node.label === 'Category' && props.category_name) {
      return props.category_name;
    } else if (node.label === 'Supplier' && props.company_name) {
      return props.company_name;
    } else if (node.label === 'Customer' && props.company_name) {
      return props.company_name;
    } else if (node.label === 'Employee' && props.first_name && props.last_name) {
      return `${props.first_name} ${props.last_name}`;
    } else if (node.label === 'Order') {
      return `Order #${props.order_id}`;
    } else if (node.label === 'Shipper' && props.company_name) {
      return props.company_name;
    }
    
    return `${node.label} ${node.id}`;
  }

  // Handle click on a related node to run a new query
  const handleRelatedNodeClick = (relationship, nodeType) => {
    if (!selectedNode) return;
    
    let query = '';
    const nodeTitle = getNodeTitle(selectedNode);
    
    if (relationship === 'CONTAINS' && nodeType === 'Product') {
      query = `Show products in category ${nodeTitle}`;
    } else if (relationship === 'SUPPLIES' && nodeType === 'Product') {
      query = `Show products supplied by ${nodeTitle}`;
    } else if (relationship === 'PLACED' && nodeType === 'Order') {
      query = `Show orders placed by customer ${nodeTitle}`;
    } else if (relationship === 'PROCESSED' && nodeType === 'Order') {
      query = `Show orders processed by employee ${nodeTitle}`;
    } else if (relationship === 'REPORTS_TO' && nodeType === 'Employee') {
      query = `Show employee hierarchy for ${nodeTitle}`;
    } else if (relationship === 'SHIPPED_VIA' && nodeType === 'Shipper') {
      query = `Show orders shipped via ${nodeTitle}`;
    } else {
      query = `Show ${nodeType.toLowerCase()}s related to ${nodeTitle}`;
    }
    
    executeQuery(query);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-lg">
        <h1 className="text-xl font-semibold text-center">Neo4j Northwind Graph Explorer</h1>
      </header>
      
      <div className="p-4">
        <QueryInput onSubmit={executeQuery} />
        
        {queryIntent && (
          <div className="mt-2 text-sm text-gray-400">
            <span className="font-medium">Query:</span> {queryIntent.query}
            <span className="ml-2">({queryIntent.timestamp})</span>
          </div>
        )}
        
        {cypherQuery && (
          <div className="mt-1 text-sm font-mono bg-gray-800 p-2 rounded overflow-x-auto">
            <span className="text-blue-400">Generated Cypher:</span> {cypherQuery}
          </div>
        )}
      </div>
      
      {error ? (
        <div className="p-4 m-4 bg-red-900 bg-opacity-30 text-red-200 rounded">
          Error: {error}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden p-4">
          <div className={`flex-1 relative transition-all duration-300 ${selectedNode ? 'mr-80' : ''}`}>
            <GraphControls 
              viewMode={viewMode} 
              onViewModeChange={setViewMode}
              nodeCount={graphData.nodes.length} 
              relationshipCount={graphData.links.length} 
            />
            
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {viewMode === 'graph' ? (
                  <div className="h-full relative rounded-lg overflow-hidden bg-gray-950">
                    <Graph3D 
                      data={graphData} 
                      onNodeClick={handleNodeClick}
                    />
                  </div>
                ) : (
                  <div className="h-full overflow-auto rounded-lg bg-gray-800">
                    <ResultTable data={tableData} />
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Node details panel */}
          {selectedNode && (
            <div className="w-80 bg-gray-800 rounded-lg shadow-xl ml-4 p-4 overflow-y-auto flex flex-col h-full animate-slideIn">
              <div className="mb-4 pb-2 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">{getNodeTitle(selectedNode)}</h2>
                  <button 
                    onClick={() => setSelectedNode(null)} 
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div 
                  className="text-sm font-medium mt-1 px-2 py-1 rounded-full inline-block"
                  style={{ backgroundColor: selectedNode.color || '#666', color: '#fff' }}
                >
                  {selectedNode.label}
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2 text-blue-300">Properties</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(selectedNode.properties || {}).map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-700">
                        <td className="py-2 pr-2 text-gray-400 font-medium">
                          {key.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 text-right">{formatPropertyValue(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {relatedNodes.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-lg font-semibold mb-2 text-blue-300">Relationships</h3>
                  <div className="space-y-2">
                    {relatedNodes.map((rel, index) => (
                      <button
                        key={index}
                        onClick={() => handleRelatedNodeClick(rel.relationship, rel.nodeType)}
                        className="w-full text-left bg-gray-700 hover:bg-gray-600 p-2 rounded flex justify-between items-center transition"
                      >
                        <div>
                          <span className="font-medium">{rel.nodeType}</span>
                          <div className="text-xs text-gray-400">via {rel.relationship}</div>
                        </div>
                        <div className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-1">
                          {rel.count}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-auto pt-4 text-center">
                <button
                  onClick={() => executeQuery(`Find paths related to ${getNodeTitle(selectedNode)}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full font-medium text-sm transition"
                >
                  Explore More Connections
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App 