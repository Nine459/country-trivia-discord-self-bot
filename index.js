const { Client } = require("discord.js-selfbot-v13");
const { token, channelIds } = require("./config.json");
const fs = require("fs").promises;
const crypto = require("crypto");
const axios = require("axios");
const path = require("path");

const client = new Client({ checkUpdate: false, readyStatus: false });
const targetBotId = "859024110905458718";
const flagFilePath = path.join(__dirname, "data", "flag.json");
const shapeFilePath = path.join(__dirname, "data", "shape.json");
const mapFilePath = path.join(__dirname, "data", "map.json");
const historicalCountryFilePath = path.join(
  __dirname,
  "data",
  "historical-country.json"
);
const countryCapitalFilePath = path.join(
  __dirname,
  "data",
  "country-capital.json"
);

// Utility function to hash the image content
const hashImageContent = async (url) => {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return crypto.createHash("sha256").update(response.data).digest("hex");
  } catch (error) {
    console.error("Error fetching or hashing image:", error);
    return null;
  }
};

// Load data from JSON file
const loadData = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data || "{}");
  } catch (error) {
    console.error("Error loading or parsing JSON:", error);
    return {}; // Return an empty object if JSON parsing fails or file doesn't exist
  }
};

// Save updated data to JSON file
const saveMetaData = async (data, filePath) => {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving to JSON file:", error);
  }
};

const matchImageCapital = async (hashedImage) => {
  const flagData = await loadData(flagFilePath);
  const shapeData = await loadData(shapeFilePath);
  const mapData = await loadData(mapFilePath);

  const metaData = await loadData(countryCapitalFilePath);
  const matchedCountry =
    Object.keys(flagData).find((key) => flagData[key] === hashedImage) ||
    Object.keys(shapeData).find((key) => shapeData[key] === hashedImage) ||
    Object.keys(mapData).find((key) => mapData[key] === hashedImage);

  if (!matchedCountry) {
    return null;
  }

  const matchedCapital = Object.keys(metaData).find(
    (key) => metaData[key] === matchedCountry
  );
  return matchedCapital;
};

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.id === targetBotId && message.embeds.length > 0 && channelIds.includes(message.channel.id) ) {
    const embed = message.embeds[0];
    const questionMatch =
      embed.title &&
      (embed.title.match(/Question \d+ of \d+/) ||
        embed.title.match(/Guess this country!/));
    const flagMatch =
      embed.description &&
      embed.description.match(
        /To which country or territory does this flag belong/g
      );
    const shapeMatch =
      embed.description &&
      embed.description.match(
        /To which country or territory does this shape belong/g
      );
    const mapMatch =
      embed.description &&
      embed.description.match(
        /To which country or territory does this map belong/g
      );
    const historicalCountryMatch =
      embed.description &&
      embed.description.match(
        /To which historical country or territory does this flag belong/g
      );
    const hasImage = embed.image;
    const capitalMatch =
      embed.description &&
      embed.description.match(/What is the capital of this country/g);

    if (
      questionMatch &&
      hasImage &&
      (flagMatch || shapeMatch || mapMatch || historicalCountryMatch)
    ) {
      const imageUrl = embed.image.url;
      const hashedImage = await hashImageContent(imageUrl);

      if (!hashedImage) {
        await message.reply("Failed to hash the image.");
        return;
      }

      let metaData;
      if (flagMatch) {
        metaData = await loadData(flagFilePath);
      } else if (shapeMatch) {
        metaData = await loadData(shapeFilePath);
      } else if (mapMatch) {
        metaData = await loadData(mapFilePath);
      } else if (historicalCountryMatch) {
        metaData = await loadData(historicalCountryFilePath);
      }

      if (metaData && Object.keys(metaData).length > 0) {
        const matchedFlag = Object.keys(metaData).find(
          (key) => metaData[key] === hashedImage
        );

        if (matchedFlag) {
          //message.channel.sendTyping();
          setTimeout(() => {
            message.channel.send(`${matchedFlag.toLowerCase()}`);
          }, Math.floor(Math.random() * (4000 - 3000 + 1)) + 3000);
        } else {
          message.channel.send(`huH`);
          console.log("No match found. Waiting for follow-up message...");

          const filter = (msg) =>
            msg.author.id === targetBotId &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title.includes("No one got it right!");

          const collected = await message.channel.awaitMessages({
            filter,
            max: 1,
            time: 50000,
          });
          if (collected.size > 0) {
            const followUpMessage = collected.first();
            const countryMatch =
              followUpMessage.embeds[0].description.match(/\*\*(.*?)\*\*/);

            if (countryMatch) {
              const countryName = countryMatch[1];
              metaData[countryName] = hashedImage;

              if (flagMatch) {
                saveMetaData(metaData, flagFilePath);
              } else if (shapeMatch) {
                saveMetaData(metaData, shapeFilePath);
              } else if (mapMatch) {
                saveMetaData(metaData, mapFilePath);
              } else if (historicalCountryMatch) {
                saveMetaData(metaData, historicalCountryFilePath);
              }

              console.log(`New entry added: ${countryName}`);
            }
          }
        }
      } else {
        console.error("MetaData is undefined or empty.");
      }
    } else if (questionMatch && capitalMatch) {
      if (embed.image && embed.image.url) {
        const imageUrl = embed.image.url;
        const hashedImage = await hashImageContent(imageUrl);
        if (hashedImage) {
          const matchedCapital = await matchImageCapital(hashedImage);
          if (matchedCapital) {
            message.channel.sendTyping();
            setTimeout(
              () => message.channel.send(`${matchedCapital.toLowerCase()}`),
              Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000
            );
          } else {
            console.log(`No country flag matched`);
          }
        } else {
          console.log(`Failed to hash image: ${imageUrl}`);
        }
      } else {
        const description = embed.description;
        if (description) {
          const match = description.match(
            /What is the capital of this country\?\s*#\s*(.+)/
          );
          if (match) {
            const countryName = match[1].trim();
            const metaData = await loadData(countryCapitalFilePath);

            const matchedCapital = Object.keys(metaData).find(
              (key) => metaData[key] === countryName
            );
            if (matchedCapital) {
              setTimeout(() => {
                message.channel.send(`${matchedCapital.toLowerCase()}`);
              }, Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000);
            } else {
              message.channel.send(`NuH`);
              const filter = (msg) =>
                msg.author.id === targetBotId &&
                msg.embeds.length > 0 &&
                msg.embeds[0].title.includes("No one got it right!");

              const collected = await message.channel.awaitMessages({
                filter,
                max: 1,
                time: 50000,
              });
              if (collected.size > 0) {
                const followUpMessage = collected.first();
                const match = followUpMessage.embeds[0].description.match(
                  /The capital of \*\*(.+?)\*\*.*is \*\*(.+?)\*\*/
                );

                if (match) {
                  const countryName = match[1];
                  const capitalName = match[2];
                  metaData[capitalName] = countryName;
                  await saveMetaData(metaData, countryCapitalFilePath);
                  console.log(
                    `${countryName} : ${capitalName} has been added!`
                  );
                } else {
                  message.channel.send(`No match found`);
                }
              }
            }
          } else {
            console.log("Country name could not be extracted.");
          }
        }
      }
    }
  }
});

client.login(token);
