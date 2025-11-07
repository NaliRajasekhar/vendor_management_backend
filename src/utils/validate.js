const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateVendor(input) {
  const errors = {}
  if (!input.vendor) errors.vendor = 'Vendor is required'
  if (!input.implementation) errors.implementation = 'Implementation is required'
  if (!input.client) errors.client = 'Client is required'
  if (!input.name) errors.name = 'Name is required'
  if (!input.email) errors.email = 'Email is required'
  else if (!emailRegex.test(String(input.email))) errors.email = 'Email is invalid'
  return errors
}

export const validateContact = validateVendor
