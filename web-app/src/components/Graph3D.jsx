import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as d3 from 'd3'
import Stats from 'stats.js'

export function Graph3D({ data, onNodeClick }) {
  const containerRef = useRef(null)
  const statsRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [tooltipInfo, setTooltipInfo] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  // Theme colors
  const themeColors = {
    dark: {
      background: 0x0a0a0a,
      nodeDefault: 0x888888,
      nodeHighlight: 0xffffff,
      linkDefault: 0x666666,
      linkHighlight: 0xffffff,
      labelBg: 'rgba(20, 20, 20, 0.9)',
      labelText: 'rgba(255, 255, 255, 0.9)',
      labelBorder: 'rgba(255, 255, 255, 0.2)',
      tooltipBg: 'bg-gray-900',
      tooltipText: 'text-white',
      tooltipBorder: 'border-blue-500'
    },
    light: {
      background: 0xffffff,
      nodeDefault: 0x1a56db, // Neo4j blue
      nodeHighlight: 0x2563eb,
      linkDefault: 0x93c5fd, // Light blue
      linkHighlight: 0x3b82f6,
      labelBg: 'rgba(255, 255, 255, 0.95)',
      labelText: 'rgba(17, 24, 39, 0.9)',
      labelBorder: 'rgba(17, 24, 39, 0.2)',
      tooltipBg: 'bg-white',
      tooltipText: 'text-gray-900',
      tooltipBorder: 'border-gray-200'
    }
  }

  // Cleanup function to properly dispose of Three.js objects
  const cleanup = useCallback(() => {
    if (sceneRef.current) {
      // Dispose of all geometries and materials
      sceneRef.current.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose()
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
      sceneRef.current.clear()
    }
    
    if (rendererRef.current) {
      rendererRef.current.dispose()
    }
    
    if (controlsRef.current) {
      controlsRef.current.dispose()
    }
    
    if (statsRef.current) {
      statsRef.current.dom.remove()
    }
  }, [])

  // Initialize scene and objects
  useEffect(() => {
    if (!containerRef.current || !data || !data.nodes || !data.links) return
    
    // Cleanup previous scene
    cleanup()
    
    // Clear container
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild)
    }
    
    // Performance stats
    const stats = new Stats()
    stats.showPanel(0)
    stats.dom.style.position = 'absolute'
    stats.dom.style.top = '0px'
    stats.dom.style.left = '0px'
    stats.dom.style.zIndex = '100'
    stats.dom.style.opacity = '0.6'
    stats.dom.style.display = debugMode ? 'block' : 'none'
    containerRef.current.appendChild(stats.dom)
    statsRef.current = stats
    
    // Scene setup
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(themeColors.light.background)
    sceneRef.current = scene
    
    // Add subtle fog for depth
    scene.fog = new THREE.Fog(
      themeColors.light.background,
      150,
      400
    )
    
    // Camera setup with better initial position
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.z = 150
    camera.position.y = 30
    
    // Renderer setup with better quality
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer
    
    // Add OrbitControls for better interaction
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = true
    controls.minDistance = 60
    controls.maxDistance = 300
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
    controlsRef.current = controls
    
    // Enhanced lighting
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.7)
    scene.add(ambientLight)
    
    // Directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7)
    directionalLight.position.set(100, 100, 100)
    directionalLight.castShadow = true
    // Improve shadow quality
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5 
    directionalLight.shadow.camera.far = 500
    directionalLight.shadow.bias = -0.0001
    scene.add(directionalLight)
    
    // Debug helper for light
    const lightHelper = new THREE.DirectionalLightHelper(directionalLight, 10)
    lightHelper.visible = debugMode
    scene.add(lightHelper)
    
    // Add a soft point light for better depth
    const pointLight = new THREE.PointLight(0x6495ED, 0.8, 200)
    pointLight.position.set(-50, 50, 50)
    scene.add(pointLight)
    
    // Add subtle hemisphere light for better color variation
    const hemisphereLight = new THREE.HemisphereLight(0x606060, 0x404040, 0.6)
    scene.add(hemisphereLight)
    
    // Keep track of nodes and links objects
    const nodeObjects = new Map()
    const linkObjects = new Map()
    
    // Node size based on connections
    const nodeDegrees = new Map()
    data.links.forEach(link => {
      const source = typeof link.source === 'object' ? link.source.id : link.source
      const target = typeof link.target === 'object' ? link.target.id : link.target
      
      nodeDegrees.set(source, (nodeDegrees.get(source) || 0) + 1)
      nodeDegrees.set(target, (nodeDegrees.get(target) || 0) + 1)
    })
    
    // Create 3D objects for nodes with improved visuals
    data.nodes.forEach(node => {
      const degree = nodeDegrees.get(node.id) || 1
      // Even more subtle node size scaling
      const nodeSize = 1.5 + Math.min(Math.sqrt(degree) * 0.5, 3)
      
      const geometry = new THREE.SphereGeometry(nodeSize, 16, 16)
      const material = new THREE.MeshPhysicalMaterial({ 
        color: node.color || themeColors.light.nodeDefault,
        metalness: 0.1,
        roughness: 0.8,
        reflectivity: 0.3,
        clearcoat: 0.2,
        emissive: 0x000000,
        emissiveIntensity: 0
      })
      
      const sphere = new THREE.Mesh(geometry, material)
      sphere.position.x = node.x || (Math.random() - 0.5) * 80
      sphere.position.y = node.y || (Math.random() - 0.5) * 80
      sphere.position.z = node.z || (Math.random() - 0.5) * 80
      
      sphere.castShadow = true
      sphere.receiveShadow = true
      
      // Very subtle glow effect
      const glowGeometry = new THREE.SphereGeometry(nodeSize * 1.1, 16, 16)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: node.color || themeColors.light.nodeDefault,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide
      })
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)
      glowMesh.position.copy(sphere.position)
      scene.add(glowMesh)
      
      // Store node data with enhanced properties
      sphere.userData = { 
        ...node, 
        glow: glowMesh,
        originalScale: nodeSize,
        originalColor: node.color || themeColors.light.nodeDefault,
        degree: degree,
        connectedNodes: new Set(),
        hoverState: false
      }
      
      scene.add(sphere)
      nodeObjects.set(node.id, sphere)
      
      // Create minimalistic text label
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = 192
      canvas.height = 96
      
      // Clean, minimal background with better contrast
      context.fillStyle = themeColors.light.labelBg
      context.fillRect(0, 0, canvas.width, canvas.height)
      
      // Add subtle border
      context.strokeStyle = themeColors.light.labelBorder
      context.lineWidth = 1
      context.strokeRect(0, 0, canvas.width, canvas.height)
      
      // Text styling with better visibility
      context.fillStyle = themeColors.light.labelText
      context.font = 'bold 18px "JetBrains Mono", monospace'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      
      // Draw node label
      const label = node.label || 'Node'
      context.fillText(label, canvas.width / 2, canvas.height / 2 - 12)
      
      // Draw primary property with subtle styling
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
        } else if (node.properties.first_name && node.properties.last_name) {
          primaryProperty = `${node.properties.first_name} ${node.properties.last_name}`
        }
      }
      
      if (primaryProperty) {
        context.font = '14px "JetBrains Mono", monospace'
        context.fillStyle = themeColors.light.labelText
        
        // Truncate if too long
        if (primaryProperty.length > 20) {
          primaryProperty = primaryProperty.substring(0, 17) + '...'
        }
        
        context.fillText(primaryProperty, canvas.width / 2, canvas.height / 2 + 12)
      }
      
      // Create texture and sprite
      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        opacity: 0.9
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.scale.set(24, 12, 1)
      sprite.position.set(sphere.position.x, sphere.position.y + nodeSize + 6, sphere.position.z)
      sprite.visible = false // Initially hidden, show on hover
      
      scene.add(sprite)
      sphere.label = sprite
    })
    
    // Create 3D objects for links with improved visuals
    data.links.forEach((link, index) => {
      const sourceObj = nodeObjects.get(typeof link.source === 'object' ? link.source.id : link.source)
      const targetObj = nodeObjects.get(typeof link.target === 'object' ? link.target.id : link.target)
      
      if (sourceObj && targetObj) {
        // Update connected nodes sets
        sourceObj.userData.connectedNodes.add(targetObj.userData.id)
        targetObj.userData.connectedNodes.add(sourceObj.userData.id)
        
        // Get link color with default fallback
        let linkColor = themeColors.light.linkDefault
        if (link.label && link.label.color) {
          linkColor = link.label.color
        }
        
        // Create curved line for better visibility
        const curve = new THREE.QuadraticBezierCurve3(
          sourceObj.position,
          new THREE.Vector3(
            (sourceObj.position.x + targetObj.position.x) / 2,
            (sourceObj.position.y + targetObj.position.y) / 2 + 10,
            (sourceObj.position.z + targetObj.position.z) / 2
          ),
          targetObj.position
        )
        
        const points = curve.getPoints(50)
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        
        const material = new THREE.LineBasicMaterial({
          color: linkColor,
          transparent: true,
          opacity: 0.4, // Increased default opacity
          linewidth: 2
        })
        
        const line = new THREE.Line(geometry, material)
        
        // Store link data with curve information
        line.userData = {
          source: sourceObj.userData.id,
          target: targetObj.userData.id,
          originalOpacity: 0.4,
          color: linkColor,
          curve: curve
        }
        
        scene.add(line)
        linkObjects.set(`${sourceObj.userData.id}-${targetObj.userData.id}`, line)
        
        // Create minimalistic text label for relationship type
        if (link.label) {
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.width = 144
          canvas.height = 48
          
          // Clean, minimal background with better contrast
          context.fillStyle = themeColors.light.labelBg
          context.fillRect(0, 0, canvas.width, canvas.height)
          
          // Add subtle border
          context.strokeStyle = themeColors.light.labelBorder
          context.lineWidth = 1
          context.strokeRect(0, 0, canvas.width, canvas.height)
          
          // Text styling with better visibility
          context.fillStyle = themeColors.light.labelText
          context.font = 'bold 14px "JetBrains Mono", monospace'
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          
          // Draw relationship type with null check
          const labelText = typeof link.label === 'string' ? link.label : 
                           (link.label && link.label.type ? link.label.type : 'RELATES_TO')
          context.fillText(labelText, canvas.width / 2, canvas.height / 2)
          
          // Create texture and sprite
          const texture = new THREE.CanvasTexture(canvas)
          const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            opacity: 0.9
          })
          const sprite = new THREE.Sprite(spriteMaterial)
          sprite.scale.set(9, 3, 1)
          
          // Position at the middle of the curve
          const midPoint = curve.getPoint(0.5)
          sprite.position.copy(midPoint)
          
          scene.add(sprite)
          line.label = sprite
          sprite.visible = true
        }
      }
    })
    
    // Since d3.forceZ is not available, we'll manually add z-positioning
    data.nodes.forEach(node => {
      node.z = node.z || (Math.random() - 0.5) * 100
    })
    
    // Set up D3 force simulation with improved physics
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(80).strength(0.7))
      .force('charge', d3.forceManyBody().strength(-200).distanceMax(250).distanceMin(20))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(20).strength(0.8))
      // Add 3D forces
      .force('x', d3.forceX().strength(0.1))
      .force('y', d3.forceY().strength(0.1))
      
      // Update positions on each simulation tick
      .on('tick', () => {
        // Update node positions
        nodeObjects.forEach((obj, id) => {
          const node = data.nodes.find(n => n.id === id)
          if (!node) return
          
          // Apply position with damping for smoother transitions
          obj.position.x += (node.x - obj.position.x) * 0.1
          obj.position.y += (node.y - obj.position.y) * 0.1
          obj.position.z += (node.z - obj.position.z) * 0.1
          
          // Update label and glow positions
          if (obj.label) {
            obj.label.position.set(
              obj.position.x, 
              obj.position.y + obj.userData.originalScale + 10, 
              obj.position.z
            )
          }
          
          if (obj.userData.glow) {
            obj.userData.glow.position.copy(obj.position)
          }
        })
        
        // Update link positions with curve
        linkObjects.forEach((linkData) => {
          const { line, source, target, curve } = linkData
          
          // Update curve control points
          const mid = new THREE.Vector3(
            (source.position.x + target.position.x) / 2,
            (source.position.y + target.position.y) / 2 + 10,
            (source.position.z + target.position.z) / 2
          )
          
          curve.v0.copy(source.position)
          curve.v1.copy(mid)
          curve.v2.copy(target.position)
          
          // Update line geometry
          const points = curve.getPoints(70)
          line.geometry.setFromPoints(points)
          line.geometry.attributes.position.needsUpdate = true
          
          // Update relationship label position
          if (line.label) {
            const midPoint = curve.getPoint(0.5)
            line.label.position.set(midPoint.x, midPoint.y, midPoint.z)
          }
        })
      })
    
    // Run simulation for longer with gradual cooling
    simulation.alpha(1).restart()
    
    // Function to format property values for tooltip
    const formatPropertyValue = (value) => {
      if (typeof value === 'number') {
        return value % 1 === 0 ? value.toString() : value.toFixed(2)
      }
      if (value instanceof Date) {
        return value.toLocaleDateString()
      }
      return value?.toString() || ''
    }
    
    // Function to create tooltip content for React
    const createTooltipData = (node) => {
      if (!node?.userData?.properties) return null
      
      const props = node.userData.properties
      const nodeType = node.userData.label
      
      // Collect primary identifier based on node type
      let primaryId = ''
      if (props.product_name) primaryId = props.product_name
      else if (props.company_name) primaryId = props.company_name
      else if (props.category_name) primaryId = props.category_name
      else if (props.customer_id) primaryId = props.customer_id
      else if (props.first_name && props.last_name) primaryId = `${props.first_name} ${props.last_name}`
      
      // Collect properties for display
      const displayProperties = Object.entries(props)
        .filter(([key]) => 
          key !== 'product_name' && 
          key !== 'company_name' && 
          key !== 'category_name' && 
          key !== 'first_name' && 
          key !== 'last_name' && 
          key !== 'customer_id'
        )
        .map(([key, value]) => ({
          key: key.replace(/_/g, ' '),
          value: formatPropertyValue(value)
        }))
        .filter(item => item.value)
      
      return {
        nodeType,
        primaryId,
        properties: displayProperties
      }
    }
    
    // Enhanced mouse move handler with Neo4j-like hover effects
    const handleMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera({ x, y }, camera)
      
      const intersects = raycaster.intersectObjects(Array.from(nodeObjects.values()))
      
      // Reset previous hover states
      nodeObjects.forEach(node => {
        if (node.userData.hoverState) {
          node.userData.hoverState = false
          node.material.emissiveIntensity = 0
          node.material.color.setHex(themeColors.light.nodeDefault)
          node.scale.setScalar(node.userData.originalScale)
          
          if (node.userData.glow) {
            node.userData.glow.material.opacity = 0
          }
          
          if (node.label) {
            node.label.visible = false
          }
        }
      })
      
      // Reset link opacities
      linkObjects.forEach(link => {
        if (link && link.material) {
          link.material.opacity = 0.5
          link.material.color.setHex(themeColors.light.linkDefault)
        }
      })
      
      if (intersects.length > 0) {
        const hoveredNode = intersects[0].object
        hoveredNode.userData.hoverState = true
        
        // Neo4j-like hover effect
        hoveredNode.material.emissiveIntensity = 0.1
        hoveredNode.material.color.setHex(themeColors.light.nodeHighlight)
        hoveredNode.scale.setScalar(hoveredNode.userData.originalScale * 1.1)
        
        if (hoveredNode.userData.glow) {
          hoveredNode.userData.glow.material.opacity = 0
        }
        
        if (hoveredNode.label) {
          hoveredNode.label.visible = true
        }
        
        // Highlight connected nodes and links
        hoveredNode.userData.connectedNodes.forEach(connectedId => {
          const connectedNode = nodeObjects.get(connectedId)
          if (connectedNode) {
            connectedNode.material.emissiveIntensity = 0.05
            connectedNode.material.color.setHex(themeColors.light.nodeHighlight)
          }
          
          const link = linkObjects.get(`${hoveredNode.userData.id}-${connectedId}`) || 
                      linkObjects.get(`${connectedId}-${hoveredNode.userData.id}`)
          if (link && link.material) {
            link.material.opacity = 0.8
            link.material.color.setHex(themeColors.light.linkHighlight)
          }
        })
        
        // Update tooltip
        const tooltipData = createTooltipData(hoveredNode.userData)
        setTooltipInfo({
          position: { x: event.clientX, y: event.clientY },
          data: tooltipData
        })
      } else {
        setTooltipInfo(null)
      }
    }
    
    renderer.domElement.addEventListener('mousemove', handleMouseMove)
    
    // Handle clicks for node selection with enhanced feedback
    renderer.domElement.addEventListener('click', (event) => {
      if (hoveredNode) {
        // Provide visual feedback for click
        const originalColor = hoveredNode.material.color.clone()
        hoveredNode.material.color.set(0xffffff)
        
        // Pulse animation for the glow
        if (hoveredNode.userData.glow) {
          const originalOpacity = hoveredNode.userData.glow.material.opacity
          hoveredNode.userData.glow.material.opacity = 1.0
          
          // Reset after animation
          setTimeout(() => {
            if (hoveredNode) {
              hoveredNode.material.color.copy(originalColor)
              if (hoveredNode.userData.glow) {
                hoveredNode.userData.glow.material.opacity = originalOpacity
              }
            }
          }, 300)
        }
        
        // Call the click handler
        onNodeClick && onNodeClick(hoveredNode.userData)
      }
    })
    
    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return
      
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight
      
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      
      renderer.setSize(newWidth, newHeight)
    }
    
    window.addEventListener('resize', handleResize)
    
    // Animation loop with controls update
    const animate = () => {
      if (statsRef.current) {
        statsRef.current.begin()
      }
      
      requestAnimationFrame(animate)
      if (controlsRef.current) {
        controlsRef.current.update() // Required for damping and auto-rotation
      }
      
      // Add gentle random movement to nodes for more lively appearance
      nodeObjects.forEach((node, id) => {
        // Don't apply to hovered node
        if (hoveredNode === node) return
        
        // Small random movement to add "life" to the visualization
        const time = Date.now() * 0.001
        const nodeIndex = parseInt(id) || 0
        const randomOffset = Math.sin(time + nodeIndex) * 0.07
        
        node.position.y += randomOffset * 0.05
        
        // Update glow effect
        if (node.userData && node.userData.glow) {
          node.userData.glow.position.copy(node.position)
        }
        
        // Update label position
        if (node.label) {
          node.label.position.set(
            node.position.x, 
            node.position.y + node.userData.originalScale + 10, 
            node.position.z
          )
        }
      })
      
      if (rendererRef.current && sceneRef.current && camera) {
        rendererRef.current.render(sceneRef.current, camera)
      }
      
      if (statsRef.current) {
        statsRef.current.end()
      }
    }
    
    animate()
    
    // Cleanup on unmount
    return () => {
      cleanup()
    }
  }, [data, debugMode, cleanup])
  
  // Toggle debug mode
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prevMode => !prevMode)
  }, [])

  // Toggle theme with immediate background update
  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      const newMode = !prev
      if (sceneRef.current) {
        sceneRef.current.background = new THREE.Color(
          themeColors[newMode ? 'dark' : 'light'].background
        )
        sceneRef.current.fog.color = new THREE.Color(
          themeColors[newMode ? 'dark' : 'light'].background
        )
      }
      return newMode
    })
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Controls container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="bg-white text-gray-900 px-3 py-2 rounded text-sm font-mono border border-gray-200 hover:bg-gray-50"
          style={{
            minWidth: '120px'
          }}
        >
          {isDarkMode ? (
            <>
              <span className="text-lg">☀️</span>
              <span className="font-mono ml-2">Light</span>
            </>
          ) : (
            <>
              <span className="text-lg">🌙</span>
              <span className="font-mono ml-2">Dark</span>
            </>
          )}
        </button>

        {/* Debug button */}
        <button
          onClick={toggleDebugMode}
          className="bg-white text-gray-900 px-3 py-2 rounded text-sm font-mono border border-gray-200 hover:bg-gray-50"
          style={{
            minWidth: '120px'
          }}
        >
          <span className="font-mono">{debugMode ? 'Hide Debug' : 'Debug'}</span>
        </button>
      </div>

      {/* Tooltip */}
      {tooltipInfo && (
        <div 
          className="fixed z-[9998] bg-white text-gray-900 p-3 rounded border border-gray-200 pointer-events-none max-w-md font-mono"
          style={{
            left: tooltipInfo.position.x + 15,
            top: tooltipInfo.position.y + 15,
            transition: 'opacity 0.1s',
            opacity: 1
          }}
        >
          {tooltipInfo.data && (
            <>
              <div className="font-bold text-sm mb-1 text-blue-600">{tooltipInfo.data.nodeType}</div>
              
              {tooltipInfo.data.primaryId && (
                <div className="text-sm font-semibold mb-2 text-gray-900">{tooltipInfo.data.primaryId}</div>
              )}
              
              {tooltipInfo.data.properties.length > 0 && (
                <table className="w-full text-xs">
                  <tbody>
                    {tooltipInfo.data.properties.map((prop, i) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-1 pr-2 text-gray-600">{prop.key}:</td>
                        <td className="py-1 text-gray-900">{prop.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Debug panel */}
      {debugMode && (
        <div 
          className="fixed bottom-4 left-4 z-[9998] bg-white text-gray-900 p-3 rounded border border-gray-200 font-mono"
        >
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Nodes:</span>
              <span className="text-gray-900">{data.nodes.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Links:</span>
              <span className="text-gray-900">{data.links.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Hovered:</span>
              <span className="text-gray-900">{hoveredNode ? hoveredNode.userData.label : 'None'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 