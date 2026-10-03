// Shared behavior belongs to the kit. Add only domain helpers in this file.
export { escHtml, debounce, showToast, copyText, downloadText } from './neorgon-dom.js';

// Do not cache nodes that a renderer can replace. While she is popped out the
// stage lives in the Picture-in-Picture document, so look there too.
let altDoc = null;
export const setAltDoc = (doc) => { altDoc = doc; };
export const $ = (id) => document.getElementById(id) || altDoc?.getElementById(id) || null;
