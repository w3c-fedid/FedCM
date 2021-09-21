// const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function(eleventyConfig) {
  const md = require("markdown-it")({
    html: true,
    breaks: true,
    linkify: false
  });

  var defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const href = tokens[idx].attrIndex('href');

    if (href < 0) {
      return defaultRender(tokens, idx, options, env, self);
    }
    
    const url = tokens[idx].attrs[href][1];
    if (url.endsWith(".md")) {
      const result = url.replace(".md", ".html")
      tokens[idx].attrs[href][1] = result;
    }

    return defaultRender(tokens, idx, options, env, self);
  };
  
  // var defaultRender = md.renderer.rules.image;
  
  eleventyConfig.setLibrary("md", md);
  
  // Copy the `assets` directory to the compiled site folder
  eleventyConfig.addPassthroughCopy("static");
  //eleventyConfig.addPassthroughCopy("tmp");

  // eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.addFilter("replace", function(value) {
    if (value.endsWith(".md")) {
      return value.replace(".md", "");
    }
    if (value.endsWith(".html")) {
      return value.replace(".html", "");
    }
    return value;
  });

  // console.log(eleventyConfig.getFilter("url")("/static/foo.js"));

  //eleventyConfig.addFilter("url", function(value) {
    // console.log(value);
  //  return value;
  //});

  return {
    dir: {
      templateFormats: ["html", "liquid", "njk"],
      input: ".",
      output: "docs",
      includes: ".includes",
      data: ".data",
      pathprefix: "/WebID/"
    }
  }
};
