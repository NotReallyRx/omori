//=============================================================================
// web_shim.js
// Browser replacements for the NW.js/Node APIs used by the game's plugins.
// Only `require` is exposed: `process`, `module`, `exports` and `window.nw`
// deliberately stay undefined so Utils.isNwjs() keeps reporting false.
//=============================================================================
(function() {
    'use strict';

    function noop() {}

    function toUrl(filePath) {
        var url = String(filePath).replace(/\\/g, '/');
        url = url.replace(/^\.\/+/, '');
        if (url.charAt(0) === '/') { url = url.slice(1); }
        return url;
    }

    function requestSync(filePath) {
        var url = toUrl(filePath);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        try {
            xhr.send(null);
        } catch (e) {
            throw new Error('require("fs"): cannot read "' + url + '" - ' + e.message);
        }
        if (xhr.status !== 200) {
            var err = new Error('require("fs"): cannot read "' + url + '" (HTTP ' + xhr.status + ')');
            err.code = 'ENOENT';
            throw err;
        }
        return xhr;
    }

    var fs = {
        readFileSync: function(filePath, options) {
            var xhr = requestSync(filePath);
            var data = xhr.responseText;
            var encoding = (typeof options === 'string') ? options : (options && options.encoding);
            if (encoding && encoding !== 'binary' && encoding !== 'buffer') { return data; }
            var raw = xhr.response;
            if (!raw) {
                var bytes = new Uint8Array(data.length);
                for (var i = 0; i < data.length; i++) { bytes[i] = data.charCodeAt(i) & 0xff; }
                raw = bytes.buffer;
            }
            return raw;
        },
        readFile: function(filePath, options, callback) {
            if (typeof options === 'function') { callback = options; options = undefined; }
            try {
                callback(null, fs.readFileSync(filePath, options));
            } catch (e) {
                callback(e);
            }
        },
        readdirSync: function(dirPath) {
            var dirs = loadAssetManifest().dirEntries;
            var key = manifestKey(dirPath);
            if (Object.prototype.hasOwnProperty.call(dirs, key)) { return dirs[key].slice(); }
            throw new Error('require("fs").readdirSync: "' + key + '" is not a shipped directory.');
        },
        statSync: function(filePath) {
            var m = loadAssetManifest();
            var key = manifestKey(filePath);
            var isDir = m.dirSet[key] === 1;
            if (!isDir && m.fileSet[key] !== 1) {
                var err = new Error('require("fs").statSync: ENOENT "' + key + '"');
                err.code = 'ENOENT';
                throw err;
            }
            return {
                isDirectory: function() { return isDir; },
                isFile: function() { return !isDir; },
                size: 0
            };
        },
        existsSync: function(filePath) {
            var m = loadAssetManifest();
            var key = manifestKey(filePath);
            return m.fileSet[key] === 1 || m.dirSet[key] === 1;
        },        unlink: function(filePath, callback) { if (callback) { callback(null); } },
        unlinkSync: function() { throw new Error('require("fs"): writing to disk is disabled in the browser build.'); },
        writeFile: function(filePath, data, options, callback) {
            if (typeof options === 'function') { callback = options; }
            var err = new Error('require("fs"): writing to disk is disabled in the browser build.');
            if (callback) { callback(err); } else { throw err; }
        },
        writeFileSync: function() { throw new Error('require("fs"): writing to disk is disabled in the browser build.'); },
        mkdir: function(filePath, options, callback) {
            if (typeof options === 'function') { callback = options; }
            if (callback) { callback(null); }
        },
        mkdirSync: function() { throw new Error('require("fs"): writing to disk is disabled in the browser build.'); },
        stat: function(filePath, callback) {
            try { callback(null, fs.statSync(filePath)); } catch (e) { callback(e); }
        }
    };

    var pathModule = {
        sep: '/',
        delimiter: ':',
        isAbsolute: function(p) { return /^[a-zA-Z]+:\/|^\/|^\\\\/.test(String(p)); },
        normalize: function(p) {
            p = String(p).replace(/\\/g, '/');
            var parts = p.split('/');
            var out = [];
            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];
                if (!part || part === '.') { continue; }
                if (part === '..' && out.length && out[out.length - 1] !== '..') { out.pop(); continue; }
                out.push(part);
            }
            var prefix = (p.charAt(0) === '/' ? '/' : '');
            return prefix + out.join('/') + (p.charAt(p.length - 1) === '/' && out.length ? '/' : '');
        },
        join: function() {
            var joined = [];
            for (var i = 0; i < arguments.length; i++) {
                var part = arguments[i];
                if (part !== undefined && part !== null && part !== '') { joined.push(String(part)); }
            }
            return pathModule.normalize(joined.join('/'));
        },
        resolve: function() {
            var resolved = '';
            for (var i = arguments.length - 1; i >= 0 && !pathModule.isAbsolute(resolved); i--) {
                var part = arguments[i];
                if (part) { resolved = resolved ? String(part) + '/' + resolved : String(part); }
            }
            if (!pathModule.isAbsolute(resolved)) { resolved = '.'; }
            return pathModule.normalize(resolved);
        },
        dirname: function(p) {
            p = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
            var idx = p.lastIndexOf('/');
            if (idx < 0) { return '.'; }
            if (idx === 0) { return '/'; }
            return p.slice(0, idx);
        },
        basename: function(p, ext) {
            p = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
            var idx = p.lastIndexOf('/');
            var base = idx < 0 ? p : p.slice(idx + 1);
            if (ext && base.slice(-ext.length) === ext) { base = base.slice(0, -ext.length); }
            return base;
        },
        extname: function(p) {
            var base = pathModule.basename(p);
            var idx = base.lastIndexOf('.');
            return idx <= 0 ? '' : base.slice(idx);
        },
        relative: function(from, to) { return toUrl(to); },
        parse: function(p) {
            return { root: '', dir: pathModule.dirname(p), base: pathModule.basename(p),
                     ext: pathModule.extname(p), name: pathModule.basename(p, pathModule.extname(p)) };
        },
        format: function(obj) { return pathModule.join(obj.dir || '', obj.base || ''); }
    };

    var osModule = {
        platform: function() { return 'browser'; },
        arch: function() { return 'wasm'; },
        type: function() { return 'Browser'; },
        release: function() { return ''; },
        EOL: '\n',
        homedir: function() { return '/'; },
        tmpdir: function() { return '/'; }
    };

    var nwWindow = {
        x: 0, y: 0, isFullscreen: false,
        on: noop, once: noop, removeAllListeners: noop, removeListener: noop,
        focus: noop, show: noop, hide: noop, close: noop,
        moveTo: noop, moveBy: noop, resizeTo: noop, resizeBy: noop,
        enterFullscreen: noop, leaveFullscreen: noop,
        showDevTools: noop
    };

    var nwGui = {
        App: { argv: [], dataPath: '', name: '', version: '', quit: noop, clearCache: noop },
        Window: { get: function() { return nwWindow; } },
        Screen: { Init: noop, on: noop },
        Shell: {
            openExternal: function(url) { window.open(url, '_blank'); },
            openFile: noop
        }
    };

    var greenworks = {
        initAPI: function() { return false; },
        activateAchievement: noop,
        clearAchievement: noop,
        getAchievement: function(name, callback) { if (callback) { callback(false); } },
        getAchievementNames: function() { return []; },
        getNumberOfAchievements: function() { return 0; },
        getNumberOfPlayers: function() { return 0; },
        getSteamId: function() { return null; },
        getCurrentGameLanguage: function() { return 'english'; },
        isGameOverlayEnabled: function() { return false; },
        activateGameOverlay: noop,
        activateGameOverlayToWebPage: noop,
        saveTextToFile: function(file, contents, callback) { if (callback) { callback(); } },
        readTextFromFile: function(file, callback) { if (callback) { callback(''); } },
        isCloudEnabled: function() { return false; },
        isCloudEnabledForUser: function() { return false; },
        enableCloud: noop,
        getCloudQuota: function(callback) { if (callback) { callback(0, 0); } }
    };

    var modules = {
        'fs': fs,
        'path': pathModule,
        'os': osModule,
        'nw.gui': nwGui,
        'greenworks': greenworks,
        'pixi.js': window.PIXI,
        'crypto': {
            createDecipheriv: function() {
                throw new Error('require("crypto"): encrypted game data cannot be read in the browser build.');
            },
            createCipheriv: function() {
                throw new Error('require("crypto"): encrypted game data cannot be written in the browser build.');
            }
        },
        'child_process': { exec: noop, spawn: noop },
        'ncp': function(source, destination, callback) { if (callback) { callback(); } }
    };

    window.require = function(id) {
        var key = String(id).replace(/^\.\//, '').replace(/\\/g, '/');
        if (modules[key]) { return modules[key]; }
        if (key === 'js/libs/js-yaml-master') { return window.jsyaml; }
        if (key === 'js/libs/greenworks') { return modules['greenworks']; }
        throw new Error('require("' + id + '") is not available in the browser build.');
    };

    //=========================================================================
    // Shipped file manifest.
    // asset-manifest.json lists every shipped file ("files") plus each
    // directory's children ("dirs"). Requests are matched against it exactly
    // (case-insensitively), so any path that is not in the manifest does not
    // exist - there is no fallback guessing and no directory listing probe.
    //=========================================================================
    var assetManifest = null;
    var nativeXhrOpen = XMLHttpRequest.prototype.open;

    // Normalise a caller supplied path to the manifest's lower case key space.
    function manifestKey(p) {
        var key = toUrl(p).replace(/^\.\/+/, '').replace(/\/+$/, '');
        return key.toLowerCase();
    }

    function loadAssetManifest() {
        if (assetManifest) { return assetManifest; }
        var xhr = new XMLHttpRequest();
        nativeXhrOpen.call(xhr, 'GET', 'asset-manifest.json', false);
        xhr.send(null);
        if (xhr.status !== 200) {
            throw new Error('asset-manifest.json missing (HTTP ' + xhr.status + ') - rebuild it after adding files.');
        }
        var raw = JSON.parse(xhr.responseText);
        var map = {};
        var fileSet = {};
        var dirSet = {};
        var dirEntries = {};
        for (var i = 0; i < raw.files.length; i++) {
            map[raw.files[i].toLowerCase()] = raw.files[i];
            fileSet[raw.files[i].toLowerCase()] = 1;
        }
        for (var d in raw.dirs) {
            if (Object.prototype.hasOwnProperty.call(raw.dirs, d)) {
                dirSet[d.toLowerCase()] = 1;
                dirEntries[d.toLowerCase()] = raw.dirs[d];
                for (var j = 0; j < raw.dirs[d].length; j++) {
                    var child = d ? d + '/' + raw.dirs[d][j] : raw.dirs[d][j];
                    map[child.toLowerCase()] = child;
                    fileSet[child.toLowerCase()] = 1;
                }
            }
        }
        assetManifest = { map: map, fileSet: fileSet, dirSet: dirSet, dirEntries: dirEntries };
        return assetManifest;
    }

    function encodePathForUrl(path) {
        return path.split('/').map(function(segment) {
            return encodeURIComponent(segment);
        }).join('/');
    }

    function resolveAssetPath(url) {
        if (typeof url !== 'string' || !url) { return url; }
        if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(url) || url.slice(0, 2) === '//' || url.charAt(0) === '#') {
            return url;
        }
        var cut = url.search(/[?#]/);
        var path = (cut >= 0 ? url.slice(0, cut) : url).replace(/\\/g, '/');
        var suffix = cut >= 0 ? url.slice(cut) : '';
        path = path.replace(/^\.\/+/, '');
        if (!path || path.charAt(0) === '/') { return url; }
        var map = loadAssetManifest().map;
        // Callers hand over either raw file names or percent-encoded URLs
        // (e.g. %20 for spaces), while the manifest is keyed by the file
        // names on disk. Try both forms.
        var candidates = [path];
        if (path.indexOf('%') >= 0) {
            try {
                var decoded = decodeURIComponent(path);
                if (decoded !== path) { candidates.push(decoded); }
            } catch (e) {}
        }
        for (var i = 0; i < candidates.length; i++) {
            var lower = candidates[i].toLowerCase();
            if (Object.prototype.hasOwnProperty.call(map, lower)) {
                // Emit a URL-safe form of the real on-disk name so strict
                // servers (e.g. GitHub Pages) never see reserved characters
                // such as a literal '%' in the request path.
                return encodePathForUrl(map[lower]) + suffix;
            }
        }
        return url;
    }

    window.__resolveAssetPath = resolveAssetPath;
    window.__assetManifestCount = function() { return Object.keys(loadAssetManifest().map).length; };
    window.__assetExists = function(p) {
        var m = loadAssetManifest();
        var key = manifestKey(p);
        return m.fileSet[key] === 1 || m.dirSet[key] === 1;
    };

    // Absolute same-origin URLs (fetch callers pass full URLs) are resolved
    // through their path as well.
    function resolveAnyUrl(url) {
        if (typeof url !== 'string' || !url) { return url; }
        if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(url) && url.slice(0, 2) !== '//') {
            return resolveAssetPath(url);
        }
        try {
            var parsed = new URL(url, location.href);
            if (parsed.origin !== location.origin) { return url; }
            var rel = parsed.pathname.replace(/^\//, '') + parsed.search + parsed.hash;
            var fixed = resolveAssetPath(rel);
            return fixed === rel ? url : parsed.origin + '/' + fixed;
        } catch (e) {
            return url;
        }
    }

    // fetch() based assets: streamed audio (AudioStreaming.js).
    if (typeof window.fetch === 'function') {
        var nativeFetch = window.fetch;
        window.fetch = function(input, init) {
            if (typeof input === 'string') {
                input = resolveAnyUrl(input);
            } else if (input && typeof input.url === 'string') {
                var resolved = resolveAnyUrl(input.url);
                if (resolved !== input.url) {
                    try { input = new Request(resolved, input); } catch (e) {}
                }
            }
            return nativeFetch.call(this, input, init);
        };
    }

    // XHR based assets: JSON data, tiled maps, audio buffers, languages.
    XMLHttpRequest.prototype.open = function(method, url) {
        var args = Array.prototype.slice.call(arguments);
        if (String(method).toUpperCase() === 'GET' && typeof args[1] === 'string') {
            args[1] = resolveAssetPath(args[1]);
        }
        return nativeXhrOpen.apply(this, args);
    };

    // <img> based assets: every image loaded through Bitmap/Pixi.
    var imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imageSrc && imageSrc.set && imageSrc.get) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            configurable: true,
            enumerable: imageSrc.enumerable,
            get: function() { return imageSrc.get.call(this); },
            set: function(value) { imageSrc.set.call(this, resolveAssetPath(value)); }
        });
    }

    // <audio>/<video> based media, for completeness.
    var audioSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (audioSrc && audioSrc.set && audioSrc.get) {
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
            configurable: true,
            enumerable: audioSrc.enumerable,
            get: function() { return audioSrc.get.call(this); },
            set: function(value) { audioSrc.set.call(this, resolveAssetPath(value)); }
        });
    }
})();
