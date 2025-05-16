export function GraphControls({ viewMode, onViewModeChange }) {
  return (
    <div className="mb-4 flex justify-end">
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
  )
} 