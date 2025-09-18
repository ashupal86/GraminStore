import React from 'react';

interface CalculationEntry {
  id: string;
  expression: string;
  result: number;
  timestamp: Date;
  isCorrect?: boolean;
}

interface CalculationHistoryProps {
  isVisible: boolean;
  onClose: () => void;
  history: CalculationEntry[];
  onCheckCalculation: (index: number) => void;
  onUseResult: (result: number) => void;
}

const CalculationHistory: React.FC<CalculationHistoryProps> = ({
  isVisible,
  onClose,
  history,
  onCheckCalculation,
  onUseResult
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Calculation History
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-96">
          {history.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No calculations yet
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    entry.isCorrect === true
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : entry.isCorrect === false
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-mono text-sm text-gray-900 dark:text-white">
                        {entry.expression}
                      </div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        = ₹{entry.result.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onCheckCalculation(index)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          entry.isCorrect === true
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : entry.isCorrect === false
                            ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-700'
                        }`}
                      >
                        {entry.isCorrect === true ? '✓ Correct' : 
                         entry.isCorrect === false ? '✗ Wrong' : 'Check'}
                      </button>
                      <button
                        onClick={() => onUseResult(entry.result)}
                        className="px-3 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalculationHistory;
