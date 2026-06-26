import '@testing-library/jest-dom'

// Polyfill TextEncoder for jest-dom environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Polyfill TransformStream and ReadableStream for jest-dom environment
if (typeof global.TransformStream === 'undefined') {
  const { ReadableStream, TransformStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.TransformStream = TransformStream;
}
