import { useRef, useEffect } from 'react'

export function SimpleGraph({ data, onNodeClick }) {
  const canvasRef = useRef(null)
  
  useEffect(() => {
    if (!canvasRef.current || !data || !data.nodes || !data.links) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    
    // Clear canvas
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(0, 0, width, height)
    
    // Simple force-directed layout
    const nodes = [...data.nodes]
    const links = [...data.links]
    
    // Initialize positions randomly if not set
    nodes.forEach(node => {
      if (typeof node.x !== 'number') node.x = Math.random() * width
      if (typeof node.y !== 'number') node.y = Math.random() * height
    })
    
    // Draw links
    ctx.strokeStyle = '#555'
    ctx.lineWidth = 1
    links.forEach(link => {
      const source = nodes.find(n => n.id === link.source) || 
                    nodes.find(n => n.id === link.source.id)
      const target = nodes.find(n => n.id === link.target) || 
                    nodes.find(n => n.id === link.target.id)
      
      if (source && target) {
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.stroke()
        
        // Draw relationship type at the middle
        if (link.label) {
          const midX = (source.x + target.x) / 2
          const midY = (source.y + target.y) / 2
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
          ctx.fillRect(midX - 20, midY - 10, 40, 16)
          
          ctx.font = '10px sans-serif'
          ctx.fillStyle = 'white'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(link.label, midX, midY)
        }
      }
    })
    
    // Draw nodes
    nodes.forEach(node => {
      // Node circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI)
      ctx.fillStyle = node.color || '#ccc'
      ctx.fill()
      
      // Node label
      ctx.font = '12px sans-serif'
      ctx.fillStyle = 'white'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(node.label || 'Node', node.x, node.y - 16)
      
      // Property display
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
      
      if (primaryProperty) {
        ctx.fillText(primaryProperty, node.x, node.y + 16)
      }
    })
    
    // Handle node click
    function handleClick(event) {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      
      // Check if a node was clicked
      for (let node of nodes) {
        const dx = node.x - x
        const dy = node.y - y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance <= 8) {
          onNodeClick && onNodeClick(node)
          return
        }
      }
    }
    
    canvas.addEventListener('click', handleClick)
    
    return () => {
      canvas.removeEventListener('click', handleClick)
    }
  }, [data, onNodeClick])
  
  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={600} 
      className="w-full h-full"
    />
  )
} 