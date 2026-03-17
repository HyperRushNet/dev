(function(window) {
    'use strict';
    const LZ = {
        compress: function(uncompressed) {
            if (uncompressed == null) return '';
            let i, value, context_dictionary = {},
                context_dictionaryToCreate = {}, context_c = '', context_wc = '', context_w = '',
                context_enlargeIn = 2, context_dictSize = 3, context_numBits = 2,
                context_data_string = '', context_data_val = 0, context_data_position = 0,
                ii;
            for (ii = 0; ii < uncompressed.length; ii += 1) {
                context_c = uncompressed.charAt(ii);
                if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
                    context_dictionary[context_c] = context_dictSize++;
                    context_dictionaryToCreate[context_c] = true;
                }
                context_wc = context_w + context_c;
                if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
                    context_w = context_wc;
                } else {
                    if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                        if (context_w.charCodeAt(0) < 256) {
                            for (i = 0; i < context_numBits; i++) {
                                context_data_val = (context_data_val << 1);
                                if (context_data_position == 15) {
                                    context_data_position = 0;
                                    context_data_string += String.fromCharCode(context_data_val);
                                    context_data_val = 0;
                                } else context_data_position++;
                            }
                            value = context_w.charCodeAt(0);
                            for (i = 0; i < 8; i++) {
                                context_data_val = (context_data_val << 1) | (value & 1);
                                if (context_data_position == 15) {
                                    context_data_position = 0;
                                    context_data_string += String.fromCharCode(context_data_val);
                                    context_data_val = 0;
                                } else context_data_position++;
                                value = value >> 1;
                            }
                        } else {
                            value = 1;
                            for (i = 0; i < context_numBits; i++) {
                                context_data_val = (context_data_val << 1) | value;
                                if (context_data_position == 15) {
                                    context_data_position = 0;
                                    context_data_string += String.fromCharCode(context_data_val);
                                    context_data_val = 0;
                                } else context_data_position++;
                                value = 0;
                            }
                            value = context_w.charCodeAt(0);
                            for (i = 0; i < 16; i++) {
                                context_data_val = (context_data_val << 1) | (value & 1);
                                if (context_data_position == 15) {
                                    context_data_position = 0;
                                    context_data_string += String.fromCharCode(context_data_val);
                                    context_data_val = 0;
                                } else context_data_position++;
                                value = value >> 1;
                            }
                        }
                        context_enlargeIn--;
                        if (context_enlargeIn == 0) {
                            context_enlargeIn = Math.pow(2, context_numBits);
                            context_numBits++;
                        }
                        delete context_dictionaryToCreate[context_w];
                    } else {
                        value = context_dictionary[context_w];
                        for (i = 0; i < context_numBits; i++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == 15) {
                                context_data_position = 0;
                                context_data_string += String.fromCharCode(context_data_val);
                                context_data_val = 0;
                            } else context_data_position++;
                            value = value >> 1;
                        }
                    }
                    context_enlargeIn--;
                    if (context_enlargeIn == 0) {
                        context_enlargeIn = Math.pow(2, context_numBits);
                        context_numBits++;
                    }
                    context_dictionary[context_wc] = context_dictSize++;
                    context_w = String(context_c);
                }
            }
            if (context_w !== "") {
                if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                    if (context_w.charCodeAt(0) < 256) {
                        for (i = 0; i < context_numBits; i++) {
                            context_data_val = (context_data_val << 1);
                            if (context_data_position == 15) {
                                context_data_position = 0;
                                context_data_string += String.fromCharCode(context_data_val);
                                context_data_val = 0;
                            } else context_data_position++;
                        }
                        value = context_w.charCodeAt(0);
                        for (i = 0; i < 8; i++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == 15) {
                                context_data_position = 0;
                                context_data_string += String.fromCharCode(context_data_val);
                                context_data_val = 0;
                            } else context_data_position++;
                            value = value >> 1;
                        }
                    } else {
                        value = 1;
                        for (i = 0; i < context_numBits; i++) {
                            context_data_val = (context_data_val << 1) | value;
                            if (context_data_position == 15) {
                                context_data_position = 0;
                                context_data_string += String.fromCharCode(context_data_val);
                                context_data_val = 0;
                            } else context_data_position++;
                            value = 0;
                        }
                        value = context_w.charCodeAt(0);
                        for (i = 0; i < 16; i++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == 15) {
                                context_data_position = 0;
                                context_data_string += String.fromCharCode(context_data_val);
                                context_data_val = 0;
                            } else context_data_position++;
                            value = value >> 1;
                        }
                    }
                    context_enlargeIn--;
                    if (context_enlargeIn == 0) {
                        context_enlargeIn = Math.pow(2, context_numBits);
                        context_numBits++;
                    }
                    delete context_dictionaryToCreate[context_w];
                } else {
                    value = context_dictionary[context_w];
                    for (i = 0; i < context_numBits; i++) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position == 15) {
                            context_data_position = 0;
                            context_data_string += String.fromCharCode(context_data_val);
                            context_data_val = 0;
                        } else context_data_position++;
                        value = value >> 1;
                    }
                }
                context_enlargeIn--;
                if (context_enlargeIn == 0) {
                    context_enlargeIn = Math.pow(2, context_numBits);
                    context_numBits++;
                }
            }
            value = 2;
            for (i = 0; i < context_numBits; i++) {
                context_data_val = (context_data_val << 1) | (value & 1);
                if (context_data_position == 15) {
                    context_data_position = 0;
                    context_data_string += String.fromCharCode(context_data_val);
                    context_data_val = 0;
                } else context_data_position++;
                value = value >> 1;
            }
            while (true) {
                context_data_val = (context_data_val << 1);
                if (context_data_position == 15) {
                    context_data_string += String.fromCharCode(context_data_val);
                    break;
                } else context_data_position++;
            }
            return context_data_string;
        },
        decompress: function(compressed) {
            if (compressed == null) return '';
            if (compressed == "") return null;
            let i, dictionary = [], next, enlargeIn = 4, dictSize = 4, numBits = 3,
                entry = "", result = [], w, bits, resb, maxpower, power, c = "",
                data_string = compressed, data_val = data_string.charCodeAt(0),
                data_position = 32768, data_index = 1;
            for (i = 0; i < 3; i += 1) dictionary[i] = i;
            bits = 0;
            maxpower = Math.pow(2, 2);
            power = 1;
            while (power != maxpower) {
                resb = data_val & data_position;
                data_position >>= 1;
                if (data_position == 0) {
                    data_position = 32768;
                    data_val = data_string.charCodeAt(data_index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }
            switch (next = bits) {
                case 0:
                    bits = 0;
                    maxpower = Math.pow(2, 8);
                    power = 1;
                    while (power != maxpower) {
                        resb = data_val & data_position;
                        data_position >>= 1;
                        if (data_position == 0) {
                            data_position = 32768;
                            data_val = data_string.charCodeAt(data_index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    c = String.fromCharCode(bits);
                    break;
                case 1:
                    bits = 0;
                    maxpower = Math.pow(2, 16);
                    power = 1;
                    while (power != maxpower) {
                        resb = data_val & data_position;
                        data_position >>= 1;
                        if (data_position == 0) {
                            data_position = 32768;
                            data_val = data_string.charCodeAt(data_index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    c = String.fromCharCode(bits);
                    break;
                case 2:
                    return "";
            }
            dictionary[3] = c;
            w = c;
            result.push(c);
            while (true) {
                if (data_index > data_string.length) return "";
                bits = 0;
                maxpower = Math.pow(2, numBits);
                power = 1;
                while (power != maxpower) {
                    resb = data_val & data_position;
                    data_position >>= 1;
                    if (data_position == 0) {
                        data_position = 32768;
                        data_val = data_string.charCodeAt(data_index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                switch (next = bits) {
                    case 0:
                        bits = 0;
                        maxpower = Math.pow(2, 8);
                        power = 1;
                        while (power != maxpower) {
                            resb = data_val & data_position;
                            data_position >>= 1;
                            if (data_position == 0) {
                                data_position = 32768;
                                data_val = data_string.charCodeAt(data_index++);
                            }
                            bits |= (resb > 0 ? 1 : 0) * power;
                            power <<= 1;
                        }
                        dictionary[dictSize++] = String.fromCharCode(bits);
                        next = dictSize - 1;
                        enlargeIn--;
                        break;
                    case 1:
                        bits = 0;
                        maxpower = Math.pow(2, 16);
                        power = 1;
                        while (power != maxpower) {
                            resb = data_val & data_position;
                            data_position >>= 1;
                            if (data_position == 0) {
                                data_position = 32768;
                                data_val = data_string.charCodeAt(data_index++);
                            }
                            bits |= (resb > 0 ? 1 : 0) * power;
                            power <<= 1;
                        }
                        dictionary[dictSize++] = String.fromCharCode(bits);
                        next = dictSize - 1;
                        enlargeIn--;
                        break;
                    case 2:
                        return result.join('');
                }
                if (enlargeIn == 0) {
                    enlargeIn = Math.pow(2, numBits);
                    numBits++;
                }
                if (dictionary[next]) {
                    entry = dictionary[next];
                } else {
                    if (next === dictSize) {
                        entry = w + w.charAt(0);
                    } else {
                        return null;
                    }
                }
                result.push(entry);
                dictionary[dictSize++] = w + entry.charAt(0);
                enlargeIn--;
                if (enlargeIn == 0) {
                    enlargeIn = Math.pow(2, numBits);
                    numBits++;
                }
                w = entry;
            }
        }
    };
    const Tools = {
        encode: (str) => {
            try { return btoa(unescape(encodeURIComponent(str))); } 
            catch (e) { return str; }
        },
        decode: (str) => {
            try { return decodeURIComponent(escape(atob(str))); } 
            catch (e) { return str; }
        }
    };
    const CFG = { NS: 'vc_', THRESHOLD: 256 };
    const DB = {
        write: (key, val, ttl) => {
            const payload = {
                v: val,
                m: { t: Date.now(), e: ttl ? Date.now() + ttl : 0 }
            };
            let str = JSON.stringify(payload);
            let isComp = false;
            if (str.length > CFG.THRESHOLD) {
                str = LZ.compress(str);
                isComp = true;
            } 
            localStorage.setItem(CFG.NS + key, (isComp ? '1' : '0') + Tools.encode(str));
        },
        read: (key) => {
            const raw = localStorage.getItem(CFG.NS + key);
            if (!raw) return undefined;
            const flag = raw.charAt(0);
            const data = raw.substring(1);
            try {
                let jsonStr = Tools.decode(data);
                if (flag === '1') jsonStr = LZ.decompress(jsonStr);
                if (!jsonStr) return undefined; 
                const payload = JSON.parse(jsonStr);
                if (payload.m.e > 0 && Date.now() > payload.m.e) {
                    localStorage.removeItem(CFG.NS + key);
                    return undefined;
                }
                return payload.v;
            } catch (e) {
                console.warn("VaultCore read error", e);
                return undefined;
            }
        }
    };
    window.VaultCore = {
        stash: (key, val, ttlMs = null) => DB.write(key, val, ttlMs),
        retrieve: (key) => DB.read(key),
        scrap: (key) => localStorage.removeItem(CFG.NS + key),
        wipe: () => {
            Object.keys(localStorage)
                .filter(k => k.startsWith(CFG.NS))
                .forEach(k => localStorage.removeItem(k));
        },
        export: () => {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(CFG.NS));
            const bag = {};
            keys.forEach(k => bag[k] = localStorage.getItem(k));
            return Tools.encode(JSON.stringify(bag));
        },
        import: (str) => {
            try {
                const bag = JSON.parse(Tools.decode(str));
                for (let k in bag) localStorage.setItem(k, bag[k]);
                return true;
            } catch (e) { return false; }
        },
        maintenance: {
            stats: () => {
                let bytes = 0;
                const keys = Object.keys(localStorage).filter(k => k.startsWith(CFG.NS));
                keys.forEach(k => bytes += (localStorage.getItem(k) || '').length * 2);
                return { keys: keys.length, kb: (bytes / 1024).toFixed(2) };
            },
            purge: () => {
                const keys = Object.keys(localStorage).filter(k => k.startsWith(CFG.NS));
                let count = 0;
                keys.forEach(k => {
                    const pureKey = k.replace(CFG.NS, '');
                    if (DB.read(pureKey) === undefined) count++;
                });
                return `Purged ${count} expired items.`;
            }
        }
    };
})(window);
