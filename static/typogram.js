async function load(url) {
  const response = await fetch(url);
  const bytes = await response.arrayBuffer();
  const module = await WebAssembly.compile(bytes);
  return await WebAssembly.instantiate(module);
}

async function svgbob(url) {
  const {exports: wasm} = await load(url);

  let WASM_VECTOR_LEN = 0;

  let cachegetUint8Memory0 = null;
  function getUint8Memory0() {
    if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
      cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachegetUint8Memory0;
  }
  
  const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;
      
  let cachedTextEncoder = new lTextEncoder('utf-8');

  const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
                        ? function (arg, view) {
                          return cachedTextEncoder.encodeInto(arg, view);
                        }
                        : function (arg, view) {
                          const buf = cachedTextEncoder.encode(arg);
                          view.set(buf);
                          return {
                            read: arg.length,
                            written: buf.length
                          };
                        });
      
  function passStringToWasm0(arg, malloc, realloc) {
        
    if (realloc === undefined) {
      const buf = cachedTextEncoder.encode(arg);
      const ptr = malloc(buf.length);
      getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
      WASM_VECTOR_LEN = buf.length;
      return ptr;
    }
        
    let len = arg.length;
    let ptr = malloc(len);
        
    const mem = getUint8Memory0();
          
    let offset = 0;
        
    for (; offset < len; offset++) {
      const code = arg.charCodeAt(offset);
      if (code > 0x7F) break;
      mem[ptr + offset] = code;
    }
        
    if (offset !== len) {
      if (offset !== 0) {
        arg = arg.slice(offset);
      }
      ptr = realloc(ptr, len, len = offset + arg.length * 3);
      const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
      const ret = encodeString(arg, view);
      
      offset += ret.written;
    }
          
    WASM_VECTOR_LEN = offset;
    return ptr;
  }
        
  let cachegetInt32Memory0 = null;
  function getInt32Memory0() {
    if (cachegetInt32Memory0 === null || cachegetInt32Memory0.buffer !== wasm.memory.buffer) {
      cachegetInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachegetInt32Memory0;
  }
      
  const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;
      
  let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });
      
  cachedTextDecoder.decode();
      
  function getStringFromWasm0(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
  }

  /**
   * @param {string} data
   * @returns {string}
   */
  return (data) => {
    try {
      const retptr = wasm.__wbindgen_export_0.value - 16;
      wasm.__wbindgen_export_0.value = retptr;
      var ptr0 = passStringToWasm0(data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len0 = WASM_VECTOR_LEN;
      wasm.convert_string(retptr, ptr0, len0);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_export_0.value += 16;
      wasm.__wbindgen_free(r0, r1);
    }
  }
}

document.addEventListener("DOMContentLoaded", async function() {
  //const convert_string = await svgbob("https://cdn.jsdelivr.net/npm/svgbob-wasm@0.4.1-a0/svgbob_wasm_bg.wasm");
  const convert_string = await svgbob("typogram.wasm");
  document.querySelectorAll("script[type='text/typogram']").forEach((script) => {
    const source = script.innerHTML;
    const dest = document.createElement("svg");
    dest.innerHTML = convert_string(source);
    script.parentNode.insertBefore(dest, script);
  });
});

