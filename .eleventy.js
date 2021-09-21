// const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function(eleventyConfig) {
  // eleventyConfig.setTemplateFormats(["html", "md", "xml"]);

  // Copy the `assets` directory to the compiled site folder
  eleventyConfig.addPassthroughCopy("static");
  //eleventyConfig.addPassthroughCopy("tmp");

  // eleventyConfig.addPlugin(syntaxHighlight);

  return {
    dir: {
      input: ".",
      output: "docs",
      includes: ".includes",
      // data: ".data",
    }
  }
};
