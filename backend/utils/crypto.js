// ⚠️ DEPRECATED - DO NOT USE THIS FILE ⚠️
// 
// crypto.js has been REMOVED to prevent confusion.
// 
// Use encryption.js instead for ALL encryption needs!
// 
// Why?
// - crypto.js used GCM encryption (3-part format: iv:authTag:encrypted)
// - encryption.js uses CBC encryption (2-part format: iv:encrypted)
// - Having two different systems caused endless problems
// - Everything now uses encryption.js for consistency
//
// Example:
// const { encrypt, decrypt } = require('./encryption');
//
// This file exists only to prevent accidental recreation.
// DO NOT IMPLEMENT ANYTHING HERE!

throw new Error(`
  ❌ STOP! crypto.js has been deprecated!
  
  Use encryption.js instead:
  const { encrypt, decrypt } = require('./encryption');
  
  All encryption in this project MUST use encryption.js for consistency.
`);
