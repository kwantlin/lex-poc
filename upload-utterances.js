#!/usr/bin/env node

"use strict";

const args = require("yargs").array("intents").argv;
const exec = require("child_process").execSync;
const region_id = "us-east-1";
const csv = require("csv-parser");
const fs = require("fs");

console.log("Spreadsheet: " + args.sheet);
console.log("Intent List: " + args.intents);

async function addUtterances() {
  args.intents.forEach(async intent => {
    // Read CSV File
    let utterances = await readCSV(args.sheet, intent);

    var getIntentCmd = `aws lex-models get-intent --region ${region_id} --name ${intent} --intent-version $LATEST > intent.json`;
    try {
      const aws_response1 = exec(getIntentCmd);

      // Read intent.json file
      fs.readFile("intent.json", function(err, data) {
        // Check for errors
        if (err) throw err;
        // Converting to JSON
        const intentJson = JSON.parse(data);
        delete intentJson["createdDate"];
        delete intentJson["lastUpdatedDate"];
        delete intentJson["version"];
        for (var utterance of utterances) {
          intentJson["sampleUtterances"].push(utterance);
        }

        intentJson["sampleUtterances"] = removeDuplicates(intentJson["sampleUtterances"]);
        console.log("iNTENT Json: ", intentJson);

        // Writing to a file
        fs.writeFile("intent.json", JSON.stringify(intentJson), err => {
          // Checking for errors
          if (err) throw err;

          console.log("Done writing to intent.json"); // Success
          var updateIntendCmd = `aws lex-models put-intent --region ${region_id} --name ${intent} --cli-input-json file://intent.json`;
          const aws_response2 = exec(updateIntendCmd);
          console.log("AWS Update Intent Response: ", aws_response2);
          if (args.bot) {
            console.log(`Rebuilding ${args.bot} Bot...`);
            var getBotCmd = `aws lex-models get-bot --region ${region_id} --name ${args.bot} --version-or-alias $LATEST > bot.json`;
            const getBotResponse = exec(getBotCmd);
            console.log("Get Bot Response: ", getBotResponse);

            // Read json file
            fs.readFile("bot.json", function(err, data) {
              console.log("Reading bot.json file");
              // Check for errors
              if (err) throw err;
              // Converting to JSON
              const botJson = JSON.parse(data);
              delete botJson["createdDate"];
              delete botJson["lastUpdatedDate"];
              delete botJson["status"];
              delete botJson["version"];
              botJson["processBehavior"] = "BUILD";
              // Writing to a file
              fs.writeFile("bot.json", JSON.stringify(botJson), err => {
                // Checking for errors
                if (err) throw err;
                console.log("Done writing to bot.json"); // Success
                var rebuildBotCmd = `aws lex-models put-bot --region ${region_id} --name ${args.bot} --cli-input-json file://bot.json`;
                const rebuildBotResponse = exec(rebuildBotCmd);
                console.log("Rebuild Bot Response: ", rebuildBotResponse);
              });
            });
          }
        });
      });
    } catch (error) {
      console.error(error);
      return;
    }
  });
}

async function readCSV(sheet, intent) {
  let result = [];
  return new Promise((resolve, reject) => {
    try {
      fs.createReadStream(sheet)
        .pipe(csv())
        .on("data", row => {
          //console.log(row);
          result.push(row);
        })
        .on("end", () => {
          let intentVals = [];
          for (var eachObj of result) {
            if (eachObj.hasOwnProperty(intent) && eachObj[intent] != "") {
              var value = eachObj[intent];
              //console.log(value);
              intentVals.push(value);
            }
          }
          resolve(intentVals);
          console.log("CSV file successfully processed");
        });
    } catch (err) {
      reject(err);
    }
  });
}

function removeDuplicates(array) {
  let a = [];
  array.map(x => {
    if (!a.includes(x)) {
      a.push(x);
    }
  });
  return a;
}

addUtterances();
