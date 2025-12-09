/**
 * Utility functions for handling user data across different entities
 * Handles inconsistency between UserPublicProfile (fullName) and User (full_name)
 */

/**
 * Gets the full name from either User or UserPublicProfile entity
 * @param {Object} userOrProfile - User or UserPublicProfile object
 * @returns {string} The user's full name or default
 */
export const getUserFullName = (userOrProfile) => {
  if (!userOrProfile) return 'User';
  
  // Support both naming conventions
  return userOrProfile.fullName || 
         userOrProfile.full_name || 
         userOrProfile.name || // Fallback for other formats
         'User';
};

/**
 * Gets user email from either User or UserPublicProfile entity
 * @param {Object} userOrProfile - User or UserPublicProfile object
 * @returns {string} The user's email
 */
export const getUserEmail = (userOrProfile) => {
  return userOrProfile?.email || '';
};

/**
 * Gets user ID from either User or UserPublicProfile entity
 * @param {Object} userOrProfile - User or UserPublicProfile object
 * @returns {string} The user's ID
 */
export const getUserId = (userOrProfile) => {
  return userOrProfile?.id || userOrProfile?.userId || '';
};

/**
 * Normalizes user data to a consistent format
 * @param {Object} userOrProfile - User or UserPublicProfile object
 * @returns {Object} Normalized user object
 */
export const normalizeUserData = (userOrProfile) => {
  if (!userOrProfile) return null;
  
  return {
    id: getUserId(userOrProfile),
    email: getUserEmail(userOrProfile),
    fullName: getUserFullName(userOrProfile),
    role: userOrProfile.role || null
  };
};