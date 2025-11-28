/**
 * Validates a phone number string by stripping non-digits and checking length.
 * @param phone The phone number to validate
 * @returns boolean - true if the cleaned phone number length is between 9 and 12 digits
 */
export const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 12;
  };
  
  /**
   * Formats a phone number by adding spaces for better readability
   * @param phone The phone number to format
   * @returns string - Formatted phone number with spaces
   */
  export const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    // Format as 6 99 99 99 99 or 237 6 99 99 99 99
    if (cleaned.startsWith('237')) {
      return `237 ${cleaned.substring(3, 4)} ${cleaned.substring(4, 6)} ${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)}`;
    }
    return `${cleaned.substring(0, 1)} ${cleaned.substring(1, 3)} ${cleaned.substring(3, 5)} ${cleaned.substring(5, 7)} ${cleaned.substring(7, 9)}`;
  };