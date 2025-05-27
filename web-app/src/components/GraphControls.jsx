import { useState } from 'react'

export function GraphControls({ viewMode, onViewModeChange, nodeCount = 0, relationshipCount = 0 }) {
  const [showLegend, setShowLegend] = useState(false)
  
  // Node colors for legend
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
  
  return (
    <div className="mb-4 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <div className="bg-gray-800 rounded-lg p-2 text-xs text-gray-300">
          <span className="font-medium text-blue-400">{nodeCount}</span> nodes
          <span className="mx-1">•</span>
          <span className="font-medium text-green-400">{relationshipCount}</span> relationships
        </div>
        
        <button 
          className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 text-xs text-gray-300 transition-colors flex items-center"
          onClick={() => setShowLegend(!showLegend)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Legend
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="text-xs text-gray-400 mr-2 hidden md:block">
          <span>Drag to rotate</span>
          <span className="mx-1">•</span>
          <span>Click to explore</span>
        </div>
        
        <div className="inline-flex rounded-md shadow-sm">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
              viewMode === 'graph'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            onClick={() => onViewModeChange('graph')}
          >
            Graph View
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            onClick={() => onViewModeChange('table')}
          >
            Table View
          </button>
        </div>
      </div>
      
      {/* Node type legend */}
      {showLegend && (
        <div className="absolute top-16 left-4 z-10 bg-gray-900 bg-opacity-95 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-gray-700 text-sm animate-fadeIn">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-200">Node Types</h3>
            <button 
              onClick={() => setShowLegend(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {Object.entries(nodeColors).map(([label, color]) => (
              <div key={label} className="flex items-center">
                <span 
                  className="inline-block w-3 h-3 mr-2 rounded-full" 
                  style={{ backgroundColor: color }}
                ></span>
                <span className="text-gray-300">{label}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-2 border-t border-gray-700">
            <h3 className="font-bold text-gray-200 mb-2">Relationships</h3>
            <div className="grid grid-cols-1 gap-y-1">
              <div className="flex items-center">
                <span className="inline-block w-12 h-1 mr-2 bg-gradient-to-r from-green-400 to-green-500"></span>
                <span className="text-gray-300">CONTAINS</span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-12 h-1 mr-2 bg-gradient-to-r from-blue-400 to-blue-500"></span>
                <span className="text-gray-300">SUPPLIES</span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-12 h-1 mr-2 bg-gradient-to-r from-orange-400 to-orange-500"></span>
                <span className="text-gray-300">PLACED</span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-12 h-1 mr-2 bg-gradient-to-r from-purple-400 to-purple-500"></span>
                <span className="text-gray-300">PROCESSED/REPORTS_TO</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 