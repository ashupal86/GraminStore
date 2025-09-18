import React, { useState } from 'react';
import { apiService } from '../services/api';

interface AddPlatformUserModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUserAdded: (user: {id:number; name:string; email:string; phone:string}) => void;
  merchantId: number;
}

const AddPlatformUserModal: React.FC<AddPlatformUserModalProps> = ({
  isVisible,
  onClose,
  onUserAdded,
  merchantId
}) => {
  const [phoneInput, setPhoneInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<{id:number; name:string; email:string; phone:string} | null>(null);
  const [searchResults, setSearchResults] = useState<{id:number; name:string; email:string; phone:string}[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const handleSearch = async (phone: string) => {
    if (!phone.trim() || phone.length < 5) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    setLookupError(null);
    setLookupResult(null);
    setSuccessMessage(null);
    setLookupLoading(true);
    
    try {
      const results = await apiService.searchUsersByPhone(phone, 10);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err: any) {
      setLookupError(err?.message || 'Search failed');
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookup = async () => {
    if (!phoneInput.trim()) return;
    
    setLookupError(null);
    setLookupResult(null);
    setSuccessMessage(null);
    setLookupLoading(true);
    
    try {
      const result = await apiService.lookupUserByPhone(phoneInput);
      setLookupResult(result);
      setShowSearchResults(false);
    } catch (err: any) {
      setLookupError(err?.message || 'User not found');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSelectUser = (user: {id:number; name:string; email:string; phone:string}) => {
    setLookupResult(user);
    setPhoneInput(user.phone);
    setShowSearchResults(false);
    setSearchResults([]);
  };

  const handleAddUser = () => {
    if (lookupResult) {
      onUserAdded(lookupResult);
      setSuccessMessage(`${lookupResult.name} has been added successfully!`);
      
      // Reset form after a short delay
      setTimeout(() => {
        setPhoneInput('');
        setLookupResult(null);
        setLookupError(null);
        setSuccessMessage(null);
        setSearchResults([]);
        setShowSearchResults(false);
        onClose();
      }, 1500);
    }
  };

  const handleInputChange = (value: string) => {
    setPhoneInput(value);
    setLookupResult(null);
    setLookupError(null);
    setSuccessMessage(null);
    
    // Trigger search when user types 5 or more digits
    if (value.length >= 5) {
      handleSearch(value);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Add Platform User
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
        <div className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone Number
              </label>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Type 5+ digits to search: Try 76202, 98765, or 01032
              </div>
              <div className="flex space-x-2">
                <input
                  type="tel"
                  placeholder="Enter phone number (e.g., 9876543210 or +919876543210)"
                  value={phoneInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  pattern="[0-9+\-\s()]+"
                  title="Enter a valid phone number"
                />
                <button
                  disabled={!phoneInput || lookupLoading}
                  onClick={handleLookup}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {lookupLoading ? 'Searching...' : 'Lookup'}
                </button>
              </div>
              {lookupError && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-red-500">⚠️</span>
                    <div>
                      <div className="text-sm font-medium text-red-800 dark:text-red-200">
                        User Not Found
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-300">
                        No platform user found with phone number: {phoneInput}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {successMessage && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✅</span>
                  <div className="text-sm font-medium text-green-800 dark:text-green-200">
                    {successMessage}
                  </div>
                </div>
              </div>
            )}

            {showSearchResults && searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                <div className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                  Found {searchResults.length} matching user{searchResults.length !== 1 ? 's' : ''}:
                </div>
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user.phone} • {user.email}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        ID: {user.id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showSearchResults && searchResults.length === 0 && !lookupLoading && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-500">🔍</span>
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    No users found matching "{phoneInput}"
                  </div>
                </div>
              </div>
            )}

            {lookupResult && (
              <div className="p-4 border border-green-200 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 font-semibold text-lg">
                      {lookupResult.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {lookupResult.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      User ID: {lookupResult.id}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16">Phone:</span>
                    <span className="text-sm text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {lookupResult.phone}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16">Email:</span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {lookupResult.email}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={handleAddUser}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <span>✓</span>
                  <span>Add to Shop & Use</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPlatformUserModal;
