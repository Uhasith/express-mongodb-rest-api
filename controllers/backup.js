const asyncHandler = require("express-async-handler");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { FFCreator, FFScene, FFAlbum } = require("ffcreator");
const crypto = require("crypto");

//@desc Fetch images from tiktok
//@route POST /api/tiktok/images
//@access public
const getTiktokImagesUrls = asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url) {
    res.status(400);
    throw new Error("URL field is mandatory!");
  }

  const options = {
    method: "GET",
    url: "https://tiktok-scraper7.p.rapidapi.com/",
    params: {
      url: url,
      hd: "1",
    },
    headers: {
      "x-rapidapi-key": "f1c62648aamsh3751fcda9fb96a9p1b7b39jsne016f46f3fe2",
      "x-rapidapi-host": "tiktok-scraper7.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    const imageUrls = response.data.data.images;

    // Define output directory and filename
    const outputDir = path.join(__dirname, "..", "tiktok_generated_videos");
    await fs.promises.mkdir(outputDir, { recursive: true });

    const outputFilename = crypto.randomBytes(16).toString("hex") + ".mp4";
    const outputPath = path.join(outputDir, outputFilename);

    // Create temporary directory for images
    const tmpDir = path.join(__dirname, "tmp");
    await fs.promises.mkdir(tmpDir, { recursive: true });

    // Download images
    const downloadPromises = imageUrls.map((imageUrl, index) => {
      const filename = path.join(
        tmpDir,
        `${index.toString().padStart(5, "0")}.jpg`
      );
      return downloadImage(imageUrl, filename);
    });

    await Promise.all(downloadPromises);

    // Create video using ffcreator
    const creator = new FFCreator({
      cacheDir: tmpDir,
      outputDir: outputDir,
      width: 576,
      height: 1024,
      fps: 20,
    });

    const scene = new FFScene();
    scene.setBgColor("#000000");
    const durationPerImage = 5; // Each image is displayed for 5 seconds
    const totalDuration = imageUrls.length * durationPerImage;
    scene.setDuration(totalDuration);
    scene.setTransition("GridFlip", 2);

    const album = new FFAlbum({
      list: imageUrls.map((_, index) =>
        path.join(tmpDir, `${index.toString().padStart(5, "0")}.jpg`)
      ),
      x: 288,
      y: 512,
      width: 576,
      height: 576,
    });
    album.setTransition("zoomIn"); // Set album switching animation
    album.setDuration(durationPerImage); // Set the stay time of a single sheet
    album.setTransTime(1.5); // Set the duration of a single animation
    scene.addChild(album);

    creator.addChild(scene);

    creator.output(outputPath);
    creator.start();

    creator.on("complete", () => {
      console.log(`Video created successfully: ${outputPath}`);
      res.json({ message: "Video created", data: outputFilename });

      // Clean up temporary directory
      fs.promises
        .rm(tmpDir, { recursive: true, force: true })
        .catch(console.error);
    });

    creator.on("error", (error) => {
      console.error("Error creating video:", error);
      res.status(500).json({ message: "Error creating video" });

      // Clean up temporary directory
      fs.promises
        .rm(tmpDir, { recursive: true, force: true })
        .catch(console.error);
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error fetching images or creating video" });
  }
});

// Function to download image
async function downloadImage(url, filepath) {
  const response = await axios.get(url, { responseType: "stream" });
  const writeStream = fs.createWriteStream(filepath);
  await new Promise((resolve, reject) => {
    response.data.pipe(writeStream).on("finish", resolve).on("error", reject);
  });
}

module.exports = { getTiktokImagesUrls };
