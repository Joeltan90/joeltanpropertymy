import properties from '../lib/properties.cjs';

// Vercel Web handler: credentials are read only in the server environment.
export default {fetch:request=>properties.handleProperties(request)};
