// Core Node.js polyfills
import { Buffer } from 'buffer';
import process from 'process/browser.js';
import 'stream-browserify';
import 'util';
import 'path-browserify';
import 'os-browserify/browser';
import 'crypto-browserify';
import 'url';
import 'stream-http';
import 'https-browserify';
import 'browserify-zlib';
import 'querystring-es3';
import 'vm-browserify';

// Browser polyfills
import 'url-polyfill';

// Additional Node.js polyfills
import 'util/';
import 'path-browserify';
import 'os-browserify/browser';
import 'crypto-browserify';

// Configure global polyfills
if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
    window.process = window.process || process;

    // Polyfill other Node.js globals
    window.global = window;
    window.global.Buffer = window.Buffer;
    window.global.process = window.process;
} 