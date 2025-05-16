import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import * as d3 from 'd3'

export function Graph3D({ data, onNodeClick }) {
  const containerRef = useRef(null)
  
  useEffect(() => {
    if (!containerRef.current || !data || !data.nodes || !data.links) return
    
    // Clear previous content
    containerRef.current.innerHTML = ''
    
    // Scene setup
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const scene = new THREE.Scene()
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 200
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setClearColor(0x1f2937)
    containerRef.current.appendChild(renderer.domElement)
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight.position.set(0, 0, 1)
    scene.add(directionalLight)
    
    // Controls for mouse interaction
    let isDragging = false
    let previousMousePosition = {
      x: 0,
      y: 0
    }
    
    // Keep track of nodes and links objects
    const nodeObjects = new Map()
    const linkObjects = new Map()
    
    // Create 3D objects for nodes
    data.nodes.forEach(node => {
      // Node sphere
      const geometry = new THREE.SphereGeometry(5, 32, 32)
      const material = new THREE.MeshLambertMaterial({ 
        color: node.color || 0xcccccc 
      })
      const sphere = new THREE.Mesh(geometry, material)
      
      // Initialize with random position if not set
      sphere.position.x = node.x || (Math.random() - 0.5) * 100
      sphere.position.y = node.y || (Math.random() - 0.5) * 100
      sphere.position.z = node.z || (Math.random() - 0.5) * 100
      
      // Store original data with the object
      sphere.userData = node
      
      // Add to scene
      scene.add(sphere)
      
      // Add to mapping
      nodeObjects.set(node.id, sphere)
      
      // Text label
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = 256
      canvas.height = 128
      
      // Background color
      context.fillStyle = 'rgba(0, 0, 0, 0.6)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      
      // Text color and font
      context.fillStyle = 'white'
      context.font = '24px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      
      // Draw node label
      const label = node.label || 'Node'
      context.fillText(label, canvas.width / 2, canvas.height / 2 - 15)
      
      // Draw primary property if available
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
        context.fillText(primaryProperty, canvas.width / 2, canvas.height / 2 + 15)
      }
      
      // Create texture and sprite
      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.scale.set(20, 10, 1)
      sprite.position.set(sphere.position.x, sphere.position.y + 8, sphere.position.z)
      
      // Add sprite to scene
      scene.add(sprite)
      
      // Link the sprite to the node
      sphere.label = sprite
    })
    
    // Create 3D objects for links
    data.links.forEach((link, index) => {
      const sourceObj = nodeObjects.get(typeof link.source === 'object' ? link.source.id : link.source)
      const targetObj = nodeObjects.get(typeof link.target === 'object' ? link.target.id : link.target)
      
      if (sourceObj && targetObj) {
        // Create line geometry
        const geometry = new THREE.BufferGeometry()
        const vertices = new Float32Array([
          sourceObj.position.x, sourceObj.position.y, sourceObj.position.z,
          targetObj.position.x, targetObj.position.y, targetObj.position.z
        ])
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
        
        // Create line material
        const material = new THREE.LineBasicMaterial({ color: 0xaaaaaa })
        
        // Create line
        const line = new THREE.Line(geometry, material)
        
        // Add to scene
        scene.add(line)
        
        // Add to mapping
        linkObjects.set(index, {
          line,
          source: sourceObj,
          target: targetObj,
          relationship: link.label
        })
        
        // Create text label for relationship type
        if (link.label) {
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.width = 128
          canvas.height = 64
          
          // Background color
          context.fillStyle = 'rgba(0, 0, 0, 0.6)'
          context.fillRect(0, 0, canvas.width, canvas.height)
          
          // Text color and font
          context.fillStyle = 'white'
          context.font = '16px sans-serif'
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          
          // Draw relationship type
          context.fillText(link.label, canvas.width / 2, canvas.height / 2)
          
          // Create texture and sprite
          const texture = new THREE.CanvasTexture(canvas)
          const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true })
          const sprite = new THREE.Sprite(spriteMaterial)
          sprite.scale.set(10, 5, 1)
          
          // Position at the middle of the link
          const midX = (sourceObj.position.x + targetObj.position.x) / 2
          const midY = (sourceObj.position.y + targetObj.position.y) / 2
          const midZ = (sourceObj.position.z + targetObj.position.z) / 2
          sprite.position.set(midX, midY, midZ)
          
          // Add sprite to scene
          scene.add(sprite)
          
          // Link the sprite to the line
          line.label = sprite
        }
      }
    })
    
    // Since d3.forceZ is not available, we'll manually add z-positioning
    data.nodes.forEach(node => {
      node.z = node.z || (Math.random() - 0.5) * 100
    })
    
    // Set up D3 force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(0, 0))
      .force('x', d3.forceX().strength(0.02))
      .force('y', d3.forceY().strength(0.02))
      .on('tick', () => {
        // Update node positions from simulation
        data.nodes.forEach(node => {
          const obj = nodeObjects.get(node.id)
          if (obj) {
            obj.position.x = node.x || 0
            obj.position.y = node.y || 0
            obj.position.z = node.z || 0
            
            // Update label position
            if (obj.label) {
              obj.label.position.set(obj.position.x, obj.position.y + 8, obj.position.z)
            }
          }
        })
        
        // Update link positions
        linkObjects.forEach((linkData) => {
          const { line, source, target } = linkData
          
          // Update link vertices
          const positions = line.geometry.attributes.position.array
          positions[0] = source.position.x
          positions[1] = source.position.y
          positions[2] = source.position.z
          positions[3] = target.position.x
          positions[4] = target.position.y
          positions[5] = target.position.z
          line.geometry.attributes.position.needsUpdate = true
          
          // Update relationship label position
          if (line.label) {
            const midX = (source.position.x + target.position.x) / 2
            const midY = (source.position.y + target.position.y) / 2
            const midZ = (source.position.z + target.position.z) / 2
            line.label.position.set(midX, midY, midZ)
          }
        })
        
        renderer.render(scene, camera)
      })
    
    // Run simulation for a while and then stop
    simulation.alpha(1).restart()
    setTimeout(() => simulation.stop(), 5000)
    
    // Mouse event handlers
    renderer.domElement.addEventListener('mousedown', (event) => {
      isDragging = true
      previousMousePosition = {
        x: event.clientX,
        y: event.clientY
      }
    })
    
    renderer.domElement.addEventListener('mousemove', (event) => {
      if (isDragging) {
        const deltaMove = {
          x: event.clientX - previousMousePosition.x,
          y: event.clientY - previousMousePosition.y
        }
        
        // Rotate the scene based on mouse movement
        const rotationSpeed = 0.005
        scene.rotation.y += deltaMove.x * rotationSpeed
        scene.rotation.x += deltaMove.y * rotationSpeed
        
        previousMousePosition = {
          x: event.clientX,
          y: event.clientY
        }
        
        renderer.render(scene, camera)
      }
    })
    
    renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false
    })
    
    // Handle clicks for node selection
    renderer.domElement.addEventListener('click', (event) => {
      // Calculate mouse position in normalized device coordinates (-1 to +1)
      const mouse = new THREE.Vector2()
      mouse.x = (event.clientX / width) * 2 - 1
      mouse.y = -(event.clientY / height) * 2 + 1
      
      // Raycasting for node selection
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      
      // Get objects that intersect with the ray
      const intersects = raycaster.intersectObjects(scene.children)
      
      // Check for node intersection
      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object
        if (object.userData && object.userData.id) {
          onNodeClick && onNodeClick(object.userData)
          break
        }
      }
    })
    
    // Handle window resize
    const handleResize = () => {
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight
      
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      
      renderer.setSize(newWidth, newHeight)
      renderer.render(scene, camera)
    }
    
    window.addEventListener('resize', handleResize)
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    
    animate()
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize)
      simulation.stop()
      renderer.dispose()
      
      // Dispose geometries and materials
      nodeObjects.forEach((obj) => {
        obj.geometry.dispose()
        obj.material.dispose()
        if (obj.label) {
          obj.label.material.dispose()
          obj.label.material.map.dispose()
        }
      })
      
      linkObjects.forEach(({ line }) => {
        line.geometry.dispose()
        line.material.dispose()
        if (line.label) {
          line.label.material.dispose()
          line.label.material.map.dispose()
        }
      })
    }
  }, [data, onNodeClick])
  
  return <div ref={containerRef} className="w-full h-full" />
} 