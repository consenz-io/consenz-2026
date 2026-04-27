/**
 * Page Name Validator
 * Ensures consistency of page names throughout the application
 * Prevents typos and case inconsistencies
 */

import { PAGE_NAMES } from './pageNames';

/**
 * Validates that a page name matches the canonical constant
 * @param {string} pageName - The page name to validate
 * @returns {object} - { isValid: boolean, canonical: string, error: string|null }
 */
export function validatePageName(pageName) {
  // Case-sensitive check against PAGE_NAMES values
  const canonicalName = Object.values(PAGE_NAMES).find(
    name => name.toLowerCase() === pageName.toLowerCase()
  );

  if (!canonicalName) {
    return {
      isValid: false,
      canonical: null,
      error: `Page name "${pageName}" is not defined in PAGE_NAMES. Did you mean one of: ${Object.values(PAGE_NAMES).join(', ')}`
    };
  }

  // Check exact match
  if (canonicalName !== pageName) {
    console.warn(
      `[PAGE_NAME_INCONSISTENCY] Using "${pageName}" but canonical name is "${canonicalName}". ` +
      `This may cause navigation issues. Use PAGE_NAMES.${Object.keys(PAGE_NAMES).find(k => PAGE_NAMES[k] === canonicalName)} instead.`
    );
    
    return {
      isValid: false,
      canonical: canonicalName,
      error: `Case mismatch: "${pageName}" should be "${canonicalName}"`
    };
  }

  return {
    isValid: true,
    canonical: canonicalName,
    error: null
  };
}

/**
 * Safe wrapper for createPageUrl that validates the page name
 * @param {string} pageName - The page name (should come from PAGE_NAMES)
 * @returns {string} - The URL for the page
 */
export function createPageUrlSafe(pageName) {
  const validation = validatePageName(pageName);
  
  if (!validation.isValid) {
    console.error('[CREATE_PAGE_URL_ERROR]', validation.error);
    // Use canonical name if available, otherwise throw
    if (validation.canonical) {
      pageName = validation.canonical;
    } else {
      throw new Error(validation.error);
    }
  }

  // Use createPageUrl from utils
  const { createPageUrl } = await import('@/utils');
  return createPageUrl(pageName);
}

/**
 * Audit log for page name issues
 * Run this periodically or on deployment to catch issues
 */
export function auditPageNames() {
  const issues = [];
  
  // Check all PAGE_NAMES follow convention
  Object.entries(PAGE_NAMES).forEach(([key, value]) => {
    // Constants should be SCREAMING_SNAKE_CASE
    if (!/^[A-Z_]+$/.test(key)) {
      issues.push(`PAGE_NAMES.${key} should be in SCREAMING_SNAKE_CASE`);
    }
    
    // Values should be kebab-case or PascalCase (for component names)
    if (!/^[a-z0-9-]+$/.test(value) && !/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
      issues.push(`PAGE_NAMES.${key} = "${value}" should be either kebab-case (lowercase-with-hyphens) or PascalCase`);
    }
  });
  
  return {
    hasIssues: issues.length > 0,
    issues,
    totalPages: Object.keys(PAGE_NAMES).length
  };
}

// Log audit results on module load (development only)
if (import.meta.env?.DEV) {
  const audit = auditPageNames();
  if (audit.hasIssues) {
    console.warn('[PAGE_NAMES_AUDIT]', audit);
  }
}