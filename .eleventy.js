module.exports = function(eleventyConfig) {
  // passthrough for existing assets
  eleventyConfig.addPassthroughCopy({ "assets": "assets" });

  // base dir
  return {
    dir: {
      input: "11ty-src",
      includes: "_includes",
      data: "_data",
      output: "11ty-out"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};