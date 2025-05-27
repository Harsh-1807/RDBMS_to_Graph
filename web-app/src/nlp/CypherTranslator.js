/**
 * CypherTranslator.js
 * Advanced natural language to Cypher query converter with fallback pattern matching
 */

// Store conversation context between queries
let conversationContext = {
  lastEntityType: null,
  lastEntityId: null,
  lastEntityName: null,
  lastRelationship: null,
  lastAggregation: null,
  lastLimit: 25
};

// Mistral API key
const MISTRAL_API_KEY = 'jgYrXbBXIojY3iyRwLSeJFabctgOQK7j';
// Use Mistral Large model
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * Generate a Cypher query using pattern matching logic
 * @param {string} nlQuery - Natural language query
 * @returns {string} - Generated Cypher query
 */
const generatePatternQuery = (nlQuery) => {
  console.log('Using pattern matching for query:', nlQuery);
  const queryLower = nlQuery.toLowerCase().trim();
  
  // Products and categories
  if (queryLower.includes('product') && queryLower.includes('category')) {
    if (queryLower.includes('beverage')) {
      return 'MATCH (c:Category {category_name: "Beverages"})-[:CONTAINS]->(p:Product) RETURN c, p';
    } else if (queryLower.match(/category\s+['""]?([^'""]+)['""]?/)) {
      const categoryName = queryLower.match(/category\s+['""]?([^'""]+)['""]?/)[1];
      return `MATCH (c:Category {category_name: "${categoryName}"})-[:CONTAINS]->(p:Product) RETURN c, p`;
    } else {
      return 'MATCH (c:Category)-[:CONTAINS]->(p:Product) RETURN c, p LIMIT 25';
    }
  }
  
  // Customers and orders
  if (queryLower.includes('customer') && queryLower.includes('order')) {
    if (queryLower.includes('alfki')) {
      return 'MATCH (c:Customer {customer_id: "ALFKI"})-[:PLACED]->(o:Order) RETURN c, o';
    } else if (queryLower.match(/customer\s+['""]?([a-z0-9]+)['""]?/i)) {
      const customerId = queryLower.match(/customer\s+['""]?([a-z0-9]+)['""]?/i)[1].toUpperCase();
      return `MATCH (c:Customer {customer_id: "${customerId}"})-[:PLACED]->(o:Order) RETURN c, o`;
    } else if (queryLower.includes('most') || queryLower.includes('top')) {
      return 'MATCH (c:Customer)-[:PLACED]->(o:Order) WITH c, count(o) as orderCount RETURN c, orderCount ORDER BY orderCount DESC LIMIT 10';
    } else {
      return 'MATCH (c:Customer)-[:PLACED]->(o:Order) RETURN c, o LIMIT 25';
    }
  }
  
  // Employee relationships
  if (queryLower.includes('employee') && (queryLower.includes('report') || queryLower.includes('hierarchy'))) {
    return 'MATCH (e1:Employee)-[:REPORTS_TO]->(e2:Employee) RETURN e1, e2';
  }
  
  // Suppliers and products
  if (queryLower.includes('supplier') && queryLower.includes('product')) {
    if (queryLower.match(/supplier\s+['""]?([^'""]+)['""]?/)) {
      const supplierName = queryLower.match(/supplier\s+['""]?([^'""]+)['""]?/)[1];
      return `MATCH (s:Supplier {company_name: "${supplierName}"})-[:SUPPLIES]->(p:Product) RETURN s, p`;
    } else {
      return 'MATCH (s:Supplier)-[:SUPPLIES]->(p:Product) RETURN s, p LIMIT 25';
    }
  }
  
  // Order details
  if (queryLower.includes('order detail') || queryLower.includes('orderdetail') || 
      (queryLower.includes('order') && queryLower.includes('detail'))) {
    if (queryLower.match(/order\s+(\d+)/)) {
      const orderId = queryLower.match(/order\s+(\d+)/)[1];
      return `MATCH (o:Order {order_id: ${orderId}})-[:INCLUDES]->(od:OrderDetail)-[:CONTAINS]->(p:Product) RETURN o, od, p`;
    } else {
      return 'MATCH (o:Order)-[:INCLUDES]->(od:OrderDetail)-[:CONTAINS]->(p:Product) RETURN o, od, p LIMIT 25';
    }
  }
  
  // Product pricing queries
  if (queryLower.includes('expensive') || 
      (queryLower.includes('highest') && queryLower.includes('price')) ||
      (queryLower.includes('most') && queryLower.includes('expensive'))) {
    const limit = queryLower.match(/top\s+(\d+)/) ? 
                 parseInt(queryLower.match(/top\s+(\d+)/)[1]) : 10;
    return `MATCH (p:Product) RETURN p ORDER BY p.unit_price DESC LIMIT ${limit}`;
  }
  
  if (queryLower.includes('cheapest') || 
      (queryLower.includes('lowest') && queryLower.includes('price')) ||
      (queryLower.includes('least') && queryLower.includes('expensive'))) {
    const limit = queryLower.match(/top\s+(\d+)/) ? 
                 parseInt(queryLower.match(/top\s+(\d+)/)[1]) : 10;
    return `MATCH (p:Product) RETURN p ORDER BY p.unit_price ASC LIMIT ${limit}`;
  }
  
  // Inventory queries
  if (queryLower.includes('stock') || queryLower.includes('inventory')) {
    if (queryLower.includes('low') || queryLower.includes('out of')) {
      return 'MATCH (p:Product) WHERE p.units_in_stock < 10 RETURN p ORDER BY p.units_in_stock ASC LIMIT 25';
    } else if (queryLower.includes('high')) {
      return 'MATCH (p:Product) RETURN p ORDER BY p.units_in_stock DESC LIMIT 25';
    }
  }
  
  // List queries
  if (queryLower.match(/show\s+(all\s+)?products/) || queryLower.match(/list\s+(all\s+)?products/)) {
    return 'MATCH (p:Product) RETURN p LIMIT 100';
  }
  if (queryLower.match(/show\s+(all\s+)?categories/) || queryLower.match(/list\s+(all\s+)?categories/)) {
    return 'MATCH (c:Category) RETURN c LIMIT 25';
  }
  if (queryLower.match(/show\s+(all\s+)?customers/) || queryLower.match(/list\s+(all\s+)?customers/)) {
    return 'MATCH (c:Customer) RETURN c LIMIT 50';
  }
  if (queryLower.match(/show\s+(all\s+)?suppliers/) || queryLower.match(/list\s+(all\s+)?suppliers/)) {
    return 'MATCH (s:Supplier) RETURN s LIMIT 50';
  }
  if (queryLower.match(/show\s+(all\s+)?employees/) || queryLower.match(/list\s+(all\s+)?employees/)) {
    return 'MATCH (e:Employee) RETURN e LIMIT 50';
  }
  if (queryLower.match(/show\s+(all\s+)?orders/) || queryLower.match(/list\s+(all\s+)?orders/)) {
    return 'MATCH (o:Order) RETURN o LIMIT 50';
  }
  if (queryLower.match(/show\s+(all\s+)?shippers/) || queryLower.match(/list\s+(all\s+)?shippers/)) {
    return 'MATCH (s:Shipper) RETURN s LIMIT 25';
  }
  
  // Entity-specific queries based on conversation context
  if (conversationContext.lastEntityType) {
    if (queryLower.includes('detail') || queryLower.includes('more information') || queryLower.includes('show me more')) {
      // Return entity details based on last context
      if (conversationContext.lastEntityType === 'Product' && conversationContext.lastEntityName) {
        return `MATCH (p:Product {product_name: "${conversationContext.lastEntityName}"}) RETURN p`;
      } else if (conversationContext.lastEntityType === 'Customer' && conversationContext.lastEntityId) {
        return `MATCH (c:Customer {customer_id: "${conversationContext.lastEntityId}"}) RETURN c`;
      } else if (conversationContext.lastEntityType) {
        return `MATCH (n:${conversationContext.lastEntityType}) RETURN n LIMIT 25`;
      }
    }
    
    if (queryLower.includes('related') || queryLower.includes('relationship') || queryLower.includes('connected')) {
      // Return relationships based on last context
      if (conversationContext.lastEntityType === 'Product') {
        return 'MATCH (p:Product)-[r]-(n) RETURN p, r, n LIMIT 50';
      } else if (conversationContext.lastEntityType === 'Customer') {
        return 'MATCH (c:Customer)-[r]-(n) RETURN c, r, n LIMIT 50';
      } else if (conversationContext.lastEntityType) {
        return `MATCH (n:${conversationContext.lastEntityType})-[r]-(m) RETURN n, r, m LIMIT 50`;
      }
    }
  }
  
  // Default exploratory query
  return 'MATCH (n) RETURN n LIMIT 30';
};

/**
 * Call Mistral API to translate natural language to Cypher
 * @param {string} nlQuery - Natural language query
 * @returns {Promise<string>} - Cypher query
 */
const callMistralAPI = async (nlQuery) => {
  // Create a comprehensive prompt with Neo4j and Northwind schema information
  const systemPrompt = `
You are an expert in translating natural language queries about the Northwind database into Neo4j Cypher queries.

The Northwind database has the following node labels and relationships:
- Product: Properties include product_id, product_name, unit_price, units_in_stock
- Category: Properties include category_id, category_name, description
- Supplier: Properties include supplier_id, company_name, contact_name, country
- Customer: Properties include customer_id, company_name, contact_name, country
- Employee: Properties include employee_id, first_name, last_name, title, reports_to
- Order: Properties include order_id, order_date, required_date, shipped_date
- OrderDetail: Properties include order_id, product_id, unit_price, quantity, discount
- Shipper: Properties include shipper_id, company_name, phone

Relationships:
- (Category)-[:CONTAINS]->(Product)
- (Supplier)-[:SUPPLIES]->(Product)
- (Customer)-[:PLACED]->(Order)
- (Employee)-[:PROCESSED]->(Order)
- (Order)-[:INCLUDES]->(OrderDetail)
- (OrderDetail)-[:CONTAINS]->(Product)
- (Employee)-[:REPORTS_TO]->(Employee)
- (Order)-[:SHIPPED_VIA]->(Shipper)

Previous conversation context: ${JSON.stringify(conversationContext)}

IMPORTANT: Generate only the Cypher query, nothing else. Do not include explanations or markdown formatting.
Make sure the query is valid Cypher for Neo4j. Always include relationship information in the MATCH clauses when possible.
`;

  try {
    console.log('Attempting to call Mistral API...');
    
    // Check if we're in quota limit or if query can be handled by patterns
    const queryLower = nlQuery.toLowerCase().trim();
    
    // Don't call API for very simple queries that pattern matching can handle
    if (queryLower.match(/show\s+(all\s+)?(products|categories|customers|suppliers|employees|orders|shippers)/)) {
      console.log('Using pattern matching for simple listing query');
      return generatePatternQuery(nlQuery);
    }
    
    // Create request payload for Mistral API
    const payload = {
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Translate this query to Cypher: "${nlQuery}"`
        }
      ],
      temperature: 0.1,
      top_p: 0.95,
      max_tokens: 1024
    };
    
    // Make API request to Mistral
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log('API response status:', response.status);
    
    // Handle quota limits or other API errors
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mistral API error details:', errorData);
      
      // If we hit quota limits (429 error) or any other error, use pattern matching
      if (response.status === 429) {
        console.log('API quota limit reached, using pattern matching');
        return generatePatternQuery(nlQuery);
      }
      
      throw new Error(`Mistral API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    console.log('Mistral API response received');
    
    // Extract the generated text from Mistral's response format
    const generatedText = data.choices?.[0]?.message?.content;
    
    if (!generatedText) {
      console.warn('No text in Mistral response, falling back to pattern matching');
      return generatePatternQuery(nlQuery);
    }
    
    // Clean up the response - sometimes LLMs return markdown code blocks
    const cleanedQuery = generatedText
      .replace(/```cypher\s*/g, '')
      .replace(/```\s*$/g, '')
      .replace(/```sql\s*/g, '')
      .trim();
    
    return cleanedQuery;
  } catch (error) {
    console.error('Error calling Mistral API:', error);
    
    // If API fails for any reason, use pattern matching
    return generatePatternQuery(nlQuery);
  }
};

/**
 * Update conversation context based on query and results
 */
const updateConversationContext = (nlQuery, cypherQuery) => {
  // Extract entity type from Cypher query
  if (cypherQuery.includes(':Product')) {
    conversationContext.lastEntityType = 'Product';
  } else if (cypherQuery.includes(':Category')) {
    conversationContext.lastEntityType = 'Category';
  } else if (cypherQuery.includes(':Supplier')) {
    conversationContext.lastEntityType = 'Supplier';
  } else if (cypherQuery.includes(':Customer')) {
    conversationContext.lastEntityType = 'Customer';
  } else if (cypherQuery.includes(':Employee')) {
    conversationContext.lastEntityType = 'Employee';
  } else if (cypherQuery.includes(':Order')) {
    conversationContext.lastEntityType = 'Order';
  } else if (cypherQuery.includes(':OrderDetail')) {
    conversationContext.lastEntityType = 'OrderDetail';
  } else if (cypherQuery.includes(':Shipper')) {
    conversationContext.lastEntityType = 'Shipper';
  }

  // Extract entity IDs/names from Cypher query
  const productIdMatch = cypherQuery.match(/product_id:\s*(\d+)/i);
  if (productIdMatch) {
    conversationContext.lastEntityId = parseInt(productIdMatch[1]);
    conversationContext.lastEntityType = 'Product';
  }

  const productNameMatch = cypherQuery.match(/product_name:\s*"([^"]+)"/i);
  if (productNameMatch) {
    conversationContext.lastEntityName = productNameMatch[1];
    conversationContext.lastEntityType = 'Product';
  }

  const categoryNameMatch = cypherQuery.match(/category_name:\s*"([^"]+)"/i);
  if (categoryNameMatch) {
    conversationContext.lastEntityName = categoryNameMatch[1];
    conversationContext.lastEntityType = 'Category';
  }

  const customerIdMatch = cypherQuery.match(/customer_id:\s*"([^"]+)"/i);
  if (customerIdMatch) {
    conversationContext.lastEntityId = customerIdMatch[1];
    conversationContext.lastEntityType = 'Customer';
  }

  const orderIdMatch = cypherQuery.match(/order_id:\s*(\d+)/i);
  if (orderIdMatch) {
    conversationContext.lastEntityId = parseInt(orderIdMatch[1]);
    conversationContext.lastEntityType = 'Order';
  }

  // Extract relationship types from Cypher query
  if (cypherQuery.includes('CONTAINS')) {
    if (cypherQuery.includes(':Category') && cypherQuery.includes(':Product')) {
      conversationContext.lastRelationship = 'CATEGORY_PRODUCT';
    } else if (cypherQuery.includes(':OrderDetail') && cypherQuery.includes(':Product')) {
      conversationContext.lastRelationship = 'ORDER_DETAILS';
    }
  } else if (cypherQuery.includes('SUPPLIES')) {
    conversationContext.lastRelationship = 'SUPPLIER_PRODUCT';
  } else if (cypherQuery.includes('PLACED')) {
    conversationContext.lastRelationship = 'CUSTOMER_ORDER';
  } else if (cypherQuery.includes('PROCESSED')) {
    conversationContext.lastRelationship = 'EMPLOYEE_ORDER';
  } else if (cypherQuery.includes('REPORTS_TO')) {
    conversationContext.lastRelationship = 'EMPLOYEE_HIERARCHY';
  } else if (cypherQuery.includes('SHIPPED_VIA')) {
    conversationContext.lastRelationship = 'ORDER_SHIPPER';
  }

  // Extract limit from Cypher query
  const limitMatch = cypherQuery.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    conversationContext.lastLimit = parseInt(limitMatch[1]);
  }

  // For debugging
  console.log('Updated conversation context:', conversationContext);
};

/**
 * Clear conversation context
 * Call this when starting a new conversation
 */
export const clearConversationContext = () => {
  conversationContext = {
    lastEntityType: null,
    lastEntityId: null,
    lastEntityName: null,
    lastRelationship: null,
    lastAggregation: null,
    lastLimit: 25
  };
  console.log('Conversation context cleared');
};

/**
 * Main function to translate natural language to Cypher
 * @param {string} nlQuery - Natural language query
 * @returns {Promise<string>} - Cypher query
 */
export const translateToCypher = async (nlQuery) => {
  try {
    // Process query and handle API quota limits
    const cypherQuery = await callMistralAPI(nlQuery);
    
    // Update conversation context
    updateConversationContext(nlQuery, cypherQuery);
    
    return cypherQuery;
  } catch (error) {
    console.error('Translation error:', error);
    // Use pattern matching as final fallback
    return generatePatternQuery(nlQuery);
  }
};

// Default export
export default {
  translateToCypher,
  clearConversationContext
};

 