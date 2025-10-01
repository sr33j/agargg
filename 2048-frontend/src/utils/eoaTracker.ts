// Track EOA addresses used for deposits to ensure consistent withdrawals
const EOA_STORAGE_KEY = 'agar_game_eoa_addresses';

interface EOAMapping {
  [privyAddress: string]: {
    eoaAddress: string;
    timestamp: number;
  };
}

export function storeEOAAddress(privyAddress: string, eoaAddress: string): void {
  try {
    const existing = localStorage.getItem(EOA_STORAGE_KEY);
    const mappings: EOAMapping = existing ? JSON.parse(existing) : {};
    
    mappings[privyAddress.toLowerCase()] = {
      eoaAddress: eoaAddress.toLowerCase(),
      timestamp: Date.now()
    };
    
    localStorage.setItem(EOA_STORAGE_KEY, JSON.stringify(mappings));
    console.log("💾 Stored EOA address for Privy wallet:", {
      privy: privyAddress,
      eoa: eoaAddress
    });
  } catch (error) {
    console.error("Failed to store EOA address:", error);
  }
}

export function getStoredEOAAddress(privyAddress: string): string | null {
  try {
    const existing = localStorage.getItem(EOA_STORAGE_KEY);
    if (!existing) return null;
    
    const mappings: EOAMapping = JSON.parse(existing);
    const mapping = mappings[privyAddress.toLowerCase()];
    
    if (!mapping) return null;
    
    // Check if mapping is older than 30 days (optional cleanup)
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - mapping.timestamp > thirtyDaysMs) {
      console.log("🗑️ EOA mapping expired, removing:", mapping);
      delete mappings[privyAddress.toLowerCase()];
      localStorage.setItem(EOA_STORAGE_KEY, JSON.stringify(mappings));
      return null;
    }
    
    console.log("🔍 Found stored EOA address for Privy wallet:", {
      privy: privyAddress,
      eoa: mapping.eoaAddress
    });
    
    return mapping.eoaAddress;
  } catch (error) {
    console.error("Failed to retrieve EOA address:", error);
    return null;
  }
}

export function clearEOAAddress(privyAddress: string): void {
  try {
    const existing = localStorage.getItem(EOA_STORAGE_KEY);
    if (!existing) return;
    
    const mappings: EOAMapping = JSON.parse(existing);
    delete mappings[privyAddress.toLowerCase()];
    localStorage.setItem(EOA_STORAGE_KEY, JSON.stringify(mappings));
    
    console.log("🗑️ Cleared EOA address for Privy wallet:", privyAddress);
  } catch (error) {
    console.error("Failed to clear EOA address:", error);
  }
}

export function getAllStoredMappings(): EOAMapping {
  try {
    const existing = localStorage.getItem(EOA_STORAGE_KEY);
    return existing ? JSON.parse(existing) : {};
  } catch (error) {
    console.error("Failed to get all EOA mappings:", error);
    return {};
  }
} 